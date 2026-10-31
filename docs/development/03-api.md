# 03. API 명세

> 관련 문서: [02-architecture.md](02-architecture.md) · [04-database.md](04-database.md) · [10-prompt-assembly.md](10-prompt-assembly.md)
> **API 계약의 기준 문서다.** 프론트·백엔드·AI 서버가 병렬로 작업하므로 이 문서를 먼저 확정하고, API 가 바뀌면 같은 PR 에서 함께 고친다.
> 두 부분으로 나눈다: **1부 프론트 ↔ 백엔드**, **2부 백엔드 ↔ AI 서버**. 프론트는 AI 서버를 직접 호출하지 않는다. 프론트 ↔ Unity 는 [docs/unity/](../unity/USAGE.md) 를 따른다.
> 각 API 의 요청·응답 필드는 1차 설계안이다. 기능 번호는 [features.md](features.md) 를 채우며 연결한다.

## 0. 공통 규약

| 항목 | 규칙 |
|------|------|
| 주소 앞부분 | 백엔드 `/api/v1/...`, AI 서버 `/ai/v1/...` (버전 포함) |
| 필드 이름 | camelCase (Unity 명세와 같음) |
| 시간 | ISO 8601 + 시간대. 예: `2026-10-31T10:30:00+09:00` |
| ID | 문자열 UUID (Unity 명세의 ID 는 Unity 형식 그대로) |
| 문자 인코딩 | UTF-8 JSON |

실행 기반 확인용 `GET /api/health`는 인증 없이 PostgreSQL `SELECT 1`을 실행한다. 성공 시 HTTP 200과 `{"code":200,"data":{"status":"ok","database":"ok"}}`, DB 오류 시 HTTP 503과 `{"code":503,"data":{"status":"unavailable","database":"unavailable"}}`를 반환한다. AI 연결은 검사하지 않는다. 실제 구현된 API의 OpenAPI는 `/api/schema/`, Swagger는 `/api/docs/`에서 확인한다. 게임 API 구현·검증 상태는 [backend.md](backend.md)를 따른다. 실제 AI 추론과 정적 에셋 운영 배치는 모의 테스트와 구분한다.

### Base URL
| 서버 | 환경 | 주소 |
|------|------|------|
| 백엔드 | 로컬 | <!-- TODO --> |
| 백엔드 | 배포 | `https://<현재 터널 주소>` (Cloudflare Tunnel, 바뀔 수 있음 — [06 0절](06-deployment.md#0-배포-환경-한눈에)) |
| AI 서버 | 로컬 | <!-- TODO --> |
| AI 서버 | 배포 | Django 와 **같은 GPU 서버의 내부 주소** (외부 비공개, 백엔드만 호출). 주소 · 포트는 이식 때 확정 ([06](06-deployment.md#0-배포-환경-한눈에)) |

### 메시지 형식
1-2 · 1-3 · 1-7 의 `messages[]` 는 모두 같은 모양이다.

| 필드 | 설명 |
|------|------|
| `role` | `user`(사용자) · `npc`(등장인물) · `narrator`(나레이션). 화면에서 말풍선 위치 · 모양을 정한다 (DB `messages.role`) |
| `speaker` | 화면에 보일 이름. `npc` 는 인물 이름(예: "친구 민수"), `user` 는 플레이어 이름, `narrator` 는 "나레이션" |
| `text` | 내용 |

- 1-7 재개 응답의 `messages` 에는 사용자가 보낸 말(`role: user`)도 순서대로 들어간다. 1-3 응답의 `messages` 에는 이번 턴의 **AI 쪽 응답만** 들어간다 (사용자 말은 프론트가 이미 알고 있음)

### 인증 방식
| 구간 | 방식 |
|------|------|
| 프론트 → 백엔드 | **로그인 없는 게스트.** 첫 접속 때 백엔드가 `playerId` 를 발급하고([1-1](#1-1-게스트-플레이어-발급)), 프론트는 브라우저에 보관해 모든 요청 헤더 `X-Player-Id` 로 보낸다 |
| 백엔드 → AI 서버 | 내부용 키 하나를 헤더 `X-Internal-Key` 로 보낸다. 값은 환경변수 `AI_SERVER_KEY` 로만 관리한다 |

### 공통 응답 형식
> 예외: 3D 연동 API 1-4 · 1-8 · 1-9 · 1-10 은 Unity 어댑터가 본문을 그대로 읽으므로 감싸지 않는다 ([1-4](#1-4-3d-체험-이벤트-전달)).

성공
```json
{ "code": 200, "data": {} }
```
실패
```json
{ "code": 400, "error": { "type": "INVALID_INPUT", "message": "사용자에게 보여 줄 수 있는 설명" } }
```

### 결과 코드 목록
| code | error.type | 언제 | 사용자 메시지 |
|------|-----------|------|---------------|
| 200 | — | 성공 | — |
| 400 | `INVALID_INPUT` | 필수 값 누락 · 형식 오류 | 입력 내용을 다시 확인해 주세요. |
| 401 | `UNKNOWN_PLAYER` | `X-Player-Id` 가 없거나 모르는 ID | 플레이 정보를 찾을 수 없어요. 처음부터 다시 시작해 주세요. |
| 404 | `NOT_FOUND` | 없는 플레이 · 체험 | 요청한 정보를 찾을 수 없어요. |
| 409 | `ALREADY_ENDED` | 이미 끝난 플레이 · 체험에 요청 | 이미 끝난 진행이에요. |
| 409 | `REQUEST_CONFLICT` | 같은 턴 요청 ID에 다른 입력 | 같은 요청 ID의 입력이 다릅니다. |
| 409 | `STATE_CONFLICT` | 생성 중 확정 상태/일시정지 버전 변경 | 최신 상태를 조회한 뒤 다시 시도해 주세요. |
| 409 | `PLAY_PAUSED` | 일시정지 상태에서 새 턴 요청 | 일시정지를 해제해 주세요. |
| 409 | `TURN_IN_PROGRESS` | 이전 턴 처리 중 | 같은 요청 ID를 유지하고 잠시 후 다시 시도해 주세요. |
| 409 | `NOT_ENDED` | 아직 끝나지 않은 플레이의 결말 요청 | 아직 이야기가 끝나지 않았어요. |
| 502 | `AI_UNAVAILABLE` | AI 서버 실패 (재요청 1회 후에도 실패) | 잠시 후 다시 시도해 주세요. |
| 503 | `CONTENT_UNAVAILABLE` | 서버에 게임 지침 문서(`docs/game/`)가 없거나 비어 있음 | 가이드라인 준비가 필요합니다. |
| 504 | `TIMEOUT` | 응답 시간 초과 | 응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요. |

### 기다리는 시간 · 다시 보내기
| 대상 | 규칙 |
|------|------|
| 채팅 ([1-3](#1-3-채팅-한-턴)) | 30초가 넘으면 `TIMEOUT` 안내 |
| 3D 체험 이벤트 ([1-4](#1-4-3d-체험-이벤트-전달)) | 저장 확인을 받을 때까지 2초마다 같은 이벤트를 다시 보냄 (전송 큐). 백엔드는 `(sessionId, eventId)` 로 중복 제거 |
| 3D 체험 종료 대기 | 5초. 넘어도 중단 확정 아님, 같은 `requestId` 로 재전송 |
| 백엔드 → AI 서버 | 형식이 깨진 응답이면 1회 다시 요청 |

---

# 1부. 프론트 ↔ 백엔드

## 1부 요약
| Method | Path | 설명 | 기능 # |
|--------|------|------|--------|
| POST | `/api/v1/players` | 게스트 플레이어 발급 | |
| POST | `/api/v1/plays` | 게임 시작 (플레이어 정보 입력) | |
| GET | `/api/v1/plays/{playId}` | 플레이 재개 (현재 상태 · 최근 대화) | |
| PATCH | `/api/v1/plays/{playId}` | 일시정지·해제 | |
| POST | `/api/v1/plays/{playId}/turns` | 채팅 한 턴 | |
| POST | `/api/v1/plays/{playId}/experience-events` | 3D 체험 이벤트 전달 (응답 감싸지 않음) | |
| POST | `/api/v1/plays/{playId}/experience-reconcile` | 종료 응답 없는 체험 정산 (응답 감싸지 않음) | |
| POST | `/api/v1/plays/{playId}/experience-heartbeat` | 체험 생존 신호 (응답 감싸지 않음) | |
| POST | `/api/v1/plays/{playId}/experience-pending` | 종료 응답 미수신 기록 (응답 감싸지 않음) | |
| GET | `/api/v1/plays/{playId}/result` | 결말 · 추천 직업 | |
| GET | `/api/v1/players/me/plays` | 지난 플레이 기록 목록 | |

## 1. 플레이

### 1-1. 게스트 플레이어 발급
`POST /api/v1/players` · 인증: 불필요

요청: 없음

응답 (성공)
```json
{ "code": 200, "data": { "playerId": "uuid" } }
```

### 1-2. 게임 시작
`POST /api/v1/plays` · 인증: `X-Player-Id`

요청
```json
{
  "name": "민준",
  "age": 15,
  "situation": "중학생",
  "hasDreamJob": true,
  "dreamJob": "과학자",
  "gender": "남",
  "interests": ["과학", "게임"],
  "majorOrGrade": "중학교 3학년",
  "strengths": ["만들기"],
  "values": ["성장"],
  "roleModel": "아버지",
  "mbti": "INTP"
}
```

| 필드 | 필수 | 설명 |
|------|:---:|------|
| `name` | ✅ | 게임 안에서 불릴 이름 (닉네임 가능) |
| `age` | ✅ | 현재 나이 (정수 **7~99**). 이 나이부터 게임이 시작된다 |
| `situation` | ✅ | 현재 상황. 보기 중 하나: `초등학생` · `중학생` · `고등학생` · `대학생` · `직장인` · `구직 중` · `기타` |
| `hasDreamJob` | ✅ | 희망 직업 유무 |
| `dreamJob` | `hasDreamJob` 이 `true` 일 때 | 희망 직업명 |
| `gender` | | 성별. 선택 안 함 허용 |
| `interests` | | 관심사 (여러 개, 최대 5). 보기: 과학 · 기술·IT · 예술·디자인 · 음악 · 운동 · 책·글쓰기 · 요리 · 사람 돕기 · 사업·경제 · 자연·동물 + 직접 입력 |
| `majorOrGrade` | | 전공 또는 학년 |
| `strengths` | | 잘하는 것 · 좋아하는 과목 (여러 개, 최대 5, 직접 입력) |
| `values` | | 가치관 (보기 중 최대 3: 안정 · 성장 · 돈 · 사회 기여 · 자유 · 인정 · 관계) |
| `roleModel` | | 롤모델 |
| `mbti` | | MBTI |

- 진행 중인 플레이가 있어도 새 플레이를 시작할 수 있다. 이전 플레이는 끝내지 않고 그대로 두며, 지난 기록([1-6](#1-6-지난-플레이-기록))에서 이어 할 수 있다
- **선택 항목은 프론트가 7개 중 랜덤 2개만 화면에 보여 준다.** 사용자가 건너뛴 항목과 보여 주지 않은 항목은 보내지 않는다 (필드 생략)
- 비어 있는 선택 항목은 게임 중 NPC 가 대화로 하나씩 묻고, 답하면 [1-3](#1-3-채팅-한-턴) 의 `stateChanges` 로 `profile.<필드>` 가 채워진다
- 받지 않는 정보: 건강 · 질병 (개인정보보호법상 민감정보. AI 가 묻거나 유도하지도 않는다), 가족관계 · 반려동물 (주변 인물은 게임이 랜덤으로 구성 — [00-idea.md 7장](../00-idea.md#7-주변-인물과-랜덤성))

응답 (성공)
```json
{
  "code": 200,
  "data": {
    "playId": "uuid",
    "sessionId": "uuid",
    "state": { },
    "messages": [ { "role": "narrator", "speaker": "나레이션", "text": "..." } ]
  }
}
```
- `sessionId` 는 Unity 연동에 쓰는 플레이 단위 ID. 프론트는 이 플레이의 모든 3D 체험에 같은 값을 쓴다
- `state` 는 백엔드가 확정한 현재 값이다. 상세 기획 반영 설계는 아래 [게임 상태와 턴 확장](#게임-상태와-턴-확장-2026-10-31)을 따른다.

실패
| code | 조건 |
|------|------|
| 400 | 필수 값(이름 · 나이 · 상황 · 희망 직업 유무) 누락 |

### 1-3. 채팅 한 턴
`POST /api/v1/plays/{playId}/turns` · 인증: `X-Player-Id`

> 응답은 **다 만들어지면 한 번에** 준다 (스트리밍 안 함).

요청
```json
{ "requestId": "동일 행동의 재시도 동안 유지하는 uuid", "message": "응 나 과학자임" }
```

응답 (성공)
```json
{
  "code": 200,
  "data": {
    "turnId": "uuid",
    "messages": [ { "role": "npc", "speaker": "친구 민수", "text": "뭔 소리야, 너 학생이잖아." } ],
    "stateChanges": [ { "field": "relationship.민수", "from": 50, "to": 52 } ],
    "hints": [ "과학 동아리에 대해 물어본다" ],
    "experience": null,
    "ended": false
  }
}
```
- `stateChanges` 는 백엔드가 확인을 마치고 실제 반영한 변경만 담는다. 대화 중 사용자가 선택 항목에 답하면 `{ "field": "profile.mbti", "from": null, "to": "INTP" }` 처럼 담긴다
- `title` 은 Unity 허용 목록(`production-supported-manifest.json`)의 `title`, `jobs` 는 카탈로그의 `jobs`, `reason` 은 AI 응답 `branch.reason`. 3D 안내 카드에 "무슨 체험인지 · 왜 지금인지"를 보여 주는 용도
- `buildUrl` 은 백엔드가 요청이 들어온 주소(현재 터널 주소) 기준으로 만든다 ([06 5-2](06-deployment.md#5-2-3d-빌드-파일-저장--관리--전달))
- `experience` 는 3D 분기일 때만 채운다. 맞는 빌드가 없으면 `null` 과 함께 `notice` 를 준다
```json
"experience": {
  "buildId": "career-suite-integration-v005",
  "buildUrl": "https://<현재 터널 주소>/builds/career-suite-integration-v005/",
  "roomId": "PAN-002",
  "scenarioId": "career-net-951-experience",
  "scenarioVersion": "v002",
  "title": "주민 문화행사 준비",
  "jobs": ["행사기획자"],
  "reason": "친구가 행사 준비를 함께 하자고 제안함"
}
```
```json
"notice": { "type": "EXPERIENCE_SKIPPED", "message": "지금 상황에 맞는 3D 체험이 없어 텍스트로 이야기를 이어갈게요." }
```
- `ended: true` 면 인생이 끝난 것이다. 프론트는 [1-5](#1-5-결말--추천-직업) 를 호출한다

실패
| code | 조건 |
|------|------|
| 400 | `message` 가 비었음 |
| 404 | 없는 `playId` |
| 409 | 이미 끝난 플레이 |
| 502 · 504 | AI 서버 실패 · 시간 초과 |

### 1-4. 3D 체험 이벤트 전달
`POST /api/v1/plays/{playId}/experience-events` · 인증: `X-Player-Id`

> Unity 어댑터(`docs/unity/frontend/backend.js` 의 `sendEvent`)가 Unity 이벤트를 **받을 때마다 즉시** 보낸다 ([10 4-3](10-prompt-assembly.md#4-3-프론트--백엔드-전달)).
> **3D 연동 API(1-4 · 1-8 · 1-9 · 1-10)는 공통 응답 형식 `{code, data}` 의 예외다.** 어댑터가 응답 본문을 그대로 읽으므로 감싸지 않고 돌려준다. 실패는 HTTP 상태 코드로만 알린다.

요청: Unity 가 보낸 이벤트 객체 **원본 그대로** (감싸지 않음). 이벤트 안에 `buildId` · `roomId` · `scenarioId` · `scenarioVersion` · `sessionId` · `experienceId` 가 이미 들어 있다 (필드: `docs/unity/contracts/realtime-v002/realtime-contract.json`)

응답 (성공, 감싸지 않음)
```json
{ "stored": true, "sessionId": "…", "eventId": "…" }
```
- **DB 저장을 마친 뒤에만** 준다. 어댑터 전송 큐는 이 값을 받을 때까지 같은 이벤트를 다시 보낸다
- 이미 받은 `(sessionId, eventId)` 와 내용이 같으면 같은 응답을 준다 (중복)
- `type` 이 `experience.ended` 면 이때 플레이어 기록에 반영하고, 다음 채팅 턴부터 결과를 프롬프트에 넣는다

실패 (HTTP 상태 코드)
| code | 조건 |
|------|------|
| 400 | Unity 명세 형식에 맞지 않음 → 프론트는 체험 종료 모달 ([10 4-4](10-prompt-assembly.md#4-4-오류-안내-문구)) |
| 401 · 404 | 모르는 플레이어 · 플레이 |
| 409 | 같은 `(sessionId, eventId)` 인데 내용이 다름 (충돌, 격리 보존) |

### 1-5. 결말 · 추천 직업
`GET /api/v1/plays/{playId}/result` · 인증: `X-Player-Id`

> 인생이 끝난 플레이(`ended: true`)만. 처음 요청 때 만들어 `plays.ending` 에 저장하고, 이후에는 저장된 값을 준다. 만드는 방식: [10 7절](10-prompt-assembly.md#7-결말--추천-직업-be12--ai5)

응답 (성공)
```json
{
  "code": 200,
  "data": {
    "ending": "이번 인생 요약 …",
    "recommendedJobs": [
      { "job": "행사기획자", "isNew": false, "basis": ["experience", "conversation"], "reason": "동아리 행사 준비 체험을 끝까지 해냈고 …", "work": "하는 일 …", "nextSteps": ["…", "…"] },
      { "job": "사서", "isNew": true, "basis": ["interest"], "reason": "책 이야기에 관심을 보였지만 아직 경험하지 않은 일 …", "work": "…", "nextSteps": ["…"] }
    ]
  }
}
```
- `isNew: true` 는 아직 경험하지 않은 새 직업 (다음 플레이 권유)
- `basis` 는 추천 근거 종류: `experience`(3D 체험) · `conversation`(대화) · `interest`(흥미 기록) · `dreamJob`(희망 직업). 백엔드가 [10 7절](10-prompt-assembly.md#7-결말--추천-직업-be12--ai5) 점수 근거에서 채운다. 화면의 "3D 체험함" 같은 표시에 쓴다

실패
| code | 조건 |
|------|------|
| 409 `NOT_ENDED` | 아직 끝나지 않은 플레이 |
| 502 · 504 | AI 서버 실패 · 시간 초과 |

### 1-6. 지난 플레이 기록
`GET /api/v1/players/me/plays` · 인증: `X-Player-Id`

응답 (성공)
```json
{ "code": 200, "data": { "plays": [ { "playId": "uuid", "startedAt": "...", "ended": true, "summary": "..." } ] } }
```

### 1-7. 플레이 재개
`GET /api/v1/plays/{playId}` · 인증: `X-Player-Id`

응답 (성공)
```json
{ "code": 200, "data": { "playId": "uuid", "sessionId": "uuid", "state": { }, "messages": [ ], "ended": false } }
```
- `sessionId` 는 게임 시작(1-2) 때 받은 값과 같다. 다른 기기 · 브라우저에서 이어 해도 3D 체험에 같은 `sessionId` 를 쓸 수 있게 돌려준다
- 재접속만으로는 진행 중이던 3D 체험을 정산하지 않는다 (정산은 [1-8](#1-8-종료-응답-없는-체험-정산))

### 1-8. 종료 응답 없는 체험 정산
`POST /api/v1/plays/{playId}/experience-reconcile` · 인증: `X-Player-Id`

> 새 3D 체험을 시작하기 전, 종료 응답을 받지 못한 이전 체험이 있으면 어댑터(`reconcile`)가 보낸다. 규칙: [10 4-5](10-prompt-assembly.md#4-5-종료-응답이-오지-않은-체험-정산-v003)

요청: `docs/unity/contracts/reconciliation-v003/reconcile-request.example.json` 의 `request` 객체 그대로 (어댑터의 `reconciliationRequest()` 로 만든다)

응답 (성공, 감싸지 않음): `experience.reconciled` 객체 — `docs/unity/contracts/reconciliation-v003/resolution-response.schema.json`
- 소유자는 요청 값이 아니라 `X-Player-Id` 로 서버가 판단한다
- 같은 `reconcileRequestId` · 같은 내용이면 같은 응답, 내용이 다르면 409

### 1-9. 체험 생존 신호
`POST /api/v1/plays/{playId}/experience-heartbeat` · 인증: `X-Player-Id`

> 체험 중 30초마다 어댑터(`heartbeat`)가 보낸다. 마지막 신호 뒤 120초가 지나면 lease 만료로 본다 (정산 판단에만 쓰며, 시간 초과만으로 체험을 끝내지 않는다).

요청
```json
{ "sessionId": "…", "experienceId": "…" }
```
응답 (성공, 감싸지 않음)
```json
{ "sessionId": "…", "experienceId": "…", "leaseExpiresAt": "2026-10-31T10:32:00+09:00" }
```

### 1-10. 종료 응답 미수신 기록
`POST /api/v1/plays/{playId}/experience-pending` · 인증: `X-Player-Id`

> 종료 호출 후 5초 안에 종료 응답이 없으면 어댑터(`markPending`)가 보낸다. 백엔드는 그 체험을 `pending_reconciliation` 으로 기록만 한다 (중단 확정이 아니다).

요청
```json
{ "sessionId": "…", "experienceId": "…", "roomId": "PAN-002", "requestId": "종료 호출 requestId", "reason": "END_RESPONSE_TIMEOUT" }
```
응답 (성공, 감싸지 않음)
```json
{ "sessionId": "…", "experienceId": "…", "lifecycleStatus": "pending_reconciliation" }
```

---

# 2부. 백엔드 ↔ AI 서버

> 프롬프트에 무엇을 어떤 순서로 넣는지는 [10-prompt-assembly.md](10-prompt-assembly.md) 에 있다. 여기에는 요청·응답 형식만 적는다.
> AI 서버 응답은 자유 글이 아니라 **아래 JSON 형식**으로만 받는다.

## 2부 요약
| Method | Path | 설명 | 기능 # |
|--------|------|------|--------|
| POST | `/ai/v1/chat` | 대화 생성 | |
| POST | `/ai/v1/experience-recommendation` | 3D 체험 추천 | |
| POST | `/ai/v1/ending` | 결말 · 추천 직업 생성 | |

## 2. AI 서버

### 2-1. 대화 생성
`POST /ai/v1/chat` · 인증: `X-Internal-Key`

요청
```json
{
  "guidelines": "가이드라인 문서 원문",
  "scenario": "시나리오 문서 원문",
  "player": { },
  "history": [ { "role": "user", "text": "..." }, { "role": "npc", "speaker": "친구 민수", "text": "..." } ],
  "input": "응 나 과학자임"
}
```
- `history` 는 최근 **20턴** 범위에서 현재 장면의 발화 NPC가 알 수 있는 내용만 제공한다. 다른 NPC와의 비공개 대화를 통째로 보내지 않는다. 플레이어 전체 기록의 조회 권한과 NPC의 지식 범위는 별개다.

응답 (성공)
```json
{
  "code": 200,
  "data": {
    "messages": [ { "role": "npc", "speaker": "친구 민수", "text": "뭔 소리야, 너 학생이잖아." } ],
    "stateChanges": [ { "field": "relationship.민수", "to": 52, "reason": "..." } ],
    "hints": [ "..." ],
    "branch": null,
    "lifeEnded": false
  }
}
```
- `stateChanges` 는 **제안**이다. 백엔드가 확인한 뒤 반영한다 ([10 3절](10-prompt-assembly.md#3-ai-응답-처리))
- `branch` 는 **AI 가 "지금이 3D 체험을 할 분기"라고 판단할 때만** 채운다. 평소에는 `null`
```json
"branch": { "topic": "진로 결정 - 행사 기획 동아리 제안", "jobs": ["행사기획자"], "reason": "친구가 행사 준비를 함께 하자고 제안함" }
```
- 백엔드는 `branch` 가 있으면 이를 감지해 후보를 고르고([10 4-1-1](10-prompt-assembly.md#4-1-1-후보-20개-고르는-방식-be7)) [2-2](#2-2-3d-체험-추천) 를 호출한다. 결과를 채팅 응답의 `experience` 로 프론트에 주고, 프론트는 이를 감지해 3D 체험을 렌더한다
- `topic` 은 분기 주제, `jobs` 는 AI 가 떠올린 관련 직업(없으면 빈 배열), `reason` 은 사용자에게 보여 줄 수 있는 분기 이유

실패
| code | 조건 | 백엔드 처리 |
|------|------|-------------|
| 4xx · 5xx · 형식 오류 | 응답 실패 또는 JSON 형식이 맞지 않음 | 1회 다시 요청 → 또 실패하면 프론트에 502 |

### 2-2. 3D 체험 추천
`POST /ai/v1/experience-recommendation` · 인증: `X-Internal-Key`

요청
```json
{
  "candidates": [ { "buildId": "…", "roomId": "PAN-002", "scenarioId": "…", "scenarioVersion": "v002", "jobs": ["행사기획자"], "description": "…" } ],
  "branch": { "topic": "…", "jobs": ["…"], "reason": "…" },
  "situation": "현재 인생 상황 요약",
  "player": { }
}
```
- `candidates` 는 백엔드가 Unity 카탈로그에서 미리 줄인 후보 약 20개 ([10 4-1](10-prompt-assembly.md#4-1-빌드-카탈로그-unity-제공))
- AI 서버는 RAG 로 직업 정보를 함께 참고할 수 있다 ([10 6절](10-prompt-assembly.md#6-직업-데이터-rag-ai-서버))

응답 (성공)
```json
{
  "code": 200,
  "data": {
    "found": true,
    "buildId": "career-suite-integration-v005",
    "roomId": "PAN-002",
    "scenarioId": "career-net-951-experience",
    "scenarioVersion": "v002",
    "reason": "추천 이유"
  }
}
```
- 맞는 체험이 없으면 `found: false` 만 보낸다

실패
| code | 조건 | 백엔드 처리 |
|------|------|-------------|
| 형식 오류 · 카탈로그에 없는 값 | 응답 ID 가 카탈로그에 없음 | 3D 건너뛰기 (프론트에 `notice`) |
| 4xx · 5xx | AI 서버 실패 | 1회 다시 요청 → 또 실패하면 3D 건너뛰기 |

### 2-3. 결말 생성
`POST /ai/v1/ending` · 인증: `X-Internal-Key`

요청
```json
{
  "guidelines": "가이드라인 문서 원문",
  "player": { },
  "candidates": [ { "job": "행사기획자", "score": 7, "evidence": ["3D 체험 완료: career-net-951-experience", "대화: 행사 준비가 재밌다"] } ],
  "experiencedJobs": ["행사기획자"]
}
```
- `candidates` 는 백엔드가 점수를 매긴 상위 5개 ([10 7절](10-prompt-assembly.md#7-결말--추천-직업-be12--ai5))

응답 (성공)
```json
{ "code": 200, "data": { "ending": "…", "recommendedJobs": [ { "job": "…", "isNew": false, "basis": ["experience"], "reason": "…", "work": "…", "nextSteps": ["…"] } ] } }
```
- 추천은 3개, 그중 1개 이상 `isNew: true`. 직업 정보는 RAG 근거

---

## N. 서버 로그 이벤트 규약
<!-- 남겨야 할 로그 이벤트 이름과 필드 (요청 수신, AI 서버 호출, 저장 성공/실패 등) -->
| 서버 | 이벤트 | 시점 | 필드 |
|------|--------|------|------|
| | | | |

## N+1. 합의된 값
| 항목 | 값 | 근거 |
|------|----|------|
| 채팅 응답 대기 | 30초 | 이후 `TIMEOUT` 안내 |
| 3D 이벤트 다시 보내기 | 저장 확인까지 2초 간격 | Unity 연결 코드의 전송 큐 규칙 |
| 체험 생존 신호 · lease | 30초 · 120초 | Unity 명세 v003 기본값 |
| AI 형식 오류 재요청 | 1회 | |
| 프롬프트에 넣는 대화 | 최근 20턴 | |

## 게임 상태와 턴 확장 (2026-10-31)

기획 기준: [인생·직업 게임 상세 기획](../game/06-life-career-design.md). 아래는 게임 API 후속 구현을 위한 계약안이며 현재 프론트 mock이나 백엔드에 구현되었다는 뜻은 아니다. 기존 엔드포인트와 응답 포장은 유지한다.

| 데이터 | 계약 |
|---|---|
| 공통 상태 | `age`, `elapsedDays`, `funds`(원화 정수, 0 이상), `debt`(원화 총부채, 0 이상), `health`, `energy`, `stress`(각 0~100) |
| 상황별 상태 | `housing`(주거 유형·보증금·월세·생활비), `development`(학생 성적/자기계발 종류와 값), `occupation`(현재 직업·준비·근무 상황). 상세 객체는 DB 설계에 맞춰 구현 시 고정 |
| 내부 상태 | NPC별 관계, 흥미 5단계와 미확인 구분, 부채별 채권자·미납·사건, 건강/과로 지속 기간. NPC의 비공개 기억은 프론트 공통 상태에 노출하지 않음 |
| 턴 결과 | 시작·재개 응답처럼 채팅 응답에도 저장 후 전체 `state`를 제공. `stateChanges`에는 실제 반영값만 반환 |
| 선택 | `hints`와 자유 입력을 유지. NPC 설명→핵심 업무→판단→결과·피드백 흐름은 대화로 표현 |

`requestId`는 같은 플레이에서 같은 행동을 재시도할 때 유지한다. 같은 ID·같은 입력이면 이미 저장한 결과를 반환하고, 같은 ID·다른 입력은 409 `REQUEST_CONFLICT`로 거부한다. 응답을 못 받았다는 이유로 새 ID로 같은 행동을 자동 제출하지 않는다. 동시에 상태가 바뀌어 재검토가 필요한 경우 409 `STATE_CONFLICT`를 반환하고 최신 상태를 조회한다.

검증을 통과한 대화·상태·사건은 한 번에 저장한다. 형식이나 규칙 검증 실패 시 한 번 재요청하며, 계속 실패하면 기존 502 오류를 반환한다. 이 경우 성공 대화·상태 변경을 저장하지 않는다. 자금 부족은 자동 마이너스나 자동 대출로 처리하지 않고 대응 선택을 이어 준다. AI의 사망 제안만으로 `ended`를 바꾸지 않고 게임 규칙과 확정 사건을 확인한다.

AI 요청의 `player`에는 확정 상태와 현재 장면, 발화 NPC 식별자, 허용된 기억 요약을 제공한다. 검색 대상을 현재 `playId`와 해당 NPC가 알 수 있는 사건으로 제한한다. AI의 기억 추가·전달 제안도 백엔드가 출처와 참여자를 검증한 뒤 저장한다. 정확한 기억 객체는 [DB 저장 범위](04-database.md#인생-진행-저장-범위-2026-10-31)를 따른다.

일시정지/재개는 기존 플레이 리소스에 `PATCH /api/v1/plays/{playId}`로 `{"paused": true}` 또는 `{"paused": false}`를 보내는 설계로 한다. 재개 응답에는 확정된 상태와 `paused`를 포함한다. 닫힌 화면의 통지가 도착한다고 가정하지 않으며 비활성 구간을 자동으로 플레이 시간에 더하지 않는다. 명시적 일시정지 중에는 새 턴을 받지 않고, 이미 제출한 턴은 상태 버전과 요청 ID로 일관되게 정산한다. 재개 조회는 자체적으로 게임 날짜를 진행시키지 않는다.


구현에서 확정한 객체와 후속 AI 제안 필드(2026-11-01, BE2·BE4·BE5·BE11):

| 객체 | 필드·검증 |
|---|---|
| `state` | `schemaVersion:2`, `gameDate`(게임 날짜 ISO), 기존 공통 필드. 시작 시 자산/부채 미배정 값은 0, 건강80·에너지70·스트레스20. 미확정 현실 급여·성적은 추정하지 않는다 |
| `housing` | `type`: `unknown/monthlyRent/jeonse/owned/family`, `deposit`, `depositPaid`, `monthlyRent`, `livingCost`. 미배정 비용은 0; 보증금은 수락한 제안 ID로 1회 차감 |
| `development` | `kind`: `grades/selfDevelopment`, `value`: 미확인 null 또는 가상 진행값0~100, `previousGrades`. 취업 시 성적 값을 보존하고 자기계발 값으로 이어 사용 |
| `occupation` | `status`: `student/employed/searching/preparing/undecided`, `currentJob`, `preparation`, `monthlySalary`, `salarySource`. 급여 출처는 `{url,checkedAt,fact}`; 직업 사실의 실제 RAG 근거 검증은 AI 서버 연동 범위 |
| `interests` | 분야별 1~5, 기록이 없거나 단계 미확인이면 null/키 없음. 시작 입력 분야도 단계는 임의로 평가하지 않고 null로 보관 |
| `relationship` | NPC 식별자별 가상 관계 값0~100. 해당 장면의 인물·입력 인용/사건 출처가 있어야 변경 |
| `debts/arrears` | 부채 `{id,creditor,balance,sourceAction}`, 미납 `{id,creditor,amount,gameDate}`. `debt`는 부채 잔액 합계, 미납은 별도. 자동 대출 없음 |
| 턴 응답 | 기존 필드 + `state`, `stateVersion`, `pendingChoices`, 공개 `events`. 성공 응답 전체를 `(playId,requestId)`로 저장해 재전송에 그대로 반환 |
| 재개 응답 | 기존 필드 + `paused`, `stateVersion`, `activePlaySeconds`, `scene`, `pendingChoices`, `lastTurnId` |

PATCH 요청은 `{"paused":true}`/`{"paused":false}`, 응답은 `{code:200,data:{state,paused,stateVersion,activePlaySeconds}}`다. 같은 paused 값의 재전송은 버전을 증가시키지 않는다. 생성 중 정지하면 해당 생성은 `STATE_CONFLICT`로 저장을 취소하고 기존 확정 상태를 유지한다. 이미 완료된 requestId의 조회성 재전송은 정지·종료 상태에서도 저장 응답을 반환한다.

`activePlaySeconds`는 서버에서 확인 가능한 요청 처리 구간(AI 대기 포함)의 누적값이다. 요청 사이 화면 활성 여부는 서버가 알 수 없으므로 비활성·닫힌 구간을 추정해서 더하지 않는다. 화면에서 읽고 입력하는 전체 활성 시간의 정확한 계측은 프론트 활성 구간 전달 연동이 추가로 필요하다.

2-1 AI 대화 응답에는 다음 선택 필드를 추가한다. 생략하면 빈 제안으로 처리한다. 최종 대화·상태·사건·기억·재정은 동일 트랜잭션에 저장하며 검증 실패 시 전체 30초 안에서 총 1회 재요청한다.

| 선택 필드 | 형식 |
|---|---|
| `actions[]` | 아래 행동 객체 목록. 각각 `kind`, 이번 입력에 실제 있는 `evidenceQuote` 필수. 직접 `stateChanges.funds/health/occupation` 조작은 거부 |
| `scene` | `{id,npcIds,speakerNpcId,npcs:[{id,name}]}`. 발화자는 참여자여야 하고 기존 NPC를 장면에 추가하려면 사용자 입력 근거가 필요 |
| `memoryUpdates[]` | `{npcId,eventId,emotion?,interpretation?}`. 그 NPC가 아는 사건만 허용; 확정 사실은 변경 불가 |
| `transfers[]` | `{fromNpcId,toNpcId,eventId,trigger}`. 전달자가 이미 아는 현재 플레이 사건만, `trigger:timePassed/importantEvent`의 서버 확정 근거가 있어야 수신자 기억에 추가 |

| `actions[].kind` | 추가 필드·확정 방식 |
|---|---|
| `advance` | `days`, `activity`: `work/overtime/holiday/vacation/study/jobSearch/prepare/idle`. 날짜별 상태·달별 재정을 계산하고 중요한 선택에서 중단. 1년 이상은 앞선 제안과 별도 확인 필요 |
| `confirmAdvance` | 이전 `pendingChoices.confirmAdvance`에 대한 명시적 확인. 확인 뒤 같은 턴에 일치하는 `advance`를 제안할 수 있음 |
| `jobOffer` | `job,monthlySalary,source:{url,checkedAt,fact}`. 조건만 제시하며 바로 취업하지 않음 |
| `housingOffer` | `type,deposit,monthlyRent,livingCost`. 조건만 제시 |
| `loanOffer` | `amount,creditor`. 조건만 제시 |
| `acceptJob/acceptHousing/loan` | 앞선 `offerId`와 명시적 수락 필요. 기존 직업 마무리·가용 잔액·출처 검증 |
| `quitJob` | 현재 직업과 명시적 사용자 선택 필요. 이전 직업을 사건으로 보존 |
| `repay` | `debtId,amount`. 가용 자금 내 상환만 반영 |
| `settleArrear` | `arrearId`. 가용 자금으로 미납 상환 |
| `development` | `value`0~100, 이번 학습·훈련 입력 근거 필요. 아르바이트 자체로 성적 차감 없음 |
| `stressFactors` | `factors[]`. 가상 사건의 서로 다른 스트레스 요인을 기록 |

AI `player`에는 `playId,currentScene,speakingNpcId,npcs,memoryScope,memories,visibleEvents,pendingChoices`를 확정 상태와 함께 보낸다. `memories`는 DB에서 현재 플레이와 NPC로 먼저 제한하며 사실·획득 경로·감정·해석을 분리한다. 현재 NPC에게 공개된 입력/응답만 최근20턴 범위에서 `history`에 넣는다. 플레이어의 재개 대화는 본인 기록 전체이므로 이 NPC 필터와 구분한다.

`/ai/v1/experience-recommendation`과 `/ai/v1/ending`의 필수 요청·응답은 위 2부 계약을 유지한다. 세 경로 모두 별도 AI 서버 호출이며 Django에서 `/ai/` 라우트를 제공하지 않는다.
