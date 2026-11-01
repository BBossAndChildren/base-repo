"""첫 장면은 서버가 정한 인물로 시작해 모델의 예시 이름 등록을 피한다."""


def opening(profile):
    student = profile["situation"] in {"초등학생", "중학생", "고등학생", "대학생"}
    name = "승언" if student else "성준"
    npc = {"id": "opening-companion", "name": name}
    place = "수업이 끝난 학교 휴게 공간" if student else "잠시 쉬러 나온 동네 공원"
    intro = (
        f"{profile['age']}세, {profile['situation']}인 당신. "
        f"{place}에서 처음 만난 {name}이 말을 건넨다."
    )
    greeting = (
        f"안녕, 난 {name}이야. 오늘은 뭘 해볼까? 재미있었던 일부터 얘기해도 좋아."
        if student
        else "안녕하세요, 성준이에요. 오늘은 어떻게 보내고 싶으세요? 쉬면서 이야기해도 좋아요."
    )
    hints = ["요즘 좋아하는 일이 뭔지 같이 이야기해 볼래", "오늘은 하루 쉬고 싶어"]
    if profile["hasDreamJob"]:
        hints[0] = f"{profile['dreamJob']}라는 직업에 대해 알아보고 싶어"
    return {
        "scene": {"id": "opening", "npcIds": [npc["id"]], "speakerNpcId": npc["id"]},
        "npc": npc,
        "messages": [
            {"role": "narrator", "speaker": "나레이션", "text": intro},
            {"role": "npc", "speaker": name, "text": greeting},
        ],
        "hints": hints,
    }
