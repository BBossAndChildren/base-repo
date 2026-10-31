import json
import uuid

from django.test import TestCase
from django.urls import reverse

from apps.game.models import Message, Play, Player


class StartTests(TestCase):
    def setUp(self):
        self.player = Player.objects.create()
        self.body = {"name": "테스터", "age": 15, "situation": "중학생", "hasDreamJob": False}

    def post(self, body, player=None):
        return self.client.post(
            reverse("plays"),
            json.dumps(body),
            content_type="application/json",
            HTTP_X_PLAYER_ID=str(player or self.player.pk),
        )

    def test_start_persists_profile_and_documented_initial_state(self):
        response = self.post(self.body)
        self.assertEqual(response.status_code, 200)
        play = Play.objects.get(pk=response.json()["data"]["playId"])
        self.assertEqual(uuid.UUID(response.json()["data"]["sessionId"]), play.session_id)
        self.assertEqual(play.player, self.player)
        self.assertEqual(play.state["profile"], self.body)
        self.assertEqual(play.profile, self.body)
        self.assertEqual(play.state["age"], 15)
        self.assertEqual(play.state["elapsedDays"], 0)
        self.assertEqual(play.state["funds"], 0)
        self.assertEqual(play.state["debt"], 0)
        self.assertEqual(play.state["health"], 80)
        self.assertEqual(play.state["stress"], 20)
        self.assertEqual(play.state["energy"], 70)
        self.assertNotIn("ability", play.state)
        self.assertIsNone(play.state["development"]["value"])
        self.assertEqual(play.state["relationship"], {})
        self.assertEqual(play.state["interests"], {})
        self.assertEqual(Message.objects.get(play=play, turn=0).role, "narrator")
        self.assertEqual(
            response.json()["data"]["messages"][0],
            {"role": "narrator", "speaker": "나레이션", "text": "플레이가 시작되었습니다."},
        )

    def test_each_play_has_distinct_session_id(self):
        first = self.post(self.body).json()["data"]["sessionId"]
        second = self.post(self.body).json()["data"]["sessionId"]
        self.assertNotEqual(first, second)

    def test_missing_or_unknown_player(self):
        self.assertEqual(self.client.post(reverse("plays")).status_code, 401)
        self.assertEqual(self.post(self.body, uuid.uuid4()).status_code, 401)
        self.assertEqual(self.post(self.body, "invalid").status_code, 401)
        self.assertFalse(Play.objects.exists())

    def test_required_and_conditional_fields(self):
        for change in [{"name": ""}, {"age": -1}, {"hasDreamJob": True}, {"dreamJob": "사서"}]:
            with self.subTest(change=change):
                response = self.post(self.body | change)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["error"]["type"], "INVALID_INPUT")
        self.assertFalse(Play.objects.exists())

    def test_optional_profile_and_dream_job(self):
        response = self.post(self.body | {"hasDreamJob": True, "dreamJob": "사서", "mbti": "INTP"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["state"]["profile"]["mbti"], "INTP")

    def test_only_explicit_interests_are_initialized_independently_of_dream_job(self):
        response = self.post(
            self.body | {"interests": ["과학", "게임"], "hasDreamJob": True, "dreamJob": "사서"}
        )
        state = response.json()["data"]["state"]
        self.assertEqual(state["interests"], {"과학": None, "게임": None})
        self.assertEqual(state["profile"]["dreamJob"], "사서")
        self.assertEqual(state["experiences"], [])

    def test_unknown_or_sensitive_profile_field_is_rejected(self):
        for field in ["health", "disease", "family", "occupation", "state"]:
            self.assertEqual(self.post(self.body | {field: "미허용"}).status_code, 400)
        self.assertFalse(Play.objects.exists())

    def test_latest_profile_limits(self):
        invalid = [
            {"age": 6},
            {"age": 100},
            {"situation": "학생"},
            {"interests": ["x"] * 6},
            {"strengths": ["x"] * 6},
            {"values": ["안정", "성장", "돈", "관계"]},
            {"values": ["임의"]},
        ]
        for change in invalid:
            with self.subTest(change=change):
                self.assertEqual(self.post(self.body | change).status_code, 400)
        self.assertFalse(Play.objects.exists())

    def test_start_schema_describes_message_role(self):
        schema = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json").json()
        operation = schema["paths"]["/api/v1/plays"]["post"]
        self.assertIn("플레이", operation["tags"])
        message = schema["components"]["schemas"]["Message"]
        self.assertIn("role", message["required"])
        self.assertTrue(message["properties"]["role"]["description"])
        state = schema["components"]["schemas"]["PlayData"]["properties"]["state"]
        self.assertIn("age", state["description"])
        self.assertIn("원화", state["description"])
