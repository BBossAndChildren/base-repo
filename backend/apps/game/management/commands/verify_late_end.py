import json

from django.core.management.base import BaseCommand, CommandError

from apps.game.common import GameError
from apps.game.models import ExperienceEvent
from apps.game.reconciliation import verify_late_end


class Command(BaseCommand):
    help = "격리된 늦은 종료를 외부 근거 검토 후 정정합니다. 클라이언트 시각만으로 승인하지 마세요."

    def add_arguments(self, parser):
        parser.add_argument("session_id")
        parser.add_argument("event_id")
        parser.add_argument("--evidence", required=True)

    def handle(self, *args, **options):
        try:
            result = verify_late_end(
                options["session_id"], options["event_id"], options["evidence"]
            )
        except (GameError, ExperienceEvent.DoesNotExist) as exc:
            raise CommandError("종료 원본과 검토 근거를 확인해 주세요.") from exc
        self.stdout.write(
            json.dumps({"resolutionId": result["resolutionId"], "revision": result["revision"]})
        )
