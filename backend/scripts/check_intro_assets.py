"""전달받은 실제 에셋의 구조를 확인한다. 모델이나 intro.json을 생성하지 않는다."""

import argparse
import json
import struct
from pathlib import Path


def validate(root):
    root = Path(root).resolve()
    config = json.loads((root / "intro.json").read_text(encoding="utf-8"))
    rooms = config.get("rooms", [])
    expected = {f"PAN-{number:03d}" for number in range(1, 72)}
    if len(rooms) != 71 or {row.get("roomId") for row in rooms} != expected:
        raise ValueError("인트로 방 71개(PAN-001~071)가 필요합니다")
    total = 0
    for room in rooms:
        path = (root / room["src"]).resolve()
        if not path.is_relative_to(root) or path.suffix.lower() != ".glb":
            raise ValueError("에셋 경로 오류")
        content = path.read_bytes()
        if len(content) < 12:
            raise ValueError(f"GLB 헤더 누락: {room['roomId']}")
        magic, version, length = struct.unpack("<4sII", content[:12])
        if magic != b"glTF" or version != 2 or length != len(content):
            raise ValueError(f"GLB 형식 오류: {room['roomId']}")
        total += len(content)
    return len(rooms), total


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    try:
        count, size = validate(args.directory)
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, f"인트로 에셋 확인 실패: {error}\n")
    print(f"인트로 에셋 {count}개 확인, {size} bytes (GLB 헤더 검증; 실제 WebGL 재생 검증은 별도)")
