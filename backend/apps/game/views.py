from django.db import transaction
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from .common import (
    PLAY_PARAMETERS,
    PLAYER_PARAMETERS,
    PlayerRequiredView,
    is_ended,
    owned_play,
    success,
)
from .ending import get_or_generate_result
from .events import store_event
from .experiences import heartbeat, mark_pending
from .memory import npc_list
from .models import NPC, Message, Play, Player, Turn
from .offers import suggest
from .opening import opening
from .pause import set_paused
from .reconciliation import reconcile
from .serializers import (
    EventAckResponseSerializer,
    EventInputSerializer,
    ExperienceSuggestionInputSerializer,
    ExperienceSuggestionResponseSerializer,
    GameErrorResponseSerializer,
    HeartbeatInputSerializer,
    HeartbeatResponseSerializer,
    PauseInputSerializer,
    PauseResponseSerializer,
    PendingInputSerializer,
    PendingResponseSerializer,
    PlayerResponseSerializer,
    PlayListResponseSerializer,
    PlayResponseSerializer,
    ReconcileInputSerializer,
    ResolutionResponseSerializer,
    ResultResponseSerializer,
    ResumeResponseSerializer,
    StartPlaySerializer,
    TurnInputSerializer,
    TurnResponseSerializer,
)
from .state import initial_state
from .turns import run_turn

# Swagger 요청 예시용 ID (실제 값은 게임 시작 응답 sessionId · 프론트가 만든 체험 ID)
SAMPLE_SESSION_ID = "3f6c1d2a-8b4e-4c1f-9a7d-2e5b6c7d8e9f"
SAMPLE_EXPERIENCE_ID = "exp-5a0c8b3d"


def api_responses(success_serializer, *errors):
    return {
        200: success_serializer,
        **{status: GameErrorResponseSerializer for status in errors},
    }


class PlayerView(APIView):
    @extend_schema(
        tags=["게스트"],
        summary="게스트 플레이어 발급",
        description=(
            "인증 없이 호출합니다. 새 playerId를 DB에 저장합니다. 호출마다 다른 ID를 반환합니다."
        ),
        request=None,
        responses={200: PlayerResponseSerializer},
        auth=[],
    )
    def post(self, request):
        player = Player.objects.create()
        return Response({"code": 200, "data": {"playerId": str(player.pk)}})


@extend_schema(parameters=PLAYER_PARAMETERS)
class PlaysView(PlayerRequiredView):
    @extend_schema(
        tags=["플레이"],
        summary="게임 시작",
        description=(
            "필수: name, age(7~99), situation(정해진 보기), hasDreamJob. "
            "hasDreamJob=true면 dreamJob도 필수이며 false면 생략/빈 문자열이어야 합니다. "
            "situation은 고등학생 등 지정값만 허용하며 고딩·학생·string은 불가합니다. "
            "선택 항목은 생략할 수 있습니다. 헤더 X-Player-Id는 게스트 발급 결과를 사용하세요."
        ),
        examples=[
            OpenApiExample(
                "최소 요청 · 희망 직업 없음",
                value={"name": "나야나", "age": 20, "situation": "대학생", "hasDreamJob": False},
                request_only=True,
            ),
            OpenApiExample(
                "희망 직업 있음",
                value={
                    "name": "나야나",
                    "age": 20,
                    "situation": "고등학생",
                    "hasDreamJob": True,
                    "dreamJob": "작가",
                },
                request_only=True,
            ),
        ],
        request=StartPlaySerializer,
        responses=api_responses(PlayResponseSerializer, 400, 401),
    )
    def post(self, request):
        serializer = StartPlaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        state = initial_state(serializer.validated_data)
        first = opening(serializer.validated_data)
        messages = first["messages"]
        with transaction.atomic():
            play = Play.objects.create(
                player=self.player,
                profile=serializer.validated_data,
                state=state,
                messages=messages,
                progress={"scene": first["scene"]},
            )
            NPC.objects.create(play=play, key=first["npc"]["id"], name=first["npc"]["name"])
            Turn.objects.create(
                play=play,
                number=0,
                input="",
                response={"messages": messages, "hints": first["hints"]},
                context={
                    "npcIds": first["scene"]["npcIds"],
                    "responseNpcIds": first["scene"]["npcIds"],
                    "sceneId": first["scene"]["id"],
                },
            )
            Message.objects.bulk_create([Message(play=play, turn=0, **item) for item in messages])
        return success(
            {
                "playId": str(play.pk),
                "sessionId": str(play.session_id),
                "state": state,
                "messages": messages,
                "hints": first["hints"],
            }
        )


@extend_schema(parameters=PLAY_PARAMETERS)
class ResumeView(PlayerRequiredView):
    @extend_schema(
        tags=["플레이"],
        summary="플레이 일시정지·해제",
        description=(
            "paused를 저장하고 현재 확정 state를 반환합니다. 정지 중 새 턴을 차단합니다. "
            "진행 중 턴은 상태 버전으로 충돌을 확인합니다."
        ),
        request=PauseInputSerializer,
        examples=[
            OpenApiExample("일시정지", value={"paused": True}, request_only=True),
            OpenApiExample("이어 하기", value={"paused": False}, request_only=True),
        ],
        responses=api_responses(PauseResponseSerializer, 400, 401, 404, 409),
    )
    def patch(self, request, play_id):
        play = owned_play(self.player, play_id)
        serializer = PauseInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return success(set_paused(play, serializer.validated_data["paused"]))

    @extend_schema(
        tags=["플레이"],
        summary="플레이 재개",
        description=(
            "본인 플레이의 저장된 상태와 최근 대화를 읽습니다. "
            "재접속만으로 체험을 정산하지 않습니다."
        ),
        responses=api_responses(ResumeResponseSerializer, 401, 404),
    )
    def get(self, request, play_id):
        play = owned_play(self.player, play_id)
        messages = []
        for item in play.messages:
            speaker = item.get("speaker", "")
            role = item.get("role")
            if role not in {"user", "npc", "narrator"}:
                role = (
                    "user"
                    if speaker == "player"
                    else "narrator"
                    if speaker == "narrator"
                    else "npc"
                )
            if role == "user" and speaker == "player":
                speaker = play.state.get("profile", {}).get("name", "")
            elif role == "narrator" and speaker == "narrator":
                speaker = "나레이션"
            messages.append({"role": role, "speaker": speaker, "text": item["text"]})
        latest = play.turns.order_by("-number").values_list("response", flat=True).first()
        return success(
            {
                "playId": str(play.pk),
                "sessionId": str(play.session_id),
                "state": play.state,
                "messages": messages,
                "hints": latest.get("hints", []) if latest else [],
                "ended": is_ended(play),
                "paused": play.paused,
                "stateVersion": play.state_version,
                "activePlaySeconds": play.active_seconds,
                "scene": play.progress.get(
                    "scene", {"id": "opening", "npcIds": [], "speakerNpcId": None}
                ),
                "pendingChoices": play.progress.get("pendingChoices", []),
                "npcs": npc_list(play),
                "lastTurnId": str(
                    play.turns.order_by("-number").values_list("id", flat=True).first() or ""
                )
                or None,
            }
        )


@extend_schema(parameters=PLAYER_PARAMETERS)
class PlayListView(PlayerRequiredView):
    @extend_schema(
        tags=["플레이"],
        summary="지난 플레이 목록",
        description="X-Player-Id 소유자의 플레이만 최신순으로 반환합니다.",
        responses=api_responses(PlayListResponseSerializer, 401),
    )
    def get(self, request):
        return success(
            {
                "plays": [
                    {
                        "playId": str(play.pk),
                        "startedAt": play.started_at,
                        "ended": is_ended(play),
                        "summary": play.summary,
                    }
                    for play in self.player.plays.order_by("-started_at", "-pk")
                ]
            }
        )


@extend_schema(parameters=PLAY_PARAMETERS)
class TurnView(PlayerRequiredView):
    @extend_schema(
        tags=["대화"],
        summary="채팅 한 턴",
        description=(
            "최근 20턴과 게임 콘텐츠를 AI 서버에 보내고 검증된 상태 변경만 저장합니다. "
            "AI branch가 있으면 3D 후보를 추천합니다. 전체 30초 제한입니다."
        ),
        examples=[
            OpenApiExample(
                "채팅 요청",
                value={
                    "requestId": "11111111-1111-4111-8111-111111111111",
                    "message": "작가가 하는 일을 알아보고 싶어",
                },
                request_only=True,
            )
        ],
        request=TurnInputSerializer,
        responses=api_responses(TurnResponseSerializer, 400, 401, 404, 409, 502, 503, 504),
    )
    def post(self, request, play_id):
        play = owned_play(self.player, play_id)
        serializer = TurnInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return success(
            run_turn(
                play,
                serializer.validated_data["message"],
                request.build_absolute_uri("/"),
                serializer.validated_data["requestId"],
            )
        )


@extend_schema(parameters=PLAY_PARAMETERS)
class ExperienceOfferView(PlayerRequiredView):
    @extend_schema(
        tags=["3D 체험"],
        summary="3D 체험 추천 받기 (화면 카드)",
        description=(
            "채팅 분기 없이 상태 패널 카드에서 3D 체험을 고른다. "
            "현재 직업 → 희망 직업 → 무작위 순서, 해 본 체험은 뺀다. "
            "exclude 를 주면(다시 고르기) 무작위. 받은 추천은 기록되어 "
            "이 체험의 Unity 이벤트 · 생존 신호를 받는다. 종료 · 일시정지 플레이는 409."
        ),
        examples=[
            OpenApiExample("처음 고르기", value={}, request_only=True),
            OpenApiExample(
                "다시 고르기",
                value={"exclude": ["career-net-951-experience"]},
                request_only=True,
            ),
        ],
        request=ExperienceSuggestionInputSerializer,
        responses=api_responses(ExperienceSuggestionResponseSerializer, 400, 401, 404, 409, 503),
    )
    def post(self, request, play_id):
        play = owned_play(self.player, play_id)
        serializer = ExperienceSuggestionInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return success(
            suggest(play, serializer.validated_data["exclude"], request.build_absolute_uri("/"))
        )


@extend_schema(parameters=PLAY_PARAMETERS)
class HeartbeatView(PlayerRequiredView):
    @extend_schema(
        tags=["3D 체험"],
        summary="체험 생존 신호",
        description=(
            "Unity 어댑터가 30초마다 호출합니다. lease를 120초 갱신합니다. "
            "응답은 {code,data}로 감싸지 않습니다. sessionId는 게임 시작(1-2) 응답 값, "
            "experienceId는 프론트가 체험을 시작할 때 만든 ID입니다."
        ),
        request=HeartbeatInputSerializer,
        examples=[
            OpenApiExample(
                "생존 신호",
                value={"sessionId": SAMPLE_SESSION_ID, "experienceId": SAMPLE_EXPERIENCE_ID},
                request_only=True,
            )
        ],
        responses=api_responses(HeartbeatResponseSerializer, 400, 401, 404, 409),
    )
    def post(self, request, play_id):
        serializer = HeartbeatInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        return Response(
            heartbeat(owned_play(self.player, play_id), data["sessionId"], data["experienceId"])
        )


@extend_schema(parameters=PLAY_PARAMETERS)
class PendingView(PlayerRequiredView):
    @extend_schema(
        tags=["3D 체험"],
        summary="종료 응답 미수신 기록",
        description=(
            "종료 응답이 5초 동안 없으면 pending_reconciliation으로 기록합니다. "
            "체험 종료를 확정하지 않으며 응답은 감싸지 않습니다. requestId는 Unity 종료 호출에 "
            "썼던 값 그대로이며 reason은 END_RESPONSE_TIMEOUT 고정입니다."
        ),
        request=PendingInputSerializer,
        examples=[
            OpenApiExample(
                "종료 응답 5초 미수신",
                value={
                    "sessionId": SAMPLE_SESSION_ID,
                    "experienceId": SAMPLE_EXPERIENCE_ID,
                    "roomId": "PAN-002",
                    "requestId": "end-7c2f1e0a",
                    "reason": "END_RESPONSE_TIMEOUT",
                },
                request_only=True,
            )
        ],
        responses=api_responses(PendingResponseSerializer, 400, 401, 404, 409),
    )
    def post(self, request, play_id):
        serializer = PendingInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(mark_pending(owned_play(self.player, play_id), serializer.validated_data))


@extend_schema(parameters=PLAY_PARAMETERS)
class EventView(PlayerRequiredView):
    @extend_schema(
        tags=["3D 체험"],
        summary="Unity 이벤트 저장",
        description=(
            "Unity 이벤트 객체를 그대로 받습니다. DB 저장 후 ACK를 반환하고 "
            "(sessionId,eventId) 중복을 제거합니다. 응답은 감싸지 않습니다. 필드는 Unity "
            "실시간 계약(docs/unity/contracts/realtime-v002)이 정하며, 같은 이벤트를 저장 확인 "
            "전까지 그대로 재전송합니다."
        ),
        request=EventInputSerializer,
        examples=[
            OpenApiExample(
                "물건 선택 (요약)",
                value={
                    "schemaVersion": 1,
                    "protocol": "career-experience",
                    "type": "object.selected",
                    "eventId": "evt-0001",
                    "sequence": 1,
                    "sessionId": SAMPLE_SESSION_ID,
                    "experienceId": SAMPLE_EXPERIENCE_ID,
                    "buildId": "career-suite-integration-v005",
                    "roomId": "PAN-002",
                    "scenarioId": "career-net-951-experience",
                    "scenarioVersion": "v002",
                    "data": {"objectId": "copier"},
                },
                request_only=True,
            )
        ],
        responses=api_responses(EventAckResponseSerializer, 400, 401, 404, 409),
    )
    def post(self, request, play_id):
        play = owned_play(self.player, play_id)
        return Response(store_event(play, request.data))


@extend_schema(parameters=PLAY_PARAMETERS)
class ReconcileView(PlayerRequiredView):
    @extend_schema(
        tags=["3D 체험"],
        summary="종료 미수신 체험 정산",
        description=(
            "새 체험 시작 전에 Unity v003 정산 요청 원본을 받습니다. "
            "Unity experience.reconciled 객체를 감싸지 않고 반환합니다. reconcileRequestId는 "
            "재전송 동안 유지하고, experienceId는 종료 응답을 받지 못한 이전 체험, "
            "newExperienceId는 곧 시작할 체험입니다."
        ),
        request=ReconcileInputSerializer,
        examples=[
            OpenApiExample(
                "새 체험 시작 전 정산",
                value={
                    "schemaVersion": 1,
                    "protocol": "career-experience-resolution",
                    "action": "reconcile_experience",
                    "reconcileRequestId": "reconcile-0001",
                    "sessionId": SAMPLE_SESSION_ID,
                    "experienceId": SAMPLE_EXPERIENCE_ID,
                    "roomId": "PAN-002",
                    "trigger": "NEW_PLAY_START",
                    "newExperienceId": "exp-6b1d9c4e",
                },
                request_only=True,
            )
        ],
        responses=api_responses(ResolutionResponseSerializer, 400, 401, 404, 409),
    )
    def post(self, request, play_id):
        play = owned_play(self.player, play_id)
        serializer = ReconcileInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(reconcile(play, serializer.validated_data))


@extend_schema(parameters=PLAY_PARAMETERS)
class ResultView(PlayerRequiredView):
    @extend_schema(
        tags=["결말"],
        summary="결말과 추천 직업 조회",
        description=(
            "종료된 플레이의 첫 요청에서 AI 결말을 생성·저장합니다. "
            "이후에는 저장된 결과를 반환합니다."
        ),
        responses=api_responses(ResultResponseSerializer, 401, 404, 409, 502, 503, 504),
    )
    def get(self, request, play_id):
        return success(get_or_generate_result(owned_play(self.player, play_id)))
