import json
import uuid

from django.test import TestCase
from django.urls import reverse

from apps.game.models import Experience, Play, Player, Turn

OFFER = {
    "buildId": "career-suite-integration-v005",
    "buildUrl": "https://current.invalid/builds/career-suite-integration-v005/",
    "roomId": "PAN-002",
    "scenarioId": "career-net-951-experience",
    "scenarioVersion": "v002",
}


class PendingTests(TestCase):
    def setUp(self):
        self.player = Player.objects.create()
        self.play = Play.objects.create(player=self.player)
        Turn.objects.create(
            play=self.play, number=1, input="시작", response={"experience": OFFER, "messages": []}
        )
        self.body = {
            "sessionId": str(self.play.session_id),
            "experienceId": "exp-1",
            "roomId": "PAN-002",
            "requestId": "end-1",
            "reason": "END_RESPONSE_TIMEOUT",
        }

    def post(self, body=None, player=None):
        return self.client.post(
            reverse("pending", args=[self.play.pk]),
            json.dumps(self.body if body is None else body),
            content_type="application/json",
            HTTP_X_PLAYER_ID=str(player or self.player.pk),
        )

    def test_records_pending_without_ending_experience(self):
        response = self.post()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "sessionId": self.body["sessionId"],
                "experienceId": "exp-1",
                "lifecycleStatus": "pending_reconciliation",
            },
        )
        experience = Experience.objects.get(external_id="exp-1")
        self.assertEqual(experience.lifecycle_status, "pending_reconciliation")
        self.assertEqual(experience.pending_request_id, "end-1")
        self.assertFalse(experience.fenced)
        self.assertIsNone(experience.ended_event)
        self.assertEqual(self.post().status_code, 200)
        self.assertEqual(Experience.objects.count(), 1)

    def test_bad_session_room_reason_and_foreign_owner_do_not_write(self):
        for change in [
            {"sessionId": str(uuid.uuid4())},
            {"roomId": "PAN-999"},
            {"reason": "UNKNOWN"},
        ]:
            self.assertEqual(self.post(self.body | change).status_code, 400)
        self.assertEqual(self.post(player=Player.objects.create().pk).status_code, 404)
        self.assertFalse(Experience.objects.exists())

    def test_fenced_experience_cannot_be_marked_pending(self):
        Experience.objects.create(play=self.play, external_id="exp-1", metadata=OFFER, fenced=True)
        self.assertEqual(self.post().status_code, 409)
        self.assertNotEqual(Experience.objects.get().lifecycle_status, "pending_reconciliation")

    def test_ended_play_flag_prevents_pending_write(self):
        Experience.objects.create(play=self.play, external_id="exp-1", metadata=OFFER)
        self.play.ended = True
        self.play.save(update_fields=["ended"])
        response = self.post()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["type"], "ALREADY_ENDED")
        self.assertEqual(Experience.objects.get().pending_request_id, "")
