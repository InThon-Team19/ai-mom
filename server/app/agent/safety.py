"""안전 검사 — 담당: 충항(에이전트) · 작성: 태희(대행)

입력 검사: 아이 말의 위험 신호 → LLM 에 보내지 않고 정해진 대답 + 부모 확인.
출력 검사: LLM 이 만든 문장이 짧고 안전한지 → 아니면 막고(blocked) 부모 확인 목록에 남김.
기획 v2: 아이에게 틀렸다는 표시 없음, 건강 정보·진단·식단 조언 안 함, 범위 밖은 지어내지 않음.
"""
import re

DANGER = ("아파", "아야", "무서워", "도와줘", "살려", "때렸", "때려", "피 나", "피가", "다쳤", "죽")  # 사람이 읽는 목록 (실제 검사는 _DANGER_RE)
# 글자만 들어 있으면 걸던 방식은 "아파트"·"호박죽"·"놀아야"에도 비상 문구가 나가서 낱말 모양으로 검사
_DANGER_RE = re.compile(
    r"아파(?!트)|아팠|아프|아픈|(?:^|\s)아야+(?=$|[\s!?.,~])|무서워|무서웠|무섭|도와\s?줘|도와\s?주세요|살려|"
    r"때렸|때려|때린|피\s?(?:가\s?)?(?:나|났)|다쳤|다쳐|다친|죽(?:을|어|었|겠|는|일)"
)

# 아바타가 하면 안 되는 말: 틀림 표시, 건강·의료, 무서운 말, 외부로 데려가는 말
_FORBIDDEN = re.compile(
    r"틀렸|아니야|땡|못했|병원|약을|약 먹|의사|아프|다쳐|죽|무서|위험|때리|혼나|비밀|밖에 나가|문 열어|전화|주소|"
    r"알레르기|칼로리|살 쪄|다이어트|(엄마|아빠)(는|가)? ?(여기 있|옆에 있|바로 여기)"
)
_EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️‍]")
MAX_LEN = 45
HARMLESS = ("빈 문장", "너무 김")  # 이 이유로 막은 문장은 부모 "차단된 문장" 목록에 올리지 않음 (위험한 말이 아님)


def danger_in(child_text: str) -> bool:
    return bool(_DANGER_RE.search(re.sub(r"\s+", " ", child_text or "").strip()))


def clean(text: str) -> str:
    """TTS 로 읽기 좋게: 이모지·물결·따옴표·줄바꿈 제거, 공백 정리"""
    t = _EMOJI.sub("", text or "")
    t = re.sub(r"[~∼〜\"“”'‘’*#]", "", t)
    t = re.sub(r"\.{2,}|…", ", ", t)
    return re.sub(r"\s+", " ", t).strip()


def check_output(text: str, max_len: int = MAX_LEN) -> str | None:
    """문제가 있으면 이유, 괜찮으면 None"""
    if not text:
        return "빈 문장"
    if len(text) > max_len:
        return "너무 김"
    if _FORBIDDEN.search(text):
        return "금지된 표현"
    if not re.search(r"[가-힣]", text):
        return "한국어 아님"
    if re.search(r"[぀-ヿ一-鿿]", text):
        return "한자·일본어 섞임"  # 연결된 모델(DeepSeek)이 가끔 중국어를 섞음 (예: "참好听")
    return None
