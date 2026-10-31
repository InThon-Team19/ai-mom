# 부모 입모양 기준값·학습률, 아이 응시·입모양 — 담당: 태희
import json
import math
import shutil
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.routers.voice import Gauge
from app.storage import child_dir, tmp_path
from app.vision.child import analyze_frame
from app.vision.mouth import video_track
from app.vision.profile import merge, profile

router = APIRouter(prefix="/vision", tags=["vision"])

# 입모양 학습률: 얼굴이 잡힌 채 읽은 시간. 최소 기준 20초, 100% = 40초 (시연용 임시값)
MOUTH_TARGET_S = 40.0
MOUTH_MIN_S = 20.0
KINDS = ("signup", "plan")


def _mouth_dir(child_id: str, kind: str) -> Path:
    return child_dir(child_id, "parent", "mouth", kind)


def mouth_profiles(child_id: str, kind: str) -> list[dict]:
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted(_mouth_dir(child_id, kind).glob("profile_*.json"))]


def mouth_gauge(child_id: str) -> Gauge:
    ps = [p for k in KINDS for p in mouth_profiles(child_id, k) if p["face_ratio"] >= 0.6]
    total = sum(p["face_s"] for p in ps)
    per = total / len(ps) if ps else 2.5
    remaining = max(0.0, MOUTH_MIN_S - total)
    return Gauge(
        progress=round(min(1.0, total / MOUTH_TARGET_S), 3),
        baseline=MOUTH_MIN_S / MOUTH_TARGET_S,
        usable=total >= MOUTH_MIN_S,
        amount=round(total, 1),
        sentences=len(ps),
        remaining_sentences=math.ceil(remaining / per) if remaining else 0,
    )


class TrackPoint(BaseModel):
    t: float
    open: float
    width: float
    face: bool = True


class MouthTrackIn(BaseModel):
    child_id: str
    kind: str = "signup"   # signup(가입 1-6) | plan(밤 낭독 2-4)
    text: str = ""         # 읽은 문장
    track: list[TrackPoint]


class MouthProfile(BaseModel):
    frames: int
    face_ratio: float
    face_s: float
    open_p50: float
    open_p90: float
    width_p50: float


class MouthTrackOut(BaseModel):
    ok: bool               # 얼굴이 충분히 잡혔는지 (60% 이상)
    profile: MouthProfile
    gauge: Gauge
    gained: float
    message: str


def _save_track(child_id: str, kind: str, text: str, track: list[dict]) -> MouthTrackOut:
    if kind not in KINDS:
        raise HTTPException(400, "kind 는 signup | plan")
    try:
        d = _mouth_dir(child_id, kind)
    except ValueError:
        raise HTTPException(400, "child_id 형식 오류")
    before = mouth_gauge(child_id).progress
    prof = profile(track)
    n = len(list(d.glob("profile_*.json")))
    (d / f"profile_{n:03d}.json").write_text(json.dumps({**prof, "text": text}, ensure_ascii=False), encoding="utf-8")
    g = mouth_gauge(child_id)
    ok = prof["face_ratio"] >= 0.6
    return MouthTrackOut(ok=ok, profile=MouthProfile(**prof), gauge=g, gained=round(g.progress - before, 3),
                         message="좋아요!" if ok else "얼굴이 잘 안 보여요. 밝은 곳에서 정면을 봐 주세요.")


@router.post("/parent-mouth-track", response_model=MouthTrackOut)
def parent_mouth_track(body: MouthTrackIn):
    """문장 하나 읽는 동안 앱이 0.05초마다 잰 입 벌림 수치 → 입모양 기준값 + 학습률. (영상은 기기 밖으로 안 나감)"""
    return _save_track(body.child_id, body.kind, body.text, [p.model_dump() for p in body.track])


@router.post("/parent-mouth", response_model=MouthTrackOut)
def parent_mouth_video(child_id: str = Form(...), kind: str = Form("signup"), text: str = Form(""),
                       file: UploadFile = File(...)):
    """(예비) 입모양 영상 업로드 → 수치만 뽑고 영상은 바로 삭제."""
    src = tmp_path(Path(file.filename or "v.mp4").suffix or ".mp4")
    with src.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    try:
        track = video_track(src)
    except ValueError as e:
        raise HTTPException(400, str(e))
    finally:
        src.unlink(missing_ok=True)
    return _save_track(child_id, kind, text, track)


@router.get("/gauge/{child_id}", response_model=Gauge)
def gauge(child_id: str):
    """입모양 학습률 (부모 홈 2-1)."""
    try:
        return mouth_gauge(child_id)
    except ValueError:
        raise HTTPException(400, "child_id 형식 오류")


@router.get("/mouth-profile/{child_id}", response_model=MouthProfile)
def mouth_profile(child_id: str):
    """아바타 입 움직임 크기 기준 (가입 + 밤 낭독 전체). 아이 태블릿 아바타가 사용."""
    try:
        return merge(mouth_profiles(child_id, "signup") + mouth_profiles(child_id, "plan"))
    except ValueError:
        raise HTTPException(400, "child_id 형식 오류")


# ---------- 아이 ----------
class Gaze(BaseModel):
    yaw: float
    pitch: float
    iris: float
    looking: bool


class Mouth(BaseModel):
    open: float
    width: float


class ChildFrameOut(BaseModel):
    face: bool
    looking: bool      # 화면을 보고 있는지
    mouth_open: bool   # 입을 벌렸는지
    mouth: Mouth | None
    gaze: Gaze | None


@router.post("/child-frame", response_model=ChildFrameOut)
def child_frame(file: UploadFile = File(...)):
    """(예비) 아이 카메라 프레임 한 장 → 얼굴·응시·입 벌림. 기본은 앱 FaceTracker 가 기기 안에서 판정."""
    try:
        return analyze_frame(file.file.read())
    except ValueError as e:
        raise HTTPException(400, str(e))
