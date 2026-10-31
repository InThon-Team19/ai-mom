"""소유권·동의·계획·대화 상태와 집계를 한 트랜잭션에서 처리한다."""
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from app.auth import owned
from app.models import (
    Child, Consent, ConversationSession, Device, EveningReview, Feedback,
    LearningContent, Message, MessageSource, Persona, Plan, PlanItem,
    ReviewItem, Sample, SensoryEvent, now,
)

SEOUL = timezone(timedelta(hours=9))


def seoul_now():
    return datetime.now(SEOUL)


def today():
    return seoul_now().date()


def seed_content(db: Session):
    for item_id, day, word, english, activity, prompt in [
        ("demo-apple", 1, "사과", "Apple", "bite", "사과! 사과를 톡 눌러 볼까?"),
        ("demo-banana", 1, "바나나", "Banana", "peel", "바나나! 껍질을 살살 벗겨 볼까?"),
        ("demo-cookie", 2, "과자", "Cookie", "tap", "과자! 과자를 톡 눌러 볼까?"),
    ]:
        if not db.get(LearningContent, item_id):
            db.add(LearningContent(id=item_id, day_number=day, word=word, english_word=english, activity=activity, prompt=prompt))
    db.commit()


def latest_consent(db, child_id):
    return db.exec(select(Consent).where(Consent.child_id == child_id).order_by(Consent.created_at.desc(), Consent.id.desc())).first()


def require_consent(db, child_id):
    consent = latest_consent(db, child_id)
    if not consent or not consent.parent_biometrics or not consent.child_signals:
        raise HTTPException(409, "부모 생체 데이터와 아이 반응 데이터 동의가 필요해요")


def checklist(db, child, persona):
    consent = latest_consent(db, child.id)
    samples = db.exec(select(Sample).where(Sample.child_id == child.id, Sample.persona_id == persona.id, Sample.purpose == "onboarding")).all()
    checks = {
        "child_profile": True,
        "persona_confirmed": persona.status == "confirmed",
        "parent_biometrics": bool(consent and consent.parent_biometrics),
        "child_signals": bool(consent and consent.child_signals),
        "voice_sample": any(s.kind == "audio" for s in samples),
        "mouth_sample": any(s.kind == "mouth_track" for s in samples),
    }
    return {"ready": all(checks.values()), "checks": checks}


def tablet_context(db, token, ready=True):
    device = db.get(Device, token.device_id)
    if not device or device.revoked_at:
        raise HTTPException(401, "연결 해제된 기기예요")
    child = owned(db, Child, device.child_id, token.parent_id)
    persona = owned(db, Persona, device.persona_id, token.parent_id)
    status = checklist(db, child, persona)
    if ready and not status["ready"]:
        raise HTTPException(409, {"message": "가입 설정을 완료해 주세요", **status})
    return device, child, persona, status


def plan_content(db, plan_id):
    return db.exec(select(LearningContent).join(PlanItem, PlanItem.content_id == LearningContent.id).where(PlanItem.plan_id == plan_id).order_by(PlanItem.position)).all()


def plan_out(db, plan):
    return {**plan.model_dump(), "content_ids": [c.id for c in plan_content(db, plan.id)]}


def make_plan(db, child, body):
    persona = owned(db, Persona, body.persona_id, child.parent_id)
    if persona.status != "confirmed":
        raise HTTPException(409, "페르소나를 먼저 확정해 주세요")
    if db.exec(select(Plan).where(Plan.child_id == child.id, Plan.date == body.date.isoformat())).first():
        raise HTTPException(409, "해당 날짜 계획이 이미 있어요")
    feedback = None
    if body.feedback_id:
        feedback = owned(db, Feedback, body.feedback_id, child.parent_id)
        if feedback.child_id != child.id or date.fromisoformat(feedback.for_date) + timedelta(days=1) != body.date:
            raise HTTPException(409, "아이와 다음날 날짜가 일치하는 피드백만 적용할 수 있어요")
        if db.exec(select(Plan).where(Plan.feedback_id == feedback.id)).first():
            raise HTTPException(409, "이미 적용한 피드백이에요")
    content = db.exec(select(LearningContent).where(LearningContent.day_number == body.day_number).order_by(LearningContent.id)).all()
    if not content:
        raise HTTPException(409, "학습 자료가 없어요")
    script = " ".join(c.prompt + (f" {c.english_word}." if persona.english_enabled else "") for c in content)
    plan = Plan(child_id=child.id, persona_id=persona.id, date=body.date.isoformat(), day_number=body.day_number,
                feedback_id=body.feedback_id, pacing=feedback.pacing if feedback else "normal", reading_script=script)
    db.add(plan)
    db.flush()
    for position, c in enumerate(content):
        db.add(PlanItem(plan_id=plan.id, content_id=c.id, position=position))
    db.flush()
    return plan


def scoped_plan(db, plan_id, parent_id):
    plan = db.get(Plan, plan_id)
    if not plan:
        raise HTTPException(404, "계획을 찾을 수 없어요")
    child = owned(db, Child, plan.child_id, parent_id)
    return plan, child


def session_access(db, token, session_id, active=False):
    device, child, persona, _ = tablet_context(db, token)
    session = db.get(ConversationSession, session_id)
    if not session or session.child_id != child.id or session.persona_id != persona.id or session.device_id != device.id:
        raise HTTPException(404, "세션을 찾을 수 없어요")
    if active and session.status != "active":
        raise HTTPException(409, "종료된 세션이에요")
    if active:
        check_usage(db, child, session)
    return session, child, persona


def elapsed_seconds(session):
    return max(0, ((session.ended_at or now()) - session.created_at).total_seconds())


def check_usage(db, child, session=None):
    local = seoul_now()
    if not child.window_start <= local.strftime("%H:%M") < child.window_end:
        raise HTTPException(409, "설정한 대화 시간이 아니에요")
    sessions = db.exec(select(ConversationSession).join(Plan, Plan.id == ConversationSession.plan_id).where(ConversationSession.child_id == child.id, Plan.date == local.date().isoformat())).all()
    if sum(elapsed_seconds(s) for s in sessions) >= child.daily_limit_minutes * 60:
        raise HTTPException(409, "오늘의 대화 시간이 끝났어요. 부모님과 함께 쉬어요")
    if session:
        plan = db.get(Plan, session.plan_id)
        if plan.date != local.date().isoformat():
            raise HTTPException(409, "오늘 계획의 세션만 진행할 수 있어요")


def start_session(db, token, body):
    device, child, persona, _ = tablet_context(db, token)
    plan, _ = scoped_plan(db, body.plan_id, token.parent_id)
    if plan.child_id != child.id or plan.persona_id != persona.id:
        raise HTTPException(404, "계획을 찾을 수 없어요")
    if plan.date != today().isoformat():
        raise HTTPException(409, "오늘 계획만 시작할 수 있어요")
    if plan.reading_status != "submitted":
        raise HTTPException(409, "부모의 계획 낭독이 필요해요")
    check_usage(db, child)
    if db.exec(select(ConversationSession).where(ConversationSession.child_id == child.id, ConversationSession.status == "active")).first():
        raise HTTPException(409, "진행 중인 세션을 먼저 종료해 주세요")
    session = ConversationSession(child_id=child.id, plan_id=plan.id, persona_id=persona.id, device_id=device.id, mode=body.mode, pacing=plan.pacing)
    db.add(session)
    db.flush()
    opening = Message(session_id=session.id, sequence=1, text=f"{child.nickname}야, 안녕! " + plan_content(db, plan.id)[0].prompt)
    db.add(opening)
    db.flush()
    db.add(MessageSource(message_id=opening.id, content_id=plan_content(db, plan.id)[0].id))
    return {"session": session, "message": opening, "source_ids": [plan_content(db, plan.id)[0].id], "haptics_enabled": child.haptics_enabled and body.mode != "audio_only"}


def respond(db, session, text):
    """시연용 자료 기반 결정형 응답. 자유 LLM/학습 완료를 주장하지 않는다.

    아이의 원문은 저장하지 않고, 범위/안전 분류와 에이전트 출력만 저장한다.
    """
    content = plan_content(db, session.plan_id)
    normalized = text.lower().replace(" ", "")
    matched = next((c for c in content if c.word in normalized or c.english_word.lower() in normalized), None)
    danger = any(word in normalized for word in ("아파", "살려", "무서워", "때렸", "죽", "피가"))
    source, engine = None, "curriculum"
    if danger:
        status, reply = "needs_parent", "가까이 있는 어른에게 바로 알려 주세요. 잠시 쉬어요."
    elif matched:
        from app.curriculum_agent import select_response
        reply, source, engine = select_response(content, matched, session.pacing)
        status = "grounded"
    elif normalized in {"응", "네", "좋아", "안녕", "다시", "몰라"}:
        status, reply, source = "grounded", "함께 해보자! " + content[0].prompt, content[0].id
    else:
        status, reply = "out_of_scope", "그 이야기는 부모님과 함께 알아보자. 지금은 " + content[0].word + " 놀이를 해볼까?"
    sequence = (db.exec(select(func.max(Message.sequence)).where(Message.session_id == session.id)).one() or 0) + 1
    message = Message(session_id=session.id, sequence=sequence, text=reply, safety_status=status)
    db.add(message)
    db.flush()
    if source:
        db.add(MessageSource(message_id=message.id, content_id=source))
    if status != "grounded":
        db.add(ReviewItem(child_id=session.child_id, message_id=message.id, reason=status))
    if danger:
        session.status, session.ended_at = "ended", now()
        db.add(session)
    return {"message": message, "source_ids": [source] if source else [], "session_status": session.status, "engine": engine}


def report(db, child_id, end: date, period="day"):
    start = end - timedelta(days=6 if period == "week" else 0)
    sessions = db.exec(select(ConversationSession).join(Plan, Plan.id == ConversationSession.plan_id).where(
        ConversationSession.child_id == child_id, Plan.date >= start.isoformat(), Plan.date <= end.isoformat())).all()
    ids = [s.id for s in sessions]
    events = db.exec(select(SensoryEvent).where(SensoryEvent.session_id.in_(ids))).all() if ids else []
    counts = Counter(e.sense for e in events)
    reviews = db.exec(select(ReviewItem).join(Message, ReviewItem.message_id == Message.id).where(Message.session_id.in_(ids))).all() if ids else []
    words = sorted({db.get(LearningContent, e.content_id).word for e in events if e.action == "repeat"})
    return {
        "from_date": start.isoformat(), "to_date": end.isoformat(), "period": period,
        "session_count": len(sessions), "duration_seconds": round(sum(elapsed_seconds(s) for s in sessions)),
        "event_count": len(events), "sense_counts": {sense: counts[sense] for sense in ("auditory", "visual", "tactile")},
        "sense_ratios": {sense: round(counts[sense] / len(events), 3) for sense in ("auditory", "visual", "tactile")} if events else None,
        "practiced_words": words, "review_items": reviews,
        "learning_rate": None, "development_score": None,
    }
