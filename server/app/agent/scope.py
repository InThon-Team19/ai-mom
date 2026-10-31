"""검증된 학습 범위 — 담당: 충항(에이전트) · 작성: 태희(대행)

앱 app/src/content/curriculum.ts 와 같은 사물. 에이전트는 여기 적힌 사실만 말한다 (지어내지 않음).
커리큘럼은 하나로 고정: 1일차 사과·바나나(+전래동화 해님 달님), 2일차 과자, 3일차 복습.
"""

ITEMS: dict[str, dict] = {
    "apple": {
        "ko": "사과", "en": "Apple",
        "facts": ["빨간색이에요", "동그래요", "한 입 베어 물면 와그작 소리가 나요", "달콤하고 새콤해요", "나무에 열려요"],
        "action": "누르면 한 입 베어 문 자국이 생겨요",
    },
    "banana": {
        "ko": "바나나", "en": "Banana",
        "facts": ["노란색이에요", "길쭉하게 휘어 있어요", "껍질을 벗겨서 먹어요", "부드럽고 달콤해요"],
        "action": "누르면 껍질이 한 줄씩 벗겨져요",
    },
    "snack": {
        "ko": "과자", "en": "Cookie",
        "facts": ["바삭바삭 소리가 나요", "동그랗고 납작해요", "부러뜨리면 조각이 나요", "조금씩 먹어요"],
        "action": "누르면 바삭 부러져요",
    },
}

DAYS: dict[int, list[str]] = {1: ["apple", "banana"], 2: ["snack"], 3: ["apple", "banana", "snack"]}

STORY_DAY1 = "해님 달님 (오누이가 동아줄을 잡고 하늘에 올라가 해님과 달님이 됨)"


def items_for_day(day: int) -> list[str]:
    return DAYS.get(day, DAYS[1])


def scope_text(day: int, item: str) -> str:
    """프롬프트에 넣는 범위 설명 (오늘 사물 + 말해도 되는 사실)"""
    lines = []
    for key in items_for_day(day):
        it = ITEMS[key]
        mark = " (지금 보고 있는 사물)" if key == item else ""
        lines.append(f"- {it['ko']}{mark}: " + ", ".join(it["facts"]) + f". 화면: {it['action']}.")
    if day == 1:
        lines.append(f"- 오늘 동화: {STORY_DAY1}")
    return "\n".join(lines)
