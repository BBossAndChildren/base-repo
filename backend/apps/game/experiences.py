from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .common import GameError, is_ended
from .models import Experience, Play

METADATA_KEYS = ("buildId", "roomId", "scenarioId", "scenarioVersion")


def get_experience(play, external_id, metadata=None):
    if not isinstance(external_id, str) or not external_id or len(external_id) > 200:
        raise GameError(400, "INVALID_INPUT", "체험 ID를 확인해 주세요.")
    experience = Experience.objects.select_for_update().filter(external_id=external_id).first()
    if experience is None:
        if is_ended(play):
            raise GameError(409, "ALREADY_ENDED", "이미 끝난 플레이입니다.")
        offer = (
            play.turns.filter(response__experience__buildId__isnull=False)
            .order_by("-number")
            .first()
        )
        offered = offer.response["experience"] if offer else None
        if not offered:
            raise GameError(404, "NOT_FOUND", "시작 가능한 체험을 찾을 수 없어요.")
        if metadata and any(metadata.get(key) != offered.get(key) for key in METADATA_KEYS):
            raise GameError(400, "INVALID_INPUT", "추천한 체험과 요청 정보가 다릅니다.")
        experience, _ = Experience.objects.get_or_create(
            external_id=external_id,
            defaults={
                "play": play,
                "metadata": offered,
                "session_id": str(play.session_id),
                "build_id": offered["buildId"],
                "room_id": offered["roomId"],
                "scenario_id": offered["scenarioId"],
                "scenario_version": offered["scenarioVersion"],
            },
        )
        experience = Experience.objects.select_for_update().get(pk=experience.pk)
    if experience.play_id != play.pk:
        raise GameError(404, "NOT_FOUND", "체험 정보를 찾을 수 없어요.")
    if metadata and any(metadata.get(key) != experience.metadata.get(key) for key in METADATA_KEYS):
        raise GameError(400, "INVALID_INPUT", "체험 정보가 일치하지 않습니다.")
    return experience


def heartbeat(play, session_id, external_id):
    with transaction.atomic():
        locked = Play.objects.select_for_update().get(pk=play.pk)
        if str(locked.session_id) != str(session_id):
            raise GameError(400, "INVALID_INPUT", "플레이 세션이 일치하지 않습니다.")
        experience = get_experience(locked, external_id)
        if experience.session_id and experience.session_id != str(session_id):
            raise GameError(400, "INVALID_INPUT", "체험 세션이 일치하지 않습니다.")
        if experience.fenced or experience.ended_event or is_ended(locked):
            raise GameError(409, "ALREADY_ENDED", "이미 종료되거나 정산된 체험입니다.")
        experience.session_id = str(session_id)
        experience.lease_expires_at = timezone.now() + timedelta(seconds=120)
        experience.save(update_fields=["session_id", "lease_expires_at", "updated_at"])
        return {
            "sessionId": str(session_id),
            "experienceId": external_id,
            "leaseExpiresAt": experience.lease_expires_at,
        }


def mark_pending(play, payload):
    with transaction.atomic():
        locked = Play.objects.select_for_update().get(pk=play.pk)
        if str(locked.session_id) != str(payload["sessionId"]):
            raise GameError(400, "INVALID_INPUT", "플레이 세션이 일치하지 않습니다.")
        if is_ended(locked):
            raise GameError(409, "ALREADY_ENDED", "이미 끝난 플레이입니다.")
        experience = get_experience(locked, payload["experienceId"])
        if experience.metadata["roomId"] != payload["roomId"]:
            raise GameError(400, "INVALID_INPUT", "체험 방이 일치하지 않습니다.")
        if experience.session_id and experience.session_id != str(payload["sessionId"]):
            raise GameError(400, "INVALID_INPUT", "체험 세션이 일치하지 않습니다.")
        if experience.fenced or experience.ended_event:
            raise GameError(409, "ALREADY_ENDED", "이미 종료되거나 정산된 체험입니다.")
        experience.session_id = str(payload["sessionId"])
        experience.pending_request_id = payload["requestId"]
        experience.lifecycle_status = "pending_reconciliation"
        experience.save(
            update_fields=["session_id", "pending_request_id", "lifecycle_status", "updated_at"]
        )
        return {
            "sessionId": str(payload["sessionId"]),
            "experienceId": payload["experienceId"],
            "lifecycleStatus": "pending_reconciliation",
        }
