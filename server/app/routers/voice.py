# 부모 목소리 샘플·학습률·특성 분석·코칭, STT — 담당: 태희 / TTS 부분: 민주 (Fish Audio 초안 태희)
import logging
import base64
import binascii
import hashlib
import numpy as np
import re
import json
import math
import shutil
from uuid import uuid4
from pathlib import Path

import httpx
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.storage import child_dir, public_dir, public_url, tmp_path
from app.tts import fish
from app.vision.profile import merge as merge_mouth
from app.voice.analysis import coaching as make_coaching
from app.voice.analysis import summarize, traits_and_tips
from app.voice.audio import quality, read_wav, speech_features, to_wav
from app.voice.stt import transcribe

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])

# 학습률 게이지 (기획 2-1-1 학습률 표시). Fish Audio 권장: 깨끗한 음성 10~30초 → 최소 기준 30초, 100% = 60초
VOICE_TARGET_S = 60.0
VOICE_MIN_S = 30.0
KINDS = ("signup", "plan")


class SpeechFeatures(BaseModel):
    duration_s: float
    speech_s: float
    speech_ratio: float
    syllables_per_s: float
    volume: float
    pause_mean_s: float
    pitch_hz: float
    pitch_var: float
    snr_db: float


class Quality(BaseModel):
    ok: bool
    quiet: bool
    loud: bool
    message: str


class Gauge(BaseModel):
    progress: float           # 0~1
    baseline: float           # 최소 사용 기준선 위치 (0~1)
    usable: bool              # 기준선 넘었는지
    amount: float             # 누적 초
    sentences: int
    remaining_sentences: int  # "00문장 더 읽으면 쓸 수 있어요"


# ---------- 저장된 샘플 ----------
def _voice_dir(child_id: str, kind: str) -> Path:
    return child_dir(child_id, "parent", "voice", kind)


def samples(child_id: str, kinds=KINDS) -> list[dict]:
    """[{wav: Path, text, features, quality, kind}] — 민주: TTS 등록은 이 목록의 wav·text 사용."""
    out = []
    for kind in kinds:
        for meta in sorted(_voice_dir(child_id, kind).glob("sample_*.json"), key=lambda p: p.stat().st_mtime_ns):
            d = json.loads(meta.read_text(encoding="utf-8"))
            d["wav"] = meta.with_suffix(".wav")
            d["kind"] = kind
            out.append(d)
    return out


def voice_gauge(child_id: str) -> Gauge:
    ss = [s for s in samples(child_id) if s["quality"]["ok"]]
    total = sum(s["features"]["speech_s"] for s in ss)
    per = total / len(ss) if ss else 2.5
    remaining = max(0.0, VOICE_MIN_S - total)
    return Gauge(
        progress=round(min(1.0, total / VOICE_TARGET_S), 3),
        baseline=VOICE_MIN_S / VOICE_TARGET_S,
        usable=total >= VOICE_MIN_S,
        amount=round(total, 1),
        sentences=len(ss),
        remaining_sentences=math.ceil(remaining / per) if remaining else 0,
    )


# ---------- 부모 목소리 샘플 (가입 1-5, 밤 낭독 2-4) ----------
class ParentSampleOut(BaseModel):
    features: SpeechFeatures
    quality: Quality
    gauge: Gauge
    gained: float  # 이번 문장으로 오른 학습률 (+18% 표시용)


def _save_parent_sample(child_id: str, text: str, kind: str, src: Path) -> ParentSampleOut:
    if kind not in KINDS:
        raise HTTPException(400, "녹음 종류를 알 수 없어요. 앱을 다시 열고 한 번 더 해 주세요.")
    try:
        out = _voice_dir(child_id, kind)
    except ValueError:
        raise HTTPException(400, "아이 정보를 찾지 못했어요. 앱을 다시 열고 한 번 더 해 주세요.")
    before = voice_gauge(child_id).progress
    wav = out / f"sample_{uuid4().hex}.wav"
    try:
        to_wav(src, wav)
    except Exception:
        raise HTTPException(400, "녹음을 읽지 못했어요. 한 번 더 녹음해 주세요.")
    finally:
        src.unlink(missing_ok=True)

    feats = speech_features(*read_wav(wav), text)
    q = quality(feats)
    wav.with_suffix(".json").write_text(
        json.dumps({"text": text, "features": feats, "quality": q}, ensure_ascii=False), encoding="utf-8")
    g = voice_gauge(child_id)
    return ParentSampleOut(features=SpeechFeatures(**feats), quality=Quality(**q), gauge=g,
                           gained=round(g.progress - before, 3))


def _b64_to_tmp(audio_b64: str, ext: str) -> Path:
    """앱이 JSON 으로 보낸 base64 오디오 → 임시 파일"""
    ext = "." + "".join(c for c in ext.lstrip(".") if c.isalnum())[:5] if ext else ".m4a"
    try:
        data = base64.b64decode(audio_b64, validate=False)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "녹음 파일이 깨졌어요. 한 번 더 녹음해 주세요.")
    if not data:
        raise HTTPException(400, "녹음된 소리가 없어요. 한 번 더 녹음해 주세요.")
    src = tmp_path(ext)
    src.write_bytes(data)
    return src


@router.post("/parent-sample", response_model=ParentSampleOut)
def parent_sample(child_id: str = Form(...), text: str = Form(""), kind: str = Form("signup"),
                  file: UploadFile = File(...)):
    """문장 하나 읽은 녹음 → 품질 판정 + 학습률. text: 화면에 띄운 문장 (TTS 등록 때 대본으로 사용)."""
    src = tmp_path(Path(file.filename or "a.m4a").suffix or ".m4a")
    with src.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return _save_parent_sample(child_id, text, kind, src)


class ParentSampleB64In(BaseModel):
    child_id: str
    text: str = ""
    kind: str = "signup"
    audio_b64: str
    ext: str = "m4a"


@router.post("/parent-sample-b64", response_model=ParentSampleOut)
def parent_sample_b64(body: ParentSampleB64In):
    """앱용: 녹음을 base64 JSON 으로 받음 (Expo 58 fetch 의 파일 첨부 문제 우회). 결과는 /parent-sample 과 같음."""
    return _save_parent_sample(body.child_id, body.text, body.kind, _b64_to_tmp(body.audio_b64, body.ext))


@router.get("/gauge/{child_id}", response_model=Gauge)
def gauge(child_id: str):
    """음성 학습률 (부모 홈 2-1)."""
    try:
        return voice_gauge(child_id)
    except ValueError:
        raise HTTPException(400, "아이 정보를 찾지 못했어요. 앱을 다시 열고 한 번 더 해 주세요.")


# ---------- AI 특성 분석·의사소통 피드백 (가입 2-1-1 ⑤⑥) ----------
class AnalysisOut(BaseModel):
    summary: dict
    traits: list[str]  # "발화 간격이 비교적 짧아요"
    tips: list[str]    # "질문 후 기다리는 시간을 늘려볼까요?"


@router.get("/analysis/{child_id}", response_model=AnalysisOut)
def analysis(child_id: str):
    try:
        ss = [s for s in samples(child_id, ("signup",)) if s["quality"]["loud"]]
    except ValueError:
        raise HTTPException(400, "아이 정보를 찾지 못했어요. 앱을 다시 열고 한 번 더 해 주세요.")
    if not ss:
        raise HTTPException(400, "아직 목소리 녹음이 없어요. 먼저 목소리를 녹음해 주세요.")
    s = summarize([x["features"] for x in ss])
    traits, tips = traits_and_tips(s)
    return AnalysisOut(summary=s, traits=traits, tips=tips)


# ---------- 낭독 코칭 (밤 2-4, 기획 2-2 ③) ----------
class CoachingOut(BaseModel):
    messages: list[str]


@router.get("/coaching/{child_id}", response_model=CoachingOut)
def coaching(child_id: str):
    """가입 때 기준 대비 최근 밤 낭독의 톤·입모양·속도 코칭."""
    from app.routers.vision import mouth_profiles  # 순환 import 방지

    try:
        base = [s["features"] for s in samples(child_id, ("signup",)) if s["quality"]["loud"]]
        plan = [s["features"] for s in samples(child_id, ("plan",)) if s["quality"]["loud"]][-10:]
    except ValueError:
        raise HTTPException(400, "아이 정보를 찾지 못했어요. 앱을 다시 열고 한 번 더 해 주세요.")
    if not plan:
        raise HTTPException(400, "아직 낭독 녹음이 없어요. 내일 계획을 먼저 읽어 주세요.")
    base_m = merge_mouth(mouth_profiles(child_id, "signup"))
    plan_m = merge_mouth(mouth_profiles(child_id, "plan")[-10:])
    return CoachingOut(messages=make_coaching(summarize(base) if base else {}, summarize(plan), base_m, plan_m))


# ---------- STT (부모·아이 공통) ----------
ALERT_WORDS = ("아파", "아야", "무서워", "도와줘", "살려")


class SttOut(BaseModel):
    text: str
    features: SpeechFeatures
    matched: bool | None  # expected 를 줬을 때 따라 말하기 성공 여부
    alert: bool           # 위험 신호 ("아파" 등) → 근무 중 부모 알림 (기획 결정사항: 긴급 상황)


def _normalize(s: str) -> str:
    return "".join(ch for ch in s if ch.isalnum()).lower()


def _lcs(a: str, b: str) -> int:
    prev = [0] * (len(b) + 1)
    for ca in a:
        cur = [0]
        for j, cb in enumerate(b):
            cur.append(prev[j] + 1 if ca == cb else max(prev[j + 1], cur[j]))
        prev = cur
    return prev[-1]


def match_expected(text: str, expected: str) -> bool:
    """따라 말하기 판정: 기대 단어 글자의 절반 이상이 순서대로 나오면 성공 (아이 발음 관대하게).
    expected 에 '|' 로 여러 답을 줄 수 있음 (예: '사과|apple')."""
    t = _normalize(text)
    if not t:
        return False
    for e in (_normalize(x) for x in expected.split("|")):
        if e and _lcs(t, e) >= max(1, (len(e) + 1) // 2):
            return True
        # 짧은 말은 자모 단위로도 비교: 아이가 자음을 빼고 말해도("사과" -> "아가") 성공으로 봄. 긴 문장엔 적용 안 함
        if e and len(t) <= len(e) + 2:
            je, jt = _jamo(e), _jamo(t)
            if je and _lcs(jt, je) * 2 >= len(je) and _lcs(jt, je) >= 2:
                return True
    return False


def _jamo(s: str) -> str:
    """한글 음절 -> 초성·중성·종성 (영문 등은 그대로)"""
    out = []
    for ch in s:
        c = ord(ch) - 0xAC00
        if 0 <= c < 11172:
            out += [chr(0x1100 + c // 588), chr(0x1161 + (c % 588) // 28)]
            if c % 28:
                out.append(chr(0x11A7 + c % 28))
        else:
            out.append(ch)
    return "".join(out)



def _stt_from_path(src: Path, expected: str) -> SttOut:
    wav = tmp_path(".wav")
    try:
        try:
            to_wav(src, wav)
            pcm, sr = read_wav(wav)
        except Exception:
            raise HTTPException(400, "녹음을 읽지 못했어요. 한 번 더 녹음해 주세요.")
        text = ""
        if speech_features(pcm, sr)["speech_s"] > 0.2:  # 무음이면 STT 호출 생략
            try:
                text = transcribe(wav)  # 힌트 없이: 목표 단어를 힌트로 주면 말 없는 소리도 그 단어로 되읊어 '맞게 말함'으로 잘못 기록됨 (시험: 삐 소리 -> '사과')
            except RuntimeError as e:  # 키 없음
                logger.warning("stt unavailable: %s", e)
                raise HTTPException(503, "지금은 말소리를 알아들을 수 없어요. 잠시 후 다시 해 주세요.")
            except Exception as e:
                logger.warning("stt failed: %r", e)
                raise HTTPException(502, "말소리를 알아듣지 못했어요. 잠시 후 다시 해 주세요.")
        feats = speech_features(pcm, sr, text)
    finally:
        src.unlink(missing_ok=True)
        wav.unlink(missing_ok=True)
    return SttOut(
        text=text,
        features=SpeechFeatures(**feats),
        matched=match_expected(text, expected) if expected else None,
        alert=any(w in text for w in ALERT_WORDS),
    )


@router.post("/stt", response_model=SttOut)
def stt(file: UploadFile = File(...), expected: str = Form(""), who: str = Form("child")):
    """음성 파일(m4a/wav/webm, 영상도 가능) → 텍스트 + 말하기 특성. expected: 따라 말하기 목표."""
    src = tmp_path(Path(file.filename or "a.m4a").suffix or ".m4a")
    with src.open("wb") as f:
        shutil.copyfileobj(file.file, f)
    return _stt_from_path(src, expected)


class SttB64In(BaseModel):
    audio_b64: str
    ext: str = "m4a"
    expected: str = ""
    who: str = "child"


@router.post("/stt-b64", response_model=SttOut)
def stt_b64(body: SttB64In):
    """앱용: base64 JSON 으로 받는 STT (결과는 /stt 와 같음)."""
    return _stt_from_path(_b64_to_tmp(body.audio_b64, body.ext), body.expected)


# ---------- TTS: 부모 목소리 복제·합성 (민주, Fish Audio 초안 태희) ----------
class VoiceRegisterOut(BaseModel):
    model_id: str
    state: str  # created | training | trained | failed | inline(무료 등급: 즉석 복제)
    sample_count: int


def _voice_id_file(child_id: str) -> Path:
    return child_dir(child_id, "parent") / "fish_model_id.txt"


@router.post("/register", response_model=VoiceRegisterOut)
def register(child_id: str = Form(...)):
    """품질 좋은 부모 녹음(최근 20개)과 대본으로 Fish Audio 목소리 모델 생성. 밤 낭독 후 다시 부르면 갱신."""
    try:
        ss = [s for s in samples(child_id) if s["quality"]["ok"]][-20:]
    except ValueError:
        raise HTTPException(400, "아이 정보를 찾지 못했어요. 앱을 다시 열고 한 번 더 해 주세요.")
    if not ss:
        raise HTTPException(400, "아직 쓸 수 있는 목소리 녹음이 없어요. 조용한 곳에서 목소리를 먼저 녹음해 주세요.")
    try:
        res = fish.register_voice(f"aibom-{child_id}", [s["wav"] for s in ss], [s["text"] for s in ss])
    except RuntimeError as e:
        logger.warning("voice register unavailable: %s", e)
        raise HTTPException(503, "지금은 목소리를 등록할 수 없어요. 잠시 후 다시 해 주세요.")
    except httpx.HTTPStatusError as e:
        if e.response.status_code in (402, 403):
            # 무료 등급은 목소리 모델을 만들 수 없음(한도 0) → 오류가 아니라 TTS 가 즉석 복제(녹음 참고)로 엄마 목소리를 냄
            return VoiceRegisterOut(model_id="", state="inline", sample_count=len(ss))
        logger.warning("voice register failed: %s %s", e.response.status_code, e.response.text[:200])
        raise HTTPException(502, "목소리를 등록하지 못했어요. 잠시 후 다시 해 주세요.")
    except httpx.RequestError:
        raise HTTPException(502, "목소리 서버에 연결하지 못했어요. 잠시 후 다시 해 주세요.")
    _voice_id_file(child_id).write_text(res["_id"], encoding="utf-8")
    return VoiceRegisterOut(model_id=res["_id"], state=res.get("state", ""), sample_count=len(ss))


class TtsIn(BaseModel):
    child_id: str
    text: str
    speed: float = Field(default=0.95, ge=0.6, le=1.1)


class TtsOut(BaseModel):
    url: str
    # 입 모양 맞추기: 0.04초마다 소리 크기(0~1). 앱이 재생 위치에 맞춰 아바타 입을 벌림 (기기가 소리 크기를 못 읽어도 정확히 맞음)
    env: list[float] | None = None
    env_ms: int = 40


ENV_MS = 40


def _mouth_envelope(child_id: str, key: str, mp3: Path) -> list[float] | None:
    """TTS mp3 -> 40ms 간격 소리 크기. 비공개 폴더에 캐시 (공개 /static 에는 mp3 만)"""
    cache = child_dir(child_id, "tts_env") / f"{key}.json"
    if cache.exists():
        try:
            return json.loads(cache.read_text(encoding="utf-8"))
        except ValueError:
            pass
    wav = tmp_path(".wav")
    try:
        to_wav(mp3, wav)
        pcm, sr = read_wav(wav)
    except Exception:
        return None
    finally:
        wav.unlink(missing_ok=True)
    hop = max(1, int(sr * ENV_MS / 1000))
    n = len(pcm) // hop
    if n == 0:
        return None
    rms = np.sqrt(np.mean(pcm[: n * hop].reshape(n, hop) ** 2, axis=1))
    ref = float(np.percentile(rms, 95)) or 1.0
    env = np.clip(rms / ref, 0, 1)
    env[env < 0.08] = 0.0  # 숨소리·잡음은 입을 닫음
    out = [round(float(v), 2) for v in env]
    cache.write_text(json.dumps(out), encoding="utf-8")
    return out


def _reference_samples(child_id: str, n: int = 6) -> list[dict]:  # Fish 권장 10~30초 → 6문장(약 10초+)
    """즉석 복제용 참고 음성: 품질 좋은 녹음 중 말한 시간이 긴 것 (가입 녹음 우선, 밤 낭독 포함)."""
    ss = [s for s in samples(child_id) if s["quality"]["ok"] and s.get("text")]
    ss.sort(key=lambda s: (s["kind"] != "signup", -s["features"]["speech_s"]))
    return ss[:n]


_EMOJI = re.compile("[🀀-🫿☀-➿️‍]")


def _speakable(text: str) -> str:
    """TTS 가 이상한 소리(웅얼거림·숨소리)로 읽는 기호 정리: 이모지, 물결(~), 말줄임(...), 반복 문장부호"""
    t = _EMOJI.sub("", text)
    t = re.sub(r"[~∼〜]+", "", t)
    t = re.sub(r"\.{2,}|…+", ", ", t)
    t = re.sub(r"([!?])[!?]+", r"\1", t)
    t = re.sub(r"\s*,\s*(,\s*)+", ", ", t)
    return re.sub(r"\s+", " ", t).strip(" ,")


@router.post("/tts", response_model=TtsOut)
def tts(body: TtsIn):
    """부모 목소리로 문장 읽기 → mp3 URL. 같은 문장은 캐시.
    목소리 모델이 있으면 모델로, 없으면(무료 등급) 부모 녹음을 함께 보내 즉석 복제."""
    try:
        id_file = _voice_id_file(body.child_id)
    except ValueError:
        raise HTTPException(400, "아이 정보를 찾지 못했어요. 앱을 다시 열고 한 번 더 해 주세요.")
    body.text = _speakable(body.text)
    if not body.text:
        raise HTTPException(400, "읽을 문장이 없어요. 문장을 확인해 주세요.")
    model_id = id_file.read_text(encoding="utf-8").strip() if id_file.exists() else ""
    refs = [] if model_id else _reference_samples(body.child_id)
    if not model_id and not refs:
        raise HTTPException(400, "아직 부모님 목소리 녹음이 없어요. 가입 화면에서 목소리를 먼저 녹음해 주세요.")
    voice_key = model_id or "inline:" + ",".join(r["wav"].name for r in refs)
    key = hashlib.sha1(f"{voice_key}:{body.speed}:{body.text}".encode()).hexdigest()[:16]
    out = public_dir(body.child_id, "tts") / f"{key}.mp3"
    if not out.exists():
        try:
            if model_id:
                fish.synthesize(body.text, model_id, out, speed=body.speed)
            else:
                fish.synthesize_inline(body.text, [(r["wav"].read_bytes(), r["text"]) for r in refs], out, speed=body.speed)
        except RuntimeError as e:
            logger.warning("tts unavailable: %s", e)
            raise HTTPException(503, "지금은 부모님 목소리로 말할 수 없어요. 잠시 후 다시 해 주세요.")
        except httpx.HTTPStatusError as e:
            out.unlink(missing_ok=True)
            logger.warning("tts failed: %s %s", e.response.status_code, e.response.text[:200])
            raise HTTPException(502, "부모님 목소리를 만들지 못했어요. 잠시 후 다시 해 주세요.")
        except httpx.RequestError:
            out.unlink(missing_ok=True)
            raise HTTPException(502, "목소리 서버에 연결하지 못했어요. 잠시 후 다시 해 주세요.")
    return TtsOut(url=public_url(out), env=_mouth_envelope(body.child_id, key, out), env_ms=ENV_MS)


# ---------- 아이 말소리 클립 (소음 감지로 자동 녹음 → 부모가 나중에 들음) — 담당: 태희 ----------
# 비공개 server/data/children/<id>/child/clips 에 저장, 로그인 토큰으로만 재생 (공개 /static 아님)
import time as _time  # noqa: E402

from fastapi.responses import FileResponse  # noqa: E402

MIN_CLIP_SPEECH_S = 0.25


class ChildClipIn(BaseModel):
    child_id: str
    audio_b64: str
    ext: str = "m4a"
    item: str = ""        # 그때 보던 사물 (사과 등)
    phase: str = ""       # object | repeat | free
    expected: str = ""    # 따라 말하기 목표 ('사과|apple')


class ChildClipOut(BaseModel):
    saved: bool
    id: str | None = None
    text: str = ""
    matched: bool | None = None
    alert: bool = False
    features: SpeechFeatures | None = None


def _clip_dir(child_id: str) -> Path:
    return child_dir(child_id, "child", "clips")


@router.post("/child-clip-b64", response_model=ChildClipOut)
def child_clip(body: ChildClipIn):
    """아이 말소리 한 토막 → 말소리가 있으면 저장 + 받아쓰기. 조용하면 저장 안 함."""
    try:
        d = _clip_dir(body.child_id)
    except ValueError:
        raise HTTPException(400, "아이 정보를 찾지 못했어요. 앱을 다시 열고 한 번 더 해 주세요.")
    src = _b64_to_tmp(body.audio_b64, body.ext)
    clip_id = f"{int(_time.time() * 1000)}"
    wav = d / f"{clip_id}.wav"
    try:
        to_wav(src, wav)
    except Exception:
        raise HTTPException(400, "녹음을 읽지 못했어요. 한 번 더 녹음해 주세요.")
    finally:
        src.unlink(missing_ok=True)
    pcm, sr = read_wav(wav)
    feats = speech_features(pcm, sr)
    if feats["speech_s"] < MIN_CLIP_SPEECH_S:
        wav.unlink(missing_ok=True)
        return ChildClipOut(saved=False, features=SpeechFeatures(**feats))
    text = ""
    try:
        # 따라 말하기는 짧은 한 단어라 힌트 없이는 "."/빈칸으로 나오는 일이 많음 → 목표 단어를 문장 힌트로.
        # (말 없는 잡음이 그 단어로 인식될 수 있지만 아이에게 틀림 표시를 하지 않는 원칙상 감수. 자유 대화엔 힌트 없음)
        ko = next((w for w in body.expected.split("|") if re.search(r"[가-힣]", w)), "")
        text = transcribe(wav, prompt=f"따라 말하기: {ko}") if body.phase == "repeat" and ko else transcribe(wav)
    except Exception:
        pass  # STT 키가 없거나 실패해도 소리는 저장 (부모가 들을 수 있게)
    if not re.search(r"[가-힣A-Za-z]", text):
        text = ""  # "." 처럼 기호만 나오면 말 없음으로
    feats = speech_features(pcm, sr, text)
    matched = match_expected(text, body.expected) if body.expected and text else None
    alert = any(w in text for w in ALERT_WORDS)
    meta = {"id": clip_id, "at": _time.time(), "item": body.item, "phase": body.phase, "text": text,
            "matched": matched, "alert": alert, "features": feats}
    wav.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
    return ChildClipOut(saved=True, id=clip_id, text=text, matched=matched, alert=alert, features=SpeechFeatures(**feats))


@router.get("/child-clips/{child_id}")
def child_clips(child_id: str, day: str | None = None) -> list[dict]:
    """부모 리포트: 아이 말소리 클립 목록 (최신순, day=YYYY-MM-DD 로 그날만)."""
    try:
        d = _clip_dir(child_id)
    except ValueError:
        raise HTTPException(400, "아이 정보를 찾지 못했어요. 앱을 다시 열고 한 번 더 해 주세요.")
    out = []
    for f in sorted(d.glob("*.json"), reverse=True)[:200]:
        m = json.loads(f.read_text(encoding="utf-8"))
        if day and _time.strftime("%Y-%m-%d", _time.localtime(m["at"])) != day:
            continue
        out.append({k: m.get(k) for k in ("id", "at", "item", "phase", "text", "matched", "alert")} | {"duration_s": m["features"]["duration_s"]})
    return out


@router.get("/child-clip/{child_id}/{clip_id}")
def child_clip_audio(child_id: str, clip_id: str):
    """클립 재생 (로그인 토큰 필요)."""
    if not clip_id.isdigit():
        raise HTTPException(400, "녹음을 찾지 못했어요. 목록을 새로 고친 뒤 다시 눌러 주세요.")
    try:
        f = _clip_dir(child_id) / f"{clip_id}.wav"
    except ValueError:
        raise HTTPException(400, "아이 정보를 찾지 못했어요. 앱을 다시 열고 한 번 더 해 주세요.")
    if not f.exists():
        raise HTTPException(404, "이 녹음은 이제 없어요. 목록을 새로 고쳐 주세요.")
    return FileResponse(f, media_type="audio/wav")
