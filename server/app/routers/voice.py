# 부모 목소리 샘플·학습률(TTS), STT — 담당: 민주(TTS) · 태희(STT·업로드)
import shutil
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.storage import child_dir, public_url, tmp_path
from app.voice.audio import read_wav, speech_features, to_wav
from app.voice.stt import transcribe

router = APIRouter(prefix="/voice", tags=["voice"])

# 목소리 복제에 필요한 누적 발화 시간 (초). 학습률 = 누적 / 목표
VOICE_TARGET_S = 60.0


class SpeechFeatures(BaseModel):
    duration_s: float
    speech_s: float
    speech_ratio: float
    syllables_per_s: float
    volume: float


# ---------- 부모 목소리 샘플 (태희: 업로드·학습률 / 민주: TTS 등록) ----------
class ParentSampleOut(BaseModel):
    url: str
    features: SpeechFeatures
    total_speech_s: float
    progress: float          # 학습률 0~1
    sample_count: int


def parent_samples(child_id: str) -> list[Path]:
    """민주: TTS 목소리 등록 시 이 wav 들을 ElevenLabs 에 올리면 됨."""
    return sorted(child_dir(child_id, "parent", "voice").glob("sample_*.wav"))


@router.post("/parent-sample", response_model=ParentSampleOut)
def parent_sample(child_id: str = Form(...), file: UploadFile = File(...)):
    """부모 목소리 녹음 한 개 업로드 → 16kHz wav 저장 + 누적 발화 시간으로 학습률."""
    try:
        out = child_dir(child_id, "parent", "voice")
    except ValueError:
        raise HTTPException(400, "child_id 형식 오류")
    src = tmp_path(Path(file.filename or "a.m4a").suffix or ".m4a")
    with src.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    n = len(parent_samples(child_id))
    wav = out / f"sample_{n:02d}.wav"
    try:
        to_wav(src, wav)
    except Exception:
        raise HTTPException(400, "오디오를 변환할 수 없음")
    finally:
        src.unlink(missing_ok=True)

    feats = speech_features(*read_wav(wav))
    total = sum(speech_features(*read_wav(p))["speech_s"] for p in parent_samples(child_id))
    return ParentSampleOut(
        url=public_url(wav),
        features=SpeechFeatures(**feats),
        total_speech_s=round(total, 1),
        progress=round(min(1.0, total / VOICE_TARGET_S), 3),
        sample_count=n + 1,
    )


# ---------- STT (부모·아이 공통) ----------
class SttOut(BaseModel):
    text: str
    features: SpeechFeatures
    matched: bool | None     # expected 를 줬을 때 따라 말하기 성공 여부


def _normalize(s: str) -> str:
    return "".join(ch for ch in s if ch.isalnum())


def _lcs(a: str, b: str) -> int:
    prev = [0] * (len(b) + 1)
    for ca in a:
        cur = [0]
        for j, cb in enumerate(b):
            cur.append(prev[j] + 1 if ca == cb else max(prev[j + 1], cur[j]))
        prev = cur
    return prev[-1]


def match_expected(text: str, expected: str) -> bool:
    """따라 말하기 판정: 기대 문장 글자의 절반 이상이 순서대로 나오면 성공 (아이 발음 관대하게)."""
    t, e = _normalize(text), _normalize(expected)
    if not e or not t:
        return False
    return _lcs(t, e) >= max(1, (len(e) + 1) // 2)


@router.post("/stt", response_model=SttOut)
def stt(file: UploadFile = File(...), expected: str = Form(""), who: str = Form("child")):
    """음성 파일(m4a/wav/webm, 영상도 가능) → 텍스트 + 말하기 특성. expected: 따라 말하기 목표 문장."""
    src = tmp_path(Path(file.filename or "a.m4a").suffix or ".m4a")
    wav = tmp_path(".wav")
    with src.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    try:
        try:
            to_wav(src, wav)
            pcm, sr = read_wav(wav)
        except Exception:
            raise HTTPException(400, "오디오를 처리할 수 없음")
        text = ""
        if speech_features(pcm, sr)["speech_s"] > 0.2:  # 무음이면 STT 호출 생략
            try:
                text = transcribe(wav, prompt=expected)
            except RuntimeError as e:  # 키 없음
                raise HTTPException(503, str(e))
            except Exception as e:
                raise HTTPException(502, f"STT 실패: {e}")
        feats = speech_features(pcm, sr, text)
    finally:
        src.unlink(missing_ok=True)
        wav.unlink(missing_ok=True)
    return SttOut(
        text=text,
        features=SpeechFeatures(**feats),
        matched=match_expected(text, expected) if expected else None,
    )
