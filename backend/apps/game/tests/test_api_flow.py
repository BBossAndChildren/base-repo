import copy
import json
import secrets
import threading
import uuid
from datetime import date
from http.server import ThreadingHTTPServer
from pathlib import Path

from django.test import TestCase, override_settings
from django.urls import reverse

from apps.game.mock_ai import make_handler
from apps.game.models import ExperienceEvent, Play
from apps.game.rules import add_months

from .test_events import actual_events


class APIFlowTests(TestCase):
    """실제 PostgreSQL + 로컬 HTTP 모의 AI. GPU·WebGL 실연동 검증은 아니다."""

    def setUp(self):
        key = secrets.token_urlsafe(24)
        server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(key))
        thread = threading.Thread(
            target=lambda: server.serve_forever(poll_interval=0.01), daemon=True
        )
        thread.start()

        def stop():
            server.shutdown()
            server.server_close()
            thread.join(timeout=1)

        self.addCleanup(stop)
        fixtures = Path(__file__).parent / "fixtures"
        configured = override_settings(
            AI_API_BASE_URL=f"http://127.0.0.1:{server.server_port}",
            AI_SERVER_KEY=key,
            GAME_GUIDELINES_PATH=str(fixtures / "mock-guidelines.md"),
            GAME_SCENARIO_PATH=str(fixtures / "mock-scenario.md"),
            GAME_BUILD_CATALOG_PATH=str(fixtures / "mock-catalog.json"),
        )
        configured.enable()
        self.addCleanup(configured.disable)
        self.player = self.client.post(reverse("players")).json()["data"]["playerId"]

    def post(self, name, body, play=None):
        if name == "turns":
            body = {"requestId": str(uuid.uuid4()), **body}
        response = self.client.post(
            reverse(name, args=[play] if play else []),
            json.dumps(body),
            content_type="application/json",
            HTTP_X_PLAYER_ID=self.player,
        )
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def get(self, name, play=None):
        response = self.client.get(
            reverse(name, args=[play] if play else []), HTTP_X_PLAYER_ID=self.player
        )
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()["data"]

    def test_all_ten_endpoints_from_guest_to_stored_ending_over_http(self):
        start = self.post(
            "plays",
            {
                "name": "테스터",
                "age": 15,
                "situation": "중학생",
                "hasDreamJob": True,
                "dreamJob": "행사기획자",
            },
        )["data"]
        play = start["playId"]
        self.assertEqual(start["state"]["age"], 15)
        turn = self.post("turns", {"message": "테스트 3D"}, play)["data"]
        offer = turn["experience"]
        self.assertIsNotNone(offer)
        self.assertEqual(offer["scenarioId"], "career-net-951-experience")
        session = start["sessionId"]
        experience = "integration-fixture-experience"
        heartbeat = self.post("heartbeat", {"sessionId": session, "experienceId": experience}, play)
        self.assertNotIn("data", heartbeat)
        pending = self.post(
            "pending",
            {
                "sessionId": session,
                "experienceId": experience,
                "roomId": offer["roomId"],
                "requestId": "end-request",
                "reason": "END_RESPONSE_TIMEOUT",
            },
            play,
        )
        self.assertEqual(pending["lifecycleStatus"], "pending_reconciliation")

        # 기존 Unity fixture를 테스트 세션과 추천 ID에 맞춘다.
        for original in actual_events():
            event = copy.deepcopy(original)
            event.update({"sessionId": session, "experienceId": experience})
            event.update(
                {key: offer[key] for key in ("buildId", "roomId", "scenarioId", "scenarioVersion")}
            )
            ack = self.post("events", event, play)
            self.assertTrue(ack["stored"])
            self.assertNotIn("data", ack)
        self.assertEqual(ExperienceEvent.objects.count(), len(actual_events()))

        resolution = self.post(
            "reconcile",
            {
                "schemaVersion": 1,
                "protocol": "career-experience-resolution",
                "action": "reconcile_experience",
                "reconcileRequestId": "reconcile-request",
                "sessionId": session,
                "experienceId": experience,
                "roomId": offer["roomId"],
                "trigger": "NEW_PLAY_START",
                "newExperienceId": "next-experience",
            },
            play,
        )
        self.assertEqual(resolution["lifecycleStatus"], "ended")
        self.assertNotIn("data", resolution)
        # 실제 사망 규칙의 경계 조건을 준비한다. AI의 종료 제안만으로 끝내지 않는다.
        stored = Play.objects.get(pk=play)
        stored.state["health"] = 0
        stored.progress["zeroHealthSince"] = add_months(
            date.fromisoformat(stored.state["gameDate"]), -6
        ).isoformat()
        stored.save(update_fields=["state", "progress"])
        self.assertTrue(self.post("turns", {"message": "테스트 종료"}, play)["data"]["ended"])
        resumed = self.get("resume", play)
        self.assertEqual(resumed["sessionId"], session)
        self.assertTrue(resumed["ended"])
        self.assertEqual(resumed["messages"][-2]["role"], "user")
        self.assertTrue(self.get("play-list")["plays"][0]["ended"])
        result = self.get("result", play)
        self.assertEqual(len(result["recommendedJobs"]), 3)
        self.assertTrue(any(job["isNew"] for job in result["recommendedJobs"]))
        self.assertEqual(self.get("result", play), result)
        self.assertEqual(Play.objects.get(pk=play).ending, result)
