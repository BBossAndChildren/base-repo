from unittest.mock import patch

from django.test import TestCase

from apps.game.models import NPC, Play, Player, Turn
from apps.game.state import initial_state

from . import test_turns as turns_fixture
from .test_ai_chat import ai_response


class StateChangeTests(TestCase):
    post = turns_fixture.TurnTests.post

    def setUp(self):
        self.player = Player.objects.create()
        self.play = Play.objects.create(
            player=self.player,
            state=initial_state({"name": "테스터", "age": 15, "situation": "중학생"}),
            progress={"scene": {"id": "room", "npcIds": ["a"], "speakerNpcId": "a"}},
        )
        NPC.objects.create(play=self.play, key="a", name="민수")
        NPC.objects.create(play=self.play, key="b", name="지수")
        self.data = ai_response()["data"]
        self.data["messages"][0]["speaker"] = "민수"

    def test_interest_has_five_levels_and_current_npc_relation_requires_evidence(self):
        self.data["stateChanges"] = [
            {"field": "interests.과학", "to": 4, "evidenceQuote": "안녕"},
            {"field": "relationship.민수", "to": 55, "evidenceQuote": "안녕"},
        ]
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            response = self.post()
        self.assertEqual(response.status_code, 200)
        state = response.json()["data"]["state"]
        self.assertEqual(state["interests"], {"과학": 4})
        self.assertEqual(state["relationship"], {"a": 55})
        self.assertIn(
            {"field": "interests.과학", "from": None, "to": 4},
            response.json()["data"]["stateChanges"],
        )

    def test_invalid_ranges_outside_npc_and_direct_numeric_changes_retry_then_rollback(self):
        for proposal in [
            {"field": "interests.과학", "to": 50, "evidenceQuote": "안녕"},
            {"field": "relationship.b", "to": 50, "evidenceQuote": "안녕"},
            {"field": "funds", "to": 10000000},
            {"field": "profile.health", "to": "실제 개인정보"},
            {"field": "interests.과학", "to": 3, "eventId": "다른 플레이 사건"},
        ]:
            self.data["stateChanges"] = [proposal]
            with patch("apps.game.turns.ai.chat", return_value=self.data) as ai:
                self.assertEqual(self.post().status_code, 502)
            self.assertEqual(ai.call_count, 2)
        self.assertFalse(Turn.objects.exists())
        self.play.refresh_from_db()
        self.assertEqual(self.play.state["funds"], 0)
        self.assertEqual(self.play.state["interests"], {})

    def test_state_changes_include_server_calculated_fields(self):
        self.data["actions"] = [
            {"kind": "advance", "days": 1, "activity": "work", "evidenceQuote": "안녕"}
        ]
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            result = self.post().json()["data"]
        self.assertIn({"field": "energy", "from": 70, "to": 67}, result["stateChanges"])
        self.assertIn({"field": "elapsedDays", "from": 0, "to": 1}, result["stateChanges"])
