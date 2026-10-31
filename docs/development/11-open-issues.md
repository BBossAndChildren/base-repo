# 11. 미확정 · 불일치 목록 (팀 논의용)

> 결정되면 **결정** 칸을 채우고, 관련 문서를 고친 뒤 [0. 확정](#0-확정되어-문서에-반영한-것) 표로 옮긴다.
> 결정 이유는 [12-decisions.md](12-decisions.md).

## 0. 확정되어 문서에 반영한 것
| 항목 | 결정 | 반영 위치 |
|------|------|-----------|
| 3D 체험 결과 형식 | Unity 담당 명세 career-experience v001 을 따른다 | [10 4-2](10-prompt-assembly.md#4-2-체험-결과값-형식-unity--프론트) |
| 3D 결과 전달 방식 | Unity 가 상태 변경마다 실시간으로 보내고, 프론트는 즉시 백엔드로 전달, 종료 때 한 번 플레이어 기록에 반영 (안 A) | [10 4-3](10-prompt-assembly.md#4-3-프론트--백엔드-전달) · [12 2](12-decisions.md) |
| 3D 에셋 지정 | 에셋은 따로 지정하지 않는다. Unity 가 직업별 장면을 시나리오로 구성하므로 방 · 시나리오만 고른다 | [10 4](10-prompt-assembly.md#4-3d-체험-연동) · [00 서비스 구조](../00-idea.md#서비스-구조-회의-결정) |
| 데이터 저장 범위 | 공통 지침 문서는 백엔드 한곳, 플레이어 기록은 DB 에 플레이어별 | [10 2](10-prompt-assembly.md#2-프롬프트-조립-순서) · [00 데이터 저장](../00-idea.md#데이터-저장-회의-결정) |
| API 공통 규약 | 응답 `{code, data}` / `{code, error}` · camelCase · ISO 8601 · UUID · `/api/v1` | [03 0](03-api.md#0-공통-규약) |
| 프론트 ↔ 백엔드 | 게스트 방식(`X-Player-Id`) · 채팅은 한 번에 응답 · 채팅 30초 · 3D 이벤트 재전송 3회 | [03 1부](03-api.md#1부-프론트--백엔드) |
| 3D 빌드 전달 | 백엔드는 빌드 파일 주소를 주고 프론트가 불러온다 | [03 1-3](03-api.md#1-3-채팅-한-턴) · [10 4](10-prompt-assembly.md#4-3d-체험-연동) |
| 백엔드 ↔ AI 서버 | AI 응답은 정해진 JSON · 최근 20턴 · 형식 오류 1회 재요청 · 내부 키 `X-Internal-Key` | [03 2부](03-api.md#2부-백엔드--ai-서버) · [10 3](10-prompt-assembly.md#3-ai-응답-처리) |
| 빌드 카탈로그 · 플레이어 기록 형식 | 카탈로그 JSON 항목과 플레이어 기록 항목 | [10 4-1](10-prompt-assembly.md#4-1-빌드-카탈로그-unity-제공) · [10 5](10-prompt-assembly.md#5-플레이어-기록-항목) |
| 백엔드 기술 스택 · DB | Python · Django + DRF · HTTPX · **PostgreSQL** · Gunicorn, 네이버 클라우드 배포 (백엔드 담당 결정) | [02 1](02-architecture.md#1-기술-스택) · [06](06-deployment.md) |
| 게임 시작 입력 항목 | 필수 4개 + 선택 7개 (시작 때 랜덤 2개, 나머지는 게임 중 대화로 하나씩). 건강 · 질병은 받지도 유도하지도 않음, 가족관계 · 반려동물은 받지 않음 | [00 게임 시작 입력](../00-idea.md#게임-시작-입력-회의-결정) · [03 1-2](03-api.md#1-2-게임-시작) · [10 3](10-prompt-assembly.md#3-ai-응답-처리) |
| 3D 빌드 파일 위치 | 백엔드 서버 폴더(`/srv/builds/`) + Nginx 가 내려줌. Git 저장소에는 넣지 않음 | [06 5-2](06-deployment.md#5-2-3d-빌드-파일-저장--관리--전달) |
| 웹 프론트 배포 | Vercel (SSL 자동) | [06 5-4](06-deployment.md#5-4-웹-프론트--vercel) |
| 백엔드 외부 공개 | 제공 서버는 사설 IP · VPN 전용이라 도메인 없이 **Cloudflare Tunnel** 로 공개 (SSL 은 Cloudflare). 서버 바깥 연결 확인 완료. AI 서버는 비공개 | [06 0절](06-deployment.md#0-배포-환경-한눈에) · [06 5-1](06-deployment.md#5-1-백엔드-서버-처음-세팅) |
| CORS 담당 | 백엔드(Django · django-cors-headers)가 붙이고 프론트는 설정하지 않음. 빌드 iframe 은 `frame-ancestors` 로 허용 | [06 CORS](06-deployment.md#cors--django-가-담당) · [05 4](05-ui-ux.md#4-api-호출-공통-모듈) |
| 실제 방 · 시나리오 목록 | `PAN-NNN` 방 ID, 71개 방 · 555개 조합 (buildId `career-suite-integration-v005`). 체험별 `jobs` · `description` 포함 | [docs/unity/USAGE.md](../unity/USAGE.md) |
| 실시간 이벤트 형식 | Unity 명세 `docs/unity/contracts/realtime-v002/realtime-contract.json` (실시간 전달 필수) | [10 4-2](10-prompt-assembly.md#4-2-체험-결과값-형식-unity--프론트) |
| 빌드 압축 방식 | 현재 테스트 빌드는 비압축 | [06 5-1](06-deployment.md#5-1-백엔드-서버-처음-세팅) |
| 이벤트 저장 확인 · 재전송 | 백엔드는 저장 후 `{stored, sessionId, eventId}`, 프론트 전송 큐는 확인까지 2초마다 재전송 | [03 1-4](03-api.md#1-4-3d-체험-이벤트-전달) |
| 종료 응답 없는 체험 정산 | Unity 명세 v003 을 따름: 새 체험 시작 때 정산, heartbeat 30초 · lease 120초 (기존 "재개 시 처리"를 대체) | [10 4-5](10-prompt-assembly.md#4-5-종료-응답이-오지-않은-체험-정산-v003) · [03 1-8 · 1-9](03-api.md#1-8-종료-응답-없는-체험-정산) |
| 체험 설명 (AI 선택 근거) | Unity 담당이 555개 조합 모두에 `jobs` · `description` 제공 — `docs/unity/builds/production-ai-build-catalog.json` | [10 4-1](10-prompt-assembly.md#4-1-빌드-카탈로그-unity-제공) |
| 추천 범위 · 후보 줄이기 | 555개 전부 허용, 백엔드가 희망 직업 · 관심사로 후보 약 20개로 줄여 AI 에 전달 | [10 4-1](10-prompt-assembly.md#4-1-빌드-카탈로그-unity-제공) · [03 2-2](03-api.md#2-2-3d-체험-추천) |
| Unity 어댑터에 API 맞춤 | 이벤트는 원본 그대로 받고 응답은 감싸지 않음, `credentials: 'omit'`, 미수신 기록 API(1-10) 추가 | [03 1-4](03-api.md#1-4-3d-체험-이벤트-전달) · [05 4-1](05-ui-ux.md#4-1-3d-체험-연결-unity) |
| 직업 데이터 | AI 서버(Qwen)에 RAG 로 552개 직업 데이터를 넣음 (A2 해결) | [10 6](10-prompt-assembly.md#6-직업-데이터-rag-ai-서버) |
| 터널 공개 규정 | 괜찮은 것으로 확인 (F6 해결) | [06 0](06-deployment.md#0-배포-환경-한눈에) |

## A. 스펙 미확정 항목
| # | 항목 | 선택지 | 추천안 · 이유 | 결정 |
|---|------|--------|---------------|------|
| A3 | 후보 약 20개를 고르는 방식 | 단어 일치 / 임베딩 유사도 | AI 서버에 임베딩이 있으니 재사용 가능. 처음엔 `jobs` 단어 일치로 시작 | |
| A4 | RAG 구성 (벡터 DB · 임베딩 모델 · Qwen 크기) | | AI 담당 결정 | |

## B. 팀 · 협업 규칙 불일치
| # | 내용 | 결정 |
|---|------|------|
| | | |

## C. 없는 파일 · 깨진 참조
| # | 위치 | 내용 |
|---|------|------|
| | | |

## E. 코드와 문서 차이
| # | 문서 | 코드 | 처리 |
|---|------|------|------|
| | | | |

## F. 확인이 필요한 질문
| # | 질문 | 답 |
|---|------|----|
| F8 | 새 실서비스 빌드 `career-suite-integration-v005.zip` 을 받아 `docs/unity/webgl/` 을 교체 (지금은 예전 `career-pilot-v007`) | |
| F9 | 백엔드 서버에서 GPU 서버로 사설망 접속이 되는가? (`curl` 확인 — 되면 AI 터널 불필요) | |
| F7 | 백엔드 저장소 주소 · AI 서버 사설 IP · 포트 · OS (06 의 TODO) | |
