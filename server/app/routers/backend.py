"""담당: 민주 — /api 영속 백엔드. 기존 입력 처리기는 인증 후에만 호출한다."""
import base64
import binascii
import io
import secrets
from datetime import date, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import update
from sqlmodel import select

from app import schemas as S, services as svc
from app.auth import DB, ParentAuth, Principal, TabletAuth, digest, issue_token, owned, password_hash, rate_limit, verify_password
from app.models import (
    AccessToken, Child, Consent, ConversationSession, Device, EveningReview, Feedback,
    LearningContent, Message, PairingCode, Parent, Persona, Plan, ReviewItem, Sample,
    SensoryEvent, now,
)

router = APIRouter(prefix="/api", tags=["backend"])


@router.post("/auth/signup", status_code=201)
def signup(body: S.SignupIn, request: Request, db: DB):
    rate_limit(db, "signup:" + digest(request.client.host if request.client else "local"), 10)
    email = body.email.lower()
    if db.exec(select(Parent).where(Parent.email == email)).first():
        raise HTTPException(409, "이미 등록된 이메일이에요")
    parent = Parent(email=email, display_name=body.display_name, password_hash=password_hash(body.password))
    db.add(parent)
    db.flush()
    token = issue_token(db, parent.id)
    db.commit()
    return {**token, "parent": {"id": parent.id, "email": parent.email, "display_name": parent.display_name}}


@router.post("/auth/login")
def login(body: S.LoginIn, request: Request, db: DB):
    rate_limit(db, "login:" + digest(request.client.host if request.client else "local"), 10)
    parent = db.exec(select(Parent).where(Parent.email == body.email.lower())).first()
    if not parent or not verify_password(body.password, parent.password_hash):
        raise HTTPException(401, "이메일 또는 비밀번호를 확인해 주세요")
    result = issue_token(db, parent.id)
    db.commit()
    return result


@router.post("/auth/logout")
def logout(token: Principal, db: DB):
    token.revoked_at = now()
    db.add(token)
    db.commit()
    return {"ok": True}


@router.get("/me")
def me(token: ParentAuth, db: DB):
    parent = db.get(Parent, token.parent_id)
    return {"id": parent.id, "email": parent.email, "display_name": parent.display_name}


@router.get("/ui-options")
def ui_options():
    return {"speech_levels": ["single_words", "two_words", "short_sentences"],
            "education_goals": ["korean_expression", "english_exposure", "songs_and_play", "audio_focus"],
            "feedback": ["too_fast", "too_difficult", "haptics_too_strong", "voice_unnatural"],
            "policy_version": "demo-v1", "curriculum_days": [1, 2]}


@router.get("/recording-prompts")
def recording_prompts():
    return {"prompts": ["사과! 사과를 톡 눌러 볼까?", "바나나! 껍질을 살살 벗겨 볼까?", "잘했어! 천천히 함께 해보자."]}


@router.post("/children", status_code=201)
def create_child(body: S.ChildIn, token: ParentAuth, db: DB):
    child = Child(parent_id=token.parent_id, **body.model_dump())
    db.add(child)
    db.commit()
    db.refresh(child)
    return child


@router.get("/children")
def children(token: ParentAuth, db: DB):
    return db.exec(select(Child).where(Child.parent_id == token.parent_id)).all()


@router.get("/children/{child_id}")
def get_child(child_id: str, token: ParentAuth, db: DB):
    return owned(db, Child, child_id, token.parent_id)


@router.put("/children/{child_id}/settings")
def settings(child_id: str, body: S.SettingsIn, token: ParentAuth, db: DB):
    child = owned(db, Child, child_id, token.parent_id)
    for key, value in body.model_dump().items():
        setattr(child, key, value)
    db.add(child)
    db.commit()
    db.refresh(child)
    return child


@router.put("/children/{child_id}/consents")
def consent(child_id: str, body: S.ConsentIn, token: ParentAuth, db: DB):
    owned(db, Child, child_id, token.parent_id)
    record = Consent(parent_id=token.parent_id, child_id=child_id, **body.model_dump())
    db.add(record)
    if not body.parent_biometrics or not body.child_signals:
        for session in db.exec(select(ConversationSession).where(ConversationSession.child_id == child_id, ConversationSession.status == "active")).all():
            session.status, session.ended_at = "ended", now()
            db.add(session)
    db.commit()
    db.refresh(record)
    return record


@router.post("/personas", status_code=201)
def persona(body: S.PersonaIn, token: ParentAuth, db: DB):
    record = Persona(parent_id=token.parent_id, **body.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/personas")
def personas(token: ParentAuth, db: DB):
    return db.exec(select(Persona).where(Persona.parent_id == token.parent_id)).all()


@router.post("/personas/{persona_id}/confirm")
def confirm(persona_id: str, token: ParentAuth, db: DB):
    record = owned(db, Persona, persona_id, token.parent_id)
    record.status = "confirmed"
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/children/{child_id}/onboarding")
def onboarding(child_id: str, persona_id: str, token: ParentAuth, db: DB):
    return svc.checklist(db, owned(db, Child, child_id, token.parent_id), owned(db, Persona, persona_id, token.parent_id))


def sample_context(db, token, child_id, persona_id, purpose, plan_id):
    child = owned(db, Child, child_id, token.parent_id)
    owned(db, Persona, persona_id, token.parent_id)
    svc.require_consent(db, child.id)
    if purpose == "night_reading":
        if not plan_id:
            raise HTTPException(422, "계획 ID가 필요해요")
        plan, _ = svc.scoped_plan(db, plan_id, token.parent_id)
        if plan.child_id != child_id or plan.persona_id != persona_id:
            raise HTTPException(409, "낭독의 아이·페르소나·계획이 일치하지 않아요")
    elif plan_id:
        raise HTTPException(422, "가입 샘플에는 계획을 지정할 수 없어요")


def media_id(child_id, persona_id):
    return "media_" + digest(child_id + ":" + persona_id)[:32]


def check_upload(file):
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if not 0 < size <= 20 * 1024 * 1024:
        raise HTTPException(413, "녹음 파일은 20MB 이하여야 해요")


@router.post("/children/{child_id}/samples/audio", status_code=201)
def audio_sample(child_id: str, token: ParentAuth, db: DB,
                 file: Annotated[UploadFile, File()], persona_id: Annotated[str, Form()],
                 text: Annotated[str, Form(min_length=1, max_length=2000)],
                 purpose: Annotated[Literal["onboarding", "night_reading"], Form()] = "onboarding",
                 plan_id: Annotated[str | None, Form()] = None):
    from app.routers.voice import parent_sample
    sample_context(db, token, child_id, persona_id, purpose, plan_id)
    check_upload(file)
    key = media_id(child_id, persona_id)
    result = parent_sample(child_id=key, file=file, text=text, kind="signup" if purpose == "onboarding" else "plan")
    if not result.quality.ok:
        raise HTTPException(422, result.quality.message)
    record = Sample(parent_id=token.parent_id, child_id=child_id, persona_id=persona_id,
                    kind="audio", purpose=purpose, plan_id=plan_id, storage_key=f"children/{key}/parent")
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"sample": record, "analysis": result}


def decode_audio(body: S.AudioBase64In):
    try:
        raw = base64.b64decode(body.audio_b64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(422, "base64 오디오 형식을 확인해 주세요")
    if not 0 < len(raw) <= 20 * 1024 * 1024:
        raise HTTPException(413, "녹음 파일은 20MB 이하여야 해요")
    return UploadFile(file=io.BytesIO(raw), filename="recording." + body.ext)


@router.post("/children/{child_id}/samples/audio-b64", status_code=201)
def audio_sample_b64(child_id: str, body: S.AudioSampleBase64In, token: ParentAuth, db: DB):
    # 파일 변환 전 소유권/동의를 검사한다. multipart와 동일한 등록 경로를 사용한다.
    sample_context(db, token, child_id, body.persona_id, body.purpose, body.plan_id)
    upload = decode_audio(body)
    try:
        return audio_sample(child_id, token, db, upload, body.persona_id, body.text, body.purpose, body.plan_id)
    finally:
        upload.file.close()


@router.post("/children/{child_id}/samples/mouth", status_code=201)
def mouth_sample(child_id: str, token: ParentAuth, db: DB, body: dict):
    from pydantic import ValidationError
    from app.routers.vision import MouthTrackIn, parent_mouth_track
    # 별도 영상 저장 없이 수치만 등록한다.
    allowed = {"persona_id", "purpose", "plan_id", "text", "track"}
    if set(body) - allowed:
        raise HTTPException(422, "알 수 없는 필드예요")
    persona_id, purpose, plan_id = body.get("persona_id", ""), body.get("purpose", "onboarding"), body.get("plan_id")
    if purpose not in {"onboarding", "night_reading"}:
        raise HTTPException(422, "샘플 목적을 확인해 주세요")
    sample_context(db, token, child_id, persona_id, purpose, plan_id)
    try:
        payload = MouthTrackIn(child_id=media_id(child_id, persona_id), text=body.get("text", ""), track=body.get("track", []), kind="signup" if purpose == "onboarding" else "plan")
    except ValidationError:
        raise HTTPException(422, "입모양 수치 형식을 확인해 주세요")
    if not payload.track or len(payload.track) > 12000:
        raise HTTPException(422, "입모양 수치는 1~12000개가 필요해요")
    import math
    if any(not all(math.isfinite(v) and v >= 0 for v in (p.t, p.open, p.width)) for p in payload.track):
        raise HTTPException(422, "유효한 입모양 수치가 필요해요")
    result = parent_mouth_track(payload)
    if not result.ok:
        raise HTTPException(422, result.message)
    record = Sample(parent_id=token.parent_id, child_id=child_id, persona_id=persona_id, kind="mouth_track",
                    purpose=purpose, plan_id=plan_id, storage_key=f"children/{media_id(child_id, persona_id)}/parent/mouth")
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"sample": record, "analysis": result}


@router.get("/children/{child_id}/training-progress")
def training_progress(child_id: str, persona_id: str, token: ParentAuth, db: DB):
    from app.routers.voice import voice_gauge
    from app.routers.vision import mouth_gauge
    owned(db, Child, child_id, token.parent_id)
    owned(db, Persona, persona_id, token.parent_id)
    key = media_id(child_id, persona_id)
    return {"voice": voice_gauge(key), "mouth": mouth_gauge(key), "meaning": "sample_coverage_not_model_accuracy"}


@router.post("/children/{child_id}/pairing-codes", status_code=201)
def pairing_code(child_id: str, body: S.PairCodeIn, token: ParentAuth, db: DB):
    child = owned(db, Child, child_id, token.parent_id)
    persona = owned(db, Persona, body.persona_id, token.parent_id)
    if not svc.checklist(db, child, persona)["ready"]:
        raise HTTPException(409, "가입 설정을 먼저 완료해 주세요")
    for previous in db.exec(select(PairingCode).where(PairingCode.child_id == child_id, PairingCode.used_at == None)).all():
        previous.used_at = now()
        db.add(previous)
    raw = f"{secrets.randbelow(1000000):06d}"
    while db.exec(select(PairingCode).where(PairingCode.code_hash == digest(raw))).first():
        raw = f"{secrets.randbelow(1000000):06d}"
    record = PairingCode(code_hash=digest(raw), child_id=child_id, persona_id=persona.id, expires_at=now() + timedelta(minutes=5))
    db.add(record)
    db.commit()
    return {"code": raw, "expires_at": record.expires_at}


@router.post("/tablet/pair")
def pair(body: S.PairIn, request: Request, db: DB):
    rate_limit(db, "pair:" + digest(request.client.host if request.client else "local"))
    record = db.exec(select(PairingCode).where(PairingCode.code_hash == digest(body.code))).first()
    if not record or record.used_at or record.expires_at <= now():
        raise HTTPException(400, "유효하지 않거나 만료된 연결 코드예요")
    child = db.get(Child, record.child_id)
    if not svc.checklist(db, child, db.get(Persona, record.persona_id))["ready"]:
        raise HTTPException(409, "가입 설정을 먼저 완료해 주세요")
    # 조건부 갱신으로 동시에 들어온 연결도 한 번만 성공한다.
    claimed = db.exec(update(PairingCode).where(PairingCode.id == record.id, PairingCode.used_at == None, PairingCode.expires_at > now()).values(used_at=now()))
    if claimed.rowcount != 1:
        raise HTTPException(409, "이미 사용한 연결 코드예요")
    device = Device(parent_id=child.parent_id, child_id=child.id, persona_id=record.persona_id, label=body.label)
    db.add(device)
    db.flush()
    result = issue_token(db, child.parent_id, device.id)
    db.commit()
    return {**result, "device": device}


@router.get("/devices")
def devices(token: ParentAuth, db: DB):
    return db.exec(select(Device).where(Device.parent_id == token.parent_id)).all()


@router.delete("/devices/{device_id}")
def revoke_device(device_id: str, token: ParentAuth, db: DB):
    device = owned(db, Device, device_id, token.parent_id)
    device.revoked_at = now()
    db.add(device)
    for session in db.exec(select(ConversationSession).where(ConversationSession.device_id == device.id, ConversationSession.status == "active")).all():
        session.status, session.ended_at = "ended", now()
        db.add(session)
    db.commit()
    return {"ok": True}


@router.get("/tablet/context")
def context(token: TabletAuth, db: DB):
    device, child, persona, status = svc.tablet_context(db, token)
    plan = db.exec(select(Plan).where(Plan.child_id == child.id, Plan.persona_id == persona.id, Plan.date == svc.today().isoformat())).first()
    return {"device": device, "child": child, "persona": persona, "onboarding": status, "plan": svc.plan_out(db, plan) if plan else None}


@router.get("/learning-content")
def content(token: Principal, db: DB):
    if token.device_id:
        svc.tablet_context(db, token)
    return db.exec(select(LearningContent).order_by(LearningContent.day_number, LearningContent.id)).all()


@router.post("/children/{child_id}/plans", status_code=201)
def create_plan(child_id: str, body: S.PlanIn, token: ParentAuth, db: DB):
    result = svc.make_plan(db, owned(db, Child, child_id, token.parent_id), body)
    db.commit()
    db.refresh(result)
    return svc.plan_out(db, result)


@router.get("/plans/{plan_id}")
def plan(plan_id: str, token: ParentAuth, db: DB):
    result, _ = svc.scoped_plan(db, plan_id, token.parent_id)
    return svc.plan_out(db, result)


@router.post("/plans/{plan_id}/reading")
def reading(plan_id: str, body: S.ReadingIn, token: ParentAuth, db: DB):
    plan, child = svc.scoped_plan(db, plan_id, token.parent_id)
    svc.require_consent(db, child.id)
    for sample_id, kind in [(body.audio_sample_id, "audio"), (body.mouth_sample_id, "mouth_track")]:
        sample = owned(db, Sample, sample_id, token.parent_id)
        if sample.plan_id != plan.id or sample.persona_id != plan.persona_id or sample.child_id != child.id or sample.kind != kind or sample.purpose != "night_reading":
            raise HTTPException(409, "이 계획에 등록한 음성·입모양 샘플이 필요해요")
    plan.reading_status = "submitted"
    db.add(plan)
    db.commit()
    return svc.plan_out(db, plan)


@router.post("/tablet/sessions", status_code=201)
def start(body: S.SessionIn, token: TabletAuth, db: DB):
    result = svc.start_session(db, token, body)
    db.commit()
    return result


@router.post("/tablet/sessions/{session_id}/messages")
def message(session_id: str, body: S.MessageIn, token: TabletAuth, db: DB):
    session, _, _ = svc.session_access(db, token, session_id, active=True)
    result = svc.respond(db, session, body.text)
    db.commit()
    return result


@router.post("/tablet/sessions/{session_id}/events", status_code=201)
def event(session_id: str, body: S.EventIn, token: TabletAuth, db: DB):
    session, child, _ = svc.session_access(db, token, session_id, active=True)
    if body.content_id not in {c.id for c in svc.plan_content(db, session.plan_id)}:
        raise HTTPException(409, "오늘 계획의 활동이 아니에요")
    if session.mode == "audio_only" and body.sense != "auditory":
        raise HTTPException(409, "청각 모드에서는 청각 이벤트만 기록해요")
    record = SensoryEvent(session_id=session.id, **body.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"event": record, "haptics_enabled": child.haptics_enabled and session.mode != "audio_only"}


@router.patch("/tablet/sessions/{session_id}")
def mode(session_id: str, body: S.ModeIn, token: TabletAuth, db: DB):
    session, child, _ = svc.session_access(db, token, session_id, active=True)
    session.mode = body.mode
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session": session, "haptics_enabled": child.haptics_enabled and body.mode != "audio_only"}


@router.post("/tablet/sessions/{session_id}/end")
def end(session_id: str, token: TabletAuth, db: DB):
    session, _, _ = svc.session_access(db, token, session_id)
    if session.status == "active":
        session.status, session.ended_at = "ended", now()
        db.add(session)
        db.commit()
        db.refresh(session)
    return session


@router.get("/children/{child_id}/report")
def report(child_id: str, date: date, token: ParentAuth, db: DB, period: Literal["day", "week"] = "day"):
    owned(db, Child, child_id, token.parent_id)
    return svc.report(db, child_id, date, period)


@router.get("/children/{child_id}/review")
def review(child_id: str, date: date, token: ParentAuth, db: DB):
    owned(db, Child, child_id, token.parent_id)
    return {"date": date, "items": svc.report(db, child_id, date)["review_items"]}


@router.patch("/reviews/{review_id}")
def review_done(review_id: str, body: S.ReviewIn, token: ParentAuth, db: DB):
    record = db.get(ReviewItem, review_id)
    if not record:
        raise HTTPException(404, "확인 항목을 찾을 수 없어요")
    owned(db, Child, record.child_id, token.parent_id)
    record.status = body.status
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.post("/children/{child_id}/evening-review")
def evening_review(child_id: str, body: S.DayIn, token: ParentAuth, db: DB):
    owned(db, Child, child_id, token.parent_id)
    record = db.exec(select(EveningReview).where(EveningReview.child_id == child_id, EveningReview.date == body.date.isoformat())).first()
    if not record:
        record = EveningReview(child_id=child_id, date=body.date.isoformat())
        db.add(record)
        db.commit()
        db.refresh(record)
    return record


@router.post("/children/{child_id}/feedback", status_code=201)
def feedback(child_id: str, body: S.FeedbackIn, token: ParentAuth, db: DB):
    owned(db, Child, child_id, token.parent_id)
    record = Feedback(parent_id=token.parent_id, child_id=child_id, for_date=body.for_date.isoformat(),
                      concerns=body.concerns, new_words=body.new_words, pacing="slow" if "too_fast" in body.concerns else "normal")
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/children/{child_id}/home")
def home(child_id: str, date: date, persona_id: str, token: ParentAuth, db: DB):
    child = owned(db, Child, child_id, token.parent_id)
    persona = owned(db, Persona, persona_id, token.parent_id)
    plan = db.exec(select(Plan).where(Plan.child_id == child_id, Plan.date == date.isoformat())).first()
    tomorrow = (date + timedelta(days=1)).isoformat()
    next_plan = db.exec(select(Plan).where(Plan.child_id == child_id, Plan.date == tomorrow, Plan.persona_id == persona_id)).first()
    checked = db.exec(select(EveningReview).where(EveningReview.child_id == child_id, EveningReview.date == date.isoformat())).first()
    fb = db.exec(select(Feedback).where(Feedback.child_id == child_id, Feedback.for_date == date.isoformat())).first()
    return {"child": child, "onboarding": svc.checklist(db, child, persona), "plan": svc.plan_out(db, plan) if plan else None,
            "report": svc.report(db, child_id, date), "evening_tasks": {"reviewed": bool(checked), "feedback_submitted": bool(fb), "next_reading_submitted": bool(next_plan and next_plan.reading_status == "submitted")}}


@router.get("/children/{child_id}/timeline")
def timeline(child_id: str, date: date, token: ParentAuth, db: DB):
    owned(db, Child, child_id, token.parent_id)
    sessions = db.exec(select(ConversationSession).join(Plan, Plan.id == ConversationSession.plan_id).where(ConversationSession.child_id == child_id, Plan.date == date.isoformat()).order_by(ConversationSession.created_at)).all()
    # 아이 원문과 전체 대화는 노출하지 않고 활동 시각·종류·안전 확인 항목만 제공한다.
    return {"date": date, "sessions": sessions, "review_items": svc.report(db, child_id, date)["review_items"]}


@router.post("/children/{child_id}/voice/register")
def register_voice(child_id: str, persona_id: str, token: ParentAuth, db: DB):
    from app.routers.voice import register
    owned(db, Child, child_id, token.parent_id)
    owned(db, Persona, persona_id, token.parent_id)
    svc.require_consent(db, child_id)
    return register(child_id=media_id(child_id, persona_id))


@router.get("/children/{child_id}/voice-analysis")
def voice_analysis(child_id: str, persona_id: str, token: ParentAuth, db: DB):
    from app.routers.voice import analysis
    owned(db, Child, child_id, token.parent_id)
    owned(db, Persona, persona_id, token.parent_id)
    svc.require_consent(db, child_id)
    return analysis(media_id(child_id, persona_id))


@router.get("/children/{child_id}/coaching")
def coaching(child_id: str, persona_id: str, token: ParentAuth, db: DB):
    from app.routers.voice import coaching as analyze
    owned(db, Child, child_id, token.parent_id)
    owned(db, Persona, persona_id, token.parent_id)
    svc.require_consent(db, child_id)
    return analyze(media_id(child_id, persona_id))


@router.get("/tablet/mouth-profile")
def mouth_profile(token: TabletAuth, db: DB):
    from app.routers.vision import mouth_profile as profile
    _, child, persona, _ = svc.tablet_context(db, token)
    return profile(media_id(child.id, persona.id))


@router.post("/tablet/sessions/{session_id}/frame")
def frame(session_id: str, token: TabletAuth, db: DB, file: Annotated[UploadFile, File()]):
    from app.routers.vision import child_frame
    svc.session_access(db, token, session_id, active=True)
    check_upload(file)
    return child_frame(file)


@router.post("/tablet/sessions/{session_id}/stt")
def stt(session_id: str, token: TabletAuth, db: DB, file: Annotated[UploadFile, File()]):
    from app.routers.voice import stt as transcribe
    session, _, _ = svc.session_access(db, token, session_id, active=True)
    check_upload(file)
    expected = "|".join(c.word for c in svc.plan_content(db, session.plan_id))
    return transcribe(file=file, expected=expected, who="child")


@router.post("/tablet/sessions/{session_id}/stt-b64")
def stt_b64(session_id: str, body: S.AudioBase64In, token: TabletAuth, db: DB):
    svc.session_access(db, token, session_id, active=True)
    upload = decode_audio(body)
    try:
        return stt(session_id, token, db, upload)
    finally:
        upload.file.close()


@router.post("/tablet/sessions/{session_id}/messages/{message_id}/tts")
def tts(session_id: str, message_id: str, token: TabletAuth, db: DB):
    from app.routers.voice import TtsIn, tts as synthesize
    session, _, _ = svc.session_access(db, token, session_id, active=True)
    message = db.get(Message, message_id)
    if not message or message.session_id != session.id:
        raise HTTPException(404, "발화를 찾을 수 없어요")
    # 임의 문장을 받아 합성하지 않고 검사된 서버 발화만 재생한다.
    return synthesize(TtsIn(child_id=media_id(session.child_id, session.persona_id), text=message.text,
                            speed=0.8 if session.pacing == "slow" else 0.95))


@router.post("/tablet/sessions/{session_id}/turn")
def voice_turn(session_id: str, token: TabletAuth, db: DB, file: Annotated[UploadFile, File()]):
    transcript = stt(session_id, token, db, file)
    if not transcript.text:
        return {"heard": False, "reply": None}
    session, _, _ = svc.session_access(db, token, session_id, active=True)
    result = svc.respond(db, session, transcript.text)
    db.commit()
    return {"heard": True, "reply": result}


@router.post("/tablet/sessions/{session_id}/turn-b64")
def voice_turn_b64(session_id: str, body: S.AudioBase64In, token: TabletAuth, db: DB):
    svc.session_access(db, token, session_id, active=True)
    upload = decode_audio(body)
    try:
        return voice_turn(session_id, token, db, upload)
    finally:
        upload.file.close()
