"""Authenticated compatibility endpoints backed by the shared family database."""
import json
from typing import Literal

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import delete, update
from sqlmodel import select

from app.auth import DB, ParentAuth, Principal, digest, issue_token, owned, rate_limit
from app.family import merge_profile, profile_view, rotate_link
from app.models import AccessToken, Child, ConversationSession, Device, FamilyProfile, Persona, RegisteredClient, now
from app.routers.accounts import set_session_cookie
from app.routers.activity import summarize
from app.storage import child_dir

router = APIRouter(tags=["family profiles"])


def scoped_child(db, token, child_id, lock=False):
    child = db.exec(select(Child).where(Child.id == child_id).with_for_update()).first() if lock else db.get(Child, child_id)
    if not child or child.parent_id != token.parent_id:
        raise HTTPException(404, "프로필을 찾을 수 없어요")
    if token.device_id and db.get(Device, token.device_id).child_id != child.id:
        raise HTTPException(404, "프로필을 찾을 수 없어요")
    return child


@router.get("/profile/{child_id}")
def get_profile(child_id: str, token: Principal, db: DB):
    child = scoped_child(db, token, child_id)
    return profile_view(db, child, parent=not token.device_id)


@router.put("/profile/{child_id}")
def put_profile(child_id: str, body: dict, token: ParentAuth, db: DB):
    child = scoped_child(db, token, child_id, lock=True)
    merge_profile(db, child, body)
    db.commit()
    return profile_view(db, child, parent=True)


def revoke(db, devices):
    for device in devices:
        device.revoked_at = now()
        db.add(device)
        db.exec(update(AccessToken).where(AccessToken.device_id == device.id).values(revoked_at=now()))
        db.exec(update(ConversationSession).where(ConversationSession.device_id == device.id,
                                                ConversationSession.status == "active").values(status="ended", ended_at=now()))


@router.post("/profile/{child_id}/link-code")
def reissue_code(child_id: str, token: ParentAuth, db: DB):
    child = scoped_child(db, token, child_id, lock=True)
    revoke(db, db.exec(select(Device).where(Device.child_id == child.id, Device.revoked_at.is_(None))).all())
    db.exec(delete(RegisteredClient).where(RegisteredClient.child_id == child.id, RegisteredClient.role == "child"))
    code = rotate_link(db, child)
    db.commit()
    return {"linkCode": code, "expires_at": db.get(FamilyProfile, child.id).link_expires_at}


@router.get("/link/{code}")
def link(code: str, request: Request, response: Response, db: DB):
    rate_limit(db, "legacy-pair:" + digest(request.client.host if request.client else "local"), 5)
    hashed = digest(code.strip().upper())
    record = db.exec(select(FamilyProfile).where(FamilyProfile.link_hash == hashed,
                                                FamilyProfile.link_expires_at > now()).with_for_update()).first()
    if not record:
        raise HTTPException(404, "유효하지 않거나 만료된 연결 코드예요")
    child = db.get(Child, record.child_id)
    if not record.payload.get("onboarded"):
        raise HTTPException(409, "부모 폰에서 가입 설정을 먼저 완료해 주세요")
    claimed = db.exec(update(FamilyProfile).where(FamilyProfile.child_id == child.id,
        FamilyProfile.link_hash == hashed, FamilyProfile.link_expires_at > now()).values(link_hash=None, link_expires_at=None))
    if claimed.rowcount != 1:
        raise HTTPException(409, "이미 사용한 연결 코드예요")
    persona = db.exec(select(Persona).where(Persona.parent_id == child.parent_id)).first()
    if not persona:
        persona = Persona(parent_id=child.parent_id)
        db.add(persona)
        db.flush()
    device = Device(parent_id=child.parent_id, child_id=child.id, persona_id=persona.id, label="아이 태블릿")
    db.add(device)
    db.flush()
    result = issue_token(db, child.parent_id, device.id)
    db.commit()
    set_session_cookie(response, result["access_token"], tablet=True)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return {**profile_view(db, child), "token": result["access_token"], "expires_at": result["expires_at"]}


class DeviceIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    device_id: str = Field(min_length=1, max_length=128)
    role: Literal["parent", "child"]
    name: str = Field(default="", max_length=120)


@router.post("/profile/{child_id}/devices")
def register_device(child_id: str, body: DeviceIn, token: Principal, db: DB):
    child = scoped_child(db, token, child_id, lock=True)
    if token.device_id and body.role != "child":
        raise HTTPException(403, "태블릿을 부모 기기로 등록할 수 없어요")
    record = db.get(RegisteredClient, (child.id, body.device_id))
    if token.device_id and record and record.auth_device_id != token.device_id:
        raise HTTPException(403, "다른 기기의 등록 정보는 변경할 수 없어요")
    if body.role == "child" and not token.device_id:
        raise HTTPException(403, "아이 기기는 연결 코드로 먼저 인증해 주세요")
    record = record or RegisteredClient(child_id=child.id, device_id=body.device_id, role=body.role, name=body.name)
    if record.access_token_id and record.access_token_id != token.id and not token.device_id:
        db.exec(update(AccessToken).where(AccessToken.id == record.access_token_id).values(revoked_at=now()))
    record.role, record.name, record.last_seen, record.auth_device_id = body.role, body.name, now(), token.device_id
    record.access_token_id = token.id
    db.add(record)
    db.commit()
    return {"devices": profile_view(db, child, parent=True)["devices"]}


@router.delete("/profile/{child_id}/devices/{device_id}")
def remove_device(child_id: str, device_id: str, token: ParentAuth, db: DB):
    child = scoped_child(db, token, child_id, lock=True)
    record = db.get(RegisteredClient, (child.id, device_id))
    if record:
        if record.auth_device_id:
            revoke(db, [db.get(Device, record.auth_device_id)])
        if record.access_token_id:
            db.exec(update(AccessToken).where(AccessToken.id == record.access_token_id).values(revoked_at=now()))
        db.delete(record)
    db.commit()
    return {"devices": profile_view(db, child, parent=True)["devices"]}


@router.get("/profile/{child_id}/history")
def history(child_id: str, token: ParentAuth, db: DB):
    scoped_child(db, token, child_id)
    base = child_dir(child_id)
    def read(paths):
        for file in paths:
            try:
                yield file, json.loads(file.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                continue
    voice = [{"kind": f.parent.name, "text": d.get("text", ""), "at": f.stat().st_mtime,
              "ok": d.get("quality", {}).get("ok", False), "speech_s": d.get("features", {}).get("speech_s", 0)}
             for f, d in read((base / "parent" / "voice").glob("*/sample_*.json"))]
    mouth = [{"kind": f.parent.name, "text": d.get("text", ""), "at": f.stat().st_mtime,
              "ok": d.get("face_ratio", 0) >= 0.6, "face_s": d.get("face_s", 0)}
             for f, d in read((base / "parent" / "mouth").glob("*/profile_*.json"))]
    days = []
    for f in sorted((base / "activity").glob("*.jsonl"), reverse=True)[:14]:
        try:
            events = [json.loads(line) for line in f.read_text(encoding="utf-8").splitlines() if line]
        except (OSError, ValueError):
            continue
        s = summarize(events, f.stem)
        days.append({"day": s.day, "sessions": s.sessions, "touches": s.touches, "repeats": s.repeats,
                     "repeat_ok": s.repeat_ok, "words": s.words, "gaze_s": s.gaze_s})
    return {"voice": sorted(voice, key=lambda x: x["at"], reverse=True)[:50],
            "mouth": sorted(mouth, key=lambda x: x["at"], reverse=True)[:50], "days": days}
