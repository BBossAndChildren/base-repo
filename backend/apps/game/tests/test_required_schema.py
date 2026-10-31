from django.test import TestCase

from apps.game.serializers import StartPlaySerializer


class RequiredSchemaTests(TestCase):
    def test_schema_has_required_fields_conditions_and_usable_examples(self):
        schema = self.client.get("/api/schema/", HTTP_ACCEPT="application/json").json()
        start = schema["components"]["schemas"]["StartPlay"]
        self.assertEqual(set(start["required"]), {"name", "age", "situation", "hasDreamJob"})
        self.assertEqual(start["oneOf"][0]["required"], ["hasDreamJob", "dreamJob"])
        self.assertIn("조건부 필수", start["properties"]["dreamJob"]["description"])
        examples = schema["paths"]["/api/v1/plays"]["post"]["requestBody"]["content"][
            "application/json"
        ]["examples"]
        self.assertEqual(len(examples), 2)
        for item in examples.values():
            serializer = StartPlaySerializer(data=item["value"])
            self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertIn("고딩", schema["paths"]["/api/v1/plays"]["post"]["description"])

    def test_slang_situation_is_rejected_but_documented_value_is_accepted(self):
        body = {
            "name": "나야나",
            "age": 20,
            "situation": "고딩",
            "hasDreamJob": True,
            "dreamJob": "작가",
        }
        serializer = StartPlaySerializer(data=body)
        self.assertFalse(serializer.is_valid())
        self.assertIn("situation", serializer.errors)
        self.assertTrue(StartPlaySerializer(data=body | {"situation": "고등학생"}).is_valid())
