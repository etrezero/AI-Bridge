/**
 * AI-Bridge Cloudflare Worker
 * GPTs → Cloudflare Worker → GitHub API → Local Worker → MySQL
 * 
 * 배포: https://workers.cloudflare.com/
 * 1. Cloudflare 계정 생성
 * 2. Workers & Pages → Create Worker
 * 3. 이 코드 붙여넣기
 * 4. Environment Variables에 GITHUB_TOKEN 추가
 */

const GITHUB_REPO = 'etrezero/AI-Bridge';
const GITHUB_API = 'https://api.github.com';

export default {
  async fetch(request, env) {
    // CORS 헤더
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check
      if (path === '/' || path === '/health') {
        return jsonResponse({ status: 'ok', service: 'AI-Bridge Worker', version: '1.0.0' }, corsHeaders);
      }

      // DB Schema (직접 반환 - 캐시됨)
      if (path === '/schema' || path === '/db_schema') {
        const schema = await fetchGitHubFile(env.GITHUB_TOKEN, 'db_schema.json');
        return jsonResponse(schema, corsHeaders);
      }

      // Create Command (GPTs → GitHub)
      if (path === '/command' && request.method === 'POST') {
        const body = await request.json();
        const result = await createCommand(env.GITHUB_TOKEN, body);
        return jsonResponse(result, corsHeaders);
      }

      // Execute Query (통합: 명령 생성 + 결과 대기 + 반환)
      if (path === '/query' && request.method === 'POST') {
        const body = await request.json();
        const result = await executeQueryWithPolling(env.GITHUB_TOKEN, body);
        return jsonResponse(result, corsHeaders);
      }

      // List Results
      if (path === '/results') {
        const results = await listResults(env.GITHUB_TOKEN);
        return jsonResponse(results, corsHeaders);
      }

      // Get Specific Result
      if (path.startsWith('/result/')) {
        const filename = path.replace('/result/', '');
        const result = await getResult(env.GITHUB_TOKEN, filename);
        return jsonResponse(result, corsHeaders);
      }

      // MCP Tool 실행 (통합)
      if (path === '/mcp' && request.method === 'POST') {
        const body = await request.json();
        const result = await executeMcpTool(env.GITHUB_TOKEN, body);
        return jsonResponse(result, corsHeaders);
      }

      return jsonResponse({ error: 'Not found', path }, corsHeaders, 404);

    } catch (error) {
      return jsonResponse({ error: error.message }, corsHeaders, 500);
    }
  }
};

// JSON Response Helper
function jsonResponse(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// GitHub 파일 읽기
async function fetchGitHubFile(token, path) {
  const resp = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/${path}`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'AI-Bridge-Worker'
    }
  });
  
  if (!resp.ok) {
    throw new Error(`GitHub API error: ${resp.status}`);
  }
  
  const data = await resp.json();
  const content = atob(data.content.replace(/\n/g, ''));
  return JSON.parse(content);
}

// 명령 생성
async function createCommand(token, command) {
  const id = command.id || `cmd_${Date.now()}`;
  const filename = `${id}.json`;
  const content = btoa(JSON.stringify({ ...command, id, created_at: new Date().toISOString() }));
  
  const resp = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/gpts_commands/${filename}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'AI-Bridge-Worker',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `Command: ${id}`,
      content: content
    })
  });
  
  if (!resp.ok) {
    const error = await resp.text();
    throw new Error(`Failed to create command: ${error}`);
  }
  
  return { success: true, id, filename };
}

// 결과 목록 조회
async function listResults(token) {
  const resp = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}/contents/gpts_results`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'AI-Bridge-Worker'
    }
  });
  
  if (!resp.ok) {
    return { files: [] };
  }
  
  const files = await resp.json();
  return { files: files.map(f => f.name) };
}

// 특정 결과 조회
async function getResult(token, filename) {
  try {
    return await fetchGitHubFile(token, `gpts_results/${filename}`);
  } catch (e) {
    return { error: 'Result not found', filename };
  }
}

// 쿼리 실행 + 폴링 (핵심 기능)
async function executeQueryWithPolling(token, body) {
  const { query, type = 'db_query', timeout = 30000, pollInterval = 2000 } = body;
  
  if (!query) {
    return { error: 'query is required' };
  }
  
  // 1. 명령 생성
  const id = `cmd_${Date.now()}`;
  const command = { id, type, query };
  await createCommand(token, command);
  
  // 2. 결과 폴링
  const resultFilename = `result_${id}.json`;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    await sleep(pollInterval);
    
    try {
      const result = await fetchGitHubFile(token, `gpts_results/${resultFilename}`);
      if (result && result.status) {
        return result;
      }
    } catch (e) {
      // 아직 결과 없음, 계속 폴링
    }
  }
  
  return { 
    error: 'Timeout waiting for result', 
    id,
    message: '로컬 Worker가 실행 중인지 확인하세요. 결과 파일: gpts_results/' + resultFilename
  };
}

// MCP Tool 실행 + 폴링
async function executeMcpTool(token, body) {
  const { tool, params, timeout = 30000, pollInterval = 2000 } = body;
  
  if (!tool) {
    return { error: 'tool is required' };
  }
  
  // 1. 명령 생성
  const id = `mcp_${Date.now()}`;
  const command = { id, type: 'mcp_tool', tool, params };
  await createCommand(token, command);
  
  // 2. 결과 폴링
  const resultFilename = `result_${id}.json`;
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    await sleep(pollInterval);
    
    try {
      const result = await fetchGitHubFile(token, `gpts_results/${resultFilename}`);
      if (result && result.status) {
        return result;
      }
    } catch (e) {
      // 계속 폴링
    }
  }
  
  return { 
    error: 'Timeout waiting for result', 
    id,
    message: '로컬 Worker가 실행 중인지 확인하세요.'
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
