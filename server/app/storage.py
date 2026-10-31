"""업로드·생성 파일 저장 위치 (server/static, git 제외). 담당: 태희"""
import re
import uuid
from pathlib import Path

from app.config import PUBLIC_BASE_URL

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


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
    return f"{PUBLIC_BASE_URL}/static/{rel}"
