# AI-Bridge

GPTs와 로컬 환경(DB, API, 서비스)을 연결하는 GitHub 기반 브릿지 시스템

## 🏗️ 아키텍처

```
┌─────────────────┐                  ┌─────────────────┐
│                 │   GitHub API     │                 │
│     GPTs        │─────(HTTPS)─────▶│    GitHub       │
│   (ChatGPT)     │                  │   AI-Bridge     │
│                 │◀────(HTTPS)──────│    Repository   │
└─────────────────┘                  └────────┬────────┘
                                              │ polling
                                              ▼
                                     ┌─────────────────┐
                                     │  Bridge Worker  │
                                     │    (로컬 PC)    │
                                     └────────┬────────┘
                                              │ HTTP
                                              ▼
                                     ┌─────────────────┐
                                     │  FastAPI :8000  │
                                     │  MySQL DB       │
                                     └─────────────────┘
```

## 📁 폴더 구조

```
AI-Bridge/
├── gpts_commands/     ← GPTs가 명령 파일 생성
│   └── cmd_*.json
├── gpts_results/      ← Worker가 결과 파일 저장
│   └── result_*.json
├── README.md
└── PRIVACY.md
```

## 🔄 동작 흐름

1. **GPTs** → GitHub API로 `gpts_commands/cmd_xxx.json` 파일 생성
2. **Worker** → 주기적으로 `gpts_commands/` 폴더 polling
3. **Worker** → 명령 파일 발견 시 로컬 API/DB 호출
4. **Worker** → 결과를 `gpts_results/result_xxx.json`에 저장
5. **GPTs** → `gpts_results/`에서 결과 파일 읽기

## 📝 명령 파일 형식

### DB 쿼리 명령
```json
{
  "id": "query_001",
  "type": "db_query",
  "query": "SELECT * FROM funds LIMIT 10"
}
```

### API 호출 명령
```json
{
  "id": "api_001",
  "type": "api_call",
  "endpoint": "/api/v1/fred-macro/indicators/key",
  "method": "GET",
  "params": {}
}
```

### MCP 도구 실행 명령
```json
{
  "id": "mcp_001",
  "type": "mcp_tool",
  "tool": "mysql_query",
  "params": {
    "query": "SELECT COUNT(*) FROM funds"
  }
}
```

## 📊 결과 파일 형식

```json
{
  "id": "query_001",
  "success": true,
  "data": [...],
  "error": null,
  "executed_at": "2026-04-01T10:30:00",
  "duration": 0.234
}
```

## 🔧 GPTs Actions 설정

### OpenAPI Schema
- 위치: `mcp/github_bridge/gpts_github_actions.json`
- 기능: createCommand, listResults, getResult, getFileContent, getRepoTree

### Authentication
- Type: API Key (Bearer)
- Token: GitHub Personal Access Token (repo 권한 필요)

### Privacy Policy
- URL: https://github.com/etrezero/AI-Bridge/blob/main/PRIVACY.md

## 🚀 Worker 실행

```bash
cd C:\Covenant\Docker_app\MCP_Dynamic\mcp\github_bridge
python github_bridge_worker.py --token YOUR_TOKEN --repo etrezero/AI-Bridge
```

## 📡 지원 API 엔드포인트

| 카테고리 | 엔드포인트 | 설명 |
|---------|-----------|------|
| 거시경제 | /api/v1/fred-macro/* | FRED 데이터 |
| TDF | /api/v1/tdf-focus/* | TDF 펀드 분석 |
| 포트폴리오 | /api/v1/portfolio-backtest/* | 백테스트 |
| 자산배분 | /api/v1/s-asset-allocation/* | S자산배분 |
| MySQL | /api/v1/mysql-pivot/* | DB 쿼리 |
| MCP | /mcp/* | MCP 도구 |

## 📞 문의

- GitHub: [@etrezero](https://github.com/etrezero)
- Email: etrezero@gmail.com