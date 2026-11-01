import json
import uuid
from unittest.mock import patch

import httpx
from django.test import TestCase, override_settings

from apps.game.memory import ai_context, current_scene
from apps.game.models import NPC, GameEvent, InformationTransfer, NPCMemory, Play, Player, Turn
from apps.game.state import initial_state

from . import test_turns as turns_fixture
from .test_ai_chat import REAL_ASYNC_CLIENT, ai_response


class MemoryTests(TestCase):
    post = turns_fixture.TurnTests.post

    def setUp(self):
        self.player = Player.objects.create()
        self.play = Play.objects.create(
            player=self.player,
            state=initial_state({"name": "플레이어", "age": 15, "situation": "중학생"}),
            progress={"scene": {"id": "room", "npcIds": ["a"], "speakerNpcId": "a"}},
        )
        self.a = NPC.objects.create(play=self.play, key="a", name="민수")
        self.b = NPC.objects.create(play=self.play, key="b", name="지수")
        self.event = GameEvent.objects.create(
            play=self.play,
            key="secret",
            kind="playerStatement",
            game_date="2026-01-01",
            participants=["a"],
            facts={"statement": "민수에게만 말한 비밀"},
            source_action="previous",
        )
        NPCMemory.objects.create(npc=self.a, event=self.event, acquisition="direct")
        self.data = ai_response()["data"]
        self.data["messages"][0]["speaker"] = "민수"

    def test_context_filters_other_npc_and_other_play_before_sending(self):
        other = Play.objects.create(player=self.player)
        foreign_npc = NPC.objects.create(play=other, key="a", name="다른 인생 민수")
        foreign_event = GameEvent.objects.create(
            play=other,
            key="foreign",
            kind="secret",
            game_date="2026-01-01",
            facts={"secret": "다른 플레이"},
            source_action="other",
        )
        NPCMemory.objects.create(npc=foreign_npc, event=foreign_event, acquisition="direct")
        history = [
            Turn.objects.create(
                play=self.play,
                number=1,
                input="민수 비밀 대화",
                response={"messages": [{"role": "npc", "speaker": "민수", "text": "비밀 응답"}]},
                context={"npcIds": ["a"], "responseNpcIds": ["a"]},
            )
        ]
        scene = current_scene(self.play, "지수한테 만나러 갈게")
        player, filtered = ai_context(self.play, self.play.state, history, scene)
        self.assertEqual(player["speakingNpcId"], "b")
        self.assertEqual(player["memories"], [])
        self.assertEqual(filtered, [])
        player, filtered = ai_context(self.play, self.play.state, history, current_scene(self.play))
        self.assertEqual([item["eventId"] for item in player["memories"]], ["secret"])
        self.assertEqual(len(filtered), 1)

    def test_long_history_limit_preserves_npc_scope_and_current_input(self):
        for index in range(20):
            private = index == 18
            Turn.objects.create(
                play=self.play,
                number=index + 1,
                input=f"지수 비밀 {index}" if private else f"입력 {index}",
                response={
                    "messages": [
                        {"role": "narrator", "speaker": "나레이션", "text": f"장면 {index}"},
                        {
                            "role": "npc",
                            "speaker": "지수" if private else "민수",
                            "text": f"지수 비밀 응답 {index}" if private else f"응답 {index}",
                        },
                    ]
                },
                context={"npcIds": ["b" if private else "a"]},
            )

        def handler(request):
            body = json.loads(request.content)
            self.assertEqual(len(body["history"]), 40)
            self.assertNotIn("지수 비밀", json.dumps(body, ensure_ascii=False))
            self.assertEqual(body["history"][-1]["text"], "응답 19")
            self.assertEqual(body["input"], "현재 질문")
            self.assertEqual(body["player"]["speakingNpcId"], "a")
            self.assertEqual(
                body["player"]["memoryScope"], {"playId": str(self.play.pk), "npcId": "a"}
            )
            self.assertEqual(body["player"]["memories"][0]["eventId"], "secret")
            return httpx.Response(200, json={"code": 200, "data": self.data})

        with (
            override_settings(AI_API_BASE_URL="http://ai.invalid", AI_SERVER_KEY=str(uuid.uuid4())),
            patch(
                "apps.game.ai.httpx.AsyncClient",
                side_effect=lambda **kwargs: REAL_ASYNC_CLIENT(
                    transport=httpx.MockTransport(handler), **kwargs
                ),
            ),
        ):
            response = self.post({"message": "현재 질문"})
        self.assertEqual(response.status_code, 200, response.content)
        self.play.refresh_from_db()
        self.assertEqual(self.play.state["elapsedDays"], 0)
        self.assertEqual(self.play.turns.count(), 21)

    def test_transfer_requires_sender_knowledge_and_confirmed_trigger(self):
        self.data["transfers"] = [
            {"fromNpcId": "a", "toNpcId": "b", "eventId": "secret", "trigger": "timePassed"}
        ]
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            self.assertEqual(self.post().status_code, 502)
        self.assertFalse(InformationTransfer.objects.exists())
        self.data["actions"] = [
            {"kind": "advance", "days": 1, "activity": "holiday", "evidenceQuote": "안녕"}
        ]
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            response = self.post()
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(InformationTransfer.objects.count(), 1)
        self.assertTrue(
            NPCMemory.objects.filter(npc=self.b, event=self.event, acquisition="transfer").exists()
        )
        self.play.refresh_from_db()
        player, _ = ai_context(
            self.play, self.play.state, [], current_scene(self.play, "지수한테 만나러")
        )
        self.assertEqual(player["memories"][0]["facts"], self.event.facts)
        self.assertNotIn("memories", response.json()["data"]["state"])

    def test_invalid_sender_or_foreign_event_rolls_back_everything(self):
        self.data["actions"] = [
            {"kind": "advance", "days": 1, "activity": "holiday", "evidenceQuote": "안녕"}
        ]
        for sender, event_id in [("b", "secret"), ("a", "not-in-this-play")]:
            self.data["transfers"] = [
                {
                    "fromNpcId": sender,
                    "toNpcId": "a" if sender == "b" else "b",
                    "eventId": event_id,
                    "trigger": "timePassed",
                }
            ]
            with patch("apps.game.turns.ai.chat", return_value=self.data):
                self.assertEqual(self.post().status_code, 502)
        self.assertFalse(Turn.objects.exists())
        self.play.refresh_from_db()
        self.assertEqual(self.play.state["elapsedDays"], 0)

    def test_turn_and_resume_list_met_npc_names_without_memories(self):
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            response = self.post()
        self.assertEqual(response.status_code, 200)
        expected = [{"id": "a", "name": "민수"}, {"id": "b", "name": "지수"}]
        self.assertEqual(response.json()["data"]["npcs"], expected)
        resumed = self.client.get(
            f"/api/v1/plays/{self.play.pk}", HTTP_X_PLAYER_ID=str(self.player.pk)
        ).json()["data"]
        self.assertEqual(resumed["npcs"], expected)
        self.assertNotIn("민수에게만 말한 비밀", str(resumed["npcs"]))

    def test_memory_emotion_is_separate_from_facts_and_requires_access(self):
        self.data["memoryUpdates"] = [
            {
                "npcId": "a",
                "eventId": "secret",
                "emotion": "걱정",
                "interpretation": "도움을 원할 수 있음",
            }
        ]
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            self.assertEqual(self.post().status_code, 200)
        memory = NPCMemory.objects.get(npc=self.a, event=self.event)
        self.assertEqual(memory.emotion, "걱정")
        self.event.refresh_from_db()
        self.assertEqual(self.event.facts, {"statement": "민수에게만 말한 비밀"})
        self.data["memoryUpdates"][0]["npcId"] = "b"
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            self.assertEqual(self.post().status_code, 502)

    def test_same_request_does_not_duplicate_memory_or_events(self):
        body = {"requestId": str(uuid.uuid4()), "message": "안녕"}
        with patch("apps.game.turns.ai.chat", return_value=self.data):
            first = self.post(body)
            second = self.post(body)
        self.assertEqual(first.json(), second.json())
        self.assertEqual(GameEvent.objects.filter(kind="playerStatement").count(), 2)
        resumed = self.client.get(
            f"/api/v1/plays/{self.play.pk}", HTTP_X_PLAYER_ID=str(self.player.pk)
        ).json()["data"]
        self.assertEqual(resumed["scene"]["speakerNpcId"], "a")
        self.assertEqual(resumed["lastTurnId"], first.json()["data"]["turnId"])
        self.assertNotIn("legacyState", resumed["state"])


class SpeakerTargetTests(TestCase):
    """#111: 여러 NPC 이름이 나와도 실제로 찾아가거나 말을 거는 인물을 고른다"""

    def setUp(self):
        self.play = Play.objects.create(
            player=Player.objects.create(),
            state=initial_state({"name": "플레이어", "age": 15, "situation": "중학생"}),
            progress={"scene": {"id": "room", "npcIds": [], "speakerNpcId": None}},
        )
        # 승언이 먼저 등록된 상태 (이슈 재현 조건)
        NPC.objects.create(play=self.play, key="seungeon", name="승언")
        NPC.objects.create(play=self.play, key="seongjun", name="성준")

    def speaker(self, message):
        return current_scene(self.play, message)["speakerNpcId"]

    def test_issue_reproduction_picks_the_person_being_visited(self):
        self.assertEqual(
            self.speaker("성준한테 만나러 갈게. 승언에게 말했던 표식은 몰라도 돼."), "seongjun"
        )

    def test_order_of_mentions_does_not_matter(self):
        self.assertEqual(
            self.speaker("승언에게 말했던 표식은 몰라도 돼. 성준한테 만나러 갈게."), "seongjun"
        )
        self.assertEqual(self.speaker("승언 얘기는 됐고 성준을 만나러 가자"), "seongjun")

    def test_addressing_without_movement_still_switches(self):
        self.assertEqual(self.speaker("승언에게 고맙다고 전할게"), "seungeon")

    def test_name_without_target_or_movement_keeps_current_scene(self):
        self.assertIsNone(self.speaker("승언이 어제 웃겼어"))
        self.assertIsNone(self.speaker("오늘은 집에서 쉴래"))
