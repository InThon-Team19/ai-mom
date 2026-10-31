# 낮: 에이전트 대화 — 담당: 민주(라우터) · 충항(에이전트) · 작성: 태희(대행)
# 계약: docs/api.md "에이전트 대화" — POST /conversation/turn
# 인증·가족 소유권은 main.py 의 legacy_scope 가 body.child_id 로 검사 (태블릿 기기 토큰 가능)
import threading
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.agent.turn import make_turn, warm_up
from app.auth import DB
from app.models import Child

router = APIRouter(prefix="/conversation", tags=["conversation"])
threading.Thread(target=warm_up, daemon=True).start()  # 첫 대화 지연 줄이기


class Signals(BaseModel):
    touches: int = 0
    reaction_ms: float | None = None
    gaze_ratio: float | None = None
    smiles: int = 0
    voices: int = 0
    repeated: bool | None = None
    mood: Literal["engaged", "calm", "overloaded", "distracted"] | None = None


class TurnIn(BaseModel):
    child_id: str
    day: int = Field(default=1, ge=1, le=30)
    item: str = "apple"
    moment: Literal["invite", "reply"] = "invite"
    child_text: str | None = Field(default=None, max_length=300)
    signals: Signals | None = None


class TurnOut(BaseModel):
    text: str
    out_of_scope: bool = False
    blocked: str | None = None


@router.post("/turn", response_model=TurnOut)
def turn(body: TurnIn, db: DB):
    from app.family import profile_view
    child = db.get(Child, body.child_id)
    profile = profile_view(db, child) if child else {}
    return TurnOut(**make_turn(body.day, body.item, body.moment, body.child_text,
                               body.signals.model_dump() if body.signals else None, profile))
