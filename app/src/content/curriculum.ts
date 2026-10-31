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
  greeting: string; // 아이 화면 첫 인사 (기획 2-7 일차별 화면 문장)
  story?: { title: string; pages: { emoji: string; text: string }[] };
};

export const DAYS: Day[] = [
  {
    day: 1,
    topic: '사과 · 바나나',
    greeting: '오늘은 사과랑 바나나 만나볼까?',
    items: ['apple', 'banana'],
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
    planSentences: [
      '내일은 3일차, 그동안 만난 친구들을 다시 만나요.',
      '{name}야, 사과 기억나? 와그작!',
      '바나나 껍질도 다시 벗겨볼까?',
      '과자는 바삭바삭 소리가 나.',
      '오늘도 정말 잘했어, 우리 {name}!',
    ],
  },
];

export const dayOf = (n: number) => DAYS[Math.max(0, Math.min(DAYS.length - 1, n - 1))];

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
];

// 가입 1-6 입모양 등록 문장
export const MOUTH_SENTENCES = [
  '우리 {name}, 사과 먹을까?',
  '바나나 껍질을 벗겨볼까?',
  '잘했어, 우리 {name}!',
  '아, 에, 이, 오, 우.',
  '{me}랑 같이 말해볼까?',
  '바삭바삭 과자 소리!',
];

// 마무리 3-8: 실제 부모에게 연결
export const ENDING = '오늘 정말 재미있었다! 이따 {me} 오면 {fav} 이야기 해줄래?';

export function fill(text: string, p: { name?: string; me?: string; fav?: string }) {
  return text
    .replaceAll('{name}', p.name || '우리 아기')
    .replaceAll('{me}', p.me || '엄마')
    .replaceAll('{fav}', p.fav || '오늘 놀이');
}
