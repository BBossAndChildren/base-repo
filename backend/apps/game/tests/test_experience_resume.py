import copy
import json
import uuid
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse

from apps.game.catalog import find_experience, load_catalog
from apps.game.models import Experience, ExperienceEvent, Play, Player, Turn


class ExperienceResumeTests(TestCase):
    def setUp(self):
        self.player = Player.objects.create()
        self.play = Play.objects.create(player=self.player, state={"funds": 100})
        catalog = load_catalog()
        item = catalog["experiences"][0]
        self.offer = find_experience(item, [item], catalog, "https://old.invalid", "체험 제안")
        self.turn = Turn.objects.create(
            play=self.play,
            number=1,
            input="체험 알려줘",
            response={"experience": self.offer, "hints": ["체험해 볼게"], "messages": []},
        )

    def resume(self):
        response = self.client.get(
            reverse("resume", args=[self.play.pk]), HTTP_X_PLAYER_ID=str(self.player.pk)
        )
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()["data"]

    def observed(self, **kwargs):
        return Experience.objects.create(
            play=kwargs.pop("play", self.play),
            external_id=str(uuid.uuid4()),
            metadata=self.offer,
            session_id=kwargs.pop("session_id", str(self.play.session_id)),
            **kwargs,
        )

    def test_latest_unhandled_offer_is_revalidated_without_writes(self):
        before = copy.deepcopy((self.play.state, self.play.progress, self.turn.response))
        data = self.resume()
        self.assertEqual(data["experience"]["offerId"], str(self.turn.pk))
        self.assertEqual(data["experience"]["scenarioId"], self.offer["scenarioId"])
        self.assertEqual(
            data["experience"]["buildUrl"], f"http://testserver/builds/{self.offer['buildId']}/"
        )
        self.assertEqual(
            data["experienceState"],
            {
                "offerId": str(self.turn.pk),
                "lifecycleStatus": "offered",
                "experienceId": None,
                "outcome": None,
            },
        )
        self.assertEqual(data["hints"], ["체험해 볼게"])
        self.play.refresh_from_db()
        self.turn.refresh_from_db()
        self.assertEqual((self.play.state, self.play.progress, self.turn.response), before)
        self.assertFalse(Experience.objects.exists())

    def test_later_turn_does_not_revive_prior_offer_or_confuse_pending_choices(self):
        pending = [{"kind": "offer", "offer": {"kind": "loan", "id": "loan-1"}}]
        self.play.progress = {"pendingChoices": pending}
        self.play.save()
        latest = Turn.objects.create(
            play=self.play,
            number=2,
            input="대출 조건 질문",
            response={"experience": None, "hints": ["조건 더 설명해줘"], "messages": []},
        )
        data = self.resume()
        self.assertIsNone(data["experience"])
        self.assertIsNone(data["experienceState"])
        self.assertEqual(data["hints"], ["조건 더 설명해줘"])
        self.assertEqual(data["pendingChoices"], pending)
        self.assertEqual(data["lastTurnId"], str(latest.pk))

    def test_observed_lifecycle_never_becomes_an_unstarted_offer(self):
        for status in (
            "recommended",
            "started",
            "pending_reconciliation",
            "interrupted",
            "not_started",
            "deferred_active",
        ):
            with self.subTest(status=status):
                experience = self.observed(lifecycle_status=status)
                data = self.resume()
                self.assertIsNone(data["experience"])
                self.assertEqual(data["experienceState"]["lifecycleStatus"], status)
                self.assertEqual(data["experienceState"]["experienceId"], experience.external_id)
                self.assertEqual(data["hints"], [])
                experience.delete()
        for outcome in ("completed", "failed", "aborted"):
            with self.subTest(outcome=outcome):
                experience = self.observed(
                    lifecycle_status="ended",
                    fenced=True,
                    ended_event={"result": {"outcome": outcome}},
                )
                data = self.resume()
                self.assertIsNone(data["experience"])
                self.assertEqual(data["experienceState"]["lifecycleStatus"], "ended")
                self.assertEqual(data["experienceState"]["outcome"], outcome)
                self.assertEqual(data["hints"], [])
                experience.delete()

    def test_old_terminal_other_play_and_session_do_not_suppress_new_offer(self):
        other_play = Play.objects.create(player=self.player)
        self.observed(play=other_play)
        self.observed(session_id=str(uuid.uuid4()))
        old = self.observed(
            lifecycle_status="ended",
            fenced=True,
            ended_event={"result": {"outcome": "completed"}},
            created_at=self.turn.created_at - timedelta(days=1),
        )
        Experience.objects.filter(pk=old.pk).update(
            updated_at=self.turn.created_at - timedelta(days=1)
        )
        self.assertIsNotNone(self.resume()["experience"])
        old.fenced = False
        old.ended_event = None
        old.lifecycle_status = "started"
        old.save()
        self.assertIsNone(self.resume()["experience"])
        old.fenced = True
        old.ended_event = {"result": {"outcome": "completed"}}
        old.lifecycle_status = "ended"
        old.save()
        self.assertIsNone(self.resume()["experience"])

    def test_observed_error_clears_card_and_old_hints_without_inventing_outcome(self):
        experience = self.observed(lifecycle_status="started", fenced=True)
        ExperienceEvent.objects.create(
            experience=experience,
            session_id=str(self.play.session_id),
            event_id="error",
            type="experience.error",
            payload={"type": "experience.error"},
        )
        data = self.resume()
        self.assertIsNone(data["experience"])
        self.assertEqual(data["experienceState"]["lifecycleStatus"], "error")
        self.assertIsNone(data["experienceState"]["outcome"])
        self.assertEqual(data["hints"], [])

    def test_unavailable_catalog_or_ended_play_never_restores_offer(self):
        with patch("apps.game.experience_resume.load_catalog", return_value={"experiences": []}):
            data = self.resume()
        self.assertIsNone(data["experience"])
        self.assertEqual(data["experienceState"]["lifecycleStatus"], "unavailable")
        self.assertEqual(data["hints"], [])
        self.play.ended = True
        self.play.save()
        self.assertIsNone(self.resume()["experience"])
        self.assertEqual(self.resume()["hints"], [])

    def test_resume_schema_documents_optional_offer_and_current_hints(self):
        schema = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json").json()
        data = schema["components"]["schemas"]["ResumeData"]
        for field in ("experience", "experienceState", "hints"):
            self.assertIn(field, data["properties"])
            self.assertNotIn(field, data.get("required", []))

    def dismiss(self, offer_id=None, session_id=None, player=None):
        return self.client.post(
            f"/api/v1/plays/{self.play.pk}/experience-offers/dismiss",
            json.dumps(
                {
                    "offerId": str(offer_id or self.turn.pk),
                    "sessionId": str(session_id or self.play.session_id),
                }
            ),
            content_type="application/json",
            HTTP_X_PLAYER_ID=str(player or self.player.pk),
        )

    def test_dismiss_is_persisted_idempotently_and_cannot_start_again(self):
        before = copy.deepcopy(self.play.state)
        response = self.dismiss()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(
            response.json()["data"], {"offerId": str(self.turn.pk), "lifecycleStatus": "declined"}
        )
        self.assertEqual(self.dismiss().json(), response.json())
        self.play.refresh_from_db()
        self.assertEqual(self.play.state, before)
        self.assertEqual(self.play.state_version, 1)
        self.assertEqual(self.play.turns.count(), 1)
        data = self.resume()
        self.assertIsNone(data["experience"])
        self.assertEqual(data["experienceState"]["lifecycleStatus"], "declined")
        self.assertEqual(data["hints"], [])
        start = self.client.post(
            reverse("heartbeat", args=[self.play.pk]),
            json.dumps({"sessionId": str(self.play.session_id), "experienceId": str(uuid.uuid4())}),
            content_type="application/json",
            HTTP_X_PLAYER_ID=str(self.player.pk),
        )
        self.assertEqual(start.status_code, 404)
        self.assertFalse(Experience.objects.exists())

    def test_dismiss_rejects_foreign_stale_session_and_observed_experience(self):
        foreign = Player.objects.create()
        self.assertEqual(self.dismiss(player=foreign.pk).status_code, 404)
        self.assertEqual(self.dismiss(offer_id=uuid.uuid4()).status_code, 404)
        self.assertEqual(self.dismiss(session_id=uuid.uuid4()).status_code, 400)
        observed = self.observed(lifecycle_status="started")
        self.assertEqual(self.dismiss().status_code, 409)
        observed.delete()
        Turn.objects.create(
            play=self.play,
            number=2,
            input="다른 이야기",
            response={"experience": None, "messages": []},
        )
        self.assertEqual(self.dismiss().status_code, 404)
        self.play.refresh_from_db()
        self.assertEqual(self.play.progress, {})
        self.assertEqual(self.play.state_version, 0)

    def test_dismiss_version_prevents_inflight_turn_overwriting_decision(self):
        from .test_ai_chat import ai_response
        from .test_turns import TurnTests

        def respond(*args, **kwargs):
            dismissed = self.dismiss()
            self.assertEqual(dismissed.status_code, 200, dismissed.content)
            return ai_response()["data"]

        with patch("apps.game.turns.ai.chat", side_effect=respond):
            response = TurnTests.post(self, {"message": "다음 이야기"})
        self.assertEqual(response.status_code, 409, response.content)
        self.assertEqual(response.json()["error"]["type"], "STATE_CONFLICT")
        self.assertEqual(self.resume()["experienceState"]["lifecycleStatus"], "declined")
        self.assertEqual(self.play.turns.count(), 1)
