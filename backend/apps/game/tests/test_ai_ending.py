import secrets
import time
from unittest.mock import patch

import httpx
from django.test import SimpleTestCase, override_settings

from apps.game.ai import call_ai
from apps.game.common import GameError
from apps.game.serializers import AIEndingResponseSerializer

from .test_result import valid_result

REAL_CLIENT = httpx.AsyncClient


class AIEndingTests(SimpleTestCase):
    def setUp(self):
        self.key = secrets.token_urlsafe(24)
        enabled = override_settings(AI_API_BASE_URL="http://ai.invalid", AI_SERVER_KEY=self.key)
        enabled.enable()
        self.addCleanup(enabled.disable)

    def request(self, data):
        calls = []

        def handler(request):
            calls.append(request)
            self.assertEqual(request.url.path, "/ai/v1/ending")
            self.assertEqual(request.headers["X-Internal-Key"], self.key)
            return httpx.Response(200, json={"code": 200, "data": data})

        with patch(
            "apps.game.ai.httpx.AsyncClient",
            side_effect=lambda **kwargs: REAL_CLIENT(
                transport=httpx.MockTransport(handler), **kwargs
            ),
        ):
            result = call_ai(
                "/ai/v1/ending",
                {"candidates": []},
                AIEndingResponseSerializer,
                time.monotonic() + 1,
            )
        return result, len(calls)

    def test_valid_three_jobs_with_new_job(self):
        result, count = self.request(valid_result())
        self.assertEqual(result["recommendedJobs"][1]["isNew"], True)
        self.assertEqual(count, 1)

    def test_invalid_job_count_or_missing_new_job_is_rejected(self):
        for data in [
            valid_result() | {"recommendedJobs": valid_result()["recommendedJobs"][:2]},
            valid_result()
            | {
                "recommendedJobs": [
                    {**job, "isNew": False} for job in valid_result()["recommendedJobs"]
                ]
            },
        ]:
            with self.assertRaises(GameError) as error:
                self.request(data)
            self.assertEqual(error.exception.status_code, 502)

    def test_duplicate_jobs_are_rejected(self):
        data = valid_result()
        data["recommendedJobs"][1]["job"] = data["recommendedJobs"][0]["job"]
        with self.assertRaises(GameError) as error:
            self.request(data)
        self.assertEqual(error.exception.status_code, 502)
