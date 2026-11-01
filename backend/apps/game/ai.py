import asyncio
import time

import httpx
from django.conf import settings
from rest_framework.exceptions import ValidationError

from .catalog import find_experience, load_catalog, select_candidates
from .common import GameError
from .content import content_bundle, read_markdown
from .serializers import AIChatResponseSerializer, AIRecommendationResponseSerializer

OPTIONAL_PROFILE_FIELDS = (
    "gender",
    "interests",
    "majorOrGrade",
    "strengths",
    "values",
    "roleModel",
    "mbti",
)


def read_content(path):
    return read_markdown(path)


async def _request(path, payload, remaining):
    # 비동기 HTTP I/O에 전체 deadline을 적용한다. Django 요청 처리 방식은 WSGI다.
    async with asyncio.timeout(remaining):
        async with httpx.AsyncClient(timeout=remaining, follow_redirects=False) as client:
            response = await client.post(
                settings.AI_API_BASE_URL.rstrip("/") + path,
                headers={"X-Internal-Key": settings.AI_SERVER_KEY},
                json=payload,
            )
            response.raise_for_status()
            return response.json()


def call_ai(path, payload, response_serializer, deadline, attempts=2):
    if not settings.AI_API_BASE_URL or not settings.AI_SERVER_KEY:
        raise GameError(502, "AI_UNAVAILABLE", "AI 서버 연결 설정이 필요합니다.")
    for attempt in range(attempts):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise GameError(504, "TIMEOUT", "응답 시간이 초과되었습니다.")
        try:
            raw = asyncio.run(_request(path, payload, remaining))
            serializer = response_serializer(data=raw)
            serializer.is_valid(raise_exception=True)
            if time.monotonic() > deadline:
                raise GameError(504, "TIMEOUT", "응답 시간이 초과되었습니다.")
            return serializer.validated_data["data"]
        except (TimeoutError, httpx.TimeoutException):
            raise GameError(504, "TIMEOUT", "응답 시간이 초과되었습니다.") from None
        except (httpx.HTTPError, ValueError, ValidationError):
            if attempt == attempts - 1:
                raise GameError(502, "AI_UNAVAILABLE", "AI 응답을 받지 못했습니다.") from None


def chat(state, turns, message, deadline, attempts=2):
    guidelines, scenario = content_bundle()
    player = state.copy()
    player["missingProfileFields"] = [
        key for key in OPTIONAL_PROFILE_FIELDS if not state.get("profile", {}).get(key)
    ]
    history = []
    for turn in turns[-20:]:
        if turn["input"]:
            history.append({"role": "user", "text": turn["input"]})
        history.extend({"role": "npc", **message} for message in turn["messages"])
    payload = {
        "guidelines": guidelines,
        "scenario": scenario,
        "player": player,
        "history": history[-40:],
        "input": message,
    }
    return call_ai("/ai/v1/chat", payload, AIChatResponseSerializer, deadline, attempts)


def recommend(state, branch, situation, history, base_url, deadline):
    catalog = load_catalog()
    candidates = select_candidates(catalog, state, branch, history)
    if not candidates:
        return None

    try:
        data = call_ai(
            "/ai/v1/experience-recommendation",
            {
                "candidates": candidates,
                "branch": branch,
                "situation": situation,
                "player": state,
            },
            AIRecommendationResponseSerializer,
            deadline,
        )
        return (
            find_experience(data, candidates, catalog, base_url, branch["reason"])
            if data["found"]
            else None
        )
    except GameError:
        if time.monotonic() >= deadline:
            raise GameError(504, "TIMEOUT", "응답 시간이 초과되었습니다.") from None
        return None


def ending(state, candidates, experienced_jobs, deadline):
    """별도 GPU 서버의 결말 생성 계약. 직업 사실/RAG는 AI 서버가 제공한다."""
    from .serializers import AIEndingResponseSerializer

    return call_ai(
        "/ai/v1/ending",
        {
            "guidelines": read_content(settings.GAME_GUIDELINES_PATH),
            "player": state,
            "candidates": candidates,
            "experiencedJobs": experienced_jobs,
        },
        AIEndingResponseSerializer,
        deadline,
    )
