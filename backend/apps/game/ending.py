import hashlib
import time

from django.db import transaction

from .ai import ending as generate_ending
from .catalog import load_catalog, overlaps
from .common import GameError, is_ended
from .models import Play
from .serializers import ResultDataSerializer


def ending_candidates(play):
    catalog = load_catalog()["experiences"]
    scenario_jobs = {row["scenarioId"]: row.get("jobs", []) for row in catalog}
    scores = {}
    experienced = set()

    def add(job, points, evidence):
        if not job:
            return
        item = scores.setdefault(job, {"job": job, "score": 0, "evidence": []})
        item["score"] += points
        if evidence not in item["evidence"]:
            item["evidence"].append(evidence)

    for experience in play.state.get("experiences", []):
        outcome = (experience.get("result") or {}).get("outcome")
        jobs = scenario_jobs.get(experience.get("scenarioId"), [])
        for job in jobs:
            if outcome == "completed":
                add(job, 5, "3D 체험 완료: " + experience["scenarioId"])
            elif outcome == "aborted":
                add(job, 2, "3D 체험 중단: " + experience["scenarioId"])
            if outcome in ("completed", "aborted", "failed"):
                experienced.add(job)
    interests = play.state.get("interests", [])
    for job in {job for row in catalog for job in row.get("jobs", [])}:
        if any(overlaps(interest, job) for interest in interests):
            add(job, 3, "흥미 기록: " + job)
    user_texts = [turn.input for turn in play.turns.all()]
    for job in {job for row in catalog for job in row.get("jobs", [])}:
        if any(overlaps(job, text) for text in user_texts):
            add(job, 2, "대화에서 관심 표현: " + job)
    dream = play.state.get("profile", {}).get("dreamJob")
    if dream:
        add(dream, 2, "처음 입력한 희망 직업")
    ordered = sorted(scores.values(), key=lambda item: (-item["score"], item["job"]))
    candidates = ordered[:5]
    if dream and all(item["job"] != dream for item in candidates):
        candidates = sorted(
            [*candidates[:4], scores[dream]], key=lambda item: (-item["score"], item["job"])
        )
    return candidates, sorted(experienced)


def basis_for_job(play, job, catalog):
    basis = []
    matching_scenarios = {
        row["scenarioId"]
        for row in catalog
        if any(overlaps(job, name) for name in row.get("jobs", []))
    }
    if any(
        item.get("scenarioId") in matching_scenarios
        and (item.get("result") or {}).get("outcome") in ("completed", "aborted")
        for item in play.state.get("experiences", [])
    ):
        basis.append("experience")
    if any(overlaps(job, turn.input) for turn in play.turns.all()):
        basis.append("conversation")
    if any(overlaps(str(interest), job) for interest in play.state.get("interests", [])):
        basis.append("interest")
    if overlaps(play.state.get("profile", {}).get("dreamJob", ""), job):
        basis.append("dreamJob")
    return basis


DEATH_CAUSE = {
    "zeroHealthSixMonths": "건강을 되찾지 못한 채",
    "overworkCollapse": "과로로 쓰러진 뒤",
}
OCCUPATION_TEXT = {
    "student": "학생으로 지냈어요",
    "searching": "일자리를 찾았어요",
    "preparing": "일을 준비했어요",
    "undecided": "앞으로의 길을 고민했어요",
}
AI_ENDING_SECONDS = 20


def interest_names(state):
    interests = state.get("interests") or []
    return (
        list(interests.keys()) if isinstance(interests, dict) else [str(item) for item in interests]
    )


def death_cause(play):
    event = play.game_events.filter(kind="death").order_by("game_date").last()
    if event:
        return (event.facts or {}).get("cause")
    for turn in play.turns.order_by("-number"):
        for item in (turn.response or {}).get("events", []):
            if item.get("kind") == "death":
                return (item.get("facts") or {}).get("cause")
    return None


def life_story(play, catalog):
    """저장된 기록만으로 살아온 인생을 읊는다 (10 7절). 기록에 없는 사실은 만들지 않는다."""
    state = play.state or {}
    profile = state.get("profile") or {}
    name = profile.get("name") or "당신"
    start_age = profile.get("age", state.get("age"))
    final_age = state.get("age", start_age)
    lines = []
    if start_age is not None and profile.get("situation"):
        lines.append(f"{name}은(는) {start_age}살 {profile['situation']}(으)로 인생을 시작했어요.")
    else:
        lines.append(f"{name}의 인생이 시작됐어요.")
    days = int(state.get("elapsedDays") or 0)
    if days >= 365:
        lines.append(f"그로부터 {days // 365}년 남짓한 시간을 살았어요.")
    elif days > 0:
        lines.append(f"그로부터 {days}일을 살았어요.")
    occupation = state.get("occupation") or {}
    if occupation.get("currentJob"):
        lines.append(f"{occupation['currentJob']}(으)로 일했어요.")
    elif occupation.get("preparation"):
        lines.append(f"{occupation['preparation']}을(를) 준비했어요.")
    elif OCCUPATION_TEXT.get(occupation.get("status")):
        lines.append(OCCUPATION_TEXT[occupation["status"]] + ".")
    titles = {row["scenarioId"]: row.get("title") for row in catalog}
    done = []
    for item in state.get("experiences", []):
        title = titles.get(item.get("scenarioId"))
        if title and title not in done and (item.get("result") or {}).get("outcome"):
            done.append(title)
    if done:
        listed = " · ".join(f"「{title}」" for title in done[:3])
        lines.append(f"{listed} 같은 일을 직접 해 봤어요.")
    interests = interest_names(state)
    if interests:
        lines.append(f"{', '.join(interests[:3])}에 관심을 두었어요.")
    if profile.get("dreamJob"):
        lines.append(f"처음에는 {profile['dreamJob']}이(가) 되고 싶다고 했어요.")
    cause = DEATH_CAUSE.get(death_cause(play))
    if cause and final_age is not None:
        lines.append(f"그리고 {cause} {final_age}살에 생을 마쳤어요.")
    elif final_age is not None:
        lines.append(f"그리고 {final_age}살에 이번 인생을 마쳤어요.")
    lines.append("이번 인생에서 관심을 보인 일과 다음에 경험해 볼 일을 정리했어요.")
    return " ".join(lines)


def backend_jobs(play, candidates, experienced, catalog):
    """근거 점수 후보로 추천 3개를 채운다. 새 직업이 1개 이상 들어가게 한다 (10 7절)."""
    state = play.state or {}
    hints = [*interest_names(state), (state.get("profile") or {}).get("dreamJob") or ""]
    all_jobs = sorted({job for row in catalog for job in row.get("jobs", [])})
    picked = [item["job"] for item in candidates]
    chosen = picked[:3]
    if not any(job not in experienced for job in chosen):
        related = [job for job in all_jobs if any(hint and overlaps(hint, job) for hint in hints)]
        digest = hashlib.sha256(str(play.pk).encode()).hexdigest()
        rotated = all_jobs[int(digest, 16) % len(all_jobs) :] + all_jobs if all_jobs else []
        new_job = next(
            (
                job
                for job in [*picked, *related, *rotated]
                if job not in experienced and job not in chosen
            ),
            None,
        )
        if new_job:
            chosen = [*chosen[:2], new_job]
    for job in all_jobs:
        if len(chosen) >= 3:
            break
        if job not in chosen:
            chosen.append(job)
    jobs = []
    for job in chosen[:3]:
        row = next((row for row in catalog if job in row.get("jobs", [])), None)
        basis = basis_for_job(play, job, catalog)
        reasons = []
        if "experience" in basis and row:
            reasons.append(f"이번 인생에서 「{row.get('title')}」 체험을 했어요.")
        if "conversation" in basis:
            reasons.append(f"대화에서 {job}에 관심을 보였어요.")
        if "interest" in basis:
            reasons.append("관심사와 이어지는 일이에요.")
        if "dreamJob" in basis:
            reasons.append("처음에 되고 싶다고 한 직업이에요.")
        if not reasons:
            reasons.append(
                "아직 경험하지 않은 일이라 다음 인생에서 해 볼 만해요."
                if job not in experienced
                else "이번 인생의 기록과 이어지는 일이에요."
            )
        if row and row.get("description"):
            work = f"3D 체험에서는 이런 일을 해요: {row['description']}"
        else:
            work = f"{job}이(가) 하는 일은 직업백과(커리어넷)에서 확인할 수 있어요."
        steps = []
        if row and row.get("title"):
            steps.append(f"「{row['title']}」 3D 체험 해 보기")
        steps.append(f"직업백과에서 {job}의 하는 일과 준비 방법 찾아보기")
        steps.append(f"다음 인생에서 {job}을(를) 목표로 시작해 보기")
        jobs.append(
            {
                "job": job,
                "isNew": job not in experienced,
                "basis": basis,
                "reason": " ".join(reasons),
                "work": work,
                "nextSteps": steps[:3],
            }
        )
    return jobs


def backend_result(play, candidates, experienced):
    catalog = load_catalog()["experiences"]
    return {
        "ending": life_story(play, catalog),
        "recommendedJobs": backend_jobs(play, candidates, experienced, catalog),
        "generatedBy": "backend",
    }


def ai_result(play, candidates, experienced):
    """AI 결말 (03 2-3). 실패하면 GameError 를 그대로 올린다."""
    deadline = time.monotonic() + AI_ENDING_SECONDS
    data = generate_ending(play.state, candidates, experienced, deadline)
    if time.monotonic() > deadline:
        raise GameError(504, "TIMEOUT", "응답 시간이 초과되었습니다.")
    catalog = load_catalog()["experiences"]
    for job in data["recommendedJobs"]:
        job["basis"] = basis_for_job(play, job["job"], catalog)
        job["isNew"] = job["job"] not in experienced
    if not any(job["isNew"] for job in data["recommendedJobs"]):
        raise GameError(502, "AI_UNAVAILABLE", "새 직업 추천이 필요합니다.")
    return data


def save_result(play, data):
    play.result = data
    play.ending = data
    play.save(update_fields=["result", "ending"])
    return data


def get_or_generate_result(play):
    with transaction.atomic():
        locked = Play.objects.select_for_update().get(pk=play.pk)
        if not is_ended(locked):
            raise GameError(409, "NOT_ENDED", "아직 이야기가 끝나지 않았어요.")
        cached = None
        if locked.ending and ResultDataSerializer(data=locked.ending).is_valid():
            cached = locked.ending
        elif locked.result and ResultDataSerializer(data=locked.result).is_valid():
            # 기존 데이터는 보존하며 명세의 ending 컬럼으로 이전한다.
            locked.ending = locked.result
            locked.save(update_fields=["ending"])
            cached = locked.result
        if cached and cached.get("generatedBy") != "backend":
            return cached
        candidates, experienced = ending_candidates(locked)
        try:
            # AI 결말이 되면 AI 문장을 쓴다. 백엔드 결말을 저장해 둔 경우에도 다시 시도해 교체한다
            return save_result(locked, ai_result(locked, candidates, experienced))
        except GameError as error:
            if error.status_code not in (502, 503, 504):
                raise
        # AI 결말 API 가 없거나 실패: 저장된 기록으로 만든 결말 (10 7절, 결정 28)
        if cached:
            return cached
        return save_result(locked, backend_result(locked, candidates, experienced))
