from django.utils import timezone

STUDENT_SITUATIONS = {"초등학생", "중학생", "고등학생", "대학생"}

# 직장인으로 시작하면 직업을 모르므로 확인된 최저 기준인 최저임금 월 환산액을 쓴다
# (06 6절: 확인된 자료만).
# 실제 직업이 정해지면 jobOffer 의 직업별 급여 · 출처로 바뀐다.
MINIMUM_WAGE_SOURCE = {
    "url": "https://www.minimumwage.go.kr/",
    "checkedAt": "2026-11-01",
    "fact": "2026년 최저임금 시간급 10,320원, 주 40시간(월 209시간) 기준 월 환산액 2,156,880원",
}
MINIMUM_MONTHLY_WAGE = 2_156_880

# 게임 밸런스 v1 (2026-11-01, #132). 현실 통계가 아닌 게임 진행용 값이다.
# funds: 시작 잔액, housing: 주거, livingCost: 월 생활비, support: 가족 지원(용돈) 월액
_FAMILY = {"type": "family", "deposit": 0, "depositPaid": False, "monthlyRent": 0}
BASELINE = {
    "초등학생": {"funds": 30_000, "housing": _FAMILY, "livingCost": 0, "support": 30_000},
    "중학생": {"funds": 100_000, "housing": _FAMILY, "livingCost": 0, "support": 50_000},
    "고등학생": {"funds": 200_000, "housing": _FAMILY, "livingCost": 0, "support": 80_000},
    "대학생": {"funds": 500_000, "housing": _FAMILY, "livingCost": 500_000, "support": 500_000},
    "직장인": {
        "funds": 5_000_000,
        "housing": {
            "type": "monthlyRent",
            "deposit": 10_000_000,
            "depositPaid": True,
            "monthlyRent": 500_000,
        },
        "livingCost": 900_000,
        "support": 0,
    },
    "구직 중": {"funds": 2_000_000, "housing": _FAMILY, "livingCost": 500_000, "support": 200_000},
    "기타:adult": {
        "funds": 1_000_000,
        "housing": _FAMILY,
        "livingCost": 500_000,
        "support": 200_000,
    },
    "기타:minor": {"funds": 100_000, "housing": _FAMILY, "livingCost": 0, "support": 50_000},
}


def baseline(situation, age):
    if situation in BASELINE:
        return BASELINE[situation]
    return BASELINE["기타:adult" if age >= 19 else "기타:minor"]


def initial_state(profile):
    """최신 기획의 가상 상태. 상황별 밸런스 기준값으로 시작하고 성적은 추정하지 않는다."""
    student = profile["situation"] in STUDENT_SITUATIONS
    employed = profile["situation"] == "직장인"
    money = baseline(profile["situation"], profile["age"])
    return {
        "schemaVersion": 2,
        "profile": profile,
        "age": profile["age"],
        "elapsedDays": 0,
        "gameDate": timezone.localdate().isoformat(),
        "funds": money["funds"],
        "debt": 0,
        "health": 80,
        "energy": 70,
        "stress": 20,
        "housing": {**money["housing"], "livingCost": money["livingCost"]},
        "support": {"monthlyAmount": money["support"], "source": "family"},
        "development": {
            "kind": "grades" if student else "selfDevelopment",
            "value": None,
            "previousGrades": None,
        },
        "occupation": {
            "status": "student"
            if student
            else "employed"
            if employed
            else "searching"
            if profile["situation"] == "구직 중"
            else "undecided",
            "currentJob": None,
            "preparation": None,
            "monthlySalary": MINIMUM_MONTHLY_WAGE if employed else None,
            "salarySource": dict(MINIMUM_WAGE_SOURCE) if employed else None,
        },
        "relationship": {},
        # 관심 분야를 입력했다는 사실과 아직 평가하지 않은 5단계 수치를 구분한다.
        "interests": {field: None for field in profile.get("interests", [])},
        "experiences": [],
        "debts": [],
        "arrears": [],
    }
