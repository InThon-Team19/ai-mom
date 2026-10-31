"""공개 API 입력 계약. 알 수 없는 필드와 공백 입력을 거부한다."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class SignupIn(Input):
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    password: str = Field(min_length=10, max_length=128)
    display_name: str = Field(min_length=1, max_length=60)


class LoginIn(Input):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class ChildIn(Input):
    nickname: str = Field(min_length=1, max_length=40)
    birth_month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    speech_level: Literal["babbling", "single_words", "two_words", "short_sentences"] = "single_words"
    interests: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("birth_month")
    @classmethod
    def valid_birth(cls, value):
        if date.fromisoformat(value + "-01") > date.today():
            raise ValueError("미래 생년월은 사용할 수 없어요")
        return value


class PersonaIn(Input):
    parent_title: str = Field(default="엄마", min_length=1, max_length=20)
    speaking_style: Literal["다정한", "장난스러운", "차분한"] = "다정한"
    english_enabled: bool = False
    education_goals: list[Literal["korean_expression", "english_exposure", "songs_and_play", "audio_focus"]] = Field(default_factory=list)
    avatar: dict[str, str] = Field(default_factory=lambda: {"preset": "default"}, max_length=20)


class ConsentIn(Input):
    parent_biometrics: bool
    child_signals: bool
    policy_version: Literal["demo-v1"] = "demo-v1"


class SettingsIn(Input):
    haptics_enabled: bool = True
    daily_limit_minutes: int = Field(default=30, ge=1, le=120)
    window_start: str = Field(default="09:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    window_end: str = Field(default="18:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")

    @model_validator(mode="after")
    def window_order(self):
        if self.window_start >= self.window_end:
            raise ValueError("같은 날의 시작 시간은 종료 시간보다 빨라야 해요")
        return self


class PairCodeIn(Input):
    persona_id: str


class PairIn(Input):
    code: str = Field(pattern=r"^\d{6}$")
    label: str = Field(default="아이 태블릿", min_length=1, max_length=60)


class PlanIn(Input):
    date: date
    persona_id: str
    day_number: Literal[1, 2] = 1
    feedback_id: str | None = None


class SessionIn(Input):
    plan_id: str
    mode: Literal["multisensory", "audio_only"] = "multisensory"


class ModeIn(Input):
    mode: Literal["multisensory", "audio_only"]


class MessageIn(Input):
    text: str = Field(min_length=1, max_length=500)


class EventIn(Input):
    content_id: str
    sense: Literal["auditory", "visual", "tactile"]
    action: Literal["repeat", "listen", "gaze", "tap", "peel", "bite", "drag", "swipe"]
    reaction_ms: int | None = Field(default=None, ge=0, le=600000)

    @model_validator(mode="after")
    def matching_action(self):
        actions = {"auditory": {"repeat", "listen"}, "visual": {"gaze"}, "tactile": {"tap", "peel", "bite", "drag", "swipe"}}
        if self.action not in actions[self.sense]:
            raise ValueError("감각과 동작이 일치하지 않아요")
        return self


class FeedbackIn(Input):
    for_date: date
    concerns: list[Literal["too_fast", "too_difficult", "haptics_too_strong", "voice_unnatural"]] = Field(default_factory=list, max_length=4)
    new_words: list[str] = Field(default_factory=list, max_length=30)


class DayIn(Input):
    date: date


class ReadingIn(Input):
    audio_sample_id: str
    mouth_sample_id: str


class ReviewIn(Input):
    status: Literal["reviewed"] = "reviewed"
