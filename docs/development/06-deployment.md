# 06. 설치 · 실행 · 배포

> 관련 문서: [02-architecture.md](02-architecture.md) · [03-api.md](03-api.md)
> 배포 플랫폼: 백엔드 = 네이버 클라우드 일반 서버 (Gunicorn), AI 서버 = 네이버 클라우드 GPU 서버, 3D 빌드 파일 = 백엔드 서버 폴더 + Nginx, 웹 프론트 = 미정 ([11](11-open-issues.md#a-스펙-미확정-항목))

## 1. 요구 환경
| 도구 | 버전 | 고정 방법 |
|------|------|-----------|
| | | <!-- 예: .nvmrc --> |

## 2. 설치
### 백엔드
```bash
```
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
| `AI_SERVER_KEY` | 백엔드 · AI 서버 | ✅ | 백엔드 → AI 서버 내부 호출 키 (헤더 `X-Internal-Key`). 두 서버에 같은 값 |
| | | | |

## 4. 로컬 실행 확인
```bash
```

## 5. 배포
### 5-1. 백엔드 (game/ 마크다운 · 3D 빌드 · 빌드 카탈로그 JSON 포함)

#### 구성
```
브라우저 ── https ──▶ Nginx ─┬─ /api/     ──▶ Gunicorn (Django)
                             └─ /builds/  ──▶ 서버 폴더 /srv/builds/ (Nginx 가 직접 내려줌)
```
- **3D 빌드 파일은 백엔드 서버 폴더(`/srv/builds/<buildId>/`)에 두고 Nginx 가 내려준다.** Django 로 내려주면 큰 파일을 보내는 동안 Gunicorn worker 가 묶여 다른 요청이 밀린다
- **빌드 파일은 Git 저장소에 넣지 않는다.** 수십 MB 바이너리라 GitHub 제한(50MB 경고 · 100MB 차단)에 걸리고 저장소가 계속 커진다. 저장소에는 빌드 카탈로그 JSON 만 두고, 빌드는 배포 때 서버 폴더로 복사한다 <!-- TODO: 복사 방법 (scp 등) -->
- 빌드 카탈로그의 `buildUrl` 은 `/builds/<buildId>/` 형태로 쓴다
- 프론트가 https 로 열리면 브라우저가 http 호출을 막으므로 **백엔드 · 빌드 주소도 https 여야 한다.** 서버에 도메인과 SSL 인증서가 필요하다

#### Unity WebGL 빌드용 Nginx 헤더 설정 (예시)

> Unity 공식 서버 설정 예시 기준. **빌드 압축 방식(Brotli · Gzip · 없음)에 따라 필요한 블록만 쓴다** — 압축 방식은 Unity 담당 확인 필요 ([11 F3](11-open-issues.md#f-확인이-필요한-질문)). Brotli(`.br`)는 https 에서만 브라우저가 풀 수 있다.

```nginx
location /builds/ {
    alias /srv/builds/;
    # 프론트가 다른 주소에서 불러오므로 허용 (프론트 배포 주소로 바꾼다)
    add_header Access-Control-Allow-Origin "https://<프론트 주소>" always;

    # Brotli 압축 빌드
    location ~ .+\.(data|symbols\.json)\.br$ { gzip off; add_header Content-Encoding br; default_type application/octet-stream; }
    location ~ .+\.js\.br$                   { gzip off; add_header Content-Encoding br; default_type application/javascript; }
    location ~ .+\.wasm\.br$                 { gzip off; add_header Content-Encoding br; default_type application/wasm; }

    # Gzip 압축 빌드
    location ~ .+\.(data|symbols\.json)\.gz$ { gzip off; add_header Content-Encoding gzip; default_type application/octet-stream; }
    location ~ .+\.js\.gz$                   { gzip off; add_header Content-Encoding gzip; default_type application/javascript; }
    location ~ .+\.wasm\.gz$                 { gzip off; add_header Content-Encoding gzip; default_type application/wasm; }

    # 압축 안 한 빌드
    location ~ .+\.wasm$ { default_type application/wasm; }
}
```
- 안쪽 `location` 에서 `add_header` 를 쓰면 바깥 `add_header` 가 이어지지 않는다. 실제 설정 때 CORS 헤더를 안쪽 블록에도 넣는다
### 5-2. AI 서버
### 5-3. 웹 프론트
### 5-4. 배포 순서

## 6. 배포 후 확인
<!-- 외부망 접속, CORS, 헬스체크 -->

## 7. 트러블슈팅
| 증상 | 원인 | 해결 |
|------|------|------|
| 채팅이 30초 부근에서 `TIMEOUT` 대신 502 로 끊김 | Gunicorn 기본 worker 타임아웃(30초)이 채팅 대기 시간(30초)과 같아, 앱이 `TIMEOUT` 응답을 만들기 전에 worker 가 강제 종료됨 | Gunicorn `--timeout` 을 채팅 대기 시간보다 길게 (예: 60초), HTTPX 타임아웃은 그보다 짧게 둔다 |
| 여러 명이 동시에 채팅하면 응답이 밀림 | WSGI worker 하나가 AI 응답을 기다리는 동안 다른 요청을 못 받음 | worker 수를 동시 접속 예상치에 맞게 늘리거나 thread worker(`--threads`) 사용 |
| 3D 빌드가 브라우저에서 안 열림 | `.wasm` · 압축(`.br` · `.gz`) 파일의 Content-Type · Content-Encoding 헤더 누락, 또는 http 에서 Brotli 사용 | [5-1 Nginx 헤더 설정](#unity-webgl-빌드용-nginx-헤더-설정-예시) 적용, https 사용 |
| 프론트에서 API 호출 시 CORS 오류 | 허용 출처 미설정 | django-cors-headers 에 프론트 배포 주소 등록 |

## 8. 민감정보 관리 체크
- [ ] `.env` 가 `.gitignore` 에 있다
- [ ] 코드·문서에 키 값이 없다
