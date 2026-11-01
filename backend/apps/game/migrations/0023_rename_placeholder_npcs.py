"""AI 출력 예시의 자리표시("이름" 등)로 등록된 기존 NPC 를 기본 인물 이름으로 바꾼다 (#182).

이전에는 첫 장면에 인물이 없으면 AI 첫 응답의 발화자 이름을 그대로 NPC 로 등록해서,
AI 가 "이름" 을 보내면 그 플레이는 계속 "이름" 으로만 대화했다. 대화 기록(messages)은 바꾸지 않는다.
"""

import hashlib

from django.db import migrations

PLACEHOLDERS = {
    "이름",
    "name",
    "npc",
    "speaker",
    "화자",
    "인물",
    "등장인물",
    "{이름}",
    "<이름>",
    "",
}
ROLE = {
    "초등학생": "친구",
    "중학생": "친구",
    "고등학생": "친구",
    "대학생": "동기",
    "직장인": "동료",
    "구직 중": "선배",
}
NAMES = ("지우", "서연", "민준", "하린", "도윤", "예린", "시우", "유나", "준호", "수아")


def rename(apps, schema_editor):
    NPC = apps.get_model("game", "NPC")
    for npc in NPC.objects.select_related("play"):
        if npc.name.strip().casefold() not in PLACEHOLDERS:
            continue
        play = npc.play
        situation = (play.state or {}).get("profile", {}).get("situation")
        index = int(hashlib.sha256(str(play.pk).encode()).hexdigest(), 16) % len(NAMES)
        name = f"{ROLE.get(situation, '이웃')} {NAMES[index]}"
        # 같은 플레이에 이미 그 이름이 있으면 겹치지 않게 다음 이름을 쓴다
        taken = set(NPC.objects.filter(play=play).values_list("name", flat=True))
        step = 0
        while name in taken and step < len(NAMES):
            step += 1
            name = f"{ROLE.get(situation, '이웃')} {NAMES[(index + step) % len(NAMES)]}"
        npc.name = name
        npc.save(update_fields=["name"])


class Migration(migrations.Migration):
    dependencies = [("game", "0022_experienceoffer")]

    operations = [migrations.RunPython(rename, migrations.RunPython.noop)]
