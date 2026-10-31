import asyncio
import json
import secrets
import tempfile
import time
from pathlib import Path
from unittest.mock import patch

import httpx
from django.test import SimpleTestCase, override_settings

from apps.game.ai import chat
from apps.game.common import GameError

REAL_ASYNC_CLIENT = httpx.AsyncClient


def ai_response():
    return {
        "code": 200,
        "data": {
            "messages": [{"role": "npc", "speaker": "NPC", "text": "테스트 응답"}],
            "stateChanges": [],
            "hints": [],
            "branch": None,
            "lifeEnded": False,
        },
    }


class AIChatTests(SimpleTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        path = Path(self.temp.name) / "test-content.md"
        path.write_text("자동 테스트용 콘텐츠", encoding="utf-8")
        self.settings_override = override_settings(
            AI_API_BASE_URL="http://ai.invalid",
            AI_SERVER_KEY=secrets.token_urlsafe(24),
            GAME_GUIDELINES_PATH=str(path),
            GAME_SCENARIO_PATH=str(path),
        )
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)

    def run_with(self, handler, timeout=1):
        transport = httpx.MockTransport(handler)
        with patch(
            "apps.game.ai.httpx.AsyncClient",
            side_effect=lambda **kwargs: REAL_ASYNC_CLIENT(transport=transport, **kwargs),
        ):
            return chat({"profile": {}}, [], "테스트", time.monotonic() + timeout)

    def test_sends_content_and_internal_key(self):
        from django.conf import settings

        def handler(request):
            self.assertEqual(request.url.path, "/ai/v1/chat")
            self.assertEqual(request.headers["X-Internal-Key"], settings.AI_SERVER_KEY)
            data = json.loads(request.content)
            self.assertIn("자동 테스트", data["guidelines"])
            self.assertIn("자동 테스트", data["scenario"])
            self.assertEqual(len(data["player"]["missingProfileFields"]), 7)
            return httpx.Response(200, json=ai_response())

        self.assertEqual(self.run_with(handler)["messages"][0]["text"], "테스트 응답")

    def test_bad_json_or_server_error_retried_once(self):
        for first in [httpx.Response(503), httpx.Response(200, json={"bad": True})]:
            calls = []

            def handler(request):
                calls.append(request)
                return first if len(calls) == 1 else httpx.Response(200, json=ai_response())

            self.run_with(handler)
            self.assertEqual(len(calls), 2)

    def test_repeated_failure_is_502(self):
        calls = []

        def handler(request):
            calls.append(request)
            return httpx.Response(500)

        with self.assertRaises(GameError) as error:
            self.run_with(handler)
        self.assertEqual(error.exception.status_code, 502)
        self.assertEqual(len(calls), 2)

    def test_whole_request_deadline_cancels_slow_response(self):
        async def handler(request):
            await asyncio.sleep(1)
            return httpx.Response(200, json=ai_response())

        started = time.monotonic()
        with self.assertRaises(GameError) as error:
            self.run_with(handler, timeout=0.02)
        self.assertEqual(error.exception.status_code, 504)
        self.assertLess(time.monotonic() - started, 0.5)

    @override_settings(GAME_GUIDELINES_PATH="")
    def test_missing_guidelines_prevents_network_call(self):
        with patch("apps.game.ai._request") as request:
            with self.assertRaises(GameError) as error:
                chat({}, [], "입력", time.monotonic() + 1)
        self.assertEqual(error.exception.status_code, 503)
        request.assert_not_called()

    def test_history_is_last_twenty_turns_not_twenty_messages(self):
        turns = [
            {"input": str(i), "messages": [{"speaker": "NPC", "text": str(i)}]} for i in range(23)
        ]

        def handler(request):
            history = json.loads(request.content)["history"]
            self.assertEqual(len(history), 40)
            self.assertEqual(history[0], {"role": "user", "text": "3"})
            self.assertEqual(history[-1]["text"], "22")
            return httpx.Response(200, json=ai_response())

        transport = httpx.MockTransport(handler)
        with patch(
            "apps.game.ai.httpx.AsyncClient",
            side_effect=lambda **kwargs: REAL_ASYNC_CLIENT(transport=transport, **kwargs),
        ):
            chat({"profile": {}}, turns, "다음", time.monotonic() + 1)

    def test_branch_shape_is_validated(self):
        def valid(request):
            body = ai_response()
            body["data"]["branch"] = {"topic": "행사", "jobs": ["기획자"], "reason": "제안"}
            return httpx.Response(200, json=body)

        self.assertEqual(self.run_with(valid)["branch"]["jobs"], ["기획자"])

        def invalid(request):
            body = ai_response()
            body["data"]["branch"] = {"jobs": ["기획자"]}
            return httpx.Response(200, json=body)

        with self.assertRaises(GameError) as error:
            self.run_with(invalid)
        self.assertEqual(error.exception.status_code, 502)

    def test_rejects_user_role_in_ai_message(self):
        def handler(request):
            body = ai_response()
            body["data"]["messages"][0]["role"] = "user"
            return httpx.Response(200, json=body)

        with self.assertRaises(GameError) as error:
            self.run_with(handler)
        self.assertEqual(error.exception.status_code, 502)
