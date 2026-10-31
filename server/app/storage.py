"""업로드·생성 파일 저장 위치 (server/static, git 제외). 담당: 태희"""
import os
import re
import uuid
from contextvars import ContextVar
from pathlib import Path

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

# 파일 URL 의 앞부분. 기본은 "요청이 들어온 주소" (LAN IP·터널 어디서든 맞게).
# PUBLIC_BASE_URL 을 .env 에 적으면 그 값으로 고정.
FIXED_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
request_base_url: ContextVar[str] = ContextVar("request_base_url", default="http://localhost:8000")


def safe_id(raw: str) -> str:
    """경로에 쓸 수 있는 id 로 정리 (영문·숫자·-_ 만)."""
    cleaned = re.sub(r"[^A-Za-z0-9_-]", "", raw)[:64]
    if not cleaned:
        raise ValueError("invalid id")
    return cleaned


def child_dir(child_id: str, *sub: str) -> Path:
    d = STATIC_DIR.joinpath("children", safe_id(child_id), *sub)
    d.mkdir(parents=True, exist_ok=True)
    return d


def tmp_path(suffix: str) -> Path:
    d = STATIC_DIR / "tmp"
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{uuid.uuid4().hex}{suffix}"


def public_url(path: Path) -> str:
    rel = path.resolve().relative_to(STATIC_DIR).as_posix()
    return f"{FIXED_BASE_URL or request_base_url.get()}/static/{rel}"
