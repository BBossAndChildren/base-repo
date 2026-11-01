"""#163 화면 카드에서 받는 3D 체험 추천 (채팅 분기 없이)"""

import json
import uuid

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.game.catalog import load_catalog
from apps.game.models import ExperienceEvent, ExperienceOffer, Play, Player, Turn
from apps.game.state import initial_state

from .test_events import actual_events


class ExperienceOfferTests(TestCase):
    def setUp(self):
        self.player = Player.objects.create()
        self.play = Play.objects.create(
            player=self.player,
            state=initial_state(
                {"name": "테스트", "age": 17, "situation": "고등학생", "dreamJob": "행사기획자"}
            ),
        )

    def post(self, body=None, player=None, play=None):
        return self.client.post(
            reverse("experience-offers", args=[(play or self.play).pk]),
            json.dumps(body or {}),
            content_type="application/json",
            HTTP_X_PLAYER_ID=str(player or self.player.pk),
        )

    def test_dream_job_first_and_offer_is_recorded(self):
        response = self.post()
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()["data"]
        self.assertEqual((data["basis"], data["job"]), ("dreamJob", "행사기획자"))
        self.assertIn("행사기획자", data["jobs"])
        self.assertTrue(data["buildUrl"].endswith(f"/builds/{data['buildId']}/"))
        self.assertTrue(data["title"] and data["roomName"] and data["description"])
        saved = ExperienceOffer.objects.get(play=self.play)
        self.assertEqual(saved.payload["scenarioId"], data["scenarioId"])
        self.assertNotIn("basis", saved.payload)

    def test_current_job_beats_dream_job(self):
        self.play.state["occupation"].update(status="employed", currentJob="사서")
        self.play.save()
        data = self.post().json()["data"]
        self.assertEqual((data["basis"], data["job"]), ("currentJob", "사서"))
        self.assertIn("사서", data["jobs"])

    def test_shuffle_with_exclude_is_random_and_skips_excluded_and_done(self):
        catalog = load_catalog()["experiences"]
        done = catalog[0]["scenarioId"]
        self.play.state["experiences"] = [{"scenarioId": done, "result": {"outcome": "completed"}}]
        self.play.save()
        first = self.post().json()["data"]["scenarioId"]
        for _ in range(10):
            data = self.post({"exclude": [first]}).json()["data"]
            self.assertEqual(data["basis"], "random")
            self.assertNotIn(data["scenarioId"], {first, done})

    def test_without_jobs_it_is_random(self):
        self.play.state["profile"].pop("dreamJob")
        self.play.save()
        self.assertEqual(self.post().json()["data"]["basis"], "random")

    def test_ended_paused_and_other_player(self):
        self.play.paused = True
        self.play.save()
        self.assertEqual(self.post().json()["error"]["type"], "PLAY_PAUSED")
        self.play.paused = False
        self.play.ended = True
        self.play.ended_at = timezone.now()
        self.play.save()
        self.assertEqual(self.post().status_code, 409)
        self.assertEqual(self.post(player=Player.objects.create().pk).status_code, 404)
        self.assertFalse(ExperienceOffer.objects.exists())

    def test_invalid_exclude_is_rejected(self):
        self.assertEqual(self.post({"exclude": "x"}).status_code, 400)


class CardOfferEventTests(TestCase):
    """카드 추천으로 시작한 체험의 Unity 이벤트도 저장 · 결과 반영된다"""

    def setUp(self):
        self.player = Player.objects.create()
        self.events = actual_events()
        first = self.events[0]
        self.play = Play.objects.create(
            player=self.player, session_id=uuid.UUID(first["sessionId"])
        )
        self.offer = {
            key: first[key] for key in ("buildId", "roomId", "scenarioId", "scenarioVersion")
        }
        self.offer["buildUrl"] = "https://build.invalid/builds/career-pilot-v007/"

    def post(self, event):
        return self.client.post(
            reverse("events", args=[self.play.pk]),
            json.dumps(event),
            content_type="application/json",
            HTTP_X_PLAYER_ID=str(self.player.pk),
        )

    def test_card_offer_accepts_events_without_chat_branch(self):
        self.assertEqual(self.post(self.events[0]).status_code, 404)  # 추천 없음
        ExperienceOffer.objects.create(play=self.play, payload=self.offer)
        for event in self.events:
            self.assertEqual(self.post(event).status_code, 200)
        self.play.refresh_from_db()
        self.assertEqual(len(self.play.state["experiences"]), 1)
        self.assertEqual(ExperienceEvent.objects.count(), len(self.events))

    def test_older_chat_offer_still_matches_after_newer_card_offer(self):
        Turn.objects.create(
            play=self.play, number=1, input="x", response={"experience": self.offer}
        )
        other = {**self.offer, "roomId": "PAN-999", "scenarioId": "다른-체험"}
        ExperienceOffer.objects.create(play=self.play, payload=other)
        self.assertEqual(self.post(self.events[0]).status_code, 200)

    def test_event_matching_no_offer_is_rejected(self):
        ExperienceOffer.objects.create(
            play=self.play, payload={**self.offer, "scenarioId": "다른-체험"}
        )
        self.assertEqual(self.post(self.events[0]).status_code, 400)
