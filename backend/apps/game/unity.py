import hashlib
import json
from functools import lru_cache

from django.conf import settings
from rest_framework import serializers

from .common import GameError

COUNTS = (
    "attemptCount",
    "navigationBackCount",
    "backtrackCount",
    "retryCount",
    "mistakeCount",
    "repeatedMistakeCount",
    "helpRequestCount",
    "elapsedActiveMs",
)
CONTEXT_KEYS = (
    "assessmentStatus",
    "assessmentCode",
    "ruleVersion",
    "reasonCodes",
    "evidenceEventIds",
    "interpretation",
    "limitations",
)


@lru_cache
def contract(name):
    return json.loads(
        (
            settings.BASE_DIR.parent
            / "docs/unity/contracts"
            / ("realtime-v002" if name == "realtime-contract.json" else "reconciliation-v003")
            / name
        ).read_text(encoding="utf-8")
    )


def invalid():
    raise GameError(400, "INVALID_INPUT", "Unity 이벤트 형식과 식별자를 확인해 주세요.")


def validate_event(event):
    if (
        not isinstance(event, dict)
        or type(event.get("schemaVersion")) is not int
        or event.get("schemaVersion") != 1
        or event.get("protocol") != "career-experience"
    ):
        invalid()
    spec = contract("realtime-contract.json")
    control_error = event.get("type") == "experience.error"
    required = (
        spec["controlErrorException"]["requiredFields"]
        if control_error
        else spec["requiredEnvelopeFields"]
    )
    if any(key not in event for key in required) or event.get("type") not in spec["eventTypes"]:
        invalid()
    for key in ("sessionId", "experienceId", "roomId"):
        if not isinstance(event[key], str) or not event[key] or len(event[key]) > 200:
            invalid()
    if control_error:
        error = event.get("error")
        if (
            not isinstance(error, dict)
            or not isinstance(error.get("code"), str)
            or not isinstance(error.get("message"), str)
        ):
            invalid()
        # 원본 봉투는 변경하지 않고 제어 오류의 저장 ACK용 식별자만 계산한다.
        raw = json.dumps(event, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        return "control-error-" + hashlib.sha256(raw.encode()).hexdigest()
    if not isinstance(event["eventId"], str) or not event["eventId"] or len(event["eventId"]) > 200:
        invalid()
    if type(event["sequence"]) is not int or event["sequence"] < 0:
        invalid()
    try:
        serializers.DateTimeField().run_validation(event["occurredAt"])
    except serializers.ValidationError:
        invalid()
    for key in (
        "scenarioRunId",
        "requestId",
        "sceneId",
        "objectId",
        "instanceId",
        "assetId",
        "assetVersion",
        "stepId",
        "workItemId",
        "attemptId",
    ):
        if event[key] is not None and not isinstance(event[key], str):
            invalid()
    for key in ("requestRevision", "documentRevision"):
        if event[key] is not None and (type(event[key]) is not int or event[key] < 0):
            invalid()
    process = event["process"]
    if not isinstance(process, dict) or any(
        key not in process
        for key in (*COUNTS, "scope", "measurementStatus", "measurementNote", "guidanceUsed")
    ):
        invalid()
    for key in COUNTS:
        if process[key] is not None and (type(process[key]) is not int or process[key] < 0):
            invalid()
    if (
        not isinstance(process["scope"], str)
        or process["measurementStatus"] not in ("complete", "partial", "unavailable")
        or process["guidanceUsed"] is not None
        and type(process["guidanceUsed"]) is not bool
    ):
        invalid()
    result, context = event["result"], event["context"]
    if not isinstance(result, dict) or any(
        key not in result for key in ("outcome", "success", "completionCode", "data")
    ):
        invalid()
    if (
        result["outcome"] not in ("pending", "completed", "failed", "aborted")
        or result["success"] is not None
        and type(result["success"]) is not bool
        or not isinstance(result["data"], dict)
    ):
        invalid()
    if event["type"] == "experience.ended" and result["outcome"] == "pending":
        invalid()
    if (
        not isinstance(context, dict)
        or any(key not in context for key in CONTEXT_KEYS)
        or context["assessmentStatus"] not in ("pending", "evaluated", "unavailable")
    ):
        invalid()
    for key in ("reasonCodes", "evidenceEventIds", "limitations"):
        if not isinstance(context[key], list) or any(
            not isinstance(item, str) for item in context[key]
        ):
            invalid()
    if not isinstance(event["data"], dict):
        invalid()
    return event["eventId"]
