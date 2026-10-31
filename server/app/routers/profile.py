# (임시) 가입 정보·설정·진행 일차 저장 + 태블릿 연결 — 초안: 태희 → 민주 children API 생기면 교체
# 부모 앱이 저장한 내용을 아이 태블릿이 연결 코드(= child_id)로 불러옴. 화면 흐름 시연용 최소 구현
import json

from fastapi import APIRouter, HTTPException

from app.storage import child_dir

router = APIRouter(prefix="/profile", tags=["profile (임시)"])


def _file(child_id: str):
    try:
        return child_dir(child_id) / "profile.json"
    except ValueError:
        raise HTTPException(400, "child_id 형식 오류")


@router.get("/{child_id}")
def get_profile(child_id: str) -> dict:
    """연결 코드로 프로필 조회 (아이 태블릿 연결). 없으면 404."""
    f = _file(child_id)
    if not f.exists():
        raise HTTPException(404, "연결 코드를 찾을 수 없어요")
    return json.loads(f.read_text(encoding="utf-8"))


@router.put("/{child_id}")
def put_profile(child_id: str, body: dict) -> dict:
    """프로필 전체 또는 일부 저장 (얕은 병합). 예: {child:{...}, parent:{...}, avatar:{...}, settings:{...}, day:1, feedback:[...]}"""
    f = _file(child_id)
    cur = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
    cur.update(body)
    f.write_text(json.dumps(cur, ensure_ascii=False), encoding="utf-8")
    return cur
