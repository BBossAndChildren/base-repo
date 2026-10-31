import copy
import json

from django.db import transaction
from django.utils import timezone
from jsonschema import Draft202012Validator

from .common import GameError
from .events import apply_experience_result
from .experiences import METADATA_KEYS, get_experience
from .models import Experience, ExperienceEvent, Play, Player, ReconcileRequest, ResolutionRevision
from .unity import contract


def lifecycle(experience, new_start):
    if experience.ended_event:
        return "ended"
    if experience.fenced and experience.latest_resolution:
        previous = experience.latest_resolution["lifecycleStatus"]
        if previous in ("interrupted", "not_started"):
            return previous
    if not new_start or experience.lease_expires_at is None:
        return "pending_reconciliation"
    if experience.lease_expires_at > timezone.now():
        return "deferred_active"
    return "interrupted" if experience.started_observed else "not_started"


def write_revision(play, experience, request_id, new_start, evidence=""):
    status = lifecycle(experience, new_start)
    lease = (
        "unknown"
        if experience.lease_expires_at is None
        else ("active" if experience.lease_expires_at > timezone.now() else "expired")
    )
    codes = {
        "ended": "UNITY_END_RECEIVED",
        "interrupted": "END_RESPONSE_MISSING_ON_RESTART",
        "not_started": "EXPERIENCE_NOT_STARTED",
        "deferred_active": "EXPERIENCE_STILL_ACTIVE",
        "pending_reconciliation": "LIVENESS_UNKNOWN",
    }
    last = experience.last_event
    terminal = experience.terminal_event
    if terminal and last and terminal.get("scenarioRunId") != last.get("scenarioRunId"):
        terminal = None
    end = experience.ended_event
    context = copy.deepcopy((end or terminal or {}).get("context"))
    if not context:
        context = {
            "assessmentStatus": "unavailable",
            "assessmentCode": None,
            "ruleVersion": None,
            "reasonCodes": [codes[status]],
            "evidenceEventIds": [last["eventId"]] if last else [],
            "interpretation": "종료 응답을 받지 못해 이전 체험을 중단 처리했습니다."
            if status == "interrupted"
            else None,
            "limitations": [
                "마지막 수신 이후의 완료 여부와 실제 종료 원인은 알 수 없습니다.",
                "종료 미수신을 사용자 포기나 추가 실수로 해석하지 않습니다.",
            ],
        }
    observed = None
    if last:
        row = experience.events.filter(event_id=last["eventId"]).first()
        termination = last["context"].get("termination") or {}
        observed = {
            "sourceEventId": last["eventId"],
            "observedAt": row.received_at.isoformat() if row else None,
            "stepId": last.get("stepId"),
            "objectId": last.get("objectId"),
            "state": last.get("data", {}).get("state"),
            "process": last.get("process"),
            "partialResults": last["result"]["data"].get("partialResults"),
            **{
                key: termination.get(key)
                for key in ("completedStepIds", "remainingStepIds", "inFlightActionIds")
            },
        }
    previous = experience.revision
    result = {
        "schemaVersion": 1,
        "protocol": "career-experience-resolution",
        "type": "experience.reconciled",
        "producer": "backend",
        "policyVersion": "v003",
        "reconcileRequestId": request_id,
        "resolutionId": str(experience.resolution_id),
        "revision": previous + 1,
        "resolvedAt": timezone.now().isoformat(),
        "sessionId": experience.session_id,
        "experienceId": experience.external_id,
        **{key: experience.metadata[key] for key in METADATA_KEYS},
        "scenarioRunId": (end or last or {}).get("scenarioRunId"),
        "lifecycleStatus": status,
        "code": codes[status],
        "source": "unity_end" if end else "backend_policy",
        "unityEndReceived": end is not None,
        "unityEndEventId": end["eventId"] if end else None,
        "lastObserved": observed,
        "process": end["process"] if end else None,
        "result": (end or terminal or {}).get("result"),
        "context": context,
        "evidence": {
            "startObserved": experience.started_observed,
            "newStartRequested": new_start,
            "oldLeaseStatus": lease,
            "fenceConfirmed": status in ("ended", "interrupted", "not_started"),
            "terminalScenarioEventId": terminal["eventId"] if terminal else None,
        },
        "supersedesRevision": previous or None,
    }
    Draft202012Validator(contract("resolution-response.schema.json")).validate(result)
    experience.revision = previous + 1
    experience.latest_resolution = result
    experience.lifecycle_status = status
    if status in ("ended", "interrupted", "not_started"):
        experience.fenced = True
        apply_experience_result(play, experience, result, status)
    experience.save()
    ResolutionRevision.objects.create(
        experience=experience,
        resolution_id=experience.resolution_id,
        revision=experience.revision,
        reconcile_request_id=request_id,
        lifecycle_status=status,
        payload=result,
        response=result,
        verification_evidence=evidence,
        resolved_at=timezone.now(),
    )
    return result


def reconcile(play, payload):
    with transaction.atomic():
        Player.objects.select_for_update().get(pk=play.player_id)
        locked = Play.objects.select_for_update().get(pk=play.pk)
        if str(locked.session_id) != payload["sessionId"]:
            raise GameError(400, "INVALID_INPUT", "플레이 세션이 일치하지 않습니다.")
        canonical = {"playId": str(play.pk), **payload}
        previous = ReconcileRequest.objects.filter(
            player=locked.player, request_id=payload["reconcileRequestId"]
        ).first()
        if previous:
            if json.dumps(previous.payload, sort_keys=True) != json.dumps(
                canonical, sort_keys=True
            ):
                raise GameError(409, "RECONCILE_CONFLICT", "같은 정산 요청 ID의 내용이 다릅니다.")
            return previous.response
        experience = get_experience(locked, payload["experienceId"])
        if (
            experience.metadata["roomId"] != payload["roomId"]
            or experience.session_id
            and experience.session_id != payload["sessionId"]
        ):
            raise GameError(400, "INVALID_INPUT", "체험과 세션 정보가 일치하지 않습니다.")
        experience.session_id = payload["sessionId"]
        if payload["newExperienceId"] == experience.external_id:
            raise GameError(400, "INVALID_INPUT", "새 체험에는 다른 ID가 필요합니다.")
        next_experience = (
            Experience.objects.filter(external_id=payload["newExperienceId"])
            .select_related("play")
            .first()
        )
        if next_experience and next_experience.play_id != locked.pk:
            raise GameError(404, "NOT_FOUND", "다른 플레이어의 체험입니다.")
        if payload["trigger"] == "NEW_PLAY_START" and next_experience is None:
            get_experience(locked, payload["newExperienceId"])
        result = write_revision(
            locked,
            experience,
            payload["reconcileRequestId"],
            payload["trigger"] == "NEW_PLAY_START",
        )
        ReconcileRequest.objects.create(
            player=locked.player,
            request_id=payload["reconcileRequestId"],
            payload=canonical,
            response=result,
        )
        return result


def verify_late_end(session_id, event_id, evidence):
    # 클라이언트 시각만으로 승인하지 않는다. 운영자가 외부 근거를 검토한 관리 명령 전용이다.
    if not evidence.strip():
        raise GameError(400, "INVALID_INPUT", "검토 근거가 필요합니다.")
    row = ExperienceEvent.objects.select_related("experience").get(
        session_id=session_id, event_id=event_id
    )
    with transaction.atomic():
        play = Play.objects.select_for_update().get(pk=row.experience.play_id)
        experience = Experience.objects.select_for_update().get(pk=row.experience_id)
        row = ExperienceEvent.objects.select_for_update().get(pk=row.pk)
        end = row.payload
        terminal = experience.terminal_event
        if (
            not row.quarantined
            or end["type"] != "experience.ended"
            or not experience.latest_resolution
            or not terminal
            or terminal["scenarioRunId"] != end["scenarioRunId"]
            or terminal["result"]["outcome"] != end["result"]["outcome"]
        ):
            raise GameError(
                409, "VERIFICATION_REQUIRED", "동일 실행의 종료 근거를 확인할 수 없습니다."
            )
        experience.ended_event = copy.deepcopy(end)
        experience.ended_event_id = end["eventId"]
        experience.last_event = copy.deepcopy(end)
        experience.last_sequence = max(experience.last_sequence, end["sequence"])
        result = write_revision(
            play, experience, experience.latest_resolution["reconcileRequestId"], True, evidence
        )
        row.quarantined = False
        row.save(update_fields=["quarantined"])
        return result
