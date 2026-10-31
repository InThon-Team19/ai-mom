"""STT — OpenAI 호환 API. 담당: 태희

기본: Groq 무료 등급 (Whisper, 카드 불필요) → server/.env 에 GROQ_API_KEY 만 넣으면 됨
대안: OpenAI (선불 크레딧 필요) → OPENAI_API_KEY 를 넣고 GROQ_API_KEY 는 비우기
직접 지정: STT_BASE_URL / STT_API_KEY / STT_MODEL
"""
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

_GROQ = os.getenv("GROQ_API_KEY", "")
_OPENAI = os.getenv("OPENAI_API_KEY", "")

if os.getenv("STT_API_KEY"):
    API_KEY, BASE_URL = os.getenv("STT_API_KEY", ""), os.getenv("STT_BASE_URL") or None
    DEFAULT_MODEL = "whisper-1"
elif _GROQ:
    API_KEY, BASE_URL, DEFAULT_MODEL = _GROQ, "https://api.groq.com/openai/v1", "whisper-large-v3-turbo"
else:
    API_KEY, BASE_URL, DEFAULT_MODEL = _OPENAI, None, "gpt-4o-mini-transcribe"

STT_MODEL = os.getenv("STT_MODEL") or DEFAULT_MODEL
_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        if not API_KEY:
            raise RuntimeError("STT 키가 server/.env 에 없음 (GROQ_API_KEY 또는 OPENAI_API_KEY)")
        _client = OpenAI(api_key=API_KEY, base_url=BASE_URL)
    return _client


def transcribe(wav: Path, prompt: str = "") -> str:
    """16kHz wav → 한국어 텍스트. prompt 에 기대 단어(따라 말하기 목표)를 주면 인식이 좋아짐."""
    with wav.open("rb") as f:
        res = _get_client().audio.transcriptions.create(
            model=STT_MODEL, file=f, language="ko", prompt=prompt or None,
        )
    return (res.text or "").strip()
