import json
import random
import re
from pathlib import Path

from django.conf import settings

IDENTITY_FIELDS = ("buildId", "roomId", "scenarioId", "scenarioVersion")
AI_FIELDS = (*IDENTITY_FIELDS, "jobs", "description")
DEFAULT_CATALOG = settings.BASE_DIR.parent / "docs/unity/builds/production-ai-build-catalog.json"
DEFAULT_MANIFEST = settings.BASE_DIR.parent / "docs/unity/builds/production-supported-manifest.json"


def identity(item):
    return tuple(item[field] for field in IDENTITY_FIELDS)


def load_catalog():
    path = (
        Path(settings.GAME_BUILD_CATALOG_PATH)
        if settings.GAME_BUILD_CATALOG_PATH
        else DEFAULT_CATALOG
    )
    try:
        catalog = json.loads(path.read_text(encoding="utf-8"))
        manifest = json.loads(DEFAULT_MANIFEST.read_text(encoding="utf-8"))
        supported = {identity(item): item for item in manifest["supported"]}
        experiences = [
            item
            | {
                "title": supported[identity(item)]["title"],
                "roomName": supported[identity(item)].get("roomName", ""),
            }
            for item in catalog["experiences"]
            if identity(item) in supported
        ]
        return {"experiences": experiences}
    except (OSError, ValueError, TypeError, KeyError):
        return {"experiences": []}


def normalized(value):
    return re.sub(r"[\s·ㆍ()]+", "", value.casefold())


def overlaps(left, right):
    a, b = normalized(left), normalized(right)
    return bool(a and b and (a in b or b in a))


def select_candidates(catalog, state, branch, history):
    profile = state.get("profile", {})
    seen = {item.get("scenarioId") for item in state.get("experiences", [])}
    dialogue = " ".join(
        text
        for turn in history
        for text in [
            turn.get("input", ""),
            *(msg.get("text", "") for msg in turn.get("messages", [])),
        ]
    )
    words = [*profile.get("interests", []), *profile.get("strengths", [])]
    topic_words = re.findall(r"[가-힣A-Za-z0-9]+", branch.get("topic", ""))
    scored = []
    for item in catalog["experiences"]:
        if item["scenarioId"] in seen:
            continue
        jobs = item.get("jobs", [])
        description = item.get("description", "")
        score = 0
        if any(overlaps(profile.get("dreamJob", ""), job) for job in jobs):
            score += 10
        if any(overlaps(job, dialogue) for job in jobs):
            score += 5
        score += min(6, 2 * sum(overlaps(word, description) for word in words))
        if any(overlaps(branch_job, job) for branch_job in branch.get("jobs", []) for job in jobs):
            score += 8
        if any(overlaps(word, " ".join(jobs) + description) for word in topic_words):
            score += 5
        scored.append((score, item))
    ranked = sorted(scored, key=lambda pair: (-pair[0], identity(pair[1])))
    chosen = [item for score, item in ranked if score > 0][:12]
    used = {identity(item) for item in chosen}
    rooms = {item["roomId"] for item in chosen}
    pool = [
        item for _, item in ranked if identity(item) not in used and item["roomId"] not in rooms
    ]
    random.shuffle(pool)
    for item in pool:
        if len(chosen) >= 20:
            break
        if item["roomId"] not in rooms:
            chosen.append(item)
            rooms.add(item["roomId"])
    return [
        {key: item.get(key, [] if key == "jobs" else "") for key in AI_FIELDS} for item in chosen
    ]


def find_experience(selection, candidates, catalog, base_url, reason):
    for item in candidates:
        if identity(item) == tuple(selection.get(field) for field in IDENTITY_FIELDS):
            source = next(
                (row for row in catalog["experiences"] if identity(row) == identity(item)), None
            )
            if source is None:
                return None
            return {
                **{field: item[field] for field in IDENTITY_FIELDS},
                "buildUrl": base_url.rstrip("/") + "/builds/" + item["buildId"] + "/",
                "title": source["title"],
                "jobs": source["jobs"],
                "reason": reason,
            }
    return None
