"""파일 저장 위치. 담당: 태희

- DATA_DIR (server/data, 비공개): 부모 음성·입모양 수치·아이 반응 기록 — URL 로 노출하지 않음 (기획 4장: 생체·영유아 데이터 보호)
- STATIC_DIR (server/static, 공개 /static): 아바타가 말할 TTS mp3 처럼 앱이 재생해야 하는 파일만
"""
import os
import re
import uuid
from contextvars import ContextVar
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = Path(os.getenv("STATIC_DIR", ROOT / "static"))  # 배포: /data/static (디스크) → 다시 배포해도 만든 엄마 목소리 mp3 가 남음
DATA_DIR = Path(os.getenv("DATA_DIR", ROOT / "data"))

# 공개 파일 URL 앞부분. 기본은 "요청이 들어온 주소" (LAN IP·터널 어디서든 맞게). PUBLIC_BASE_URL 로 고정 가능
# Render 는 RENDER_EXTERNAL_URL(https 공개 주소)을 자동으로 줌 → 프록시 뒤에서 http 로 보이는 주소 대신 그걸 씀
FIXED_BASE_URL = (os.getenv("PUBLIC_BASE_URL") or os.getenv("RENDER_EXTERNAL_URL") or "").rstrip("/")
request_base_url: ContextVar[str] = ContextVar("request_base_url", default="http://localhost:8000")


def safe_id(raw: str) -> str:
    """경로에 쓸 수 있는 id 로 정리 (영문·숫자·-_ 만)."""
    cleaned = re.sub(r"[^A-Za-z0-9_-]", "", raw)[:64]
    if not cleaned:
        raise ValueError("invalid id")
    return cleaned


def child_dir(child_id: str, *sub: str) -> Path:
    """비공개 데이터 폴더 server/data/children/<id>/..."""
    d = DATA_DIR.joinpath("children", safe_id(child_id), *sub)
    d.mkdir(parents=True, exist_ok=True)
    return d


def public_dir(child_id: str, *sub: str) -> Path:
    """공개 폴더 server/static/children/<id>/... (TTS mp3 등)"""
    d = STATIC_DIR.joinpath("children", safe_id(child_id), *sub)
    d.mkdir(parents=True, exist_ok=True)
    return d


def tmp_path(suffix: str) -> Path:
    d = DATA_DIR / "tmp"
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{uuid.uuid4().hex}{suffix}"


def public_url(path: Path) -> str:
    rel = path.resolve().relative_to(STATIC_DIR.resolve()).as_posix()
    return f"{FIXED_BASE_URL or request_base_url.get()}/static/{rel}"
