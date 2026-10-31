import re
from functools import lru_cache
from pathlib import Path

from django.conf import settings

from .common import GameError


@lru_cache(maxsize=64)
def read_markdown(path, required=True):
    try:
        text = Path(path).read_text(encoding="utf-8") if path else ""
    except (OSError, UnicodeError):
        text = ""
    text = re.sub(r"<!--.*?-->", "", text, flags=re.DOTALL).strip()
    if required and not text:
        raise GameError(503, "CONTENT_UNAVAILABLE", "가이드라인 준비가 필요합니다.")
    return text


def content_bundle():
    root = Path(settings.GAME_CONTENT_DIR)
    guidelines = read_markdown(settings.GAME_GUIDELINES_PATH)
    latest_rules = read_markdown(str(root / "06-life-career-design.md"))
    paths = [
        root / "01-world.md",
        settings.GAME_SCENARIO_PATH,
        root / "03-rules.md",
        root / "05-npc.md",
    ]
    scenario = "\n\n".join(
        text for path in paths if (text := read_markdown(str(path), required=False))
    )
    scenario += "\n\n[최신 규칙: 이전 초안과 충돌하면 아래 문서를 우선 적용]\n" + latest_rules
    return guidelines, scenario
