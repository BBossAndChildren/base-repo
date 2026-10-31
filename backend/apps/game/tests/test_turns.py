import json
import uuid
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.game.common import GameError
from apps.game.models import Message, Play, Player, Turn

from .test_ai_chat import ai_response


class TurnTests(TestCase):
    def setUp(self):
        self.player = Player.objects.create()
        self.play = Play.objects.create(player=self.player, state={"profile": {"name": "테스터"}})
        self.data = ai_response()["data"]

    def post(self, body=None, play=None, player=None):
        return self.client.post(
            reverse("turns", args=[play or self.play.pk]),
            json.dumps(
                {
                    "requestId": str(uuid.uuid4()),
                    **(body if body is not None else {"message": "안녕"}),
                }
            ),
            content_type="application/json",
            HTTP_X_PLAYER_ID=str(player or self.player.pk),
        )

    def test_turn_is_saved_and_next_call_includes_history(self):
        with patch("apps.game.turns.ai.chat", return_value=self.data) as chat:
            response = self.post()
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["data"]["messages"][0]["role"], "npc")
            self.assertEqual(self.post().status_code, 200)
        self.assertEqual(len(chat.call_args.args[1]), 1)
        self.assertEqual(Turn.objects.count(), 2)
        self.assertEqual(Message.objects.filter(play=self.play).count(), 4)
        self.play.refresh_from_db()
        self.assertIsNone(self.play.turn_token)
        self.assertEqual(
            self.play.messages[0], {"role": "user", "speaker": "테스터", "text": "안녕"}
        )

    def test_bad_input_and_foreign_owner_do_not_call_ai(self):
        with patch("apps.game.turns.ai.chat") as chat:
            self.assertEqual(self.post({"message": " "}).status_code, 400)
            self.assertEqual(self.post(player=Player.objects.create().pk).status_code, 404)
            self.assertEqual(self.post(play=uuid.uuid4()).status_code, 404)
        chat.assert_not_called()

    def test_ai_failure_does_not_save_input_or_state(self):
        for code in (502, 503, 504):
            with patch(
                "apps.game.turns.ai.chat",
                side_effect=GameError(code, "AI_UNAVAILABLE", "테스트 실패"),
            ):
                self.assertEqual(self.post().status_code, code)
            self.play.refresh_from_db()
            self.assertIsNone(self.play.turn_token)
            self.assertEqual(self.play.state, {"profile": {"name": "테스터"}})
        self.assertFalse(Turn.objects.exists())

    def test_only_one_optional_profile_change_is_applied(self):
        self.data["stateChanges"] = [
            {"field": "profile.mbti", "to": "INTP"},
            {"field": "profile.gender", "to": "선택"},
        ]
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            response = self.post()
        self.assertEqual(response.status_code, 200)
        self.assertIn(
            {"field": "profile.mbti", "from": None, "to": "INTP"},
            response.json()["data"]["stateChanges"],
        )
        self.play.refresh_from_db()
        self.assertEqual(self.play.state["profile"]["mbti"], "INTP")
        self.assertEqual(self.play.profile, self.play.state["profile"])

    def test_ai_death_suggestion_alone_does_not_end_life(self):
        self.data["lifeEnded"] = True
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            self.assertFalse(self.post().json()["data"]["ended"])
        self.play.refresh_from_db()
        self.assertFalse(self.play.ended)
        self.assertIsNone(self.play.ended_at)

    def test_ended_flag_prevents_ai_call_and_new_messages_without_legacy_timestamp(self):
        self.play.ended = True
        self.play.save(update_fields=["ended"])
        with patch("apps.game.turns.ai.chat") as chat:
            response = self.post()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["type"], "ALREADY_ENDED")
        chat.assert_not_called()
        self.assertFalse(Turn.objects.exists())
        self.assertFalse(Message.objects.exists())

    def test_unknown_experience_is_skipped(self):
        self.data["branch"] = {"topic": "행사", "jobs": ["행사기획자"], "reason": "친구의 제안"}
        with (
            patch("apps.game.turns.ai.chat", return_value=self.data),
            patch("apps.game.turns.ai.recommend", return_value=None),
        ):
            data = self.post().json()["data"]
        self.assertIsNone(data["experience"])
        self.assertEqual(data["notice"]["type"], "EXPERIENCE_SKIPPED")

    def test_branch_triggers_recommendation_with_current_origin(self):
        branch = {"topic": "행사", "jobs": ["행사기획자"], "reason": "친구의 제안"}
        self.data["branch"] = branch
        offer = {
            "buildId": "career-suite-integration-v005",
            "buildUrl": "http://testserver/builds/career-suite-integration-v005/",
            "roomId": "PAN-002",
            "scenarioId": "career-net-951-experience",
            "scenarioVersion": "v002",
            "title": "주민 문화행사 준비",
            "jobs": ["행사기획자"],
            "reason": "친구의 제안",
        }
        with (
            patch("apps.game.turns.ai.chat", return_value=self.data),
            patch("apps.game.turns.ai.recommend", return_value=offer) as recommend,
        ):
            result = self.post().json()["data"]
        self.assertEqual(result["experience"], offer)
        self.assertEqual(recommend.call_args.args[1], branch)
        self.assertEqual(recommend.call_args.args[4], "http://testserver/")
        self.assertEqual(
            recommend.call_args.args[3], [{"input": "안녕", "messages": self.data["messages"]}]
        )

    def test_recommendation_history_includes_current_turn_and_keeps_twenty_turns(self):
        for number in range(1, 24):
            Turn.objects.create(
                play=self.play,
                number=number,
                input=str(number),
                response={"messages": self.data["messages"]},
                context={"npcIds": []},
            )
        self.data["branch"] = {"topic": "직업", "jobs": [], "reason": "이번 대화"}
        with (
            patch("apps.game.turns.ai.chat", return_value=self.data),
            patch("apps.game.turns.ai.recommend", return_value=None) as recommend,
        ):
            self.assertEqual(self.post({"message": "사서에 관심 있어"}).status_code, 200)
        history = recommend.call_args.args[3]
        self.assertEqual(len(history), 20)
        self.assertEqual(history[0]["input"], "5")
        self.assertEqual(history[-1]["input"], "사서에 관심 있어")

    def test_concurrent_or_abandoned_turn_lease(self):
        self.play.turn_token = uuid.uuid4()
        self.play.turn_expires_at = timezone.now() + timedelta(seconds=30)
        self.play.save()
        with patch("apps.game.turns.ai.chat", return_value=self.data) as chat:
            self.assertEqual(self.post().status_code, 409)
            chat.assert_not_called()
            self.play.turn_expires_at = timezone.now() - timedelta(seconds=1)
            self.play.save()
            self.assertEqual(self.post().status_code, 200)

    def test_turn_schema_exposes_message_roles(self):
        schema = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json").json()
        self.assertIn("대화", schema["paths"]["/api/v1/plays/{play_id}/turns"]["post"]["tags"])
        self.assertIn("role", schema["components"]["schemas"]["Message"]["required"])
