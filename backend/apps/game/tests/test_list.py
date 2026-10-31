from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from apps.game.models import Play, Player


class PlayListTests(TestCase):
    def setUp(self):
        self.player = Player.objects.create()

    def get(self):
        return self.client.get(reverse("play-list"), HTTP_X_PLAYER_ID=str(self.player.pk))

    def test_empty_list(self):
        self.assertEqual(self.get().json(), {"code": 200, "data": {"plays": []}})

    def test_ended_flag_is_returned_without_legacy_timestamp(self):
        Play.objects.create(player=self.player, ended=True)
        self.assertTrue(self.get().json()["data"]["plays"][0]["ended"])

    def test_only_owner_history_and_latest_first(self):
        first = Play.objects.create(player=self.player)
        second = Play.objects.create(player=self.player, ended_at=timezone.now(), summary="완료")
        Play.objects.create(player=Player.objects.create(), summary="다른 사람")
        response = self.get()
        self.assertEqual(response.status_code, 200)
        plays = response.json()["data"]["plays"]
        self.assertEqual([p["playId"] for p in plays], [str(second.pk), str(first.pk)])
        self.assertTrue(plays[0]["ended"])
        self.assertEqual(plays[0]["summary"], "완료")
        self.assertIn("T", plays[0]["startedAt"])
