from unittest.mock import patch

from django.db import OperationalError, connection
from django.test import TestCase, override_settings
from django.urls import reverse


class HealthTests(TestCase):
    def test_health_checks_postgresql(self):
        self.assertEqual(connection.vendor, "postgresql")
        response = self.client.get(reverse("health"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"code": 200, "data": {"status": "ok", "database": "ok"}})


class InfrastructureTests(TestCase):
    def test_database_failure_returns_503_without_credentials(self):
        with patch("apps.core.views.connection.cursor", side_effect=OperationalError("private")):
            response = self.client.get(reverse("health"))
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["data"]["database"], "unavailable")
        self.assertNotContains(response, "private", status_code=503)

    def test_openapi_documents_health_responses(self):
        response = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json")
        self.assertEqual(response.status_code, 200)
        responses = response.json()["paths"]["/api/health"]["get"]["responses"]
        self.assertEqual(set(responses), {"200", "503"})

    def test_swagger_loads(self):
        self.assertEqual(self.client.get(reverse("swagger-ui")).status_code, 200)

    @override_settings(CORS_ALLOWED_ORIGINS=["http://localhost:5173"])
    def test_preflight_accepts_player_header_only_for_allowed_origin(self):
        for origin, allowed in [("http://localhost:5173", True), ("https://other.invalid", False)]:
            response = self.client.options(
                reverse("health"),
                HTTP_ORIGIN=origin,
                HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
                HTTP_ACCESS_CONTROL_REQUEST_HEADERS="x-player-id,content-type",
            )
            self.assertEqual("Access-Control-Allow-Origin" in response, allowed)
            if allowed:
                self.assertIn("x-player-id", response["Access-Control-Allow-Headers"])
