from django.db import transaction
from django.utils import timezone

from .common import GameError, is_ended
from .models import Play


def settle_active_time(play):
    if play.turn_started_at:
        end = min(timezone.now(), play.turn_expires_at or timezone.now())
        play.active_seconds += max(0, (end - play.turn_started_at).total_seconds())
        play.turn_started_at = None


def set_paused(play, paused):
    with transaction.atomic():
        current = Play.objects.select_for_update().get(pk=play.pk)
        if is_ended(current):
            raise GameError(409, "ALREADY_ENDED", "이미 끝난 플레이입니다.")
        if current.paused != paused:
            if paused:
                settle_active_time(current)
            current.paused = paused
            current.state_version += 1
            current.save(
                update_fields=["paused", "state_version", "active_seconds", "turn_started_at"]
            )
        return {
            "state": current.state,
            "paused": current.paused,
            "stateVersion": current.state_version,
            "activePlaySeconds": current.active_seconds,
        }
