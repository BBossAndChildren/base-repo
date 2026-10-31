# 02. 시스템 구조 · 내부 절차 · 기술 결정

> 관련 문서: [03-api.md](03-api.md) · [04-database.md](04-database.md) · [features.md](features.md)
> 결정 근거 상세: [12-decisions.md](12-decisions.md) · 미확정: [11-open-issues.md](11-open-issues.md)

## 1. 기술 스택

### 백엔드
> 백엔드 담당 결정. 실제 설치 버전은 `backend/uv.lock`으로 고정한다.

| 구분 | 기술 | 버전 | 선택 이유 |
|------|------|------|-----------|
| 언어 | Python | 3.12.13 | 기존 시제품 로직 재사용 |
| 프레임워크 | Django + Django REST Framework | 5.2.18 (LTS) · 3.16.1 | 플레이 세션 생성 · 턴 진행 · 게임 상태 · 대화 조회 API |
| 데이터 검증 | DRF Serializer | DRF와 동일 | 사용자 입력과 AI 응답 JSON 의 구조 · 값 검증 ([10 3절](10-prompt-assembly.md#3-ai-응답-처리)) |
| AI 서버 통신 | HTTPX | 0.28.1 | GPU 서버의 AI API 호출과 타임아웃 처리 |
| DB | PostgreSQL · Psycopg | 15 계열 · 3.3.6 | 플레이 세션 · 대화 · 턴별 기록 · 게임 상태 · 3D 체험 이벤트 영구 저장 |
| ORM · 마이그레이션 | Django ORM · Django Migrations | Django와 동일 | DB 조회 · 저장과 스키마 변경 관리 |
| API 문서 | drf-spectacular | 0.29.0 | OpenAPI 명세와 Swagger UI 생성. 기준 계약은 [03-api.md](03-api.md) 이며 생성 문서와 다르면 03 을 고친다 |
| 앱 서버 | Gunicorn (WSGI) | 23.0.0 | 배포 환경에서 Django 실행 |
| 컨테이너 | Docker · Docker Compose | Compose v2 | 기존 Python · Django · PostgreSQL 스택을 동일한 이미지와 실행 설정으로 재현 |
| 프론트 연동 | django-cors-headers | 4.9.0 | 프론트가 다른 주소에서 호출하므로 CORS 허용 출처 지정 |
| 직업 데이터 | 기존 JSON 파일 (직업 552개) | — | 백엔드 조회용. AI 의 직업 지식은 AI 서버 RAG 가 담당 |

### AI 서버
| 구분 | 기술 | 버전 | 선택 이유 |
|------|------|------|-----------|
| 실행 환경 | 네이버 클라우드 GPU 서버 | — | 별도 AI 모델 서버 운영 · 추론 |
| 모델 | 오픈소스 Qwen | TODO | 자체 GPU 서버에서 추론 |
| 직업 지식 | RAG · BGE-M3 임베딩 | 벡터 DB와 배포 버전은 구현 시 고정 | 직업 데이터 552개를 검색해 프롬프트에 붙임 ([10 6절](10-prompt-assembly.md#6-직업-데이터-rag-ai-서버)) |
| | | | |

### 웹 프론트
| 구분 | 기술 | 버전 | 선택 이유 |
|------|------|------|-----------|
| UI | React | 19.3 | Unity 연결 코드(`Experience.jsx`)가 React 기준 |
| 라우팅 | React Router | 8.5 | 인트로 · 시작 · 게임 · 결말 · 지난 기록 화면 주소 |
| 3D 인트로 | Three.js (`three`) + GLTFLoader | 0.180 | Unity 담당이 준 인트로(`career-intro-react-v001`)가 r180 기준. 인트로 화면에서만 따로 나눠 불러온다 ([05 화면 0](05-ui-ux.md#화면-0-인트로-intro-선택)) |
| 빌드 | Vite | 8.3 | Unity 연결 예제 · 환경변수(`VITE_*`)가 Vite 기준 |
| 언어 | TypeScript | 7.0 (strict) | Unity 연결 코드에 타입(`*.d.ts`)이 함께 제공됨 |
| 스타일 | 일반 CSS (CSS 변수) + 디자인 토큰 | — | 인트로에서 뽑은 토큰(`src/design/tokens/tokens.json`)을 `npm run tokens` 로 CSS 변수로 만들어 씀, 별도 라이브러리 없음 ([docs/design/](../design/README.md)) |
| 글꼴 | Pretendard (jsDelivr CDN) | 고정 버전 | 토큰의 글꼴. Google Fonts 에 없음 |
| API mock | 직접 만든 mock (`src/mocks/`) | — | 백엔드 게임 API 구현 전 개발용. `VITE_USE_MOCK=true` 면 사용 |
| 검사 | oxlint · Vitest · Testing Library | 1.89 · 5.0 · 16.3 | lint(경고도 실패) · 자동 테스트 |

### 3D 체험 (Unity WebGL)
| 구분 | 기술 | 버전 | 선택 이유 |
|------|------|------|-----------|
| 엔진 | Unity WebGL | 6000.3.26f1 | Unity 담당 (실서비스 빌드 `career-suite-integration-v005`, 테스트 빌드 `career-suite-test-v009`) |
| 연결 | iframe + postMessage (`docs/unity/frontend/`) | 명세 v003 | Unity 담당 연결 코드 ([docs/unity/USAGE.md](../unity/USAGE.md)) |

### 외부 서비스
| 서비스 | 용도 | 비고 |
|--------|------|------|
| Vercel | 웹 프론트 배포 | SSL 자동 |
| Cloudflare Tunnel (`cloudflared`) | 사설 IP 백엔드 서버를 외부 https 주소로 공개 | 무료 임시 주소, 재실행 때 바뀜 ([06 0절](06-deployment.md#0-배포-환경-한눈에)) |

> 인트로 3D 모델(71개, 약 238MB)은 저장소 · Vercel 에 넣지 않고 백엔드 서버 Nginx `/intro-assets/` 에서 정적 파일로 제공한다 (백엔드 기능 BE15, [06 5-2-1](06-deployment.md#5-2-1-인트로-에셋), [12 결정 25](12-decisions.md)).

## 2. 아키텍처
<!-- 구성 요소와 통신 방향 다이어그램 -->

```mermaid
flowchart LR
  Browser --> FE[웹 프론트] --> BE[백엔드] --> AI[AI 서버]
  BE --> DB
  BE --- Content[(game/ 마크다운 · 3D 빌드 · 빌드 카탈로그 JSON · 인트로 에셋)]
```

> 프롬프트 조립과 3D 체험 추천 흐름 상세: [10-prompt-assembly.md](10-prompt-assembly.md)

## 3. 디렉터리 구조

> **모노레포:** 프론트 · 백엔드 · 문서를 `base-repo` 하나에 둔다. AI 서버는 별도 저장소 ([12 결정 17](12-decisions.md)).

```
base-repo/
├─ AGENTS.md · CLAUDE.md        ← 저장소 공통 AI 작업 규칙
├─ .github/                     ← 이슈 · PR 템플릿, 워크플로
├─ .dockerignore                ← 백엔드 이미지에서 제외할 파일
├─ docs/                        ← 설계 문서 (docs 브랜치에서 관리)
│  ├─ development/  game/  unity/  design/
├─ frontend/                    ← 웹 프론트 (Vercel Root Directory)
│  ├─ AGENTS.md · CLAUDE.md     ← 프론트 작업 때 꼭 읽을 문서
│  ├─ vercel.json               ← Vercel 빌드 · SPA 주소 처리 · docs 만 바뀌면 배포 건너뜀
│  ├─ public/intro-assets/      ← 로컬 개발용 인트로 에셋 (git 제외, 배포는 백엔드 서버 /intro-assets/)
│  ├─ scripts/build-tokens.mjs  ← 디자인 토큰 생성 (npm run tokens, build 에 포함)
│  └─ src/
│     ├─ api/                   ← 백엔드 호출 (gameApi · 3D 이벤트 API), mock 과 실제 전환
│     ├─ mocks/                 ← 백엔드 전 개발용 가짜 응답
│     ├─ app/ · hooks/          ← 화면 주소 · 게스트 ID · 이어하기
│     ├─ components/            ← 버튼 · 입력칸 · 토스트 · 모달 등 공통
│     ├─ pages/                 ← intro · start · play · result · history 화면
│     │  └─ intro/              ← 인트로 (CareerIntro · Three.js 엔진, 원본 career-intro-react-v001)
│     ├─ lib/experience/        ← Unity 체험 실행 (연결 코드는 빌드에서 불러옴)
│     ├─ design/tokens/         ← 디자인 토큰 원본(tokens.json) · 생성된 CSS 변수
│     ├─ styles/                ← 화면별 CSS (토큰 역할 변수 사용)
│     └─ types/                 ← API · Unity 타입
├─ backend/                     ← Django 백엔드 (서버에서 실행, 아래 상세)
│  ├─ AGENTS.md · CLAUDE.md     ← 백엔드 작업 때 꼭 읽을 문서
└─ scripts/                     ← 저장소 관리 스크립트 (라벨 생성 등)

(별도 저장소) ai-server/        ← Qwen + RAG
```

### 컴포넌트 역할
| 파일 / 폴더 | 역할 | 라벨 · scope |
|-------------|------|:---:|
| `frontend/` | 화면 · Unity 체험 연결 · 백엔드 API 호출 | `fe` |
| `backend/` | API · DB · 프롬프트 조립 · 3D 이벤트 저장 · 빌드 제공 | `be` |
| AI 서버 저장소 | 대화 생성 · 3D 추천 · 직업 RAG | `be` |
| `docs/` | 설계 문서 · Unity 전달물 · 게임 콘텐츠 | (생략, `docs:`) |
| `docs/unity/frontend/` | Unity 연결 코드 원본 — **참고만 하고** `frontend/` 로 복사하지 않는다 | — |
| `docs/game/` | 시나리오 · 가이드라인 — 백엔드가 읽어 매 AI 요청에 넣는다 (배포 때 서버에 함께 있어야 함) | — |

#### `backend/` 상세 (백엔드 담당)

```text
backend/
├─ manage.py
├─ pyproject.toml / uv.lock / .python-version
├─ .env.example                # 변수 이름만 공유, 실제 .env는 Git 제외
├─ Dockerfile                  # uv.lock 기반 런타임 이미지, 일반 사용자 실행
├─ compose.yaml                # Gunicorn WSGI + PostgreSQL
├─ compose.dev.yaml            # 개발용 자동 새로고침 · 소스 연결 · DB 호스트 포트
├─ gunicorn.conf.py            # WSGI 실행 설정
├─ config/
│  ├─ settings.py              # 환경변수 · DB · DRF · CORS
│  ├─ urls.py                  # 전체 URL · OpenAPI · Swagger
│  └─ wsgi.py
├─ apps/
│  └─ core/                   # 상태 확인 API · 기반 테스트
└─ scripts/
   ├─ init_local_env.py        # 비밀값을 생성해 로컬 .env에만 저장
   └─ start_container.sh       # migration · 정적 파일 수집 후 서버 실행
docs/
├─ development/                # 설계 · API 계약 · 실행 안내
└─ game/                       # 시나리오 작가 담당 마크다운
```

#### 백엔드 컴포넌트 (백엔드 담당)
| 파일 / 폴더 | 역할 |
|-------------|------|
| `backend/config/` | 환경과 진입점. 설정은 `.env` 또는 서버 환경변수로 주입하며 서버 환경변수가 우선한다 |
| `backend/apps/core/` | `GET /api/health`: DB `SELECT 1` 성공 시 200, 연결 실패 시 503. 인증 없이 호출하며 접속 정보는 노출하지 않는다 |
| `backend/scripts/` | 로컬 설정 준비. 기존 `.env`가 있으면 덮어쓰지 않는다 |
| `backend/Dockerfile` · 루트 `.dockerignore` | Python 3.12.13과 기존 uv.lock으로 이미지를 빌드. `.env` · 로컬 DB · 가상환경 · Unity 빌드는 제외하고 `docs/game/`은 포함 |
| `backend/compose.yaml` | Gunicorn WSGI와 PostgreSQL. DB 준비 후 migration · 정적 파일 수집, API healthcheck. DB와 정적 파일은 named volume에 보관 |
| `backend/compose.dev.yaml` | Django 개발 서버로 변경하고 소스를 연결. migration 생성용 `apps/`는 쓰기를 허용하고 설정 · 스크립트 · 게임 문서는 읽기 전용. DB 호스트 접속은 기본 5433 |
| `backend/apps/` | 후속 작업에서 플레이 · AI 연동 앱을 추가. 현재는 게임 모델 · 인증 · AI 요청을 구현하지 않는다 |

Swagger는 `/api/docs/`, OpenAPI는 `/api/schema/`에서 제공한다. 현재 실행 가능한 API는 상태 확인뿐이며, [03-api.md 1부](03-api.md#1부-프론트--백엔드)의 게임 API는 후속 구현 대상이다. 게스트 방식이므로 이번 세팅에서는 Django 사용자 · 세션 · 관리자 앱과 사용자 테이블을 만들지 않는다.

## 4. 핵심 기술 결정: <!-- 예: 인증 방식 JWT vs 세션 -->
### 결론
### 비교
| 기준 | 안 A | 안 B |
|------|------|------|
| | | |
### 이 프로젝트에서 택한 이유
### 약점과 보완

## 5. 내부 처리 절차
<!-- 주요 API 마다 서버 안에서 일어나는 일을 순서대로. 검증 → 처리 → 저장 → 로그 → 응답 -->

### 5-1. <!-- 예: 회원가입 POST /api/auth/signup -->
1. 
2. 

## 6. 외부 연동 메모
<!-- 외부 API 주소, 인증 방식, 타임아웃, 실패 시 처리 -->

## 7. 요청 흐름 요약

## 8. 인생·직업 진행의 처리 책임 (2026-10-31 갱신)

기획 기준은 [인생·직업 게임 상세 기획](../game/06-life-career-design.md)다. 아래는 후속 구현 설계이며 현재 실행 가능한 게임 기능을 뜻하지 않는다.

| 구성 요소 | 책임 |
|---|---|
| AI 서버 | Qwen으로 NPC 대화·핵심 업무 상황·변화를 제안. BGE-M3로 직업 자료 및 허용된 기억 후보를 검색 |
| 백엔드 | 플레이 소유권·NPC별 정보 범위 결정, 상태 규칙과 AI 제안 검증, 월별 수입·지출 및 사건 반영, 중복 방지와 확정 상태 저장 |
| 프론트 | 확정된 대화·상태·선택지 표시, 요청 중 대기/재시도, 일시정지·재개, 검증된 체험 실행 |

플레이어의 중요한 선택은 건너뛰지 않는다. 기간을 압축할 때도 월별 처리를 순서대로 적용하며 자금 부족 등 선택이 필요한 사건이 생기면 그 시점에 멈춘다. 실제 경과시간과 게임 속 날짜는 구분한다. 종료·백그라운드·일시정지 구간은 플레이 시간에서 제외하고, 응답 대기 구간은 포함한다. 화면 복귀 시 실제로 지난 시간만큼 게임 날짜를 자동 진행시키지 않는다.

AI 호출 동안 전체 플레이 DB 행 잠금을 유지하지 않는다. 생성에 사용한 상태 버전을 확인한 뒤 트랜잭션으로 대화·상태·사건을 함께 확정한다. 중간에 상태가 바뀌었다면 이전 제안을 덮어쓰지 않는다.
