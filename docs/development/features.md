# 기능 리스트

> [00-idea.md](../00-idea.md) 기준 기능 명세. **우리가 만들어야 하는 목록**이다.
> 구조: 웹 프론트(FE, `frontend/`) · 백엔드(BE, `backend/`) · AI 서버(AI, 별도 저장소). BE = Django + DRF · PostgreSQL, FE = Vercel 배포, AI = Qwen + RAG
> API 상세: [03-api.md](03-api.md) · DB 상세: [04-database.md](04-database.md) · 미확정: [11-open-issues.md](11-open-issues.md)

## 0. 구조 결정 근거

| 항목 | 결정 | 근거 |
|------|------|------|
| 서버 구성 | 웹 프론트 · 백엔드 · AI 서버 3분할 | [00-idea.md 서비스 구조](../00-idea.md#서비스-구조-회의-결정) |
| 인증 | 로그인 없는 게스트 (`X-Player-Id`) | 해커톤 · 짧은 플레이(권장 15분)라 가입 단계를 없앤다 ([03 인증](03-api.md#인증-방식)) |
| 공통 지침 | 시나리오 · 가이드라인 마크다운을 매 AI 요청에 고정으로 넣음 | 게임이 범위를 벗어나지 않게 하는 하네스 ([12 결정 3](12-decisions.md)) |
| 상태 변경 | AI 는 제안만, 백엔드가 확인 후 반영 | 말만으로 직업이 바뀌는 등 근거 없는 변경 방지 ([12 결정 6](12-decisions.md)) |
| 3D 체험 | Unity 카탈로그 555개 중 백엔드가 후보 20개 → AI 가 선택 | [12 결정 16 · 18](12-decisions.md) |
| 직업 지식 | AI 서버 RAG | [12 결정 15](12-decisions.md) |
| 저장소 | `base-repo` 하나에 `frontend/` · `backend/` · `docs/`, AI 는 별도 저장소 | [12 결정 17](12-decisions.md) |

## 1. 백엔드 (BE)

| # | 기능 | 설명 | 우선순위 |
|---|------|------|:---:|
| BE1 | 게스트 플레이어 발급 | `playerId` 발급 ([03 1-1](03-api.md#1-1-게스트-플레이어-발급)) | 필수 |
| BE2 | 게임 시작 | 필수 4개 입력 검증, 플레이 생성, 첫 장면 생성 ([03 1-2](03-api.md#1-2-게임-시작)) | 필수 |
| BE3 | 공통 지침 문서 로딩 | `docs/game/` 시나리오 · 가이드라인을 읽어 매 AI 요청에 고정 첨부 ([10 1 · 2절](10-prompt-assembly.md#1-콘텐츠-파일-읽기-규칙)) | 필수 |
| BE4 | 채팅 턴 처리 | 프롬프트 조립 → AI 대화 생성 호출 → 응답 JSON 검증 → 결과 저장. 응답의 `branch`(3D 분기) 감지 시 BE7 ([03 1-3](03-api.md#1-3-채팅-한-턴)) | 필수 |
| BE5 | 상태 변경 확인 · 반영 | AI 의 `stateChanges` 제안을 가이드라인 · 현재 상태로 확인한 뒤 반영. 말만으로 직업 변경 금지 ([10 3절](10-prompt-assembly.md#3-ai-응답-처리)) | 필수 |
| BE6 | 선택 입력 대화 수집 | 비어 있는 선택 항목을 프롬프트에 알리고, 답하면 `profile.*` 저장. 건강 · 질병은 저장하지 않음 | 선택 |
| BE7 | 3D 체험 후보 선정 · 추천 | 카탈로그에서 후보 20개 선정(A3 방식) → AI 추천 호출 → 허용 목록 검증 → `buildUrl` 생성 ([10 4-1](10-prompt-assembly.md#4-1-빌드-카탈로그-unity-제공)) | 필수 |
| BE8 | 3D 이벤트 저장 | Unity 원본 저장, `(sessionId, eventId)` 중복 제거 · 충돌 격리, 저장 후 ACK ([03 1-4](03-api.md#1-4-3d-체험-이벤트-전달)) | 필수 |
| BE9 | 체험 결과 반영 | `experience.ended` 를 받으면 플레이어 기록에 한 번 반영, 다음 턴 프롬프트에 포함 | 필수 |
| BE10 | 종료 미수신 처리 | 미수신 기록 · 생존 신호(lease) · 새 체험 시작 때 정산 (v003) ([03 1-8~1-10](03-api.md#1-8-종료-응답-없는-체험-정산)) | 필수 |
| BE11 | 플레이 재개 | 현재 상태 · 최근 대화 반환 ([03 1-7](03-api.md#1-7-플레이-재개)) | 필수 |
| BE12 | 결말 · 추천 직업 | 인생 종료 시 근거 점수로 후보 5개 → AI 결말 생성 → 저장 ([10 7절](10-prompt-assembly.md#7-결말--추천-직업-be12--ai5), [03 1-5](03-api.md#1-5-결말--추천-직업)) | 필수 |
| BE13 | 지난 플레이 기록 | 반복 플레이 기록 목록 ([03 1-6](03-api.md#1-6-지난-플레이-기록)) | 선택 |
| BE14 | 3D 빌드 제공 | 서버 `/srv/builds/` 를 Nginx 로 제공 (배포 작업, [06 5-2](06-deployment.md#5-2-3d-빌드-파일-저장--관리--전달)) | 필수 |

## 2. AI 서버 (AI)

| # | 기능 | 설명 | 우선순위 |
|---|------|------|:---:|
| AI1 | 대화 생성 | 지침 · 플레이어 기록 · 최근 20턴 · 입력으로 정해진 JSON 응답 ([03 2-1](03-api.md#2-1-대화-생성)) | 필수 |
| AI2 | 3D 체험 추천 | 후보 20개 중 상황에 맞는 하나 또는 `found: false` ([03 2-2](03-api.md#2-2-3d-체험-추천)) | 필수 |
| AI3 | 직업 데이터 RAG | BGE-M3로 직업백과 및 보강 자료를 검색해 대화 · 추천에 근거로 붙임 ([10 6절](10-prompt-assembly.md#6-직업-데이터-rag-ai-서버)) | 필수 |
| AI4 | 내부 키 검사 | `X-Internal-Key` 없으면 401 | 필수 |
| AI5 | 결말 생성 | 후보 5개 중 추천 3개(새 직업 1개 이상) · 결말 문장 ([03 2-3](03-api.md#2-3-결말-생성)) | 필수 |

## 3. 웹 프론트 (FE)

| # | 기능 | 설명 | 우선순위 |
|---|------|------|:---:|
| FE1 | 게스트 ID 보관 | 첫 접속 때 발급받아 localStorage 보관, 모든 요청 헤더에 첨부 | 필수 |
| FE2 | 시작 화면 | 필수 4개 + 선택 항목 랜덤 2개(건너뛰기 가능) ([05 화면 1](05-ui-ux.md#화면-1-시작-)) | 필수 |
| FE3 | 채팅 화면 | 메시지 표시, 입력, 30초 대기 안내, 힌트 표시 | 필수 |
| FE4 | 상태 표시 | 나이·원화 자금·빚·건강·에너지·스트레스와 확정된 변화 표시. 주거·성적/자기계발은 해당할 때 표시 | 필수 |
| FE5 | 3D 체험 화면 | Unity 연결 코드를 참고해 iframe 체험 시작 · 종료, 효과음 안내, 배경색 ([05 4-1](05-ui-ux.md#4-1-3d-체험-연결-unity)) | 필수 |
| FE6 | 3D 이벤트 전송 | 전송 큐 · 생존 신호 · 정산 · 미수신 기록을 백엔드 API 로 연결 | 필수 |
| FE7 | 오류 안내 | 토스트 · 모달 (`alert` 금지) ([10 4-4](10-prompt-assembly.md#4-4-오류-안내-문구)) | 필수 |
| FE8 | 이어하기 | 새로고침 · 재접속 시 진행 중 플레이 재개 | 필수 |
| FE9 | 결말 화면 | 결말 · 추천 직업 · 다시 하기 | 필수 |
| FE10 | 지난 기록 화면 | 지난 플레이 목록 | 선택 |
| FE11 | 인트로 | 첫 방문 때 직업 공간 3D 인트로(React + Three.js, 24초) 재생, 건너뛰기 · 다시 보기, 실패 시 시작 화면 ([05 화면 0](05-ui-ux.md#화면-0-인트로-intro-선택)) | 선택 |

## 4. DB 구조 (요약)
상세는 [04-database.md](04-database.md).

| 테이블 | 핵심 필드 |
|--------|-----------|
| `players` | id |
| `plays` | id, player_id, profile(JSON), state(JSON), ended |
| `messages` | play_id, turn, speaker, text |
| `experiences` | experience_id, play_id, build · room · scenario, lifecycle_status, lease_expires_at, result_summary |
| `experience_events` | (session_id, event_id) 고유, payload(JSON), sequence, type |
| `experience_resolutions` | resolution_id, revision, payload(JSON) |

## 5. API 요약
상세는 [03-api.md](03-api.md).

| 구간 | Method | Path | 설명 | 기능 # |
|------|--------|------|------|--------|
| FE → BE | POST | `/api/v1/players` | 게스트 발급 | BE1 · FE1 |
| FE → BE | POST | `/api/v1/plays` | 게임 시작 | BE2 · FE2 |
| FE → BE | GET | `/api/v1/plays/{playId}` | 재개 | BE11 · FE8 |
| FE → BE | POST | `/api/v1/plays/{playId}/turns` | 채팅 한 턴 | BE3~BE7 · FE3 · FE4 |
| FE → BE | POST | `/api/v1/plays/{playId}/experience-events` | 3D 이벤트 | BE8 · BE9 · FE6 |
| FE → BE | POST | `/api/v1/plays/{playId}/experience-reconcile` | 정산 | BE10 · FE6 |
| FE → BE | POST | `/api/v1/plays/{playId}/experience-heartbeat` | 생존 신호 | BE10 · FE6 |
| FE → BE | POST | `/api/v1/plays/{playId}/experience-pending` | 미수신 기록 | BE10 · FE6 |
| FE → BE | GET | `/api/v1/plays/{playId}/result` | 결말 | BE12 · FE9 |
| FE → BE | GET | `/api/v1/players/me/plays` | 지난 기록 | BE13 · FE10 |
| BE → AI | POST | `/ai/v1/chat` | 대화 생성 | AI1 · AI3 |
| BE → AI | POST | `/ai/v1/experience-recommendation` | 3D 추천 | AI2 · AI3 |
| BE → AI | POST | `/ai/v1/ending` | 결말 생성 | AI5 · AI3 |

## 6. 공통 / 산출물
- 서버 로그 (요청 · AI 호출 · 저장 성공 / 실패) — [03 N절](03-api.md#n-서버-로그-이벤트-규약)
- 테스트: BE 단위 · API 흐름, AI 응답 검증 ([07](07-verification.md))
- 배포 문서 · Nginx 설정 · 터널 실행 ([06](06-deployment.md))
- 발표 PDF · 시연 영상 ([final-checklist.md](../final-checklist.md))

## 7. 요구사항 대조
상세는 [08-checklist.md](08-checklist.md).

| 요구사항 | 충족 기능 |
|----------|-----------|
| AI 기반 추천 서비스 (대회 주제) | BE7 · BE12 · AI2 · AI3 · AI5 |
| 한 번의 플레이 약 15분 (권장, 강제 아님) | BE4 (시간 진행 규칙은 `docs/game/03-rules.md`) |
| 텍스트 진행 + 분기에서 3D 체험 | FE3 · FE5 · BE7 |
| 자유 텍스트 입력과 상태 구분 | BE4 · BE5 · AI1 |
| 세이프가드 (자해 · 범법 차단) | BE3 · AI1 |
| 희망 직업 있음 / 없음 두 경로 | BE2 · FE2 |
| 직업백과 근거 · 진로 보장으로 말하지 않음 | AI3 · BE12 |
| 3D 체험 성과를 이후 사건에 반영 | BE8 · BE9 |
| 반복 플레이 | FE9 · BE13 |

## 8. 상세 기획 반영 범위 (2026-10-31)

기획 근거: [인생·직업 게임 상세 기획](../game/06-life-career-design.md). 기존 기능 번호를 유지하고 해당 기능을 아래 범위로 확장한다. 문서 반영은 구현 완료를 뜻하지 않는다.

| 기능 | 추가 요구사항 |
|---|---|
| BE4 · AI1 | 반복 일상 압축과 경과 요약, 큰 기간 경과 전 확인, 핵심 업무 체험과 관대한 의도 기반 판정, 막힐 때 NPC 힌트 |
| BE5 | 원화 자금·부채·미납·주거, 건강·스트레스·에너지, 성장 상태의 규칙 검증. 자금 부족 시 해결 선택 전 자동 마이너스/대출 금지 |
| BE4 · BE5 | 월 단위 수입·지출과 상태를 순차 처리하고 중요한 선택에서 정지. 퇴사 등 이전 활동의 마무리와 이후 경로 반영 |
| BE3 · AI1 · AI3 | 직접 듣거나 전달받은 사실만 NPC에 공개, 시간 경과/중요 사건에 따른 배경 전달과 감정·해석 기록 |
| BE4 · BE11 · FE3 · FE8 | 턴 요청 중복 방지, 마지막 확정 상태에서 재개, 명시적 일시정지와 화면 비활성 구간 제외 |
| AI1 · AI3 | 관심·실제 경험을 참고한 선제적 진로 기회, 모르는 직업의 자연스러운 대안 제시, 취업 준비·재도전 경로 |
| BE7 · BE9 · AI2 | 실행 가능한 3D만 제안하고 실제 결과로 후속 대화. 실행 실패는 업무 실패나 성공으로 꾸미지 않음 |
| BE12 · AI5 · FE9 | 캐릭터 사망 후 선택·직업·도전·관계를 이야기로 회고. 진로 적성의 확정 판정 금지 |
