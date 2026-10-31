from django.test import TestCase
from django.urls import reverse


class ContractSchemaTests(TestCase):
    def test_all_ten_game_endpoints_and_error_contracts_are_documented(self):
        schema = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json").json()
        root = "/api/v1"
        expected = [
            ("post", root + "/players", {"200"}),
            ("post", root + "/plays", {"200", "400", "401"}),
            ("get", root + "/players/me/plays", {"200", "401"}),
            ("get", root + "/plays/{play_id}", {"200", "401", "404"}),
            (
                "post",
                root + "/plays/{play_id}/turns",
                {"200", "400", "401", "404", "409", "502", "503", "504"},
            ),
            (
                "get",
                root + "/plays/{play_id}/result",
                {"200", "401", "404", "409", "502", "503", "504"},
            ),
        ]
        expected += [
            ("post", root + "/plays/{play_id}/" + suffix, {"200", "400", "401", "404", "409"})
            for suffix in (
                "experience-events",
                "experience-reconcile",
                "experience-heartbeat",
                "experience-pending",
            )
        ]
        self.assertEqual(len(expected), 10)
        for method, path, statuses in expected:
            with self.subTest(path=path):
                operation = schema["paths"][path][method]
                self.assertEqual(set(operation["responses"]), statuses)
                self.assertTrue(operation["tags"])
                self.assertTrue(operation["summary"])
                self.assertTrue(operation["description"])
                if "401" in statuses:
                    header = next(p for p in operation["parameters"] if p["name"] == "X-Player-Id")
                    self.assertTrue(header["required"])
                if "{play_id}" in path:
                    parameter = next(p for p in operation["parameters"] if p["name"] == "play_id")
                    self.assertTrue(parameter["description"])
                    self.assertEqual(parameter["schema"]["format"], "uuid")
        self.assertFalse(any(path.startswith("/ai/") for path in schema["paths"]))

    def test_unwrapped_unity_ack_and_resolution_fields_match_the_contract(self):
        schema = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json").json()
        schemas = schema["components"]["schemas"]
        ack = schemas["EventAckResponse"]
        self.assertEqual(set(ack["required"]), {"stored", "sessionId", "eventId"})
        self.assertNotIn("data", ack["properties"])
        resolution = schemas["ResolutionResponse"]
        for name in (
            "reconcileRequestId",
            "resolutionId",
            "revision",
            "supersedesRevision",
            "resolvedAt",
            "buildId",
            "roomId",
            "scenarioId",
            "scenarioVersion",
            "unityEndReceived",
            "lastObserved",
            "process",
            "result",
            "context",
            "evidence",
        ):
            self.assertIn(name, resolution["required"])
        self.assertNotIn("data", resolution["properties"])
