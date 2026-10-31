import uuid

from django.test import TestCase
from django.urls import reverse

from apps.game.models import Player


class PlayerTests(TestCase):
    def test_guest_without_auth_is_persisted(self):
        response = self.client.post(reverse("players"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["code"], 200)
        player_id = uuid.UUID(response.json()["data"]["playerId"])
        self.assertTrue(Player.objects.filter(pk=player_id).exists())

    def test_each_guest_has_a_different_id(self):
        first = self.client.post(reverse("players")).json()["data"]["playerId"]
        second = self.client.post(reverse("players")).json()["data"]["playerId"]
        self.assertNotEqual(first, second)
        self.assertEqual(Player.objects.count(), 2)
