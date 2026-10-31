import json
import uuid
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from apps.game.models import Play, Player, Turn
from apps.game.pause import set_paused

from .test_ai_chat import ai_response


class PauseTests(TestCase):
    def setUp(self):
        self.player = Player.objects.create()
        self.play = Play.objects.create(player=self.player, state={"elapsedDays": 12})
        self.path = f"/api/v1/plays/{self.play.pk}"
        self.header = {"HTTP_X_PLAYER_ID": str(self.player.pk)}

    def pause(self, body, **header):
        return self.client.patch(
            self.path, json.dumps(body), content_type="application/json", **(header or self.header)
        )

    def test_pause_resume_read_and_idempotent_patch(self):
        result = self.pause({"paused": True})
        self.assertEqual(result.status_code, 200)
        self.assertTrue(result.json()["data"]["paused"])
        self.assertEqual(self.pause({"paused": True}).json(), result.json())
        self.assertTrue(self.client.get(self.path, **self.header).json()["data"]["paused"])
        self.assertFalse(self.pause({"paused": False}).json()["data"]["paused"])
        self.play.refresh_from_db()
        self.assertEqual(self.play.state, {"elapsedDays": 12})
        self.assertEqual(self.play.state_version, 2)
        self.assertEqual(self.play.active_seconds, 0)

    def test_paused_turn_rejected_before_ai(self):
        set_paused(self.play, True)
        with patch("apps.game.turns.ai.chat") as chat:
            response = self.client.post(
                self.path + "/turns",
                json.dumps({"requestId": str(uuid.uuid4()), "message": "안녕"}),
                content_type="application/json",
                **self.header,
            )
        self.assertEqual(response.json()["error"]["type"], "PLAY_PAUSED")
        chat.assert_not_called()

    def test_pause_during_generation_invalidates_commit(self):
        def generation(*args, **kwargs):
            set_paused(self.play, True)
            return ai_response()["data"]

        with patch("apps.game.turns.ai.chat", side_effect=generation):
            response = self.client.post(
                self.path + "/turns",
                json.dumps({"requestId": str(uuid.uuid4()), "message": "안녕"}),
                content_type="application/json",
                **self.header,
            )
        self.assertEqual(response.json()["error"]["type"], "STATE_CONFLICT")
        self.assertFalse(Turn.objects.exists())
        self.play.refresh_from_db()
        self.assertTrue(self.play.paused)

    def test_pause_accounts_only_known_active_interval(self):
        self.play.turn_started_at = timezone.now() - timedelta(seconds=2)
        self.play.turn_expires_at = timezone.now() + timedelta(seconds=28)
        self.play.save()
        set_paused(self.play, True)
        self.play.refresh_from_db()
        self.assertGreaterEqual(self.play.active_seconds, 2)
        self.assertLess(self.play.active_seconds, 3)
        set_paused(self.play, True)
        self.assertIsNone(self.play.turn_started_at)

    def test_input_ownership_ended_and_schema(self):
        self.assertEqual(self.pause({}).status_code, 400)
        self.assertEqual(
            self.pause(
                {"paused": True}, HTTP_X_PLAYER_ID=str(Player.objects.create().pk)
            ).status_code,
            404,
        )
        self.play.ended = True
        self.play.save()
        self.assertEqual(self.pause({"paused": True}).status_code, 409)
        schema = self.client.get("/api/schema/", HTTP_ACCEPT="application/json").json()
        self.assertIn("patch", schema["paths"]["/api/v1/plays/{play_id}"])
        self.assertIn("paused", schema["components"]["schemas"]["PauseInput"]["required"])
