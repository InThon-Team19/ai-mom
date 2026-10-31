# 아이 반응 기록 (기획 2-2 ② 아이의 투입: 청각·촉각·시각) + 하루 요약 — 담당: 태희
# 리포트(2-2)의 "세 감각 활동 균형"·집중도·따라 말한 단어의 원자료. 대화 문장 생성은 에이전트(충항) 몫
import logging
import json
import time
from collections import Counter

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.storage import child_dir

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/activity", tags=["activity"])

# type → 감각. 앱은 이 type 이름으로 보냄
SENSE = {
    "touch": "touch",          # 화면 터치 {target, reaction_ms}
    "gaze": "visual",          # 화면 응시 {seconds}
    "smile": "visual",         # 웃는 표정
    "expression": "visual",    # 표정 변화 {kind: smile|surprise|frown|neutral, item} — 아이 표정 기억
    "imitate": "visual",       # 입모양 따라 하기 {word}
    "repeat": "audio",         # 따라 말하기 {word, matched, text}
    "voice": "audio",          # 웃음·옹알이 등 소리 반응 {kind}, 자동 녹음된 말소리 {clip_id, text}
    "listen": "audio",         # 부모 목소리 들음 {seconds} (청각 집중 모드 포함)
    "out_of_scope": None,      # 범위 밖 질문 {text} → 부모 확인 필요
    "blocked": None,           # 에이전트가 출력 전 검사에서 막은 문장 {text} → 부모 확인 필요 (기획 v2: 리포트에 반드시 포함)
    "alert": None,             # 위험 신호 {text}
    "session": None,           # 대화 시작 {topic}
}


class Event(BaseModel):
    type: str
    t: float | None = None     # epoch 초 (없으면 서버 시각)
    data: dict = {}


class EventsIn(BaseModel):
    events: list[Event]


def _day_file(child_id: str, day: str):
    return child_dir(child_id, "activity") / f"{day}.jsonl"


def _today() -> str:
    return time.strftime("%Y-%m-%d")


@router.post("/{child_id}")
def add_events(child_id: str, body: EventsIn):
    """아이 태블릿이 반응을 모아서 보냄 (몇 초마다 묶어서)."""
    try:
        f = _day_file(child_id, _today())
    except ValueError:
        raise HTTPException(400, "아이 정보를 찾지 못했어요. 앱을 다시 열고 한 번 더 해 주세요.")
    bad = [e.type for e in body.events if e.type not in SENSE]
    if bad:
        logger.warning("unknown activity types: %s", bad)
        raise HTTPException(400, "활동 기록을 저장하지 못했어요. 앱을 최신 버전으로 바꾼 뒤 다시 해 주세요.")
    now = time.time()
    with f.open("a", encoding="utf-8") as fp:
        for e in body.events:
            fp.write(json.dumps({"type": e.type, "t": e.t or now, "data": e.data}, ensure_ascii=False) + "\n")
    return {"ok": True, "count": len(body.events)}


class Summary(BaseModel):
    day: str
    sessions: int
    touches: int
    reaction_ms: float          # 평균 터치 반응 속도
    gaze_s: float               # 화면 응시 시간 (집중도)
    smiles: int
    repeats: int                # 따라 말하기 시도
    repeat_ok: int              # 성공
    words: list[str]            # 따라 말한 단어
    favorites: list[str]        # 많이 누른 사물
    balance: dict[str, float]   # {"visual": 0.4, "audio": 0.35, "touch": 0.25}
    out_of_scope: list[str]     # 확인 필요 (범위 밖 질문)
    alerts: list[str]
    expressions: dict[str, int] = {}  # 표정 변화 횟수 {smile, surprise, frown, ...}
    voices: int = 0                    # 소리 반응·자동 녹음된 말소리 수
    listen_s: float = 0.0              # 부모 목소리 들은 시간
    moods: dict[str, int] = {}         # 사물별 아이 상태 {engaged, calm, distracted, overloaded} (앱이 감각 반응으로 추정)


def summarize(events: list[dict], day: str) -> Summary:
    by = lambda t: [e for e in events if e["type"] == t]  # noqa: E731
    touches = by("touch")
    gaze_s = sum(e["data"].get("seconds", 0) for e in by("gaze"))
    listen_s = sum(e["data"].get("seconds", 0) for e in by("listen"))
    repeats = by("repeat")
    ok = [e for e in repeats if e["data"].get("matched")]
    smiles = len(by("smile"))
    rt = [e["data"]["reaction_ms"] for e in touches if e["data"].get("reaction_ms")]
    # 감각 활동량: 시각 = 응시 10초당 1 + 웃음 + 입모양 따라 하기, 청각 = 따라 말하기 + 소리 반응 + 듣기 10초당 1, 촉각 = 터치
    exprs = Counter(e["data"].get("kind", "") for e in by("expression") if e["data"].get("kind") != "state")
    moods = Counter(e["data"].get("mood", "") for e in by("expression") if e["data"].get("kind") == "state")
    vis = gaze_s / 10 + smiles + len(by("imitate")) + sum(exprs.values())
    aud = len(repeats) + len(by("voice")) + listen_s / 10
    tch = len(touches)
    total = vis + aud + tch
    balance = ({"visual": round(vis / total, 3), "audio": round(aud / total, 3), "touch": round(tch / total, 3)}
               if total else {"visual": 0.0, "audio": 0.0, "touch": 0.0})
    fav = Counter(e["data"].get("target") for e in touches if e["data"].get("target"))
    return Summary(
        day=day,
        sessions=len(by("session")),
        touches=len(touches),
        reaction_ms=round(sum(rt) / len(rt), 1) if rt else 0.0,
        gaze_s=round(gaze_s, 1),
        smiles=smiles,
        repeats=len(repeats),
        repeat_ok=len(ok),
        # 따라 말하기에서 맞힌 단어 + 시키지 않았는데 먼저 말해서 맞힌 단어(voice, matched)
        words=sorted(({e["data"].get("word", "") for e in ok}
                     | {e["data"].get("item", "") for e in by("voice") if e["data"].get("matched")}) - {""}),
        favorites=[k for k, _ in fav.most_common(3)],
        balance=balance,
        out_of_scope=[e["data"].get("text", "") for e in by("out_of_scope")]
        + [f"차단된 문장: {e['data'].get('text', '')}" for e in by("blocked")],
        alerts=[e["data"].get("text", "") for e in by("alert")],
        expressions={k: v for k, v in exprs.items() if k},
        voices=len(by("voice")),
        listen_s=round(listen_s, 1),
        moods={k: v for k, v in moods.items() if k},
    )


@router.get("/{child_id}/summary", response_model=Summary)
def summary(child_id: str, day: str | None = None):
    """하루 요약 (부모 리포트 2-2, 홈 2-1). day: YYYY-MM-DD (기본 오늘)."""
    day = day or _today()
    try:
        f = _day_file(child_id, day)
    except ValueError:
        raise HTTPException(400, "아이 정보를 찾지 못했어요. 앱을 다시 열고 한 번 더 해 주세요.")
    events = [json.loads(line) for line in f.read_text(encoding="utf-8").splitlines() if line] if f.exists() else []
    return summarize(events, day)
