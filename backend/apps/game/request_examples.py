"""Swagger 형식 예시. ID는 가상이며 실제 세션·체험 ID로 교체한다."""

from drf_spectacular.utils import OpenApiExample

REQUEST_FIELD_EXAMPLES = {
    "PauseInput": {"paused": True},
    "HeartbeatInput": {
        "sessionId": "7c73521c-d7e6-4f06-9d43-f930a4e4c501",
        "experienceId": "a052beea-9b66-4c50-8e92-66b57c170001",
    },
    "PendingInput": {
        "sessionId": "7c73521c-d7e6-4f06-9d43-f930a4e4c501",
        "experienceId": "a052beea-9b66-4c50-8e92-66b57c170001",
        "roomId": "PAN-002",
        "requestId": "14b831e6-a955-4b28-bf10-126096160001",
        "reason": "END_RESPONSE_TIMEOUT",
    },
    "ReconcileInput": {
        "schemaVersion": 1,
        "protocol": "career-experience-resolution",
        "action": "reconcile_experience",
        "reconcileRequestId": "a9dc4e62-6b83-4daa-8ed1-17cfd8300001",
        "sessionId": "7c73521c-d7e6-4f06-9d43-f930a4e4c501",
        "experienceId": "a052beea-9b66-4c50-8e92-66b57c170001",
        "roomId": "PAN-002",
        "trigger": "NEW_PLAY_START",
        "newExperienceId": "a052beea-9b66-4c50-8e92-66b57c170002",
    },
    "EventInput": {
        "schemaVersion": 1,
        "protocol": "career-experience",
        "eventId": "evt-intro-start-001",
        "sequence": 2,
        "occurredAt": "2026-11-01T14:30:00+09:00",
        "sessionId": "7c73521c-d7e6-4f06-9d43-f930a4e4c501",
        "scenarioRunId": "run-career-951-001",
        "buildId": "career-suite-integration-v005",
        "sceneId": "PAN-002",
        "roomId": "PAN-002",
        "scenarioId": "career-net-951-experience",
        "scenarioVersion": "v002",
        "experienceId": "a052beea-9b66-4c50-8e92-66b57c170001",
        "requestId": "14b831e6-a955-4b28-bf10-126096160001",
        "objectId": None,
        "instanceId": None,
        "assetId": None,
        "assetVersion": None,
        "stepId": None,
        "workItemId": None,
        "attemptId": None,
        "requestRevision": None,
        "documentRevision": None,
        "type": "experience.started",
        "action": "start_experience",
        "process": {
            "scope": "scenario",
            "measurementStatus": "complete",
            "measurementNote": None,
            "attemptCount": 0,
            "navigationBackCount": 0,
            "backtrackCount": 0,
            "retryCount": 0,
            "mistakeCount": 0,
            "repeatedMistakeCount": 0,
            "helpRequestCount": 0,
            "guidanceUsed": False,
            "elapsedActiveMs": 0,
        },
        "result": {"outcome": "pending", "success": None, "completionCode": None, "data": {}},
        "context": {
            "assessmentStatus": "pending",
            "assessmentCode": None,
            "ruleVersion": "v001",
            "reasonCodes": [],
            "evidenceEventIds": [],
            "interpretation": None,
            "limitations": [
                "원본 직업 업무를 참고한 가상 교육 사례. 현업 자격·안전 절차·적성을 판정하지 "
                "않습니다.",
                "이 기록은 선택한 가상 시나리오 한 회의 수행이며 직업 적성·전문 자격 평가가 "
                "아닙니다.",
            ],
            "termination": None,
        },
        "data": {"ready": True, "firstSequence": 1},
    },
}

ID_GUIDE = (
    "형식을 보여 주는 가상 ID입니다. 그대로 보내면 400/404가 날 수 있습니다. "
    "sessionId는 게임 시작/재개 응답, experienceId는 해당 체험 시작 시 사용한 ID, "
    "roomId는 해당 체험의 추천 응답 값으로 바꾸세요. "
    "X-Player-Id와 경로 playId도 실제 발급받은 본인 값을 사용합니다."
)

PAUSE_EXAMPLES = [
    OpenApiExample("일시정지", value={"paused": True}, request_only=True),
    OpenApiExample("일시정지 해제", value={"paused": False}, request_only=True),
]
HEARTBEAT_EXAMPLES = [
    OpenApiExample(
        "진행 중 체험 생존 신호",
        value=REQUEST_FIELD_EXAMPLES["HeartbeatInput"],
        description=ID_GUIDE,
        request_only=True,
    )
]
PENDING_EXAMPLES = [
    OpenApiExample(
        "종료 요청 뒤 5초간 응답 없음",
        value=REQUEST_FIELD_EXAMPLES["PendingInput"],
        description=ID_GUIDE
        + " requestId는 응답이 없었던 원래 종료 호출의 ID입니다. 새로 만들지 않습니다.",
        request_only=True,
    )
]
RECONCILE_EXAMPLES = [
    OpenApiExample(
        "새 체험 시작 전 이전 체험 정산",
        value=REQUEST_FIELD_EXAMPLES["ReconcileInput"],
        description=ID_GUIDE
        + " newExperienceId는 새 체험용 ID이며 이전 experienceId와 달라야 합니다. "
        "같은 정산을 재전송할 때 reconcileRequestId와 본문 전체를 유지합니다.",
        request_only=True,
    )
]
EVENT_EXAMPLES = [
    OpenApiExample(
        "체험 시작 · 전체 Unity 이벤트",
        value=REQUEST_FIELD_EXAMPLES["EventInput"],
        description=ID_GUIDE
        + (
            " 실제로는 Unity 이벤트 원본을 수정하거나 감싸지 않고"
            " 보냅니다. null 필드도 원본대로 유지하세요."
        ),
        request_only=True,
    ),
    OpenApiExample(
        "제어 오류 · 축약 봉투",
        value={
            "schemaVersion": 1,
            "protocol": "career-experience",
            "requestId": "14b831e6-a955-4b28-bf10-126096160001",
            "sessionId": "7c73521c-d7e6-4f06-9d43-f930a4e4c501",
            "experienceId": "a052beea-9b66-4c50-8e92-66b57c170001",
            "roomId": "PAN-002",
            "type": "experience.error",
            "error": {
                "code": "EXPERIENCE_NOT_READY",
                "message": "체험 준비가 끝나지 않아 시작할 수 없습니다.",
            },
        },
        description=ID_GUIDE + " experience.error는 일반 이벤트와 필수 필드가 다릅니다.",
        request_only=True,
    ),
]
