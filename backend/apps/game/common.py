import uuid

from drf_spectacular.utils import OpenApiParameter, OpenApiTypes
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Play, Player

PLAYER_PARAMETERS = [
    OpenApiParameter(
        "X-Player-Id",
        OpenApiTypes.UUID,
        OpenApiParameter.HEADER,
        required=True,
        description="POST /api/v1/players에서 발급받은 게스트 playerId",
    )
]
PLAY_PARAMETERS = [
    *PLAYER_PARAMETERS,
    OpenApiParameter(
        "play_id",
        OpenApiTypes.UUID,
        OpenApiParameter.PATH,
        required=True,
        description="게임 시작 응답에서 발급한 playId. 본인 소유 플레이만 접근 가능합니다.",
    ),
]


class GameError(APIException):
    def __init__(self, status, kind, message):
        self.status_code = status
        self.kind = kind
        super().__init__(message)


class GameView(APIView):
    def handle_exception(self, exc):
        response = super().handle_exception(exc)
        response.data = {
            "code": response.status_code,
            "error": {
                "type": getattr(exc, "kind", "INVALID_INPUT"),
                "message": str(exc.detail)
                if isinstance(exc, GameError)
                else "입력 내용을 확인해 주세요.",
            },
        }
        return response


class PlayerRequiredView(GameView):
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        try:
            player_id = uuid.UUID(request.headers.get("X-Player-Id", ""))
            self.player = Player.objects.get(pk=player_id)
        except (ValueError, Player.DoesNotExist):
            raise GameError(401, "UNKNOWN_PLAYER", "플레이 정보를 찾을 수 없어요.") from None


def success(data):
    return Response({"code": 200, "data": data})


def is_ended(play):
    return play.ended or play.ended_at is not None


def owned_play(player, play_id):
    try:
        return Play.objects.get(pk=uuid.UUID(str(play_id)), player=player)
    except (ValueError, Play.DoesNotExist):
        raise GameError(404, "NOT_FOUND", "플레이 정보를 찾을 수 없어요.") from None
