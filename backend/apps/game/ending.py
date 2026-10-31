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


def get_or_generate_result(play):
    with transaction.atomic():
        locked = Play.objects.select_for_update().get(pk=play.pk)
        if not is_ended(locked):
            raise GameError(409, "NOT_ENDED", "아직 이야기가 끝나지 않았어요.")
        if locked.ending and ResultDataSerializer(data=locked.ending).is_valid():
            return locked.ending
        if locked.result and ResultDataSerializer(data=locked.result).is_valid():
            # 기존 데이터는 보존하며 명세의 ending 컬럼으로 이전한다.
            locked.ending = locked.result
            locked.save(update_fields=["ending"])
            return locked.result
        candidates, experienced = ending_candidates(locked)
        deadline = time.monotonic() + 30
        data = generate_ending(locked.state, candidates, experienced, deadline)
        if time.monotonic() > deadline:
            raise GameError(504, "TIMEOUT", "응답 시간이 초과되었습니다.")
        catalog = load_catalog()["experiences"]
        for job in data["recommendedJobs"]:
            job["basis"] = basis_for_job(locked, job["job"], catalog)
            job["isNew"] = job["job"] not in experienced
        if not any(job["isNew"] for job in data["recommendedJobs"]):
            raise GameError(502, "AI_UNAVAILABLE", "새 직업 추천이 필요합니다.")
        locked.result = data
        locked.ending = data
        locked.save(update_fields=["result", "ending"])
        return data
