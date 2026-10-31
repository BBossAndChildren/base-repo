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
| 프론트 연동 | django-cors-headers | 4.9.0 | 프론트가 다른 주소에서 호출하므로 CORS 허용 출처 지정 |
| 직업 데이터 | 기존 JSON 파일 (직업 552개) | — | 직업 정보 로딩 · 조회 |

### AI 서버
| 구분 | 기술 | 버전 | 선택 이유 |
|------|------|------|-----------|
| 실행 환경 | 네이버 클라우드 GPU 서버 | — | 별도 AI 모델 서버 운영 · 추론 |
| | | | |

### 웹 프론트
| 구분 | 기술 | 버전 | 선택 이유 |
|------|------|------|-----------|
| | | | |

### 3D 체험 (Unity WebGL)
| 구분 | 기술 | 버전 | 선택 이유 |
|------|------|------|-----------|
| 엔진 | Unity WebGL | 6000.3.26f1 | Unity 담당 (테스트 빌드 `career-pilot-v007`) |
| 연결 | iframe + postMessage (`integration/frontend/`) | 명세 v003 | Unity 담당 연결 코드 ([docs/unity/README.md](../unity/README.md)) |

### 외부 서비스
| 서비스 | 용도 | 비고 |
|--------|------|------|
| | | |

## 2. 아키텍처
<!-- 구성 요소와 통신 방향 다이어그램 -->

```mermaid
flowchart LR
  Browser --> FE[웹 프론트] --> BE[백엔드] --> AI[AI 서버]
  BE --> DB
  BE --- Content[(game/ 마크다운 · 3D 빌드 · 빌드 카탈로그 JSON)]
```

> 프롬프트 조립과 3D 체험 추천 흐름 상세: [10-prompt-assembly.md](10-prompt-assembly.md)

## 3. 디렉터리 구조
```text
backend/
├─ manage.py
├─ pyproject.toml / uv.lock / .python-version
├─ .env.example                # 변수 이름만 공유, 실제 .env는 Git 제외
├─ compose.yaml                # 개발용 PostgreSQL (선택)
├─ gunicorn.conf.py            # WSGI 실행 설정
├─ config/
│  ├─ settings.py              # 환경변수 · DB · DRF · CORS
│  ├─ urls.py                  # 전체 URL · OpenAPI · Swagger
│  └─ wsgi.py
├─ apps/
│  └─ core/                   # 상태 확인 API · 기반 테스트
└─ scripts/
   └─ init_local_env.py        # 비밀값을 생성해 로컬 .env에만 저장
docs/
├─ development/                # 설계 · API 계약 · 실행 안내
└─ game/                       # 시나리오 작가 담당 마크다운
```

### 컴포넌트 역할
| 파일 / 폴더 | 역할 |
|-------------|------|
| `backend/config/` | 환경과 진입점. 설정은 `.env` 또는 서버 환경변수로 주입하며 서버 환경변수가 우선한다 |
| `backend/apps/core/` | `GET /api/health`: DB `SELECT 1` 성공 시 200, 연결 실패 시 503. 인증 없이 호출하며 접속 정보는 노출하지 않는다 |
| `backend/scripts/` | 로컬 설정 준비. 기존 `.env`가 있으면 덮어쓰지 않는다 |
| `backend/compose.yaml` | 로컬 DB만 컨테이너로 실행. 데이터는 named volume에 보관 |
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
