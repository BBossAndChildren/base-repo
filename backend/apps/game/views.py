from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Player


class PlayerDataSerializer(serializers.Serializer):
    playerId = serializers.UUIDField(help_text="발급된 게스트 플레이어 UUID")


class PlayerResponseSerializer(serializers.Serializer):
    code = serializers.IntegerField(help_text="성공 응답 코드")
    data = PlayerDataSerializer()


class PlayerView(APIView):
    @extend_schema(
        tags=["플레이어"],
        summary="게스트 플레이어 발급",
        description="인증 없이 플레이어 UUID를 발급합니다. 이후 X-Player-Id 헤더에 사용합니다.",
        request=None,
        responses={200: PlayerResponseSerializer},
    )
    def post(self, request):
        player = Player.objects.create()
        return Response({"code": 200, "data": {"playerId": str(player.pk)}})
