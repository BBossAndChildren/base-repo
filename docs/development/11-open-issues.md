# 11. 미확정 · 불일치 목록 (팀 논의용)

> 결정되면 **결정** 칸을 채우고, 관련 문서를 고친 뒤 [0. 확정](#0-확정되어-문서에-반영한-것) 표로 옮긴다.
> 결정 이유는 [12-decisions.md](12-decisions.md).

## 0. 확정되어 문서에 반영한 것

이전 표는 결정 당시의 기록이다. 아래 최신 상세 기획 확정과 충돌하면 최신 결정을 따른다. 이전 프론트 상태 표시는 현재 구현 범위이며 목표 상태 패널과 구분한다.
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
| 후보 20개 고르는 방식 (A3) | 1단계 점수(희망 직업 · 대화 속 직업 · 관심사) 상위 12개 + 다른 방 무작위 8개. 부족하면 2단계 임베딩 | [10 4-1-1](10-prompt-assembly.md#4-1-1-후보-20개-고르는-방식-be7) |
| 저장소 구성 | `base-repo` 하나에 `frontend/` · `backend/` · `docs/` (모노레포), AI 서버는 별도 저장소. 라벨 · scope 는 AI 도 `be` | [02 3](02-architecture.md#3-디렉터리-구조) · [12 결정 17](12-decisions.md) |
| 플레이 시간 | 약 15분은 **권장 · 예상 시간**이며 강제 제한이 아님 | [00 5장](../00-idea.md#5-진행-속도와-인생-전략) |
| AI 분기 주제 필드 | AI 대화 응답에 `branch`(topic · jobs · reason). 백엔드가 감지해 3D 추천, 프론트가 `experience` 를 감지해 렌더 | [03 2-1](03-api.md#2-1-대화-생성) · [10 4](10-prompt-assembly.md#4-3d-체험-연동) |
| `sessionId` 발급 | 백엔드가 게임 시작 때 발급 | [03 1-2](03-api.md#1-2-게임-시작) |
| `docs/game/` 파일 약속 | 백엔드가 파일 이름 · 역할을 정하고 작가가 내용을 채움. 게임 상태 필드는 작가가 `03-rules.md` 에 정함 | [10 1](10-prompt-assembly.md#1-콘텐츠-파일-읽기-규칙) · [game/README](../game/README.md) |
| 결말 · 추천 방식 | 근거 점수 상위 5개 → AI 가 추천 3개(새 직업 1개 이상) + 결말 (1차안) | [10 7](10-prompt-assembly.md#7-결말--추천-직업-be12--ai5) · [03 2-3](03-api.md#2-3-결말-생성) |
| 프론트 스택 | React + Vite + TypeScript, 백엔드 API 준비 전까지 mock, 상태 패널은 나이 + 자금 · 에너지 (백엔드가 줄 때) | [05](05-ui-ux.md) · [02 1](02-architecture.md#1-기술-스택) |
| 결말 API 미종료 오류 | 409 `NOT_ENDED` 를 따로 둔다 (`ALREADY_ENDED` 와 구분) | [03 결과 코드](03-api.md#결과-코드-목록) |
| 3D 안내 카드 정보 | `experience` 에 `title` · `jobs` · `reason` 추가. [다음에 할게요] 로 건너뛸 수 있음 (API 호출 없음) | [03 1-3](03-api.md#1-3-채팅-한-턴) · [05 화면 2](05-ui-ux.md#화면-2-게임-playplayid) |
| 결말 추천 근거 표시 | `recommendedJobs[].basis` 추가, 결말 생성 중 로딩 화면 | [03 1-5](03-api.md#1-5-결말--추천-직업) · [05 화면 4](05-ui-ux.md#화면-4-결말-playplayidresult) |
| 시작 입력 보기 | 나이 7~99, 지금 상황 7개 보기, 관심사 10개 + 직접 입력(최대 5), 가치관 7개(최대 3) | [03 1-2](03-api.md#1-2-게임-시작) |
| 진행 중 새 게임 | 새 플레이 시작 가능, 이전 플레이는 끝내지 않고 지난 기록에서 이어 하기 | [03 1-2](03-api.md#1-2-게임-시작) · [05 화면 1](05-ui-ux.md#화면-1-시작-) |
| 3D 종료 대기 화면 | "저장하는 중…" → 5초 무응답 시 미수신 기록 + 토스트 후 텍스트 복귀 | [05 화면 3](05-ui-ux.md#화면-3-3d-체험-게임-화면-위-전체-화면) |
| 재개 응답의 `sessionId` | 플레이 재개(1-7) 응답에도 `sessionId` 를 준다 (다른 기기에서 이어 할 때 3D 연동용) | [03 1-7](03-api.md#1-7-플레이-재개) |
| 메시지 `role` | 메시지에 `role`(user · npc · narrator) 추가. 재개 때 내 말과 NPC 말을 구분 | [03 메시지 형식](03-api.md#메시지-형식) |
| Unity 연결 코드 사용 | 빌드의 `frontend/client.js` 를 실행 시 불러옴, 빌드 서버 `/builds/` CORS 허용 | [05 4-1](05-ui-ux.md#4-1-3d-체험-연결-unity) · [06 5-1](06-deployment.md#5-1-백엔드-서버-처음-세팅) · [12 결정 23](12-decisions.md) |
| 디자인 | 인트로 디자인 토큰을 앱 전체에 적용, 기존 그림책 시안 폐기, Pretendard | [docs/design/](../design/README.md) · [05 1절](05-ui-ux.md#1-디자인-시스템) · [12 결정 26](12-decisions.md) |
| 인트로 (FE11) | Unity 담당 인트로를 원본 그대로 흡수, 첫 방문만 + 건너뛰기, 에셋은 서버 `/intro-assets/` | [05 화면 0](05-ui-ux.md#화면-0-인트로-intro-선택) · [06 5-2-1](06-deployment.md#5-2-1-인트로-에셋) · [12 결정 25](12-decisions.md) |

### 2026-10-31 상세 기획 확정

| 항목 | 결정 | 반영 위치 |
|---|---|---|
| 게임 기획 기준 | 인생·직업 상세 기획을 한 문서로 보관 | game/06 · 03 · 10 |
| 자금·상태·화면 | 원화 자금·빚·건강·에너지·스트레스 및 상황별 주거·성장 표시 | 03 · 04 · 05 |
| NPC 기억 | 직접 알거나 전달받은 사실만 사용, 배경 대화는 사건/시간 경과 기준 | 04 · 10 |
| 임베딩 | BGE-M3 | 02 · 10 |
| 턴 확정·재개 | 검증 후 일괄 저장, 중복 적용 방지, 마지막 확정 지점 재개 | 02 · 03 · 04 · 05 |

## A. 스펙 미확정 항목
| # | 항목 | 선택지 | 추천안 · 이유 | 결정 |
|---|------|--------|---------------|------|
| A4 | RAG 구성 (벡터 DB · Qwen 크기) | | AI 담당이 구현 시 결정. 임베딩은 BGE-M3로 확정 | |
| A5 | 인트로 모바일 지원 범위 | 그대로 재생 / 모바일은 건너뛰고 시작 화면 | 원본이 모바일 미검증 · 238MB. 실제 기기(B10)로 확인 후 결정, 그 전까지는 그대로 재생 + 건너뛰기 | |

## B. 팀 · 협업 규칙 불일치
| # | 내용 | 결정 |
|---|------|------|
| B1 | **`backend.md`(백엔드 담당 구현 계획)가 예전 API 기준이다.** ① 기능 번호가 [features.md](features.md) 와 다르다 (예: 3D 이벤트 = backend.md BE4 / features BE8). ② 3D API 주소가 예전 것이다 (`experiences/{experienceId}/events` → 현재 `experience-events`, `experiences/reconcile` → `experience-reconcile`, heartbeat 동일). ③ 이후 추가된 미수신 기록(03 1-10), 결말 생성(03 2-3), AI 응답 `branch`, 게임 시작 `sessionId`, 3D API 응답 비포장이 빠져 있다. 백엔드 담당이 features.md · 03 기준으로 맞춘다 (다른 담당 영역이라 문서 총괄이 고치지 않음, 링크 경로만 수정) | |
| | | |

## C. 없는 파일 · 깨진 참조
| # | 위치 | 내용 |
|---|------|------|
| C1 | `docs/unity/docs/bridge-v003.md` | `../builds/career-suite-v002.md` 를 가리키지만 파일이 없다. Unity 담당 영역이라 기록만 한다 (2026-11-01 재점검) |
| C2 | `docs/unity/webgl/BUILD.md` | git 에서 제외된 로컬 빌드 폴더의 문서라 `career-suite-v002.md` 등 5개 링크가 저장소에 없는 파일을 가리킨다. 저장소에는 올라가지 않으므로 영향 없음, 기록만 한다 |

## E. 코드와 문서 차이
| # | 문서 | 코드 | 처리 |
|---|------|------|------|
| E1 | 03·04·05·10의 최신 상세 기획 반영 설계 | 백엔드는 health 기반, 프론트는 기존 mock·상태 표시 | 게임 상태·NPC 기억·멱등 턴·일시정지 구현이 완료됐다고 간주하지 않음 |
| E2 | 06 5-1 ⑤ · 5-2-1 은 호스트 Nginx 설정 예시, 허용 출처 `https://base-repo-zeta.vercel.app` | 백엔드(#83)는 Docker 게이트웨이 `backend/deploy/nginx.conf` + `compose.gateway.yaml`(기본 `127.0.0.1:8080`)로 구현, 허용 출처는 아직 `https://base-repo-ck83.vercel.app` | 실제 설정의 기준은 `backend/deploy/nginx.conf`. 허용 출처를 새 Vercel 주소로 바꾸는 작업은 백엔드 담당 (#86), 어느 주소를 쓸지는 F11 |

## F. 확인이 필요한 질문
| # | 질문 | 답 |
|---|------|----|
| F11 | **Vercel 프로젝트가 두 개다** — `base-repo` (https://base-repo-zeta.vercel.app, 2026-11-01 배포 주소로 사용) · `base-repo-ck83` (이전 주소). 하나만 남길지, 둘 다 쓸지? 둘 다 쓰면 CORS · Nginx 허용 출처를 둘 다 넣어야 한다 ([06 5-4](06-deployment.md#5-4-웹-프론트--vercel)) | |
| F10 | 최신 상태 계약 구현 | 기획은 `06-life-career-design.md`, API·DB 반영 설계는 03·04 참조. 원화 자금·빚·건강·스트레스·주거·성장 및 기억/턴 원자성 구현은 후속 작업. 현재 프론트의 기존 상태 표시와 구분 |
| F9 | 백엔드 서버에서 GPU 서버로 사설망 접속이 되는가? (`curl` 확인 — 되면 AI 터널 불필요) | |
| F7 | 백엔드 저장소 주소 · AI 서버 사설 IP · 포트 · OS (06 의 TODO) | |
