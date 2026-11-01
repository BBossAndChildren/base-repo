import uuid
from datetime import datetime, timezone

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class DesignMigrationTests(TransactionTestCase):
    migrate_from = ("game", "0012_experience_lifecycle_status_and_more")
    migrate_to = ("game", "0021_turn_context_gameevent_npc_informationtransfer_and_more")

    def test_existing_rows_are_backfilled_without_losing_unity_payload(self):
        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_from])
        # 정리는 고정 번호가 아니라 최신 마이그레이션까지 (새 테이블이 다른 테스트에서 빠지지 않게)
        self.addCleanup(
            lambda: MigrationExecutor(connection).migrate(
                MigrationExecutor(connection).loader.graph.leaf_nodes()
            )
        )
        old = executor.loader.project_state([self.migrate_from]).apps
        Player = old.get_model("game", "Player")
        Play = old.get_model("game", "Play")
        Turn = old.get_model("game", "Turn")
        Experience = old.get_model("game", "Experience")
        Event = old.get_model("game", "ExperienceEvent")
        Revision = old.get_model("game", "ResolutionRevision")
        player = Player.objects.create()
        state = {
            "profile": {"name": "이전 사용자"},
            "experiences": [{"experienceId": "exp-old", "result": {"outcome": "completed"}}],
        }
        result = {"ending": "이전 결말", "recommendedJobs": []}
        play = Play.objects.create(
            player=player,
            state=state,
            messages=[{"speaker": "narrator", "text": "시작"}],
            ended_at=datetime.now(timezone.utc),
            result=result,
        )
        Turn.objects.create(
            play=play,
            number=1,
            input="안녕",
            response={"messages": [{"speaker": "NPC", "text": "반가워"}], "stateChanges": []},
        )
        metadata = {
            "buildId": "build",
            "roomId": "room",
            "scenarioId": "scenario",
            "scenarioVersion": "v002",
        }
        experience = Experience.objects.create(play=play, external_id="exp-old", metadata=metadata)
        event = {
            "eventId": "event-old",
            "type": "object.selected",
            "sequence": 3,
            "scenarioRunId": "run",
            "process": {"scope": "scenario"},
        }
        Event.objects.create(
            experience=experience,
            session_id=str(play.session_id),
            event_id="event-old",
            payload={"unityEvent": event},
        )
        resolution_id = uuid.uuid4()
        response = {
            "resolutionId": str(resolution_id),
            "reconcileRequestId": "request-old",
            "lifecycleStatus": "ended",
            "resolvedAt": datetime.now(timezone.utc).isoformat(),
        }
        Revision.objects.create(experience=experience, revision=1, response=response)

        MigrationExecutor(connection).migrate([self.migrate_to])
        from apps.game.models import Experience as NewExperience
        from apps.game.models import ExperienceEvent as NewEvent
        from apps.game.models import Message
        from apps.game.models import Play as NewPlay
        from apps.game.models import ResolutionRevision as NewRevision

        migrated = NewPlay.objects.get(pk=play.pk)
        self.assertEqual(migrated.profile, state["profile"])
        self.assertEqual(migrated.experience_results, state["experiences"])
        self.assertTrue(migrated.ended)
        self.assertEqual(migrated.ending, result)
        self.assertEqual(Message.objects.filter(play=migrated).count(), 3)
        self.assertEqual(NewExperience.objects.get(pk=experience.pk).scenario_id, "scenario")
        stored_event = NewEvent.objects.get(event_id="event-old")
        self.assertEqual(stored_event.payload, event)
        self.assertEqual(stored_event.sequence, 3)
        self.assertEqual(len(stored_event.payload_hash), 64)
        stored_revision = NewRevision.objects.get(experience_id=experience.pk)
        self.assertEqual(stored_revision.resolution_id, resolution_id)
        self.assertEqual(stored_revision.payload, response)
