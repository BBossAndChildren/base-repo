from django.apps import AppConfig
from django.core.exceptions import ImproperlyConfigured


class GameConfig(AppConfig):
    name = "apps.game"

    def ready(self):
        from .common import GameError
        from .content import content_bundle

        try:
            content_bundle()
        except GameError as error:
            raise ImproperlyConfigured(
                "필수 게임 지침 또는 최신 인생·직업 규칙이 없거나 비어 있습니다."
            ) from error
