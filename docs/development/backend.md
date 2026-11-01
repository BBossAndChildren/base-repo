# 백엔드 구현 · 테스트 진행 규칙

> 모든 백엔드 구현·수정 작업에 적용한다. 사용자 지시(2026-10-31): **기능 목록 추출 → 한 기능 구현 → 해당 테스트 작성·실행 → 통과 확인 → 다음 기능**.
> 서비스 기준: [00-idea.md](../00-idea.md) · 계약 기준: [03-api.md](03-api.md) · 협업 규칙: [CONTRIBUTING.md](../CONTRIBUTING.md).

## 현재 구현된 API

> 2026-11-01: develop `81552f0` 기준 최신 API 확장 구현. 전체 144개 PostgreSQL·규칙·모의 AI 테스트와 migration·OpenAPI·Ruff·Docker 빌드 통과. 실제 GPU/RAG·운영 Unity/WebGL·인트로 에셋 배치는 외부 검증 대기다.

기능이 구현되고 테스트가 실제 통과했을 때만 이 표에 추가한다. 전체 계획과 미착수 항목은 아래 2절에서 관리한다.

| Method | 경로 | 역할 | 인증 | 검증 |
|---|---|---|---|---|
| GET | `/api/health` | DB 확인 | 없음 | PostgreSQL 테스트 통과 |
| GET | `/api/schema/` | OpenAPI | 없음 | 스키마 검증·테스트 통과 |
| GET | `/api/docs/` | Swagger | 없음 | 접근 테스트 통과 |
| POST | `/api/v1/players` | 게스트 발급 | 없음 | PostgreSQL 테스트 통과 |
| POST | `/api/v1/plays` | 입력·시작·최신 초기 상태 | `X-Player-Id` | PostgreSQL 테스트 통과 |
| GET | `/api/v1/plays/{playId}` | 상태·대화·장면 재개 | `X-Player-Id` | PostgreSQL 테스트 통과 |
| PATCH | `/api/v1/plays/{playId}` | 일시정지·해제 | `X-Player-Id` | PostgreSQL 테스트 통과 |
| POST | `/api/v1/plays/{playId}/turns` | 요청 중복·게임 규칙·NPC 기억·AI 대화 | `X-Player-Id` | PostgreSQL·모의 AI 통과, 실제 GPU 대기 |
| POST | `/api/v1/plays/{playId}/experience-events` | Unity 이벤트·결과 | `X-Player-Id` | PostgreSQL·fixture 통과 |
| POST | `/api/v1/plays/{playId}/experience-reconcile` | 종료 미수신 정산 | `X-Player-Id` | PostgreSQL 수락 사례16개 포함 통과 |
| POST | `/api/v1/plays/{playId}/experience-heartbeat` | 생존 신호 | `X-Player-Id` | PostgreSQL 테스트 통과 |
| POST | `/api/v1/plays/{playId}/experience-pending` | 종료 미수신 기록 | `X-Player-Id` | PostgreSQL 테스트 통과 |
| GET | `/api/v1/plays/{playId}/result` | 결말·추천 저장·재조회 | `X-Player-Id` | PostgreSQL·모의 AI 통과, 실제 RAG 대기 |
| GET | `/api/v1/players/me/plays` | 본인 기록 목록 | `X-Player-Id` | PostgreSQL 테스트 통과 |

기존 게임 API는 10개이며 최신 계약안에 일시정지 PATCH 1개가 추가됐다. 별도 AI 서버 호출 계약은 3개다. 아래 기능 번호는 `features.md`를 따른다. 기존 브랜치에서 이식한 구현도 최신 계약 검증 전에는 완료로 표시하지 않는다. AI 서버의 경로를 백엔드가 직접 제공하는 API로 표시하지 않는다.

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

### 프론트 → 백엔드 (기존 10개 + 신규 PATCH 1개)

기능 번호는 [features.md 1절](features.md#1-백엔드-be), Method·Path·본문은 [03-api.md 1부](03-api.md#1부-프론트--백엔드)를 기준으로 한다. 하나의 엔드포인트가 여러 기능을 포함하면 번호를 함께 적는다.

| 기능 # | Method · Path | 기능 | 현재 상태 |
|---|---|---|---|
| BE1 | POST `/api/v1/players` | 게스트 UUID 발급 | PostgreSQL 테스트 통과 |
| BE2 | POST `/api/v1/plays` | 게임 시작·sessionId 발급·입력 제한 | 최신 초기 상태·입력·흥미 구분 PostgreSQL 테스트 통과 |
| BE11 | GET `/api/v1/plays/{playId}` | 플레이 재개 | 상태·장면·선택·paused·세션·마지막 턴 PostgreSQL 테스트 통과 |
| BE4·BE11 | PATCH `/api/v1/plays/{playId}` | 일시정지·재개 | 차단·생성 충돌·소유권 PostgreSQL 테스트 통과 |
| BE3~BE7 | POST `/api/v1/plays/{playId}/turns` | 콘텐츠 로딩·대화·상태 검증·3D 분기 | 요청 중복·전체 상태·규칙/사망 검증·NPC 범위 테스트 통과, 실제 AI 대기 |
| BE8·BE9 | POST `/api/v1/plays/{playId}/experience-events` | Unity 원본 이벤트·결과 반영 | PostgreSQL 테스트 통과 |
| BE10 | POST `/api/v1/plays/{playId}/experience-reconcile` | 종료 미수신 정산 | PostgreSQL 수락 사례 16개 통과 |
| BE10 | POST `/api/v1/plays/{playId}/experience-heartbeat` | lease 갱신 | PostgreSQL 테스트 통과 |
| BE10 | POST `/api/v1/plays/{playId}/experience-pending` | 종료 응답 미수신 기록 | PostgreSQL 테스트 통과 |
| BE12 | GET `/api/v1/plays/{playId}/result` | 최초 결말 생성·재조회·추천 근거 | 결말 캐시·후보 보존 PostgreSQL 테스트 통과 |
| BE13 | GET `/api/v1/players/me/plays` | 본인 플레이 목록 | PostgreSQL 테스트 통과 |

BE14는 `/builds/<buildId>/`를 Nginx가 제공하는 배포 기능이다. Django 게임 API 목록에는 넣지 않는다. 실제 빌드 파일·Nginx·터널 검증은 별도 배포 확인이 필요하다. BE15는 `/intro-assets/intro.json`과 `/intro-assets/models/PAN-001.glb`~`PAN-071.glb` 정적 제공이며 `compose.gateway.yaml`·Nginx 설정의 fixture HTTP 검증 통과, 실제 에셋 운영 배치는 대기다.

### 백엔드 → 별도 AI 서버 (3개 호출 계약)

이 경로들은 백엔드가 제공하는 라우트가 아니다. AI 서버 실제 추론은 아래 모의 테스트와 별도로 확인한다.

| 기능 # | Method · Path | 기능 | 현재 상태 |
|---|---|---|---|
| AI1 · BE3~BE5 | POST `/ai/v1/chat` | 대화 생성·`branch` 제안 | 최신 필수 규칙·현재 NPC 기억·HTTP 인증/응답 검증 통과, 실제 AI 대기 |
| AI2 · BE7 | POST `/ai/v1/experience-recommendation` | 후보 최대 20개 중 추천 | 이번 대화·모의 추천 테스트 통과, 실제 AI 대기 |
| AI5 · BE12 | POST `/ai/v1/ending` | 결말·직업 3개 생성 | MockTransport·중복 직업 검증 통과, 실제 AI 대기 |

### 기존 실행 기반 (회귀 검증)

| 경로/항목 | 검증 내용 | 기존 테스트 |
|---|---|---|
| GET `/api/health` | DB 정상 200 · 실패 503 · 비밀값 비노출 | `backend/apps/core/tests.py` |
| GET `/api/schema/` | 실제 구현 API의 OpenAPI 생성·검증 | `backend/apps/core/tests.py` |
| GET `/api/docs/` | Swagger 접근 | `backend/apps/core/tests.py` |
| CORS | 허용 출처와 `X-Player-Id` 사전 요청 | `backend/apps/core/tests.py` |

## 3. 구현 순서와 테스트 명령

의존성 순서: **BE1 → BE2 → BE11 → BE13 → BE3·AI1 → BE7·AI2 → BE4~BE6 → BE10 생존 신호 → BE8·BE9 이벤트 → BE10 미수신·정산 → BE12·AI5**. 모델은 현재 기능에 필요한 만큼 추가하고 migration을 함께 검증한다. BE14의 빌드 제공은 배포 검증에서 따로 확인한다.

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

### OpenAPI 스키마 작성·검증 기준

- 프론트엔드가 `/api/docs/`에서 찾기 쉽도록 엔드포인트에 기능별 태그와 한국어 요약·설명을 붙인다. Method·Path·인증 헤더·상태 코드는 `03-api.md`와 일치해야 한다.
- 요청·응답 Serializer의 모든 필수 필드는 자료형, 필수 여부, 허용값·범위, 의미를 스키마에 드러낸다. 조건부 필수(`dreamJob`)와 3D 연동 API의 **감싸지 않은** 본문·ACK도 예시와 설명에 명시한다.
- AI 서버 호출 경로는 백엔드 Swagger에 백엔드 제공 API처럼 노출하지 않는다. `03-api.md` 2부와 `backend.md`에 호출 계약·모의 검증·실제 연동 상태를 구분해 적는다.
- 변경 기능마다 생성된 OpenAPI의 태그·요청 필드·응답 구조를 확인하고, 최종 `spectacular --validate --fail-on-warn`을 실행한다. 프론트 계약과 다른 스키마는 통과로 기록하지 않는다.

## 4. 기능별 실행 기록

예정과 실행을 구분한다. 테스트 수·통과 여부는 실행 출력으로 확인한 값만 적는다. 실패 기록은 지우지 않고 수정 후 재실행 결과를 덧붙인다. mock 사용 여부와 실제 AI 검증 여부를 구분한다.

| 순서 | 기능 | 테스트 파일 · 명령 | 실행 결과 | 다음 기능 진행 가능 |
|---|---|---|---|---|
| 1 | BE1 게스트 발급 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_players --verbosity 2` | PostgreSQL 테스트 2개 통과 | BE2 진행 가능 |
| 2 | BE2 게임 시작 · BE1 회귀 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_players apps.game.tests.test_start --verbosity 1` | PostgreSQL 테스트 8개 통과 (BE2 6개) | BE11 진행 가능 |
| 3 | BE11 플레이 재개 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_resume --verbosity 1` | PostgreSQL 테스트 2개 통과 | BE13 진행 가능 |
| 4 | BE13 플레이 목록 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_list --verbosity 1` | PostgreSQL 테스트 2개 통과 | AI1 진행 가능 |
| 5 | AI1 대화 호출 `branch` 계약 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_ai_chat --verbosity 1` | MockTransport 테스트 7개 통과, 실제 AI 서버 미검증 | BE7 추천 계약 진행 가능 |
| 6 | BE7 · AI2 후보 선정·추천 호출 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_ai_recommendation --verbosity 1` | 7개 통과, Unity 555개 카탈로그·후보 20개 검증, 실제 AI 서버 미검증 | BE4 채팅 연결 진행 가능 |
| 7 | BE4 채팅 턴 · AI1/BE7 회귀 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_ai_chat apps.game.tests.test_ai_recommendation apps.game.tests.test_turns --verbosity 1` | PostgreSQL/MockTransport 테스트 22개 통과, 실제 AI 서버 미검증 | BE10 체험 연동 진행 가능 |
| 8 | BE10 생존 신호 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_heartbeat --verbosity 1` | PostgreSQL 테스트 5개 통과, 새 경로·원본 응답 확인 | BE8 이벤트 진행 가능 |
| 9 | BE8·BE9 Unity 원본 이벤트·결과 반영 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_events --verbosity 1` | PostgreSQL 테스트 7개 통과, 58개 레거시 Unity 이벤트 재생·충돌 격리 보존 | BE10 정산 진행 가능 |
| 10 | BE10 종료 응답 미수신 기록 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_pending --verbosity 1` | PostgreSQL 테스트 3개 통과, pending 기록·소유권·오류 확인 | BE10 정산 진행 가능 |
| 11 | BE10 종료 미수신 정산 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_reconciliation --verbosity 1` | PostgreSQL 수락 사례 16개 통과, 원본 응답·동시성 포함 | BE12 결말 진행 가능 |
| 12 | BE12 결말 생성·저장 · 채팅 회귀 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_result apps.game.tests.test_turns --verbosity 1` | PostgreSQL 테스트 13개 통과, 최초 생성·재조회·실패 시 미저장 포함 | AI5 계약 검증 가능 |
| 13 | AI5 결말 호출 계약 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_ai_ending --verbosity 1` | MockTransport 테스트 2개 통과, 실제 GPU AI 미검증 | 전체 회귀 진행 가능 |
| 14 | BE2 최신 입력 범위 회귀 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_start --verbosity 1` | PostgreSQL 테스트 7개 통과, 나이 7~99·상황 보기·선택 개수 확인 | BE7 안내 필드 진행 가능 |
| 15 | BE7 최신 3D 안내 필드 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_ai_recommendation apps.game.tests.test_turns --verbosity 1` | 15개 중 1개 실패: Unity 허용 목록 555개 중 11개의 `title` 누락으로 카탈로그 로딩 실패 | BE7 완료 전 다음 기능 진행 금지, 제목 처리 방식 확인 필요 |
| 16 | BE7 제목 보완·회귀 | 같은 명령 재실행 | PostgreSQL·Unity 카탈로그 테스트 15개 통과, 마지막 11개 `title` 보완 | DB 설계 정합성 작업 진행 가능 |
| 17 | DB 설계 컬럼·메시지 테이블 정합성 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_start apps.game.tests.test_turns apps.game.tests.test_events apps.game.tests.test_result apps.game.tests.test_reconciliation --verbosity 1` | PostgreSQL 테스트 43개 통과, 신규 컬럼·메시지 행 저장 확인 | DB 이전 데이터 migration 검증 진행 가능 |
| 18 | DB 이벤트·정산 컬럼 정합성 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_events apps.game.tests.test_reconciliation --verbosity 1` | PostgreSQL 테스트 23개 통과, Unity 원본·해시·정산 payload와 revision 확인 | 전체 DB migration 확인 가능 |
| 19 | 기존 DB 행 migration | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_migrations --verbosity 1` | PostgreSQL migration 테스트 1개 통과, 기존 프로필·대화·Unity 이벤트·정산 행 이전 확인 | 전체 회귀 진행 가능 |
| 20 | BE12 최신 결말 계약 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_result apps.game.tests.test_ai_ending --verbosity 1` | PostgreSQL·MockTransport 테스트 7개 통과, `basis`와 `NOT_ENDED` 확인 | 전체 회귀 진행 가능 |
| 21 | 전체 회귀 1차 | `docker compose -p api22 exec -T backend python manage.py test --verbosity 1` | 81개 중 1개 오류: 테스트 AI 서버의 추천 요청이 이전 `catalog` 형식 사용 | AI 테스트 서버 수정 후 재실행 |
| 22 | AI 테스트 서버 수정 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_mock_ai --verbosity 1` | 3개 통과, `candidates`와 `/ai/v1/ending` 모의 응답 확인 | 전체 회귀 재실행 가능 |
| 23 | 전체 회귀 재실행 | `docker compose -p api22 exec -T backend python manage.py test --verbosity 1` | PostgreSQL·MockTransport·테스트 AI 서버 82개 통과 | lint·migration·OpenAPI·build 검증 가능 |
| 24 | 체험 DB 타임스탬프·세션 보완 | `docker compose -p api22 exec -T backend python manage.py test apps.game.tests.test_heartbeat apps.game.tests.test_pending --verbosity 1` | PostgreSQL 테스트 8개 통과 | 전체 회귀·migration 검증 가능 |

| 25 | BE11 재개 sessionId | `python manage.py test apps.game.tests.test_resume --verbosity 2` (Docker) | 3개 오류: 모델 테이블명에 대응하는 migration 누락 | 수정 후 재실행 필요 |
| 26 | BE11 재개 sessionId · 테이블명 migration | `python manage.py test apps.game.tests.test_resume --verbosity 1` (Docker) | PostgreSQL 테스트 3개 통과, 재개 세션 및 OpenAPI 확인 | 메시지 형식 진행 가능 |

| 27 | BE2 시작 메시지 | `python manage.py test apps.game.tests.test_start --verbosity 1` (Docker) | PostgreSQL 테스트 7개 통과 | 스키마 검사 보완 필요 |
| 28 | BE2 시작 메시지·스키마 | 같은 명령 재실행 | PostgreSQL 테스트 8개 통과 | 대화 메시지 진행 가능 |

| 29 | BE4 채팅 메시지 역할·AI 계약 | `python manage.py test apps.game.tests.test_ai_chat apps.game.tests.test_turns apps.game.tests.test_mock_ai --verbosity 1` (Docker) | PostgreSQL·모의 AI 테스트 20개 통과, 실제 AI 미검증 | 재개 메시지 검증 가능 |

| 30 | BE11 과거 메시지 재개 | `python manage.py test apps.game.tests.test_resume --verbosity 1` (Docker) | PostgreSQL 테스트 4개 통과, 기존 기록 보존·형식 변환 | 전체 회귀 가능 |

| 31 | 기존 DB 이름 변경 migration | `python manage.py test apps.game.tests.test_migrations --verbosity 1` (Docker) | PostgreSQL 테스트 1개 통과, 이전 레코드 보존 확인 | 전체 회귀 가능 |
| 32 | 전체 회귀 | `python manage.py test --verbosity 1` (Docker) | 87개 중 2개 실패: 원본 허용 목록 title 누락 11개로 카탈로그 전체가 비어 추천·결말 실패 | title 출처 확인 후 재실행 필요 |

| 33 | 기존 제목 11개 반영 후 전체 회귀 | `python manage.py test --verbosity 1` (Docker) | PostgreSQL·모의 AI 테스트 87개 통과; 실제 AI 미검증 | 최종 검사 가능 |

| 34 | BE3 공통 콘텐츠 로딩 | `python manage.py test apps.game.tests.test_content apps.game.tests.test_ai_chat --verbosity 1` (Docker) | 테스트 12개 통과, 문서 순서·주석 제거·캐시·필수 지침 누락 시작 차단 | BE7 최신 대화 반영 가능 |

| 35 | BE7 이번 대화 포함 후보 선정 | `python manage.py test apps.game.tests.test_ai_recommendation apps.game.tests.test_turns --verbosity 1` (Docker) | PostgreSQL·모의 AI 테스트 17개 통과, 최근 20턴에 현재 대화 포함 | BE12 결말 검증 가능 |

| 36 | BE12 결말 저장·후보 보존·추천 중복 | `python manage.py test apps.game.tests.test_result apps.game.tests.test_ai_ending --verbosity 1` (Docker) | PostgreSQL·모의 AI 테스트 11개 통과 | BE2 초기 상태 검증 가능 |

| 37 | BE2 초기 나이·자원·흥미 | `python manage.py test apps.game.tests.test_start apps.game.tests.test_resume --verbosity 1` (Docker) | PostgreSQL 테스트 13개 통과, 입력 나이·초기값·명시한 관심사·스키마 확인 | 종료 상태 일관성 검증 가능 |

| 38 | 종료 상태 일관성 | `python manage.py test apps.game.tests.test_turns apps.game.tests.test_heartbeat apps.game.tests.test_pending apps.game.tests.test_list apps.game.tests.test_resume apps.game.tests.test_result --verbosity 1` (Docker) | PostgreSQL 테스트 37개 통과, ended 플래그로 재요청 차단·목록/재개/결말 확인 | 전체 스키마 계약 검증 가능 |

| 39 | API 전체 OpenAPI 계약 | `python manage.py test apps.game.tests.test_contract_schema --verbosity 1` (Docker) | PostgreSQL 스키마 테스트 2개 통과, 10개 경로·오류·UUID·Unity 원본 응답 확인 | 모의 서버 API 흐름 검증 가능 |

| 40 | 10개 API HTTP 통합 흐름 | `python manage.py test apps.game.tests.test_api_flow --verbosity 1` (Docker) | PostgreSQL·로컬 HTTP 모의 AI 통합 테스트 1개 통과; 게스트부터 3D/정산/결말 재조회까지 확인, 실제 GPU·WebGL 미검증 | 최종 회귀 가능 |

| 41 | 최종 전체 검증 | `python manage.py test --verbosity 1`, check, migration 검사, spectacular 검증, Ruff 검사, Docker build (Docker) | 이전 명세 기준 PostgreSQL·모의 AI 테스트 105개 및 필수 검사 통과 | 최신 계약 확장 적용 필요 |
| 42 | 최신 develop 반영 | `git pull --ff-only origin develop` | `6e9c8f0 → 67c1183`, 로컬 API 문서 변경은 `/private/tmp/base-repo-before-develop-q3dzocgu/`에 보존; 최신 명세 기준 테스트 미실행 | requestId부터 최신 계약 순차 구현 필요 |

| 43 | 최신 턴 요청 ID·상태 버전·전체 상태 | `python manage.py test apps.game.tests.test_turn_requests apps.game.tests.test_turns --verbosity 1` (apiresume Docker) | PostgreSQL 15개 통과; 동일 요청 재전송·입력 충돌·상태 충돌·실패 재시도·전체 state 확인 | 일시정지 구현 가능 |

| 44 | 일시정지 1차 | `python manage.py test apps.game.tests.test_pause apps.game.tests.test_turn_requests apps.game.tests.test_turns apps.game.tests.test_resume --verbosity 1` | 25개 중 1개 오류: PATCH OpenAPI의 필수 필드 분리 설정 | 수정 후 재실행 |
| 45 | 일시정지·활성 요청 시간·재개 | 같은 명령 재실행 (apiresume Docker) | PostgreSQL 25개 통과; 정지 중 차단·생성 중 정지 충돌·소유권·조회 무진행 확인 | 최신 콘텐츠 로딩 구현 가능 |

| 46 | 최신 상세 기획 필수 로딩 | `python manage.py test apps.game.tests.test_content apps.game.tests.test_ai_chat --verbosity 1` (apiresume Docker) | 13개 통과; 필수 문서 누락·주석만 있는 문서 시작 차단, 이전 규칙보다 우선 첨부 | 초기 상태 구현 가능 |

| 47 | 최신 초기 상태 | `python manage.py test apps.game.tests.test_start apps.game.tests.test_resume --verbosity 1` (apiresume Docker) | PostgreSQL 14개 통과; 원화·부채·건강80/에너지70/스트레스20·상황별 성장·미확인 흥미, 개인정보 입력 차단 | 게임 규칙 구현 가능 |

| 48 | 인생 규칙 1차 | `python manage.py test apps.game.tests.test_rules apps.game.tests.test_turns apps.game.tests.test_turn_requests apps.game.tests.test_pause --verbosity 1` | 36개 중 3개 실패: 테스트 대역의 새 인수 누락 2개·서로 다른 행동에 같은 원인 ID를 쓴 테스트 1개 | 수정 후 재실행 |
| 49 | 재정·기간·건강·과로·확정 사망·규칙 재요청 | 같은 명령 재실행 (apiresume Docker) | PostgreSQL/규칙 36개 통과; 월별 중복 방지·미납/부채 분리·장기 진행 확인·학습 기록·사망 단독 제안 무시·실패 원자성 | NPC 기억 구현 가능 |

| 50 | NPC 기억 1차 | `python manage.py test apps.game.tests.test_memory --verbosity 1` | 16개 중 1개 실패: 기존 최근 대화 fixture에 NPC 공개 범위 없음 | fixture 범위 보완 후 재실행 |
| 51 | NPC 기억·전달·장면·재개 | `python manage.py test apps.game.tests.test_memory apps.game.tests.test_turns --verbosity 1` (apiresume Docker) | PostgreSQL 16개 통과; 다른 플레이/인물 비공개 대화 제외, 출처·계기 없는 전달 거부, 감정/사실 분리, 요청 중복 보호 | AI 3개 호출 계약 통합 검증 가능 |

| 52 | AI 3개 HTTP 호출 계약 | `python manage.py test apps.game.tests.test_ai_contracts apps.game.tests.test_ai_chat apps.game.tests.test_ai_recommendation apps.game.tests.test_ai_ending apps.game.tests.test_result --verbosity 1` (apiresume Docker) | PostgreSQL/HTTP 30개 통과; 3개 경로·X-Internal-Key·요청 본문·형식 오류 재요청·추천 실패 텍스트 대체·결말 저장, 모의 HTTP 서버 사용 | 실제 GPU/RAG 검증은 외부 연동 대기; BE15 설정 구현 가능 |

| 53 | BE15 intro asset 정적 제공 | `python3 backend/scripts/test_intro_gateway.py` (Docker Nginx) | 테스트 fixture로 Nginx 구문·JSON/GLB·CORS·7일 캐시·404·쓰기 거부 통과; 실제 에셋 71개 배치와 WebGL 재생은 미검증 | 운영 배치 대기 |

| 54 | 근거 기반 흥미·관계·실제 변화 | `python manage.py test apps.game.tests.test_state_changes --verbosity 1` (apiresume Docker) | PostgreSQL 3개 통과; 흥미1~5·NPC별 관계·출처 검증·직접 자금 조작 거부·실제 계산값 반환 | 최종 전체 검사 가능 |

| 55 | 전체 검사 1차 | `python manage.py test --verbosity 1` (apiresume Docker) | PostgreSQL·모의 AI 143개 통과 | 병렬 요청 경합 보완 |
| 56 | 병렬 요청·Unity 버전 | `python manage.py test apps.game.tests.test_turn_requests apps.game.tests.test_events --verbosity 1` | 본문 12개 통과 후 DB 정리 실패: 작업 스레드 연결 미종료 | 연결 종료 보완 후 재실행 |
| 57 | 병렬 연결 정리 보완 | 같은 명령 `--noinput` 재실행 (apiresume Docker) | PostgreSQL 12개 및 DB 정리 통과; 병렬 중복 요청의 AI 1회 실행 확인 | 최종 검사 가능 |

| 58 | 최종 전체 검사 | 전체 `python manage.py test --verbosity 1 --noinput`, check, makemigrations --check --dry-run, migrate --check, spectacular --validate --fail-on-warn, Ruff check/format, Docker Compose build | PostgreSQL/규칙/모의 HTTP 144개 및 필수 검사 통과; Ruff 93파일 형식 확인, 실제 GPU·운영 WebGL/인트로 에셋은 미검증 | PR 준비 가능 |

| 59 | Swagger 필수·조건부 필수·정상 요청 예시 #88 | 전체 `python manage.py test --verbosity 1 --noinput` (apiresume Docker) | PostgreSQL·모의 AI 146개 통과; 새 스키마 검사 2개 포함, situation 고딩 거부/고등학생 허용·정상 요청 예시 확인 | 스키마·lint·build 확인 후 PR |
| 60 | BE14·BE15 게이트웨이 허용 출처 두 Vercel 주소 #86 | `python3 backend/scripts/test_intro_gateway.py` (Docker Nginx), 전체 `python manage.py test` (compose dev + mock) | 게이트웨이 PASS: `base-repo-zeta` · `base-repo-ck83` 출처 반환, 목록 밖 출처는 CORS 헤더 없음, 구문·JSON/GLB·캐시·404/403 유지 (가짜 파일). Django 146개 통과. 실제 서버 배치 · 실제 모델 · Vercel 로딩은 미검증 | 서버 배치 대기 |
| 61 | Swagger 일시정지 · Unity 4개 요청 예시 #91 | `python manage.py test apps.game.tests.test_request_examples_schema`, 전체 test · check · makemigrations --check --dry-run · spectacular --validate --fail-on-warn · Ruff check/format | 신규 2개 포함 148개 통과; 5개 요청 예시가 입력 Serializer 검증 통과, 스키마 검증 · Ruff 90파일 통과 | 완료 |
| 62 | 프론트 실제 연결 (로컬) | 로컬 Docker 백엔드(PostgreSQL + `compose.mock.yaml` 모의 AI) + 프론트 `VITE_USE_MOCK=false`, headless Chrome | 게스트 발급 → 시작 → 채팅(`requestId` 포함 200) → 재개 → 일시정지 · 이어 하기 → 지난 기록, 콘솔 오류 없음. 실제 GPU AI 미검증 | 서버 배포 · 실제 AI 대기 |
| 63 | BE14·BE15 실제 파일 배치·게이트웨이 #107 | `check_intro_assets.py backend/deploy/assets/intro-assets`, 로컬 `compose.gateway.yaml` + curl, 전체 test · `test_intro_gateway.py` · Ruff | 인트로 71개(249,041,188 bytes) 확인, GLB 71/71 `model/gltf-binary`, 빌드 index·wasm·client.js·manifest 200, `frame-ancestors` 두 주소, 게이트웨이 경유 API·CORS 사전 요청 통과, 목록 밖 출처 차단. Django 148개 통과. GPU 서버 복사·터널·Vercel 로딩 미검증 | GPU 서버 배포 대기 |
| 64 | 실제 AI 연결 (GPU 서버) #113 | 서버: 중계기 `ai-relay`(172.17.0.1:18010 → AI 127.0.0.1:8010), `.env` `AI_API_BASE_URL=http://host.docker.internal:18010` · 기존 키, 컨테이너에서 `/openapi.json`, 게이트웨이로 게스트 → 시작 → 턴. 배포 사이트 headless Chrome 대화 2턴 | 컨테이너 → AI 200, 턴 `code:200` (실제 Qwen 대사 · 확정 state), 사이트 대화 200 · 약 6초 · 이전 대화 기억. 추천 · 결말 API 는 AI 쪽 미구현, Cloudflare 502 변환(11 E3) 남음 | AI 쪽 추천 · 결말 구현 대기 |
| 65 | 허용 출처 zeta 하나로 #122 | `python3 backend/scripts/test_intro_gateway.py`, 전체 `python manage.py test`, Ruff | 게이트웨이 PASS (zeta 허용 · 이전 `base-repo-ck83` · 목록 밖 출처는 CORS 헤더 없음), Django 148개 통과. GPU 서버 반영(pull · `.env` · 재기동)은 서버 작업 | 서버 반영 대기 |

| 66 | 시작 장면·힌트·첫 AI 컨텍스트·재개·원자 저장 (#154) | `python manage.py test apps.game.tests.test_start --verbosity 1 --noinput` (로컬 PostgreSQL16 Unix socket 전용) | 12개 통과. 학생/직장인·희망 직업 무자동취업·0번 장면 뒤 1번 입력·빈 입력 미표시·첫 NPC 전달·저장 실패 전체 롤백 확인 | 전체 회귀 가능 |
| 67 | 첫 장면 HTTP 통합 회귀 (#154) | 전체 `python manage.py test --verbosity 1 --noinput` → 모의 AI 발화자 수정 후 `test_mock_ai test_api_flow test_start test_resume test_turns` | 전체 173개 중 1개 실패: 모의 AI가 현재 장면 밖 이름을 발화. 모의 서버를 현재 발화 NPC에 맞춘 뒤 관련 33개 통과 | 전체 재실행 필요 |

| 68 | 첫 장면 최종 회귀·계약·빌드 (#154) | 전체 `python manage.py test --verbosity 1 --noinput`; check; makemigrations/migrate 검사; spectacular `--validate --fail-on-warn`; Ruff check/format; Docker build | 실제 PostgreSQL16·규칙·모의 HTTP 174개 통과(4.148초), OpenAPI 시작/재개 hints·Ruff 97파일·이미지 빌드 통과. 운영 DB 사용 없음; 실제 GPU·브라우저 통합은 별도 검증 | PR 준비 가능 |

## 5. 미확정·외부 의존 사항

- 미배정 자산·비용은 0, 미확정 급여·성적·흥미 단계는 null로 두며 현실 수치를 추정하지 않는다. AI의 사망 제안만으로 종료하지 않고 건강 0 지속/과로 확정 판정을 사용한다. 이전 추상 상태는 다음 유효 턴에서 전환하고 원본을 비공개 보존한다.
- 활성 시간은 서버에서 확인 가능한 요청 처리 구간을 누적한다. 프론트의 읽기/입력 구간을 포함한 전체 활성 시간은 별도 활성 구간 전달 연동이 필요하다.
- BE15 실제 에셋 71개는 `backend/deploy/assets/intro-assets/`(git 제외)에 배치해 로컬 게이트웨이로 확인했다 (기록 63). GPU 서버 복사·터널·Vercel 에서의 실제 재생은 미검증이다.
- `docs/game/`의 지침·세계관·시나리오·규칙·NPC 문서를 캐시해 사용한다. 작가 원문의 TODO는 승인된 콘텐츠로 간주하지 않는다. 필수 지침이 누락/비어 있으면 시작하지 않으며 통합 테스트는 별도 표시된 테스트 콘텐츠를 사용한다.
- AI 주소·내부 키는 환경변수로 제공한다. 실제 GPU AI 대화 연결은 2026-11-01 확인했다 (기록 64). 3D 추천 · 결말 호출은 AI 서버 구현 전이라 `외부 연동 대기`로 남긴다.
- Unity 정산은 [원본 tx 명세](../unity/contracts/CONTRACT-SNAPSHOT.md)와 [수락 사례 16개](../unity/contracts/reconciliation-v003/acceptance-cases.json)를 따른다. Unity 원본과 작가 콘텐츠는 임의 수정하지 않는다.
- 테스트 DB와 운영 DB를 구분하며 비밀값·사용자 실데이터는 문서·테스트·PR에 기록하지 않는다.

| 55 | BE12 사망 시 인생 회고 · AI 결말 없을 때 백엔드 생성 (#127) | `python manage.py test --verbosity 1` (Docker) · check · makemigrations/migrate check · spectacular `--fail-on-warn` · Ruff · Docker build | PostgreSQL·모의 AI 152개 통과; AI 502·503·504 시 기록 기반 회고·추천 3개(새 직업 1개 이상) 저장, 다음 조회 때 AI 결말로 교체. 실제 AI 결말 API 미검증 | 결말 화면 AI 없이 동작 |
| 56 | 상황별 시작 자금 · 생활비 · 가족 지원 · 직장인 최저임금 · 노화 (#132) | `python manage.py test apps.game.tests.test_rules apps.game.tests.test_start` → 전체 `python manage.py test` (Docker) | 1차 33개 중 2개 실패(테스트가 1년 진행 확인 · 과로 쓰러짐 중단을 고려하지 않음) → 테스트 수정 후 33개 통과. 전체 1차 160개 중 1개 실패(롤백 테스트가 시작 자금 0 을 고정) → 수정 후 160개 통과 | 시작부터 월별 정산 · 노화로 결말 도달 가능 |
| 57 | #111 여러 NPC 이름이 있는 입력의 대화 상대 선택 | `python manage.py test apps.game.tests.test_memory` → 전체 `python manage.py test` (Docker) | 1차 9개 중 1개 실패(같은 절에 두 이름이 있으면 앞 이름 선택) → 대상 조사 우선 규칙 추가 후 9개 통과, 전체 164개 통과 | 장면 선택 회귀 확인 |
| 58 | 건강 자연 회복 · 나이별 상한 (#141) | `python manage.py test` (Docker) | 1차 168개 중 1개 실패(기존 "건강 0 6개월" 테스트가 평온한 생활이라 새 규칙으로 회복됨) → 테스트를 스트레스 60 으로 고치고 회복으로 사망을 피하는 사례 추가, 169개 통과 | 노화 결말 유지 확인 |
| 59 | 재개 · 턴 응답 npcs (#143) | `python manage.py test` · spectacular `--fail-on-warn` (Docker) · Ruff | PostgreSQL 170개 통과, OpenAPI 검증 통과. 이름만 · 비공개 기억 미포함 확인 | 프론트 인물별 관계 표시 가능 |
| 60 | BE16 3D 체험 카드 추천 · 카드 추천 이벤트 수락 (#163) | `python manage.py test apps.game.tests.test_experience_offers` → 전체 `python manage.py test` · makemigrations/migrate · spectacular · Ruff (Docker) | 신규 9개 통과. 전체 1차 179개 중 2개 오류(마이그레이션 테스트가 정리 때 0021 로 고정 복구해 새 `experience_offers` 테이블이 빠짐) → 정리를 최신 마이그레이션으로 바꾼 뒤 179개 통과 | 프론트 체험 카드 진행 가능 |
| 61 | BE3 직업체험 매칭 지침(07) AI 대화 요청에 포함 | `python manage.py test` (Docker) · Ruff | PostgreSQL 182개 통과 (콘텐츠 3개 추가: 06 뒤에 넣기 · 경로 바꾸기 · 없으면 생략 · 실제 저장소 문서 포함) | 실제 AI 응답 반영은 AI 쪽 |
