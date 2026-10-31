"""자료 선택형 LLM 어댑터. 출력 문장은 서버 자료/칭찬 목록으로만 구성한다."""
import json
import logging
import os

logger = logging.getLogger(__name__)
PRAISE = {"warm": "잘했어! ", "play": "함께 해보자! ", "calm": "천천히 해보자. "}


def select_response(content, default, pacing):
    if not (os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY")):
        return PRAISE["calm" if pacing == "slow" else "warm"] + default.prompt, default.id, "curriculum"
    from app.llm import chat
    try:
        # 아이의 원문이나 프로필/생체 데이터를 외부 LLM에 보내지 않는다.
        answer = chat(
            '학습 활동을 고른다. JSON만 반환: {"content_id": "주어진 ID", "praise": "warm 또는 play 또는 calm"}.',
            [{"role": "user", "content": json.dumps({"content": [{"id": c.id, "word": c.word} for c in content],
                "preferred_id": default.id, "pacing": pacing}, ensure_ascii=False)}], max_tokens=128)
        selected = json.loads(answer)
        item = next(c for c in content if c.id == selected["content_id"])
        return PRAISE[selected["praise"]] + item.prompt, item.id, "llm_selection"
    except Exception:
        logger.warning("LLM selection unavailable; using curriculum response")
        return PRAISE["calm"] + default.prompt, default.id, "curriculum_fallback"
