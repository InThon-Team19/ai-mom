"""(예비) 부모 입모양 영상 → 입 벌림 트랙. 담당: 태희

기본 경로는 앱 FaceTracker 가 기기 안에서 잰 수치를 보내는 것 (/vision/parent-mouth-track).
이 함수는 WebView 카메라가 안 되는 기기용 예비. 영상에서 수치만 뽑고 얼굴 이미지는 저장하지 않음.
"""
from pathlib import Path

import cv2

from app.vision.landmarks import VideoDetector, mouth_metrics


def video_track(video: Path, sample_fps: float = 20.0) -> list[dict]:
    """→ [{t, open, width, face}] (0.05초 간격 기본)"""
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise ValueError("영상을 열 수 없음")
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    step = max(1, round(src_fps / sample_fps))
    track: list[dict] = []
    idx = 0
    with VideoDetector() as det:
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            if idx % step == 0:
                t_ms = int(idx / src_fps * 1000)
                lm = det.detect(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), t_ms)
                if lm is None:
                    track.append({"t": t_ms / 1000, "open": 0.0, "width": 0.0, "face": False})
                else:
                    track.append({"t": t_ms / 1000, **mouth_metrics(lm), "face": True})
            idx += 1
    cap.release()
    return track
