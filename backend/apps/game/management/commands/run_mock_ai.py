from http.server import ThreadingHTTPServer

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.game.mock_ai import make_handler


class Command(BaseCommand):
    help = "로컬 API 테스트 전용 AI 서버. 실제 모델 추론을 수행하지 않습니다."

    def add_arguments(self, parser):
        parser.add_argument("--bind", default="127.0.0.1")
        parser.add_argument("--port", type=int, default=9000)

    def handle(self, *args, **options):
        if not settings.MOCK_AI_ENABLED or not settings.AI_SERVER_KEY:
            raise CommandError("MOCK_AI_ENABLED와 테스트용 내부 키가 필요합니다.")
        self.stdout.write("TEST MOCK AI — 실제 모델 추론이 아닌 API 검증용 서버입니다.")
        server = ThreadingHTTPServer(
            (options["bind"], options["port"]), make_handler(settings.AI_SERVER_KEY)
        )
        try:
            server.serve_forever()
        finally:
            server.server_close()
