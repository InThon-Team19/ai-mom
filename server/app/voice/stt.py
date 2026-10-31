"""STT (OpenAI). 담당: 태희"""
import os
from pathlib import Path

from openai import OpenAI

from app.config import OPENAI_API_KEY

STT_MODEL = os.getenv("STT_MODEL", "gpt-4o-mini-transcribe")
_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY 가 server/.env 에 없음")
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


def transcribe(wav: Path, prompt: str = "") -> str:
    """16kHz wav → 한국어 텍스트. prompt 에 기대 문장(따라 말하기 목표)을 주면 인식이 좋아짐."""
    with wav.open("rb") as f:
        res = _get_client().audio.transcriptions.create(
            model=STT_MODEL, file=f, language="ko", prompt=prompt or None,
        )
    return (res.text or "").strip()
