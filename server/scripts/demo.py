"""실제 로컬 HTTP 시연. 서버/데이터는 종료 시 정리하고 운영 데이터는 건드리지 않는다."""
import base64
import io
import math
import os
from pathlib import Path
import socket
import struct
import subprocess
import sys
import tempfile
import time
import wave
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx

ROOT = Path(__file__).resolve().parents[1]


def run():
    with tempfile.TemporaryDirectory(prefix="aibom-demo-") as directory:
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        env = {**os.environ, "DB_URL": f"sqlite:///{directory}/demo.db", "DATA_DIR": directory + "/data", "ALLOW_LEGACY_API": "false"}
        for key in ("GROQ_API_KEY", "OPENAI_API_KEY", "FISH_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY", "STT_API_KEY"):
            env[key] = ""
        process = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)], cwd=ROOT, env=env, stdout=subprocess.DEVNULL)
        try:
            with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=30) as client:
                deadline = time.monotonic() + 45
                while True:
                    try:
                        if client.get("/health").status_code == 200:
                            break
                    except httpx.HTTPError:
                        pass
                    if process.poll() is not None or time.monotonic() > deadline:
                        raise RuntimeError("데모 서버 시작 실패")
                    time.sleep(.2)

                def call(method, path, token=None, expected=200, **kwargs):
                    response = client.request(method, "/api" + path, headers={"Authorization": f"Bearer {token}"} if token else {}, **kwargs)
                    assert response.status_code == expected, f"{method} {path}: {response.status_code} {response.text}"
                    return response.json()

                # 인증 없는 기존 임시 경로가 기본 비활성인지 확인한다.
                assert client.get("/profile/demo").status_code == 404
                assert client.get("/docs").status_code == 200
                assert "/api/auth/signup" in client.get("/openapi.json").json()["paths"]
                token = call("POST", "/auth/signup", expected=201, json={"email": uuid4().hex + "@example.com", "password": "aibom-demo-password", "display_name": "시연 부모"})["access_token"]
                child = call("POST", "/children", token, 201, json={"nickname": "봄이", "birth_month": "2023-04"})
                persona = call("POST", "/personas", token, 201, json={})
                call("POST", f'/personas/{persona["id"]}/confirm', token)
                call("PUT", f'/children/{child["id"]}/consents', token, json={"parent_biometrics": True, "child_signals": True})
                call("PUT", f'/children/{child["id"]}/settings', token, json={"window_start": "00:00", "window_end": "23:59", "daily_limit_minutes": 120})
                buffer = io.BytesIO()
                with wave.open(buffer, "wb") as output:
                    output.setnchannels(1)
                    output.setsampwidth(2)
                    output.setframerate(16000)
                    output.writeframes(bytes(16000) + b"".join(struct.pack("<h", int(9000 * math.sin(2 * math.pi * 220 * i / 16000))) for i in range(32000)))
                audio = buffer.getvalue()

                def upload(plan_id=None):
                    fields = {"persona_id": persona["id"], "purpose": "night_reading" if plan_id else "onboarding", "text": "사과! 함께 해보자."}
                    if plan_id:
                        fields["plan_id"] = plan_id
                    a = call("POST", f'/children/{child["id"]}/samples/audio-b64', token, 201,
                             json={**fields, "audio_b64": base64.b64encode(audio).decode(), "ext": "wav"})
                    m = call("POST", f'/children/{child["id"]}/samples/mouth', token, 201, json={**fields, "track": [{"t": i * .05, "open": .1, "width": .8} for i in range(30)]})
                    return {"audio_sample_id": a["sample"]["id"], "mouth_sample_id": m["sample"]["id"]}

                upload()
                code = call("POST", f'/children/{child["id"]}/pairing-codes', token, 201, json={"persona_id": persona["id"]})
                tablet = call("POST", "/tablet/pair", json={"code": code["code"]})
                device_token = tablet["access_token"]
                day = datetime.now(timezone(timedelta(hours=9))).date()

                def plan_for(day, number, feedback_id=None):
                    plan = call("POST", f'/children/{child["id"]}/plans', token, 201, json={"date": day.isoformat(), "day_number": number, "persona_id": persona["id"], "feedback_id": feedback_id})
                    return call("POST", f'/plans/{plan["id"]}/reading', token, json=upload(plan["id"]))

                plan = plan_for(day, 1)
                result = call("POST", "/tablet/sessions", device_token, 201, json={"plan_id": plan["id"]})
                session_id = result["session"]["id"]
                call("POST", f"/tablet/sessions/{session_id}/messages", device_token, json={"text": "사과"})
                call("POST", f"/tablet/sessions/{session_id}/messages", device_token, json={"text": "공룡은 어디 있어?"})
                call("POST", f"/tablet/sessions/{session_id}/events", device_token, 201, json={"content_id": "demo-apple", "sense": "tactile", "action": "bite"})
                call("POST", f"/tablet/sessions/{session_id}/end", device_token)
                report = call("GET", f'/children/{child["id"]}/report?date={day}', token)
                assert report["event_count"] == 1 and len(report["review_items"]) == 1
                call("POST", f'/children/{child["id"]}/evening-review', token, json={"date": day.isoformat()})
                feedback = call("POST", f'/children/{child["id"]}/feedback', token, 201, json={"for_date": day.isoformat(), "concerns": ["too_fast"]})
                tomorrow = plan_for(day + timedelta(days=1), 2, feedback["id"])
                assert tomorrow["pacing"] == "slow"
                call("POST", "/tablet/sessions", device_token, 409, json={"plan_id": tomorrow["id"]})
                home = call("GET", f'/children/{child["id"]}/home?date={day}&persona_id={persona["id"]}', token)
                assert all(home["evening_tasks"].values())
                call("DELETE", f'/devices/{tablet["device"]["id"]}', token)
                call("GET", "/tablet/context", device_token, 401)
                print("PASS: signup / real audio+mouth / pairing / plan+reading / session / report / feedback / next plan / revoke / OpenAPI")
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    run()
