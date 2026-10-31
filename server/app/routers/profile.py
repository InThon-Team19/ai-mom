# (임시) 가입 정보·설정·진행 일차 + 태블릿 연결 코드(재발급)·등록 기기·학습 이력 — 초안: 태희 → 민주 children API 생기면 교체
# child_id 는 데이터 폴더 이름(바뀌지 않음), linkCode 는 태블릿 연결용(재발급 가능)
import json
import secrets
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.routers.activity import summarize as summarize_day
from app.storage import DATA_DIR, child_dir

router = APIRouter(tags=["profile (임시)"])
CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _file(child_id: str) -> Path:
    try:
        return child_dir(child_id) / "profile.json"
    except ValueError:
        raise HTTPException(400, "child_id 형식 오류")


def _load(child_id: str) -> dict:
    f = _file(child_id)
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}


def _save(child_id: str, p: dict) -> dict:
    _file(child_id).write_text(json.dumps(p, ensure_ascii=False), encoding="utf-8")
    return p


# ---------- 연결 코드 → child_id ----------
def _links_path() -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return DATA_DIR / "links.json"


def _links() -> dict[str, str]:
    p = _links_path()
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def _set_code(child_id: str, code: str) -> None:
    links = {k: v for k, v in _links().items() if v != child_id}  # 이전 코드 무효화
    links[code] = child_id
    _links_path().write_text(json.dumps(links), encoding="utf-8")


def _new_code() -> str:
    links = _links()
    while True:
        code = "".join(secrets.choice(CODE_CHARS) for _ in range(6))
        if code not in links:
            return code


# ---------- 프로필 ----------
@router.get("/profile/{child_id}")
def get_profile(child_id: str) -> dict:
    p = _load(child_id)
    if not p:
        raise HTTPException(404, "프로필이 없어요")
    return p


@router.put("/profile/{child_id}")
def put_profile(child_id: str, body: dict) -> dict:
    """프로필 일부 저장 (얕은 병합). 연결 코드·기기 목록은 전용 API 로만 바뀜."""
    cur = _load(child_id)
    body = {k: v for k, v in body.items() if k not in ("linkCode", "devices")}
    cur.update(body)
    if not cur.get("linkCode"):  # 처음 저장: 연결 코드 = child_id (이전 버전 호환)
        cur["linkCode"] = child_id
        _set_code(child_id, child_id)
    return _save(child_id, cur)


@router.get("/link/{code}")
def link(code: str) -> dict:
    """태블릿: 연결 코드로 프로필 받기. 재발급된 이전 코드는 404."""
    code = code.strip().upper()
    child_id = _links().get(code)
    if not child_id:
        # 연결 코드 기능 이전에 가입한 프로필: 코드 = child_id 로 처음 연결 허용
        try:
            p = _load(code)
        except HTTPException:
            p = {}
        if p and not p.get("linkCode"):
            p["linkCode"] = code
            _set_code(code, code)
            _save(code, p)
            child_id = code
        else:
            raise HTTPException(404, "연결 코드를 찾을 수 없어요")
    return get_profile(child_id)


@router.post("/profile/{child_id}/link-code")
def reissue_code(child_id: str) -> dict:
    """연결 코드 재발급 → 이전 코드로는 새로 연결 불가, 기존 아이 기기 연결도 해제."""
    p = _load(child_id)
    if not p:
        raise HTTPException(404, "프로필이 없어요")
    code = _new_code()
    _set_code(child_id, code)
    p["linkCode"] = code
    p["devices"] = [d for d in p.get("devices", []) if d.get("role") != "child"]
    _save(child_id, p)
    return {"linkCode": code}


# ---------- 등록 기기 ----------
class DeviceIn(BaseModel):
    device_id: str
    role: str  # parent | child
    name: str = ""


@router.post("/profile/{child_id}/devices")
def register_device(child_id: str, d: DeviceIn) -> dict:
    if d.role not in ("parent", "child"):
        raise HTTPException(400, "role 은 parent | child")
    p = _load(child_id)
    if not p:
        raise HTTPException(404, "프로필이 없어요")
    devices = [x for x in p.get("devices", []) if x.get("device_id") != d.device_id]
    old = next((x for x in p.get("devices", []) if x.get("device_id") == d.device_id), {})
    devices.append({**d.model_dump(), "linked_at": old.get("linked_at", time.time()), "last_seen": time.time()})
    p["devices"] = devices
    _save(child_id, p)
    return {"devices": devices}


@router.delete("/profile/{child_id}/devices/{device_id}")
def remove_device(child_id: str, device_id: str) -> dict:
    p = _load(child_id)
    p["devices"] = [x for x in p.get("devices", []) if x.get("device_id") != device_id]
    _save(child_id, p)
    return {"devices": p["devices"]}


# ---------- 학습 이력 ----------
def _read_json(paths) -> list[tuple[Path, dict]]:
    out = []
    for f in paths:
        try:
            out.append((f, json.loads(f.read_text(encoding="utf-8"))))
        except (OSError, ValueError):
            continue
    return out


@router.get("/profile/{child_id}/history")
def history(child_id: str) -> dict:
    """설정 탭 학습 이력: 부모 목소리·입모양 낭독 기록(최신순) + 아이 하루 요약(최신순)."""
    try:
        base = child_dir(child_id)
    except ValueError:
        raise HTTPException(400, "child_id 형식 오류")
    voice = [
        {"kind": f.parent.name, "text": d.get("text", ""), "at": f.stat().st_mtime,
         "ok": d.get("quality", {}).get("ok", False), "speech_s": d.get("features", {}).get("speech_s", 0)}
        for f, d in _read_json((base / "parent" / "voice").glob("*/sample_*.json"))
    ]
    mouth = [
        {"kind": f.parent.name, "text": d.get("text", ""), "at": f.stat().st_mtime,
         "ok": d.get("face_ratio", 0) >= 0.6, "face_s": d.get("face_s", 0)}
        for f, d in _read_json((base / "parent" / "mouth").glob("*/profile_*.json"))
    ]
    days = []
    for f in sorted((base / "activity").glob("*.jsonl"), reverse=True)[:14]:
        events = [json.loads(line) for line in f.read_text(encoding="utf-8").splitlines() if line]
        s = summarize_day(events, f.stem)
        days.append({"day": s.day, "sessions": s.sessions, "touches": s.touches, "repeats": s.repeats,
                     "repeat_ok": s.repeat_ok, "words": s.words, "gaze_s": s.gaze_s})
    voice.sort(key=lambda x: x["at"], reverse=True)
    mouth.sort(key=lambda x: x["at"], reverse=True)
    return {"voice": voice[:50], "mouth": mouth[:50], "days": days}
