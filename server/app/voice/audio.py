"""오디오 변환·특성 (ffmpeg 는 imageio-ffmpeg 번들 사용). 담당: 태희"""
import subprocess
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np

SR = 16000
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


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
    pcm = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    return pcm, sr


def speech_features(pcm: np.ndarray, sr: int, text: str = "") -> dict:
    """길이, 발화 비율, 말 속도(초당 음절). 한국어는 한글 글자 수 ≈ 음절 수."""
    duration = len(pcm) / sr if sr else 0.0
    frame = int(sr * 0.03) or 1
    n = len(pcm) // frame
    if n == 0:
        return {"duration_s": round(duration, 2), "speech_ratio": 0.0, "speech_s": 0.0,
                "syllables_per_s": 0.0, "volume": 0.0}
    rms = np.sqrt(np.mean(pcm[: n * frame].reshape(n, frame) ** 2, axis=1))
    # 잡음 바닥 x3 (단, 최대 음량의 절반을 넘지 않게), 절대 하한 0.01
    threshold = max(0.01, min(float(np.percentile(rms, 10)) * 3, float(rms.max()) * 0.5))
    voiced = rms > threshold
    speech_s = float(voiced.sum()) * frame / sr
    syllables = sum(1 for ch in text if "\uac00" <= ch <= "\ud7a3") or len(text.split())
    return {
        "duration_s": round(duration, 2),
        "speech_s": round(speech_s, 2),
        "speech_ratio": round(float(voiced.mean()), 3),
        "syllables_per_s": round(syllables / speech_s, 2) if speech_s > 0 and text else 0.0,
        "volume": round(float(rms[voiced].mean()) if voiced.any() else 0.0, 4),
    }
