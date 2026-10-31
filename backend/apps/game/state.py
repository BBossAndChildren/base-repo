from django.utils import timezone

STUDENT_SITUATIONS = {"초등학생", "중학생", "고등학생", "대학생"}


def initial_state(profile):
    """최신 기획의 가상 상태. 미확정 자산·급여·성적을 추정하지 않는다."""
    student = profile["situation"] in STUDENT_SITUATIONS
    return {
        "schemaVersion": 2,
        "profile": profile,
        "age": profile["age"],
        "elapsedDays": 0,
        "gameDate": timezone.localdate().isoformat(),
        "funds": 0,
        "debt": 0,
        "health": 80,
        "energy": 70,
        "stress": 20,
        "housing": {
            "type": "unknown",
            "deposit": 0,
            "depositPaid": False,
            "monthlyRent": 0,
            "livingCost": 0,
        },
        "development": {
            "kind": "grades" if student else "selfDevelopment",
            "value": None,
            "previousGrades": None,
        },
        "occupation": {
            "status": "student"
            if student
            else "employed"
            if profile["situation"] == "직장인"
            else "searching"
            if profile["situation"] == "구직 중"
            else "undecided",
            "currentJob": None,
            "preparation": None,
            "monthlySalary": None,
            "salarySource": None,
        },
        "relationship": {},
        # 관심 분야를 입력했다는 사실과 아직 평가하지 않은 5단계 수치를 구분한다.
        "interests": {field: None for field in profile.get("interests", [])},
        "experiences": [],
        "debts": [],
        "arrears": [],
    }
