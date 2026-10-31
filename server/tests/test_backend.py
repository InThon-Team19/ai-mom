"""가입→연결→활동→저녁→다음날 흐름과 권한/무결성 회귀 검증."""
import io
import wave
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import numpy as np
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine, select
from sqlalchemy.pool import StaticPool

from app import services
from app.db import get_session
from app.main import app
from app.models import AccessToken, Child, ConversationSession, Message, PairingCode, Plan, Sample


@pytest.fixture
def ctx(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as db:
        services.seed_content(db)
    def get_db():
        with Session(engine, expire_on_commit=False) as db:
            yield db
    app.dependency_overrides[get_session] = get_db
    clock = [datetime(2026, 10, 31, 12, tzinfo=services.SEOUL)]
    monkeypatch.setattr(services, "seoul_now", lambda: clock[0])
    with TestClient(app) as client:
        yield client, engine, clock
    app.dependency_overrides.clear()
    engine.dispose()


def request(client, method, path, token=None, expected=200, **kwargs):
    response = client.request(method, "/api" + path, headers={"Authorization": "Bearer " + token} if token else {}, **kwargs)
    assert response.status_code == expected, response.text
    return response.json()


def parent(client):
    body = {"email": uuid4().hex + "@example.com", "password": "test-password-123", "display_name": "부모"}
    result = request(client, "POST", "/auth/signup", expected=201, json=body)
    return result["access_token"], body


def wav():
    sr = 16000
    pcm = np.concatenate([np.zeros(sr // 2), .3 * np.sin(2 * np.pi * 220 * np.arange(sr * 2) / sr)])
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sr)
        f.writeframes((pcm * 32767).astype(np.int16).tobytes())
    return buffer.getvalue()


def samples(client, token, child, persona, plan=None):
    fields = {"persona_id": persona["id"], "purpose": "night_reading" if plan else "onboarding", "text": "사과를 함께 말해 보자"}
    if plan:
        fields["plan_id"] = plan["id"]
    audio = request(client, "POST", f'/children/{child["id"]}/samples/audio', token, 201,
                    data=fields, files={"file": ("a.wav", wav(), "audio/wav")})
    track = [{"t": i * .05, "open": .1, "width": .8, "face": True} for i in range(30)]
    mouth = request(client, "POST", f'/children/{child["id"]}/samples/mouth', token, 201, json={**fields, "track": track})
    return audio["sample"]["id"], mouth["sample"]["id"]


def setup(client, media=True):
    token, _ = parent(client)
    child = request(client, "POST", "/children", token, 201, json={"nickname": "봄이", "birth_month": "2023-04"})
    persona = request(client, "POST", "/personas", token, 201, json={})
    request(client, "POST", f'/personas/{persona["id"]}/confirm', token)
    request(client, "PUT", f'/children/{child["id"]}/consents', token, json={"parent_biometrics": True, "child_signals": True})
    if media:
        samples(client, token, child, persona)
    return token, child, persona


def paired(client, token, child, persona):
    code = request(client, "POST", f'/children/{child["id"]}/pairing-codes', token, 201, json={"persona_id": persona["id"]})
    tablet = request(client, "POST", "/tablet/pair", json={"code": code["code"]})
    return tablet, code


def make_plan(client, token, child, persona, day="2026-10-31", number=1, feedback=None, read=True):
    body = {"date": day, "persona_id": persona["id"], "day_number": number, "feedback_id": feedback}
    plan = request(client, "POST", f'/children/{child["id"]}/plans', token, 201, json=body)
    if read:
        audio, mouth = samples(client, token, child, persona, plan)
        plan = request(client, "POST", f'/plans/{plan["id"]}/reading', token, json={"audio_sample_id": audio, "mouth_sample_id": mouth})
    return plan


def active(client):
    token, child, persona = setup(client)
    tablet, _ = paired(client, token, child, persona)
    plan = make_plan(client, token, child, persona)
    start = request(client, "POST", "/tablet/sessions", tablet["access_token"], 201, json={"plan_id": plan["id"]})
    return token, child, persona, tablet, plan, start["session"]


def test_authentication_and_token_hashes(ctx):
    client, engine, _ = ctx
    token, body = parent(client)
    me = request(client, "GET", "/me", token)
    assert "password_hash" not in me
    request(client, "GET", "/me", expected=401)
    request(client, "POST", "/auth/signup", expected=409, json=body)
    request(client, "POST", "/auth/login", expected=401, json={"email": body["email"], "password": "wrong"})
    login = request(client, "POST", "/auth/login", json={"email": body["email"], "password": body["password"]})
    with Session(engine) as db:
        assert all(t.token_hash != token for t in db.exec(select(AccessToken)).all())
    request(client, "POST", "/auth/logout", login["access_token"])
    request(client, "GET", "/me", login["access_token"], 401)


def test_parent_ownership(ctx):
    client, _, _ = ctx
    token, child, persona = setup(client, media=False)
    other, _ = parent(client)
    request(client, "GET", f'/children/{child["id"]}', other, 404)
    request(client, "POST", f'/personas/{persona["id"]}/confirm', other, 404)
    request(client, "POST", f'/children/{child["id"]}/plans', other, 404, json={"date": "2026-10-31", "persona_id": persona["id"]})


def test_onboarding_and_actual_sample_processing(ctx):
    client, _, _ = ctx
    token, child, persona = setup(client, media=False)
    path = f'/children/{child["id"]}/onboarding?persona_id={persona["id"]}'
    assert not request(client, "GET", path, token)["ready"]
    request(client, "POST", f'/children/{child["id"]}/pairing-codes', token, 409, json={"persona_id": persona["id"]})
    samples(client, token, child, persona)
    assert request(client, "GET", path, token)["ready"]
    result = request(client, "GET", f'/children/{child["id"]}/training-progress?persona_id={persona["id"]}', token)
    assert result["voice"]["sentences"] == 1 and result["mouth"]["sentences"] == 1


def test_pair_once_scope_and_revoke(ctx):
    client, _, _ = ctx
    token, child, persona = setup(client)
    tablet, code = paired(client, token, child, persona)
    device_token = tablet["access_token"]
    request(client, "POST", "/tablet/pair", expected=400, json={"code": code["code"]})
    request(client, "GET", "/me", device_token, 403)
    request(client, "GET", "/tablet/context", token, 403)
    assert request(client, "GET", "/tablet/context", device_token)["child"]["id"] == child["id"]
    request(client, "DELETE", f'/devices/{tablet["device"]["id"]}', token)
    request(client, "GET", "/tablet/context", device_token, 401)


def test_pair_expiration_and_attempt_limit(ctx):
    client, engine, _ = ctx
    token, child, persona = setup(client)
    code = request(client, "POST", f'/children/{child["id"]}/pairing-codes', token, 201, json={"persona_id": persona["id"]})
    with Session(engine) as db:
        record = db.exec(select(PairingCode)).first()
        record.expires_at -= timedelta(minutes=10)
        db.add(record)
        db.commit()
    request(client, "POST", "/tablet/pair", expected=400, json={"code": code["code"]})
    for _ in range(4):
        request(client, "POST", "/tablet/pair", expected=400, json={"code": "000000"})
    request(client, "POST", "/tablet/pair", expected=429, json={"code": "000000"})


def test_full_flow_and_next_day(ctx):
    client, _, clock = ctx
    token, child, persona, tablet, plan, session = active(client)
    device_token = tablet["access_token"]
    path = f'/tablet/sessions/{session["id"]}'
    assert request(client, "POST", path + "/messages", device_token, json={"text": "사과"})["message"]["safety_status"] == "grounded"
    request(client, "POST", path + "/messages", device_token, json={"text": "우주는 왜 커?"})
    for sense, action in [("auditory", "repeat"), ("visual", "gaze"), ("tactile", "bite")]:
        request(client, "POST", path + "/events", device_token, 201, json={"content_id": "demo-apple", "sense": sense, "action": action})
    request(client, "POST", path + "/end", device_token)
    report = request(client, "GET", f'/children/{child["id"]}/report?date=2026-10-31&period=week', token)
    assert report["event_count"] == 3 and report["session_count"] == 1
    assert report["from_date"] == "2026-10-25" and report["learning_rate"] is None
    assert len(report["review_items"]) == 1
    review_id = report["review_items"][0]["id"]
    request(client, "PATCH", f"/reviews/{review_id}", token, json={})
    for _ in range(2):
        request(client, "POST", f'/children/{child["id"]}/evening-review', token, json={"date": "2026-10-31"})
    fb = request(client, "POST", f'/children/{child["id"]}/feedback', token, 201, json={"for_date": "2026-10-31", "concerns": ["too_fast"], "new_words": ["과자"]})
    tomorrow = make_plan(client, token, child, persona, "2026-11-01", 2, fb["id"])
    assert tomorrow["pacing"] == "slow" and tomorrow["content_ids"] == ["demo-cookie"]
    home = request(client, "GET", f'/children/{child["id"]}/home?date=2026-10-31&persona_id={persona["id"]}', token)
    assert all(home["evening_tasks"].values())
    request(client, "POST", "/tablet/sessions", device_token, 409, json={"plan_id": tomorrow["id"]})
    clock[0] += timedelta(days=1)
    started = request(client, "POST", "/tablet/sessions", device_token, 201, json={"plan_id": tomorrow["id"]})
    assert started["session"]["pacing"] == "slow"


def test_audio_mode_and_session_end(ctx):
    client, _, _ = ctx
    _, _, _, tablet, _, session = active(client)
    token, path = tablet["access_token"], f'/tablet/sessions/{session["id"]}'
    assert not request(client, "PATCH", path, token, json={"mode": "audio_only"})["haptics_enabled"]
    request(client, "POST", path + "/events", token, 409, json={"content_id": "demo-apple", "sense": "visual", "action": "gaze"})
    request(client, "POST", path + "/events", token, 201, json={"content_id": "demo-apple", "sense": "auditory", "action": "repeat"})
    request(client, "POST", path + "/end", token)
    request(client, "POST", path + "/end", token)
    request(client, "POST", path + "/messages", token, 409, json={"text": "사과"})


def test_consent_withdrawal_ends_session(ctx):
    client, engine, _ = ctx
    token, child, _, tablet, _, session = active(client)
    request(client, "PUT", f'/children/{child["id"]}/consents', token, json={"parent_biometrics": False, "child_signals": True})
    request(client, "GET", "/tablet/context", tablet["access_token"], 409)
    with Session(engine) as db:
        assert db.get(ConversationSession, session["id"]).status == "ended"


def test_plan_duplicates_reading_and_feedback_scope(ctx):
    client, _, _ = ctx
    token, child, persona = setup(client)
    tablet, _ = paired(client, token, child, persona)
    plan = make_plan(client, token, child, persona, read=False)
    request(client, "POST", "/tablet/sessions", tablet["access_token"], 409, json={"plan_id": plan["id"]})
    request(client, "POST", f'/children/{child["id"]}/plans', token, 409, json={"date": "2026-10-31", "persona_id": persona["id"]})
    audio, mouth = samples(client, token, child, persona)
    request(client, "POST", f'/plans/{plan["id"]}/reading', token, 409, json={"audio_sample_id": audio, "mouth_sample_id": mouth})
    feedback = request(client, "POST", f'/children/{child["id"]}/feedback', token, 201, json={"for_date": "2026-10-31"})
    request(client, "POST", f'/children/{child["id"]}/plans', token, 409, json={"date": "2026-11-02", "persona_id": persona["id"], "feedback_id": feedback["id"]})


def test_time_window_daily_limit_and_no_parallel_sessions(ctx):
    client, engine, clock = ctx
    token, child, _, tablet, plan, session = active(client)
    t = tablet["access_token"]
    request(client, "POST", "/tablet/sessions", t, 409, json={"plan_id": plan["id"]})
    clock[0] = clock[0].replace(hour=21)
    request(client, "POST", f'/tablet/sessions/{session["id"]}/messages', t, 409, json={"text": "사과"})
    clock[0] = clock[0].replace(hour=12)
    with Session(engine) as db:
        record = db.get(ConversationSession, session["id"])
        record.created_at -= timedelta(hours=2)
        db.add(record)
        db.commit()
    request(client, "POST", f'/tablet/sessions/{session["id"]}/messages', t, 409, json={"text": "사과"})
    request(client, "POST", f'/tablet/sessions/{session["id"]}/end', t)


def test_safety_stops_session_without_saving_child_text(ctx):
    client, engine, _ = ctx
    token, _, _, tablet, _, session = active(client)
    text = "배가 아파요"
    result = request(client, "POST", f'/tablet/sessions/{session["id"]}/messages', tablet["access_token"], json={"text": text})
    assert result["session_status"] == "ended" and result["message"]["safety_status"] == "needs_parent"
    with Session(engine) as db:
        assert all(m.text != text and m.speaker == "agent" for m in db.exec(select(Message)).all())


@pytest.mark.parametrize("body", [
    {"nickname": " ", "birth_month": "2023-01"},
    {"nickname": "아이", "birth_month": "2023-13"},
    {"nickname": "아이", "birth_month": "2023-01", "health": "private"},
])
def test_validation(ctx, body):
    client, _, _ = ctx
    token, _ = parent(client)
    request(client, "POST", "/children", token, 422, json=body)


def test_empty_report_and_missing_provider(ctx):
    client, _, _ = ctx
    token, child, persona = setup(client)
    result = request(client, "GET", f'/children/{child["id"]}/report?date=2026-10-31', token)
    assert result["sense_ratios"] is None and result["event_count"] == 0
    request(client, "POST", f'/children/{child["id"]}/voice/register?persona_id={persona["id"]}', token, 503)


def test_voice_turn_and_generated_tts_are_scoped(ctx, monkeypatch):
    from app.routers import voice
    client, _, _ = ctx
    _, _, _, tablet, _, session = active(client)
    monkeypatch.setattr(voice, "stt", lambda **kwargs: voice.SttOut(text="사과", features=voice.SpeechFeatures(
        duration_s=1, speech_s=1, speech_ratio=1, syllables_per_s=2, volume=.3, pause_mean_s=0,
        pitch_hz=220, pitch_var=0, snr_db=20), matched=True, alert=False))
    path, token = f'/tablet/sessions/{session["id"]}', tablet["access_token"]
    result = request(client, "POST", path + "/turn", token, files={"file": ("a.wav", wav(), "audio/wav")})
    assert result["heard"] and result["reply"]["message"]["safety_status"] == "grounded"
    captured = []
    def synthesize(body):
        captured.append(body)
        return voice.TtsOut(url="http://localhost/static/test.mp3")
    monkeypatch.setattr(voice, "tts", synthesize)
    message_id = result["reply"]["message"]["id"]
    request(client, "POST", path + f"/messages/{message_id}/tts", token)
    assert captured[0].text == result["reply"]["message"]["text"]
    assert captured[0].child_id.startswith("media_")
    request(client, "POST", path + "/messages/missing/tts", token, 404)


def test_cross_device_session_and_cross_child_feedback(ctx):
    client, _, _ = ctx
    token, child, persona, tablet, _, session = active(client)
    another, _ = paired(client, token, child, persona)
    request(client, "POST", f'/tablet/sessions/{session["id"]}/messages', another["access_token"], 404, json={"text": "사과"})
    second = request(client, "POST", "/children", token, 201, json={"nickname": "다른 아이", "birth_month": "2023-01"})
    fb = request(client, "POST", f'/children/{child["id"]}/feedback', token, 201, json={"for_date": "2026-10-31"})
    request(client, "POST", f'/children/{second["id"]}/plans', token, 409, json={"date": "2026-11-01", "persona_id": persona["id"], "feedback_id": fb["id"]})


def test_persona_media_separation_and_foreign_upload(ctx):
    client, _, _ = ctx
    token, child, persona = setup(client)
    second = request(client, "POST", "/personas", token, 201, json={"parent_title": "아빠"})
    result = request(client, "GET", f'/children/{child["id"]}/training-progress?persona_id={second["id"]}', token)
    assert result["voice"]["sentences"] == 0 and result["mouth"]["sentences"] == 0
    other, _ = parent(client)
    request(client, "POST", f'/children/{child["id"]}/samples/audio', other, 404,
            data={"persona_id": persona["id"], "text": "사과"}, files={"file": ("a.wav", wav(), "audio/wav")})


def test_llm_selection_rejects_arbitrary_output(ctx, monkeypatch):
    from app import curriculum_agent, llm
    client, engine, _ = ctx
    with Session(engine) as db:
        from app.models import LearningContent
        items = db.exec(select(LearningContent).where(LearningContent.day_number == 1)).all()
    monkeypatch.setenv("ANTHROPIC_AUTH_TOKEN", "test-no-network")
    monkeypatch.setattr(llm, "chat", lambda *args, **kwargs: '{"content_id":"not-allowed","praise":"warm","text":"임의 문장"}')
    text, source, engine = curriculum_agent.select_response(items, items[0], "normal")
    assert engine == "curriculum_fallback" and "임의 문장" not in text
    monkeypatch.setattr(llm, "chat", lambda *args, **kwargs: '{"content_id":"' + items[0].id + '","praise":"warm"}')
    text, source, engine = curriculum_agent.select_response(items, items[0], "normal")
    assert engine == "llm_selection" and source == items[0].id


def test_database_survives_new_client(ctx):
    client, _, _ = ctx
    token, child, _ = setup(client, media=False)
    # 새로운 HTTP 클라이언트/DB 세션에서도 같은 토큰과 저장된 아이를 조회한다.
    with TestClient(app) as second:
        result = request(second, "GET", f'/children/{child["id"]}', token)
        assert result["nickname"] == "봄이"


def test_silent_turn_removes_temporary_files(ctx):
    from app.storage import DATA_DIR
    client, _, _ = ctx
    _, _, _, tablet, _, session = active(client)
    silence = io.BytesIO()
    with wave.open(silence, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(16000)
        f.writeframes(bytes(32000))
    before = set((DATA_DIR / "tmp").glob("*"))
    result = request(client, "POST", f'/tablet/sessions/{session["id"]}/turn', tablet["access_token"], files={"file": ("silent.wav", silence.getvalue(), "audio/wav")})
    assert result == {"heard": False, "reply": None}
    assert set((DATA_DIR / "tmp").glob("*")) == before
