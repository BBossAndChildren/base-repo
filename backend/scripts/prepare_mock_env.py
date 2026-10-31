"""실제 AI 설정은 보존하고 로컬 mock 통신용 키만 추가한다."""

import secrets
from pathlib import Path

path = Path(__file__).resolve().parents[1] / ".env"
if not path.exists():
    raise SystemExit("먼저 scripts/init_local_env.py로 .env를 준비하세요.")
lines = path.read_text(encoding="utf-8").splitlines()
existing = next(
    (line.split("=", 1)[1].strip() for line in lines if line.startswith("MOCK_AI_KEY=")), ""
)
if not existing:
    lines = [line for line in lines if not line.startswith("MOCK_AI_KEY=")]
    lines.append("MOCK_AI_KEY=" + secrets.token_urlsafe(32))
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    path.chmod(0o600)
print("테스트 서버 전용 키 준비 완료. 실제 AI 키·주소는 변경하지 않았습니다.")
