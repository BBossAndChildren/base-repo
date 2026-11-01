import copy
import uuid
from datetime import date
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, TestCase

from apps.game.models import Turn
from apps.game.rules import RuleViolation, add_months, evolve, health_ceiling
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
        # 규칙 계산만 검증하도록 상황별 밸런스 기준값(#132)을 비운다
        self.state["funds"] = 0
        self.state["support"]["monthlyAmount"] = 0

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

    def test_preparation_keeps_existing_work_or_studies(self):
        for situation in ("직장인", "중학생", "기타"):
            for activity in ("prepare", "jobSearch"):
                with self.subTest(situation=situation, activity=activity):
                    state = initial_state({"age": 30, "situation": situation})
                    state["gameDate"] = "2026-01-01"
                    if situation == "직장인":
                        state["occupation"]["currentJob"] = "기존 직업"
                    before = copy.deepcopy(state)
                    state, progress, *_ = self.advance(31, activity, state=state)
                    if situation in {"직장인", "중학생"}:
                        self.assertEqual(state["occupation"], before["occupation"])
                    else:
                        self.assertEqual(
                            state["occupation"]["status"],
                            "preparing" if activity == "prepare" else "searching",
                        )
                    salary = sum(
                        row["amount"] for row in progress["ledger"] if row["kind"] == "salary"
                    )
                    self.assertEqual(salary, before["occupation"]["monthlySalary"] or 0)

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
        # 스트레스가 높으면 자연 회복이 없어 건강 0 이 이어진다
        self.state.update(health=0, stress=60)
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

    def test_long_advance_survives_question_then_clears_on_confirmation(self):
        state, progress, _, proposed, _ = self.advance(730)
        state, progress, _, pending, _ = evolve(
            state, progress, [], "왜 2년인가요?", "follow-up-question"
        )
        self.assertEqual(pending, proposed)
        self.assertEqual(state["elapsedDays"], 0)
        actions = [
            {"kind": "confirmAdvance", "evidenceQuote": "확인"},
            {"kind": "advance", "days": 730, "activity": "idle", "evidenceQuote": "확인"},
        ]
        state, progress, _, pending, _ = self.evolve(actions, state, progress)
        self.assertEqual(state["elapsedDays"], 730)
        self.assertEqual(pending, [])
        self.assertEqual(progress["pendingChoices"], [])

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

    def test_family_support_is_paid_monthly_before_expenses(self):
        self.state["support"]["monthlyAmount"] = 50000
        self.state["housing"]["livingCost"] = 30000
        state, progress, *_ = self.advance(31)
        self.assertEqual(state["funds"], 20000)
        kinds = [row["kind"] for row in progress["ledger"]]
        self.assertEqual(kinds, ["familySupport", "monthlyExpenses"])
        state, progress, *_ = self.advance(1, state=state, progress=progress)
        self.assertEqual(state["funds"], 20000)  # 같은 달 중복 지급 없음

    def test_support_change_is_announced_and_applies_from_next_month(self):
        self.state["support"]["monthlyAmount"] = 50000
        action = {"kind": "supportChange", "monthlyAmount": 0, "evidenceQuote": "테스트"}
        state, progress, events, *_ = self.evolve([action])
        self.assertEqual(events[0]["kind"], "supportNotice")
        self.assertEqual(progress["supportChange"]["effectiveFrom"], "2026-02-01")
        self.assertEqual(state["support"]["monthlyAmount"], 50000)
        state, progress, events, *_ = self.advance(31, state=state, progress=progress)
        self.assertEqual(state["support"]["monthlyAmount"], 0)
        self.assertEqual(state["funds"], 0)
        self.assertIn("supportChanged", [row["kind"] for row in events])
        self.assertNotIn("supportChange", progress)

    def test_aging_reduces_health_on_birthdays_from_65(self):
        self.state["age"] = 64
        year = {"confirmedAdvance": {"days": 366, "activity": "idle"}}
        state, _, events, *_ = self.advance(366, progress=dict(year))
        self.assertEqual(state["age"], 65)
        self.assertEqual(state["health"], 77)
        self.assertEqual(
            [row for row in events if row["kind"] == "aging"][0]["facts"],
            {"age": 65, "healthLoss": 3},
        )
        self.state["age"] = 30
        state, *_ = self.advance(366, progress=dict(year))
        self.assertEqual(state["health"], 80)

    def test_old_age_eventually_ends_life(self):
        self.state["age"] = 95
        self.state["health"] = 20
        progress = {"confirmedAdvance": {"days": 900, "activity": "idle"}}
        state, _, events, _, ended = self.advance(900, progress=progress)
        self.assertTrue(ended)
        self.assertEqual(events[-2]["facts"], {"cause": "zeroHealthSixMonths"})

    def test_health_recovers_two_every_thirty_calm_days_up_to_ceiling(self):
        self.state["health"] = 70
        state, progress, events, *_ = self.advance(30)
        self.assertEqual(state["health"], 72)
        self.assertIn("healthRecovered", [row["kind"] for row in events])
        state, *_ = self.advance(29, state=state, progress=progress)
        self.assertEqual(state["health"], 72)  # 아직 30일이 안 됨

    def test_holiday_and_vacation_recover_faster(self):
        self.state["health"] = 70
        state, *_ = self.advance(15, "holiday")
        self.assertEqual(state["health"], 72)
        state, *_ = self.advance(10, "vacation")
        self.assertEqual(state["health"], 72)

    def test_no_recovery_under_stress_or_overwork_or_at_ceiling(self):
        self.state.update(health=70, stress=60)
        state, *_ = self.advance(60)
        self.assertEqual(state["health"], 70)
        self.state.update(health=80, stress=20)
        state, *_ = self.advance(60)
        self.assertEqual(state["health"], 80)

    def test_calm_rest_recovers_from_zero_health_and_avoids_death(self):
        self.state["health"] = 0
        state, progress, events, _, ended = self.advance(
            181, progress={"zeroHealthSince": "2026-01-01"}
        )
        self.assertFalse(ended)
        self.assertGreater(state["health"], 0)
        self.assertNotIn("zeroHealthSince", progress)

    def test_ceiling_follows_age_even_when_life_started_old(self):
        self.assertEqual((health_ceiling(64), health_ceiling(65), health_ceiling(83)), (80, 77, 0))
        self.state.update(age=84, health=0)
        progress = {"confirmedAdvance": {"days": 200, "activity": "vacation"}}
        _, _, events, _, ended = self.advance(200, "vacation", progress=progress)
        self.assertTrue(ended)  # 상한 0 이라 회복되지 않고 6개월 뒤 사망


class RuleTurnTests(TestCase):
    setUp = turns_fixture.TurnTests.setUp
    post = turns_fixture.TurnTests.post

    def test_preparation_turn_keeps_job_and_persists_monthly_salary(self):
        state = initial_state({"age": 30, "situation": "직장인"})
        state["gameDate"] = "2026-01-01"
        state["occupation"]["currentJob"] = "기존 직업"
        self.play.state = state
        self.play.save(update_fields=["state"])
        self.data["actions"] = [
            {"kind": "advance", "days": 31, "activity": "prepare", "evidenceQuote": "준비"}
        ]
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            response = self.post({"message": "이직 준비를 할게"})
        self.assertEqual(response.status_code, 200, response.content)
        self.play.refresh_from_db()
        self.assertEqual(self.play.state["occupation"], state["occupation"])
        self.assertEqual(self.play.state["funds"], 5_756_880)
        self.assertEqual(response.json()["data"]["state"], self.play.state)

    def test_offer_survives_question_retry_and_resume_then_accepts_once(self):
        self.play.state = initial_state({"age": 15, "situation": "중학생"})
        self.play.save(update_fields=["state"])
        self.data["actions"] = [
            {"kind": "loanOffer", "amount": 100, "creditor": "지인", "evidenceQuote": "대출"}
        ]
        with patch("apps.game.turns.ai.chat", return_value=self.data) as chat:
            proposal = self.post({"message": "대출 조건 알려줘"}).json()["data"]
            pending = proposal["pendingChoices"]
            self.data["actions"] = []
            question = {"requestId": str(uuid.uuid4()), "message": "조건을 더 설명해줘"}
            first = self.post(question)
            self.assertEqual(first.status_code, 200, first.content)
            self.assertEqual(self.post(question).json(), first.json())
            self.assertEqual(chat.call_count, 2)
            self.assertEqual(first.json()["data"]["pendingChoices"], pending)
            resumed = self.client.get(
                f"/api/v1/plays/{self.play.pk}", HTTP_X_PLAYER_ID=str(self.player.pk)
            ).json()["data"]
            self.assertEqual(resumed["pendingChoices"], pending)
            self.data["actions"] = [
                {"kind": "loan", "offerId": pending[0]["offer"]["id"], "evidenceQuote": "수락"}
            ]
            accept = {"requestId": str(uuid.uuid4()), "message": "수락할게"}
            accepted = self.post(accept)
            self.assertEqual(accepted.status_code, 200, accepted.content)
            self.assertEqual(chat.call_args.args[0]["pendingChoices"], pending)
            self.assertEqual(self.post(accept).json(), accepted.json())
        self.play.refresh_from_db()
        self.assertEqual(self.play.state["debt"], 100)
        self.assertEqual(self.play.state["funds"], 100_100)
        self.assertEqual(len(self.play.state["debts"]), 1)
        self.assertEqual(self.play.progress["pendingChoices"], [])
        self.assertNotIn("pendingOffer", self.play.progress)
        self.assertEqual(self.play.turns.count(), 3)

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


class BaselineTests(SimpleTestCase):
    """상황별 시작 자금 · 주거 · 생활비 · 가족 지원 · 월급 (#132)"""

    def test_every_situation_has_consistent_money(self):
        for situation in ["초등학생", "중학생", "고등학생", "대학생", "직장인", "구직 중", "기타"]:
            for age in (15, 30):
                state = initial_state({"age": age, "situation": situation})
                self.assertGreater(state["funds"], 0, situation)
                self.assertGreaterEqual(state["housing"]["livingCost"], 0)
                self.assertIn(state["housing"]["type"], {"family", "monthlyRent"})
                self.assertEqual(state["support"]["source"], "family")

    def test_worker_starts_with_sourced_minimum_wage_and_paid_deposit(self):
        state = initial_state({"age": 30, "situation": "직장인"})
        self.assertEqual(state["occupation"]["monthlySalary"], 2156880)
        self.assertIn("minimumwage.go.kr", state["occupation"]["salarySource"]["url"])
        self.assertTrue(state["housing"]["depositPaid"])
        state["gameDate"] = "2026-01-01"
        state, progress, *_ = evolve(
            state,
            {},
            [{"kind": "advance", "days": 31, "activity": "idle", "evidenceQuote": "출근"}],
            "출근",
            "worker",
        )
        # 월급 - (월세 + 생활비), 보증금은 다시 빼지 않는다
        self.assertEqual(state["funds"], 5000000 + 2156880 - 500000 - 900000)
        self.assertNotIn("housingDeposit", [row["kind"] for row in progress["ledger"]])

    def test_other_situation_depends_on_age(self):
        adult = initial_state({"age": 40, "situation": "기타"})
        minor = initial_state({"age": 12, "situation": "기타"})
        self.assertGreater(adult["housing"]["livingCost"], 0)
        self.assertEqual(minor["housing"]["livingCost"], 0)

    def test_job_seeker_runs_short_and_gets_choices_not_negative_funds(self):
        state = initial_state({"age": 25, "situation": "구직 중"})
        state["gameDate"] = "2026-01-01"
        progress = {"confirmedAdvance": {"days": 400, "activity": "jobSearch"}}
        state, progress, _, pending, _ = evolve(
            state,
            progress,
            [{"kind": "advance", "days": 400, "activity": "jobSearch", "evidenceQuote": "구직"}],
            "구직",
            "seeker",
        )
        self.assertEqual(pending[0]["kind"], "insufficientFunds")
        self.assertGreaterEqual(state["funds"], 0)
        self.assertTrue(state["arrears"])
