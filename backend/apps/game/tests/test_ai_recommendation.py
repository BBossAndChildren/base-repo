import time
from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from apps.game.ai import recommend
from apps.game.catalog import load_catalog, select_candidates
from apps.game.common import GameError


def test_catalog():
    return {
        "experiences": [
            {
                "buildId": "career-suite-integration-v005",
                "roomId": "PAN-002",
                "scenarioId": "career-net-951-experience",
                "scenarioVersion": "v002",
                "jobs": ["행사기획자"],
                "description": "행사 기획과 일정 만들기",
                "title": "주민 문화행사 준비",
            },
            {
                "buildId": "career-suite-integration-v005",
                "roomId": "PAN-003",
                "scenarioId": "career-net-900-experience",
                "scenarioVersion": "v002",
                "jobs": ["사서"],
                "description": "도서관 책 정리",
                "title": "도서관 자료 정리",
            },
        ]
    }


def selection():
    return {
        "found": True,
        **{
            key: test_catalog()["experiences"][0][key]
            for key in ("buildId", "roomId", "scenarioId", "scenarioVersion")
        },
    }


BRANCH = {"topic": "행사 준비", "jobs": ["행사기획자"], "reason": "친구 제안"}


class RecommendationTests(SimpleTestCase):
    @override_settings(GAME_BUILD_CATALOG_PATH="")
    def test_production_catalog_matches_supported_manifest(self):
        catalog = load_catalog()
        self.assertEqual(len(catalog["experiences"]), 555)
        self.assertEqual(len(select_candidates(catalog, {"profile": {}}, BRANCH, [])), 20)

    def run_with(self, value):
        with (
            patch("apps.game.ai.load_catalog", return_value=test_catalog()),
            patch("apps.game.ai.call_ai", return_value=value) as request,
        ):
            result = recommend(
                {"profile": {}}, BRANCH, "상황", [], "https://current.invalid", time.monotonic() + 1
            )
        self.assertEqual(request.call_args.args[0], "/ai/v1/experience-recommendation")
        self.assertEqual(request.call_args.args[1]["branch"], BRANCH)
        self.assertEqual(len(request.call_args.args[1]["candidates"]), 2)
        return result

    def test_only_known_selection_and_current_origin_are_returned(self):
        result = self.run_with(selection())
        self.assertEqual(
            result["buildUrl"], "https://current.invalid/builds/career-suite-integration-v005/"
        )
        self.assertEqual(result["title"], "주민 문화행사 준비")
        self.assertEqual(result["jobs"], ["행사기획자"])
        self.assertEqual(result["reason"], BRANCH["reason"])

    def test_unknown_or_wrong_case_or_version_is_skipped(self):
        for value in [{"buildId": "unknown"}, {"roomId": "pan-002"}, {"scenarioVersion": "v999"}]:
            self.assertIsNone(self.run_with(selection() | value))

    def test_not_found_skips_experience(self):
        self.assertIsNone(self.run_with({"found": False}))

    def test_failure_skips_experience(self):
        with (
            patch("apps.game.ai.load_catalog", return_value=test_catalog()),
            patch("apps.game.ai.call_ai", side_effect=GameError(502, "AI_UNAVAILABLE", "실패")),
        ):
            self.assertIsNone(
                recommend({}, BRANCH, "상황", [], "https://current.invalid", time.monotonic() + 1)
            )

    def test_no_catalog_does_not_call_ai(self):
        with (
            patch("apps.game.ai.load_catalog", return_value={"experiences": []}),
            patch("apps.game.ai.call_ai") as request,
        ):
            self.assertIsNone(
                recommend({}, BRANCH, "상황", [], "https://current.invalid", time.monotonic() + 1)
            )
        request.assert_not_called()

    def test_scoring_prefers_branch_job_and_excludes_previous_experience(self):
        candidates = select_candidates(
            test_catalog(), {"profile": {"dreamJob": "행사기획자"}}, BRANCH, []
        )
        self.assertEqual(candidates[0]["scenarioId"], "career-net-951-experience")
        candidates = select_candidates(
            test_catalog(),
            {"profile": {}, "experiences": [{"scenarioId": "career-net-951-experience"}]},
            BRANCH,
            [],
        )
        self.assertEqual([item["scenarioId"] for item in candidates], ["career-net-900-experience"])
