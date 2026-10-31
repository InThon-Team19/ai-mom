"""아바타 한 마디 만들기 (낮 대화) — 담당: 충항(에이전트) · 작성: 태희(대행)

흐름: 입력 안전 검사 → 프롬프트(부모 말투 + 검증된 범위 + 아이 감각 상태) → LLM(2초 제한) → 출력 검사 → 답.
LLM 이 늦거나 형식이 깨지거나 검사에 걸리면 정해진 문장으로 대답 (아이 화면이 멈추지 않게).
아이의 원문은 프롬프트에만 쓰고 저장하지 않는다 (범위 밖 기록은 앱이 부모 확인 목록에 남김).
"""
import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeout

from app.agent import safety
from app.agent.scope import ITEMS, items_for_day, scope_text

logger = logging.getLogger(__name__)
LLM_TIMEOUT_S = 3.0  # 앱은 3.5초까지 기다림 (네트워크 몫을 남김). 연결 시간까지 포함한 전체 시간으로 끊음
_pool = ThreadPoolExecutor(max_workers=4)

MOOD_GUIDE = {
    "overloaded": "아이가 지금 자극이 많아 힘들어 보여요. 아주 천천히, 짧고 차분하게 말하고 잠깐 쉬자고 해요. 새 활동은 권하지 않아요.",
    "distracted": "아이가 화면을 잘 안 보고 있어요. 아이 이름을 부르고 사물 소리나 색으로 다시 관심을 끌어요.",
    "engaged": "아이가 신나게 참여하고 있어요. 칭찬하고 한 번 더 해 보자고 권해요.",
    "calm": "보통 상태예요. 다정하게 사물 이야기를 이어가요.",
}


def _signals_text(sig: dict | None) -> str:
    if not sig:
        return "정보 없음"
    parts = [f"누른 횟수 {sig.get('touches', 0)}", f"웃음 {sig.get('smiles', 0)}", f"말소리 {sig.get('voices', 0)}"]
    if sig.get("gaze_ratio") is not None:
        parts.append(f"화면 본 비율 {round(float(sig['gaze_ratio']) * 100)}%")
    if sig.get("repeated"):
        parts.append("따라 말하기 성공")
    return ", ".join(parts)


def _persona(profile: dict) -> dict:
    child = profile.get("child") or {}
    parent = profile.get("parent") or {}
    name = child.get("nickname") or child.get("name") or "우리 아기"
    return {
        "name": name,
        "me": parent.get("title") or "엄마",
        "tone": parent.get("tone") or "다정한",
        "english": bool(parent.get("english")) or "영어 노출" in (parent.get("goals") or []),
        "level": child.get("level") or "한 단어",
        "likes": ", ".join(child.get("likes") or []) or "없음",
    }


def _feedback_text(profile: dict) -> str:
    fb = (profile.get("feedback") or [])[-1:] or []
    if not fb:
        return "없음"
    f = fb[0]
    bits = list(f.get("issues") or []) + ([f["note"]] if f.get("note") else [])
    return ", ".join(bits)[:120] or "없음"


def _fallback(moment: str, item: str, p: dict, out_of_scope: bool, mood: str | None) -> str:
    ko = ITEMS[item]["ko"]
    if out_of_scope:
        return f"그건 이따 {p['me']}랑 같이 알아보자. 지금은 {ko} 볼까?"
    if mood == "overloaded":
        return f"천천히 해도 괜찮아. {ko}, 여기 있어."
    if moment == "invite":
        return f"{p['name']}야, {ko} 한번 눌러볼까?"
    return f"응, 그랬구나! 우리 {ko} 볼까?"


def _system(day: int, item: str, p: dict, profile: dict, mood: str | None) -> str:
    return f"""너는 2~5세 아이 {p['name']}의 {p['me']}야. 아이와 태블릿으로 감각 놀이를 하고 있어.
말투: {p['tone']}. 아이 말하기 수준: {p['level']}. 아이가 좋아하는 것: {p['likes']}.
지금 아이 상태: {MOOD_GUIDE.get(mood or 'calm', MOOD_GUIDE['calm'])}
부모가 어젯밤 남긴 피드백: {_feedback_text(profile)}

[오늘 이야기할 수 있는 범위 — 이 사실만 말해. 지어내지 마]
{scope_text(day, item)}

규칙:
- 한두 문장, 전체 30자 안팎. 아이가 알아듣는 쉬운 말. 이모지·물결표·말줄임표 쓰지 마.
- 너는 {p['me']} 목소리를 가진 그림 아바타야. 진짜 {p['me']}가 여기 있다고 하지 마. {p['me']}를 찾으면 \"{p['me']}는 일하고 있어. 이따 오면 이야기해 주자\"처럼 말해.
- 틀렸다고 하지 마. 칭찬하거나 다시 해 보자고만 해.
- 건강·병원·약·음식 조언·진단은 절대 말하지 마.
- 아이 말이 범위 밖(다른 물건·동물·장소·사람 이야기, 모르는 질문)이면 답을 지어내지 말고 in_scope=false로 하고, 부드럽게 지금 사물로 돌아와.
- {'영어 노출을 원하는 집이라 사물 영어 이름을 가끔 붙여도 돼.' if p['english'] else '영어는 쓰지 마.'}
JSON 한 줄만 출력: {{"in_scope": true 또는 false, "text": "아바타가 말할 문장"}}"""


def _ask_llm(system: str, user: str) -> dict | None:
    from app.llm import MODEL, client

    def call() -> str:
        res = client().with_options(timeout=5.0).messages.create(
            model=MODEL, max_tokens=200, system=system, messages=[{"role": "user", "content": user}],
        )
        return "".join(b.text for b in res.content if b.type == "text")

    try:
        raw = _pool.submit(call).result(timeout=LLM_TIMEOUT_S)
    except FutureTimeout:
        logger.warning("agent LLM slower than %.1fs", LLM_TIMEOUT_S)
        return None
    except Exception as e:  # 키 없음·서버 오류 → 정해진 문장
        logger.warning("agent LLM unavailable: %s", type(e).__name__)
        return None
    m = re.search(r"\{.*\}", raw, re.S)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except ValueError:
        return None
    return data if isinstance(data.get("text"), str) else None


def _mentions_today(text: str, day: int) -> bool:
    t = text.lower().replace(" ", "")
    return any(ITEMS[k]["ko"] in t or ITEMS[k]["en"].lower() in t for k in items_for_day(day))


def make_turn(day: int, item: str, moment: str, child_text: str | None, signals: dict | None, profile: dict) -> dict:
    if item not in ITEMS:
        item = items_for_day(day)[0]
    p = _persona(profile)
    mood = (signals or {}).get("mood")
    text_in = (child_text or "").strip()

    # 1) 입력 안전 검사: 위험 신호는 LLM 에 보내지 않고 바로 달래며 부모 확인 목록으로
    if moment == "reply" and safety.danger_in(text_in):
        return {"text": f"괜찮아? 가까이 있는 어른한테 바로 말해 줘. {p['me']}도 금방 갈게.", "out_of_scope": True, "blocked": None}

    if moment == "reply" and not text_in:
        return {"text": _fallback("reply", item, p, False, mood), "out_of_scope": False, "blocked": None}

    user = (f"[사물 권하기] 지금 화면의 사물: {ITEMS[item]['ko']}. 아이 반응: {_signals_text(signals)}. 아이에게 사물을 권하는 첫 마디를 해 줘."
            if moment == "invite"
            else f"지금 화면의 사물: {ITEMS[item]['ko']}. 아이 반응: {_signals_text(signals)}.\n아이가 한 말: \"{text_in[:80]}\"\n이 말에 대답해 줘.")

    data = _ask_llm(_system(day, item, p, profile, mood), user)
    if data is None:
        return {"text": _fallback(moment, item, p, False, mood), "out_of_scope": False, "blocked": None}

    out_of_scope = moment == "reply" and data.get("in_scope") is False
    # 오늘 배우는 사물 이름을 말했으면 지금 화면 사물이 아니어도 범위 안 (LLM 이 지금 사물만 범위로 보는 실수 방지)
    if out_of_scope and _mentions_today(text_in, day):
        out_of_scope = False
    text = safety.clean(data["text"])
    # 2) 출력 검사: 걸리면 막고 정해진 문장. 막은 문장은 앱이 리포트 "차단된 문장"으로 기록
    if safety.check_output(text):
        return {"text": _fallback(moment, item, p, out_of_scope, mood), "out_of_scope": out_of_scope, "blocked": text[:120] or None}
    return {"text": text, "out_of_scope": out_of_scope, "blocked": None}


def warm_up() -> None:
    """서버가 켜질 때 한 번: AI 서버와 연결을 미리 맺어 아이의 첫 대화가 느리지 않게 (실패해도 무시)"""
    import os
    if not (os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY")):
        return
    try:
        from app.llm import MODEL, client
        client().with_options(timeout=10.0).messages.create(model=MODEL, max_tokens=1, messages=[{"role": "user", "content": "안녕"}])
    except Exception:
        pass
