# 어른왕자 백엔드

Django · DRF · PostgreSQL 기반 API 서버.

- 구조: [시스템 설계](../docs/development/02-architecture.md#3-디렉터리-구조)
- 설치 · 실행 · 검증: [실행 안내](../docs/development/06-deployment.md#2-설치)
- 계약: [API 명세](../docs/development/03-api.md)
- 구현된 API 목록 · 기능별 테스트 결과 · 작업 규칙: [backend.md](../docs/development/backend.md)

현재 구현: 게스트 발급·게임 시작·대화·재개·목록·결말과 Unity 이벤트·정산·생존 신호·종료 대기 기록 등 일시정지·해제를 포함한 게임 API 11개, 상태 확인·OpenAPI·Swagger. AI 대화·체험 추천·결말은 백엔드의 HTTP 호출 계약이며 실제 GPU 서버 구현은 별도다.

기존 `.env`가 있으면 그대로 사용한다. 없으면 `python3 scripts/init_local_env.py`로 생성한다.

```bash
# backend/에서 개발용 API + PostgreSQL 실행
docker compose -f compose.yaml -f compose.dev.yaml up --build -d --wait
# 컨테이너 내부의 실제 PostgreSQL 테스트
docker compose exec backend python manage.py test
# 중지 (DB 볼륨은 유지)
docker compose -f compose.yaml -f compose.dev.yaml stop
```

Swagger: http://127.0.0.1:8000/api/docs/ (`BACKEND_PORT` 기본값 8000). 호스트 포트를 바꾼 경우 `docker compose port backend 8000`으로 실제 주소를 확인한다. 기본 `docker compose up --build -d --wait`는 Gunicorn WSGI로 실행한다. 컨테이너에서는 DB를 `db:5432`로 연결하며, 기존 호스트 PostgreSQL 데이터는 자동으로 옮기지 않는다. 개발 DB를 호스트 도구로 볼 때는 기본 `127.0.0.1:5433`을 사용한다.

게임 콘텐츠는 시작 시 `docs/game/`에서 읽어 캐시하고 HTML 주석을 제외한다. `GAME_CONTENT_DIR`로 문서 폴더를, `GAME_GUIDELINES_PATH`·`GAME_SCENARIO_PATH`·`GAME_CAREER_MATCHING_PATH`(직업체험 매칭 지침, 기본 `07-career-matching-and-rating-v001.md`, 없으면 생략)로 개별 파일을 지정할 수 있다. 설정을 생략하면 기본 경로를 쓴다. 필수 가이드라인 또는 `06-life-career-design.md`가 없거나 비면 시작하지 않으며, 문서를 수정한 뒤에는 백엔드를 재시작한다.

AI 서버 호출 3개: `POST /ai/v1/chat`(대화·검증할 행동 제안), `/ai/v1/experience-recommendation`(허용 후보 중 선택), `/ai/v1/ending`(결말·추천 3개). `AI_API_BASE_URL`·`AI_SERVER_KEY` 설정이 필요하다. 내부 키·전체 제한 시간·1회 재요청·응답 검증을 적용하며 모의 서버 검증은 실제 GPU/RAG 검증과 구분한다.

채팅은 `requestId` UUID가 필수이며 같은 행동의 재시도에 같은 값을 쓴다. 전체 `state`와 `stateVersion`을 반환한다. 일시정지는 `PATCH /api/v1/plays/{playId}`에 `{"paused":true/false}`로 요청한다. 최신 객체·AI 행동/기억 제안 형식은 API 명세 마지막 절을 따른다.
