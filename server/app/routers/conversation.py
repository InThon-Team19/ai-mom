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


class HistoryTurn(BaseModel):
    role: Literal["child", "avatar"]
    text: str = Field(default="", max_length=300)


class TurnIn(BaseModel):
    child_id: str
    day: int = Field(default=1, ge=1, le=30)
    item: str = "apple"
    moment: Literal["invite", "reply", "chat"] = "invite"  # chat: 학습 뒤 '엄마랑 이야기하기' (일상 대화로 교감)
    child_text: str | None = Field(default=None, max_length=300)
    signals: Signals | None = None
    history: list[HistoryTurn] | None = Field(default=None, max_length=12)  # chat: 최근 대화 (앱이 보냄, 서버는 저장 안 함)


class TurnOut(BaseModel):
    text: str
    out_of_scope: bool = False
    blocked: str | None = None


@router.post("/turn", response_model=TurnOut)
def turn(body: TurnIn, db: DB):
    from app.family import profile_view
    child = db.get(Child, body.child_id)
    # parent=True: 부모 피드백(feedback[])을 프롬프트에 넣기 위해. 기기용 보기(parent=False)는 feedback 을 빼서
    # 태블릿 대화에 어젯밤 피드백이 반영되지 않았음. 이 값은 프롬프트에만 쓰고 응답으로 돌려주지 않음
    profile = profile_view(db, child, parent=True) if child else {}
    return TurnOut(**make_turn(body.day, body.item, body.moment, body.child_text,
                               body.signals.model_dump() if body.signals else None, profile,
                               [h.model_dump() for h in body.history] if body.history else None))
