# 백엔드 AI 작업 규칙

> 저장소 공통 규칙 [../AGENTS.md](../AGENTS.md) 를 먼저 따른다. 이 파일은 `backend/` 에서 작업할 때 추가로 지킬 것이다.
> 설계 문서가 기준이다. 문서와 다르게 구현해야 하면 **구현하지 말고 사용자에게 알린다.** `docs/` 는 이 작업에서 고치지 않는다 (API 를 바꾸는 PR 이면 관련 문서를 같은 PR 에서 함께 고친다).

## 코드를 쓰기 전에 읽을 문서
| 문서 | 내용 |
|------|------|
| [docs/development/features.md](../docs/development/features.md) | 기능 번호 BE1~BE14 |
| [docs/development/03-api.md](../docs/development/03-api.md) | API 계약 (1부 프론트 ↔ 백엔드, 2부 백엔드 ↔ AI 서버). 3D 연동 API 는 응답을 감싸지 않는 예외 |
| [docs/development/04-database.md](../docs/development/04-database.md) | 테이블 |
| [docs/development/10-prompt-assembly.md](../docs/development/10-prompt-assembly.md) | 프롬프트 조립 순서 · AI 응답 처리 · 3D 후보 선정 · 이벤트 저장 · 정산(v003) |
| [docs/development/02-architecture.md](../docs/development/02-architecture.md) | 기술 스택 (Django + DRF · PostgreSQL · HTTPX · Gunicorn) |
| [docs/development/06-deployment.md](../docs/development/06-deployment.md) | 서버 · Nginx · 터널 · 환경변수 |
| [docs/unity/USAGE.md](../docs/unity/USAGE.md) 의 "백엔드" 열 | Unity 이벤트 · 정산 명세, 카탈로그 |

## 꼭 지킬 것
- AI 응답의 `stateChanges` 는 제안이다. 확인 후 반영한다 (말만으로 직업 변경 금지)
- 3D 이벤트는 Unity 원본 그대로 저장하고, DB 저장 후에만 `{stored: true, sessionId, eventId}` 를 준다
- 건강 · 질병 정보는 저장하지 않는다
- 비밀값(`AI_SERVER_KEY` 등)은 `.env` 로만 둔다
- 머지 전 `python manage.py test` 를 실행해 통과를 확인한다
