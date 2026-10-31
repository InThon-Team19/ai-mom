"""아이 카메라 프레임 한 장 → 얼굴·응시·입 벌림. 담당: 태희"""
import cv2
import numpy as np

from app.vision.landmarks import detect_image, gaze_metrics, mouth_metrics

MOUTH_OPEN_TH = 0.08  # 입 벌림 판정 (눈 사이 거리 대비)


def analyze_frame(image_bytes: bytes) -> dict:
    bgr = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("이미지를 읽을 수 없음")
    lm = detect_image(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
    if lm is None:
        return {"face": False, "looking": False, "mouth_open": False, "mouth": None, "gaze": None}
    m = mouth_metrics(lm)
    g = gaze_metrics(lm)
    return {"face": True, "looking": g["looking"], "mouth_open": m["open"] > MOUTH_OPEN_TH,
            "mouth": m, "gaze": g}
