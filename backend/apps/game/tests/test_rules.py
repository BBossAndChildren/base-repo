import copy
import uuid
from datetime import date
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, TestCase

from apps.game.models import Turn
from apps.game.rules import RuleViolation, add_months, evolve
from apps.game.state import initial_state

from . import test_turns as turns_fixture
from .test_ai_chat import ai_response

SOURCE = {
    "url": "https://example.org/test-job-facts",
    "checkedAt": "2026-10-31",
    "fact": "자동 테스트용 급여 근거",
}


class LifeRuleTests(SimpleTestCase):
    def setUp(self):
        self.state = initial_state(
            {"age": 15, "name": "테스트", "situation": "중학생", "hasDreamJob": False}
        )
        self.state["gameDate"] = "2026-01-01"

    def evolve(self, actions, state=None, progress=None, rng=None):
        return evolve(
            state or self.state,
            progress or {},
            actions,
            "테스트 행동 확인 공부 수락",
            str(uuid.uuid4()),
            rng=rng,
        )

    def advance(self, days, activity="idle", state=None, progress=None, rng=None):
        return self.evolve(
            [{"kind": "advance", "days": days, "activity": activity, "evidenceQuote": "테스트"}],
            state,
            progress,
            rng,
        )

    def test_work_overtime_holidays_and_bounds(self):
        for activity, energy, stress in [
            ("work", 67, 21),
            ("overtime", 62, 24),
            ("holiday", 75, 18),
            ("vacation", 85, 12),
        ]:
            state, *_ = self.advance(1, activity)
            self.assertEqual((state["energy"], state["stress"]), (energy, stress))
        state, *_ = self.advance(20, "vacation")
        self.assertEqual((state["energy"], state["stress"]), (100, 0))

    def test_salary_and_expenses_are_monthly_and_only_once(self):
        self.state["occupation"].update(
            status="employed", monthlySalary=3000000, salarySource=SOURCE
        )
        self.state["housing"].update(type="monthlyRent", monthlyRent=500000, livingCost=700000)
        state, progress, *_ = self.advance(31)
        self.assertEqual(state["funds"], 1800000)
        self.assertEqual(len(progress["settledMonths"]), 1)
        state, progress, *_ = self.advance(1, state=state, progress=progress)
        self.assertEqual(state["funds"], 1800000)
        self.assertEqual(len(progress["ledger"]), 2)

    def test_insufficient_funds_records_arrears_and_stops_time(self):
        self.state["funds"] = 100
        self.state["housing"]["livingCost"] = 300
        state, progress, events, pending, ended = self.advance(90)
        self.assertEqual(state["funds"], 0)
        self.assertEqual(state["debt"], 0)
        self.assertEqual(state["arrears"][0]["amount"], 200)
        self.assertEqual(state["elapsedDays"], 31)
        self.assertEqual(pending[0]["kind"], "insufficientFunds")
        self.assertFalse(ended)

    def test_jeonse_does_not_charge_rent_and_deposit_is_not_monthly(self):
        self.state["funds"] = 1000
        self.state["housing"].update(
            type="jeonse", deposit=100000, depositPaid=True, monthlyRent=500, livingCost=100
        )
        state, *_ = self.advance(60)
        self.assertEqual(state["funds"], 800)

    def test_stress_months_additional_factors_and_reset(self):
        self.state["stress"] = 80
        progress = {"highStressSince": "2026-01-01", "stressFactors": ["debt", "conflict"]}
        state, progress, *_ = self.advance(59, progress=progress)
        self.assertEqual(state["health"], 64)  # 첫 달 7, 두 번째 달 9
        self.assertEqual(progress["highStressMonths"], 2)
        state["stress"] = 69
        _, progress, *_ = self.advance(1, state=state, progress=progress)
        self.assertNotIn("highStressSince", progress)
        self.assertEqual(progress["highStressMonths"], 0)

    def test_zero_health_six_calendar_months_and_recovery_reset(self):
        self.state["health"] = 0
        state, progress, events, _, ended = self.advance(
            181, progress={"zeroHealthSince": "2026-01-01"}
        )
        self.assertTrue(ended)
        self.assertTrue(any(item["kind"] == "death" for item in events))
        state["health"] = 1
        _, progress, *_ = self.advance(1, state=state, progress=progress)
        self.assertNotIn("zeroHealthSince", progress)

    def test_collapse_uses_second_independent_death_roll(self):
        self.state["energy"] = 23
        for death_roll, expected in [(0.005, True), (0.5, False)]:
            rng = Mock()
            rng.random.side_effect = [0.01, death_roll]
            state, progress, events, pending, ended = self.advance(1, "work", rng=rng)
            self.assertEqual(ended, expected)
            self.assertEqual(rng.random.call_count, 2)
            self.assertTrue(progress["overwork"])
            if not expected:
                self.assertEqual(state["energy"], 30)
                self.assertEqual(pending[0]["kind"], "hospitalRecovery")

    def test_zero_energy_always_collapses_and_seven_days_clear_overwork(self):
        self.state["energy"] = 1
        rng = Mock()
        rng.random.return_value = 0.99
        state, progress, *_ = self.advance(1, "work", rng=rng)
        self.assertEqual(state["energy"], 30)
        state, progress, *_ = self.advance(6, "holiday", state, progress)
        self.assertTrue(progress["overwork"])
        _, progress, *_ = self.advance(1, "holiday", state, progress)
        self.assertFalse(progress["overwork"])

    def test_family_pressure_every_three_months_excludes_students_search_and_preparation(self):
        self.state["age"] = 25
        self.state["profile"]["age"] = 25
        self.state["occupation"]["status"] = "undecided"
        progress = {"idleSince": "2026-01-01"}
        state, progress, events, pending, _ = self.advance(150, progress=progress)
        self.assertEqual(state["gameDate"], "2026-04-01")
        self.assertTrue(1 <= state["stress"] - 20 <= 5)
        self.assertEqual(pending[0]["kind"], "familyPressure")
        _, _, events, *_ = self.advance(60, state=state, progress=progress)
        self.assertFalse(any(item["kind"] == "familyPressure" for item in events))
        for status in ("student", "searching", "preparing"):
            self.state["occupation"]["status"] = status
            _, _, events, *_ = self.advance(150, progress={"idleSince": "2026-01-01"})
            self.assertFalse(any(item["kind"] == "familyPressure" for item in events))

    def test_long_advance_requires_previous_proposal_and_confirmation(self):
        state, progress, _, pending, _ = self.advance(730)
        self.assertEqual(state["elapsedDays"], 0)
        self.assertEqual(pending[0]["kind"], "confirmAdvance")
        actions = [
            {"kind": "confirmAdvance", "evidenceQuote": "확인"},
            {"kind": "advance", "days": 730, "activity": "idle", "evidenceQuote": "확인"},
        ]
        state, *_ = self.evolve(actions, state, progress)
        self.assertEqual(state["elapsedDays"], 730)
        self.assertEqual(state["age"], 17)

    def test_loan_requires_prior_offer_then_repayment_updates_total_debt(self):
        with self.assertRaises(RuleViolation):
            self.evolve([{"kind": "loan", "amount": 100, "evidenceQuote": "수락"}])
        offer = {"kind": "loan", "id": "offer", "amount": 100, "creditor": "게임 지인"}
        state, progress, *_ = self.evolve(
            [{"kind": "loan", "offerId": "offer", "evidenceQuote": "수락"}],
            progress={"pendingOffer": offer},
        )
        self.assertEqual((state["funds"], state["debt"]), (100, 100))
        debt_id = state["debts"][0]["id"]
        state, *_ = self.evolve(
            [{"kind": "repay", "debtId": debt_id, "amount": 40, "evidenceQuote": "수락"}],
            state=state,
            progress=progress,
        )
        self.assertEqual((state["funds"], state["debt"]), (60, 60))

    def test_job_requires_prior_offer_and_student_grades_are_preserved(self):
        offer = {
            "kind": "job",
            "id": "offer",
            "job": "테스트 직업",
            "monthlySalary": 100,
            "source": SOURCE,
        }
        self.state["development"]["value"] = 75
        state, *_ = self.evolve(
            [{"kind": "acceptJob", "offerId": "offer", "evidenceQuote": "수락"}],
            progress={"pendingOffer": offer},
        )
        self.assertEqual(state["occupation"]["currentJob"], "테스트 직업")
        self.assertEqual(
            state["development"], {"kind": "selfDevelopment", "value": 75, "previousGrades": 75}
        )
        with self.assertRaises(RuleViolation):
            self.evolve([{"kind": "acceptJob", "offerId": "missing", "evidenceQuote": "수락"}])

    def test_unverified_salary_or_fabricated_input_is_rejected_without_mutation(self):
        before = copy.deepcopy(self.state)
        for action in [
            {"kind": "jobOffer", "job": "직업", "monthlySalary": 100, "evidenceQuote": "테스트"},
            {
                "kind": "advance",
                "days": 1,
                "activity": "idle",
                "evidenceQuote": "사용자가 하지 않은 말",
            },
        ]:
            with self.assertRaises((RuleViolation, ValueError)):
                self.evolve([action])
        self.assertEqual(before, self.state)

    def test_month_end_anchor_handles_leap_year(self):
        self.assertEqual(add_months(date(2028, 1, 31), 1), date(2028, 2, 29))


class RuleTurnTests(TestCase):
    setUp = turns_fixture.TurnTests.setUp
    post = turns_fixture.TurnTests.post

    def test_invalid_rule_retries_once_then_no_success_data_is_saved(self):
        data = ai_response()["data"]
        data["actions"] = [
            {"kind": "advance", "days": -1, "activity": "idle", "evidenceQuote": "안녕"}
        ]
        with patch("apps.game.turns.ai.chat", return_value=data) as chat:
            response = self.post()
        self.assertEqual(response.status_code, 502)
        self.assertEqual(chat.call_count, 2)
        self.assertFalse(Turn.objects.exists())
        self.play.refresh_from_db()
        self.assertEqual(self.play.state, {"profile": {"name": "테스터"}})
        self.assertEqual(self.play.progress, {})

    def test_second_valid_rule_is_saved_once_and_death_is_server_confirmed(self):
        state = initial_state({"age": 15, "situation": "중학생"})
        state.update(health=0, gameDate="2026-06-30")
        self.play.state = state
        self.play.progress = {"zeroHealthSince": "2026-01-01"}
        self.play.save()
        bad = ai_response()["data"] | {"actions": [{"kind": "bad", "evidenceQuote": "안녕"}]}
        good = ai_response()["data"] | {
            "actions": [{"kind": "advance", "days": 1, "activity": "idle", "evidenceQuote": "안녕"}]
        }
        with patch("apps.game.turns.ai.chat", side_effect=[bad, good]):
            response = self.post()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["data"]["ended"])
        self.assertEqual(Turn.objects.count(), 1)
        self.play.refresh_from_db()
        self.assertTrue(self.play.ended)
        self.assertEqual(self.post().status_code, 409)
