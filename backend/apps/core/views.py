from django.db import DatabaseError, connection
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthDataSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["ok", "unavailable"])
    database = serializers.ChoiceField(choices=["ok", "unavailable"])


class HealthResponseSerializer(serializers.Serializer):
    code = serializers.IntegerField()
    data = HealthDataSerializer()


class HealthView(APIView):
    @extend_schema(
        auth=[],
        responses={200: HealthResponseSerializer, 503: HealthResponseSerializer},
        description="PostgreSQL SELECT 1로 API 및 DB 연결 확인. AI 연결은 검사하지 않습니다.",
    )
    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except DatabaseError:
            return Response(
                {"code": 503, "data": {"status": "unavailable", "database": "unavailable"}},
                status=503,
            )
        return Response({"code": 200, "data": {"status": "ok", "database": "ok"}})
