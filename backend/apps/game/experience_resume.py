"""현재 채팅 턴의 체험 제안만 복원한다. 조회로 시작·종료를 추정하거나 저장하지 않는다."""

from django.db import transaction
from django.db.models import Q

from .catalog import IDENTITY_FIELDS, find_experience, load_catalog
from .common import GameError, is_ended
from .models import Play


def observed_experience(play, turn):
    offer = turn.response["experience"]
    return (
        play.experiences.filter(
            Q(session_id=str(play.session_id)) | Q(session_id=""),
            Q(updated_at__gte=turn.created_at) | Q(fenced=False),
            **{f"metadata__{key}": offer.get(key) for key in IDENTITY_FIELDS},
        )
        .order_by("-updated_at", "-pk")
        .first()
    )


def is_dismissed(play, turn):
    return play.progress.get("experienceDismissal") == {
        "offerId": str(turn.pk),
        "sessionId": str(play.session_id),
    }


def resume_experience(play, turn, base_url):
    result = {"experience": None, "experienceState": None, "hints": []}
    if not turn or is_ended(play):
        return result
    result["hints"] = turn.response.get("hints", [])
    offer = turn.response.get("experience")
    if not isinstance(offer, dict):
        return result
    state = {
        "offerId": str(turn.pk),
        "lifecycleStatus": "offered",
        "experienceId": None,
        "outcome": None,
    }
    result["experienceState"] = state
    experience = observed_experience(play, turn)
    if experience:
        state["lifecycleStatus"] = experience.lifecycle_status
        state["experienceId"] = experience.external_id
        if experience.ended_event:
            state["lifecycleStatus"] = "ended"
            state["outcome"] = (experience.ended_event.get("result") or {}).get("outcome")
        elif experience.events.filter(type="experience.error").exists():
            state["lifecycleStatus"] = "error"
        result["hints"] = []
        return result
    if is_dismissed(play, turn):
        state["lifecycleStatus"] = "declined"
        result["hints"] = []
        return result
    try:
        current = find_experience(offer, [offer], load_catalog(), base_url, offer.get("reason", ""))
    except (KeyError, TypeError, ValueError):
        current = None
    if current:
        result["experience"] = {**current, "offerId": str(turn.pk)}
    else:
        state["lifecycleStatus"] = "unavailable"
        result["hints"] = []
    return result


def dismiss_experience(play, session_id, offer_id):
    with transaction.atomic():
        locked = Play.objects.select_for_update().get(pk=play.pk)
        if str(locked.session_id) != str(session_id):
            raise GameError(400, "INVALID_INPUT", "플레이 세션이 일치하지 않습니다.")
        turn = locked.turns.order_by("-number").first()
        if (
            not turn
            or str(turn.pk) != str(offer_id)
            or not isinstance(turn.response.get("experience"), dict)
        ):
            raise GameError(404, "NOT_FOUND", "현재 채팅의 체험 제안을 찾을 수 없습니다.")
        response = {"offerId": str(turn.pk), "lifecycleStatus": "declined"}
        if is_dismissed(locked, turn):
            return response
        if is_ended(locked) or observed_experience(locked, turn):
            raise GameError(409, "STATE_CONFLICT", "이미 처리된 체험 상태를 다시 확인해 주세요.")
        locked.progress = {
            **locked.progress,
            "experienceDismissal": {
                "offerId": str(turn.pk),
                "sessionId": str(locked.session_id),
            },
        }
        locked.state_version += 1
        locked.save(update_fields=["progress", "state_version"])
        return response
