import uuid
from unittest.mock import patch

from django.test import TestCase, TransactionTestCase

from apps.game.models import Play, Turn, TurnRequest

from . import test_turns as turns_fixture


class TurnRequestTests(TestCase):
    setUp = turns_fixture.TurnTests.setUp
    post = turns_fixture.TurnTests.post

    def test_replay_is_exact_and_does_not_call_ai_or_write_twice(self):
        body = {"requestId": str(uuid.uuid4()), "message": "같은 행동"}
        with patch("apps.game.turns.ai.chat", return_value=self.data) as chat:
            first = self.post(body)
            second = self.post(body)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json(), second.json())
        self.assertEqual(chat.call_count, 1)
        self.assertEqual(Turn.objects.count(), 1)
        self.play.refresh_from_db()
        self.assertEqual(self.play.state_version, 1)
        self.assertEqual(first.json()["data"]["state"], self.play.state)

    def test_same_id_changed_input_conflicts(self):
        body = {"requestId": str(uuid.uuid4()), "message": "첫 행동"}
        with patch("apps.game.turns.ai.chat", return_value=self.data) as chat:
            self.post(body)
            response = self.post(body | {"message": "다른 행동"})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["type"], "REQUEST_CONFLICT")
        self.assertEqual(chat.call_count, 1)

    def test_state_change_during_ai_rolls_back_turn_and_allows_retry(self):
        body = {"requestId": str(uuid.uuid4()), "message": "재시도"}

        def change(*args, **kwargs):
            Play.objects.filter(pk=self.play.pk).update(state_version=1)
            return self.data

        with patch("apps.game.turns.ai.chat", side_effect=change):
            response = self.post(body)
        self.assertEqual(response.json()["error"]["type"], "STATE_CONFLICT")
        self.assertFalse(Turn.objects.exists())
        self.assertEqual(TurnRequest.objects.get().status, "failed")
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            self.assertEqual(self.post(body).status_code, 200)
        self.assertEqual(TurnRequest.objects.get().status, "completed")

    def test_request_id_is_required_uuid_and_documented(self):
        self.assertEqual(self.post({"requestId": "invalid", "message": "입력"}).status_code, 400)
        schema = self.client.get("/api/schema/", HTTP_ACCEPT="application/json").json()
        self.assertIn("requestId", schema["components"]["schemas"]["TurnInput"]["required"])
        self.assertIn("state", schema["components"]["schemas"]["TurnData"]["required"])


class ConcurrentTurnTests(TransactionTestCase):
    def test_parallel_duplicate_is_not_executed_twice(self):
        import threading

        from django.db import close_old_connections, connections
        from django.test import Client

        from apps.game.models import Player
        from apps.game.state import initial_state

        from .test_ai_chat import ai_response

        player = Player.objects.create()
        play = Play.objects.create(
            player=player, state=initial_state({"age": 15, "situation": "중학생"})
        )
        body = {"requestId": str(uuid.uuid4()), "message": "안녕"}
        started, release = threading.Event(), threading.Event()
        responses = []
        errors = []

        def generation(*args, **kwargs):
            started.set()
            if not release.wait(3):
                raise RuntimeError("동시 요청 테스트 시간 초과")
            return ai_response()["data"]

        def post():
            import json

            return Client().post(
                f"/api/v1/plays/{play.pk}/turns",
                json.dumps(body),
                content_type="application/json",
                HTTP_X_PLAYER_ID=str(player.pk),
            )

        def worker():
            close_old_connections()
            try:
                responses.append(post())
            except Exception as error:
                errors.append(error)
            finally:
                connections.close_all()

        with patch("apps.game.turns.ai.chat", side_effect=generation) as ai:
            thread = threading.Thread(target=worker)
            thread.start()
            try:
                self.assertTrue(started.wait(3))
                duplicate = post()
                self.assertEqual(duplicate.status_code, 409)
                self.assertEqual(duplicate.json()["error"]["type"], "TURN_IN_PROGRESS")
            finally:
                release.set()
                thread.join(timeout=3)
            self.assertFalse(thread.is_alive())
            self.assertEqual(errors, [])
            self.assertEqual(responses[0].status_code, 200)
            self.assertEqual(post().json(), responses[0].json())
            self.assertEqual(ai.call_count, 1)
        self.assertEqual(Turn.objects.filter(play=play).count(), 1)
