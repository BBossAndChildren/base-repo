import copy
import json
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from django.db import connections
from django.test import Client, TestCase, TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from jsonschema import validate

from apps.game.events import store_event
from apps.game.models import Experience, Play, Player, ReconcileRequest, ResolutionRevision, Turn
from apps.game.reconciliation import lifecycle, verify_late_end
from apps.game.unity import contract

from .test_events import actual_events


class ResolutionFixture:
    def setUp(self):
        self.player = Player.objects.create()
        self.events = actual_events()
        first = self.events[0]
        self.play = Play.objects.create(
            player=self.player, session_id=uuid.UUID(first["sessionId"])
        )
        self.offer = {
            key: first[key] for key in ("buildId", "roomId", "scenarioId", "scenarioVersion")
        }
        self.offer["buildUrl"] = "https://build.invalid/builds/career-pilot-v007/"
        Turn.objects.create(
            play=self.play,
            number=1,
            input="시작",
            response={"experience": self.offer, "messages": []},
        )
        self.experience = Experience.objects.create(
            play=self.play,
            external_id=first["experienceId"],
            session_id=first["sessionId"],
            metadata=self.offer,
            started_observed=True,
            lease_expires_at=timezone.now() - timedelta(seconds=1),
        )
        self.body = {
            "schemaVersion": 1,
            "protocol": "career-experience-resolution",
            "action": "reconcile_experience",
            "reconcileRequestId": "test-reconcile",
            "sessionId": first["sessionId"],
            "experienceId": first["experienceId"],
            "roomId": first["roomId"],
            "trigger": "NEW_PLAY_START",
            "newExperienceId": "next-experience",
        }

    def post(self, body=None, player=None, client=None):
        return (client or self.client).post(
            reverse("reconcile", args=[self.play.pk]),
            json.dumps(body or self.body),
            content_type="application/json",
            HTTP_X_PLAYER_ID=str(player or self.player.pk),
        )

    def store(self, event):
        return store_event(self.play, copy.deepcopy(event))

    def terminal(self):
        return next(
            event for event in reversed(self.events) if event["type"] == "scenario.completed"
        )

    def resolved(self):
        response = self.post()
        self.assertEqual(response.status_code, 200, response.content)
        data = response.json()
        validate(data, contract("resolution-response.schema.json"))
        return data


class ResolutionTests(ResolutionFixture, TestCase):
    def test_rec_001_timeout_only_is_pending(self):
        self.assertEqual(lifecycle(self.experience, False), "pending_reconciliation")
        self.experience.refresh_from_db()
        self.assertFalse(self.experience.fenced)

    def test_rec_002_hidden_tab_does_not_infer_terminal(self):
        data = self.post(self.body | {"trigger": "TAB_HIDDEN"}).json()
        self.assertEqual(data["lifecycleStatus"], "pending_reconciliation")
        self.assertIsNone(data["result"])
        self.experience.refresh_from_db()
        self.assertFalse(self.experience.fenced)

    def test_rec_003_live_lease_is_deferred(self):
        self.experience.lease_expires_at = timezone.now() + timedelta(seconds=120)
        self.experience.save()
        self.assertEqual(self.resolved()["lifecycleStatus"], "deferred_active")

    def test_rec_004_unknown_lease_is_pending(self):
        self.experience.lease_expires_at = None
        self.experience.save()
        self.assertEqual(self.resolved()["lifecycleStatus"], "pending_reconciliation")

    def test_rec_005_expired_started_experience_is_fenced(self):
        data = self.resolved()
        self.assertEqual(data["lifecycleStatus"], "interrupted")
        self.assertEqual(data["code"], "END_RESPONSE_MISSING_ON_RESTART")
        self.assertIsNone(data["process"])
        self.assertIsNone(data["result"])
        self.experience.refresh_from_db()
        self.assertTrue(self.experience.fenced)

    def test_rec_006_no_start_evidence_is_not_started(self):
        self.experience.started_observed = False
        self.experience.save()
        self.assertEqual(self.resolved()["lifecycleStatus"], "not_started")

    def test_rec_007_preserves_known_scenario_result_without_fabricating_end(self):
        terminal = self.terminal()
        self.store(terminal)
        data = self.resolved()
        self.assertEqual(data["result"], terminal["result"])
        self.assertEqual(data["lifecycleStatus"], "interrupted")
        self.assertFalse(data["unityEndReceived"])
        self.assertIsNone(data["process"])
        self.assertEqual(data["lastObserved"]["process"], terminal["process"])

    def test_rec_008_same_request_returns_same_response(self):
        first = self.resolved()
        self.assertEqual(self.resolved(), first)
        self.assertEqual(ResolutionRevision.objects.count(), 1)
        stored = ResolutionRevision.objects.get()
        self.assertEqual(str(stored.resolution_id), first["resolutionId"])
        self.assertEqual(stored.lifecycle_status, first["lifecycleStatus"])
        self.assertEqual(stored.payload, first)

    def test_rec_009_same_request_changed_payload_conflicts(self):
        self.resolved()
        self.assertEqual(self.post(self.body | {"newExperienceId": "changed"}).status_code, 409)
        self.assertEqual(ResolutionRevision.objects.count(), 1)

    def test_rec_012_verified_late_end_appends_revision_preserving_old(self):
        self.store(self.terminal())
        first = self.resolved()
        ack = self.store(self.events[-1])
        self.assertTrue(ack["stored"])
        self.assertTrue(self.experience.events.get(event_id=self.events[-1]["eventId"]).quarantined)
        self.experience.refresh_from_db()
        self.assertIsNone(self.experience.ended_event)
        corrected = verify_late_end(
            self.body["sessionId"],
            self.events[-1]["eventId"],
            "자동 테스트에서 외부 송신 근거 검토를 명시적으로 모사",
        )
        validate(corrected, contract("resolution-response.schema.json"))
        self.assertEqual(corrected["resolutionId"], first["resolutionId"])
        self.assertEqual(corrected["revision"], first["revision"] + 1)
        self.assertEqual(corrected["lifecycleStatus"], "ended")
        self.assertEqual(ResolutionRevision.objects.get(revision=1).response, first)
        self.assertFalse(Experience.objects.get(external_id="next-experience").fenced)

    def test_rec_013_post_fence_actions_are_quarantined(self):
        self.resolved()
        self.play.refresh_from_db()
        before = self.play.state
        action = copy.deepcopy(self.events[0])
        action.update(eventId="post-fence", sequence=1000)
        self.assertTrue(self.store(action)["stored"])
        self.assertTrue(self.experience.events.get(event_id="post-fence").quarantined)
        self.play.refresh_from_db()
        self.assertEqual(self.play.state, before)

    def test_rec_014_foreign_owner_or_mismatched_ids_rejected_without_writes(self):
        self.assertEqual(self.post(player=Player.objects.create().pk).status_code, 404)
        self.assertEqual(self.post(self.body | {"roomId": "PAN-999"}).status_code, 400)
        foreign = Play.objects.create(player=Player.objects.create())
        Experience.objects.create(play=foreign, external_id="next-experience", metadata=self.offer)
        self.assertEqual(self.post().status_code, 404)
        self.assertFalse(ReconcileRequest.objects.exists())
        self.experience.refresh_from_db()
        self.assertFalse(self.experience.fenced)

    def test_rec_015_no_next_visit_remains_unresolved(self):
        response = self.client.get(
            reverse("resume", args=[self.play.pk]), HTTP_X_PLAYER_ID=str(self.player.pk)
        )
        self.assertEqual(response.status_code, 200)
        self.experience.refresh_from_db()
        self.assertFalse(self.experience.fenced)
        self.assertIsNone(self.experience.latest_resolution)

    def test_rec_016_reconcile_and_unity_duplicates_do_not_increment_counts(self):
        self.store(self.events[-1])
        self.assertEqual(self.store(self.events[-1]), self.store(self.events[-1]))
        first = self.resolved()
        self.assertEqual(self.resolved(), first)
        self.assertEqual(first["lifecycleStatus"], "ended")
        self.assertEqual(first["process"], self.events[-1]["process"])
        self.play.refresh_from_db()
        self.assertEqual(len(self.play.state["experiences"]), 1)


class ConcurrentResolutionTests(ResolutionFixture, TransactionTestCase):
    def parallel(self, operations):
        barrier = threading.Barrier(2)

        def worker(operation):
            try:
                barrier.wait(timeout=5)
                return operation()
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(worker, operations))

    def test_rec_010_heartbeat_and_reconcile_have_atomic_single_decision(self):
        def heartbeat():
            return Client().post(
                reverse("heartbeat", args=[self.play.pk]),
                json.dumps(
                    {
                        "sessionId": str(self.play.session_id),
                        "experienceId": self.experience.external_id,
                    }
                ),
                content_type="application/json",
                HTTP_X_PLAYER_ID=str(self.player.pk),
            )

        hb, resolution = self.parallel([heartbeat, lambda: self.post(client=Client())])
        self.assertEqual(resolution.status_code, 200)
        status = resolution.json()["lifecycleStatus"]
        self.assertIn(status, ["deferred_active", "interrupted"])
        self.assertEqual(hb.status_code, 200 if status == "deferred_active" else 409)

    def test_rec_011_verified_end_wins_during_reconciliation(self):
        self.store(self.terminal())
        self.resolved()
        self.store(self.events[-1])
        self.parallel(
            [
                lambda: verify_late_end(
                    self.body["sessionId"],
                    self.events[-1]["eventId"],
                    "자동 테스트: 검토된 서버 외부 근거",
                ),
                lambda: self.post(
                    self.body | {"reconcileRequestId": "concurrent-next"}, client=Client()
                ),
            ]
        )
        self.experience.refresh_from_db()
        self.assertEqual(self.experience.latest_resolution["lifecycleStatus"], "ended")
