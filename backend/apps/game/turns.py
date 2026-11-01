import copy
import time
import uuid
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from . import ai
from .common import GameError, is_ended
from .memory import ai_context, current_scene, npc_list, plan_memory, save_memory
from .models import Message, Play, Turn, TurnRequest
from .pause import settle_active_time
from .rules import RuleViolation, evolve, integer
from .serializers import StartPlaySerializer


def apply_proposals(state, proposals, message, memory_plan, play):
    # 게임 수치는 행동 규칙으로 계산한다. 프로필은 한 턴에 선택 항목 하나만 채운다.
    profile = state.setdefault("profile", {})
    changes = []
    for proposal in proposals:
        field = proposal["field"]
        if field.startswith(("relationship.", "interests.")):
            group, name = field.split(".", 1)
            quote = proposal.get("evidenceQuote")
            known_events = {item["id"] for item in memory_plan["events"]}
            event_id = proposal.get("eventId")
            if (
                not (isinstance(quote, str) and quote.strip() and quote in message)
                and event_id not in known_events
            ):
                if not play.game_events.filter(
                    key=event_id,
                    memories__npc__key__in=memory_plan["scene"]["npcIds"],
                    memories__npc__play=play,
                ).exists():
                    raise RuleViolation("관계·흥미 변경의 확인 가능한 근거가 없습니다")
            if group == "relationship":
                npc_id = next(
                    (key for key, value in memory_plan["known"].items() if name in {key, value}),
                    None,
                )
                if npc_id not in memory_plan["scene"]["npcIds"]:
                    raise RuleViolation("현재 장면 밖 NPC의 관계 변경입니다")
                name = npc_id
            value = integer(
                proposal["to"], 1 if group == "interests" else 0, 5 if group == "interests" else 100
            )
            state.setdefault(group, {})[name] = value
            continue
        key = field.removeprefix("profile.")
        if field != "profile." + key or key not in ai.OPTIONAL_PROFILE_FIELDS:
            raise RuleViolation("직접 상태 변경은 허용된 프로필 필드만 가능합니다")
        try:
            value = StartPlaySerializer().fields[key].run_validation(proposal["to"])
        except ValidationError:
            raise RuleViolation("프로필 값 검증 실패") from None
        previous = profile.get(key)
        if previous != value and not changes:
            profile[key] = value
            changes.append({"field": field, "from": previous, "to": value})
    return changes


def state_diff(before, after, prefix=""):
    changes = []
    for key in before.keys() | after.keys():
        field = prefix + key
        old, new = before.get(key), after.get(key)
        if old == new:
            continue
        if isinstance(old, dict) and isinstance(new, dict):
            changes.extend(state_diff(old, new, field + "."))
        else:
            changes.append({"field": field, "from": old, "to": new})
    return sorted(changes, key=lambda item: item["field"])


def run_turn(play, message, base_url, request_id):
    deadline = time.monotonic() + 30
    token = uuid.uuid4()
    with transaction.atomic():
        current = Play.objects.select_for_update().get(pk=play.pk)
        previous = current.turn_requests.filter(request_id=request_id).first()
        if previous and previous.input != message:
            raise GameError(409, "REQUEST_CONFLICT", "같은 요청 ID의 입력이 다릅니다.")
        if previous and previous.status == "completed":
            return previous.response
        if is_ended(current):
            raise GameError(409, "ALREADY_ENDED", "이미 끝난 플레이입니다.")
        if current.paused:
            raise GameError(409, "PLAY_PAUSED", "일시정지를 해제한 뒤 입력해 주세요.")
        if current.turn_token and current.turn_expires_at > timezone.now():
            raise GameError(409, "TURN_IN_PROGRESS", "이전 입력을 처리하고 있습니다.")
        settle_active_time(current)
        current.turn_token = token
        current.turn_started_at = timezone.now()
        current.turn_expires_at = timezone.now() + timedelta(seconds=30)
        current.save(
            update_fields=["turn_token", "turn_expires_at", "turn_started_at", "active_seconds"]
        )
        original_state = copy.deepcopy(current.state)
        original_version = current.state_version
        request_row, _ = TurnRequest.objects.update_or_create(
            play=current,
            request_id=request_id,
            defaults={"input": message, "state_version": original_version, "status": "pending"},
        )
        past = list(current.turns.order_by("-number")[:20])[::-1]
        scene = current_scene(current, message)
    try:
        player_context, history = ai_context(current, original_state, past, scene)
        for attempt in range(2):
            try:
                data = ai.chat(player_context, history, message, deadline, attempts=1)
                new_state, progress, events, pending, ended = evolve(
                    original_state,
                    current.progress,
                    data.get("actions", []),
                    message,
                    f"{play.pk}:{request_id}",
                )
                memory_plan = plan_memory(
                    current,
                    scene,
                    data,
                    events,
                    message,
                    f"{play.pk}:{request_id}",
                    new_state["gameDate"],
                )
                apply_proposals(new_state, data["stateChanges"], message, memory_plan, current)
                progress["scene"] = memory_plan["scene"]
                changes = state_diff(original_state, new_state)
                break
            except (RuleViolation, ValueError, KeyError, TypeError) as error:
                if attempt:
                    raise GameError(
                        502, "AI_UNAVAILABLE", "게임 규칙을 확인할 수 없어 다시 시도해야 합니다."
                    ) from error
            except GameError as error:
                if error.status_code != 502 or attempt:
                    raise
        experience = None
        if data["branch"] and not ended and not pending:
            situation = "\n".join(m["text"] for m in data["messages"])
            recommendation_history = [
                *history,
                {"input": message, "messages": data["messages"]},
            ][-20:]
            experience = ai.recommend(
                new_state, data["branch"], situation, recommendation_history, base_url, deadline
            )
        if time.monotonic() >= deadline:
            raise GameError(504, "TIMEOUT", "응답 시간이 초과되었습니다.")
        turn_id = uuid.uuid4()
        result = {
            "turnId": str(turn_id),
            "messages": data["messages"],
            "stateChanges": changes,
            "hints": data["hints"],
            "experience": experience,
            "ended": ended,
            "state": new_state,
            "stateVersion": original_version + 1,
            "pendingChoices": pending,
            "events": events,
        }
        if data["branch"] and not experience and not ended:
            result["notice"] = {
                "type": "EXPERIENCE_SKIPPED",
                "message": "지금 상황에 맞는 3D 체험이 없어 텍스트로 이야기를 이어갈게요.",
            }
        with transaction.atomic():
            current = Play.objects.select_for_update().get(pk=play.pk)
            if (
                current.turn_token != token
                or current.state != original_state
                or current.state_version != original_version
            ):
                raise GameError(409, "STATE_CONFLICT", "진행 상태가 변경되어 다시 입력해야 합니다.")
            save_memory(current, memory_plan, f"{play.pk}:{request_id}", new_state["gameDate"])
            # 이번 턴에 새로 만난 인물까지 포함한 이름 목록 (재전송 응답에도 그대로 저장)
            result["npcs"] = npc_list(current)
            Turn.objects.create(
                id=turn_id,
                play=current,
                number=(past[-1].number + 1 if past else 1),
                input=message,
                response=result,
                context={
                    "npcIds": scene["npcIds"] or memory_plan["scene"]["npcIds"],
                    "responseNpcIds": memory_plan["scene"]["npcIds"],
                    "sceneId": scene["id"],
                },
            )
            number = past[-1].number + 1 if past else 1
            Message.objects.create(
                play=current,
                turn=number,
                role="user",
                speaker=current.state.get("profile", {}).get("name", ""),
                text=message,
            )
            for item in data["messages"]:
                Message.objects.create(
                    play=current,
                    turn=number,
                    role=item["role"],
                    speaker=item["speaker"],
                    text=item["text"],
                    state_changes=changes,
                )
            current.state = new_state
            current.progress = progress
            current.state_version += 1
            current.profile = new_state.get("profile", {})
            current.messages = []
            # 플레이어 재개 기록은 NPC별로 필터링한 AI 컨텍스트와 구분한다.
            player_history = [
                {"input": turn.input, "messages": turn.response["messages"]} for turn in past
            ]
            for turn in [*player_history, {"input": message, "messages": data["messages"]}][-20:]:
                if turn["input"]:
                    current.messages.append(
                        {
                            "role": "user",
                            "speaker": current.state.get("profile", {}).get("name", ""),
                            "text": turn["input"],
                        }
                    )
                current.messages.extend({"role": "npc", **item} for item in turn["messages"])
            if ended:
                current.ended_at = timezone.now()
                current.ended = True
                current.summary = "\n".join(m["text"] for m in data["messages"])
                current.result = None
                current.ending = None
            current.save(
                update_fields=[
                    "state",
                    "state_version",
                    "progress",
                    "profile",
                    "messages",
                    "ended_at",
                    "ended",
                    "summary",
                    "result",
                    "ending",
                ]
            )
            request_row.status = "completed"
            request_row.response = result
            request_row.save(update_fields=["status", "response"])
        return result
    finally:
        with transaction.atomic():
            current = Play.objects.select_for_update().get(pk=play.pk)
            if current.turn_token == token:
                settle_active_time(current)
                current.turn_token = None
                current.turn_expires_at = None
                current.save(
                    update_fields=[
                        "turn_token",
                        "turn_expires_at",
                        "turn_started_at",
                        "active_seconds",
                    ]
                )
                TurnRequest.objects.filter(pk=request_row.pk, status="pending").update(
                    status="failed"
                )
