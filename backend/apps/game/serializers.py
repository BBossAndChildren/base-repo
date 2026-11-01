from rest_framework import serializers


class StrictSerializer(serializers.Serializer):
    def to_internal_value(self, data):
        if isinstance(data, dict) and set(data) - set(self.fields):
            raise serializers.ValidationError(
                {"non_field_errors": ["허용하지 않는 필드가 있습니다."]}
            )
        return super().to_internal_value(data)


class StartPlaySerializer(StrictSerializer):
    name = serializers.CharField(
        max_length=200, help_text="필수. 게임에서 부를 이름, 빈 문자열 불가"
    )
    age = serializers.IntegerField(
        min_value=7, max_value=99, help_text="필수. 시작 나이, 7~99세 정수"
    )
    situation = serializers.ChoiceField(
        choices=["초등학생", "중학생", "고등학생", "대학생", "직장인", "구직 중", "기타"],
        help_text="필수. 현재 상황, 지정된 7개 보기 중 정확한 값 선택",
    )
    hasDreamJob = serializers.BooleanField(
        help_text="필수. 희망 직업 유무. true면 dreamJob 필수, false면 dreamJob 생략 또는 빈 문자열"
    )
    dreamJob = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=200,
        help_text=(
            "조건부 필수. hasDreamJob=true면 비어 있지 않은 직업명. "
            "false면 생략하거나 빈 문자열로 전송"
        ),
    )
    gender = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=100,
        help_text="선택. 성별, 응답하지 않으면 생략 가능",
    )
    interests = serializers.ListField(
        child=serializers.CharField(max_length=200),
        required=False,
        max_length=5,
        help_text="선택. 관심사 최대 5개, 직접 입력 허용. 미응답은 필드 생략",
    )
    majorOrGrade = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=200,
        help_text="선택. 전공 또는 학년. 미응답은 필드 생략",
    )
    strengths = serializers.ListField(
        child=serializers.CharField(max_length=200),
        required=False,
        max_length=5,
        help_text="선택. 잘하는 것·좋아하는 과목 최대 5개",
    )
    values = serializers.ListField(
        child=serializers.ChoiceField(
            choices=["안정", "성장", "돈", "사회 기여", "자유", "인정", "관계"]
        ),
        required=False,
        max_length=3,
        help_text="선택. 가치관 보기 중 최대 3개",
    )
    roleModel = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=200,
        help_text="선택. 롤모델, 미응답은 필드 생략",
    )
    mbti = serializers.CharField(
        required=False, allow_blank=True, max_length=20, help_text="선택. MBTI, 미응답은 필드 생략"
    )

    def validate(self, attrs):
        if attrs["hasDreamJob"] != bool(attrs.get("dreamJob")):
            raise serializers.ValidationError("희망 직업 유무와 직업명을 확인해 주세요.")
        return attrs


class MessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "npc", "narrator"], help_text="발화자 종류")
    speaker = serializers.CharField(help_text="화면에 표시할 이름")
    text = serializers.CharField(help_text="화면에 보여 줄 대사")


class PlayDataSerializer(serializers.Serializer):
    playId = serializers.UUIDField()
    sessionId = serializers.UUIDField(help_text="플레이 동안 모든 Unity 3D 체험에서 유지하는 ID")
    state = serializers.JSONField(
        help_text=(
            "확정 상태: age·elapsedDays·원화 funds/debt·health/energy/stress·"
            "housing·support(가족 지원)·development·occupation. 시작 자금·생활비·"
            "가족 지원은 상황별 기준값, 성적은 미확인 null입니다. "
            "흥미는 1~5 또는 미확인 null입니다."
        )
    )
    messages = MessageSerializer(many=True)


class PlayResponseSerializer(serializers.Serializer):
    code = serializers.IntegerField()
    data = PlayDataSerializer()


class NPCSummarySerializer(serializers.Serializer):
    id = serializers.CharField(help_text="NPC 식별자 (state.relationship 의 키)")
    name = serializers.CharField(help_text="화면에 보일 이름")


class ResumeDataSerializer(serializers.Serializer):
    scene = serializers.JSONField(help_text="마지막 확정 장면·발화 NPC. 비공개 기억은 제외")
    npcs = NPCSummarySerializer(
        many=True, help_text="이 플레이에서 만난 인물 이름 목록. 비공개 기억 · 해석은 없음"
    )
    pendingChoices = serializers.ListField(child=serializers.JSONField())
    lastTurnId = serializers.UUIDField(allow_null=True)
    paused = serializers.BooleanField(help_text="명시적 일시정지 여부")
    stateVersion = serializers.IntegerField(help_text="마지막 확정 상태 버전")
    activePlaySeconds = serializers.FloatField(
        help_text="서버에서 확인한 활성 요청 처리 시간; 비활성 간격 제외"
    )
    playId = serializers.UUIDField()
    sessionId = serializers.UUIDField(help_text="게임 시작 때 발급한 Unity 세션 ID")
    state = serializers.JSONField()
    messages = MessageSerializer(many=True)
    ended = serializers.BooleanField()


class ResumeResponseSerializer(serializers.Serializer):
    code = serializers.IntegerField()
    data = ResumeDataSerializer()


class PauseInputSerializer(StrictSerializer):
    paused = serializers.BooleanField(help_text="필수. true: 새 턴 차단, false: 이어 하기")


class PauseDataSerializer(serializers.Serializer):
    state = serializers.JSONField(
        help_text="현재 확정 상태; 이 요청은 게임 날짜를 진행하지 않습니다"
    )
    paused = serializers.BooleanField()
    stateVersion = serializers.IntegerField()
    activePlaySeconds = serializers.FloatField()


class PauseResponseSerializer(serializers.Serializer):
    code = serializers.IntegerField(default=200)
    data = PauseDataSerializer()


class PlayListItemSerializer(serializers.Serializer):
    playId = serializers.UUIDField()
    startedAt = serializers.DateTimeField()
    ended = serializers.BooleanField()
    summary = serializers.CharField(allow_blank=True)


class PlayListDataSerializer(serializers.Serializer):
    plays = PlayListItemSerializer(many=True)


class PlayListResponseSerializer(serializers.Serializer):
    code = serializers.IntegerField()
    data = PlayListDataSerializer()


class ProposedChangeSerializer(StrictSerializer):
    evidenceQuote = serializers.CharField(
        required=False, help_text="관계·흥미 변경 근거인 이번 사용자 입력의 인용"
    )
    eventId = serializers.CharField(required=False, help_text="해당 NPC가 알고 있는 확정 사건 ID")
    field = serializers.CharField()
    to = serializers.JSONField(allow_null=True)
    reason = serializers.CharField(required=False, allow_blank=True)


class BranchSerializer(StrictSerializer):
    topic = serializers.CharField(help_text="3D 체험으로 이어질 분기 주제")
    jobs = serializers.ListField(
        child=serializers.CharField(), allow_empty=True, help_text="관련 직업"
    )
    reason = serializers.CharField(help_text="사용자에게 보여 줄 수 있는 분기 이유")


class AIMessageSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=["npc", "narrator"])
    speaker = serializers.CharField()
    text = serializers.CharField()


class AIChatDataSerializer(StrictSerializer):
    scene = serializers.DictField(
        child=serializers.JSONField(),
        required=False,
        allow_null=True,
        default=None,
        help_text="다음 장면 id·speakerNpcId·npcIds·npcs(id/name). 기존 인물 이동은 입력 근거 필요",
    )
    memoryUpdates = serializers.ListField(
        child=serializers.DictField(child=serializers.JSONField()),
        required=False,
        default=list,
        max_length=20,
        help_text="NPC가 이미 아는 eventId의 감정·해석 제안",
    )
    transfers = serializers.ListField(
        child=serializers.DictField(child=serializers.JSONField()),
        required=False,
        default=list,
        max_length=20,
        help_text="아는 사건의 전달자·수신자·timePassed/importantEvent 계기",
    )
    actions = serializers.ListField(
        child=serializers.DictField(child=serializers.JSONField()),
        required=False,
        default=list,
        max_length=20,
        help_text="백엔드가 검증할 가상 행동 계획. kind·evidenceQuote·기간/대상/출처 포함",
    )
    messages = AIMessageSerializer(many=True, allow_empty=False)
    stateChanges = ProposedChangeSerializer(many=True)
    hints = serializers.ListField(child=serializers.CharField())
    branch = BranchSerializer(allow_null=True, help_text="3D 분기일 때만 포함하며 평소에는 null")
    lifeEnded = serializers.BooleanField()


class AIChatResponseSerializer(StrictSerializer):
    code = serializers.ChoiceField(choices=[200])
    data = AIChatDataSerializer()


class AIRecommendationDataSerializer(StrictSerializer):
    found = serializers.BooleanField()
    buildId = serializers.CharField(required=False)
    roomId = serializers.CharField(required=False)
    scenarioId = serializers.CharField(required=False)
    scenarioVersion = serializers.CharField(required=False)
    reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs["found"] and any(
            not attrs.get(key) for key in ("buildId", "roomId", "scenarioId", "scenarioVersion")
        ):
            raise serializers.ValidationError("추천 식별자가 필요합니다.")
        return attrs


class AIRecommendationResponseSerializer(StrictSerializer):
    code = serializers.ChoiceField(choices=[200])
    data = AIRecommendationDataSerializer()


class TurnInputSerializer(StrictSerializer):
    requestId = serializers.UUIDField(
        help_text=(
            "필수. 클라이언트가 생성한 UUID. 같은 행동 재시도에는 유지하고 "
            "새로운 행동에는 새 UUID 사용"
        )
    )
    message = serializers.CharField(
        max_length=10000,
        help_text="필수. 플레이어 대화 입력, 공백만 있는 문자열 불가. 최대 10000자",
    )


class ExperienceOfferSerializer(serializers.Serializer):
    buildId = serializers.CharField(help_text="Unity 허용 목록의 빌드 ID")
    buildUrl = serializers.URLField(help_text="현재 요청 주소를 기준으로 생성한 빌드 URL")
    roomId = serializers.CharField(help_text="Unity 방 ID")
    scenarioId = serializers.CharField(help_text="Unity 시나리오 ID")
    scenarioVersion = serializers.CharField(help_text="Unity 시나리오 버전")
    title = serializers.CharField(help_text="3D 안내 카드 제목")
    jobs = serializers.ListField(child=serializers.CharField(), help_text="체험 관련 직업")
    reason = serializers.CharField(help_text="AI 분기 이유")


class ExperienceNoticeSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=["EXPERIENCE_SKIPPED"])
    message = serializers.CharField()


class TurnDataSerializer(serializers.Serializer):
    npcs = NPCSummarySerializer(
        many=True, required=False, help_text="이번 턴 저장 후 만난 인물 이름 목록"
    )
    pendingChoices = serializers.ListField(
        child=serializers.JSONField(), help_text="자금 부족·입원·중요 결정에서 기다리는 선택"
    )
    events = serializers.ListField(
        child=serializers.JSONField(), help_text="서버에서 확정한 이번 턴의 공개 사건"
    )
    turnId = serializers.UUIDField(help_text="저장된 대화 턴 ID")
    state = serializers.JSONField(help_text="이번 턴 저장 후 백엔드가 확정한 전체 게임 상태")
    stateVersion = serializers.IntegerField(help_text="확정된 상태 버전")
    messages = MessageSerializer(many=True)
    stateChanges = serializers.ListField(
        child=serializers.JSONField(), help_text="백엔드 검증 후 실제 적용된 상태 변경"
    )
    hints = serializers.ListField(child=serializers.CharField(), help_text="다음 대화 힌트")
    experience = ExperienceOfferSerializer(
        allow_null=True, help_text="3D 분기 시 체험 정보, 평소에는 null"
    )
    ended = serializers.BooleanField(help_text="인생 종료 여부")
    notice = ExperienceNoticeSerializer(required=False, help_text="3D를 건너뛴 경우 안내")


class TurnResponseSerializer(serializers.Serializer):
    code = serializers.IntegerField()
    data = TurnDataSerializer()


class HeartbeatInputSerializer(StrictSerializer):
    sessionId = serializers.UUIDField(help_text="게임 시작 응답의 sessionId")
    experienceId = serializers.CharField(max_length=200, help_text="이번 3D 체험의 ID")


class HeartbeatDataSerializer(serializers.Serializer):
    sessionId = serializers.UUIDField(help_text="확인한 플레이 세션 ID")
    experienceId = serializers.CharField(help_text="확인한 체험 ID")
    leaseExpiresAt = serializers.DateTimeField()


class HeartbeatResponseSerializer(serializers.Serializer):
    sessionId = serializers.UUIDField()
    experienceId = serializers.CharField()
    leaseExpiresAt = serializers.DateTimeField()


class PendingInputSerializer(StrictSerializer):
    sessionId = serializers.UUIDField(help_text="게임 시작 응답의 sessionId")
    experienceId = serializers.CharField(max_length=200, help_text="종료 응답을 받지 못한 체험 ID")
    roomId = serializers.CharField(max_length=200, help_text="체험의 Unity 방 ID")
    requestId = serializers.CharField(max_length=200, help_text="원래 종료 호출에 사용한 requestId")
    reason = serializers.ChoiceField(
        choices=["END_RESPONSE_TIMEOUT"], help_text="5초 동안 종료 응답을 받지 못함"
    )


class PendingResponseSerializer(serializers.Serializer):
    sessionId = serializers.UUIDField()
    experienceId = serializers.CharField()
    lifecycleStatus = serializers.ChoiceField(choices=["pending_reconciliation"])


class EventInputSerializer(serializers.Serializer):
    schemaVersion = serializers.IntegerField(help_text="Unity 실시간 계약 버전")
    protocol = serializers.CharField(help_text="career-experience")
    type = serializers.CharField(
        help_text="object.selected, experience.started/ended 등 Unity 이벤트 종류"
    )
    eventId = serializers.CharField(
        required=False, help_text="중복 제거용 이벤트 ID. 제어 오류에는 없을 수 있음"
    )
    sequence = serializers.IntegerField(required=False, help_text="같은 실행 내 이벤트 순서")
    sessionId = serializers.CharField(help_text="게임 시작 응답의 sessionId")
    experienceId = serializers.CharField(help_text="이번 3D 체험의 ID")
    buildId = serializers.CharField(required=False, help_text="Unity 빌드 ID")
    roomId = serializers.CharField(help_text="Unity 방 ID")
    scenarioId = serializers.CharField(required=False, help_text="Unity 시나리오 ID")
    scenarioVersion = serializers.CharField(required=False, help_text="Unity 시나리오 버전")
    process = serializers.JSONField(required=False, help_text="Unity가 보낸 과정 원본")
    result = serializers.JSONField(required=False, help_text="Unity가 보낸 결과 원본")
    context = serializers.JSONField(required=False, help_text="Unity가 보낸 해석 원본")
    data = serializers.JSONField(required=False, help_text="이벤트 종류별 원본 데이터")


class EventAckDataSerializer(serializers.Serializer):
    stored = serializers.BooleanField()
    sessionId = serializers.CharField()
    eventId = serializers.CharField()
    duplicate = serializers.BooleanField()
    quarantined = serializers.BooleanField(required=False)


class EventAckResponseSerializer(serializers.Serializer):
    stored = serializers.BooleanField(help_text="DB commit 완료 후 true")
    sessionId = serializers.CharField(help_text="원본 Unity 세션 ID")
    eventId = serializers.CharField(help_text="원본 Unity 이벤트 ID")


class ReconcileInputSerializer(StrictSerializer):
    schemaVersion = serializers.ChoiceField(choices=[1], help_text="Unity 정산 계약 버전")
    protocol = serializers.ChoiceField(choices=["career-experience-resolution"])
    action = serializers.ChoiceField(choices=["reconcile_experience"])
    reconcileRequestId = serializers.CharField(max_length=200, help_text="재전송 시 유지할 요청 ID")
    sessionId = serializers.CharField(max_length=200, help_text="게임 시작 응답의 sessionId")
    experienceId = serializers.CharField(max_length=200, help_text="정산 대상 이전 체험 ID")
    roomId = serializers.CharField(max_length=200, help_text="이전 체험 방 ID")
    trigger = serializers.CharField(
        max_length=200, help_text="정산 사유, 새 체험 시작은 NEW_PLAY_START"
    )
    newExperienceId = serializers.CharField(max_length=200, help_text="새로 시작할 체험 ID")


class ResolutionResponseSerializer(serializers.Serializer):
    schemaVersion = serializers.IntegerField(help_text="Unity 정산 계약 버전")
    protocol = serializers.CharField()
    type = serializers.CharField()
    producer = serializers.ChoiceField(choices=["backend"])
    policyVersion = serializers.CharField(help_text="정산 정책 버전 v003")
    reconcileRequestId = serializers.CharField(help_text="클라이언트 정산 요청 ID")
    lifecycleStatus = serializers.CharField(help_text="정산 결과 상태")
    code = serializers.CharField(help_text="Unity 수락 사례의 정산 사유 코드")
    source = serializers.ChoiceField(choices=["unity_end", "backend_policy"])
    resolutionId = serializers.UUIDField()
    revision = serializers.IntegerField()
    resolvedAt = serializers.DateTimeField(help_text="서버의 정산 시각")
    sessionId = serializers.CharField()
    experienceId = serializers.CharField()
    buildId = serializers.CharField()
    roomId = serializers.CharField()
    scenarioId = serializers.CharField()
    scenarioVersion = serializers.CharField()
    scenarioRunId = serializers.CharField(allow_null=True)
    unityEndReceived = serializers.BooleanField(help_text="실제 Unity 종료 수신 여부")
    unityEndEventId = serializers.CharField(allow_null=True)
    lastObserved = serializers.JSONField(allow_null=True, help_text="마지막 수신 상태 원본")
    process = serializers.JSONField(allow_null=True, help_text="Unity 과정 원본, 미수신 시 null")
    result = serializers.JSONField(allow_null=True, help_text="Unity 결과 원본, 미수신 시 null")
    context = serializers.JSONField(help_text="정산 근거와 해석상의 한계")
    evidence = serializers.JSONField(help_text="시작 관측·lease·서버 fence 근거")
    supersedesRevision = serializers.IntegerField(allow_null=True)


class ErrorDetailSerializer(serializers.Serializer):
    type = serializers.CharField(help_text="INVALID_INPUT, UNKNOWN_PLAYER 등 오류 종류")
    message = serializers.CharField(help_text="사용자에게 보여 줄 수 있는 오류 설명")


class GameErrorResponseSerializer(serializers.Serializer):
    code = serializers.IntegerField(help_text="HTTP 상태 코드")
    error = ErrorDetailSerializer()


class RecommendedJobSerializer(serializers.Serializer):
    job = serializers.CharField()
    isNew = serializers.BooleanField(
        help_text="이번 플레이에서 아직 경험하지 않은 새 직업이면 true"
    )
    basis = serializers.ListField(
        child=serializers.ChoiceField(
            choices=["experience", "conversation", "interest", "dreamJob"]
        ),
        allow_empty=True,
        help_text="백엔드 기록으로 확인한 추천 근거 종류",
    )
    reason = serializers.CharField()
    work = serializers.CharField(help_text="이 직업이 하는 일")
    nextSteps = serializers.ListField(
        child=serializers.CharField(), min_length=2, max_length=3, help_text="다음 준비 방향 2~3개"
    )


class ResultDataSerializer(serializers.Serializer):
    ending = serializers.CharField(help_text="이번 인생에서 선택·경험한 내용의 요약")
    recommendedJobs = RecommendedJobSerializer(many=True, min_length=3, max_length=3)
    generatedBy = serializers.ChoiceField(
        choices=["backend"],
        required=False,
        help_text='AI 결말이 없거나 실패해 백엔드가 기록으로 만든 결말일 때만 "backend"',
    )

    def validate(self, attrs):
        names = [job["job"].strip().casefold() for job in attrs["recommendedJobs"]]
        if len(set(names)) != len(names):
            raise serializers.ValidationError("서로 다른 직업 3개가 필요합니다.")
        if not any(job["isNew"] for job in attrs["recommendedJobs"]):
            raise serializers.ValidationError("아직 경험하지 않은 새 직업이 필요합니다.")
        return attrs


class AIEndingResponseSerializer(StrictSerializer):
    code = serializers.ChoiceField(choices=[200])
    data = ResultDataSerializer()


class ResultResponseSerializer(serializers.Serializer):
    code = serializers.IntegerField()
    data = ResultDataSerializer()


class PlayerDataSerializer(serializers.Serializer):
    playerId = serializers.UUIDField()


class PlayerResponseSerializer(serializers.Serializer):
    code = serializers.IntegerField()
    data = PlayerDataSerializer()
