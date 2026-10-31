# 부모 입모양 영상 분석, 아이 응시·입모양 — 담당: 태희
import json
import shutil
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.storage import child_dir, public_url
from app.vision.child import analyze_frame
from app.vision.mouth import analyze_video
from app.voice.audio import to_wav

router = APIRouter(prefix="/vision", tags=["vision"])


class MouthTrackPoint(BaseModel):
    t: float
    open: float
    width: float


class ParentMouthOut(BaseModel):
    ok: bool
    face_ratio: float            # 얼굴이 잡힌 프레임 비율 (0.6 미만이면 다시 찍기 안내)
    frames: int
    open_range: list[float]
    sprites: list[str]           # 립싱크용 입 사진 URL 4장 (닫힘 → 크게 벌림)
    face_url: str | None
    video_url: str
    audio_url: str | None        # 영상에서 뽑은 음성 (16kHz wav) — TTS 목소리 샘플로도 사용 가능
    track_url: str | None        # 프레임별 입 벌림 JSON
    message: str


@router.post("/parent-mouth", response_model=ParentMouthOut)
def parent_mouth(child_id: str = Form(...), kind: str = Form("signup"), file: UploadFile = File(...)):
    """부모 입모양 영상 업로드 → 입 사진 4장 + 입 벌림 트랙. kind: signup(가입) | plan(밤 낭독)."""
    if kind not in ("signup", "plan"):
        raise HTTPException(400, "kind 는 signup | plan")
    try:
        out = child_dir(child_id, "parent", kind)
    except ValueError:
        raise HTTPException(400, "child_id 형식 오류")
    suffix = Path(file.filename or "video.mp4").suffix or ".mp4"
    video = out / f"mouth{suffix}"
    with video.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        res = analyze_video(video, out)
    except ValueError as e:
        raise HTTPException(400, str(e))

    audio_url = None
    try:
        audio_url = public_url(to_wav(video, out / "mouth_audio.wav"))
    except Exception:  # 오디오 트랙이 없는 영상
        pass

    track_url = None
    if res["track"]:
        track_path = out / "track.json"
        track_path.write_text(json.dumps(res["track"]), encoding="utf-8")
        track_url = public_url(track_path)

    ok = res["face_ratio"] >= 0.6
    return ParentMouthOut(
        ok=ok,
        face_ratio=res["face_ratio"],
        frames=res["frames"],
        open_range=res["open_range"],
        sprites=[public_url(p) for p in res["sprites"]],
        face_url=public_url(res["face"]) if res["face"] else None,
        video_url=public_url(video),
        audio_url=audio_url,
        track_url=track_url,
        message="좋아요!" if ok else "얼굴이 잘 안 보여요. 밝은 곳에서 정면으로 다시 찍어 주세요.",
    )


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
    mouth_open: bool   # 입을 벌렸는지 (따라 말하기 확인용)
    mouth: Mouth | None
    gaze: Gaze | None


@router.post("/child-frame", response_model=ChildFrameOut)
def child_frame(file: UploadFile = File(...)):
    """아이 카메라 프레임(jpg/png) 한 장 → 얼굴·응시·입 벌림. 앱에서 1~2초 간격 호출."""
    try:
        return analyze_frame(file.file.read())
    except ValueError as e:
        raise HTTPException(400, str(e))
