"""현재 플레이와 NPC 권한을 먼저 제한한 뒤 AI에 전달한다."""

import copy
import hashlib
import re

from .models import NPC, GameEvent, InformationTransfer, NPCMemory
from .rules import RuleViolation, text

# 대화 상대를 고르는 기준 (#111). 이름 바로 뒤 "한테 · 에게 · 께" 또는 같은 절의 만남 · 이동 동사
TARGET_PARTICLES = ("한테", "에게", "께")
OBJECT_PARTICLES = ("을", "를")
MEET_WORDS = ("만나", "찾아", "보러")
MOVE_WORDS = ("갈게", "갈래", "간다", "가자", "가서", "가볼", "가야", "가요", "갈까")
PAST_MARKERS = ("했던", "었던", "았던", "였던", "했었", "했어", "던 ")


def target_npc(npcs, message):
    """입력에서 플레이어가 지금 찾아가거나 말을 거는 인물을 고른다. 없으면 None.

    이름이 나왔다는 것만으로 고르지 않는다. 절(문장 부호 · 쉼표 단위)마다 이름 뒤가 대상 조사이거나
    같은 절에 만남 · 이동 동사가 있는지 본다. 우선순위: 만남 · 이동이 있는 절
    > 이름 뒤에 대상 조사(한테 · 을/를)가 붙은 이름 > 과거 이야기가 아닌 절 > 앞선 절 · 위치.
    """
    best = None
    for index, clause in enumerate(re.split(r"[.!?\n,。]+", message)):
        moving = any(word in clause for word in (*MEET_WORDS, *MOVE_WORDS))
        for npc in npcs:
            position = clause.find(npc.name)
            if position < 0:
                continue
            after = clause[position + len(npc.name) :].lstrip()
            addressed = after.startswith(TARGET_PARTICLES)
            if not (addressed or moving):
                continue
            marked = addressed or after.startswith(OBJECT_PARTICLES)
            past = any(marker in after for marker in PAST_MARKERS)
            rank = (not moving, not marked, past, index, position)
            if best is None or rank < best[0]:
                best = (rank, npc)
    return best[1] if best else None


def npc_list(play):
    """만난 인물 이름 목록 (화면의 인물별 관계 표시용). 비공개 기억 · 해석은 넣지 않는다"""
    return [{"id": npc.key, "name": npc.name} for npc in play.npcs.order_by("id")]


def current_scene(play, message=""):
    scene = copy.deepcopy(
        play.progress.get("scene", {"id": "opening", "npcIds": [], "speakerNpcId": None})
    )
    # 플레이어가 이미 만난 인물을 이름으로 찾아가는 경우 그 인물 범위로 먼저 전환한다.
    npc = target_npc(list(play.npcs.all()), message)
    if npc:
        return {"id": "npc:" + npc.key, "npcIds": [npc.key], "speakerNpcId": npc.key}
    return scene


def ai_context(play, state, past, scene):
    player = copy.deepcopy(state)
    speaker = scene.get("speakerNpcId")
    player["playId"] = str(play.pk)
    player["currentScene"] = scene
    player["speakingNpcId"] = speaker
    player["npcs"] = [
        {"id": npc.key, "name": npc.name} for npc in play.npcs.filter(key__in=scene["npcIds"])
    ]
    player["memoryScope"] = {"playId": str(play.pk), "npcId": speaker}
    memories = (
        NPCMemory.objects.filter(npc__play=play, npc__key=speaker, event__play=play)
        .select_related("event")
        .order_by("-id")[:40]
    )
    player["memories"] = [
        {
            "eventId": row.event.key,
            "facts": row.event.facts,
            "acquisition": row.acquisition,
            "emotion": row.emotion,
            "interpretation": row.interpretation,
        }
        for row in memories
    ]
    player["visibleEvents"] = [
        {"eventId": row["eventId"], "facts": row["facts"]} for row in player["memories"]
    ]
    player["pendingChoices"] = play.progress.get("pendingChoices", [])
    if speaker:
        player["relationship"] = {speaker: state.get("relationship", {}).get(speaker)}
    history = []
    for turn in past:
        if speaker:
            user_input = turn.input if speaker in turn.context.get("npcIds", []) else ""
            messages = (
                turn.response["messages"]
                if speaker in turn.context.get("responseNpcIds", turn.context.get("npcIds", []))
                else []
            )
            if user_input or messages:
                history.append({"input": user_input, "messages": messages})
        elif not speaker and turn.context.get("npcIds") == []:
            history.append(
                {
                    "input": turn.input,
                    "messages": [
                        item for item in turn.response["messages"] if item.get("role") == "narrator"
                    ],
                }
            )
    return player, history


def plan_memory(play, scene, data, events, message, key, game_date):
    known = {npc.key: npc.name for npc in play.npcs.all()}
    previous_known = dict(known)
    proposed = data.get("scene")
    next_scene = copy.deepcopy(scene)
    if proposed is not None:
        if not isinstance(proposed, dict):
            raise RuleViolation("장면 형식 오류")
        text(proposed.get("id"), 100)
        if not isinstance(proposed.get("npcs", []), list):
            raise RuleViolation("장면 인물 목록 오류")
        for npc in proposed.get("npcs", []):
            if not isinstance(npc, dict):
                raise RuleViolation("장면 인물 객체 오류")
            npc_id, name = text(npc.get("id"), 100), text(npc.get("name"), 200)
            if npc_id in known and known[npc_id] != name:
                raise RuleViolation("기존 NPC 이름을 바꿀 수 없습니다")
            known[npc_id] = name
        ids = proposed.get("npcIds")
        if not isinstance(ids, list) or len(ids) > 10 or any(npc_id not in known for npc_id in ids):
            raise RuleViolation("알 수 없는 장면 참여자")
        speaker = proposed.get("speakerNpcId")
        if speaker is not None and speaker not in ids:
            raise RuleViolation("발화자는 장면 참여자여야 합니다")
        for npc_id in ids:
            if (
                npc_id in previous_known
                and npc_id not in scene["npcIds"]
                and previous_known[npc_id] not in message
            ):
                raise RuleViolation("NPC 이동의 사용자 근거가 없습니다")
        next_scene = {"id": proposed["id"], "npcIds": ids, "speakerNpcId": speaker}
    elif not scene["npcIds"]:
        # 첫 등장 인물은 응답 이름으로 등록한다. 이전 NPC의 비공개 대화는 전달하지 않는다.
        names = list(
            dict.fromkeys(item["speaker"] for item in data["messages"] if item["role"] == "npc")
        )
        ids = []
        for name in names:
            npc_id = "npc-" + hashlib.sha256(name.encode()).hexdigest()[:20]
            known[npc_id] = name
            ids.append(npc_id)
        if ids:
            next_scene = {"id": "first-meeting", "npcIds": ids, "speakerNpcId": ids[0]}
    allowed_names = {known[npc_id] for npc_id in next_scene["npcIds"]}
    if any(
        item["speaker"] not in allowed_names for item in data["messages"] if item["role"] == "npc"
    ):
        raise RuleViolation("현재 장면 밖 인물의 발화입니다")
    participants = scene["npcIds"] or next_scene["npcIds"]
    statement = {
        "id": f"{key}:statement",
        "kind": "playerStatement",
        "gameDate": game_date,
        "actors": participants,
        "facts": {"statement": message[:1000], "isClaim": True},
        "sourceAction": str(key),
    }
    planned = [*events, statement]
    for item in planned:
        if not item["actors"]:
            item["actors"] = participants
    visible = {item["id"]: set(item["actors"]) for item in planned}
    referenced = {
        row.get("eventId") for row in [*data.get("transfers", []), *data.get("memoryUpdates", [])]
    }
    for row in GameEvent.objects.filter(play=play, key__in=referenced):
        visible[row.key] = set(
            NPCMemory.objects.filter(event=row, npc__play=play).values_list("npc__key", flat=True)
        )
    transfers = data.get("transfers", [])
    for proposal in transfers:
        sender, recipient, event_id = (
            proposal.get("fromNpcId"),
            proposal.get("toNpcId"),
            proposal.get("eventId"),
        )
        if (
            sender not in known
            or recipient not in known
            or sender == recipient
            or sender not in visible.get(event_id, set())
        ):
            raise RuleViolation("정보 전달의 인물·출처 권한이 없습니다")
        trigger = proposal.get("trigger")
        if trigger == "timePassed":
            valid = any(item["kind"] == "timePassed" for item in events)
        elif trigger == "importantEvent":
            valid = any(
                item["kind"]
                in {"loan", "quitJob", "acceptJob", "collapse", "death", "familyPressure"}
                for item in events
            )
        else:
            valid = False
        if not valid:
            raise RuleViolation("배경 정보 전달의 확정 계기가 없습니다")
        visible.setdefault(event_id, set()).add(recipient)
    updates = data.get("memoryUpdates", [])
    for proposal in updates:
        if proposal.get("npcId") not in visible.get(proposal.get("eventId"), set()):
            raise RuleViolation("NPC가 모르는 사건의 기억입니다")
        for field in ("emotion", "interpretation"):
            if field in proposal and (
                not isinstance(proposal[field], str) or len(proposal[field]) > 2000
            ):
                raise RuleViolation("감정·해석 형식 오류")
        if set(proposal) - {"npcId", "eventId", "emotion", "interpretation"}:
            raise RuleViolation("확정 사실은 감정 제안으로 바꿀 수 없습니다")
    return {
        "scene": next_scene,
        "known": known,
        "events": planned,
        "transfers": transfers,
        "updates": updates,
    }


def save_memory(play, plan, key, game_date):
    npcs = {}
    for npc_id, name in plan["known"].items():
        npcs[npc_id], _ = NPC.objects.get_or_create(play=play, key=npc_id, defaults={"name": name})
    for item in plan["events"]:
        event, _ = GameEvent.objects.get_or_create(
            play=play,
            key=item["id"],
            defaults={
                "kind": item["kind"],
                "game_date": item["gameDate"],
                "participants": item["actors"],
                "facts": item["facts"],
                "source_action": item["sourceAction"],
            },
        )
        for npc_id in item["actors"]:
            NPCMemory.objects.get_or_create(
                npc=npcs[npc_id], event=event, defaults={"acquisition": "direct"}
            )
    for proposal in plan["transfers"]:
        event = GameEvent.objects.get(play=play, key=proposal["eventId"])
        InformationTransfer.objects.get_or_create(
            sender=npcs[proposal["fromNpcId"]],
            recipient=npcs[proposal["toNpcId"]],
            event=event,
            defaults={
                "trigger": proposal["trigger"],
                "game_date": game_date,
                "source_action": str(key),
            },
        )
        NPCMemory.objects.get_or_create(
            npc=npcs[proposal["toNpcId"]], event=event, defaults={"acquisition": "transfer"}
        )
    for proposal in plan["updates"]:
        NPCMemory.objects.filter(
            npc=npcs[proposal["npcId"]], event__play=play, event__key=proposal["eventId"]
        ).update(
            **{
                field: proposal[field]
                for field in ("emotion", "interpretation")
                if field in proposal
            }
        )
