import uuid

from django.db import connection
from django.test import TestCase
from django.urls import reverse

from apps.game.models import Player


class PlayerTests(TestCase):
    def test_guest_without_auth_is_persisted(self):
        self.assertEqual(connection.vendor, "postgresql")
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

    def test_schema_documents_guest_issuance(self):
        schema = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json").json()
        operation = schema["paths"]["/api/v1/players"]["post"]
        self.assertEqual(operation["tags"], ["플레이어"])
        self.assertTrue(operation["summary"])
        self.assertTrue(operation["description"])
        self.assertNotIn("requestBody", operation)
        self.assertIn("200", operation["responses"])
        self.assertIn("playerId", schema["components"]["schemas"]["PlayerData"]["required"])
        self.assertTrue(
            schema["components"]["schemas"]["PlayerData"]["properties"]["playerId"]["description"]
        )
