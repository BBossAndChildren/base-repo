import json
import uuid
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse

from apps.game.models import NPC, Message, Play, Player, Turn
from apps.game.state import initial_state

from .test_ai_chat import ai_response


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
        self.assertEqual(play.state["funds"], 100000)  # 중학생 밸런스 기준값 (#132)
        self.assertEqual(play.state["support"]["monthlyAmount"], 50000)
        self.assertEqual(play.state["debt"], 0)
        self.assertEqual(play.state["health"], 80)
        self.assertEqual(play.state["stress"], 20)
        self.assertEqual(play.state["energy"], 70)
        self.assertNotIn("ability", play.state)
        self.assertIsNone(play.state["development"]["value"])
        self.assertEqual(play.state["relationship"], {})
        self.assertEqual(play.state["interests"], {})
        data = response.json()["data"]
        self.assertEqual(Message.objects.filter(play=play, turn=0).count(), 2)
        self.assertEqual(data["messages"][0]["role"], "narrator")
        self.assertIn("중학생", data["messages"][0]["text"])
        self.assertEqual(data["messages"][1]["speaker"], "승언")
        self.assertEqual(NPC.objects.get(play=play).name, "승언")
        self.assertEqual(play.progress["scene"]["speakerNpcId"], "opening-companion")
        self.assertEqual(Turn.objects.get(play=play, number=0).response["hints"], data["hints"])
        self.assertTrue(data["hints"])

    def test_worker_opening_uses_adult_companion_without_assigning_dream_job(self):
        profile = self.body | {
            "age": 30,
            "situation": "직장인",
            "hasDreamJob": True,
            "dreamJob": "사서",
        }
        response = self.post(profile)
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()["data"]
        self.assertEqual(data["messages"][1]["speaker"], "성준")
        self.assertIn("30세", data["messages"][0]["text"])
        self.assertIn("사서", data["hints"][0])
        self.assertEqual(data["state"]["occupation"], initial_state(profile)["occupation"])
        self.assertIsNone(data["state"]["occupation"]["currentJob"])
        self.assertEqual(NPC.objects.get(play_id=data["playId"]).name, "성준")

    def test_opening_and_latest_hints_resume_and_first_ai_turn_sees_scene(self):
        started = self.post(self.body).json()["data"]
        play = Play.objects.get(pk=started["playId"])
        headers = {"HTTP_X_PLAYER_ID": str(self.player.pk)}
        resumed = self.client.get(reverse("resume", args=[play.pk]), **headers).json()["data"]
        self.assertEqual(resumed["messages"], started["messages"])
        self.assertEqual(resumed["hints"], started["hints"])
        data = ai_response()["data"]
        data["messages"][0]["speaker"] = "승언"
        data["hints"] = ["내일은 다른 일을 해볼래"]
        with patch("apps.game.turns.ai.chat", return_value=data) as chat:
            response = self.client.post(
                reverse("turns", args=[play.pk]),
                json.dumps({"requestId": str(uuid.uuid4()), "message": "이야기하고 싶어"}),
                content_type="application/json",
                **headers,
            )
        self.assertEqual(response.status_code, 200, response.content)
        player, history = chat.call_args.args[:2]
        self.assertEqual(player["speakingNpcId"], "opening-companion")
        self.assertEqual(player["npcs"], [{"id": "opening-companion", "name": "승언"}])
        self.assertEqual(history, [{"input": "", "messages": started["messages"]}])
        self.assertEqual(
            list(play.turns.order_by("number").values_list("number", flat=True)), [0, 1]
        )
        resumed = self.client.get(reverse("resume", args=[play.pk]), **headers).json()["data"]
        self.assertEqual(resumed["hints"], data["hints"])
        self.assertEqual(resumed["messages"][:2], started["messages"])
        self.assertEqual(
            [item["text"] for item in resumed["messages"] if item["role"] == "user"],
            ["이야기하고 싶어"],
        )
        self.assertFalse(Message.objects.filter(play=play, role="user", text="").exists())
        self.assertEqual(resumed["lastTurnId"], response.json()["data"]["turnId"])

    def test_opening_storage_failure_rolls_back_all_play_records(self):
        with (
            patch(
                "apps.game.views.Message.objects.bulk_create", side_effect=RuntimeError("storage")
            ),
            self.assertRaisesRegex(RuntimeError, "storage"),
        ):
            self.post(self.body)
        for model in (Play, NPC, Turn, Message):
            self.assertFalse(model.objects.exists(), model.__name__)
        self.assertTrue(Player.objects.filter(pk=self.player.pk).exists())

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
        for name in ("PlayData", "ResumeData"):
            hints = schema["components"]["schemas"][name]["properties"]["hints"]
            self.assertEqual(hints["type"], "array")
            self.assertEqual(hints["items"]["type"], "string")
