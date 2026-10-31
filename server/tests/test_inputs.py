"""입력 파이프라인 테스트 — 담당: 태희.  실행: cd server && pytest -q"""
import io
import wave

import cv2
import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.routers.voice import match_expected
from app.vision import landmarks as L
from app.voice.audio import speech_features

client = TestClient(app)


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


def test_mouth_open_scales_with_gap():
    closed = L.mouth_metrics(fake_face(0.0))["open"]
    opened = L.mouth_metrics(fake_face(0.06))["open"]
    assert closed == 0.0
    assert abs(opened - 0.2) < 1e-3  # 0.06 / 눈 사이 0.3


def test_gaze_front_vs_turned():
    assert L.gaze_metrics(fake_face())["looking"] is True
    assert L.gaze_metrics(fake_face(nose_x=0.64))["looking"] is False   # 고개 돌림
    assert L.gaze_metrics(fake_face(iris_shift=0.04))["looking"] is False  # 눈만 옆으로


def test_mouth_box_inside_image():
    x0, y0, x1, y1 = L.mouth_box(fake_face(0.05), 640, 480)
    assert 0 <= x0 < x1 <= 640 and 0 <= y0 < y1 <= 480


def test_speech_features_silence_vs_tone():
    sr = 16000
    silence = np.zeros(sr, dtype=np.float32)
    assert speech_features(silence, sr)["speech_s"] == 0.0
    t = np.arange(sr) / sr
    tone = np.concatenate([silence, 0.3 * np.sin(2 * np.pi * 220 * t).astype(np.float32)])
    f = speech_features(tone, sr, "안녕하세요")
    assert 0.8 < f["speech_s"] < 1.2
    assert f["syllables_per_s"] > 0


def test_match_expected_is_lenient():
    assert match_expected("사과", "사과")
    assert match_expected("사가 주세요", "사과 주세요")
    assert not match_expected("바나나", "사과 주세요")


def _wav_bytes(seconds=1.0, sr=16000, amp=0.0) -> bytes:
    t = np.arange(int(sr * seconds)) / sr
    pcm = (amp * np.sin(2 * np.pi * 220 * t) * 32767).astype(np.int16)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


def test_stt_silence_skips_api():
    r = client.post("/voice/stt", files={"file": ("a.wav", _wav_bytes(), "audio/wav")}, data={"expected": "사과"})
    assert r.status_code == 200, r.text
    assert r.json()["text"] == "" and r.json()["matched"] is False


def test_parent_sample_progress():
    r = client.post("/voice/parent-sample", data={"child_id": "pytest"},
                    files={"file": ("a.wav", _wav_bytes(2.0, amp=0.3), "audio/wav")})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["sample_count"] >= 1 and 0 < body["progress"] <= 1


def test_child_frame_no_face():
    ok, jpg = cv2.imencode(".jpg", np.full((240, 320, 3), 128, np.uint8))
    r = client.post("/vision/child-frame", files={"file": ("f.jpg", jpg.tobytes(), "image/jpeg")})
    assert r.status_code == 200, r.text
    assert r.json()["face"] is False


def test_bad_child_id_rejected():
    r = client.post("/voice/parent-sample", data={"child_id": "../../"},
                    files={"file": ("a.wav", _wav_bytes(), "audio/wav")})
    assert r.status_code == 400
