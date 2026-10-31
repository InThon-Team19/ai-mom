"""The database is the sole source of family profiles for both API contracts."""
import json
import re
import secrets
from datetime import timedelta

from fastapi import HTTPException
from pydantic import ValidationError
from sqlmodel import select

from app.auth import digest
from app.models import Child, Consent, FamilyProfile, Parent, RegisteredClient, now
from app.schemas import ChildIn, SettingsIn

CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
LEVELS = {"한 단어": "single_words", "두 단어": "two_words", "짧은 문장": "short_sentences"}


def merge_profile(db, child, patch):
    if len(json.dumps(patch, ensure_ascii=False).encode()) > 128 * 1024:
        raise HTTPException(413, "프로필은 128KB 이하여야 해요")
    record = db.get(FamilyProfile, child.id) or FamilyProfile(child_id=child.id)
    payload = dict(record.payload)
    allowed = {"child", "parent", "avatar", "settings", "day", "feedback", "onboarded", "readingDone", "pinHash"}
    for key, value in patch.items():
        if key not in allowed:
            continue
        if key in {"child", "parent", "avatar", "settings"}:
            if not isinstance(value, dict):
                raise HTTPException(422, f"{key}는 객체여야 해요")
            payload[key] = {**payload.get(key, {}), **value}
        else:
            payload[key] = value
    if "pinHash" in payload and not re.fullmatch(r"[a-fA-F0-9]{64}", str(payload["pinHash"])):
        raise HTTPException(422, "PIN 해시 형식을 확인해 주세요")
    if "day" in payload and (type(payload["day"]) is not int or not 1 <= payload["day"] <= 10000):
        raise HTTPException(422, "진행 일차를 확인해 주세요")
    if "onboarded" in payload and type(payload["onboarded"]) is not bool:
        raise HTTPException(422, "가입 완료 값을 확인해 주세요")
    data = payload.get("child", {})
    settings = payload.get("settings", {})
    try:
        if data.get("birth"):
            validated = ChildIn(nickname=data.get("nickname") or data.get("name") or child.nickname,
                                birth_month=data["birth"], speech_level=LEVELS.get(data.get("level"), child.speech_level),
                                interests=data.get("likes", []))
            for key, value in validated.model_dump().items():
                setattr(child, key, value)
        validated_settings = SettingsIn(
            haptics_enabled=settings.get("vibration", child.haptics_enabled),
            daily_limit_minutes=settings.get("dailyLimitMin", child.daily_limit_minutes),
            window_start=settings.get("start", child.window_start), window_end=settings.get("end", child.window_end))
        for key, value in validated_settings.model_dump().items():
            setattr(child, key, value)
    except ValidationError:
        raise HTTPException(422, "아이 정보와 사용 설정을 확인해 주세요")
    for key in ("consentBio", "consentChild"):
        if key in settings and type(settings[key]) is not bool:
            raise HTTPException(422, "동의 값은 참 또는 거짓이어야 해요")
    if payload.get("onboarded"):
        ready = bool(child.birth_month and child.nickname and payload.get("pinHash")
                     and settings.get("consentBio") and settings.get("consentChild"))
        if not ready and not record.payload.get("onboarded"):
            raise HTTPException(422, "아이 정보·PIN·필수 동의를 모두 저장해 주세요")
        if not ready:
            payload["onboarded"] = False
    if "settings" in patch and any(k in patch["settings"] for k in ("consentBio", "consentChild")):
        consent = Consent(parent_id=child.parent_id, child_id=child.id,
                          parent_biometrics=settings.get("consentBio", False), child_signals=settings.get("consentChild", False))
        db.add(consent)
        if not consent.parent_biometrics or not consent.child_signals:
            from app.models import ConversationSession
            for session in db.exec(select(ConversationSession).where(ConversationSession.child_id == child.id,
                                                                     ConversationSession.status == "active")).all():
                session.status, session.ended_at = "ended", now()
                db.add(session)
    payload["childId"] = child.id
    record.payload = payload
    db.add(child)
    db.add(record)
    return record


def profile_view(db, child, parent=False):
    record = db.get(FamilyProfile, child.id)
    payload = dict(record.payload) if record else {}
    payload["childId"] = child.id
    payload.setdefault("child", {"nickname": child.nickname, "name": child.nickname, "birth": child.birth_month,
                                  "level": next((k for k, v in LEVELS.items() if v == child.speech_level), "한 단어"), "likes": child.interests})
    # Actual access is backed by Device + AccessToken, never this display list.
    devices = db.exec(select(RegisteredClient).where(RegisteredClient.child_id == child.id)).all()
    if parent:
        payload["devices"] = [{"device_id": d.device_id, "role": d.role, "name": d.name,
                               "linked_at": d.linked_at.timestamp(), "last_seen": d.last_seen.timestamp()} for d in devices]
    else:
        payload.pop("devices", None)
        payload.pop("feedback", None)
    payload.pop("linkCode", None)
    return payload


def rotate_link(db, child, initial=False):
    code = child.id.upper() if initial and re.fullmatch(r"[A-Z2-9]{6}", child.id.upper()) else "".join(secrets.choice(CODE_CHARS) for _ in range(6))
    while db.exec(select(FamilyProfile).where(FamilyProfile.link_hash == digest(code), FamilyProfile.child_id != child.id)).first():
        code = "".join(secrets.choice(CODE_CHARS) for _ in range(6))
    record = db.get(FamilyProfile, child.id) or FamilyProfile(child_id=child.id)
    record.link_hash, record.link_expires_at = digest(code), now() + timedelta(minutes=10)
    db.add(record)
    return code


def bridge_account(db, account):
    parent = db.get(Parent, account.id)
    if not parent:
        parent = Parent(id=account.id, email=account.id + "@accounts.invalid", display_name=account.login_id,
                        password_hash=account.password_hash)
        db.add(parent)
        db.flush()
    child = db.get(Child, account.child_id)
    if child and child.parent_id != parent.id:
        raise HTTPException(409, "이미 다른 가족에 연결된 아이예요")
    if not child:
        child = Child(id=account.child_id, parent_id=parent.id, nickname="", birth_month="", speech_level="single_words")
        db.add(child)
        db.flush()
    if not db.get(FamilyProfile, child.id):
        merge_profile(db, child, account.profile)
    return parent, child
