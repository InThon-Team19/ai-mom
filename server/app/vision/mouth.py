"""부모 입모양 영상 분석 → 입 벌림 트랙 + 립싱크용 입 사진 4장. 담당: 태희

아바타 립싱크 방식: TTS 오디오 음량(0~1)에 맞춰 mouth_0(닫힘) ~ mouth_3(크게 벌림) 사진을 바꿔 끼움.
"""
from pathlib import Path

import cv2
import numpy as np

from app.vision.landmarks import VideoDetector, mouth_box, mouth_metrics

LEVELS = 4


def _imwrite(path: Path, img: np.ndarray) -> None:
    """cv2.imwrite 는 한글 경로에서 조용히 실패 → 인코딩 후 직접 저장."""
    ok, buf = cv2.imencode(path.suffix, img)
    if not ok:
        raise ValueError(f"이미지 인코딩 실패: {path.name}")
    path.write_bytes(buf.tobytes())


def analyze_video(video: Path, out_dir: Path, sample_fps: float = 15.0) -> dict:
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise ValueError("영상을 열 수 없음")
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    step = max(1, round(src_fps / sample_fps))

    track: list[dict] = []
    frames: list[tuple[float, np.ndarray, np.ndarray]] = []  # (open, bgr, lm)
    total = 0
    idx = 0
    with VideoDetector() as det:
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            if idx % step == 0:
                total += 1
                t_ms = int(idx / src_fps * 1000)
                lm = det.detect(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), t_ms)
                if lm is not None:
                    m = mouth_metrics(lm)
                    track.append({"t": round(t_ms / 1000, 3), **m})
                    frames.append((m["open"], bgr, lm))
            idx += 1
    cap.release()

    if not frames:
        return {"face_ratio": 0.0, "frames": total, "track": [], "sprites": [], "face": None,
                "open_range": [0.0, 0.0]}

    opens = np.array([f[0] for f in frames])
    # 벌림 정도 분위수별 대표 프레임 → 입 사진 (닫힘 → 크게 벌림)
    sprites: list[Path] = []
    for i, q in enumerate(np.linspace(0.02, 0.98, LEVELS)):
        target = np.quantile(opens, q)
        _, bgr, lm = frames[int(np.argmin(np.abs(opens - target)))]
        h, w = bgr.shape[:2]
        x0, y0, x1, y1 = mouth_box(lm, w, h)
        crop = cv2.resize(bgr[y0:y1, x0:x1], (256, 256))
        path = out_dir / f"mouth_{i}.png"
        _imwrite(path, crop)
        sprites.append(path)

    # 아바타 얼굴용 기본 프레임 (가장 닫힌 입)
    face = out_dir / "face.jpg"
    _imwrite(face, frames[int(np.argmin(opens))][1])

    return {
        "face_ratio": round(len(frames) / total, 3) if total else 0.0,
        "frames": total,
        "track": track,
        "sprites": sprites,
        "face": face,
        "open_range": [round(float(opens.min()), 4), round(float(opens.max()), 4)],
    }
