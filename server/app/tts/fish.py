"""Fish Audio TTS — 부모 목소리 복제 + 합성. 초안: 태희 → 담당: 민주 (이어서 다듬기)

무료 모델 s2.1-pro-free (fair use, 한국어·목소리 복제 지원). server/.env 에 FISH_API_KEY 필요.
1) register_voice: 부모 녹음 wav 들 → POST https://api.fish.audio/model (train_mode=fast) → 모델 id
2) synthesize: 텍스트 + 모델 id → POST https://api.fish.audio/v1/tts → mp3
3) synthesize_inline: 모델 없이 부모 녹음(참고 음성)을 함께 보내 즉석 복제 → mp3
   무료 등급은 API 모델 생성 한도가 0이라(403) 이 방식으로 엄마 목소리를 냄 (2026-10-31 실측: 무료 키로 200)
"""
import os
from pathlib import Path

import httpx

API = "https://api.fish.audio"
TTS_MODEL = os.getenv("FISH_TTS_MODEL", "s2.1-pro-free")


def _key() -> str:
    key = os.getenv("FISH_API_KEY", "")
    if not key:
        raise RuntimeError("FISH_API_KEY 가 server/.env 에 없음")
    return key


def register_voice(title: str, wavs: list[Path], texts: list[str] | None = None) -> dict:
    """녹음 1~20개로 목소리 모델 생성. texts 를 안 주면 Fish 가 자동 받아쓰기. 반환: {_id, state, ...}"""
    if not wavs:
        raise ValueError("목소리 샘플이 없음")
    files = [("voices", (p.name, p.read_bytes(), "audio/wav")) for p in wavs[:20]]
    data = {"type": "tts", "title": title, "train_mode": "fast",
            "visibility": "private", "enhance_audio_quality": "true"}
    if texts:
        data["texts"] = texts[:20]
    res = httpx.post(f"{API}/model", headers={"Authorization": f"Bearer {_key()}"},
                     data=data, files=files, timeout=120)
    res.raise_for_status()
    return res.json()


def model_state(model_id: str) -> str:
    """created | training | trained | failed"""
    res = httpx.get(f"{API}/model/{model_id}", headers={"Authorization": f"Bearer {_key()}"}, timeout=30)
    res.raise_for_status()
    return res.json().get("state", "")


def synthesize(text: str, model_id: str, out: Path, speed: float = 0.95) -> Path:
    """텍스트 → mp3 (아이용으로 살짝 느리게)."""
    res = httpx.post(
        f"{API}/v1/tts",
        headers={"Authorization": f"Bearer {_key()}", "model": TTS_MODEL},
        json={"text": text, "reference_id": model_id, "format": "mp3", "language": "ko",
              "latency": "balanced", "prosody": {"speed": speed}},
        timeout=60,
    )
    res.raise_for_status()
    out.write_bytes(res.content)
    return out


def synthesize_inline(text: str, refs: list[tuple[bytes, str]], out: Path, speed: float = 0.95) -> Path:
    """모델 생성 없이 참고 음성(wav 바이트, 그 대본) 1~5개로 즉석 복제 → mp3. references 는 MessagePack 필수."""
    import ormsgpack

    if not refs:
        raise ValueError("참고 음성이 없음")
    body = {"text": text, "references": [{"audio": a, "text": t} for a, t in refs[:5]], "format": "mp3",
            "latency": "balanced", "prosody": {"speed": speed}}
    res = httpx.post(
        f"{API}/v1/tts",
        content=ormsgpack.packb(body),
        headers={"Authorization": f"Bearer {_key()}", "Content-Type": "application/msgpack", "model": TTS_MODEL},
        timeout=90,
    )
    res.raise_for_status()
    out.write_bytes(res.content)
    return out
