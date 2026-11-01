import tempfile
from pathlib import Path

from django.apps import apps
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings

from apps.game.common import GameError
from apps.game.content import content_bundle, read_markdown


class ContentTests(SimpleTestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.guidelines = self.root / "00-guidelines.md"
        self.guidelines.write_text("테스트 지침\n<!-- 비공개 주석 -->", encoding="utf-8")
        (self.root / "06-life-career-design.md").write_text("최신 확정 규칙", encoding="utf-8")
        settings = override_settings(
            GAME_CONTENT_DIR=str(self.root),
            GAME_GUIDELINES_PATH=str(self.guidelines),
            GAME_SCENARIO_PATH=str(self.root / "02-game-scenario.md"),
        )
        settings.enable()
        self.addCleanup(settings.disable)
        self.addCleanup(read_markdown.cache_clear)

    def test_includes_only_ordered_prompt_documents_and_removes_comments(self):
        for name, text in [
            ("01-world.md", "세계관"),
            ("02-game-scenario.md", "시나리오"),
            ("03-rules.md", "규칙"),
            ("05-npc.md", "NPC"),
            ("04-prompts.md", "작성 기록"),
            ("README.md", "안내"),
        ]:
            (self.root / name).write_text(text + "<!-- 주석 -->", encoding="utf-8")
        guidelines, scenario = content_bundle()
        self.assertEqual(guidelines, "테스트 지침")
        self.assertTrue(scenario.startswith("세계관\n\n시나리오\n\n규칙\n\nNPC"))
        self.assertTrue(scenario.endswith("최신 확정 규칙"))
        self.assertIn("우선 적용", scenario)

    def test_career_matching_guide_is_sent_after_latest_rules(self):
        (self.root / "07-career-matching-and-rating-v001.md").write_text(
            "직업체험 3회 · 별점 1~5<!-- 주석 -->", encoding="utf-8"
        )
        scenario = content_bundle()[1]
        self.assertTrue(
            scenario.endswith("[직업체험 매칭 · 만족도 · 최종 선택 지침]\n직업체험 3회 · 별점 1~5")
        )
        self.assertLess(scenario.index("최신 확정 규칙"), scenario.index("직업체험 3회"))

    def test_career_matching_path_can_be_overridden_and_is_optional(self):
        other = self.root / "다른-매칭.md"
        other.write_text("다른 매칭 지침", encoding="utf-8")
        with override_settings(GAME_CAREER_MATCHING_PATH=str(other)):
            self.assertIn("다른 매칭 지침", content_bundle()[1])
        read_markdown.cache_clear()
        self.assertNotIn("직업체험 매칭", content_bundle()[1])  # 파일이 없으면 넣지 않고 계속 진행

    def test_real_repository_bundle_includes_career_matching_guide(self):
        from django.conf import settings as real

        repo = Path(real.BASE_DIR).parent / "docs/game"
        with override_settings(
            GAME_CONTENT_DIR=str(repo),
            GAME_GUIDELINES_PATH=str(repo / "00-guidelines.md"),
            GAME_SCENARIO_PATH=str(repo / "02-game-scenario.md"),
        ):
            read_markdown.cache_clear()
            self.assertIn("대화 기반 직업체험 매칭·만족도·최종 선택 지침", content_bundle()[1])

    def test_missing_optional_documents_keep_latest_mandatory_rules(self):
        self.assertIn("최신 확정 규칙", content_bundle()[1])

    def test_latest_rules_missing_or_empty_stop_startup(self):
        path = self.root / "06-life-career-design.md"
        for text in [None, "<!-- TODO -->"]:
            read_markdown.cache_clear()
            if text is None:
                path.unlink()
            else:
                path.write_text(text, encoding="utf-8")
            with self.assertRaises(ImproperlyConfigured):
                apps.get_app_config("game").ready()

    def test_guidelines_missing_or_only_comments_stop_startup(self):
        for text in [None, "<!-- 아직 작성 전 -->"]:
            read_markdown.cache_clear()
            if text is None:
                self.guidelines.unlink()
            else:
                self.guidelines.write_text(text, encoding="utf-8")
            with self.assertRaises(GameError):
                content_bundle()
            with self.assertRaises(ImproperlyConfigured):
                apps.get_app_config("game").ready()

    def test_content_is_cached_until_process_restart(self):
        first = content_bundle()
        self.guidelines.write_text("수정된 지침", encoding="utf-8")
        self.assertEqual(content_bundle(), first)
