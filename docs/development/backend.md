# 백엔드 구현 · 테스트 진행 규칙

> 모든 백엔드 구현·수정 작업에 적용한다. 사용자 지시(2026-10-31): **기능 목록 추출 → 한 기능 구현 → 해당 테스트 작성·실행 → 통과 확인 → 다음 기능**.
> 서비스 기준: [00-idea.md](../00-idea.md) · 계약 기준: [03-api.md](03-api.md) · 협업 규칙: [CONTRIBUTING.md](../CONTRIBUTING.md).

## 1. 필수 작업 순서

1. `AGENTS.md`, `CONTRIBUTING.md`, 이 문서와 최신 API 명세를 먼저 읽는다. 설계 문서를 변경하면 [FILL-GUIDE.md](FILL-GUIDE.md)도 읽는다.
2. 최신 `develop` · `docs`를 확인하고 API의 Method · Path · 인증 · 요청 · 응답 · 오류를 아래 목록과 대조한다. 계약이 바뀌면 목록과 테스트 기준부터 갱신한다.
3. 이슈를 만들고 최신 `develop`에서 작업 브랜치를 만든다.
4. 의존 기능이 통과했는지 확인하고 **기능 하나만** `진행 중`으로 표시해 구현한다. 필요한 최소 공통 코드와 migration도 포함한다.
5. 같은 작업에서 해당 기능의 테스트 코드를 작성한다. 정상 응답 · 잘못된 입력 · 소유권 · DB 저장 결과 · 실패 시 미저장 등 실제 동작을 검증한다.
6. 실제 PostgreSQL 테스트를 실행한다. 외부 AI는 통제된 테스트 서버/응답으로 검증하고 실제 AI 추론과 구분한다.
7. **실패하면 현재 기능을 수정하고 재실행한다. 통과 전 다음 기능 구현을 시작하지 않는다.** 실패·미실행을 통과로 보고하지 않는다.
8. 통과한 테스트 파일 · 명령 · 결과를 4절에 기록하고 상태를 갱신한 뒤 다음 기능으로 이동한다.
9. 공통 코드를 바꾸면 영향을 받는 이전 기능 테스트도 재실행한다. 최종적으로 전체 테스트 · lint · build를 통과한 뒤 PR 체크리스트를 확인하고 기존 협업 규칙대로 머지한다.

## 2. API 전체 목록과 기능별 통과 기준

상태: `미착수` / `진행 중` / `자동 테스트 통과` / `외부 연동 대기`. 설계 문서나 Swagger 경로만 있어서는 완료가 아니다.

### 프론트 → 백엔드 (9개)

| ID | Method · Path | 기능 | 필수 테스트 | 상태 |
|---|---|---|---|---|
| BE1 | POST `/api/v1/players` | 게스트 발급 | 인증 없이 UUID 발급 · DB 저장 · 호출마다 다른 ID | 미착수 |
| BE2 | POST `/api/v1/plays` | 게임 시작 | 필수/조건부 입력 · 선택 항목 · 허용하지 않는 필드 · 알 수 없는 플레이어 401 · 플레이어별 저장 | 미착수 |
| BE3 | POST `/api/v1/plays/{playId}/turns` | 채팅 한 턴 | 메시지 검증 · 소유권 · 종료 후 409 · 최근 20턴 · AI 오류/30초 초과 시 미저장 · 허용된 상태 변경만 저장 · 3D 추천 검증 | 미착수 |
| BE4 | POST `/api/v1/plays/{playId}/experiences/{experienceId}/events` | 3D 이벤트 | Unity 형식 · 식별자/소유권 · 저장 후 ACK · 동일 이벤트 중복 · 내용 충돌 409 · 지연 이벤트 · 누적값 · 초기화 실행 분리 · 종료 결과 1회 반영 | 미착수 |
| BE5 | GET `/api/v1/plays/{playId}/result` | 결말·추천 조회 | 소유권 · 응답 형식 · 저장된 기록 사용 · 미정 추천 정책의 임의 확정 금지 | 미착수 |
| BE6 | GET `/api/v1/players/me/plays` | 플레이 목록 | 본인 기록만 조회 · 빈 목록 · 시작 시각/종료 여부/요약 | 미착수 |
| BE7 | GET `/api/v1/plays/{playId}` | 플레이 재개 | 본인 상태/최근 대화 · 다른 사람/없는 ID 404 · 재접속만으로 체험 정산하지 않음 | 미착수 |
| BE8 | POST `/api/v1/plays/{playId}/experiences/reconcile` | 종료 미수신 정산 | Unity 수락 사례 16개 · 원자적 lease/소유권 처리 · 요청 중복/충돌 · 늦은 종료 revision · 이전 기록 보존 | 미착수 |
| BE9 | POST `/api/v1/plays/{playId}/experiences/{experienceId}/heartbeat` | 생존 신호 | 소유권 · 120초 lease 갱신 · 종료/차단된 체험 보호 · 시간 초과만으로 종료하지 않음 | 미착수 |

### 백엔드 → 별도 AI 서버 (2개 호출 계약)

아래 경로는 GPU AI 서버의 API다. 백엔드는 HTTPX 호출·인증·응답 검증을 구현한다. AI 서버 자체 구현·실모델 검증은 별도 담당 범위이며 테스트 서버 통과와 구분한다.

| ID | Method · Path | 기능 | 필수 테스트 | 상태 |
|---|---|---|---|---|
| AI1 | POST `/ai/v1/chat` | 프롬프트 조립·대화 호출 | 가이드라인/시나리오 필수 · 매 요청 포함 · 내부 키 · 최근 20턴 · 응답 JSON · 재요청 1회 · 전체 30초 제한 · 누락/실패를 정상 응답으로 위장하지 않음 | 미착수 |
| AI2 | POST `/ai/v1/experience-recommendation` | 3D 추천 호출 | 카탈로그 전달 · 실행 가능한 빌드/방/시나리오/버전만 허용 · 목록 외 값/실패/추천 없음이면 텍스트 진행 | 미착수 |

### 기존 실행 기반 (회귀 검증)

| 경로/항목 | 검증 내용 | 기존 테스트 |
|---|---|---|
| GET `/api/health` | DB 정상 200 · 실패 503 · 비밀값 비노출 | `backend/apps/core/tests.py` |
| GET `/api/schema/` | 실제 구현 API의 OpenAPI 생성·검증 | `backend/apps/core/tests.py` |
| GET `/api/docs/` | Swagger 접근 | `backend/apps/core/tests.py` |
| CORS | 허용 출처와 `X-Player-Id` 사전 요청 | `backend/apps/core/tests.py` |

## 3. 구현 순서와 테스트 명령

의존성 순서: **BE1 → BE2 → BE7 → BE6 → AI1 → AI2 → BE3 → BE9 → BE4 → BE8 → BE5**. 모델은 현재 기능에 필요한 만큼 추가하고 migration을 함께 검증한다.

테스트는 `backend/apps/game/tests/test_<기능>.py`에 나누고, 파일은 해당 기능을 구현할 때 만든다. 예를 들어 BE1의 완료 판단은 아래 명령을 실제로 실행한 결과로 한다.

```bash
cd backend
docker compose exec -T backend python manage.py test apps.game.tests.test_players --verbosity 2
```

전체 완료 전 필수 확인:

```bash
docker compose exec -T backend python manage.py test --verbosity 2
docker compose exec -T backend python manage.py check
docker compose exec -T backend python manage.py makemigrations --check --dry-run
docker compose exec -T backend python manage.py migrate --check
docker compose exec -T backend python manage.py spectacular --validate --fail-on-warn --file /tmp/openapi.yaml
.venv/bin/ruff check .
.venv/bin/ruff format --check .
docker compose build backend
```

## 4. 기능별 실행 기록

예정과 실행을 구분한다. 테스트 수·통과 여부는 실행 출력으로 확인한 값만 적는다. 실패 기록은 지우지 않고 수정 후 재실행 결과를 덧붙인다. mock 사용 여부와 실제 AI 검증 여부를 구분한다.

| 순서 | 기능 | 테스트 파일 · 명령 | 실행 결과 | 다음 기능 진행 가능 |
|---|---|---|---|---|
| — | 아직 구현 시작 전 | — | 미실행 | BE1부터 시작 |

## 5. 미확정·외부 의존 사항

- 현재 명세는 1차 설계안이다. 게임 상태의 수치 규칙과 결말 추천 기준은 미정이다. 구현 가정과 미정인 항목을 구분해 기록한다.
- 현재 `docs/game/`에는 안내 README만 있다. 실제 가이드라인·시나리오 없이 AI 요청을 보내지 않는다. 테스트 콘텐츠는 원본과 분리하고 테스트용임을 표시한다.
- AI 주소·내부 키는 환경변수로 제공한다. 테스트 서버로 통신·오류를 검증해도 실제 GPU AI 검증은 `외부 연동 대기`로 남긴다.
- Unity 정산은 [원본 tx 명세](../unity/tx/README.md)와 [수락 사례 16개](../unity/tx/acceptance-cases.json)를 따른다. Unity 원본과 작가 콘텐츠는 임의 수정하지 않는다.
- 테스트 DB와 운영 DB를 구분하며 비밀값·사용자 실데이터는 문서·테스트·PR에 기록하지 않는다.
