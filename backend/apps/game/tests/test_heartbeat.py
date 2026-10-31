import json
import uuid
from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.game.models import Experience, Play, Player, Turn

from .test_ai_recommendation import selection


class HeartbeatTests(TestCase):
    def setUp(self):
        self.player = Player.objects.create()
        self.play = Play.objects.create(player=self.player)
        self.offer = {k: v for k, v in selection().items() if k != "found"}
        self.offer["buildUrl"] = "https://current.invalid/builds/career-suite-integration-v005/"
        Turn.objects.create(
            play=self.play,
            number=1,
            input="입력",
            response={"experience": self.offer, "messages": []},
        )

    def post(self, player=None, body=None):
        return self.client.post(
            reverse("heartbeat", args=[self.play.pk]),
            json.dumps(
                body
                if body is not None
                else {"sessionId": str(self.play.session_id), "experienceId": "test-experience"}
            ),
            content_type="application/json",
            HTTP_X_PLAYER_ID=str(player or self.player.pk),
        )

    def test_creates_only_offered_experience_and_sets_lease(self):
        before = timezone.now()
        response = self.post()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["sessionId"], str(self.play.session_id))
        self.assertEqual(response.json()["experienceId"], "test-experience")
        self.assertNotIn("data", response.json())
        experience = Experience.objects.get(external_id="test-experience")
        self.assertGreaterEqual(experience.lease_expires_at, before + timedelta(seconds=120))
        self.assertEqual(experience.metadata, self.offer)
        self.assertEqual(experience.session_id, str(self.play.session_id))
        self.assertGreaterEqual(experience.created_at, before)
        self.assertGreaterEqual(experience.updated_at, before)

    def test_expired_lease_is_not_automatically_ended(self):
        experience = Experience.objects.create(
            play=self.play,
            external_id="test-experience",
            metadata=self.offer,
            lease_expires_at=timezone.now() - timedelta(seconds=1),
        )
        self.assertEqual(self.post().status_code, 200)
        experience.refresh_from_db()
        self.assertFalse(experience.fenced)
        self.assertIsNone(experience.ended_event)

    def test_foreign_owner_or_unoffered_experience_is_rejected(self):
        self.assertEqual(self.post(Player.objects.create().pk).status_code, 404)
        self.play.turns.all().delete()
        self.assertEqual(self.post().status_code, 404)
        self.assertFalse(Experience.objects.exists())

    def test_fenced_experience_cannot_be_revived(self):
        experience = Experience.objects.create(
            play=self.play, external_id="test-experience", metadata=self.offer, fenced=True
        )
        self.assertEqual(self.post().status_code, 409)
        experience.refresh_from_db()
        self.assertIsNone(experience.lease_expires_at)

    def test_ended_play_flag_prevents_lease_update(self):
        experience = Experience.objects.create(
            play=self.play, external_id="test-experience", metadata=self.offer
        )
        self.play.ended = True
        self.play.save(update_fields=["ended"])
        self.assertEqual(self.post().status_code, 409)
        experience.refresh_from_db()
        self.assertIsNone(experience.lease_expires_at)

    def test_wrong_session_or_missing_body_does_not_write(self):
        self.assertEqual(
            self.post(
                body={"sessionId": str(uuid.uuid4()), "experienceId": "test-experience"}
            ).status_code,
            400,
        )
        self.assertEqual(self.post(body={}).status_code, 400)
        self.assertFalse(Experience.objects.exists())
