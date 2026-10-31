# 담당: 민주 — SQLModel 테이블 정의. 바꾸면 docs/api.md + app/src/lib/types.ts 같이 수정
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Column, DDL, JSON, UniqueConstraint, Index, event, text
from sqlmodel import Field, SQLModel
from app.db_types import UTCDateTime


def now() -> datetime:
    return datetime.now(timezone.utc)


class Record(SQLModel):
    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    created_at: datetime = Field(default_factory=now, sa_type=UTCDateTime())


class Parent(Record, table=True):
    email: str = Field(unique=True, index=True)
    display_name: str
    password_hash: str


class LoginAccount(Record, table=True):
    login_id: str = Field(unique=True, index=True)
    password_hash: str
    child_id: str = Field(unique=True)
    profile: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))


class LoginSession(Record, table=True):
    account_id: str = Field(foreign_key="loginaccount.id", index=True)
    token_hash: str = Field(unique=True, index=True)
    expires_at: datetime = Field(sa_type=UTCDateTime())


# 브라우저의 Supabase anon/authenticated 역할에는 계정/세션을 공개하지 않는다.
# 백엔드 DB 소유자 연결만 사용한다.
for _model in (LoginAccount, LoginSession):
    event.listen(_model.__table__, "after_create", DDL(
        f'ALTER TABLE "{_model.__tablename__}" ENABLE ROW LEVEL SECURITY'
    ).execute_if(dialect="postgresql"))



class Child(Record, table=True):
    parent_id: str = Field(foreign_key="parent.id", index=True)
    nickname: str
    birth_month: str
    speech_level: str
    interests: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    haptics_enabled: bool = True
    daily_limit_minutes: int = 30
    window_start: str = "09:00"
    window_end: str = "18:00"


class FamilyProfile(SQLModel, table=True):
    child_id: str = Field(foreign_key="child.id", primary_key=True)
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    link_hash: str | None = Field(default=None, unique=True)
    link_expires_at: datetime | None = Field(default=None, sa_type=UTCDateTime())


class SchemaVersion(SQLModel, table=True):
    version: int = Field(primary_key=True)


class Persona(Record, table=True):
    parent_id: str = Field(foreign_key="parent.id", index=True)
    parent_title: str = "엄마"
    speaking_style: str = "다정한"
    english_enabled: bool = False
    education_goals: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    avatar: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    status: str = "draft"


class Consent(Record, table=True):
    child_id: str = Field(foreign_key="child.id", index=True)
    parent_id: str = Field(foreign_key="parent.id")
    parent_biometrics: bool
    child_signals: bool
    policy_version: str = "demo-v1"


class Sample(Record, table=True):
    parent_id: str = Field(foreign_key="parent.id")
    child_id: str = Field(foreign_key="child.id", index=True)
    persona_id: str = Field(foreign_key="persona.id")
    kind: str
    purpose: str = "onboarding"
    plan_id: str | None = Field(default=None, foreign_key="plan.id")
    storage_key: str
    sentence_count: int = 1
    status: str = "submitted"


class LearningContent(Record, table=True):
    day_number: int
    word: str
    english_word: str
    activity: str
    prompt: str
    source: str = "내부 작성 시연 문장"
    review_status: str = "demo"


class Feedback(Record, table=True):
    parent_id: str = Field(foreign_key="parent.id")
    child_id: str = Field(foreign_key="child.id", index=True)
    for_date: str
    concerns: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    new_words: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    pacing: str = "normal"


class Plan(Record, table=True):
    __table_args__ = (UniqueConstraint("child_id", "date"),)
    child_id: str = Field(foreign_key="child.id", index=True)
    persona_id: str = Field(foreign_key="persona.id")
    date: str
    day_number: int
    feedback_id: str | None = Field(default=None, foreign_key="feedback.id", unique=True)
    pacing: str = "normal"
    reading_script: str
    reading_status: str = "required"


class PlanItem(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("plan_id", "position"),)
    plan_id: str = Field(foreign_key="plan.id", primary_key=True)
    content_id: str = Field(foreign_key="learningcontent.id", primary_key=True)
    position: int


class Device(Record, table=True):
    parent_id: str = Field(foreign_key="parent.id")
    child_id: str = Field(foreign_key="child.id", index=True)
    persona_id: str = Field(foreign_key="persona.id")
    label: str
    revoked_at: datetime | None = Field(default=None, sa_type=UTCDateTime())


class RegisteredClient(SQLModel, table=True):
    child_id: str = Field(foreign_key="child.id", primary_key=True)
    device_id: str = Field(primary_key=True, max_length=128)
    role: str
    name: str
    auth_device_id: str | None = Field(default=None, foreign_key="device.id")
    access_token_id: str | None = Field(default=None, foreign_key="accesstoken.id")
    linked_at: datetime = Field(default_factory=now, sa_type=UTCDateTime())
    last_seen: datetime = Field(default_factory=now, sa_type=UTCDateTime())


class AccessToken(Record, table=True):
    token_hash: str = Field(unique=True, index=True)
    parent_id: str = Field(foreign_key="parent.id")
    device_id: str | None = Field(default=None, foreign_key="device.id")
    expires_at: datetime = Field(sa_type=UTCDateTime())
    revoked_at: datetime | None = Field(default=None, sa_type=UTCDateTime())


class PairingCode(Record, table=True):
    code_hash: str = Field(unique=True, index=True)
    child_id: str = Field(foreign_key="child.id")
    persona_id: str = Field(foreign_key="persona.id")
    expires_at: datetime = Field(sa_type=UTCDateTime())
    used_at: datetime | None = Field(default=None, sa_type=UTCDateTime())


class RateAttempt(Record, table=True):
    bucket: str = Field(index=True)


class ConversationSession(Record, table=True):
    __table_args__ = (Index("one_active_session_per_child", "child_id", unique=True,
                            sqlite_where=text("status = 'active'"), postgresql_where=text("status = 'active'")),)
    child_id: str = Field(foreign_key="child.id", index=True)
    plan_id: str = Field(foreign_key="plan.id")
    persona_id: str = Field(foreign_key="persona.id")
    device_id: str | None = Field(default=None, foreign_key="device.id")
    mode: str = "multisensory"
    status: str = "active"
    pacing: str = "normal"
    ended_at: datetime | None = Field(default=None, sa_type=UTCDateTime())


class Message(Record, table=True):
    __table_args__ = (UniqueConstraint("session_id", "sequence"),)
    session_id: str = Field(foreign_key="conversationsession.id", index=True)
    sequence: int
    speaker: str = "agent"
    text: str
    safety_status: str = "grounded"
    delivery_status: str = "prepared"


class MessageSource(SQLModel, table=True):
    message_id: str = Field(foreign_key="message.id", primary_key=True)
    content_id: str = Field(foreign_key="learningcontent.id", primary_key=True)


class SensoryEvent(Record, table=True):
    session_id: str = Field(foreign_key="conversationsession.id", index=True)
    content_id: str = Field(foreign_key="learningcontent.id")
    sense: str
    action: str
    reaction_ms: int | None = None


class ReviewItem(Record, table=True):
    child_id: str = Field(foreign_key="child.id", index=True)
    message_id: str = Field(foreign_key="message.id")
    reason: str
    status: str = "pending"


class EveningReview(Record, table=True):
    __table_args__ = (UniqueConstraint("child_id", "date"),)
    child_id: str = Field(foreign_key="child.id")
    date: str
