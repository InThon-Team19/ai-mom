"""LLM 클라이언트 — Lablup Token Factory (Anthropic 호환 엔드포인트). 담당: 태희(연결) · 충항(에이전트에서 사용)

server/.env:
  ANTHROPIC_BASE_URL=https://api.console.lablup.ai/anthropic
  ANTHROPIC_AUTH_TOKEN=...
  ANTHROPIC_MODEL=DeepSeek-V4.1-Flash-B300

사용 (충항):
  from app.llm import chat
  reply = chat("너는 아이와 대화하는 엄마야...", [{"role": "user", "content": "사과 좋아"}])
"""
import os

import anthropic
from dotenv import load_dotenv

load_dotenv()

MODEL = os.getenv("ANTHROPIC_MODEL", "DeepSeek-V4.1-Flash-B300")
_client: anthropic.Anthropic | None = None


def client() -> anthropic.Anthropic:
    """ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN 은 SDK 가 환경변수에서 직접 읽음."""
    global _client
    if _client is None:
        if not os.getenv("ANTHROPIC_AUTH_TOKEN") and not os.getenv("ANTHROPIC_API_KEY"):
            raise RuntimeError("ANTHROPIC_AUTH_TOKEN 이 server/.env 에 없음")
        _client = anthropic.Anthropic(timeout=15.0, max_retries=0)
    return _client


def chat(system: str, messages: list[dict], max_tokens: int = 1024) -> str:
    """한 번 호출 → 텍스트 답. messages 는 [{"role": "user"|"assistant", "content": str}, ...]."""
    res = client().messages.create(model=MODEL, max_tokens=max_tokens, system=system, messages=messages)
    return "".join(b.text for b in res.content if b.type == "text").strip()
