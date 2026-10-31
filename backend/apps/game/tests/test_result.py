from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.game.common import GameError
from apps.game.ending import ending_candidates
from apps.game.models import Play, Player, Turn


def valid_result():
    return {
        "ending": "이번 인생에서 행사를 준비했다",
        "recommendedJobs": [
            {
                "job": "행사기획자",
                "isNew": False,
                "basis": ["experience", "conversation", "dreamJob"],
                "reason": "체험",
                "work": "행사 준비",
                "nextSteps": ["기획 연습", "행사 관찰"],
            },
            {
                "job": "사서",
                "isNew": True,
                "basis": ["interest"],
                "reason": "새 일",
                "work": "책 정리",
                "nextSteps": ["도서관 방문", "자료 탐색"],
            },
            {
                "job": "교사",
                "isNew": True,
                "basis": [],
                "reason": "새 일",
                "work": "수업",
                "nextSteps": ["교육 탐색", "봉사"],
            },
        ],
    }


class ResultTests(TestCase):
    def setUp(self):
        self.player = Player.objects.create()
        self.play = Play.objects.create(
            player=self.player,
            ended_at=timezone.now(),
            state={
                "profile": {"dreamJob": "행사기획자"},
                "interests": ["사서"],
                "experiences": [
                    {
                        "experienceId": "exp",
                        "scenarioId": "career-net-951-experience",
                        "result": {"outcome": "completed"},
                    }
                ],
            },
        )

    def get(self, player=None):
        return self.client.get(
            reverse("result", args=[self.play.pk]), HTTP_X_PLAYER_ID=str(player or self.player.pk)
        )

    def test_returns_saved_result_without_regeneration(self):
        self.play.result = valid_result()
        self.play.save()
        with patch("apps.game.ending.generate_ending") as ai:
            response = self.get()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"], valid_result())
        ai.assert_not_called()
        self.play.refresh_from_db()
        self.assertEqual(self.play.ending, valid_result())

    def test_returns_authoritative_ending_without_ai_or_legacy_result(self):
        self.play.ending = valid_result()
        self.play.result = valid_result() | {"ending": "오래된 결과"}
        self.play.save()
        with patch("apps.game.ending.generate_ending") as ai:
            self.assertEqual(self.get().json()["data"], valid_result())
        ai.assert_not_called()

    def test_ended_flag_allows_result_even_without_legacy_timestamp(self):
        self.play.ended = True
        self.play.ended_at = None
        self.play.ending = valid_result()
        self.play.save()
        self.assertEqual(self.get().json()["data"], valid_result())

    def test_top_five_candidates_always_include_dream_job(self):
        catalog = {
            "experiences": [{"scenarioId": str(i), "jobs": ["직업" + str(i)]} for i in range(7)]
        }
        self.play.state = {
            "profile": {"dreamJob": "희망 직업"},
            "experiences": [
                {"scenarioId": str(i), "result": {"outcome": "completed"}} for i in range(7)
            ],
        }
        with patch("apps.game.ending.load_catalog", return_value=catalog):
            candidates, experienced = ending_candidates(self.play)
        self.assertEqual(len(candidates), 5)
        self.assertIn("희망 직업", [item["job"] for item in candidates])
        self.assertEqual(len(experienced), 7)
        self.assertEqual([item["score"] for item in candidates], [5, 5, 5, 5, 2])

    def test_first_request_generates_and_persists_result_once(self):
        Turn.objects.create(
            play=self.play, number=1, input="행사기획자가 궁금해", response={"messages": []}
        )
        with (
            patch("apps.game.ending.generate_ending", return_value=valid_result()) as ai,
        ):
            self.assertEqual(self.get().json()["data"], valid_result())
            self.assertEqual(self.get().json()["data"], valid_result())
        self.assertEqual(ai.call_count, 1)
        self.assertEqual(ai.call_args.args[1][0]["job"], "행사기획자")
        self.play.refresh_from_db()
        self.assertEqual(self.play.result, valid_result())
        self.assertEqual(self.play.ending, valid_result())

    def test_ai_failure_does_not_store_result(self):
        with (
            patch(
                "apps.game.ending.generate_ending",
                side_effect=GameError(502, "AI_UNAVAILABLE", "실패"),
            ),
        ):
            self.assertEqual(self.get().status_code, 502)
        self.play.refresh_from_db()
        self.assertIsNone(self.play.result)

    def test_ongoing_play_has_no_final_result(self):
        self.play.ended_at = None
        self.play.save()
        self.assertEqual(self.get().status_code, 409)
        self.assertEqual(self.get().json()["error"]["type"], "NOT_ENDED")

    def test_other_owner_cannot_read_result(self):
        self.assertEqual(self.get(Player.objects.create().pk).status_code, 404)
