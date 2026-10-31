import copy
import hashlib
import json
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .common import GameError
from .experiences import METADATA_KEYS, get_experience
from .models import ExperienceEvent, ExperienceEventConflict, Play
from .unity import validate_event


def apply_experience_result(play, experience, event, lifecycle="ended"):
    state = copy.deepcopy(play.state)
    results = state.setdefault("experiences", [])
    summary = {
        "experienceId": experience.external_id,
        "lifecycleStatus": lifecycle,
        **{key: experience.metadata[key] for key in METADATA_KEYS},
        "process": event.get("process"),
        "result": event.get("result"),
        "context": event.get("context"),
        "previousRuns": event.get("data", {}).get("previousRuns", []),
        "snapshots": experience.snapshots,
    }
    state["experiences"] = [
        row for row in results if row.get("experienceId") != experience.external_id
    ] + [summary]
    if play.state != state:
        play.state_version += 1
    play.state = state
    play.experience_results = state["experiences"]
    experience.result_summary = summary
    play.save(update_fields=["state", "experience_results", "state_version"])


def _store_event(play, event):
    event_id = validate_event(event)
    external_id = event["experienceId"]
    if event["sessionId"] != str(play.session_id):
        raise GameError(400, "INVALID_INPUT", "플레이 세션이 일치하지 않습니다.")
    control_error = event["type"] == "experience.error"
    metadata = {key: event[key] for key in METADATA_KEYS} if not control_error else None
    canonical = json.dumps(event, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    payload_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    scope_key = json.dumps(
        [
            event.get("scenarioRunId"),
            (event.get("process") or {}).get("scope"),
            event.get("stepId"),
            event.get("objectId"),
            event.get("workItemId"),
        ],
        ensure_ascii=False,
    )
    with transaction.atomic():
        locked = Play.objects.select_for_update().get(pk=play.pk)
        experience = get_experience(locked, external_id, metadata)
        if event["roomId"] != experience.metadata["roomId"]:
            raise GameError(400, "INVALID_INPUT", "방 식별자가 일치하지 않습니다.")
        if experience.session_id and experience.session_id != event["sessionId"]:
            raise GameError(400, "INVALID_INPUT", "세션이 일치하지 않습니다.")
        row, created = ExperienceEvent.objects.get_or_create(
            session_id=event["sessionId"],
            event_id=event_id,
            defaults={
                "experience": experience,
                "payload": event,
                "sequence": event.get("sequence", -1),
                "type": event["type"],
                "scope_key": scope_key,
                "payload_hash": payload_hash,
            },
        )
        if not created:
            if row.experience_id != experience.pk or row.payload_hash != payload_hash:
                ExperienceEventConflict.objects.create(
                    experience=experience,
                    session_id=event["sessionId"],
                    event_id=event_id,
                    payload=event,
                )
                return None
            return {
                "stored": True,
                "sessionId": event["sessionId"],
                "eventId": event_id,
            }
        experience.session_id = event["sessionId"]
        # 정산 이후의 원본은 보존하되 검증되지 않은 새 행동/늦은 종료로 상태를 덮지 않는다.
        if experience.fenced or experience.ended_event:
            row.quarantined = True
            row.save(update_fields=["quarantined"])
        elif control_error:
            experience.fenced = True
        else:
            sequence = event["sequence"]
            scope = json.dumps(
                [
                    event.get("scenarioRunId"),
                    event["process"]["scope"],
                    event.get("stepId"),
                    event.get("objectId"),
                    event.get("workItemId"),
                ]
            )
            previous = experience.snapshots.get(scope)
            if not previous or sequence > previous["sequence"]:
                experience.snapshots[scope] = copy.deepcopy(event)
            if sequence > experience.last_sequence:
                experience.last_sequence = sequence
                experience.last_event = copy.deepcopy(event)
            if event["type"] in ("experience.started", "scenario.started"):
                experience.started_observed = True
                experience.lifecycle_status = "started"
                if experience.lease_expires_at is None:
                    experience.lease_expires_at = timezone.now() + timedelta(seconds=120)
            if event["type"] in ("scenario.completed", "scenario.failed", "scenario.aborted"):
                if (
                    not experience.terminal_event
                    or sequence > experience.terminal_event["sequence"]
                ):
                    experience.terminal_event = copy.deepcopy(event)
            if event["type"] == "experience.ended":
                latest_run = (experience.last_event or {}).get("scenarioRunId")
                if latest_run != event.get("scenarioRunId"):
                    row.quarantined = True
                    row.save(update_fields=["quarantined"])
                else:
                    experience.ended_event = copy.deepcopy(event)
                    experience.ended_event_id = event_id
                    experience.fenced = True
                    experience.lifecycle_status = "ended"
                    apply_experience_result(locked, experience, event)
        experience.save()
    # atomic 블록을 빠져나와 commit을 마친 뒤에만 ACK를 반환한다.
    return {
        "stored": True,
        "sessionId": event["sessionId"],
        "eventId": event_id,
    }


def store_event(play, event):
    result = _store_event(play, event)
    if result is None:
        raise GameError(409, "EVENT_CONFLICT", "같은 이벤트 ID의 내용이 다릅니다.")
    return result
