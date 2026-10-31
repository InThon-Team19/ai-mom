"""입모양 트랙 → 입모양 기준값(profile). 담당: 태희

트랙은 앱(FaceTracker)이 기기 안에서 0.05초마다 잰 입 벌림 수치. 영상·얼굴 사진은 서버에 오지 않음.
profile 은 아바타 입 움직임 크기(open_p50/p90)와 밤 낭독 코칭 기준으로 쓰임.
"""
import numpy as np


def profile(track: list[dict], frame_s: float = 0.05) -> dict:
    """track: [{t, open, width, face}] (face 없으면 True 로 봄)."""
    face = [p for p in track if p.get("face", True)]
    if not face:
        return {"frames": len(track), "face_ratio": 0.0, "face_s": 0.0,
                "open_p50": 0.0, "open_p90": 0.0, "width_p50": 0.0}
    opens = np.array([p["open"] for p in face], dtype=float)
    widths = np.array([p["width"] for p in face], dtype=float)
    return {
        "frames": len(track),
        "face_ratio": round(len(face) / len(track), 3),
        "face_s": round(len(face) * frame_s, 2),
        "open_p50": round(float(np.percentile(opens, 50)), 4),
        "open_p90": round(float(np.percentile(opens, 90)), 4),
        "width_p50": round(float(np.percentile(widths, 50)), 4),
    }


def merge(profiles: list[dict]) -> dict:
    """여러 문장의 profile → 얼굴 잡힌 시간으로 가중 평균."""
    ps = [p for p in profiles if p.get("face_s")]
    if not ps:
        return profile([])
    w = np.array([p["face_s"] for p in ps])
    avg = lambda k: round(float(np.average([p[k] for p in ps], weights=w)), 4)  # noqa: E731
    return {
        "frames": int(sum(p["frames"] for p in ps)),
        "face_ratio": avg("face_ratio"),
        "face_s": round(float(w.sum()), 2),
        "open_p50": avg("open_p50"),
        "open_p90": avg("open_p90"),
        "width_p50": avg("width_p50"),
    }
