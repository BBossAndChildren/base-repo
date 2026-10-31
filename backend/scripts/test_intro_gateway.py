import json
import pathlib
import struct
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import uuid

repo = pathlib.Path(__file__).resolve().parents[2]
container_name = "intro-check-" + uuid.uuid4().hex[:10]
with tempfile.TemporaryDirectory(prefix="intro-http-test-") as directory:
    root = pathlib.Path(directory)
    (root / "models").mkdir()
    rooms = []
    # HTTP 헤더·파일 제공 테스트 전용. 실제 3D 모델이 아니며 저장소/운영에 배치하지 않는다.
    for number in range(1, 72):
        name = f"PAN-{number:03d}"
        (root / "models" / (name + ".glb")).write_bytes(struct.pack("<4sII", b"glTF", 2, 12))
        rooms.append({"roomId": name, "src": "models/" + name + ".glb"})
    (root / "intro.json").write_text(
        json.dumps({"rooms": rooms, "cues": [], "duration_seconds": 24})
    )
    subprocess.run(
        ["python3", str(repo / "backend/scripts/check_intro_assets.py"), str(root)], check=True
    )
    subprocess.run(
        [
            "docker",
            "run",
            "--rm",
            "-d",
            "--name",
            container_name,
            "--add-host",
            "backend:127.0.0.1",
            "-p",
            "127.0.0.1::80",
            "-v",
            str(repo / "backend/deploy/nginx.conf") + ":/etc/nginx/conf.d/default.conf:ro",
            "-v",
            directory + ":/srv/intro-assets:ro",
            "nginx:alpine",
        ],
        check=True,
        capture_output=True,
    )
    try:
        port = (
            subprocess.run(
                ["docker", "port", container_name, "80"], check=True, text=True, capture_output=True
            )
            .stdout.strip()
            .rsplit(":", 1)[1]
        )
        base_url = "http://127.0.0.1:" + port
        subprocess.run(["docker", "exec", container_name, "nginx", "-t"], check=True)
        for attempt in range(20):
            try:
                with urllib.request.urlopen(
                    urllib.request.Request(
                        base_url + "/intro-assets/intro.json",
                        headers={"Origin": "https://base-repo-zeta.vercel.app"},
                    ),
                    timeout=2,
                ) as response:
                    assert len(json.load(response)["rooms"]) == 71
                    assert response.headers["Content-Type"].startswith("application/json")
                    assert (
                        response.headers["Access-Control-Allow-Origin"]
                        == "https://base-repo-zeta.vercel.app"
                    )
                    assert response.headers["Vary"] == "Origin"
                    assert response.headers["Cache-Control"] == "public, max-age=604800"
                break
            except OSError:
                if attempt == 19:
                    raise
                time.sleep(0.1)
        # 허용 목록의 다른 Vercel 주소는 그 출처를, 목록에 없는 출처는 CORS 헤더 없이 응답한다
        for origin, expected_origin in [
            ("https://base-repo-ck83.vercel.app", "https://base-repo-ck83.vercel.app"),
            ("https://evil.example", None),
        ]:
            with urllib.request.urlopen(
                urllib.request.Request(
                    base_url + "/intro-assets/intro.json", headers={"Origin": origin}
                )
            ) as response:
                allowed = response.headers.get("Access-Control-Allow-Origin")
                assert allowed == expected_origin, origin
        for number in (1, 71):
            with urllib.request.urlopen(
                f"{base_url}/intro-assets/models/PAN-{number:03d}.glb"
            ) as response:
                assert response.headers["Content-Type"] == "model/gltf-binary"
                assert response.read().startswith(b"glTF")
        for path, method, expected in [
            ("/intro-assets/missing.glb", "GET", 404),
            ("/intro-assets/", "GET", 403),
            ("/intro-assets/intro.json", "POST", 403),
        ]:
            try:
                urllib.request.urlopen(urllib.request.Request(base_url + path, method=method))
                raise AssertionError("expected rejection")
            except urllib.error.HTTPError as error:
                assert error.code == expected, (path, error.code)
                if error.code == 404:
                    assert not error.headers.get("Cache-Control")
        print(
            "Nginx syntax + JSON/GLB HTTP + CORS/cache + missing/directory/write rejection: "
            "PASS (test fixture only)"
        )
    finally:
        subprocess.run(["docker", "stop", container_name], check=True, capture_output=True)
