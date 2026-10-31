"""부모 말하기 특성 분석·의사소통 피드백·낭독 코칭. 담당: 태희

기획 2-1-1 ⑤ AI 특성 분석 (예: 발화 간격이 비교적 짧음, 톤이 일정함)
기획 2-1-1 ⑥ 의사소통 피드백 (예: "질문 후 기다리는 시간을 늘려볼까요?")
기획 2-2 ③ 부모 코칭 (예: "목소리 톤을 조금 높이고, 입모양을 20% 더 크게 벌려 말해주세요.")
기준값은 시연용 임시값 — 실제 부모 녹음으로 조정
"""
import numpy as np

# 영유아 대상 말하기 권장 방향 (시연용 기준)
PAUSE_SHORT_S = 0.45      # 이보다 짧으면 "발화 간격이 짧음"
TONE_FLAT = 0.10          # 음높이 변동계수가 이보다 작으면 "톤이 일정함"
FAST_SPS = 5.5            # 초당 음절 이보다 빠르면 "말이 빠름"


def _avg(feats: list[dict], key: str) -> float:
    vals = [f[key] for f in feats if f.get(key)]
    return float(np.mean(vals)) if vals else 0.0


def summarize(feats: list[dict]) -> dict:
    """문장별 특성 → 평균."""
    return {k: round(_avg(feats, k), 3) for k in ("pause_mean_s", "pitch_hz", "pitch_var", "syllables_per_s", "volume")}


def traits_and_tips(s: dict) -> tuple[list[str], list[str]]:
    traits, tips = [], []
    if s["pause_mean_s"]:
        if s["pause_mean_s"] < PAUSE_SHORT_S:
            traits.append("발화 간격이 비교적 짧아요")
            tips.append("아이가 대답할 수 있도록 질문 후 기다리는 시간을 늘려볼까요?")
        else:
            traits.append("말 사이에 여유가 있어요")
    if s["pitch_var"]:
        if s["pitch_var"] < TONE_FLAT:
            traits.append("톤이 일정해요")
            tips.append("아이에게 말할 때 높낮이를 조금 더 크게 바꿔 보세요. 아이의 주의를 끌기 좋아요.")
        else:
            traits.append("톤 변화가 풍부해요")
    if s["syllables_per_s"]:
        if s["syllables_per_s"] > FAST_SPS:
            traits.append("말이 조금 빠른 편이에요")
            tips.append("단어 하나하나를 조금 천천히 말해 주세요.")
        else:
            traits.append("말 속도가 아이에게 알맞아요")
    if not tips:
        tips.append("지금처럼 다정하게 말해 주세요!")
    return traits, tips


def coaching(base_voice: dict, plan_voice: dict, base_mouth: dict | None, plan_mouth: dict | None) -> list[str]:
    """밤 낭독 결과를 가입 때 기준과 비교한 코칭 문장."""
    msgs: list[str] = []
    if base_voice.get("pitch_hz") and plan_voice.get("pitch_hz"):
        if plan_voice["pitch_hz"] < base_voice["pitch_hz"] * 0.95:
            msgs.append("목소리 톤을 조금 높여 주세요")
    if base_mouth and plan_mouth and base_mouth.get("open_p90") and plan_mouth.get("open_p90"):
        ratio = plan_mouth["open_p90"] / base_mouth["open_p90"]
        if ratio < 0.9:
            msgs.append(f"입모양을 {round((1 / ratio - 1) * 100 / 5) * 5}% 더 크게 벌려 말해 주세요")
    if plan_voice.get("syllables_per_s", 0) > FAST_SPS:
        msgs.append("조금만 더 천천히 읽어 주세요")
    return msgs or ["오늘 낭독 좋았어요! 이대로 아이에게 말해 주세요."]
