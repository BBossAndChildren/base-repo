import uuid

from django.test import TestCase
from django.urls import reverse

from apps.game.models import Play, Player


class ResumeTests(TestCase):
    def setUp(self):
        self.player = Player.objects.create()
        self.play = Play.objects.create(
            player=self.player,
            state={"experiences": [{"status": "active"}]},
            messages=[{"speaker": "narrator", "text": "기존 대화"}],
        )

    def get(self, play_id, player=None):
        return self.client.get(
            reverse("resume", args=[play_id]), HTTP_X_PLAYER_ID=str(player or self.player.pk)
        )

    def test_resume_returns_persisted_state_without_mutation(self):
        before = self.play.state
        response = self.get(self.play.pk)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["sessionId"], str(self.play.session_id))
        self.assertEqual(
            response.json()["data"]["messages"],
            [{"role": "narrator", "speaker": "나레이션", "text": "기존 대화"}],
        )
        self.assertFalse(response.json()["data"]["ended"])
        self.play.refresh_from_db()
        self.assertEqual(self.play.state, before)

    def test_foreign_or_missing_or_invalid_play_is_404(self):
        foreign = Player.objects.create()
        for play_id, player in [
            (self.play.pk, foreign.pk),
            (uuid.uuid4(), self.player.pk),
            ("bad", self.player.pk),
        ]:
            response = self.get(play_id, player)
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response.json()["error"]["type"], "NOT_FOUND")

    def test_ended_flag_is_returned_without_legacy_timestamp(self):
        self.play.ended = True
        self.play.save(update_fields=["ended"])
        self.assertTrue(self.get(self.play.pk).json()["data"]["ended"])

    def test_resume_schema_requires_session_id(self):
        schema = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json").json()
        operation = schema["paths"]["/api/v1/plays/{play_id}"]["get"]
        self.assertIn("플레이", operation["tags"])
        data = schema["components"]["schemas"]["ResumeData"]
        self.assertIn("sessionId", data["required"])
        self.assertTrue(data["properties"]["sessionId"]["description"])

    def test_resume_converts_legacy_user_and_npc_messages_without_changing_storage(self):
        self.play.state["profile"] = {"name": "민준"}
        self.play.messages = [
            {"speaker": "player", "text": "안녕"},
            {"speaker": "민수", "text": "반가워"},
        ]
        self.play.save()
        messages = self.get(self.play.pk).json()["data"]["messages"]
        self.assertEqual(
            messages,
            [
                {"role": "user", "speaker": "민준", "text": "안녕"},
                {"role": "npc", "speaker": "민수", "text": "반가워"},
            ],
        )
        self.play.refresh_from_db()
        self.assertNotIn("role", self.play.messages[0])
