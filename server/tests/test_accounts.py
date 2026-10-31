from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from app.auth import digest, password_hash
from app.db import get_session
from app.main import app
from app.migrations import upgrade
from app.models import AccessToken, Child, FamilyProfile, LoginAccount, LoginSession, Parent, now


@pytest.fixture
def account_ctx():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    def session():
        with Session(engine, expire_on_commit=False) as db:
            yield db
    app.dependency_overrides[get_session] = session
    with TestClient(app) as client:
        yield client, engine
    app.dependency_overrides.clear()
    engine.dispose()


def signup(client, profile=None, child_id=None, password="test123456"):
    body = {"login_id": "mom-" + uuid4().hex, "password": password,
            "child_id": child_id or uuid4().hex, "profile": profile or {"child": {"nickname": "아이"}}}
    response = client.post("/auth/signup", json=body)
    assert response.status_code == 201, response.text
    return body, response.json(), {"Authorization": "Bearer " + response.json()["token"]}


def completed():
    return {"child": {"nickname": "아이", "birth": "2023-01", "level": "한 단어", "likes": []},
            "settings": {"consentBio": True, "consentChild": True, "start": "09:00", "end": "18:00", "dailyLimitMin": 30},
            "pinHash": "a" * 64, "onboarded": True}


def test_account_lifecycle_shared_tokens(account_ctx):
    client, engine = account_ctx
    body, created, headers = signup(client)
    assert client.get("/api/me", headers=headers).status_code == 200
    assert client.post("/auth/signup", json=body).status_code == 409
    credentials = {"login_id": body["login_id"].upper(), "password": body["password"]}
    assert client.post("/auth/login", json={**credentials, "password": "wrong"}).status_code == 401
    logged_in = client.post("/auth/login", json=credentials).json()
    assert logged_in["profile"]["child"] == body["profile"]["child"]
    assert logged_in["child_id"] == body["child_id"]
    assert client.put("/auth/profile", json={"day": 2}).status_code == 401
    assert client.put("/auth/profile", headers=headers, json={"day": 2}).status_code == 200
    changed = client.post("/auth/password", json={**credentials, "new_password": "updated1234"})
    assert changed.status_code == 200, changed.text
    assert client.get("/api/me", headers=headers).status_code == 401
    assert client.post("/auth/login", json=credentials).status_code == 401
    headers = {"Authorization": "Bearer " + changed.json()["token"]}
    assert client.post("/auth/logout", headers=headers).status_code == 200
    assert client.post("/auth/logout", headers=headers).status_code == 200
    assert client.put("/auth/profile", headers=headers, json={}).status_code == 401
    with Session(engine) as db:
        account = db.exec(select(LoginAccount)).one()
        assert account.password_hash != "updated1234"
        assert db.get(Parent, account.id).password_hash == account.password_hash
        assert db.exec(select(LoginSession)).all() == []
        assert db.exec(select(FamilyProfile)).one().payload["day"] == 2


def test_profiles_permissions_and_single_store(account_ctx):
    client, _ = account_ctx
    body, _, headers = signup(client, completed())
    _, _, other = signup(client)
    path = "/profile/" + body["child_id"]
    assert client.get(path).status_code == 401
    assert client.get(path, headers=other).status_code == 404
    assert client.put(path, headers=other, json={"day": 3}).status_code == 404
    assert client.put(path, headers=headers, json={"settings": {"dailyLimitMin": 20}, "day": 2}).status_code == 200
    loaded = client.get(path, headers=headers).json()
    assert loaded["settings"]["consentBio"] is True
    assert loaded["settings"]["dailyLimitMin"] == 20
    logged_in = client.post("/auth/login", json={"login_id": body["login_id"], "password": body["password"]}).json()
    assert logged_in["profile"] == loaded
    assert client.put(path, headers=headers, json={"childId": "foreign", "devices": [{"role": "parent"}]}).json()["childId"] == body["child_id"]
    assert client.put(path, headers=headers, json={"settings": {"start": "20:00", "end": "09:00"}}).status_code == 422
    assert client.put(path, headers=headers, json={"settings": "bad"}).status_code == 422
    assert client.put(path, headers=headers, json={"pinHash": "bad"}).status_code == 422


def test_signup_atomic_validation_and_child_claim(account_ctx):
    client, engine = account_ctx
    invalid = {"login_id": "bad-profile", "password": "long-password", "child_id": "draft", "profile": {"onboarded": True}}
    assert client.post("/auth/signup", json=invalid).status_code == 422
    with Session(engine) as db:
        assert db.exec(select(LoginAccount)).all() == []
        assert db.exec(select(Parent)).all() == []
        assert db.exec(select(Child)).all() == []
    body, _, _ = signup(client)
    assert client.post("/auth/signup", json={**body, "login_id": "another-mom"}).status_code == 409
    assert client.post("/auth/signup", json={**body, "login_id": "short-password", "password": "1234", "child_id": "another"}).status_code == 422


def test_pair_expiry_once_and_revoke(account_ctx):
    client, engine = account_ctx
    body, created, parent = signup(client, completed(), "ABCDEF")
    path = "/profile/" + body["child_id"]
    pair = client.get("/link/" + created["linkCode"])
    assert pair.status_code == 200, pair.text
    tablet = {"Authorization": "Bearer " + pair.json()["token"]}
    assert client.get("/link/" + created["linkCode"]).status_code == 404
    assert client.get(path, headers=tablet).status_code == 200
    assert client.put(path, headers=tablet, json={"day": 9}).status_code == 403
    assert client.get(path + "/history", headers=tablet).status_code == 403
    assert client.post(path + "/devices", headers=tablet, json={"device_id": "tab1", "role": "parent"}).status_code == 403
    assert client.post(path + "/devices", headers=tablet, json={"device_id": "tab1", "role": "child"}).status_code == 200
    assert client.delete(path + "/devices/tab1", headers=parent).status_code == 200
    assert client.get(path, headers=tablet).status_code == 401
    code = client.post(path + "/link-code", headers=parent).json()["linkCode"]
    with Session(engine) as db:
        db.exec(update(FamilyProfile).values(link_expires_at=now() - timedelta(seconds=1)))
        db.commit()
    assert client.get("/link/" + code).status_code == 404


def test_expired_and_cookie_sessions(account_ctx):
    client, engine = account_ctx
    body, created, headers = signup(client)
    with Session(engine) as db:
        db.exec(update(AccessToken).values(expires_at=now() - timedelta(seconds=1)))
        db.commit()
    assert client.get("/api/me", headers=headers).status_code == 401
    assert client.post("/auth/logout", headers=headers).status_code == 200
    # HTTPS cookies work without JS access to the token and reject cross-origin mutations.
    with TestClient(app, base_url="https://testserver") as cookie_client:
        result = cookie_client.post("/auth/login", json={"login_id": body["login_id"], "password": body["password"]})
        assert "HttpOnly" in result.headers["set-cookie"] and "Secure" in result.headers["set-cookie"]
        assert cookie_client.get("/api/me").status_code == 200
        assert cookie_client.put("/auth/profile", headers={"Origin": "https://evil.example"}, json={"day": 2}).status_code == 403
        assert cookie_client.put("/auth/profile", json={"day": 2}).status_code == 200
        assert cookie_client.post("/auth/logout").status_code == 200
        assert cookie_client.get("/api/me").status_code == 401


def test_legacy_account_migration():
    engine = create_engine("sqlite://", poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db:
        account = LoginAccount(login_id="legacy", password_hash=password_hash("test-password"), child_id="legacy-child", profile={"day": 2})
        db.add(account)
        db.flush()
        db.add(LoginSession(account_id=account.id, token_hash=digest("old-token"), expires_at=now() + timedelta(days=1)))
        db.commit()
        account_id = account.id
    with engine.begin() as connection:
        upgrade(connection)
    with engine.begin() as connection:
        upgrade(connection)
    with Session(engine) as db:
        assert db.get(Parent, account_id)
        assert db.get(FamilyProfile, "legacy-child").payload["day"] == 2
        assert db.exec(select(AccessToken)).one().token_hash == digest("old-token")
        assert db.exec(select(LoginSession)).all() == []
    engine.dispose()


def test_legacy_media_requires_auth_and_ownership(account_ctx):
    client, _ = account_ctx
    body, _, parent = signup(client)
    _, _, other = signup(client)
    path = "/voice/gauge/" + body["child_id"]
    assert client.get(path).status_code == 401
    assert client.get(path, headers=other).status_code == 404
    assert client.get(path, headers=parent).status_code == 200
    assert client.post("/vision/parent-mouth-track", headers=other, json={"child_id": body["child_id"], "track": []}).status_code == 404


def test_consent_withdrawal_disables_pairing(account_ctx):
    client, _ = account_ctx
    body, created, headers = signup(client, completed())
    path = "/profile/" + body["child_id"]
    response = client.put(path, headers=headers, json={"settings": {"consentChild": False}})
    assert response.status_code == 200
    assert response.json()["onboarded"] is False
    assert client.get("/link/" + created["linkCode"]).status_code == 409


def test_existing_email_account_keeps_identity(account_ctx):
    client, _ = account_ctx
    response = client.post("/api/auth/signup", json={"email": "existing@example.com", "password": "existing-password", "display_name": "부모"})
    assert response.status_code == 201
    parent = response.json()["parent"]
    headers = {"Authorization": "Bearer " + response.json()["access_token"]}
    child = client.post("/api/children", headers=headers, json={"nickname": "아이", "birth_month": "2023-01"}).json()
    result = client.post("/auth/login", json={"login_id": "existing@example.com", "password": "existing-password"})
    assert result.status_code == 200, result.text
    assert result.json()["child_id"] == child["id"]
    me = client.get("/api/me", headers={"Authorization": "Bearer " + result.json()["token"]}).json()
    assert me["id"] == parent["id"]


def test_password_change_invalidates_pending_pairing(account_ctx):
    client, _ = account_ctx
    body, created, _ = signup(client, completed())
    response = client.post("/auth/password", json={"login_id": body["login_id"], "password": body["password"], "new_password": "updated-password"})
    assert response.status_code == 200
    assert client.get("/link/" + created["linkCode"]).status_code == 404
