import copy
import json
import uuid

from django.test import TestCase
from django.urls import reverse

from apps.game.models import (
    Experience,
    ExperienceEvent,
    ExperienceEventConflict,
    Play,
    Player,
    Turn,
)


def actual_events():
    from pathlib import Path

    path = Path(__file__).parent / "fixtures/legacy-unity-events.json"
    return json.loads(path.read_text(encoding="utf-8"))["events"]


class EventTests(TestCase):
    def setUp(self):
        self.player = Player.objects.create()
        self.events = actual_events()
        self.first = self.events[0]
        self.play = Play.objects.create(
            player=self.player, session_id=uuid.UUID(self.first["sessionId"])
        )
        self.external_id = self.first["experienceId"]
        self.offer = {
            key: self.first[key] for key in ("buildId", "roomId", "scenarioId", "scenarioVersion")
        }
        self.offer["buildUrl"] = "https://build.invalid/builds/career-pilot-v007/"
        Turn.objects.create(
            play=self.play,
            number=1,
            input="시작",
            response={"experience": self.offer, "messages": []},
        )

    def post(self, event, player=None):
        return self.client.post(
            reverse("events", args=[self.play.pk]),
            json.dumps(event),
            content_type="application/json",
            HTTP_X_PLAYER_ID=str(player or self.player.pk),
        )

    def test_original_unity_stream_and_terminal_duplicate(self):
        for event in self.events:
            response = self.post(event)
            self.assertEqual(response.status_code, 200, response.content)
            self.assertTrue(response.json()["stored"])
        self.play.refresh_from_db()
        self.assertEqual(len(self.play.state["experiences"]), 1)
        self.assertEqual(self.play.experience_results, self.play.state["experiences"])
        result = self.play.state["experiences"][0]
        self.assertEqual(
            Experience.objects.get(external_id=self.external_id).result_summary, result
        )
        self.assertEqual(result["process"], self.events[-1]["process"])
        self.assertEqual(result["result"], self.events[-1]["result"])
        self.assertEqual(
            self.post(self.events[-1]).json(),
            {
                "stored": True,
                "sessionId": self.first["sessionId"],
                "eventId": self.events[-1]["eventId"],
            },
        )
        self.assertEqual(ExperienceEvent.objects.count(), len(self.events))
        saved = ExperienceEvent.objects.get(event_id=self.first["eventId"])
        self.assertEqual(saved.payload, self.first)
        self.assertEqual(saved.type, self.first["type"])
        self.assertEqual(saved.sequence, self.first["sequence"])
        self.assertEqual(len(saved.payload_hash), 64)

    def test_invalid_event_and_foreign_owner_do_not_write(self):
        invalid = copy.deepcopy(self.first)
        del invalid["sequence"]
        self.assertEqual(self.post(invalid).status_code, 400)
        self.assertEqual(self.post(self.first, Player.objects.create().pk).status_code, 404)
        self.assertFalse(ExperienceEvent.objects.exists())
        self.assertFalse(Experience.objects.exists())

    def test_duplicate_payload_conflict(self):
        self.assertEqual(self.post(self.first).status_code, 200)
        changed = copy.deepcopy(self.first)
        changed["data"] = {"changed": True}
        response = self.post(changed)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["type"], "EVENT_CONFLICT")
        self.assertEqual(ExperienceEvent.objects.count(), 1)
        self.assertEqual(ExperienceEventConflict.objects.count(), 1)
        self.assertEqual(ExperienceEventConflict.objects.get().payload, changed)

    def test_late_snapshot_and_null_count_are_not_summed(self):
        newer = copy.deepcopy(self.first)
        newer.update(eventId="newer", sequence=30)
        newer["process"]["attemptCount"] = 7
        newer["process"]["mistakeCount"] = None
        older = copy.deepcopy(self.first)
        older.update(eventId="older", sequence=10)
        older["process"]["attemptCount"] = 2
        self.assertEqual(self.post(newer).status_code, 200)
        self.assertEqual(self.post(older).status_code, 200)
        experience = Experience.objects.get(external_id=self.external_id)
        self.assertEqual(experience.last_sequence, 30)
        snapshot = next(iter(experience.snapshots.values()))
        self.assertEqual(snapshot["process"]["attemptCount"], 7)
        self.assertIsNone(snapshot["process"]["mistakeCount"])
        self.assertEqual(experience.events.count(), 2)

    def test_reset_runs_are_separate(self):
        old = copy.deepcopy(self.first)
        old["process"]["attemptCount"] = 7
        new = copy.deepcopy(self.first)
        new.update(eventId="reset", sequence=2, type="scenario.reset", scenarioRunId="next-run")
        self.assertEqual(self.post(old).status_code, 200)
        self.assertEqual(self.post(new).status_code, 200)
        experience = Experience.objects.get(external_id=self.external_id)
        self.assertEqual(len(experience.snapshots), 2)
        self.assertEqual(
            {e["scenarioRunId"] for e in experience.snapshots.values()},
            {old["scenarioRunId"], "next-run"},
        )

    def test_fenced_new_event_is_stored_for_review_without_state_change(self):
        self.post(self.first)
        Experience.objects.update(fenced=True)
        later = copy.deepcopy(self.first)
        later.update(eventId=str(uuid.uuid4()), sequence=2)
        response = self.post(later)
        self.assertTrue(response.json()["stored"])
        self.assertTrue(ExperienceEvent.objects.get(event_id=later["eventId"]).quarantined)
        self.play.refresh_from_db()
        self.assertEqual(self.play.state, {})

    def test_control_error_preserves_original_and_deduplicates(self):
        event = {
            "schemaVersion": 1,
            "protocol": "career-experience",
            "requestId": "request",
            "sessionId": self.first["sessionId"],
            "experienceId": self.external_id,
            "roomId": self.offer["roomId"],
            "type": "experience.error",
            "error": {"code": "LOAD_FAILED", "message": "테스트 오류"},
        }
        self.assertEqual(self.post(event).status_code, 200)
        self.assertEqual(self.post(event).json(), self.post(event).json())
        saved = ExperienceEvent.objects.get()
        self.assertEqual(saved.payload, event)
        self.assertNotIn("eventId", saved.payload)
