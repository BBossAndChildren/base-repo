from django.test import TestCase

from apps.game.serializers import (
    EventInputSerializer,
    HeartbeatInputSerializer,
    PauseInputSerializer,
    PendingInputSerializer,
    ReconcileInputSerializer,
)

PLAY = "/api/v1/plays/{play_id}"


class RequestExampleSchemaTests(TestCase):
    """#91: 일시정지 · Unity 4개 요청의 Swagger 예시가 입력 검증을 통과하는지 확인한다."""

    def examples(self, schema, path, method):
        content = schema["paths"][path][method]["requestBody"]["content"]["application/json"]
        return [item["value"] for item in content["examples"].values()]

    def test_examples_exist_and_pass_input_validation(self):
        schema = self.client.get("/api/schema/", HTTP_ACCEPT="application/json").json()
        cases = [
            (PLAY, "patch", PauseInputSerializer, 2),
            (PLAY + "/experience-heartbeat", "post", HeartbeatInputSerializer, 1),
            (PLAY + "/experience-pending", "post", PendingInputSerializer, 1),
            (PLAY + "/experience-events", "post", EventInputSerializer, 1),
            (PLAY + "/experience-reconcile", "post", ReconcileInputSerializer, 1),
        ]
        for path, method, serializer_class, count in cases:
            with self.subTest(path=path):
                values = self.examples(schema, path, method)
                self.assertEqual(len(values), count)
                for value in values:
                    serializer = serializer_class(data=value)
                    self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_descriptions_explain_id_sources(self):
        schema = self.client.get("/api/schema/", HTTP_ACCEPT="application/json").json()
        heartbeat = schema["paths"][PLAY + "/experience-heartbeat"]["post"]["description"]
        pending = schema["paths"][PLAY + "/experience-pending"]["post"]["description"]
        reconcile = schema["paths"][PLAY + "/experience-reconcile"]["post"]["description"]
        self.assertIn("sessionId는 게임 시작", heartbeat)
        self.assertIn("END_RESPONSE_TIMEOUT 고정", pending)
        self.assertIn("reconcileRequestId는", reconcile)
