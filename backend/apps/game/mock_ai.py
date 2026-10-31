import hmac
import json
from http.server import BaseHTTPRequestHandler


def make_handler(key):
    class MockHandler(BaseHTTPRequestHandler):
        def reply(self, status, payload):
            body = json.dumps(payload, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            self.reply(200 if self.path == "/health" else 404, {"mode": "mock", "realModel": False})

        def do_POST(self):
            if not hmac.compare_digest(self.headers.get("X-Internal-Key", ""), key):
                self.reply(401, {"error": "UNAUTHORIZED"})
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 1_000_000:
                    raise ValueError
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    raise ValueError
                if self.path == "/ai/v1/chat":
                    if (
                        not isinstance(data.get("input"), str)
                        or not data.get("guidelines")
                        or not data.get("scenario")
                    ):
                        raise ValueError
                    message = data["input"]
                    payload = {
                        "messages": [
                            {
                                "role": "npc",
                                "speaker": "테스트 AI",
                                "text": "[테스트 서버 · 실제 모델 아님] " + message,
                            }
                        ],
                        "stateChanges": [],
                        "hints": [],
                        "branch": {"topic": "테스트 분기", "jobs": [], "reason": "테스트"}
                        if message == "테스트 3D"
                        else None,
                        "lifeEnded": message == "테스트 종료",
                        "actions": [
                            {
                                "kind": "advance",
                                "days": 1,
                                "activity": "idle",
                                "evidenceQuote": message,
                            }
                        ]
                        if message == "테스트 종료"
                        else [],
                    }
                elif self.path == "/ai/v1/experience-recommendation":
                    candidates = data.get("candidates", [])
                    if not candidates:
                        payload = {"found": False}
                    else:
                        choice = candidates[0]
                        payload = {
                            "found": True,
                            "buildId": choice["buildId"],
                            "roomId": choice["roomId"],
                            "scenarioId": choice["scenarioId"],
                            "scenarioVersion": choice["scenarioVersion"],
                            "reason": "테스트 서버의 고정 선택",
                        }
                elif self.path == "/ai/v1/ending":
                    if not data.get("guidelines") or not isinstance(data.get("candidates"), list):
                        raise ValueError
                    names = [item["job"] for item in data["candidates"][:3]]
                    for fallback in ("테스트 직업 A", "테스트 직업 B", "테스트 직업 C"):
                        if len(names) >= 3:
                            break
                        if fallback not in names:
                            names.append(fallback)
                    experienced = set(data.get("experiencedJobs", []))
                    payload = {
                        "ending": "[테스트 서버 · 실제 모델 아님] 이번 플레이 결과",
                        "recommendedJobs": [
                            {
                                "job": name,
                                "isNew": name not in experienced,
                                "basis": [],
                                "reason": "테스트용 추천",
                                "work": "테스트용 직업 설명",
                                "nextSteps": ["테스트 단계 1", "테스트 단계 2"],
                            }
                            for name in names
                        ],
                    }
                else:
                    self.reply(404, {"error": "NOT_FOUND"})
                    return
                self.reply(200, {"code": 200, "data": payload})
            except (ValueError, KeyError, IndexError, TypeError):
                self.reply(400, {"error": "INVALID_INPUT"})

        def log_message(self, format, *args):
            pass

    return MockHandler
