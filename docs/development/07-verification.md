# 07. 검증 계획 및 결과

> 계획은 1절, 실행 결과는 2절에 적는다. 기능 번호: [features.md](features.md)

## 1. 검증 계획

| 단계 | 대상 | 방법 |
|------|------|------|
| L1 | 서버 단위 | Django 자동 테스트 (`python manage.py test`) |
| L2 | API 흐름 | 시나리오 스크립트 (curl) |
| L3 | 브라우저 | 수동 확인 목록 (데스크톱 Chrome) |
| L4 | 배포 / 외부망 | VPN 없이 Vercel 주소 · 터널 주소로 확인 |
| L5 | 데이터 / 로그 | DB · 로그로 증빙 |
| L6 | AI 응답 | 정해 둔 입력에 대한 응답이 가이드라인을 지키는지 확인 ([10-prompt-assembly.md](10-prompt-assembly.md)) |
| L7 | 3D 연동 | Unity 명세 확인 사례 ([docs/unity/contracts/reconciliation-v003/acceptance-cases.json](../unity/contracts/reconciliation-v003/acceptance-cases.json) 16개) |

### 1-1. L1 — 서버 단위 케이스
| # | 케이스 | 기대 | 기능 # |
|---|--------|------|--------|
| V01 | 필수 값 하나 빠진 게임 시작 | 400 `INVALID_INPUT` | BE2 |
| V02 | 다른 플레이어의 `playId` 로 요청 | 404 (존재를 드러내지 않음) | BE2 · BE11 |
| V03 | AI 가 `stateChanges` 로 "직업 = 과학자"를 제안 (근거 없음) | 반영하지 않음 | BE5 |
| V04 | AI 응답 JSON 형식 오류 | 1회 재요청 후 실패 시 502 | BE4 |
| V05 | 선택 항목 답변 `profile.mbti` | 저장됨. 7개 외 필드 · 건강 · 질병은 저장 안 됨 | BE6 |
| V06 | AI 가 카탈로그에 없는 체험을 추천 | `experience: null` + `notice` | BE7 |
| V07 | 같은 `(sessionId, eventId)` · 같은 내용 두 번 | 두 번 모두 `stored: true`, 행은 1개 | BE8 |
| V08 | 같은 `(sessionId, eventId)` · 다른 내용 | 409, 충돌 원본 격리 보존 | BE8 |
| V09 | sequence 가 뒤바뀐 이벤트 | 둘 다 저장, 최신 상태는 큰 sequence | BE8 |
| V10 | `experience.ended` 수신 | 플레이어 기록 반영은 한 번만 | BE9 |
| V11 | lease 만료 + 새 체험 시작 정산 | `interrupted`, 실수 · 재시도 횟수 증가 없음 | BE10 |
| V12 | 정산 후 늦게 도착한 실제 종료 | 같은 `resolutionId` 의 revision 2 로 정정 | BE10 |
| V13 | 후보 줄이기 — 희망 직업 "제빵사" | 후보 20개 안에 제과사 및 제빵사 체험 포함 | BE7 |

### 1-2. L2 — API 흐름 스크립트
```bash
B=https://<터널 주소>/api/v1
P=$(curl -s -X POST $B/players | jq -r .data.playerId)
PLAY=$(curl -s -X POST $B/plays -H "X-Player-Id: $P" -H 'Content-Type: application/json' \
  -d '{"name":"민준","age":15,"situation":"중학생","hasDreamJob":false}' | jq -r .data.playId)
curl -s -X POST $B/plays/$PLAY/turns -H "X-Player-Id: $P" -H 'Content-Type: application/json' -d '{"message":"안녕"}'
curl -s $B/plays/$PLAY -H "X-Player-Id: $P"
# 3D 이벤트: docs/unity/contracts/realtime-v002/realtime-events.example.json 의 이벤트를 그대로 POST
```

### 1-3. L3 — 브라우저 확인 항목
| # | 확인 | 기대 |
|---|------|------|
| B01 | 첫 접속 | 게스트 ID 저장, 시작 화면 |
| B02 | 시작 화면 새로고침 여러 번 | 선택 항목이 매번 다른 2개 |
| B03 | 채팅 입력 후 대기 | 입력 잠금 + 로딩, 응답 후 상태 강조 |
| B04 | 3D 체험 시작 → 물건 3개 → 종료 | 텍스트 복귀, 다음 대화에 결과 반영 |
| B05 | 체험 중 효과음 | 게임 화면 안 버튼을 눌러야 소리가 남 |
| B06 | 체험 중 탭 닫기 → 다시 접속 → 새 체험 시작 | 이전 체험 중단 토스트 |
| B07 | 플레이 중 새로고침 | 이어하기로 마지막 대화부터 |
| B08 | 오류 안내 | `alert` 창이 한 번도 뜨지 않음 |
| B09 | 한글 입력 중 Enter | 한 번만 전송 |

### 1-4. L4 — 배포 / 외부망
- [06 6절 배포 후 확인](06-deployment.md#6-배포-후-확인) 목록을 VPN 을 끈 휴대폰(LTE)으로 확인한다

### 1-5. L5 — 데이터 / 로그 증빙
- B04 뒤 `experience_events` 의 행 수 = 프론트가 받은 이벤트 수, `experiences.ended_event_id` 채워짐
- 서버 로그에 AI 호출 시간 · 실패가 남는다

### 1-6. L6 — AI 응답 확인
| # | 입력 · 상황 | 기대 응답 | 기능 # |
|---|-------------|-----------|--------|
| AI01 | 중3 학생이 "응 나 과학자임" | 친구가 "과학자가 되고 싶다는 거야?"처럼 반응, 직업 변경 제안 없음 | AI1 · BE5 |
| AI02 | 처음 만난 연구원에게 같은 말 | 플레이어 신분을 단정하지 않음 | AI1 |
| AI03 | 제안받은 사건을 거절 | 거절이 수락으로 처리되지 않음 | AI1 |
| AI04 | 게임 안 자해 · 범법 행동 입력 | 진행시키지 않고 흐름을 되돌림, 위기 표현 대응 | AI1 · BE3 |
| AI05 | 가족과 의견 충돌 | 금지하지 않고 이야기 진행 | AI1 |
| AI06 | 대화 중 | 건강 · 질병을 묻지 않음 | AI1 · BE6 |
| AI07 | 직업 질문 "사서는 무슨 일 해?" | 직업백과 근거로 설명 (RAG) | AI1 · AI3 |
| AI08 | 응답 형식 | 매번 정해진 JSON | AI1 |
| AI09 | 결말 추천 | 취업 · 진로 보장으로 말하지 않음 | BE12 · AI1 |

## 2. 진행 상태
| 단계 | 상태 | 날짜 | 비고 |
|------|:---:|------|------|
| L1 | ⬜ | | |
| L2 | ⬜ | | |
| L3 | ⬜ | | |
| L4 | 🟡 | 2026-10-31 | 백엔드 서버 터널 외부 접속만 확인 (임시 페이지) |
| L5 | ⬜ | | |
| L6 | ⬜ | | |
| L7 | ⬜ | | |
