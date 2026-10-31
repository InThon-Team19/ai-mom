// 시연용 커리큘럼 (하나로 고정 — 와이어프레임 2장 메모). 담당: 태희
// 아바타 대사는 에이전트(충항)가 생기면 /conversation 으로 교체. 지금은 검증된 고정 문장만 사용(안전망)
// {name} = 아이 부르는 말, {me} = 부모 호칭(엄마/아빠)

export type ItemId = 'apple' | 'banana' | 'snack';

export type Item = {
  id: ItemId;
  ko: string;
  en: string;
  emoji: string;
  invite: string; // 아바타가 권하는 말
  action: string; // 화면 안내 (글자 최소)
  sound: 'crunch' | 'peel' | 'snap';
  haptic: 'tap' | 'soft'; // tap: 순간 짧게, soft: 진행 중 약하게
  sfxWord: string; // 화면에 뜨는 의성어
};

export const ITEMS: Record<ItemId, Item> = {
  apple: {
    id: 'apple', ko: '사과', en: 'Apple', emoji: '🍎',
    invite: '{name}야, 사과 한 입 먹어볼까?', action: '눌러봐', sound: 'crunch', haptic: 'tap', sfxWord: '와그작!',
  },
  banana: {
    id: 'banana', ko: '바나나', en: 'Banana', emoji: '🍌',
    invite: '바나나 껍질을 벗겨볼까?', action: '눌러봐', sound: 'peel', haptic: 'soft', sfxWord: '스르륵',
  },
  snack: {
    id: 'snack', ko: '과자', en: 'Cookie', emoji: '🍪',
    invite: '{name}야, 과자 알지? 과자는 바삭바삭 소리가 나.', action: '눌러봐', sound: 'snap', haptic: 'tap', sfxWord: '바삭!',
  },
};

export type Day = {
  day: number;
  topic: string;
  items: ItemId[];
  planSentences: string[]; // 전날 밤 부모가 낭독하는 계획 (2-4)
  planCards: string[]; // 피드백 2-3 '내일 계획' 짧은 활동 카드 3개 (그림 · 소리 · 칭찬)
  greeting: string; // 아이 화면 첫 인사 (기획 2-7 일차별 화면 문장)
  story?: { title: string; pages: { emoji: string; text: string }[] };
};

export const DAYS: Day[] = [
  {
    day: 1,
    topic: '사과 · 바나나',
    greeting: '오늘은 사과랑 바나나 만나볼까?',
    items: ['apple', 'banana'],
    planCards: ['사과·바나나 그림', '사과 와그작 · 바나나 스르륵 소리', '"잘했어 우리 {name}!" 칭찬'],
    planSentences: [
      '내일은 1일차, 사과와 바나나를 배워봐요.',
      '{name}야, 사과 같이 먹어볼까?',
      '바나나 껍질을 벗겨볼까?',
      '우리 같이 "사과" 하고 따라 해봐.',
      '잘했어, 우리 {name}!',
    ],
    story: {
      title: '해님 달님',
      pages: [
        { emoji: '🏠', text: '옛날 옛날, 산 너머 작은 집에 오누이가 살았어요.' },
        { emoji: '🐯', text: '어느 날 밤, 호랑이가 문을 똑똑 두드렸어요.' },
        { emoji: '🪢', text: '오누이는 하늘에서 내려온 튼튼한 동아줄을 잡았어요.' },
        { emoji: '☀️', text: '오빠는 해님이, 동생은 달님이 되었대요.' },
      ],
    },
  },
  {
    day: 2,
    topic: '과자',
    greeting: '어제 사과 만났지? 오늘은 과자 먹어볼까?',
    items: ['snack'],
    planCards: ['과자 종류별 그림', '과자 부수기 소리', '"잘했어 우리 {name}!" 칭찬'],
    planSentences: [
      '내일은 2일차, 과자에 대해 배워봐요.',
      '{name}야, 과자 알지? 과자는 바삭바삭 소리가 나.',
      '과자를 손으로 톡 부러뜨려 볼까?',
      '우리 같이 "과자" 하고 따라 해봐.',
      '잘했어, 우리 {name}!',
    ],
    story: {
      title: '해님 달님',
      pages: [
        { emoji: '🏠', text: '옛날 옛날, 산 너머 작은 집에 오누이가 살았어요.' },
        { emoji: '☀️', text: '오빠는 해님이, 동생은 달님이 되었대요.' },
      ],
    },
  },
  {
    day: 3,
    topic: '복습 (사과 · 바나나 · 과자)',
    greeting: '오늘은 사과, 바나나, 과자 다시 만나볼까?',
    items: ['apple', 'banana', 'snack'],
    planCards: ['사과·바나나·과자 다시 보기', '와그작 · 스르륵 · 바삭 소리', '"잘했어 우리 {name}!" 칭찬'],
    planSentences: [
      '내일은 3일차, 그동안 만난 친구들을 다시 만나요.',
      '{name}야, 사과 기억나? 와그작!',
      '바나나 껍질도 다시 벗겨볼까?',
      '과자는 바삭바삭 소리가 나.',
      '오늘도 정말 잘했어, 우리 {name}!',
    ],
  },
];

export const dayOf = (n: number) => DAYS[Math.max(0, Math.min(DAYS.length - 1, Math.floor(Number(n) || 1) - 1))]; // 이상한 값(NaN·문자)이면 1일차

// 가입 1-5 목소리 등록 문장 (와이어프레임 예시)
export const VOICE_SENTENCES = [
  '{name}야, 안녕? {me}야.',
  '사과 같이 먹어볼까?',
  '바나나 껍질을 벗겨볼까?',
  '잘했어, 우리 {name}!',
  '이따 {me} 오면 얘기해줄래?',
  '이건 사과야. 빨갛고 동그랗지?',
  '와, 정말 잘했어! 최고야.',
  '오늘은 어떤 걸 만나 볼까?',
  '과자는 바삭바삭 소리가 나.',
  '같이 따라 해 볼까? 사과!',
  '{me}가 동화책 읽어줄게.',
  '사랑해, 우리 {name}.',
  // 12문장만으로는 30초 기준에 못 미쳐서 추가 (다 읽으면 60초 이상 → 100%)
  '{name}야, 오늘 하루는 어땠어? {me}한테 이야기해 줄래?',
  '바나나는 노랗고 길쭉해. 껍질을 살살 벗겨 볼까?',
  '사과를 한 입 먹으면 아삭아삭 소리가 나지?',
  '우와, 혼자서도 정말 잘하네. {me}가 깜짝 놀랐어!',
  '천천히 해도 괜찮아. {me}가 옆에서 기다릴게.',
  '오늘은 동화책 속 친구들을 만나러 가 볼까?',
  '빨간 사과, 노란 바나나, 바삭바삭 과자!',
  '손으로 톡톡 두드리면 어떤 소리가 날까?',
  '{name}가 좋아하는 건 뭐야? {me}도 궁금해.',
  '이제 쉬는 시간이야. 숨을 크게 들이마셔 볼까?',
  '하나, 둘, 셋! 같이 세어 볼까?',
  '{me}는 {name} 목소리 듣는 게 제일 좋아.',
  '오늘도 재미있게 놀아 줘서 고마워.',
  '과자를 반으로 나누면 친구랑 같이 먹을 수 있어.',
  '해님과 달님 이야기, 다음에 또 들려줄게.',
  '졸리면 눈을 감고 잠깐 쉬어도 돼.',
  '{name}야, 오늘 정말 멋졌어. 꼭 안아 줄게.',
  '내일은 또 어떤 재미있는 걸 해 볼까?',
];

// 가입 1-6 입모양 등록 문장
export const MOUTH_SENTENCES = [
  '우리 {name}, 사과 먹을까?',
  '바나나 껍질을 벗겨볼까?',
  '잘했어, 우리 {name}!',
  '아, 에, 이, 오, 우.',
  '{me}랑 같이 말해볼까?',
  '바삭바삭 과자 소리!',
  // 6문장으로는 20초 기준에 못 미쳐서 추가 (입을 크게 움직이는 소리 위주, 다 읽으면 40초 이상)
  '아삭아삭 사과를 냠냠 먹어요.',
  '바나나 껍질을 하나, 둘, 셋 벗겨요.',
  '우와, 정말 멋지다! 최고야!',
  '오늘은 무엇을 먹어 볼까?',
  '아이, 예뻐라. 우리 {name} 최고!',
  '해님 달님, 안녕! 반가워요!',
  '와그작와그작, 바삭바삭, 냠냠냠!',
  '이따 {me}랑 같이 이야기하자.',
  '오, 우, 아! 입을 크게 벌려 볼까?',
  '{name}야, 사랑해. 오늘도 고마워.',
  '노란 바나나를 아, 하고 크게 먹어 볼까?',
  '우리 같이 오늘 본 사과를 다시 불러 보자.',
  '{me}가 이따가 꼭 안아 줄게. 기다려 줄래?',
];

// 마무리 3-8: 실제 부모에게 연결
export const ENDING = '오늘 정말 재미있었다! 이따 {me} 오면 {fav} 이야기 해줄래?';

/** 받침 있으면 a, 없으면 b (지민아/지호야, 지민이는/지호는) */
const hasBatchim = (w: string) => {
  const c = w.charCodeAt(w.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
};
const JOSA: Record<string, [string, string]> = { 야: ['아', '야'], 는: ['이는', '는'], 가: ['이가', '가'], 를: ['이를', '를'], 랑: ['이랑', '랑'], 와: ['이와', '와'] };
const JOSA_ME: Record<string, [string, string]> = { 는: ['은', '는'], 가: ['이', '가'], 를: ['을', '를'], 랑: ['이랑', '랑'], 와: ['과', '와'] };

/** 문장 채우기: 이름·호칭 뒤 조사를 받침에 맞춤 ({name}야 → 지민아 / 지호야) */
export function fill(text: string, p: { name?: string; me?: string; fav?: string }) {
  const name = p.name || '우리 아기';
  const me = p.me || '엄마';
  return text
    .replace(/{name}(야|는|가|를|랑|와)/g, (_, j: string) => name + JOSA[j][hasBatchim(name) ? 0 : 1])
    .replace(/{me}(는|가|를|랑|와)/g, (_, j: string) => me + JOSA_ME[j][hasBatchim(me) ? 0 : 1])
    .replaceAll('{name}', name)
    .replaceAll('{me}', me)
    .replaceAll('{fav}', p.fav || '오늘 놀이');
}
