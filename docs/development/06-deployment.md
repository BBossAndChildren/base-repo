# 06. 설치 · 실행 · 배포

> 관련 문서: [02-architecture.md](02-architecture.md) · [03-api.md](03-api.md)
> 배포 플랫폼: 백엔드 = 네이버 클라우드 일반 서버 (Gunicorn), AI 서버 = 네이버 클라우드 GPU 서버, 3D 빌드 파일 = 백엔드 서버 폴더 + Nginx, 웹 프론트 = Vercel

## 1. 요구 환경
| 도구 | 버전 | 고정 방법 |
|------|------|-----------|
| Python | 3.12.13 | `backend/.python-version` |
| uv | 0.10.9 (이미지 빌드 도구) | 컨테이너에서 `uv sync --locked --no-dev --no-install-project` + `backend/uv.lock` |
| PostgreSQL | 15 계열 | 직접 설치 또는 `backend/compose.yaml` |
| Docker · Docker Compose | Compose v2 | 백엔드 · DB 컨테이너 실행. 소스 직접 실행도 가능 |

## 2. 설치
### 백엔드
기존 스택(Django · DRF · PostgreSQL · HTTPX · Gunicorn WSGI)을 유지한다. 개발할 때는 기본 Compose에 개발 설정을 덧붙인다.

```bash
cd backend
# .env가 없을 때 한 번만 실행한다. 기존 파일은 그대로 사용한다.
python3 scripts/init_local_env.py
docker compose -f compose.yaml -f compose.dev.yaml up --build -d --wait
docker compose logs --tail=50 backend
```

`init_local_env.py`는 개발 전용 비밀값을 생성하고 `.env`에만 저장한다. 기존 `.env`는 덮어쓰지 않는다. `.env.example`을 직접 복사했다면 비어 있는 필수 값을 채워야 한다. AI 서버 주소와 내부 키는 실제 AI 연동 구현 전까지 비워 둬도 된다. 패키지 목록은 기존 `uv.lock`을 사용한다. Python 패키지가 바뀌면 이미지를 다시 빌드한다.

기본 `compose.yaml`은 Gunicorn WSGI로 실행하고 DEBUG를 끈다. `compose.dev.yaml`을 추가하면 개발 서버와 DEBUG를 켜고 `apps/` · `config/` · `scripts/` · `manage.py` · `docs/game/` 수정이 반영된다. 컨테이너 안의 Python 가상환경은 호스트 가상환경과 분리한다.

개발용 `apps/`는 컨테이너에서 생성한 migration도 호스트에 남도록 쓰기를 허용한다. 나머지 소스 연결과 게임 문서는 읽기 전용이다. Linux에서 호스트 폴더 쓰기 권한이 다르면 migration 생성은 호스트의 `uv run python manage.py makemigrations`로 실행한다.

컨테이너에서는 DB 주소를 `db:5432`로 덮어쓴다. 기본 Compose는 DB를 호스트에 공개하지 않으며, 개발 설정에서만 `127.0.0.1:5433`으로 공개한다. 호스트 DB 도구로 조회할 때는 `.env`의 계정 · DB 이름과 호스트 포트를 사용한다.

기존에 초기화한 `backend/.local/postgres`와 호스트 5432의 DB는 보존한다. Docker의 `postgres_data` 볼륨은 별도 DB이므로 기존 데이터가 필요하면 PostgreSQL dump/restore로 옮긴다. 이전 과정은 자동 실행하지 않는다. 기존 볼륨의 DB 계정 · 비밀번호는 `.env` 수정만으로 바뀌지 않는다.

중지는 `docker compose -f compose.yaml -f compose.dev.yaml stop`으로 한다. DB 볼륨은 유지된다. 호스트에서 직접 실행하려면 `uv sync --locked` 후 `.env`의 `DB_HOST` · `DB_PORT`를 접속할 DB에 맞추고 `uv run python manage.py runserver 127.0.0.1:8000`을 사용한다.
### AI 서버
```bash
```
### 웹 프론트
```bash
```

## 3. 환경변수
> **값은 쓰지 않는다. 키 이름과 설명만.** 실제 값은 `.env`(커밋 금지), 예시는 `.env.example`.

| 키 | 위치 | 필수 | 설명 |
|----|------|:---:|------|
| `DJANGO_SECRET_KEY` | 백엔드 | ✅ | 환경별로 별도 생성, 빈 값이면 시작 실패 |
| `DJANGO_DEBUG` | 백엔드 | | 기본 False. 로컬 생성 스크립트는 True, 운영에서는 반드시 False |
| `DB_HOST` · `DB_PORT` | 백엔드 | ✅ | PostgreSQL 주소와 포트 |
| `DB_NAME` · `DB_USER` · `DB_PASSWORD` | 백엔드 | ✅ | DB 이름 · 접속 계정 · 비밀번호 |
| `DB_SSLMODE` | 백엔드 | | 기본 prefer. 운영 DB의 TLS 구성에 맞춰 설정 |
| `AI_API_BASE_URL` | 백엔드 | AI 연동 시 | GPU 서버 API 주소. 아직 호출 로직 없음 |
| `AI_SERVER_KEY` | 백엔드 · AI 서버 | ✅ | 백엔드 → AI 서버 내부 호출 키 (헤더 `X-Internal-Key`). 두 서버에 같은 값 |
| `CORS_ALLOWED_ORIGINS` | 백엔드 | ✅ | 프론트 배포 주소 (쉼표 구분) |
| `ALLOWED_HOSTS` | 백엔드 | ✅ | 백엔드 도메인 |
| `CSRF_TRUSTED_ORIGINS` | 백엔드 | | 신뢰하는 프론트 출처 (쉼표 구분) |
| `WEB_CONCURRENCY` · `GUNICORN_THREADS` | 백엔드 | | 초기값 worker 2 · thread 4, 부하 측정 후 조정 |
| `GUNICORN_BIND` | 백엔드 | | 직접 실행은 기본 로컬 주소, 컨테이너는 전체 인터페이스의 8000. 호스트 공개 범위는 Compose가 제한 |
| `BACKEND_PORT` | Compose | | 백엔드 호스트 포트, 기본 8000 (127.0.0.1에만 공개) |
| `POSTGRES_HOST_PORT` | 개발 Compose | | DB 호스트 포트, 기본 5433. 컨테이너 내부는 항상 5432 |
| `HEALTHCHECK_HOST` | 백엔드 컨테이너 | | 상태 확인 요청의 Host, 기본 localhost. `ALLOWED_HOSTS`에 허용된 이름을 지정 |
| `VITE_API_BASE_URL` | 프론트 (Vercel) | ✅ | 백엔드 주소 (변수 이름은 프론트 도구에 맞춘다) |
| | | | |

## 4. 로컬 실행 확인
```bash
cd backend
docker compose exec backend python manage.py check
docker compose exec backend python manage.py migrate --check
docker compose exec backend python manage.py test
docker compose exec backend python manage.py spectacular --validate --fail-on-warn > /dev/null
docker compose exec backend id
curl --fail http://127.0.0.1:8000/api/health

# 소스 lint · 포맷 · Python 패키지 빌드 (호스트 개발 도구)
uv sync --locked
uv run ruff check .
uv run ruff format --check .
uv build
```

Swagger: `http://127.0.0.1:8000/api/docs/`. `docker compose ps`에서 백엔드 · DB가 healthy인지 확인한다. DB가 연결되면 상태 확인은 200, 연결되지 않으면 503이다. AI 서버 상태는 검사하지 않는다. 테스트는 실제 PostgreSQL에 임시 테스트 DB를 생성하므로 **개발용 계정에만** CREATEDB 권한이 필요하다. 게임 테이블은 아직 만들지 않았으며 현재 migration은 Django contenttypes 기본 테이블만 생성한다. 런타임 컨테이너에는 Ruff 등 개발 도구를 설치하지 않는다.

`uv build`는 Python sdist · wheel을 `backend/dist/`에 생성한다. 정적 파일과 빌드 산출물은 Git에서 제외한다.

## 5. 배포
### 5-1. 백엔드 (game/ 마크다운 · 3D 빌드 · 빌드 카탈로그 JSON 포함)

백엔드 폴더에서 운영용 `.env`를 준비한 뒤 기본 Compose만 사용한다. 기존 스택의 Gunicorn WSGI가 컨테이너에서 실행되며 Nginx · HTTPS는 호스트가 담당한다. 아래는 단일 서버에서 PostgreSQL도 함께 실행하는 구성이다. 실제 네이버 클라우드 배포는 아직 수행하지 않는다.

```bash
docker compose up --build -d --wait
# 호스트 Nginx가 제공할 정적 파일을 이미지에서 복사한다.
mkdir -p staticfiles
docker compose cp backend:/app/backend/staticfiles/. ./staticfiles/
```

Compose는 호스트 `127.0.0.1:8000`만 공개한다. Gunicorn은 컨테이너 내부에서 8000으로 수신하며 타임아웃 60초를 사용한다. DB가 healthy가 되면 migration · 정적 파일 수집 후 서버를 시작하며, 서버 명령은 `exec`로 실행해 종료 신호를 전달한다. 여러 서버로 확장할 때는 migration을 별도 배포 단계로 분리해야 한다.

`staticfiles/`는 컨테이너의 `static_files` 볼륨과 별개인 호스트 복사본이다. 이미지를 바꿨다면 다시 복사하고 Nginx alias 경로를 실제 배포 위치에 맞춘다. `.dockerignore`는 `.env` · 가상환경 · 로컬 DB · 수집 결과 · Unity 바이너리를 이미지에서 제외한다. 작가가 관리하는 `docs/game/`은 이미지에 포함하므로 운영 반영 때 다시 빌드한다. 직업 JSON과 실제 AI 연결은 아직 구현 전이다.

게임 API의 30초 전체 대기 제한과 HTTPX 타임아웃 · 재시도 구현은 후속 작업이다. WSGI에서는 AI 응답을 기다리는 동안 thread를 점유하므로 동시 요청량을 측정해 조정한다. 운영 DB 계정 · 백업 구성은 배포 전에 확정해야 한다. PostgreSQL 컨테이너의 named volume은 영구 저장 위치이며 백업을 대신하지 않는다.

운영 환경에서 `docker compose exec backend python manage.py check --deploy`를 실행한다. 기본 Compose는 DEBUG를 끄며, Nginx HTTPS 전환과 HSTS 적용 여부는 도메인 구성이 확정된 뒤 확인한다. `HEALTHCHECK_HOST`는 `ALLOWED_HOSTS`에 포함된 이름을 지정한다. 로컬의 `ALLOWED_HOSTS`에는 localhost가 들어 있다. 이번 컨테이너 검증은 실제 운영 배포 검증을 대신하지 않는다.

#### 구성 (네이버 클라우드 일반 서버 한 대)
```
브라우저 ── https ──▶ Nginx (443, SSL) ─┬─ /api/     ──▶ 호스트 127.0.0.1:8000 → Gunicorn 컨테이너 → PostgreSQL 컨테이너
                                        └─ /builds/  ──▶ 서버 폴더 /srv/builds/ (Nginx 가 직접 내려줌)
```

#### 3D 빌드 파일 저장 · 관리 · 전달
| 항목 | 규칙 |
|------|------|
| 저장 위치 | 백엔드 서버 폴더 `/srv/builds/<buildId>/`. Unity 가 준 `site/` 폴더 내용을 그대로 둔다 (`index.html` · `Build/` 등) |
| Git | **빌드 파일은 Git 저장소에 넣지 않는다.** 수십 MB 바이너리라 GitHub 제한(50MB 경고 · 100MB 차단)에 걸리고 저장소가 계속 커진다. 저장소에는 빌드 카탈로그 JSON 만 둔다 |
| 올리는 방법 | Unity 담당이 새 빌드를 주면 백엔드 담당이 서버 폴더로 복사한다 (예: `scp -r site/ <서버>:/srv/builds/<buildId>/`). 새 `buildId` 는 새 폴더에 두고 기존 폴더는 덮어쓰지 않는다 |
| 카탈로그 반영 | 빌드를 올린 뒤 빌드 카탈로그 JSON 에 `buildId` · `buildUrl` · 방 · 시나리오를 추가한다 ([10 4-1](10-prompt-assembly.md#4-1-빌드-카탈로그-json-형식)) |
| 프론트 전달 | 채팅 응답의 `experience.buildUrl` 로 주소를 준다 (`https://<백엔드 도메인>/builds/<buildId>/`). 프론트는 이 주소를 iframe 으로 연다 |
| 지우기 | 카탈로그에서 뺀 빌드는 진행 중인 체험이 없을 때 폴더를 지운다 |

#### SSL (https) — 백엔드 서버에서 직접 처리
> 프론트(Vercel)는 https 이므로 브라우저가 http 호출 · http iframe 을 막는다. 백엔드 API 와 빌드 주소 모두 https 여야 한다.

1. 도메인을 준비하고 DNS A 레코드를 네이버 클라우드 서버의 공인 IP 로 연결한다 <!-- TODO: 도메인 -->
2. 네이버 클라우드 ACG(방화벽)에서 80 · 443 포트를 연다. Gunicorn 포트(8000)는 외부에 열지 않는다
3. Nginx 를 설치하고 Let's Encrypt(certbot)로 인증서를 발급한다: `sudo certbot --nginx -d <백엔드 도메인>`
4. 인증서 자동 갱신을 확인한다: `sudo certbot renew --dry-run`
5. http(80) 요청은 https 로 넘긴다 (certbot 이 설정)

#### Nginx 설정 (예시)
```nginx
server {
    listen 443 ssl;
    server_name <백엔드 도메인>;
    # ssl_certificate · ssl_certificate_key 는 certbot 이 채운다

    # API → Django (CORS 헤더는 Django 가 붙인다. Nginx 에서 중복으로 붙이지 않는다)
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;   # 채팅 30초 대기보다 길게
    }

    location /static/ {
        alias /srv/adult-prince/backend/staticfiles/;  # 실제 배포 경로에 맞춘다
    }

    # Unity WebGL 빌드 (테스트 빌드 career-pilot-v007 은 비압축)
    location /builds/ {
        alias /srv/builds/;
        types {
            text/html                 html;
            application/javascript    js;
            application/wasm          wasm;
            application/octet-stream  data;
            text/css                  css;
        }
        # 프론트 페이지만 이 빌드를 iframe 으로 넣을 수 있게 한다
        add_header Content-Security-Policy "frame-ancestors https://<프론트 도메인>" always;
    }
}
```
- **현재 빌드는 압축하지 않은 파일이다** (`docs/unity/webgl/BUILD.md`). `Content-Encoding` 을 붙이지 않는다. Unity 담당이 나중에 Brotli(`.br`) · Gzip(`.gz`) 압축 빌드를 주면 아래를 추가한다

```nginx
    # 압축 빌드일 때만 (/builds/ 안에)
    location ~ .+\.(data|symbols\.json)\.br$ { add_header Content-Encoding br; default_type application/octet-stream; }
    location ~ .+\.js\.br$                   { add_header Content-Encoding br; default_type application/javascript; }
    location ~ .+\.wasm\.br$                 { add_header Content-Encoding br; default_type application/wasm; }
    # Gzip 은 .gz · Content-Encoding gzip 으로 같은 방식
```
- 안쪽 `location` 에서 `add_header` 를 쓰면 바깥 `add_header` 가 이어지지 않으므로, 압축 블록에도 `Content-Security-Policy` 를 함께 넣는다

#### CORS — Django 가 담당
| 항목 | 설정 |
|------|------|
| 담당 | **백엔드(Django, django-cors-headers)** 가 API 응답에 CORS 헤더를 붙인다. Nginx 는 붙이지 않는다 (중복되면 브라우저가 거부) |
| 허용 출처 | `CORS_ALLOWED_ORIGINS` = 프론트 배포 주소 (`https://<프론트 도메인>`), 로컬 개발 때 `http://localhost:<포트>` 추가. `*` 는 쓰지 않는다 |
| 허용 헤더 | 기본 헤더 + `x-player-id` (`CORS_ALLOW_HEADERS` 에 추가). 이 헤더 때문에 브라우저가 사전 요청(OPTIONS)을 보낸다 |
| 허용 메서드 | `GET` · `POST` · `OPTIONS` |
| 쿠키 | 쓰지 않으므로 `CORS_ALLOW_CREDENTIALS = False` |
| 빌드 파일 | iframe 으로 열기 때문에 CORS 가 아니라 위 `frame-ancestors` 로 허용한다 |
| Django 기타 | `ALLOWED_HOSTS` 에 백엔드 도메인, `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')`, `CSRF_TRUSTED_ORIGINS` 에 프론트 주소 |

### 5-2. AI 서버
- 네이버 클라우드 GPU 서버. 백엔드만 호출하므로 ACG 에서 **백엔드 서버 IP 만** 허용한다. 프론트 · 외부에서 직접 부르지 않는다
- 백엔드 → AI 서버 호출에는 `X-Internal-Key` 를 붙인다 (값은 `AI_SERVER_KEY`)

### 5-3. 웹 프론트 — Vercel
- Vercel 에 저장소를 연결해 배포한다. **https · SSL 인증서는 Vercel 이 자동으로 처리한다** (기본 `*.vercel.app` 주소와 연결한 도메인 모두)
- 환경변수: `VITE_API_BASE_URL` 등 백엔드 주소 <!-- TODO: 프론트 빌드 도구에 맞는 변수 이름 -->
- SPA 라우팅이면 새로고침 404 를 막는 rewrites 설정 <!-- TODO: 프론트 구조 확정 후 -->
- 프론트 배포 주소가 정해지면 백엔드에 알려 `CORS_ALLOWED_ORIGINS` · `frame-ancestors` 에 등록한다

### 5-4. 배포 순서
1. AI 서버 → 2. 백엔드 (도메인 · SSL · Nginx · Django) → 3. 빌드 파일 업로드 · 카탈로그 반영 → 4. 프론트(Vercel) → 5. 프론트 주소를 백엔드 CORS · frame-ancestors 에 등록

## 6. 배포 후 확인
- [ ] `https://<백엔드 도메인>/api/v1/...` 가 https 로 응답한다 (http 는 https 로 넘어간다)
- [ ] 프론트 주소에서 API 호출 시 CORS 오류가 없다 (브라우저 개발자 도구 Network)
- [ ] 프론트에서 빌드 iframe 이 열리고, 다른 주소에서는 열리지 않는다 (`frame-ancestors`)
- [ ] `.wasm` 응답의 Content-Type 이 `application/wasm` 이다
- [ ] AI 서버가 외부에서 직접 접속되지 않는다

## 7. 트러블슈팅
| 증상 | 원인 | 해결 |
|------|------|------|
| 채팅이 30초 부근에서 `TIMEOUT` 대신 502 로 끊김 | Gunicorn 기본 worker 타임아웃(30초)이 채팅 대기 시간(30초)과 같아, 앱이 `TIMEOUT` 응답을 만들기 전에 worker 가 강제 종료됨 | Gunicorn `--timeout` 을 채팅 대기 시간보다 길게 (예: 60초), HTTPX 타임아웃은 그보다 짧게 둔다 |
| 여러 명이 동시에 채팅하면 응답이 밀림 | WSGI worker 하나가 AI 응답을 기다리는 동안 다른 요청을 못 받음 | worker 수를 동시 접속 예상치에 맞게 늘리거나 thread worker(`--threads`) 사용 |
| 3D 빌드가 브라우저에서 안 열림 | `.wasm` Content-Type 누락, 비압축 빌드에 `Content-Encoding` 을 붙임, http 사용, `frame-ancestors` 에 프론트 주소 누락 | [5-1 Nginx 설정](#nginx-설정-예시) 확인 |
| 프론트에서 API 호출 시 CORS 오류 | 허용 출처 미설정, `x-player-id` 헤더 미허용, Nginx 와 Django 가 헤더를 중복으로 붙임 | [5-1 CORS](#cors--django-가-담당) 확인 |
| 브라우저 콘솔에 Mixed Content 오류 | https 프론트에서 http 백엔드 · 빌드 주소 호출 | 백엔드에 SSL 적용 ([5-1 SSL](#ssl-https--백엔드-서버에서-직접-처리)) |

## 8. 민감정보 관리 체크
- [x] `.env` 가 `.gitignore` 에 있다
- [x] 코드·문서에 키 값이 없다
