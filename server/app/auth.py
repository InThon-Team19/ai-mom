"""비밀번호 scrypt, 해시만 저장하는 만료형 opaque 토큰, 부모/기기 권한."""
import hashlib
import hmac
import secrets
from datetime import timedelta
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from app.db import get_session
from app.models import AccessToken, Child, Device, Parent, RateAttempt, now

DB = Annotated[Session, Depends(get_session)]
bearer = HTTPBearer(auto_error=False)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def password_hash(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    key = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1)
    return f"{salt}:{key.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    return hmac.compare_digest(password_hash(password, hashed.split(":")[0]), hashed)


def issue_token(db: Session, parent_id: str, device_id: str | None = None):
    raw = secrets.token_urlsafe(32)
    expires = now() + timedelta(days=30 if device_id else 7)
    db.add(AccessToken(token_hash=digest(raw), parent_id=parent_id, device_id=device_id, expires_at=expires))
    return {"access_token": raw, "token_type": "bearer", "expires_at": expires}


def principal(db: DB, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    token = db.exec(select(AccessToken).where(AccessToken.token_hash == digest(credentials.credentials))).first() if credentials else None
    if not token or token.revoked_at or token.expires_at <= now():
        raise HTTPException(401, "유효한 인증 토큰이 필요해요", headers={"WWW-Authenticate": "Bearer"})
    if token.device_id:
        device = db.get(Device, token.device_id)
        if not device or device.revoked_at:
            raise HTTPException(401, "연결 해제된 기기예요")
    return token


Principal = Annotated[AccessToken, Depends(principal)]


def parent_only(token: Principal):
    if token.device_id:
        raise HTTPException(403, "부모 전용 API예요")
    return token


ParentAuth = Annotated[AccessToken, Depends(parent_only)]


def tablet_only(token: Principal):
    if not token.device_id:
        raise HTTPException(403, "태블릿 전용 API예요")
    return token


TabletAuth = Annotated[AccessToken, Depends(tablet_only)]


def owned(db: Session, model, record_id: str, parent_id: str):
    record = db.get(model, record_id)
    if not record or record.parent_id != parent_id:
        raise HTTPException(404, "항목을 찾을 수 없어요")
    return record


def rate_limit(db: Session, bucket: str, limit: int = 5):
    if db.get_bind().dialect.name == "sqlite":
        db.connection().exec_driver_sql("BEGIN IMMEDIATE")
    cutoff = now() - timedelta(minutes=1)
    # 제한 기록도 DB에 남겨 재시작/다중 worker에서 공유한다.
    from sqlalchemy import delete
    db.exec(delete(RateAttempt).where(RateAttempt.created_at < cutoff))
    attempts = db.exec(select(RateAttempt).where(RateAttempt.bucket == bucket)).all()
    if len(attempts) >= limit:
        db.commit()
        raise HTTPException(429, "잠시 후 다시 시도해 주세요", headers={"Retry-After": "60"})
    db.add(RateAttempt(bucket=bucket))
    db.commit()
