"""#182 시작 장면 기본 인물 · 발화자 자리표시 바로잡기 · 처음 등장한 인물 등록"""

import copy
import importlib
import json
import uuid
from unittest.mock import patch

from django.apps import apps as django_apps
from django.test import TestCase
from django.urls import reverse

from apps.game.memory import OPENING_NPC_KEY, ai_context, current_scene, opening_npc_name
from apps.game.models import NPC, Message, Play, Player

from .test_ai_chat import ai_response

BODY = {"name": "민준", "age": 15, "situation": "중학생", "hasDreamJob": False}


class OpeningNPCTests(TestCase):
    def setUp(self):
        self.player = Player.objects.create()

    def start(self, body=BODY):
        response = self.client.post(
            reverse("plays"),
            json.dumps(body),
            content_type="application/json",
            HTTP_X_PLAYER_ID=str(self.player.pk),
        )
        self.assertEqual(response.status_code, 200, response.content)
        return Play.objects.get(pk=response.json()["data"]["playId"])

    def turn(self, play, data, message="안녕"):
        with patch("apps.game.turns.ai.chat", return_value=copy.deepcopy(data)) as chat:
            response = self.client.post(
                reverse("turns", args=[play.pk]),
                json.dumps({"requestId": str(uuid.uuid4()), "message": message}),
                content_type="application/json",
                HTTP_X_PLAYER_ID=str(self.player.pk),
            )
        return response, chat

    def test_start_seeds_named_opening_npc_by_situation(self):
        play = self.start()
        npc = NPC.objects.get(play=play, key=OPENING_NPC_KEY)
        self.assertRegex(npc.name, r"^친구 \S+$")
        self.assertEqual(
            play.progress["scene"],
            {"id": "opening", "npcIds": [OPENING_NPC_KEY], "speakerNpcId": OPENING_NPC_KEY},
        )
        for situation, role in [
            ("대학생", "동기"),
            ("직장인", "동료"),
            ("구직 중", "선배"),
            ("기타", "이웃"),
        ]:
            other = self.start({**BODY, "age": 30, "situation": situation})
            self.assertTrue(NPC.objects.get(play=other, key=OPENING_NPC_KEY).name.startswith(role))

    def test_ai_receives_opening_npc_name_as_speaker(self):
        play = self.start()
        name = NPC.objects.get(play=play, key=OPENING_NPC_KEY).name
        player, _ = ai_context(play, play.state, [], current_scene(play))
        self.assertEqual(player["speakingNpcId"], OPENING_NPC_KEY)
        self.assertEqual(player["npcs"], [{"id": OPENING_NPC_KEY, "name": name}])

    def test_placeholder_speaker_is_replaced_and_never_registered(self):
        play = self.start()
        name = NPC.objects.get(play=play, key=OPENING_NPC_KEY).name
        data = ai_response()["data"]
        for placeholder in ("이름", "NPC"):
            data["messages"][0]["speaker"] = placeholder
            response, _ = self.turn(play, data)
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(response.json()["data"]["messages"][0]["speaker"], name)
        self.assertFalse(NPC.objects.filter(play=play, name__in=["이름", "NPC"]).exists())
        self.assertEqual(
            set(Message.objects.filter(play=play, role="npc").values_list("speaker", flat=True)),
            {name},
        )

    def test_new_character_joins_scene_but_known_outsider_is_rejected(self):
        play = self.start()
        data = ai_response()["data"]
        data["messages"] = [{"role": "npc", "speaker": "선생님 김하늘", "text": "반가워"}]
        response, _ = self.turn(play, data)
        self.assertEqual(response.status_code, 200, response.content)
        play.refresh_from_db()
        newcomer = NPC.objects.get(play=play, name="선생님 김하늘")
        self.assertIn(newcomer.key, play.progress["scene"]["npcIds"])
        # 다른 장면에 있는 이미 아는 인물이 끼어들면 그 인물의 비공개 기억이 섞일 수 있어 거부
        NPC.objects.create(play=play, key="other", name="이웃 다른사람")
        data["messages"] = [{"role": "npc", "speaker": "이웃 다른사람", "text": "나도 있어"}]
        response, chat = self.turn(play, data)
        self.assertEqual(response.status_code, 502)
        self.assertEqual(chat.call_count, 2)

    def test_legacy_empty_scene_uses_default_name_instead_of_placeholder(self):
        play = Play.objects.create(
            player=self.player,
            state={"profile": {"name": "민준", "situation": "고등학생"}, "age": 17},
        )
        data = ai_response()["data"]
        data["messages"][0]["speaker"] = "이름"
        response, _ = self.turn(play, data)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["data"]["messages"][0]["speaker"], opening_npc_name(play))
        self.assertFalse(NPC.objects.filter(play=play, name="이름").exists())


class PlaceholderMigrationTests(TestCase):
    def test_existing_placeholder_npcs_are_renamed(self):
        migration = importlib.import_module("apps.game.migrations.0023_rename_placeholder_npcs")
        play = Play.objects.create(
            player=Player.objects.create(), state={"profile": {"situation": "대학생"}}
        )
        NPC.objects.create(play=play, key="npc-x", name="이름")
        NPC.objects.create(play=play, key="npc-y", name="동기 진짜")
        migration.rename(django_apps, None)
        names = set(NPC.objects.filter(play=play).values_list("name", flat=True))
        self.assertNotIn("이름", names)
        self.assertIn("동기 진짜", names)
        self.assertTrue(any(name.startswith("동기 ") and name != "동기 진짜" for name in names))
