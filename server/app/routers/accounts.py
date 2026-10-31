"""Existing app login contract, sharing the /api parent identity and tokens."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import update
from sqlmodel import select

from app.auth import DB, ParentAuth, bearer, digest, issue_token, password_hash, rate_limit, verify_password
from app.config import PASSWORD_MIN_LENGTH, SESSION_COOKIE_NAME, SESSION_COOKIE_SECURE
from app.family import bridge_account, merge_profile, profile_view, rotate_link
from app.models import AccessToken, Child, FamilyProfile, LoginAccount, PairingCode, Parent, now

router = APIRouter(prefix="/auth", tags=["accounts"])
_DUMMY_HASH = password_hash("invalid-account-password")


class Credentials(BaseModel):
    model_config = ConfigDict(extra="forbid")
    login_id: str = Field(min_length=3, max_length=60)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("login_id")
    @classmethod
    def normalize(cls, value):
        value = value.strip().lower()
        if len(value) < 3 or any(c.isspace() for c in value):
            raise ValueError("아이디는 공백 없이 3자 이상이어야 해요")
        return value


class Signup(Credentials):
    child_id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    profile: dict = Field(default_factory=dict)


class PasswordChange(Credentials):
    new_password: str = Field(min_length=1, max_length=128)


def set_session_cookie(response, raw, tablet=False):
    response.set_cookie(SESSION_COOKIE_NAME, raw, httponly=True, secure=SESSION_COOKIE_SECURE,
                        samesite="lax", max_age=(30 if tablet else 7) * 86400, path="/")


def check_new_password(value):
    if len(value) < PASSWORD_MIN_LENGTH or value.isspace():
        raise HTTPException(422, f"비밀번호는 {PASSWORD_MIN_LENGTH}자 이상이어야 해요")


def authenticate(db, body):
    account = db.exec(select(LoginAccount).where(LoginAccount.login_id == body.login_id)).first()
    parent = db.exec(select(Parent).where(Parent.email == body.login_id)).first() if not account else None
    valid = verify_password(body.password, account.password_hash if account else parent.password_hash if parent else _DUMMY_HASH)
    if not valid or (not account and not parent):
        raise HTTPException(401, "아이디 또는 비밀번호를 확인해 주세요")
    if not account:
        # Existing /api email accounts keep their identity when logging in through the app.
        child = db.exec(select(Child).where(Child.parent_id == parent.id).order_by(Child.created_at, Child.id)).first()
        if not child:
            raise HTTPException(409, "아이 정보를 먼저 등록해 주세요")
        account = LoginAccount(id=parent.id, login_id=body.login_id, password_hash=parent.password_hash,
                               child_id=child.id, profile={})
        db.add(account)
        db.flush()
    return account


def throttle(db, request, login_id):
    rate_limit(db, "account-ip:" + digest(request.client.host if request.client else "local"), 30)
    rate_limit(db, "account-id:" + digest(login_id), 10)


@router.post("/signup", status_code=201)
def signup(body: Signup, request: Request, response: Response, db: DB):
    throttle(db, request, body.login_id)
    check_new_password(body.password)
    if db.get(Child, body.child_id):
        raise HTTPException(409, "이미 연결된 아이예요")
    account = LoginAccount(login_id=body.login_id, password_hash=password_hash(body.password),
                           child_id=body.child_id, profile={})
    db.add(account)
    db.flush()
    _, child = bridge_account(db, account)
    record = merge_profile(db, child, body.profile)
    code = rotate_link(db, child, initial=True)
    result = issue_token(db, account.id)
    db.commit()
    set_session_cookie(response, result["access_token"])
    return {**result, "login_id": account.login_id, "child_id": child.id, "token": result["access_token"],
            "profile": record.payload, "linkCode": code}


@router.post("/login")
def login(body: Credentials, request: Request, response: Response, db: DB):
    throttle(db, request, body.login_id)
    account = authenticate(db, body)
    _, child = bridge_account(db, account)
    result = issue_token(db, account.id)
    db.commit()
    set_session_cookie(response, result["access_token"])
    return {**result, "login_id": account.login_id, "child_id": child.id, "token": result["access_token"],
            "profile": profile_view(db, child, parent=True)}


@router.post("/password")
def change_password(body: PasswordChange, request: Request, response: Response, db: DB):
    throttle(db, request, body.login_id)
    check_new_password(body.new_password)
    account = authenticate(db, body)
    parent, _ = bridge_account(db, account)
    db.exec(select(Parent).where(Parent.id == parent.id).with_for_update()).one()
    db.refresh(account)
    if not verify_password(body.password, account.password_hash):
        raise HTTPException(401, "현재 비밀번호를 확인해 주세요")
    account.password_hash = parent.password_hash = password_hash(body.new_password)
    db.add(account)
    db.add(parent)
    db.exec(update(AccessToken).where(AccessToken.parent_id == parent.id).values(revoked_at=now()))
    child_ids = select(Child.id).where(Child.parent_id == parent.id)
    db.exec(update(FamilyProfile).where(FamilyProfile.child_id.in_(child_ids)).values(link_hash=None, link_expires_at=None))
    db.exec(update(PairingCode).where(PairingCode.child_id.in_(child_ids), PairingCode.used_at.is_(None)).values(used_at=now()))
    result = issue_token(db, parent.id)
    db.commit()
    set_session_cookie(response, result["access_token"])
    return {**result, "token": result["access_token"]}


@router.put("/profile")
def save_profile(body: dict, db: DB, token: ParentAuth):
    account = db.get(LoginAccount, token.parent_id)
    if not account:
        raise HTTPException(404, "아이디 계정을 찾을 수 없어요")
    child = db.exec(select(Child).where(Child.id == account.child_id).with_for_update()).one()
    merge_profile(db, child, body)
    db.commit()
    return profile_view(db, child, parent=True)


@router.post("/logout")
def logout(request: Request, response: Response, db: DB,
           credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]):
    from app.config import CORS_ORIGINS
    raw = credentials.credentials if credentials else request.cookies.get(SESSION_COOKIE_NAME)
    origin = request.headers.get("origin")
    if not credentials and origin and origin not in CORS_ORIGINS and origin != str(request.base_url).rstrip("/"):
        raise HTTPException(403, "허용되지 않은 요청 출처예요")
    if raw:
        db.exec(update(AccessToken).where(AccessToken.token_hash == digest(raw)).values(revoked_at=now()))
        db.commit()
    response.delete_cookie(SESSION_COOKIE_NAME, path="/", secure=SESSION_COOKIE_SECURE, httponly=True, samesite="lax")
    return {"ok": True}
