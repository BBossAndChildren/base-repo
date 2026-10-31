# 프론트 AI 작업 규칙

> 저장소 공통 규칙 [../AGENTS.md](../AGENTS.md) 를 먼저 따른다. 이 파일은 `frontend/` 에서 작업할 때 추가로 지킬 것이다.
> 설계 문서가 기준이다. 문서와 다르게 구현해야 하면 **구현하지 말고 사용자에게 알린다.** `docs/` 는 이 작업에서 고치지 않는다.

## 코드를 쓰기 전에 읽을 문서
| 문서 | 내용 |
|------|------|
| [docs/development/features.md](../docs/development/features.md) | 기능 번호 FE1~FE10 |
| [docs/development/05-ui-ux.md](../docs/development/05-ui-ux.md) | 화면 · 라우팅 · API 호출 규칙 · 3D 체험 연결 · 오류 문구 |
| [docs/development/03-api.md](../docs/development/03-api.md) 1부 | 백엔드 API 계약 |
| [docs/development/01-user-flow.md](../docs/development/01-user-flow.md) | 사용자 흐름 · 예외 상황 |
| [docs/development/10-prompt-assembly.md 4-4](../docs/development/10-prompt-assembly.md#4-4-오류-안내-문구) | 3D 오류 안내 문구 |
| [docs/unity/USAGE.md](../docs/unity/USAGE.md) 의 "프론트" 열 | Unity 연결 코드 · 명세 |

## 꼭 지킬 것
- `docs/unity/frontend/` 의 Unity 연결 코드는 **참고만 한다.** `frontend/` 로 복사하지 않고, 그 동작 · 메시지 형식 · 확인 규칙을 따라 작성한다
- 백엔드 어댑터는 `credentials: 'omit'` + `X-Player-Id` 헤더
- 브라우저 `alert` 를 쓰지 않는다 (토스트 · 모달)
- 백엔드 주소는 환경변수로만 둔다
- 머지 전 lint · build 를 실행해 통과를 확인한다
