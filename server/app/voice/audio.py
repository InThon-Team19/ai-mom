"""오디오 변환·말하기 특성 (ffmpeg 는 imageio-ffmpeg 번들 사용). 담당: 태희

기획 2-1-1 ⑤ AI 특성 분석: 발화 간격, 톤 변화, 말 속도 + 학습률 화면의 문장별 음성 품질 표시
"""
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np

SR = 16000
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
FRAME_S = 0.03


def to_wav(src: Path, dst: Path, sr: int = SR) -> Path:
    """m4a·mp4·webm 등 → 16kHz mono wav. 영상이면 오디오만 뽑힘."""
    subprocess.run(
        [FFMPEG, "-y", "-loglevel", "error", "-i", str(src), "-vn", "-ac", "1", "-ar", str(sr), str(dst)],
        check=True,
    )
    return dst


def read_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as w:
        sr = w.getframerate()
        raw = w.readframes(w.getnframes())
        width = w.getsampwidth()
    if width != 2:
        raise ValueError("16-bit wav only")
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0, sr


def _frames(pcm: np.ndarray, sr: int) -> tuple[np.ndarray, int]:
    frame = int(sr * FRAME_S) or 1
    n = len(pcm) // frame
    return pcm[: n * frame].reshape(n, frame), frame


def _pitch(frame: np.ndarray, sr: int) -> float | None:
    """자기상관으로 기본 주파수(Hz). 75~500Hz 밖이거나 주기성이 약하면 None."""
    x = frame - frame.mean()
    if not x.any():
        return None
    ac = np.correlate(x, x, mode="full")[len(x) - 1:]
    lo, hi = int(sr / 500), min(int(sr / 75), len(ac) - 1)
    if hi <= lo:
        return None
    lag = lo + int(np.argmax(ac[lo:hi]))
    if ac[lag] < 0.3 * ac[0]:
        return None
    return sr / lag


def speech_features(pcm: np.ndarray, sr: int, text: str = "") -> dict:
    """길이·발화 비율·말 속도·발화 간격·음높이·잡음 → 품질 판정까지."""
    frames, frame = _frames(pcm, sr)
    duration = len(pcm) / sr if sr else 0.0
    empty = {"duration_s": round(duration, 2), "speech_s": 0.0, "speech_ratio": 0.0, "syllables_per_s": 0.0,
             "volume": 0.0, "pause_mean_s": 0.0, "pitch_hz": 0.0, "pitch_var": 0.0, "snr_db": 0.0}
    if len(frames) == 0:
        return empty
    rms = np.sqrt(np.mean(frames ** 2, axis=1))
    noise = float(np.percentile(rms, 10))
    # 잡음 바닥 x3 (단, 최대 음량의 절반을 넘지 않게), 절대 하한 0.01
    threshold = max(0.01, min(noise * 3, float(rms.max()) * 0.5))
    voiced = rms > threshold
    speech_s = float(voiced.sum()) * frame / sr
    if speech_s == 0:
        return empty

    # 발화 간격: 말소리 사이 0.15초 이상 쉰 구간의 평균 길이
    pauses, run = [], 0
    started = False
    for v in voiced:
        if v:
            if started and run * FRAME_S >= 0.15:
                pauses.append(run * FRAME_S)
            started, run = True, 0
        else:
            run += 1

    # 음높이: 말소리 프레임 (최대 200개 샘플링)
    idx = np.flatnonzero(voiced)
    if len(idx) > 200:
        idx = idx[np.linspace(0, len(idx) - 1, 200).astype(int)]
    pitches = [p for p in (_pitch(frames[i], sr) for i in idx) if p]
    pitch = float(np.median(pitches)) if pitches else 0.0
    # 톤 변화: 음높이의 변동계수 (반음 단위가 아니라 단순 비율, 비교용)
    pitch_var = float(np.std(pitches) / pitch) if len(pitches) > 3 and pitch else 0.0

    syllables = sum(1 for ch in text if "가" <= ch <= "힣") or len(text.split())
    volume = float(rms[voiced].mean())
    return {
        "duration_s": round(duration, 2),
        "speech_s": round(speech_s, 2),
        "speech_ratio": round(float(voiced.mean()), 3),
        "syllables_per_s": round(syllables / speech_s, 2) if text else 0.0,
        "volume": round(volume, 4),
        "pause_mean_s": round(float(np.mean(pauses)), 2) if pauses else 0.0,
        "pitch_hz": round(pitch, 1),
        "pitch_var": round(pitch_var, 3),
        "snr_db": round(float(20 * np.log10(volume / max(noise, 1e-5))), 1),
    }


def quality(f: dict) -> dict:
    """학습률 화면의 문장별 음성 품질 표시 (조용한 곳인지, 목소리가 충분한지)."""
    quiet = bool(f["snr_db"] >= 15)
    loud = bool(f["volume"] >= 0.02 and f["speech_s"] >= 1.0)
    if not loud:
        msg = "목소리가 작거나 짧아요. 조금 더 크게 읽어 주세요."
    elif not quiet:
        msg = "주변 소리가 커요. 조용한 곳에서 다시 읽어 주세요."
    else:
        msg = "좋아요!"
    return {"ok": quiet and loud, "quiet": quiet, "loud": loud, "message": msg}
