"""STT — OpenAI 호환 API. 담당: 태희

기본: Groq 무료 등급 (Whisper, 카드 불필요) → server/.env 에 GROQ_API_KEY 만 넣으면 됨
대안: OpenAI (선불 크레딧 필요) → OPENAI_API_KEY 를 넣고 GROQ_API_KEY 는 비우기
직접 지정: STT_BASE_URL / STT_API_KEY / STT_MODEL
"""
import os
import re
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
    text = (res.text or "").strip()
    # 말이 아닌 소리(삐 소리·TV·잡음)에 Whisper 가 힌트를 그대로 되읊음 ("사과, apple,") → 맞게 말한 것으로 잘못 기록되지 않게 버림.
    # 아이가 실제로 "사과"라고 하면 "사과"만 나오므로 구별됨 (Groq 는 no_speech_prob 를 항상 0 으로 줘서 그 값으로는 못 거름)
    if prompt and _norm(text) == _norm(prompt):
        return ""
    return clean_hallucination(text)


def _norm(s: str) -> str:
    return re.sub(r"[\s,.!?·~]+", "", s).lower()


# Whisper 는 조용하거나 알아듣기 힘든 소리에 방송 자막 문구를 지어냄 (예: "한국자막 by 한효정", "시청해 주셔서 감사합니다").
# 아이 말소리는 짧고 불분명해서 자주 생김 → 이런 문구는 빈 문자열로 (부모 리포트에 엉뚱한 말이 남지 않게)
_HALLUCINATION = re.compile(
    r"자막|subtitle|시청해\s*주셔서|구독|좋아요\s*(와|랑)?\s*알림|다음\s*영상|MBC|KBS|SBS|YTN|JTBC|뉴스\s*\S*입니다",
    re.IGNORECASE,
)


# 문장 전체가 방송 마무리 인사뿐이면 지어낸 것 (2~5세 아이가 이 말만 하는 일은 드묾)
_CLOSING_ONLY = re.compile(r"^(감사합니다|고맙습니다|수고하셨습니다|안녕히\s*계세요|이\s*시각\s*\S*였습니다)[.!]?$")


def clean_hallucination(text: str) -> str:
    return "" if text and (_HALLUCINATION.search(text) or _CLOSING_ONLY.match(text)) else text
