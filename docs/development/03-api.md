# 03. API 명세

> 관련 문서: [02-architecture.md](02-architecture.md) · [04-database.md](04-database.md) · [10-prompt-assembly.md](10-prompt-assembly.md)
> **API 계약의 기준 문서다.** 프론트·백엔드·AI 서버가 병렬로 작업하므로 이 문서를 먼저 확정하고, API 가 바뀌면 같은 PR 에서 함께 고친다.
> 두 부분으로 나눈다: **1부 프론트 ↔ 백엔드**, **2부 백엔드 ↔ AI 서버**. 프론트는 AI 서버를 직접 호출하지 않는다. 프론트 ↔ Unity 는 [docs/unity/](../unity/README.md) 를 따른다.
> 각 API 의 요청·응답 필드는 1차 설계안이다. 기능 번호는 [features.md](features.md) 를 채우며 연결한다.

## 0. 공통 규약

| 항목 | 규칙 |
|------|------|
| 주소 앞부분 | 백엔드 `/api/v1/...`, AI 서버 `/ai/v1/...` (버전 포함) |
| 필드 이름 | camelCase (Unity 명세와 같음) |
| 시간 | ISO 8601 + 시간대. 예: `2026-10-31T10:30:00+09:00` |
| ID | 문자열 UUID (Unity 명세의 ID 는 Unity 형식 그대로) |
| 문자 인코딩 | UTF-8 JSON |

### Base URL
| 서버 | 환경 | 주소 |
|------|------|------|
| 백엔드 | 로컬 | <!-- TODO --> |
| 백엔드 | 배포 | <!-- TODO --> |
| AI 서버 | 로컬 | <!-- TODO --> |
| AI 서버 | 배포 | <!-- TODO --> |

### 인증 방식
| 구간 | 방식 |
|------|------|
| 프론트 → 백엔드 | **로그인 없는 게스트.** 첫 접속 때 백엔드가 `playerId` 를 발급하고([1-1](#1-1-게스트-플레이어-발급)), 프론트는 브라우저에 보관해 모든 요청 헤더 `X-Player-Id` 로 보낸다 |
| 백엔드 → AI 서버 | 내부용 키 하나를 헤더 `X-Internal-Key` 로 보낸다. 값은 환경변수 `AI_SERVER_KEY` 로만 관리한다 |

### 공통 응답 형식
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
| 502 | `AI_UNAVAILABLE` | AI 서버 실패 (재요청 1회 후에도 실패) | 잠시 후 다시 시도해 주세요. |
| 504 | `TIMEOUT` | 응답 시간 초과 | 응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요. |

### 기다리는 시간 · 다시 보내기
| 대상 | 규칙 |
|------|------|
| 채팅 ([1-3](#1-3-채팅-한-턴)) | 30초가 넘으면 `TIMEOUT` 안내 |
| 3D 체험 이벤트 ([1-4](#1-4-3d-체험-이벤트-전달)) | 실패 시 프론트가 최대 3회 다시 보냄. 같은 `eventId` 로 다시 보내므로 백엔드는 중복 제거 |
| 백엔드 → AI 서버 | 형식이 깨진 응답이면 1회 다시 요청 |

---

# 1부. 프론트 ↔ 백엔드

## 1부 요약
| Method | Path | 설명 | 기능 # |
|--------|------|------|--------|
| POST | `/api/v1/players` | 게스트 플레이어 발급 | |
| POST | `/api/v1/plays` | 게임 시작 (플레이어 정보 입력) | |
| GET | `/api/v1/plays/{playId}` | 플레이 재개 (현재 상태 · 최근 대화) | |
| POST | `/api/v1/plays/{playId}/turns` | 채팅 한 턴 | |
| POST | `/api/v1/plays/{playId}/experiences/{experienceId}/events` | 3D 체험 이벤트 전달 | |
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
| `age` | ✅ | 현재 나이. 이 나이부터 게임이 시작된다 |
| `situation` | ✅ | 현재 상황 (학생 · 직장인 · 구직 중 등) |
| `hasDreamJob` | ✅ | 희망 직업 유무 |
| `dreamJob` | `hasDreamJob` 이 `true` 일 때 | 희망 직업명 |
| `gender` | | 성별. 선택 안 함 허용 |
| `interests` | | 관심사 (여러 개) |
| `majorOrGrade` | | 전공 또는 학년 |
| `strengths` | | 잘하는 것 · 좋아하는 과목 (여러 개) |
| `values` | | 가치관 (보기 중 선택. 예: 안정 · 성장 · 돈 · 사회 기여 · 자유) |
| `roleModel` | | 롤모델 |
| `mbti` | | MBTI |

- 받지 않는 정보: 건강 · 질병 (개인정보보호법상 민감정보), 가족관계 · 반려동물 (주변 인물은 게임이 랜덤으로 구성 — [00-idea.md 7장](../00-idea.md#7-주변-인물과-랜덤성))

응답 (성공)
```json
{
  "code": 200,
  "data": {
    "playId": "uuid",
    "state": { },
    "messages": [ { "speaker": "narrator", "text": "..." } ]
  }
}
```
- `state` 는 플레이어 기록의 현재 값 ([10 5절](10-prompt-assembly.md#5-플레이어-기록-항목)) <!-- TODO: 필드 확정 -->

실패
| code | 조건 |
|------|------|
| 400 | 필수 값(이름 · 나이 · 상황 · 희망 직업 유무) 누락 |

### 1-3. 채팅 한 턴
`POST /api/v1/plays/{playId}/turns` · 인증: `X-Player-Id`

> 응답은 **다 만들어지면 한 번에** 준다 (스트리밍 안 함).

요청
```json
{ "message": "응 나 과학자임" }
```

응답 (성공)
```json
{
  "code": 200,
  "data": {
    "turnId": "uuid",
    "messages": [ { "speaker": "친구 민수", "text": "뭔 소리야, 너 학생이잖아." } ],
    "stateChanges": [ { "field": "relationship.민수", "from": 50, "to": 52 } ],
    "hints": [ "과학 동아리에 대해 물어본다" ],
    "experience": null,
    "ended": false
  }
}
```
- `stateChanges` 는 백엔드가 확인을 마치고 실제 반영한 변경만 담는다
- `experience` 는 3D 분기일 때만 채운다. 맞는 빌드가 없으면 `null` 과 함께 `notice` 를 준다
```json
"experience": {
  "buildId": "office-v001",
  "buildUrl": "/builds/office-v001/",
  "roomId": "office",
  "scenarioId": "career-net-253-office-documents",
  "scenarioVersion": "v001"
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
`POST /api/v1/plays/{playId}/experiences/{experienceId}/events` · 인증: `X-Player-Id`

> Unity 응답을 **받을 때마다 즉시** 한 건씩 보낸다 ([10 4-3](10-prompt-assembly.md#4-3-프론트--백엔드-전달)).

요청
```json
{
  "buildId": "office-v001",
  "roomId": "office",
  "scenarioId": "career-net-253-office-documents",
  "scenarioVersion": "v001",
  "unityEvent": { }
}
```
- `unityEvent` 는 Unity 가 준 응답 객체를 **고치지 않고 그대로** 담는다 ([docs/unity/RESPONSES.md](../unity/RESPONSES.md))

응답 (성공)
```json
{ "code": 200, "data": { "accepted": true, "duplicate": false } }
```
- 이미 받은 `eventId` 면 `duplicate: true` 로 성공 처리한다 (다시 보내기 대비)
- `unityEvent.type` 이 `experience.ended` 면 백엔드는 이때 플레이어 기록에 반영하고, 다음 채팅 턴부터 결과를 프롬프트에 넣는다

실패
| code | 조건 |
|------|------|
| 400 | `unityEvent` 가 Unity 명세 형식에 맞지 않음 → 프론트는 체험 종료 모달 ([10 4-4](10-prompt-assembly.md#4-4-오류-안내-문구)) |
| 404 | 없는 `playId` |
| 409 | 이미 종료 처리된 `experienceId` |

### 1-5. 결말 · 추천 직업
`GET /api/v1/plays/{playId}/result` · 인증: `X-Player-Id`

응답 (성공)
```json
{
  "code": 200,
  "data": {
    "ending": "...",
    "recommendedJobs": [ { "job": "연구원", "reason": "...", "nextSteps": [ "..." ] } ]
  }
}
```
<!-- TODO: 추천 시점 · 판단 기준 · 표현 방식은 00-idea 13장 미정 항목 -->

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
{ "code": 200, "data": { "playId": "uuid", "state": { }, "messages": [ ], "ended": false } }
```
- 종료 응답을 받지 못한 3D 체험이 있으면, 백엔드는 이 시점에 그때까지 받은 이벤트로 "중간에 그만둠" 처리한다

---

# 2부. 백엔드 ↔ AI 서버

> 프롬프트에 무엇을 어떤 순서로 넣는지는 [10-prompt-assembly.md](10-prompt-assembly.md) 에 있다. 여기에는 요청·응답 형식만 적는다.
> AI 서버 응답은 자유 글이 아니라 **아래 JSON 형식**으로만 받는다.

## 2부 요약
| Method | Path | 설명 | 기능 # |
|--------|------|------|--------|
| POST | `/ai/v1/chat` | 대화 생성 | |
| POST | `/ai/v1/experience-recommendation` | 3D 체험 추천 | |

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
- `history` 는 최근 **20턴**

응답 (성공)
```json
{
  "code": 200,
  "data": {
    "messages": [ { "speaker": "친구 민수", "text": "뭔 소리야, 너 학생이잖아." } ],
    "stateChanges": [ { "field": "relationship.민수", "to": 52, "reason": "..." } ],
    "hints": [ "..." ],
    "experienceNeeded": false,
    "lifeEnded": false
  }
}
```
- `stateChanges` 는 **제안**이다. 백엔드가 확인한 뒤 반영한다 ([10 3절](10-prompt-assembly.md#3-ai-응답-처리))
- `experienceNeeded: true` 면 백엔드가 [2-2](#2-2-3d-체험-추천) 를 호출한다

실패
| code | 조건 | 백엔드 처리 |
|------|------|-------------|
| 4xx · 5xx · 형식 오류 | 응답 실패 또는 JSON 형식이 맞지 않음 | 1회 다시 요청 → 또 실패하면 프론트에 502 |

### 2-2. 3D 체험 추천
`POST /ai/v1/experience-recommendation` · 인증: `X-Internal-Key`

요청
```json
{
  "catalog": { "builds": [ ] },
  "situation": "현재 인생 상황 요약",
  "player": { }
}
```
- `catalog` 는 빌드 카탈로그 JSON ([10 4-1](10-prompt-assembly.md#4-1-빌드-카탈로그-json-형식))

응답 (성공)
```json
{
  "code": 200,
  "data": {
    "found": true,
    "buildId": "office-v001",
    "roomId": "office",
    "scenarioId": "career-net-253-office-documents",
    "scenarioVersion": "v001",
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
| 3D 이벤트 다시 보내기 | 최대 3회 | 같은 `eventId` 로 재전송 |
| AI 형식 오류 재요청 | 1회 | |
| 프롬프트에 넣는 대화 | 최근 20턴 | |
