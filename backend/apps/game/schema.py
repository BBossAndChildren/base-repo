"""런타임의 조건부 필수 입력을 OpenAPI 3.0에도 표시한다."""


def describe_start_conditions(result, generator, request, public):
    schema = result.get("components", {}).get("schemas", {}).get("StartPlay")
    if schema is not None:
        schema["oneOf"] = [
            {
                "title": "희망 직업 있음",
                "properties": {
                    "hasDreamJob": {"type": "boolean", "enum": [True]},
                    "dreamJob": {"type": "string", "minLength": 1, "pattern": r"\S"},
                },
                "required": ["hasDreamJob", "dreamJob"],
            },
            {
                "title": "희망 직업 없음",
                "properties": {
                    "hasDreamJob": {"type": "boolean", "enum": [False]},
                    "dreamJob": {"type": "string", "pattern": r"^\s*$"},
                },
                "required": ["hasDreamJob"],
            },
        ]
    return result
