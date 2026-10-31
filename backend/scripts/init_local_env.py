"""로컬 전용 설정 생성. 기존 .env와 실제 비밀값은 출력하지 않는다."""

import secrets
from pathlib import Path

path = Path(__file__).resolve().parents[1] / ".env"
values = {
    "DJANGO_SECRET_KEY": secrets.token_urlsafe(64),
    "DJANGO_DEBUG": "True",
    "ALLOWED_HOSTS": "localhost,127.0.0.1,[::1]",
    "CORS_ALLOWED_ORIGINS": (
        "https://base-repo-zeta.vercel.app,https://base-repo-ck83.vercel.app,"
        "http://localhost:5173,http://127.0.0.1:5173"
    ),
    "CSRF_TRUSTED_ORIGINS": "http://localhost:5173,http://127.0.0.1:5173",
    "DB_HOST": "127.0.0.1",
    "DB_PORT": "5432",
    "DB_NAME": "career_game",
    "DB_USER": "career_app",
    "DB_PASSWORD": secrets.token_urlsafe(32),
    "DB_SSLMODE": "prefer",
    "AI_API_BASE_URL": "",
    "AI_SERVER_KEY": "",
}
with path.open("x", encoding="utf-8") as output:
    path.chmod(0o600)
    output.write("\n".join(f"{key}={value}" for key, value in values.items()) + "\n")
print("backend/.env 생성 완료 (로컬 전용, 기존 파일이 있으면 덮어쓰지 않음)")
