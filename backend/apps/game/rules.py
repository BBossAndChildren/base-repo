"""가상 인물 규칙. AI는 행동을 제안하고 금액·기간·사망은 서버가 계산한다."""

import calendar
import copy
import hashlib
import hmac
import random
import re
from datetime import date, timedelta
from urllib.parse import urlparse

from django.conf import settings

from .state import initial_state

# 노화 (#132): 생일마다 건강 감소. (이 나이 이상, 감소량) — 높은 구간부터 찾는다
AGING_HEALTH_LOSS = ((95, 20), (85, 10), (75, 6), (65, 3))


# 건강 회복 (#141): 스트레스 50 미만 · 과로 아닌 날을 회복일로 쌓고 30일마다 건강 +2.
# 휴일은 2일, 휴가일은 3일로 센다. 상한은 시작 건강 80 에서 나이별 노화 감소를 뺀 값.
HEALTH_BASELINE = 80
RECOVERY_DAYS = 30
RECOVERY_GAIN = 2
RECOVERY_WEIGHT = {"holiday": 2, "vacation": 3}


def aging_loss(age):
    return next((loss for minimum, loss in AGING_HEALTH_LOSS if age >= minimum), 0)


def health_ceiling(age):
    """자연 회복 건강 상한. 65세부터 그 나이까지의 노화 감소를 뺀 값 (시작 나이와 무관)"""
    return max(0, HEALTH_BASELINE - sum(aging_loss(year) for year in range(65, age + 1)))


class RuleViolation(ValueError):
    pass


def integer(value, minimum=0, maximum=10**15):
    if type(value) is not int or not minimum <= value <= maximum:
        raise RuleViolation("정수 범위 오류")
    return value


def text(value, maximum=500):
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise RuleViolation("문자열 오류")
    return value


def source(value):
    if not isinstance(value, dict):
        raise RuleViolation("확인 가능한 직업 자료 출처가 필요합니다")
    url = urlparse(text(value.get("url")))
    if url.scheme not in {"http", "https"} or not url.hostname:
        raise RuleViolation("출처 URL 오류")
    date.fromisoformat(text(value.get("checkedAt")))
    text(value.get("fact"), 2000)
    return value


def add_months(day, count):
    number = day.year * 12 + day.month - 1 + count
    year, month = divmod(number, 12)
    return date(year, month + 1, min(day.day, calendar.monthrange(year, month + 1)[1]))


def seed_rng(key):
    seed = hmac.new(settings.SECRET_KEY.encode(), str(key).encode(), hashlib.sha256).digest()
    return random.Random(seed)


def evolve(state, progress, actions, message, key, rng=None):
    state, progress = copy.deepcopy(state), copy.deepcopy(progress)
    if state.get("schemaVersion") != 2:
        profile = state.get("profile", {})
        # 예전 추상 수치를 원화나 5단계 흥미로 오인하지 않는다. 원본은 비공개 보존.
        progress.setdefault("legacyState", copy.deepcopy(state))
        baseline = initial_state({"age": state.get("age", 15), "situation": "기타", **profile})
        for field in ("experiences", "relationship"):
            baseline[field] = state.get(field, baseline[field])
        state = baseline
    rng = rng or seed_rng(key)
    events = []
    pending = []
    ended = False
    today = date.fromisoformat(state["gameDate"])
    progress.setdefault("originDate", today.isoformat())
    progress.setdefault("originAge", state["age"])
    progress.setdefault("settledMonths", [])
    progress.setdefault("ledger", [])
    progress.setdefault("stressFactors", [])
    progress.setdefault("overwork", False)
    progress.setdefault("recoveryDays", 0)

    def event(kind, facts, actors=None):
        item = {
            "id": f"{key}:{len(events)}",
            "kind": kind,
            "gameDate": state["gameDate"],
            "actors": actors or [],
            "facts": facts,
            "sourceAction": str(key),
        }
        events.append(item)
        return item

    def ledger(kind, amount, entry_id):
        if any(row["id"] == entry_id for row in progress["ledger"]):
            return
        progress["ledger"].append(
            {
                "id": entry_id,
                "kind": kind,
                "amount": amount,
                "gameDate": state["gameDate"],
                "sourceAction": str(key),
            }
        )
        state["funds"] += amount

    def bounds():
        for field in ("health", "energy", "stress"):
            state[field] = max(0, min(100, state[field]))

    def pay(amount, kind, identity, creditor="생활비"):
        amount = integer(amount)
        available = min(state["funds"], amount)
        ledger(kind, -available, identity)
        if available < amount:
            arrear = {
                "id": identity,
                "creditor": creditor,
                "amount": amount - available,
                "gameDate": state["gameDate"],
            }
            state["arrears"].append(arrear)
            event("paymentDue", arrear)
            pending.append(
                {
                    "kind": "insufficientFunds",
                    "amount": amount - available,
                    "options": ["대출 알아보기", "지인에게 도움 요청", "지출 미루기", "계획 변경"],
                }
            )
            return False
        return True

    def monthly(day):
        origin = date.fromisoformat(progress["originDate"])
        month_number = (day.year - origin.year) * 12 + day.month - origin.month
        if month_number < 1 or day != add_months(origin, month_number):
            return
        month = day.isoformat()
        if month in progress["settledMonths"]:
            return
        support = state.setdefault("support", {"monthlyAmount": 0, "source": "family"})
        change = progress.get("supportChange")
        if change and day >= date.fromisoformat(change["effectiveFrom"]):
            # 미리 알린 가족 지원 변경은 알린 다음 달 정산부터 적용한다 (06 5절)
            event(
                "supportChanged",
                {"from": support["monthlyAmount"], "to": change["monthlyAmount"]},
            )
            support["monthlyAmount"] = change["monthlyAmount"]
            progress.pop("supportChange")
        if support["monthlyAmount"]:
            ledger("familySupport", integer(support["monthlyAmount"]), "support:" + month)
        occupation = state["occupation"]
        salary = occupation.get("monthlySalary")
        if occupation["status"] == "employed" and salary is not None:
            source(occupation.get("salarySource"))
            ledger("salary", integer(salary), "salary:" + month)
        housing = state["housing"]
        rent = housing["monthlyRent"] if housing["type"] == "monthlyRent" else 0
        pay(rent + housing["livingCost"], "monthlyExpenses", "expenses:" + month)
        progress["settledMonths"].append(month)
        event(
            "monthlySettlement",
            {
                "month": month,
                "funds": state["funds"],
                "arrears": sum(row["amount"] for row in state["arrears"]),
            },
        )

    def recover(activity):
        ceiling = health_ceiling(state["age"])
        if state["stress"] >= 50 or progress["overwork"] or state["health"] >= ceiling:
            progress["healthRecoveryDays"] = 0
            return
        days = progress.get("healthRecoveryDays", 0) + RECOVERY_WEIGHT.get(activity, 1)
        if days >= RECOVERY_DAYS:
            days -= RECOVERY_DAYS
            gain = min(RECOVERY_GAIN, ceiling - state["health"])
            state["health"] += gain
            event("healthRecovered", {"healthGain": gain, "ceiling": ceiling})
        progress["healthRecoveryDays"] = days

    def health_and_pressure(day, fatigue):
        nonlocal ended
        if state["stress"] >= 70:
            since = date.fromisoformat(progress.setdefault("highStressSince", day.isoformat()))
            count = progress.get("highStressMonths", 0)
            if day >= add_months(since, count + 1):
                count += 1
                loss = (
                    5
                    + (2 if len(set(progress["stressFactors"])) >= 2 else 0)
                    + (2 if count >= 2 else 0)
                )
                state["health"] -= loss
                progress["highStressMonths"] = count
                event("highStress", {"healthLoss": loss, "consecutiveMonths": count})
        else:
            progress.pop("highStressSince", None)
            progress["highStressMonths"] = 0
        bounds()
        if state["health"] == 0:
            since = date.fromisoformat(progress.setdefault("zeroHealthSince", day.isoformat()))
            if day >= add_months(since, 6):
                ended = True
                event("death", {"cause": "zeroHealthSixMonths"})
        else:
            progress.pop("zeroHealthSince", None)
        if state["energy"] < 30:
            progress["overwork"] = True
            progress["recoveryDays"] = 0
        elif progress["overwork"]:
            progress["recoveryDays"] += 1
            if progress["recoveryDays"] >= 7:
                progress["overwork"] = False
        if fatigue and state["energy"] < 30:
            energy = state["energy"]
            probability = (
                1 if energy == 0 else 0.20 if energy < 10 else 0.10 if energy < 20 else 0.05
            )
            if rng.random() < probability:
                died = rng.random() < 0.01
                event("collapse", {"energy": energy, "died": died})
                if died:
                    ended = True
                    event("death", {"cause": "overworkCollapse"})
                else:
                    state["energy"] = 30
                    pending.append({"kind": "hospitalRecovery", "options": ["휴식하기"]})
        occupation = state["occupation"]
        idle = (
            state["age"] >= 19
            and occupation["status"] == "undecided"
            and not occupation.get("preparation")
        )
        if idle:
            since = date.fromisoformat(progress.setdefault("idleSince", day.isoformat()))
            last = date.fromisoformat(progress.get("lastPressureDate", since.isoformat()))
            if day >= add_months(since, 3) and day >= add_months(last, 3):
                pressure = rng.randint(1, 5)
                state["stress"] += pressure
                progress["lastPressureDate"] = day.isoformat()
                event("familyPressure", {"stress": pressure})
                pending.append(
                    {
                        "kind": "familyPressure",
                        "options": ["상황 설명", "구직 알아보기", "준비 계획 이야기"],
                    }
                )
        else:
            progress.pop("idleSince", None)
        bounds()

    for index, action in enumerate(actions):
        if pending or ended:
            break
        if not isinstance(action, dict):
            raise RuleViolation("행동 객체 오류")
        kind = action.get("kind")
        quote = text(action.get("evidenceQuote"), 10000)
        if quote not in message:
            raise RuleViolation("사용자 행동 근거가 없습니다")
        identity = f"{key}:action:{index}"
        if kind == "advance":
            days = integer(action.get("days"), 1, 3660)
            activity = action.get("activity")
            if activity not in {
                "work",
                "overtime",
                "holiday",
                "vacation",
                "study",
                "jobSearch",
                "prepare",
                "idle",
            }:
                raise RuleViolation("활동 유형 오류")
            if activity in {"work", "overtime"} and state["occupation"]["status"] not in {
                "employed",
                "student",
            }:
                raise RuleViolation("근무 근거가 없습니다")
            if days >= 365 and progress.get("confirmedAdvance") != {
                "days": days,
                "activity": activity,
            }:
                pending.append(
                    {
                        "kind": "confirmAdvance",
                        "days": days,
                        "activity": activity,
                        "options": ["기간 진행 확인", "기간 변경"],
                    }
                )
                continue
            if activity in {"prepare", "jobSearch"} and state["occupation"]["status"] not in {
                "employed",
                "student",
            }:
                state["occupation"]["status"] = (
                    "preparing" if activity == "prepare" else "searching"
                )
            for _ in range(days):
                today += timedelta(days=1)
                state["gameDate"] = today.isoformat()
                state["elapsedDays"] += 1
                origin = date.fromisoformat(progress["originDate"])
                years = today.year - origin.year
                previous_age = state["age"]
                state["age"] = (
                    progress["originAge"] + years - (today < add_months(origin, years * 12))
                )
                if state["age"] > previous_age and aging_loss(state["age"]):
                    loss = aging_loss(state["age"])
                    state["health"] -= loss
                    event("aging", {"age": state["age"], "healthLoss": loss})
                energy, stress = {
                    "work": (-3, 1),
                    "overtime": (-8, 4),
                    "holiday": (5, -2),
                    "vacation": (15, -8),
                }.get(activity, (0, 0))
                state["energy"] += energy
                state["stress"] += stress
                bounds()
                monthly(today)
                recover(activity)
                health_and_pressure(today, activity in {"work", "overtime"})
                if pending or ended:
                    break
            progress.pop("confirmedAdvance", None)
            event(
                "timePassed",
                {"requestedDays": days, "through": today.isoformat(), "activity": activity},
            )
        elif kind == "confirmAdvance":
            previous = progress.get("pendingChoices", [])
            choice = next((row for row in previous if row["kind"] == "confirmAdvance"), None)
            if not choice or not re.search(r"확인|진행|좋아|네|응|할게", message):
                raise RuleViolation("긴 기간 진행의 앞선 제안과 확인이 필요합니다")
            progress["confirmedAdvance"] = {"days": choice["days"], "activity": choice["activity"]}
        elif kind == "loan":
            # 새 부채는 앞서 제시한 구체적인 조건을 사용자가 수락한 경우만 생성한다.
            if not re.search(r"수락|빌릴|빌려|대출|좋아|네|응", message):
                raise RuleViolation("대출 수락의 명시적인 선택이 필요합니다")
            offer = progress.get("pendingOffer")
            if not offer or offer.get("kind") != "loan" or action.get("offerId") != offer.get("id"):
                raise RuleViolation("대출 조건의 사전 제안이 필요합니다")
            amount = integer(offer["amount"], 1)
            creditor = text(offer["creditor"])
            state["debts"].append(
                {"id": identity, "creditor": creditor, "balance": amount, "sourceAction": str(key)}
            )
            ledger("loan", amount, identity)
            progress.pop("pendingOffer")
            event("loan", {"amount": amount, "creditor": creditor})
        elif kind == "repay":
            debt = next((row for row in state["debts"] if row["id"] == action.get("debtId")), None)
            if debt is None:
                raise RuleViolation("부채를 찾을 수 없습니다")
            amount = integer(action.get("amount"), 1, debt["balance"])
            if state["funds"] < amount:
                pending.append(
                    {
                        "kind": "insufficientFunds",
                        "amount": amount - state["funds"],
                        "options": ["상환 계획 변경", "채권자와 대화"],
                    }
                )
            else:
                ledger("repayment", -amount, identity)
                debt["balance"] -= amount
                event("repayment", {"debtId": debt["id"], "amount": amount})
        elif kind == "settleArrear":
            arrear = next(
                (row for row in state["arrears"] if row["id"] == action.get("arrearId")), None
            )
            if not arrear:
                raise RuleViolation("미납 근거가 없습니다")
            amount = min(state["funds"], arrear["amount"])
            ledger("arrearPayment", -amount, identity)
            arrear["amount"] -= amount
            state["arrears"] = [row for row in state["arrears"] if row["amount"]]
            event("arrearPayment", {"amount": amount, "arrearId": arrear["id"]})
        elif kind in {"jobOffer", "housingOffer", "loanOffer"}:
            offer = copy.deepcopy(action)
            offer["id"] = identity
            if kind == "jobOffer":
                text(offer.get("job"))
                integer(offer.get("monthlySalary"))
                source(offer.get("source"))
                offer["kind"] = "job"
            elif kind == "housingOffer":
                if offer.get("type") not in {"monthlyRent", "jeonse", "owned", "family"}:
                    raise RuleViolation("주거 유형 오류")
                for field in ("deposit", "monthlyRent", "livingCost"):
                    integer(offer.get(field))
                offer["kind"] = "housing"
            else:
                integer(offer.get("amount"), 1)
                text(offer.get("creditor"))
                offer["kind"] = "loan"
            progress["pendingOffer"] = offer
            pending.append(
                {"kind": "offer", "offer": offer, "options": ["수락", "거절", "조건 질문"]}
            )
            event("offer", offer)
        elif kind in {"acceptJob", "acceptHousing", "quitJob"}:
            if not re.search(r"수락|할게|하겠|좋아|네|응|퇴사|그만|이사", message):
                raise RuleViolation("중요한 결정의 명시적인 선택이 필요합니다")
            offer = progress.get("pendingOffer")
            if kind == "quitJob":
                if state["occupation"]["status"] != "employed":
                    raise RuleViolation("현재 직업이 없습니다")
                old = copy.deepcopy(state["occupation"])
                state["occupation"].update(
                    status="undecided", currentJob=None, monthlySalary=None, salarySource=None
                )
                event("quitJob", {"previousJob": old})
            else:
                target = "job" if kind == "acceptJob" else "housing"
                if not offer or offer["kind"] != target or offer["id"] != action.get("offerId"):
                    raise RuleViolation("앞선 제안과 일치하는 선택이 필요합니다")
                if kind == "acceptJob":
                    if state["occupation"]["status"] == "employed" and state["occupation"].get(
                        "currentJob"
                    ):
                        raise RuleViolation("기존 일을 마무리해야 합니다")
                    state["occupation"].update(
                        status="employed",
                        currentJob=offer["job"],
                        monthlySalary=offer["monthlySalary"],
                        salarySource=source(offer["source"]),
                    )
                    if state["development"]["kind"] == "grades":
                        state["development"].update(
                            kind="selfDevelopment", previousGrades=state["development"]["value"]
                        )
                else:
                    deposit = offer["deposit"]
                    if state["funds"] < deposit:
                        pending.append(
                            {
                                "kind": "insufficientFunds",
                                "amount": deposit - state["funds"],
                                "options": ["주거 계획 변경", "자금 마련"],
                            }
                        )
                        continue
                    ledger("housingDeposit", -deposit, "deposit:" + offer["id"])
                    state["housing"] = {
                        field: offer[field]
                        for field in ("type", "deposit", "monthlyRent", "livingCost")
                    }
                    state["housing"]["depositPaid"] = True
                progress.pop("pendingOffer")
                event(kind, {"offerId": offer["id"]})
        elif kind == "development":
            value = integer(action.get("value"), 0, 100)
            if not any(
                word in message for word in ("공부", "학습", "연습", "교육", "훈련", "자기계발")
            ):
                raise RuleViolation("학습 경험 근거가 필요합니다")
            state["development"]["value"] = value
            event("learning", {"value": value, "kind": state["development"]["kind"]})
        elif kind == "supportChange":
            # 가족 지원이 줄거나 끊기면 대화로 먼저 알리고 다음 달부터 적용한다 (06 5절)
            amount = integer(action.get("monthlyAmount"), 0, 10**9)
            effective = add_months(today, 1)
            progress["supportChange"] = {
                "monthlyAmount": amount,
                "effectiveFrom": effective.isoformat(),
            }
            event(
                "supportNotice",
                {
                    "from": state.get("support", {}).get("monthlyAmount", 0),
                    "to": amount,
                    "effectiveFrom": effective.isoformat(),
                },
            )
        elif kind == "stressFactors":
            factors = action.get("factors")
            if not isinstance(factors, list) or len(factors) > 20:
                raise RuleViolation("스트레스 요인 오류")
            progress["stressFactors"] = list(dict.fromkeys(text(value) for value in factors))
        else:
            raise RuleViolation("허용되지 않은 가상 행동")
    state["debt"] = sum(row["balance"] for row in state["debts"])
    if state["funds"] < 0:
        raise RuleViolation("자금은 마이너스가 될 수 없습니다")
    if not actions:
        pending = progress.get("pendingChoices", [])
    progress["pendingChoices"] = pending
    return state, progress, events, pending, ended
