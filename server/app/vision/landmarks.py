"""MediaPipe FaceLandmarker 래퍼 + 랜드마크 → 수치 (순수 함수). 담당: 태희

랜드마크 배열: (478, 3) 정규화 좌표 (x, y 는 0~1, 이미지 기준).
"""
import os
import threading
import urllib.request
from pathlib import Path

import numpy as np

MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/face_landmarker/"
             "face_landmarker/float16/latest/face_landmarker.task")
MODEL_PATH = Path(os.getenv("FACE_MODEL_PATH",
                            Path(__file__).resolve().parents[2] / "models" / "face_landmarker.task"))

# Face Mesh 인덱스
LIP_UPPER, LIP_LOWER = 13, 14            # 안쪽 윗입술·아랫입술 중앙
MOUTH_L, MOUTH_R = 61, 291               # 입꼬리
EYE_OUTER_R, EYE_INNER_R = 33, 133       # 이미지 왼쪽 눈 (본인 오른눈)
EYE_INNER_L, EYE_OUTER_L = 362, 263
IRIS_R, IRIS_L = 468, 473
NOSE, CHEEK_R, CHEEK_L, FOREHEAD, CHIN = 1, 234, 454, 10, 152
MOUTH_RING = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]

# 응시 판정 임계값 (시연 환경에서 조정)
YAW_TOL = 0.15     # 코 위치가 얼굴 가로 중앙에서 벗어난 허용 비율
PITCH_RANGE = (0.35, 0.75)
IRIS_RANGE = (0.3, 0.7)


def _dist(lm: np.ndarray, a: int, b: int) -> float:
    return float(np.linalg.norm(lm[a, :2] - lm[b, :2]))


def mouth_metrics(lm: np.ndarray) -> dict:
    """입 벌림·너비 (양 눈 바깥쪽 거리로 정규화 → 얼굴 크기·거리 무관)."""
    eye = _dist(lm, EYE_OUTER_R, EYE_OUTER_L) or 1e-6
    return {
        "open": round(_dist(lm, LIP_UPPER, LIP_LOWER) / eye, 4),
        "width": round(_dist(lm, MOUTH_L, MOUTH_R) / eye, 4),
    }


def _ratio(v: float, lo: float, hi: float) -> float:
    return (v - lo) / (hi - lo) if hi != lo else 0.5


def gaze_metrics(lm: np.ndarray) -> dict:
    """머리 방향(코 위치) + 눈동자 위치로 화면 응시 여부 추정."""
    yaw = _ratio(lm[NOSE, 0], lm[CHEEK_R, 0], lm[CHEEK_L, 0])
    pitch = _ratio(lm[NOSE, 1], lm[FOREHEAD, 1], lm[CHIN, 1])
    looking_head = abs(yaw - 0.5) < YAW_TOL and PITCH_RANGE[0] < pitch < PITCH_RANGE[1]
    if lm.shape[0] > IRIS_L:
        iris = (_ratio(lm[IRIS_R, 0], lm[EYE_OUTER_R, 0], lm[EYE_INNER_R, 0])
                + _ratio(lm[IRIS_L, 0], lm[EYE_INNER_L, 0], lm[EYE_OUTER_L, 0])) / 2
        looking_eyes = IRIS_RANGE[0] < iris < IRIS_RANGE[1]
    else:
        iris, looking_eyes = 0.5, True
    return {
        "yaw": round(float(yaw), 3),
        "pitch": round(float(pitch), 3),
        "iris": round(float(iris), 3),
        "looking": bool(looking_head and looking_eyes),
    }


def mouth_box(lm: np.ndarray, w: int, h: int, pad: float = 0.6) -> tuple[int, int, int, int]:
    """입 주변 정사각 crop 영역 (x0, y0, x1, y1) 픽셀."""
    pts = lm[MOUTH_RING, :2] * [w, h]
    cx, cy = pts.mean(axis=0)
    half = (pts[:, 0].max() - pts[:, 0].min()) / 2 * (1 + pad)
    x0, y0 = int(max(0, cx - half)), int(max(0, cy - half))
    x1, y1 = int(min(w, cx + half)), int(min(h, cy + half))
    return x0, y0, x1, y1


# ---------- MediaPipe ----------
_lock = threading.Lock()


def ensure_model() -> Path:
    if not MODEL_PATH.exists():
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    return MODEL_PATH


def _create(video: bool):
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    opts = vision.FaceLandmarkerOptions(
        # 경로 대신 바이트로 전달 (MediaPipe 는 한글 등 비ASCII 경로를 못 엶)
        base_options=mp_python.BaseOptions(model_asset_buffer=ensure_model().read_bytes()),
        running_mode=vision.RunningMode.VIDEO if video else vision.RunningMode.IMAGE,
        num_faces=1,
    )
    return vision.FaceLandmarker.create_from_options(opts)


def _to_array(res) -> np.ndarray | None:
    if not res.face_landmarks:
        return None
    return np.array([[p.x, p.y, p.z] for p in res.face_landmarks[0]], dtype=np.float32)


def _mp_image(rgb: np.ndarray):
    import mediapipe as mp

    return mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))


_image_landmarker = None


def detect_image(rgb: np.ndarray) -> np.ndarray | None:
    """RGB 이미지 한 장 → (478,3) 랜드마크 또는 None(얼굴 없음)."""
    global _image_landmarker
    with _lock:
        if _image_landmarker is None:
            _image_landmarker = _create(video=False)
        return _to_array(_image_landmarker.detect(_mp_image(rgb)))


class VideoDetector:
    """영상용 (타임스탬프 단조 증가 필요). with 문으로 사용."""

    def __enter__(self):
        self._lm = _create(video=True)
        return self

    def __exit__(self, *exc):
        self._lm.close()

    def detect(self, rgb: np.ndarray, ts_ms: int) -> np.ndarray | None:
        return _to_array(self._lm.detect_for_video(_mp_image(rgb), ts_ms))
