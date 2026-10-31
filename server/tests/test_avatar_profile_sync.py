"""Real auth/profile routers with an isolated DB; no TTS/provider calls."""
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.db import get_session
from app.routers import accounts, profile


def test_all_parent_portrait_choices_roundtrip_to_linked_tablet():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    app = FastAPI()
    app.include_router(accounts.router)
    app.include_router(profile.router)

    def db_session():
        with Session(engine, expire_on_commit=False) as db:
            yield db
    app.dependency_overrides[get_session] = db_session
    credentials = {'login_id': 'portrait-' + uuid4().hex, 'password': 'test-portrait-1234'}
    child_id = uuid4().hex
    original = {'face': 3, 'hair': 4, 'eyes': 2, 'outfit': 6, 'color': 1}
    family = {'child': {'nickname': '테스트', 'birth': '2023-01', 'level': '한 단어', 'likes': []},
              'parent': {'title': '아빠'}, 'avatar': original,
              'settings': {'consentBio': True, 'consentChild': True, 'start': '09:00', 'end': '18:00', 'dailyLimitMin': 30},
              'pinHash': 'a' * 64, 'onboarded': True}
    with TestClient(app) as client:
        result = client.post('/auth/signup', json={**credentials, 'child_id': child_id, 'profile': family})
        assert result.status_code == 201, result.text
        parent = {'Authorization': 'Bearer ' + result.json()['token']}
        path = '/profile/' + child_id
        code = client.post(path + '/link-code', headers=parent)
        assert code.status_code == 200, code.text
        paired = client.get('/link/' + code.json()['linkCode'])
        assert paired.status_code == 200, paired.text
        tablet = {'Authorization': 'Bearer ' + paired.json()['token']}
        for character in ['mother', 'father']:
            for hair in [0, 1]:
                for outfit in [0, 1]:
                    selection = {**original, 'style': 'illustration', 'portrait': {
                        'version': 1, 'character': character, 'hair': hair, 'outfit': outfit}}
                    saved = client.put(path, headers=parent, json={'avatar': selection})
                    assert saved.status_code == 200, saved.text
                    received = client.get(path, headers=tablet)
                    assert received.status_code == 200, received.text
                    assert received.json()['avatar'] == selection
                    assert received.json()['settings']['dailyLimitMin'] == 30
        logged_in = client.post('/auth/login', json=credentials)
        assert logged_in.status_code == 200, logged_in.text
        assert logged_in.json()['profile']['avatar'] == selection
        # Switching back preserves every original SVG option and the illustrated choice.
        saved = client.put(path, headers=parent, json={'avatar': {'style': 'svg'}})
        assert saved.status_code == 200
        loaded = client.get(path, headers=tablet).json()['avatar']
        assert loaded['style'] == 'svg' and loaded['portrait'] == selection['portrait']
        assert all(loaded[k] == v for k, v in original.items())
        assert client.put(path, headers=tablet, json={'avatar': selection}).status_code == 403
    engine.dispose()
