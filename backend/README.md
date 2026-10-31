# 어른왕자 백엔드

Django · DRF · PostgreSQL 기반 API 서버.

- 구조: [시스템 설계](../docs/development/02-architecture.md#3-디렉터리-구조)
- 설치 · 실행 · 검증: [실행 안내](../docs/development/06-deployment.md#2-설치)
- 계약: [API 명세](../docs/development/03-api.md)
- 구현된 API 목록 · 기능별 테스트 결과 · 작업 규칙: [backend.md](../docs/development/backend.md)

현재 구현: `GET /api/health`, `/api/schema/`, `/api/docs/`. 게임 API · AI 호출은 후속 구현 대상이다.

기존 `.env`가 있으면 그대로 사용한다. 없으면 `python3 scripts/init_local_env.py`로 생성한다.

```bash
# backend/에서 개발용 API + PostgreSQL 실행
docker compose -f compose.yaml -f compose.dev.yaml up --build -d --wait
# 컨테이너 내부의 실제 PostgreSQL 테스트
docker compose exec backend python manage.py test
# 중지 (DB 볼륨은 유지)
docker compose -f compose.yaml -f compose.dev.yaml stop
```

Swagger: http://127.0.0.1:8000/api/docs/. 기본 `docker compose up --build -d --wait`는 Gunicorn WSGI로 실행한다. 컨테이너에서는 DB를 `db:5432`로 연결하며, 기존 호스트 PostgreSQL 데이터는 자동으로 옮기지 않는다. 개발 DB를 호스트 도구로 볼 때는 기본 `127.0.0.1:5433`을 사용한다.
