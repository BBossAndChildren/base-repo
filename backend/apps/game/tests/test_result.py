from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.game.common import GameError
from apps.game.ending import ending_candidates
from apps.game.models import GameEvent, Play, Player, Turn
from apps.game.serializers import ResultDataSerializer


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

    def ai_down(self):
        return patch(
            "apps.game.ending.generate_ending",
            side_effect=GameError(502, "AI_UNAVAILABLE", "실패"),
        )

    def died_play(self):
        self.play.state = {
            "age": 42,
            "elapsedDays": 27 * 365 + 40,
            "profile": {"name": "민준", "age": 15, "situation": "중학생", "dreamJob": "행사기획자"},
            "occupation": {"status": "employed", "currentJob": "행사기획자"},
            "interests": {"예술·디자인": None},
            "experiences": [
                {
                    "experienceId": "exp",
                    "scenarioId": "career-net-951-experience",
                    "result": {"outcome": "completed"},
                }
            ],
        }
        self.play.save()
        GameEvent.objects.create(
            play=self.play,
            key="t:death",
            kind="death",
            game_date="2053-01-01",
            participants=[],
            facts={"cause": "zeroHealthSixMonths"},
            source_action="t",
        )

    def test_ai_unavailable_uses_backend_life_story(self):
        """결정 28: AI 결말 API 가 없으면 저장된 기록으로 살아온 인생을 읊고 추천 3개를 만든다."""
        self.died_play()
        with self.ai_down():
            response = self.get()
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["generatedBy"], "backend")
        story = data["ending"]
        for part in (
            "민준",
            "15살 중학생",
            "행사기획자(으)로 일했어요",
            "27년",
            "건강을 되찾지 못한 채 42살에 생을 마쳤어요",
        ):
            self.assertIn(part, story)
        self.assertIn("「", story)  # 해 본 3D 체험 제목
        self.assertTrue(ResultDataSerializer(data=data).is_valid())
        jobs = data["recommendedJobs"]
        self.assertEqual(len({job["job"] for job in jobs}), 3)
        self.assertTrue(any(job["isNew"] for job in jobs))
        self.assertTrue(all(2 <= len(job["nextSteps"]) <= 3 for job in jobs))
        self.play.refresh_from_db()
        self.assertEqual(self.play.ending["generatedBy"], "backend")

    def test_backend_ending_is_replaced_when_ai_becomes_available(self):
        self.died_play()
        with self.ai_down():
            first = self.get().json()["data"]
        self.assertEqual(first["generatedBy"], "backend")
        with patch("apps.game.ending.generate_ending", return_value=valid_result()):
            second = self.get().json()["data"]
        # AI 결말로 교체된다 (근거 basis 는 백엔드가 기록으로 다시 채운다)
        self.assertEqual(second["ending"], valid_result()["ending"])
        self.assertNotIn("generatedBy", second)
        self.assertEqual(
            [job["job"] for job in second["recommendedJobs"]], ["행사기획자", "사서", "교사"]
        )
        self.play.refresh_from_db()
        self.assertNotIn("generatedBy", self.play.ending)

    def test_backend_ending_is_kept_while_ai_still_fails(self):
        self.died_play()
        with self.ai_down():
            first = self.get().json()["data"]
            second = self.get().json()["data"]
        self.assertEqual(first, second)

    def test_short_play_without_records_still_gets_three_jobs(self):
        self.play.state = {"age": 15, "profile": {"name": "지우", "age": 15, "situation": "중학생"}}
        self.play.save()
        with self.ai_down():
            data = self.get().json()["data"]
        self.assertTrue(ResultDataSerializer(data=data).is_valid())
        self.assertIn("15살에 이번 인생을 마쳤어요", data["ending"])
        self.assertTrue(any(job["isNew"] for job in data["recommendedJobs"]))

    def test_non_ai_errors_are_not_hidden(self):
        with patch(
            "apps.game.ending.generate_ending", side_effect=GameError(400, "INVALID_INPUT", "x")
        ):
            self.assertEqual(self.get().status_code, 400)

    def test_ongoing_play_has_no_final_result(self):
        self.play.ended_at = None
        self.play.save()
        self.assertEqual(self.get().status_code, 409)
        self.assertEqual(self.get().json()["error"]["type"], "NOT_ENDED")

    def test_other_owner_cannot_read_result(self):
        self.assertEqual(self.get(Player.objects.create().pk).status_code, 404)
