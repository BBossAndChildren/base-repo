# 04. DB 구조

> 관련 문서: [03-api.md](03-api.md) · [02-architecture.md](02-architecture.md) · [10-prompt-assembly.md 5절](10-prompt-assembly.md#5-플레이어-기록-항목)
> DB: **PostgreSQL** · Django ORM · Django Migrations. JSON 컬럼은 `jsonb`.
> 1차 설계안이다. 백엔드 담당이 모델을 만들며 바꾸면 이 문서도 같은 PR 에서 고친다.

## ERD
```mermaid
erDiagram
  PLAYERS ||--o{ PLAYS : has
  PLAYS ||--o{ MESSAGES : has
  PLAYS ||--o{ EXPERIENCES : has
  EXPERIENCES ||--o{ EXPERIENCE_EVENTS : records
  EXPERIENCES ||--o{ EXPERIENCE_RESOLUTIONS : settles
```

## 테이블 상세

### players
| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK | `playerId` (게스트) |
| created_at | timestamptz | NOT NULL | |

### plays
| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | uuid | PK | `playId` |
| player_id | uuid | FK players, NOT NULL | 소유자 (모든 API 에서 `X-Player-Id` 와 대조) |
| session_id | varchar | UNIQUE, NOT NULL | Unity `sessionId`. 플레이 동안 유지 |
| profile | jsonb | NOT NULL | 기본 정보: 필수 4개 + 채워진 선택 항목 ([10 5절](10-prompt-assembly.md#5-플레이어-기록-항목)) |
| state | jsonb | NOT NULL | 나이 · 자원 · 흥미 · 관계 · 경험 <!-- TODO: 필드는 docs/game/ 규칙 확정 후 --> |
| experience_results | jsonb | NOT NULL, 기본 `[]` | 끝난 3D 체험 요약 (프롬프트에 넣는 용도) |
| ended | boolean | NOT NULL | 인생 종료 여부 |
| ending | jsonb | NULL | 결말 · 추천 직업 (BE12) |
| started_at · updated_at | timestamptz | NOT NULL | |

> 건강 · 질병 정보는 어떤 컬럼에도 저장하지 않는다.

### messages
| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | bigint | PK | |
| play_id | uuid | FK plays, NOT NULL | |
| turn | int | NOT NULL | 턴 번호. (play_id, turn) 인덱스 |
| role | varchar | NOT NULL | `user` · `npc` · `narrator` |
| speaker | varchar | NULL | NPC 이름 |
| text | text | NOT NULL | |
| state_changes | jsonb | NULL | 이 턴에 실제 반영한 변경 |
| created_at | timestamptz | NOT NULL | |

### experiences
| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| experience_id | varchar | PK | Unity `experienceId` (프론트가 생성) |
| play_id | uuid | FK plays, NOT NULL | |
| session_id | varchar | NOT NULL | |
| build_id · room_id · scenario_id · scenario_version | varchar | NOT NULL | 추천 · 허용 목록과 일치해야 함 |
| lifecycle_status | varchar | NOT NULL | `recommended` · `started` · `ended` · `pending_reconciliation` · `deferred_active` · `interrupted` · `not_started` |
| lease_expires_at | timestamptz | NULL | 마지막 생존 신호 + 120초 |
| ended_event_id | varchar | NULL | 받은 `experience.ended` 의 eventId |
| result_summary | jsonb | NULL | outcome · 평가 코드 · 해석 (플레이어 기록 반영용) |
| created_at · updated_at | timestamptz | NOT NULL | |

### experience_events
| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | bigint | PK | |
| session_id | varchar | NOT NULL | UNIQUE (session_id, event_id) |
| event_id | varchar | NOT NULL | |
| experience_id | varchar | FK experiences, NULL | 제어 오류 등 eventId 없는 응답은 저장하지 않음 |
| sequence | int | NOT NULL | 순서 복원 · 최신 스냅샷 판단 |
| type | varchar | NOT NULL | |
| scope_key | varchar | NOT NULL | scenarioRunId · scope · stepId · objectId · workItemId 묶음 (최신 상태 판단 범위) |
| payload | jsonb | NOT NULL | Unity 원본 그대로 |
| payload_hash | char(64) | NOT NULL | 같은 ID 다른 내용(충돌) 판단 |
| conflict | boolean | NOT NULL | 충돌로 격리된 원본이면 true |
| received_at | timestamptz | NOT NULL | |

> 원본은 지우지 않는다. 늦게 온 이벤트도 저장하되 최신 상태는 범위별 가장 큰 sequence 로 판단한다.

### experience_resolutions
| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| id | bigint | PK | |
| resolution_id | varchar | NOT NULL | UNIQUE (resolution_id, revision) |
| revision | int | NOT NULL | 늦은 실제 종료로 정정하면 +1 |
| reconcile_request_id | varchar | NOT NULL | 같은 요청 · 같은 내용이면 같은 응답 |
| experience_id | varchar | FK experiences, NOT NULL | 정산 대상 (이전 체험) |
| lifecycle_status | varchar | NOT NULL | |
| payload | jsonb | NOT NULL | `experience.reconciled` 응답 원본 |
| resolved_at | timestamptz | NOT NULL | |

## 주요 쿼리
```sql
-- 프롬프트용 최근 20턴
SELECT role, speaker, text FROM messages WHERE play_id = :play ORDER BY turn DESC, id DESC LIMIT 40;

-- 이벤트 중복 · 충돌 판단
SELECT payload_hash FROM experience_events WHERE session_id = :session AND event_id = :event;

-- 범위별 최신 상태
SELECT DISTINCT ON (scope_key) scope_key, payload FROM experience_events
WHERE experience_id = :exp AND NOT conflict ORDER BY scope_key, sequence DESC;

-- 정산 대상: 종료 응답 없이 lease 가 끝난 이전 체험
SELECT * FROM experiences WHERE play_id = :play AND ended_event_id IS NULL
AND lifecycle_status IN ('started','pending_reconciliation') AND lease_expires_at < now() FOR UPDATE;
```

## 설계 기준 DDL
<!-- TODO: Django 모델 작성 후 `python manage.py sqlmigrate` 결과로 채운다 -->

## 데이터 접근 계층
- Django ORM 모델 = 위 테이블. 이벤트 저장과 정산은 **트랜잭션 + 행 잠금(`select_for_update`)** 으로 처리한다 (같은 체험의 동시 정산 · 늦은 종료 경합 방지, Unity 명세 v003 의 "원자적 fence")

## DB 확인 방법
```bash
python manage.py dbshell
# \dt  ·  SELECT count(*) FROM experience_events WHERE session_id = '…';
```

## 운영 주의
- PostgreSQL 은 백엔드 서버에 함께 둔다 <!-- TODO: 같은 서버 설치 여부 · 백업 방법 (백엔드 담당) -->
- 스키마 변경은 Django Migrations 로만 한다
- `experience_events` 는 계속 늘어난다. 시연 기간에는 지우지 않는다
