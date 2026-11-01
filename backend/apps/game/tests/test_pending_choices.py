import copy
import uuid
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase

from apps.game.models import GameEvent
from apps.game.rules import RuleViolation, evolve
from apps.game.state import initial_state

from . import test_turns as turns_fixture


class PendingChoiceTests(SimpleTestCase):
    def setUp(self):
        self.state = initial_state({"age": 30, "situation": "직장인"})
        self.state["occupation"]["currentJob"] = "기존 직업"
        self.offer = {"id": "proposal:action:0", "kind": "loan", "amount": 100, "creditor": "지인"}
        self.progress = {
            "pendingOffer": self.offer,
            "pendingChoices": [{"kind": "offer", "offer": self.offer}],
        }

    def test_decline_each_offer_preserves_state_and_unrelated_choices(self):
        for kind, message in [
            ("job", "이번 제안은 거절할게"),
            ("housing", "이사는 안 할게요"),
            ("loan", "대출 취소해주세요"),
        ]:
            with self.subTest(kind=kind):
                self.offer["kind"] = kind
                other = {"kind": "confirmAdvance", "days": 365, "activity": "idle"}
                self.progress["pendingChoices"] = [
                    {"kind": "offer", "offer": self.offer},
                    other,
                ]
                before = copy.deepcopy(self.progress)
                state, progress, events, pending, ended = evolve(
                    self.state,
                    self.progress,
                    [
                        {
                            "kind": "declineOffer",
                            "offerId": self.offer["id"],
                            "evidenceQuote": message,
                        }
                    ],
                    message,
                    "decline",
                )
                self.assertEqual(state, self.state)
                self.assertEqual(pending, [other])
                self.assertEqual(progress["pendingChoices"], [other])
                self.assertNotIn("pendingOffer", progress)
                self.assertEqual(events[0]["kind"], "declineOffer")
                self.assertEqual(
                    events[0]["facts"], {"offerId": self.offer["id"], "offerKind": kind}
                )
                self.assertFalse(ended)
                self.assertEqual(self.progress, before)

    def test_explicit_offer_kind_must_match_the_pending_offer(self):
        for kind, message in [
            ("job", "대출은 거절할게"),
            ("loan", "입사 거절할게"),
            ("housing", "취업 취소할게"),
        ]:
            with self.subTest(kind=kind), self.assertRaises(RuleViolation):
                self.offer["kind"] = kind
                evolve(
                    self.state,
                    self.progress,
                    [
                        {
                            "kind": "declineOffer",
                            "offerId": self.offer["id"],
                            "evidenceQuote": message,
                        }
                    ],
                    message,
                    "wrong-kind",
                )

    def test_questions_and_ambiguous_input_preserve_pending_offer(self):
        for message in ("거절하면 어떻게 돼?", "생각해볼게", "일단 설명해줘"):
            with self.subTest(message=message):
                state, progress, events, pending, _ = evolve(
                    self.state, self.progress, [], message, "question"
                )
                self.assertEqual(pending, self.progress["pendingChoices"])
                self.assertEqual(progress["pendingOffer"], self.offer)
                self.assertEqual(state, self.state)
                self.assertEqual(events, [])

    def test_decline_requires_matching_offer_explicit_statement_and_single_action(self):
        messages = (
            "거절하면 어떻게 돼?",
            "거절할까?",
            "거절하지 않을게",
            "이율이 높으면 거절할게",
            "생각해볼게",
        )
        action = {"kind": "declineOffer", "offerId": self.offer["id"]}
        for message in messages:
            with self.subTest(message=message), self.assertRaises(RuleViolation):
                evolve(
                    self.state, self.progress, [action | {"evidenceQuote": message}], message, "bad"
                )
        for progress, offer_id in (({}, self.offer["id"]), (self.progress, "other-offer")):
            with self.subTest(offer_id=offer_id), self.assertRaises(RuleViolation):
                evolve(
                    self.state,
                    progress,
                    [action | {"offerId": offer_id, "evidenceQuote": "거절할게"}],
                    "거절할게",
                    "bad",
                )
        with self.assertRaises(RuleViolation):
            evolve(
                self.state,
                self.progress,
                [
                    action | {"evidenceQuote": "거절할게"},
                    {"kind": "advance", "days": 1, "activity": "idle", "evidenceQuote": "거절할게"},
                ],
                "거절할게",
                "mixed",
            )

    def test_cancel_advance_clears_only_confirmation_and_preserves_state(self):
        choice = {"kind": "confirmAdvance", "days": 365, "activity": "prepare"}
        self.progress["pendingChoices"].append(choice)
        self.progress["confirmedAdvance"] = {"days": 365, "activity": "prepare"}
        message = "1년 진행은 취소할게"
        state, progress, events, pending, ended = evolve(
            self.state,
            self.progress,
            [{"kind": "cancelAdvance", "evidenceQuote": message}],
            message,
            "cancel",
        )
        self.assertEqual(state, self.state)
        self.assertEqual(pending, [{"kind": "offer", "offer": self.offer}])
        self.assertEqual(progress["pendingOffer"], self.offer)
        self.assertNotIn("confirmedAdvance", progress)
        self.assertEqual(events[0]["kind"], "cancelAdvance")
        self.assertEqual(events[0]["facts"], {"days": 365, "activity": "prepare"})
        self.assertFalse(ended)

    def test_cancel_explicit_duration_must_match_pending_advance(self):
        progress = {"pendingChoices": [{"kind": "confirmAdvance", "days": 730, "activity": "idle"}]}
        for message in ("1년 진행은 취소할게", "30일 진행 취소", "1개월 진행 취소할게"):
            with self.subTest(message=message), self.assertRaises(RuleViolation):
                evolve(
                    self.state,
                    progress,
                    [{"kind": "cancelAdvance", "evidenceQuote": message}],
                    message,
                    "wrong-days",
                )
        state, progress, _, pending, _ = evolve(
            self.state,
            progress,
            [{"kind": "cancelAdvance", "evidenceQuote": "2년 진행 취소"}],
            "2년 진행 취소",
            "right-days",
        )
        self.assertEqual(state, self.state)
        self.assertEqual(pending, [])

    def test_cancel_requires_prior_confirmation_and_explicit_statement(self):
        choice = {"kind": "confirmAdvance", "days": 365, "activity": "idle"}
        progress = {"pendingChoices": [choice]}
        for message in ("취소할까?", "취소하지 않을게", "일이 생기면 취소할게", "생각해볼게"):
            with self.subTest(message=message), self.assertRaises(RuleViolation):
                evolve(
                    self.state,
                    progress,
                    [{"kind": "cancelAdvance", "evidenceQuote": message}],
                    message,
                    "bad",
                )
        with self.assertRaises(RuleViolation):
            evolve(
                self.state, {}, [{"kind": "cancelAdvance", "evidenceQuote": "취소"}], "취소", "bad"
            )


class PendingChoiceTurnTests(TestCase):
    post = turns_fixture.TurnTests.post

    def setUp(self):
        turns_fixture.TurnTests.setUp(self)
        self.play.state = initial_state({"age": 30, "situation": "직장인"})
        self.play.state["occupation"]["currentJob"] = "기존 직업"
        self.play.save(update_fields=["state"])

    def propose_loan(self):
        self.data["actions"] = [
            {"kind": "loanOffer", "amount": 100, "creditor": "지인", "evidenceQuote": "대출"}
        ]
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            response = self.post({"message": "대출 조건 알려줘"})
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()["data"]["pendingChoices"][0]["offer"]["id"]

    def test_decline_question_resume_and_retry_preserve_money_job_and_time(self):
        before = copy.deepcopy(self.play.state)
        offer_id = self.propose_loan()
        with patch("apps.game.turns.ai.chat", return_value=self.data) as chat:
            for message in ("거절하면 어떻게 돼?", "생각해볼게"):
                self.data["actions"] = []
                question = self.post({"message": message})
                self.assertEqual(question.status_code, 200, question.content)
                self.assertEqual(
                    question.json()["data"]["pendingChoices"][0]["offer"]["id"], offer_id
                )
            self.data["actions"] = [
                {"kind": "declineOffer", "offerId": offer_id, "evidenceQuote": "대출은 거절할게"}
            ]
            body = {"requestId": str(uuid.uuid4()), "message": "대출은 거절할게"}
            response = self.post(body)
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(self.post(body).json(), response.json())
            self.assertEqual(chat.call_count, 3)
        self.play.refresh_from_db()
        self.assertEqual(self.play.state, before)
        self.assertNotIn("pendingOffer", self.play.progress)
        self.assertEqual(self.play.progress["pendingChoices"], [])
        self.assertEqual(self.play.turns.count(), 4)
        self.assertEqual(GameEvent.objects.filter(play=self.play, kind="declineOffer").count(), 1)
        resumed = self.client.get(
            f"/api/v1/plays/{self.play.pk}", HTTP_X_PLAYER_ID=str(self.player.pk)
        ).json()["data"]
        self.assertEqual(resumed["pendingChoices"], [])
        self.assertEqual(resumed["state"], before)
        self.data["actions"] = [{"kind": "loan", "offerId": offer_id, "evidenceQuote": "수락"}]
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            self.assertEqual(self.post({"message": "수락"}).status_code, 502)
        self.play.refresh_from_db()
        self.assertEqual(self.play.state, before)
        self.assertEqual(self.play.turns.count(), 4)

    def test_invalid_decline_does_not_save_and_valid_retry_saves_once(self):
        offer_id = self.propose_loan()
        self.play.refresh_from_db()
        before = copy.deepcopy(self.play.progress)
        body = {"requestId": str(uuid.uuid4()), "message": "제안 거절할게"}
        self.data["actions"] = [
            {"kind": "declineOffer", "offerId": "wrong", "evidenceQuote": body["message"]}
        ]
        with patch("apps.game.turns.ai.chat", return_value=self.data) as chat:
            self.assertEqual(self.post(body).status_code, 502)
            self.assertEqual(chat.call_count, 2)
            self.play.refresh_from_db()
            self.assertEqual(self.play.progress, before)
            self.assertEqual(self.play.turns.count(), 1)
            self.assertFalse(GameEvent.objects.filter(play=self.play, kind="declineOffer").exists())
            self.data["actions"][0]["offerId"] = offer_id
            response = self.post(body)
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(self.post(body).json(), response.json())
            self.assertEqual(chat.call_count, 3)
        self.assertEqual(self.play.turns.count(), 2)
        self.assertEqual(GameEvent.objects.filter(play=self.play, kind="declineOffer").count(), 1)

    def propose_advance(self):
        self.data["actions"] = [
            {"kind": "advance", "days": 730, "activity": "idle", "evidenceQuote": "2년"}
        ]
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            response = self.post({"message": "2년 진행할게"})
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()["data"]["pendingChoices"]

    def test_cancel_advance_question_retry_resume_and_failed_save(self):
        state_before = copy.deepcopy(self.play.state)
        pending = self.propose_advance()
        self.play.refresh_from_db()
        progress_before = copy.deepcopy(self.play.progress)
        self.data["actions"] = [{"kind": "cancelAdvance", "evidenceQuote": "취소하면 어떻게 돼?"}]
        question = {"requestId": str(uuid.uuid4()), "message": "취소하면 어떻게 돼?"}
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            self.assertEqual(self.post(question).status_code, 502)
            self.play.refresh_from_db()
            self.assertEqual(self.play.progress, progress_before)
            self.data["actions"] = []
            answered = self.post(question)
            self.assertEqual(answered.status_code, 200, answered.content)
            self.assertEqual(answered.json()["data"]["pendingChoices"], pending)
            self.assertEqual(self.post(question).json(), answered.json())
        self.play.refresh_from_db()
        progress_before = copy.deepcopy(self.play.progress)
        self.data["actions"] = [{"kind": "cancelAdvance", "evidenceQuote": "진행 취소할게"}]
        body = {"requestId": str(uuid.uuid4()), "message": "진행 취소할게"}
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            with patch("apps.game.turns.Turn.objects.create", side_effect=RuntimeError("storage")):
                with self.assertRaisesMessage(RuntimeError, "storage"):
                    self.post(body)
            self.play.refresh_from_db()
            self.assertEqual(self.play.progress, progress_before)
            self.assertEqual(self.play.state, state_before)
            self.assertEqual(self.play.turns.count(), 2)
            self.assertFalse(
                GameEvent.objects.filter(play=self.play, kind="cancelAdvance").exists()
            )
            response = self.post(body)
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(self.post(body).json(), response.json())
        self.play.refresh_from_db()
        self.assertEqual(self.play.state, state_before)
        self.assertEqual(self.play.progress["pendingChoices"], [])
        self.assertNotIn("confirmedAdvance", self.play.progress)
        self.assertEqual(self.play.turns.count(), 3)
        self.assertEqual(GameEvent.objects.filter(play=self.play, kind="cancelAdvance").count(), 1)
        resumed = self.client.get(
            f"/api/v1/plays/{self.play.pk}", HTTP_X_PLAYER_ID=str(self.player.pk)
        ).json()["data"]
        self.assertEqual(resumed["pendingChoices"], [])
        self.assertEqual(resumed["state"], state_before)
