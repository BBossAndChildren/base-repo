# 06. 설치 · 실행 · 배포

> 관련 문서: [02-architecture.md](02-architecture.md) · [03-api.md](03-api.md) · [docs/unity/USAGE.md](../unity/USAGE.md)

## 0. 배포 환경 한눈에

| 구성 | 어디에 | 외부 공개 방법 | SSL |
|------|--------|----------------|-----|
| 웹 프론트 | **Vercel** | Vercel 주소 (`https://<프로젝트>.vercel.app`) | Vercel 자동 |
| 백엔드 (Django · 3D 빌드 · game/ 문서) | **제공받은 네이버 클라우드 일반 서버** (사설 IP, SSL VPN 으로만 접속) | **Cloudflare Tunnel** (`https://<랜덤>.trycloudflare.com`) | Cloudflare 자동 |
| AI 서버 (Qwen + RAG) | 제공받은 네이버 클라우드 GPU 서버 | **기본은 공개하지 않음** — 백엔드가 사설망으로 호출. 사설망이 막혀 있으면 터널 + 내부 키 ([5-3](#5-3-ai-서버-gpu-서버)) | — |

```
사용자 브라우저 ──▶ Vercel (프론트 화면)
       │
       └── https ──▶ Cloudflare ◀── cloudflared (백엔드 서버가 바깥으로 연결)
                                        │
                                        ▼
                              Nginx (127.0.0.1:80) ─┬─ /api/    → 127.0.0.1:8000 (Docker: Gunicorn + Django, PostgreSQL) ──사설망──▶ AI 서버
                                                    └─ /builds/ → /srv/builds/ (3D 빌드)
```

- 서버는 **공인 IP · 도메인이 없고**, 제공처 설정(방화벽 · 로드밸런서)을 바꿀 수 없다. 그래서 서버가 **안에서 바깥으로** 연결을 여는 Cloudflare Tunnel 로 공개한다. 외부 사용자는 아무것도 설치하지 않는다
- 도메인 · Let's Encrypt 인증서는 쓰지 않는다. https 는 Cloudflare 가 처리한다
- **터널 주소는 `cloudflared` 를 다시 실행할 때마다 바뀐다.** 바뀌면 [5-4](#터널-주소가-바뀌었을-때) 절차를 따른다

## 1. 요구 환경
| 도구 | 버전 | 고정 방법 |
|------|------|-----------|
| Python | 3.12.13 | `backend/.python-version` |
| uv | 0.10.9 (이미지 빌드 도구) | 컨테이너에서 `uv sync --locked --no-dev --no-install-project` + `backend/uv.lock` |
| PostgreSQL | 15 계열 | 직접 설치 또는 `backend/compose.yaml` |
| Docker · Docker Compose | Compose v2 | 백엔드 · DB 컨테이너 실행. 소스 직접 실행도 가능 |
| Nginx | 서버 패키지 기본 | 호스트에 설치 (API · 빌드 · 정적 파일 전달) |
| cloudflared | 최신 | GitHub 릴리스 실행 파일 |

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
| `AI_API_BASE_URL` | 백엔드 | AI 연동 시 | AI 서버 주소 — 사설 IP (`http://<GPU 사설 IP>:<포트>`) 또는 AI 터널 주소 ([5-3](#5-3-ai-서버-gpu-서버)). 아직 호출 로직 없음 |
| `AI_SERVER_KEY` | 백엔드 · AI 서버 | ✅ | 백엔드 → AI 서버 내부 호출 키 (헤더 `X-Internal-Key`). 두 서버에 같은 값 |
| `CORS_ALLOWED_ORIGINS` | 백엔드 | ✅ | Vercel 프론트 주소 (쉼표 구분) |
| `ALLOWED_HOSTS` | 백엔드 | ✅ | `.trycloudflare.com,localhost,127.0.0.1` (터널 주소가 바뀌어도 되도록 앞에 점) |
| `CSRF_TRUSTED_ORIGINS` | 백엔드 | | 신뢰하는 프론트 출처 (쉼표 구분) |
| `WEB_CONCURRENCY` · `GUNICORN_THREADS` | 백엔드 | | 초기값 worker 2 · thread 4, 부하 측정 후 조정 |
| `GUNICORN_BIND` | 백엔드 | | 직접 실행은 기본 로컬 주소, 컨테이너는 전체 인터페이스의 8000. 호스트 공개 범위는 Compose가 제한 |
| `BACKEND_PORT` | Compose | | 백엔드 호스트 포트, 기본 8000 (127.0.0.1에만 공개) |
| `POSTGRES_HOST_PORT` | 개발 Compose | | DB 호스트 포트, 기본 5433. 컨테이너 내부는 항상 5432 |
| `HEALTHCHECK_HOST` | 백엔드 컨테이너 | | 상태 확인 요청의 Host, 기본 localhost. `ALLOWED_HOSTS`에 허용된 이름을 지정 |
| `VITE_API_BASE_URL` | 프론트 (Vercel) | ✅ | 현재 터널 주소 (변수 이름은 프론트 도구에 맞춘다) |
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

### 5-0. 서버 접속 (백엔드 · AI 공통)
> **연결 조건 (서버 제공 안내):** VPN 은 내 PC 에서 **아웃바운드 443 · 8443 · 12000~13000** 포트가 열려 있어야 연결된다. 사설 서버는 **SSH 포트만 허용**한다. VPN 이 연결되어도 **ACG 에서 허용된 서버 IP · 포트에만** 접근할 수 있다.
> - 학교 · 회사 네트워크에서 VPN 이 안 붙으면 위 포트가 막힌 것이다 (휴대폰 핫스팟으로 확인)
> - VPN 으로는 SSH(22)만 된다. 서버의 8000 · 80 포트를 내 PC 에서 직접 열 수 없으니, 개발 중 확인은 SSH 포트 포워딩을 쓴다: `ssh -p 22 -L 8000:127.0.0.1:8000 ncloud@10.1.1.14` 후 내 PC 에서 `http://localhost:8000`
> - 서버끼리도 ACG 가 적용될 수 있다 ([5-3 먼저 확인](#먼저-확인-백엔드에서-사설망으로-닿는가))
> - Cloudflare Tunnel 은 서버에서 **바깥으로 나가는** 연결이라 ACG 의 들어오는 규칙과 상관없다

1. 네이버 클라우드 **SSL VPN** 클라이언트에 VPN 을 추가하고 아이디 · 비밀번호로 연결한다 (계정 정보는 팀 내부로만 공유, 문서에 쓰지 않는다)
2. 터미널에서 SSH 접속: `ssh -p 22 ncloud@<서버 사설 IP>` (백엔드 서버: `10.1.1.14`)
3. 서버 OS: x86_64 리눅스 <!-- TODO: 배포판 이름 (cat /etc/os-release) -->

### 5-1. 백엔드 서버 처음 세팅

> 처음 한 번만 한다. 순서대로 진행한다.

**① 코드 받기**
```bash
cd ~
git clone https://github.com/BBossAndChildren/base-repo.git
cd base-repo/backend
```
- 모노레포라 백엔드 코드는 `base-repo/backend/` 에 있다. 백엔드가 읽는 지침 문서 `base-repo/docs/game/` 도 함께 받아진다
- 비공개 저장소면 GitHub 토큰 · 배포 키가 필요하다. 토큰 값은 문서 · 코드에 쓰지 않는다
- 배포 브랜치: <!-- TODO: develop 또는 main 중 어느 브랜치를 서버에 받을지 -->

**② 운영용 `.env` 준비**
```bash
cp .env.example .env    # 값은 직접 채운다 (3절). DJANGO_DEBUG 는 False
```

**③ 백엔드 · DB 실행 (Docker Compose — 백엔드 담당 구성)**
```bash
docker compose up --build -d --wait
# 호스트 Nginx 가 제공할 정적 파일을 이미지에서 복사한다
mkdir -p staticfiles
docker compose cp backend:/app/backend/staticfiles/. ./staticfiles/
docker compose exec backend python manage.py check --deploy
curl --fail http://127.0.0.1:8000/api/health
```
- 기본 `compose.yaml` 만 쓴다. Gunicorn WSGI 가 컨테이너에서 실행되고, Nginx · https(터널)는 호스트가 맡는다. PostgreSQL 도 같은 서버 컨테이너로 실행한다
- Compose 는 호스트 `127.0.0.1:8000` 만 공개한다. Gunicorn 은 컨테이너 안 8000, 타임아웃 60초 (채팅 대기 30초보다 길게)
- DB 가 healthy 가 되면 migration · 정적 파일 수집 후 서버를 시작한다. 여러 서버로 늘릴 때는 migration 을 별도 단계로 분리한다
- `staticfiles/` 는 컨테이너 `static_files` 볼륨과 별개인 호스트 복사본이다. 이미지를 바꾸면 다시 복사한다
- `.dockerignore` 는 `.env` · 가상환경 · 로컬 DB · 수집 결과 · Unity 바이너리를 이미지에서 뺀다. **`docs/game/` 은 이미지에 포함되므로 작가 문서가 바뀌면 이미지를 다시 빌드한다**
- WSGI 는 AI 응답을 기다리는 동안 thread 를 점유한다. 동시 요청량을 측정해 `WEB_CONCURRENCY` · `GUNICORN_THREADS` 를 조정한다
- 운영 DB 계정 · 백업은 배포 전에 확정한다. named volume 은 영구 저장 위치일 뿐 백업이 아니다
- 게임 API 의 30초 대기 제한과 HTTPX 타임아웃 · 재시도 구현은 후속 작업이다
- 로컬 검증은 실제 운영 배포 검증을 대신하지 않는다

**④ 3D 빌드 파일 올리기** — [5-2](#5-2-3d-빌드-파일-저장--관리--전달)

**⑤ Nginx 설치 · 설정**
```bash
sudo apt-get install -y nginx        # Ubuntu 기준
sudo nano /etc/nginx/sites-available/backend   # 아래 설정 붙여넣기
sudo ln -s /etc/nginx/sites-available/backend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```
```nginx
server {
    listen 127.0.0.1:80;          # 서버 안에서만. 외부는 터널로만 들어온다
    server_name _;

    # API → Django (CORS 헤더는 Django 가 붙인다. Nginx 에서 붙이지 않는다)
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;   # Cloudflare 가 https 로 받아 넘긴다
        proxy_read_timeout 60s;
    }

    location /static/ {
        alias /home/ncloud/base-repo/backend/staticfiles/;  # 5-1 ③ 에서 복사한 위치
    }

    # Unity WebGL 빌드 (현재 테스트 빌드는 비압축)
    location /builds/ {
        alias /srv/builds/;
        types {
            text/html                 html;
            application/javascript    js;
            application/wasm          wasm;
            application/octet-stream  data;
            application/json          json;
            audio/mpeg                mp3;
            text/css                  css;
        }
        # Vercel 프론트 페이지만 이 빌드를 iframe 으로 넣을 수 있게 한다
        add_header Content-Security-Policy "frame-ancestors https://<프로젝트>.vercel.app" always;
        # 프론트가 빌드의 연결 코드(frontend/client.js)와 지원 목록(supported-manifest.json)을 직접 불러온다 (05 4-1)
        add_header Access-Control-Allow-Origin "https://<프로젝트>.vercel.app" always;
        add_header Vary "Origin" always;
    }
}
```
- 비압축 빌드에 `Content-Encoding` 을 붙이지 않는다. Unity 담당이 Brotli · Gzip 압축 빌드를 주면 `/builds/` 안에 아래를 추가하고, 안쪽 블록에도 `Content-Security-Policy` 를 함께 넣는다 (안쪽 `add_header` 가 있으면 바깥 것이 이어지지 않는다)
```nginx
    location ~ .+\.(data|symbols\.json)\.br$ { add_header Content-Encoding br; default_type application/octet-stream; }
    location ~ .+\.js\.br$                   { add_header Content-Encoding br; default_type application/javascript; }
    location ~ .+\.wasm\.br$                 { add_header Content-Encoding br; default_type application/wasm; }
    # Gzip 은 .gz · Content-Encoding gzip 으로 같은 방식
```

**⑥ Cloudflare Tunnel 설치 · 실행**
```bash
# 설치 (한 줄로 붙여넣는다)
curl -L -o cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/
cloudflared --version

# 실행 (tmux 안에서 계속 켜 둔다)
tmux new -s tunnel
cloudflared tunnel --url http://127.0.0.1:80
# 출력의 https://<랜덤>.trycloudflare.com 이 백엔드 주소. Ctrl+B 누른 뒤 D
```
- 실행 전 확인: 서버에서 `curl -I https://www.cloudflare.com` 이 `HTTP/2 200` 이면 바깥 연결이 가능하다 (2026-10-31 확인 완료)
- 주소 확인: `tmux attach -t tunnel`

**⑦ 프론트에 주소 알리기** — [5-4](#터널-주소가-바뀌었을-때) 의 2~3번

#### 코드 업데이트할 때
```bash
cd ~/base-repo && git pull && cd backend
docker compose up --build -d --wait
docker compose cp backend:/app/backend/staticfiles/. ./staticfiles/
```
- 작가 문서(`docs/game/`)만 바뀌어도 이미지를 다시 빌드한다
- 터널은 끄지 않는다. 끄면 주소가 바뀐다

#### CORS — Django 가 담당
| 항목 | 설정 |
|------|------|
| 담당 | **백엔드(Django, django-cors-headers)** 가 API 응답에 붙인다. Nginx 는 붙이지 않는다 (중복되면 브라우저가 거부) |
| 허용 출처 | `CORS_ALLOWED_ORIGINS` = Vercel 주소 (`https://<프로젝트>.vercel.app`), 로컬 개발 때 `http://localhost:<포트>` 추가. `*` 는 쓰지 않는다 |
| 허용 헤더 | 기본 헤더 + `x-player-id` (`CORS_ALLOW_HEADERS` 에 추가). 이 헤더 때문에 브라우저가 사전 요청(OPTIONS)을 보낸다 |
| 허용 메서드 | `GET` · `POST` · `OPTIONS` |
| 쿠키 | 쓰지 않으므로 `CORS_ALLOW_CREDENTIALS = False` |
| 빌드 파일 | 화면은 iframe 이라 Nginx `frame-ancestors` 로 허용한다. 프론트가 빌드의 `frontend/client.js` · `supported-manifest.json` 을 직접 불러오므로 `/builds/` 에는 Nginx 가 `Access-Control-Allow-Origin` 도 붙인다 (API CORS 와 경로가 달라 중복되지 않음) |
| Django 기타 | `ALLOWED_HOSTS` 에 `.trycloudflare.com`, `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')` |

### 5-2. 3D 빌드 파일 저장 · 관리 · 전달

| 항목 | 규칙 |
|------|------|
| 저장 위치 | 백엔드 서버 폴더 `/srv/builds/<buildId>/`. Unity 가 준 `site/` 폴더 내용을 그대로 둔다 (`index.html` · `Build/` 등) |
| Git | **빌드 파일은 Git 저장소에 넣지 않는다.** 수십 MB 바이너리라 GitHub 제한(50MB 경고 · 100MB 차단)에 걸리고 저장소가 계속 커진다. 저장소에는 빌드 카탈로그 JSON 만 둔다 |
| 올리는 방법 | VPN 을 켠 PC 에서 `scp -r site/ ncloud@10.1.1.14:/tmp/<buildId>/` 로 보낸 뒤 서버에서 `sudo mkdir -p /srv/builds && sudo mv /tmp/<buildId> /srv/builds/`. 새 `buildId` 는 새 폴더에 두고 기존 폴더는 덮어쓰지 않는다 |
| 카탈로그 반영 | 빌드를 올린 뒤 Unity 가 준 카탈로그 · 허용 목록(`docs/unity/builds/production-*`)을 백엔드에 반영한다 ([10 4-1](10-prompt-assembly.md#4-1-빌드-카탈로그-unity-제공)) |
| 프론트 전달 | 채팅 응답의 `experience.buildUrl` 로 준다. 터널 주소가 바뀌므로 백엔드는 **요청이 들어온 주소(Host) 기준으로** `https://<현재 터널 주소>/builds/<buildId>/` 를 만든다. 카탈로그에는 `/builds/<buildId>/` 경로만 둔다 |
| 지우기 | 카탈로그에서 뺀 빌드는 진행 중인 체험이 없을 때 폴더를 지운다 |

### 5-3. AI 서버 (GPU 서버)
- 제공받은 네이버 클라우드 GPU 서버. 오픈소스 **Qwen + 직업 데이터 RAG** 를 띄운다 ([10 6절](10-prompt-assembly.md#6-직업-데이터-rag-ai-서버)). 접속은 [5-0](#5-0-서버-접속-백엔드--ai-공통) 과 같다 <!-- TODO: 사설 IP · 포트 · OS -->
- 백엔드 → AI 서버 호출에는 항상 `X-Internal-Key` 를 붙이고, AI 서버는 키가 없거나 틀리면 401 로 거부한다 (값은 `AI_SERVER_KEY`)
- **Nginx 는 필요 없다.** API 하나만 있으므로 앱 포트로 바로 연결한다
- AI 서버 코드는 **별도 저장소**다. AI 담당은 base-repo 를 함께 열어 두거나 submodule 로 연결하고, 그 저장소 `AGENTS.md` 에 꼭 읽을 문서([03 2부](03-api.md#2부-백엔드--ai-서버) · [10](10-prompt-assembly.md))를 적는다

#### 먼저 확인: 백엔드에서 사설망으로 닿는가
```bash
# 백엔드 서버(10.1.1.14)에서
curl -m 5 http://<GPU 서버 사설 IP>:<AI 포트>/
```
| 결과 | 진행 |
|------|------|
| 응답이 온다 | **터널을 쓰지 않는다.** `AI_API_BASE_URL=http://<GPU 사설 IP>:<포트>` 로 사설망 호출. AI 서버는 외부에 공개되지 않는다 (권장) |
| 시간 초과 · 연결 거부 | 서버 사이에도 ACG 가 막고 있는 것이다. 아래 터널로 연결한다 |

#### 사설망이 막혀 있을 때만: GPU 서버에 터널
```bash
# GPU 서버에서 (설치는 5-1 ⑥ 과 같다)
curl -I https://www.cloudflare.com          # HTTP/2 200 이면 가능
tmux new -s ai-tunnel
cloudflared tunnel --url http://127.0.0.1:<AI 포트>
# 출력된 https://<랜덤>.trycloudflare.com 을 백엔드 .env 의 AI_API_BASE_URL 에 넣고 백엔드 재시작 (`docker compose up -d`)
```
- AI 앱은 `127.0.0.1` 에만 열고 외부 공개는 터널로만 한다
- 터널 주소는 인터넷에 공개되므로 **`X-Internal-Key` 검사가 반드시 켜져 있어야 한다.** 주소는 프론트 · 문서 · 채팅에 공유하지 않는다
- 터널 주소가 바뀌면 백엔드 `.env` 의 `AI_API_BASE_URL` 만 바꾸고 백엔드를 재시작한다 (`docker compose up -d`) (프론트는 바꿀 것 없음)

### 5-4. 웹 프론트 — Vercel
- Vercel 에 `base-repo` 를 연결하고 **Root Directory 를 `frontend`** 로 설정한다. **https 는 Vercel 이 자동으로 처리한다**
- `docs/` 만 바뀐 커밋으로 재배포되지 않게 Ignored Build Step 을 설정한다 (예: `git diff --quiet HEAD^ HEAD -- frontend/`)
- 환경변수 `VITE_API_BASE_URL` 에 현재 터널 주소를 넣는다
- SPA 라우팅이면 새로고침 404 를 막는 rewrites 설정 <!-- TODO: 프론트 구조 확정 후 -->
- Vercel 주소가 정해지면 백엔드 `CORS_ALLOWED_ORIGINS` 와 Nginx `frame-ancestors` 에 등록한다

#### 터널 주소가 바뀌었을 때
> `cloudflared` 재실행 · 서버 재시작 · 터널 끊김 때 주소가 바뀐다.

1. 서버에서 `tmux attach -t tunnel` 로 새 주소를 확인한다 (꺼져 있으면 5-1 ⑥ 다시 실행)
2. Vercel 환경변수 `VITE_API_BASE_URL` 을 새 주소로 바꾼다
3. Vercel 에서 **다시 배포(Redeploy)** 한다 (환경변수는 빌드 때 들어가므로 재배포해야 반영된다)
4. 백엔드 · Nginx 설정은 바꾸지 않는다 (`ALLOWED_HOSTS` 가 `.trycloudflare.com` 전체를 허용하고, 빌드 주소는 요청 주소 기준으로 만든다)

### 5-5. 배포 순서
1. AI 서버 실행 → 2. 백엔드 세팅 (5-1 ①~⑤, Docker) → 3. 빌드 파일 업로드 · 카탈로그 반영 (5-2) → 4. 터널 실행 (5-1 ⑥) → 5. Vercel 배포 (5-4) → 6. Vercel 주소를 백엔드 CORS · Nginx frame-ancestors 에 등록

## 6. 배포 후 확인
- [ ] VPN 을 끈 휴대폰(LTE)에서 `https://<터널 주소>/api/v1/...` 가 응답한다
- [ ] Vercel 주소에서 API 호출 시 CORS 오류가 없다 (브라우저 개발자 도구 Network)
- [ ] Vercel 페이지에서 빌드 iframe 이 열리고, 다른 주소에서는 열리지 않는다 (`frame-ancestors`)
- [ ] `.wasm` 응답의 Content-Type 이 `application/wasm` 이다
- [ ] Gunicorn(8000) · Nginx(80) 가 외부가 아니라 `127.0.0.1` 에만 열려 있다 (`ss -tlnp`)
- [ ] AI 서버는 백엔드에서만 호출된다. 터널을 쓴 경우 키 없는 요청이 401 로 거부된다

## 7. 트러블슈팅
| 증상 | 원인 | 해결 |
|------|------|------|
| 프론트에서 갑자기 모든 API 가 실패 | 터널 주소가 바뀜 (cloudflared 재실행 · 서버 재시작) | [터널 주소가 바뀌었을 때](#터널-주소가-바뀌었을-때) |
| SSH 를 끊었더니 터널이 멈춤 | tmux 밖에서 실행함 | cloudflared 를 tmux 안에서 실행 (백엔드는 Docker 가 계속 실행) |
| 채팅이 30초 부근에서 `TIMEOUT` 대신 502 로 끊김 | Gunicorn 기본 worker 타임아웃(30초)이 채팅 대기 시간(30초)과 같음 | Gunicorn `--timeout 60`, HTTPX 타임아웃은 그보다 짧게 |
| 여러 명이 동시에 채팅하면 응답이 밀림 | WSGI worker 하나가 AI 응답을 기다리는 동안 다른 요청을 못 받음 | worker 수를 늘리거나 `--threads` 사용 |
| 3D 체험이 "불러오지 못했어요" 로 바로 닫힘 | 빌드의 `client.js` · `supported-manifest.json` 을 CORS 때문에 못 불러옴 | `/builds/` 에 `Access-Control-Allow-Origin` (5-1 ⑤) |
| 3D 빌드가 브라우저에서 안 열림 | `.wasm` Content-Type 누락, 비압축 빌드에 `Content-Encoding` 을 붙임, `frame-ancestors` 에 Vercel 주소 누락 | 5-1 ⑤ Nginx 설정 확인 |
| 프론트에서 API 호출 시 CORS 오류 | 허용 출처에 Vercel 주소 없음, `x-player-id` 헤더 미허용, Nginx 와 Django 가 헤더를 중복으로 붙임 | [CORS](#cors--django-가-담당) 확인 |
| Django 가 400 Bad Request | `ALLOWED_HOSTS` 에 터널 주소 없음 | `.trycloudflare.com` 추가 |

## 8. 민감정보 관리 체크
- [x] `.env` 가 `.gitignore` 에 있다
- [ ] 코드 · 문서에 키 값 · VPN 계정 · GitHub 토큰이 없다
