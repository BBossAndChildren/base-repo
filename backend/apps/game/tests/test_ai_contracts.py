import json
import secrets
import threading
import time
from http.server import ThreadingHTTPServer
from unittest.mock import patch

import httpx
from django.test import SimpleTestCase, override_settings

from apps.game import ai
from apps.game.common import GameError
from apps.game.mock_ai import make_handler

from .test_ai_chat import ai_response
from .test_ai_recommendation import BRANCH, selection, test_catalog
from .test_result import valid_result

REAL_CLIENT = httpx.AsyncClient


class AIContractTests(SimpleTestCase):
    def setUp(self):
        self.key = secrets.token_urlsafe(24)
        enabled = override_settings(AI_API_BASE_URL="http://ai.invalid", AI_SERVER_KEY=self.key)
        enabled.enable()
        self.addCleanup(enabled.disable)

    def transport(self, handler):
        return patch(
            "apps.game.ai.httpx.AsyncClient",
            side_effect=lambda **kwargs: REAL_CLIENT(
                transport=httpx.MockTransport(handler), **kwargs
            ),
        )

    def test_three_http_contracts_send_exact_fields_and_internal_key(self):
        calls = []

        def handler(request):
            self.assertEqual(request.headers["X-Internal-Key"], self.key)
            body = json.loads(request.content)
            calls.append(request.url.path)
            if request.url.path == "/ai/v1/chat":
                self.assertEqual(
                    set(body), {"guidelines", "scenario", "player", "history", "input"}
                )
                self.assertEqual(body["player"]["speakingNpcId"], "npc-a")
                self.assertIn("인생", body["scenario"])
                data = ai_response()["data"]
            elif request.url.path == "/ai/v1/experience-recommendation":
                self.assertEqual(set(body), {"candidates", "branch", "situation", "player"})
                self.assertLessEqual(len(body["candidates"]), 20)
                data = selection()
            else:
                self.assertEqual(request.url.path, "/ai/v1/ending")
                self.assertEqual(
                    set(body), {"guidelines", "player", "candidates", "experiencedJobs"}
                )
                self.assertEqual(body["experiencedJobs"], ["행사기획자"])
                data = valid_result()
            return httpx.Response(200, json={"code": 200, "data": data})

        with (
            self.transport(handler),
            patch("apps.game.ai.load_catalog", return_value=test_catalog()),
        ):
            ai.chat({"profile": {}, "speakingNpcId": "npc-a"}, [], "안녕", time.monotonic() + 2)
            self.assertIsNotNone(
                ai.recommend(
                    {}, BRANCH, "상황", [], "https://current.invalid/", time.monotonic() + 2
                )
            )
            self.assertEqual(
                len(ai.ending({}, [], ["행사기획자"], time.monotonic() + 2)["recommendedJobs"]), 3
            )
        self.assertEqual(
            calls, ["/ai/v1/chat", "/ai/v1/experience-recommendation", "/ai/v1/ending"]
        )

    def test_recommendation_error_retries_once_and_falls_back_to_text(self):
        calls = []

        def handler(request):
            calls.append(request)
            return httpx.Response(503)

        with (
            self.transport(handler),
            patch("apps.game.ai.load_catalog", return_value=test_catalog()),
        ):
            self.assertIsNone(
                ai.recommend(
                    {}, BRANCH, "상황", [], "https://current.invalid", time.monotonic() + 1
                )
            )
        self.assertEqual(len(calls), 2)

    def test_ending_invalid_response_retries_once_then_502(self):
        calls = []

        def handler(request):
            calls.append(request)
            return httpx.Response(200, json={"code": 200, "data": {"ending": "잘못된 형식"}})

        with self.transport(handler), self.assertRaises(GameError) as error:
            ai.ending({}, [], [], time.monotonic() + 1)
        self.assertEqual(error.exception.status_code, 502)
        self.assertEqual(len(calls), 2)

    def test_all_three_use_real_http_against_explicit_mock_server(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(self.key))
        thread = threading.Thread(
            target=lambda: server.serve_forever(poll_interval=0.01), daemon=True
        )
        thread.start()
        try:
            with (
                override_settings(AI_API_BASE_URL=f"http://127.0.0.1:{server.server_port}"),
                patch("apps.game.ai.load_catalog", return_value=test_catalog()),
            ):
                self.assertIn(
                    "실제 모델 아님",
                    ai.chat({"profile": {}}, [], "안녕", time.monotonic() + 2)["messages"][0][
                        "text"
                    ],
                )
                self.assertIsNotNone(
                    ai.recommend(
                        {}, BRANCH, "상황", [], "https://current.invalid", time.monotonic() + 2
                    )
                )
                self.assertEqual(
                    len(ai.ending({}, [], [], time.monotonic() + 2)["recommendedJobs"]), 3
                )
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)
