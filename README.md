# AI-Bridge

GPTs와 로컬 환경(DB, API)을 연결하는 GitHub 기반 브릿지

## 아키텍처

`
GPTs ---> GitHub API ---> AI-Bridge Repo ---> Local Worker ---> FastAPI/MySQL
`

## 폴더 구조

- gpts_commands/ - GPTs가 명령 파일 생성
- gpts_results/ - Worker가 결과 저장

## 명령 파일 형식

### DB 쿼리
`json
{
  "id": "query_001",
  "type": "db_query",
  "query": "SELECT * FROM funds LIMIT 10"
}
`

### API 호출
`json
{
  "id": "api_001",
  "type": "api_call",
  "endpoint": "/api/v1/fred-macro/indicators/key",
  "method": "GET"
}
`

## GPTs Actions 설정

- Schema: gpts_github_actions.json
- Auth: Bearer Token (GitHub PAT)
- Privacy: https://github.com/etrezero/AI-Bridge/blob/main/PRIVACY.md

## 지원 API

| 엔드포인트 | 설명 |
|-----------|------|
| /api/v1/fred-macro/* | FRED 거시경제 |
| /api/v1/tdf-focus/* | TDF 펀드 |
| /api/v1/mysql-pivot/* | MySQL 쿼리 |
| /mcp/* | MCP 도구 |