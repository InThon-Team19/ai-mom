"""입력 파이프라인 테스트 — 담당: 태희.  실행: cd server && pytest -q"""
import io
import os
import tempfile
import wave
import pytest

os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="aibom-test-")  # 실제 데이터와 분리

import cv2  # noqa: E402
import numpy as np  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.routers.activity import summarize  # noqa: E402
from app.routers.voice import match_expected  # noqa: E402
from app.vision import landmarks as L  # noqa: E402
from app.vision.profile import merge, profile  # noqa: E402
from app.voice.analysis import coaching, traits_and_tips  # noqa: E402
from app.voice.audio import quality, speech_features  # noqa: E402

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def authenticate_input_pipeline():
    """Pipeline regression tests use a real parent token and owned children."""
    from app.auth import issue_token, password_hash
    from app.db import engine, init_db
    from app.models import Child, Parent
    from sqlmodel import Session
    init_db()
    with Session(engine) as db:
        parent = Parent(email="pipeline@example.com", display_name="부모", password_hash=password_hash("pipeline-password"))
        db.add(parent)
        db.flush()
        for child_id in ("pytest", "pyb64", "LINKME"):
            db.add(Child(id=child_id, parent_id=parent.id, nickname="아이", birth_month="2023-01", speech_level="single_words"))
        token = issue_token(db, parent.id)["access_token"]
        db.commit()
    client.headers["Authorization"] = "Bearer " + token
    yield
    client.headers.pop("Authorization", None)


def fake_face(open_gap=0.0, nose_x=0.5, iris_shift=0.0) -> np.ndarray:
    """정면 얼굴 랜드마크를 손으로 만든 것 (필요한 점만)."""
    lm = np.full((478, 3), 0.5, dtype=np.float32)
    lm[L.EYE_OUTER_R, :2] = (0.35, 0.4)
    lm[L.EYE_INNER_R, :2] = (0.45, 0.4)
    lm[L.EYE_INNER_L, :2] = (0.55, 0.4)
    lm[L.EYE_OUTER_L, :2] = (0.65, 0.4)
    lm[L.IRIS_R, :2] = (0.40 + iris_shift, 0.4)
    lm[L.IRIS_L, :2] = (0.60 + iris_shift, 0.4)
    lm[L.CHEEK_R, :2] = (0.30, 0.5)
    lm[L.CHEEK_L, :2] = (0.70, 0.5)
    lm[L.FOREHEAD, :2] = (0.5, 0.2)
    lm[L.CHIN, :2] = (0.5, 0.8)
    lm[L.NOSE, :2] = (nose_x, 0.52)
    lm[L.MOUTH_L, :2] = (0.44, 0.65)
    lm[L.MOUTH_R, :2] = (0.56, 0.65)
    lm[L.LIP_UPPER, :2] = (0.5, 0.65 - open_gap / 2)
    lm[L.LIP_LOWER, :2] = (0.5, 0.65 + open_gap / 2)
    return lm


# ---------- 순수 함수 ----------
def test_mouth_open_scales_with_gap():
    assert L.mouth_metrics(fake_face(0.0))["open"] == 0.0
    assert abs(L.mouth_metrics(fake_face(0.06))["open"] - 0.2) < 1e-3  # 0.06 / 눈 사이 0.3


def test_gaze_front_vs_turned():
    assert L.gaze_metrics(fake_face())["looking"] is True
    assert L.gaze_metrics(fake_face(nose_x=0.64))["looking"] is False   # 고개 돌림
    assert L.gaze_metrics(fake_face(iris_shift=0.04))["looking"] is False  # 눈만 옆으로


def _tone(sr=16000, seconds=1.0, hz=220.0, amp=0.3, gaps=0):
    t = np.arange(int(sr * seconds)) / sr
    x = amp * np.sin(2 * np.pi * hz * t)
    if gaps:  # 말-쉼 반복
        x *= (np.sin(2 * np.pi * gaps * t) > 0)
    return x.astype(np.float32)


def test_speech_features_pitch_and_pauses():
    sr = 16000
    silence = np.zeros(sr, dtype=np.float32)
    assert speech_features(silence, sr)["speech_s"] == 0.0
    f = speech_features(np.concatenate([silence, _tone(sr, 2.0, 220, gaps=1)]), sr, "안녕하세요")
    assert 0.7 < f["speech_s"] < 1.4
    assert abs(f["pitch_hz"] - 220) < 10
    assert f["pause_mean_s"] >= 0.3
    assert f["syllables_per_s"] > 0


def test_quality_flags():
    sr = 16000
    good = speech_features(np.concatenate([np.zeros(sr // 2, np.float32), _tone(sr, 2.0)]), sr)
    assert quality(good)["ok"]
    noisy = speech_features(_tone(sr, 2.0) + np.random.default_rng(0).normal(0, 0.1, 2 * sr).astype(np.float32), sr)
    assert not quality(noisy)["quiet"]


def test_traits_and_coaching():
    traits, tips = traits_and_tips({"pause_mean_s": 0.3, "pitch_var": 0.05, "syllables_per_s": 4.0})
    assert "발화 간격이 비교적 짧아요" in traits and "톤이 일정해요" in traits
    assert any("기다리는 시간" in t for t in tips)
    msgs = coaching({"pitch_hz": 220}, {"pitch_hz": 190, "syllables_per_s": 4}, {"open_p90": 0.3}, {"open_p90": 0.25})
    assert any("톤" in m for m in msgs) and any("20% 더 크게" in m for m in msgs)


def test_mouth_profile_and_merge():
    track = [{"t": i * 0.05, "open": 0.1 + 0.01 * (i % 10), "width": 0.8, "face": i % 5 != 0} for i in range(100)]
    p = profile(track)
    assert p["face_ratio"] == 0.8 and p["face_s"] == 4.0 and p["open_p90"] > p["open_p50"]
    assert merge([p, p])["face_s"] == 8.0


def test_match_expected_is_lenient():
    assert match_expected("사과", "사과")
    assert match_expected("사가 주세요", "사과 주세요")
    assert match_expected("애플", "사과|애플")
    assert not match_expected("바나나", "사과 주세요")


def test_activity_summary_balance():
    ev = [{"type": "touch", "data": {"target": "사과", "reaction_ms": 800}}] * 4 + \
         [{"type": "gaze", "data": {"seconds": 30}}, {"type": "smile", "data": {}},
          {"type": "repeat", "data": {"word": "사과", "matched": True}},
          {"type": "out_of_scope", "data": {"text": "공룡은 왜 없어?"}},
          {"type": "blocked", "data": {"text": "부적절한 문장"}}]
    s = summarize(ev, "2026-10-31")
    assert s.touches == 4 and s.words == ["사과"] and s.favorites == ["사과"]
    assert abs(sum(s.balance.values()) - 1) < 0.01 and s.balance["touch"] == 0.444
    assert s.out_of_scope == ["공룡은 왜 없어?", "차단된 문장: 부적절한 문장"]


# ---------- API ----------
def _wav_bytes(seconds=1.0, sr=16000, amp=0.0, lead=0.5) -> bytes:
    pcm = np.concatenate([np.zeros(int(sr * lead)), _tone(sr, seconds, amp=amp)]) if amp else np.zeros(int(sr * seconds))
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(sr)
        w.writeframes((pcm * 32767).astype(np.int16).tobytes())
    return buf.getvalue()


def test_stt_silence_skips_api():
    r = client.post("/voice/stt", files={"file": ("a.wav", _wav_bytes(), "audio/wav")}, data={"expected": "사과"})
    assert r.status_code == 200, r.text
    assert r.json()["text"] == "" and r.json()["matched"] is False and r.json()["alert"] is False


def test_parent_sample_gauge_and_analysis():
    r = client.post("/voice/parent-sample", data={"child_id": "pytest", "text": "지호야, 안녕? 엄마야."},
                    files={"file": ("a.wav", _wav_bytes(3.0, amp=0.3), "audio/wav")})
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["quality"]["ok"] and b["gauge"]["sentences"] == 1 and b["gained"] > 0
    assert b["gauge"]["baseline"] == 0.5 and b["gauge"]["remaining_sentences"] > 0
    assert client.get("/voice/gauge/pytest").json()["sentences"] == 1
    a = client.get("/voice/analysis/pytest")
    assert a.status_code == 200 and a.json()["tips"]


def test_mouth_track_gauge_and_profile():
    track = [{"t": i * 0.05, "open": 0.1 + 0.02 * (i % 6), "width": 0.8} for i in range(120)]
    r = client.post("/vision/parent-mouth-track", json={"child_id": "pytest", "kind": "signup", "text": "사과", "track": track})
    assert r.status_code == 200, r.text
    assert r.json()["ok"] and r.json()["gauge"]["amount"] == 6.0
    assert client.get("/vision/mouth-profile/pytest").json()["open_p90"] > 0


def test_coaching_after_plan_read():
    client.post("/voice/parent-sample", data={"child_id": "pytest", "kind": "plan", "text": "내일은 과자야"},
                files={"file": ("a.wav", _wav_bytes(2.0, amp=0.3), "audio/wav")})
    r = client.get("/voice/coaching/pytest")
    assert r.status_code == 200, r.text and r.json()["messages"]


def test_activity_and_profile_api():
    assert client.post("/activity/pytest", json={"events": [{"type": "touch", "data": {"target": "사과"}}]}).status_code == 200
    assert client.post("/activity/pytest", json={"events": [{"type": "nope"}]}).status_code == 400
    assert client.get("/activity/pytest/summary").json()["touches"] == 1
    assert client.get("/profile/nobody").status_code == 404
    client.put("/profile/pytest", json={"child": {"name": "지호"}, "day": 1})
    p = client.put("/profile/pytest", json={"day": 2}).json()
    assert p["child"] == {"name": "지호"} and p["day"] == 2 and "linkCode" not in p


def test_link_code_devices_history():
    client.put("/profile/LINKME", json={"child": {"name": "지호", "birth": "2023-01"},
        "settings": {"consentBio": True, "consentChild": True}, "pinHash": "a" * 64, "onboarded": True})
    code = client.post("/profile/LINKME/link-code").json()["linkCode"]
    pair = client.get("/link/" + code)
    assert pair.json()["child"]["name"] == "지호"
    tablet_headers = {"Authorization": "Bearer " + pair.json()["token"]}
    client.post("/profile/LINKME/devices", headers=tablet_headers, json={"device_id": "tab1", "role": "child", "name": "태블릿"})
    client.post("/profile/LINKME/devices", json={"device_id": "ph1", "role": "parent", "name": "폰"})
    new = client.post("/profile/LINKME/link-code").json()["linkCode"]
    assert len(new) == 6 and client.get("/link/LINKME").status_code == 404  # 이전 코드 무효
    assert client.get(f"/link/{new}").status_code == 200
    p = client.get("/profile/LINKME").json()
    assert [d["device_id"] for d in p["devices"]] == ["ph1"]  # 아이 기기 연결 해제
    h = client.get("/profile/pytest/history").json()
    assert h["voice"] and h["mouth"] and isinstance(h["days"], list)
    assert client.delete("/profile/LINKME/devices/ph1").json()["devices"] == []
    # Deleting the current parent device now revokes its token too.
    from app.auth import issue_token
    from app.db import engine
    from app.models import Child
    from sqlmodel import Session
    with Session(engine) as db:
        fresh = issue_token(db, db.get(Child, "pytest").parent_id)["access_token"]
        db.commit()
    client.headers["Authorization"] = "Bearer " + fresh


def test_child_frame_no_face():
    ok, jpg = cv2.imencode(".jpg", np.full((240, 320, 3), 128, np.uint8))
    r = client.post("/vision/child-frame", files={"file": ("f.jpg", jpg.tobytes(), "image/jpeg")})
    assert r.status_code == 200, r.text
    assert r.json()["face"] is False


def test_bad_child_id_rejected():
    r = client.post("/voice/parent-sample", data={"child_id": "../../"},
                    files={"file": ("a.wav", _wav_bytes(), "audio/wav")})
    assert r.status_code == 400


def test_tts_requires_registration():
    r = client.post("/voice/tts", json={"child_id": "pyb64", "text": "안녕"})
    assert r.status_code == 400


def test_b64_endpoints():
    import base64
    b64 = base64.b64encode(_wav_bytes(3.0, amp=0.3)).decode()
    r = client.post("/voice/parent-sample-b64", json={"child_id": "pyb64", "text": "안녕", "audio_b64": b64, "ext": "wav"})
    assert r.status_code == 200, r.text and r.json()["gauge"]["sentences"] == 1
    r = client.post("/voice/stt-b64", json={"audio_b64": base64.b64encode(_wav_bytes()).decode(), "ext": "wav", "expected": "사과"})
    assert r.status_code == 200 and r.json()["text"] == ""
    assert client.post("/voice/parent-sample-b64", json={"child_id": "pyb64", "audio_b64": ""}).status_code == 400
    assert client.post("/debug/log", content=b"hello").json()["ok"]
