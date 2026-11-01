"""채팅 분기 없이 화면 카드에서 3D 체험을 추천한다 (#163, 12 결정 31)."""

import random

from django.db import transaction

from .catalog import IDENTITY_FIELDS, load_catalog, overlaps
from .common import GameError, is_ended
from .models import ExperienceOffer, Play

REASONS = {
    "currentJob": "지금 하는 일을 3D 공간에서 직접 해 봐요.",
    "dreamJob": "되고 싶다고 한 일을 3D 공간에서 미리 해 봐요.",
    "random": "아직 해 보지 않은 일을 골랐어요. 3D 공간에서 해 봐요.",
}


def pick(pool, state, shuffle):
    """현재 직업 → 희망 직업 → 무작위. 다시 고르기(shuffle)는 바로 무작위"""
    if not shuffle:
        occupation = state.get("occupation") or {}
        profile = state.get("profile") or {}
        for basis, job in (
            ("currentJob", occupation.get("currentJob")),
            ("dreamJob", profile.get("dreamJob")),
        ):
            if not job:
                continue
            matches = [item for item in pool if any(overlaps(job, name) for name in item["jobs"])]
            if matches:
                return basis, job, random.choice(matches)
    item = random.choice(pool)
    return "random", (item["jobs"] or [item["title"]])[0], item


def suggest(play, exclude, base_url):
    with transaction.atomic():
        locked = Play.objects.select_for_update().get(pk=play.pk)
        if is_ended(locked):
            raise GameError(409, "ALREADY_ENDED", "이미 끝난 플레이입니다.")
        if locked.paused:
            raise GameError(409, "PLAY_PAUSED", "일시정지를 해제해 주세요.")
        catalog = [item for item in load_catalog()["experiences"] if item.get("jobs")]
        if not catalog:
            raise GameError(503, "CONTENT_UNAVAILABLE", "3D 체험 목록을 불러오지 못했어요.")
        state = locked.state or {}
        done = {item.get("scenarioId") for item in state.get("experiences", [])}
        excluded = set(exclude)
        pool = (
            [item for item in catalog if item["scenarioId"] not in done | excluded]
            or [item for item in catalog if item["scenarioId"] not in done]
            or catalog
        )
        basis, job, item = pick(pool, state, shuffle=bool(excluded))
        offer = {
            **{field: item[field] for field in IDENTITY_FIELDS},
            "buildUrl": base_url.rstrip("/") + "/builds/" + item["buildId"] + "/",
            "title": item["title"],
            "jobs": item["jobs"],
            "reason": REASONS[basis],
        }
        ExperienceOffer.objects.create(play=locked, payload=offer)
        return {
            **offer,
            "basis": basis,
            "job": job,
            "roomName": item.get("roomName", ""),
            "description": item.get("description", ""),
        }
