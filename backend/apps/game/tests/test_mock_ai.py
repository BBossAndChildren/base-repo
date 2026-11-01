import secrets
import threading
from http.server import ThreadingHTTPServer

import httpx
from django.test import SimpleTestCase

from apps.game.mock_ai import make_handler

from .test_ai_recommendation import test_catalog


class MockAITests(SimpleTestCase):
    def setUp(self):
        self.key = secrets.token_urlsafe(24)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(self.key))
        self.thread = threading.Thread(
            target=lambda: self.server.serve_forever(poll_interval=0.01), daemon=True
        )
        self.thread.start()
        self.client = httpx.Client(base_url="http://127.0.0.1:" + str(self.server.server_port))
        self.addCleanup(self.cleanup_server)

    def cleanup_server(self):
        self.client.close()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=1)

    def test_mock_is_explicit_and_internal_key_is_required(self):
        self.assertFalse(self.client.get("/health").json()["realModel"])
        self.assertEqual(self.client.post("/ai/v1/chat", json={}).status_code, 401)
        response = self.client.post(
            "/ai/v1/chat",
            headers={"X-Internal-Key": self.key},
            json={
                "input": "테스트 종료",
                "guidelines": "테스트",
                "scenario": "테스트",
                "player": {},
                "history": [],
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["data"]["lifeEnded"])
        self.assertIn("실제 모델 아님", response.json()["data"]["messages"][0]["text"])

    def test_mock_uses_current_scene_speaker(self):
        response = self.client.post(
            "/ai/v1/chat",
            headers={"X-Internal-Key": self.key},
            json={
                "input": "안녕",
                "guidelines": "테스트",
                "scenario": "테스트",
                "player": {
                    "speakingNpcId": "b",
                    "npcs": [{"id": "a", "name": "승언"}, {"id": "b", "name": "성준"}],
                },
                "history": [],
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["messages"][0]["speaker"], "성준")

    def test_recommendation_endpoint_uses_only_provided_candidates(self):
        response = self.client.post(
            "/ai/v1/experience-recommendation",
            headers={"X-Internal-Key": self.key},
            json={"candidates": test_catalog()["experiences"]},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["roomId"], "PAN-002")

    def test_ending_endpoint_has_three_jobs_and_marks_new_jobs(self):
        response = self.client.post(
            "/ai/v1/ending",
            headers={"X-Internal-Key": self.key},
            json={
                "guidelines": "테스트",
                "player": {},
                "candidates": [{"job": "사서", "score": 2, "evidence": ["대화"]}],
                "experiencedJobs": ["사서"],
            },
        )
        self.assertEqual(response.status_code, 200)
        jobs = response.json()["data"]["recommendedJobs"]
        self.assertEqual(len(jobs), 3)
        self.assertFalse(jobs[0]["isNew"])
        self.assertTrue(jobs[1]["isNew"])
