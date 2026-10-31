# 어른왕자 — 생성형 AI 인생·직업 시뮬레이션 게임

> 수많은 인생을 재미있게 살아 보며, 내가 원하는 삶과 일을 발견하는 생성형 AI 게임. 대회 주제: AI 기반 추천 서비스.
> 문서 폴더 안내: [docs/README.md](docs/README.md) · 아이디어 원문: [docs/00-idea.md](docs/00-idea.md)

## 1. 프로젝트 개요
### 문제 정의
"하고 싶은 게 없어"라고 말하는 사람은 다양한 직업을 접해 볼 기회가 부족하다. 이 게임은 텍스트 대화로 인생을 진행하다가 중요한 분기에서 3D 직업 체험을 하고, 경험을 바탕으로 관련 직업과 다음 준비 방향을 추천한다. 자세히: [01-user-flow.md](docs/development/01-user-flow.md)

### 타겟 사용자
희망 직업이 없는 학생 · 희망 직업은 있지만 실제 업무를 모르는 학생 · 진로를 다시 고민하는 성인

### 핵심 시나리오
시작 입력(필수 4개) → 채팅으로 인생 진행 (최대 15분) → 분기에서 3D 직업 체험 (물건 3개 상호작용) → 체험 결과가 이야기에 반영 → 결말 · 추천 직업 → 다른 인생 다시 하기

## 2. 기술 스택
| 구분 | 기술 |
|------|------|
| 웹 프론트 | React · Vite · TypeScript · Three.js(인트로), Vercel 배포 (https://base-repo-zeta.vercel.app/) |
| 백엔드 | Python · Django + DRF · PostgreSQL · HTTPX · Gunicorn · Nginx |
| AI 서버 (별도 저장소) | 오픈소스 Qwen + 직업 데이터 RAG (Django 와 같은 GPU 서버에서 실행) |
| 3D 체험 | Unity WebGL (Unity 담당 전달, [docs/unity/USAGE.md](docs/unity/USAGE.md)) |
| 배포 | **GPU 서버 한 대**(Django · PostgreSQL · AI API · 게이트웨이) + Cloudflare Tunnel, Vercel |

## 3. 시스템 구조
```
브라우저 ─▶ Vercel (프론트)
   └─ https ─▶ Cloudflare Tunnel ─▶ GPU 서버 게이트웨이 ─┬─ /api/    → Django ──내부 호출──▶ Qwen AI API (같은 서버)
                                                        ├─ /builds/ → Unity WebGL 빌드
                                                        └─ /intro-assets/ → 인트로 3D 모델
```
GPU 서버 한 대 운영 (2026-11-01 합의, [12 결정 27](docs/development/12-decisions.md)). 이식 · 연동은 아직 검증 전이다.
상세: [02-architecture.md](docs/development/02-architecture.md) · [06-deployment.md](docs/development/06-deployment.md)

## 4. API 명세 (요약)
게스트 발급 · 게임 시작 · 채팅 턴 · 재개 · 결말 · 지난 기록, 3D 이벤트 · 정산 · 생존 신호 · 미수신 기록, 백엔드 → AI 대화 생성 · 3D 추천.
상세: [docs/development/03-api.md](docs/development/03-api.md)

## 5. DB 구조 (요약)
`players` · `plays` · `messages` · `experiences` · `experience_events` · `experience_resolutions`.
상세: [docs/development/04-database.md](docs/development/04-database.md)

## 6. 실행 방법
### 로컬
**웹 프론트** (Node.js 20.11 이상) — 상세: [frontend/README.md](frontend/README.md)
```bash
cd frontend
npm install
cp .env.example .env.local   # 기본값은 mock 모드 (백엔드 없이 실행)
npm run dev                  # http://localhost:5173
# 인트로까지 보려면 .env.local 에 VITE_INTRO_ASSET_BASE=https://<터널 주소>/intro-assets/ (백엔드 BE15)
```

**백엔드** — 상세: [backend/README.md](backend/README.md) <!-- TODO: 백엔드 담당이 실행 방법 확정 후 정리 -->
### 배포
[06-deployment.md](docs/development/06-deployment.md) — VPN · SSH 접속, 코드 받기, Gunicorn · Nginx · 터널, Vercel
### 환경변수
| 키 | 설명 |
|----|------|
| `AI_SERVER_KEY` · `AI_API_BASE_URL` | 백엔드 → AI 서버 호출 |
| `CORS_ALLOWED_ORIGINS` · `ALLOWED_HOSTS` | 백엔드 접근 허용 |
| `VITE_API_BASE_URL` | 프론트의 백엔드 주소 (현재 터널 주소) |
| `VITE_USE_MOCK` | 프론트 mock 사용 여부 (`true` 기본, 백엔드 연결 때 `false`) |
| `VITE_INTRO_ASSET_BASE` | 인트로 에셋 주소 (선택, 비우면 `VITE_API_BASE_URL` + `/intro-assets/`, 둘 다 없으면 인트로 생략) |

## 7. 민감정보 관리
API 키 · 비밀번호 · VPN 계정 · 토큰은 코드 · 문서 · 커밋에 쓰지 않는다. `.env` 로만 관리하고 저장소에는 `.env.example` 만 둔다. 건강 · 질병 정보는 받지도 저장하지도 않는다.

## 8. 팀 구성 · 역할
팀 **뽀스와아이들** (5명)

| 이름 | 역할 |
|------|------|
| 김정현 (팀장) | Unity 3D 체험 개발 |
| 변승언 | AI 서버 |
| 윤수현 | 백엔드 API |
| 이성준 | 프론트엔드 · 문서 총괄 |
| 이지혜 | 시나리오 작가 |

상세: [09-team.md](docs/development/09-team.md) · 협업 규칙: [CONTRIBUTING.md](docs/CONTRIBUTING.md)

## 9. 문서
| 문서 | 내용 |
|------|------|
| [00-idea.md](docs/00-idea.md) | 아이디어 원문 · 회의 결정 |
| [features.md](docs/development/features.md) | 기능 목록 (BE · AI · FE) |
| [01-user-flow.md](docs/development/01-user-flow.md) | 사용자 흐름 · 시연 순서 |
| [02-architecture.md](docs/development/02-architecture.md) | 기술 스택 · 구조 · 디렉터리 |
| [03-api.md](docs/development/03-api.md) | API 계약 |
| [04-database.md](docs/development/04-database.md) | DB 구조 |
| [05-ui-ux.md](docs/development/05-ui-ux.md) | 화면 · 3D 연결 |
| [06-deployment.md](docs/development/06-deployment.md) | 설치 · 배포 |
| [07-verification.md](docs/development/07-verification.md) | 검증 계획 |
| [08-checklist.md](docs/development/08-checklist.md) | 요구사항 대조 |
| [09-team.md](docs/development/09-team.md) | 역할 · 일정 |
| [10-prompt-assembly.md](docs/development/10-prompt-assembly.md) | 프롬프트 조립 · 3D 연동 · RAG |
| [11-open-issues.md](docs/development/11-open-issues.md) | 미확정 항목 |
| [12-decisions.md](docs/development/12-decisions.md) | 결정 근거 |
| [game/](docs/game/README.md) | 게임 콘텐츠 (시나리오 작가) |
| [design/](docs/design/README.md) | 디자인 토큰 · 색 대비 |
| [unity/USAGE.md](docs/unity/USAGE.md) | Unity 자료 사용처 |
| [CONTRIBUTING.md](docs/CONTRIBUTING.md) | 협업 규칙 |
