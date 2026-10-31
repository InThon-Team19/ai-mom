// 디자인 토큰 — 기획서 v2 2-3 "색 기준": 노랑·연두 중심의 따뜻한 색, 글자는 항상 진한 갈색. 담당: 태희
// 토큰 이름은 그대로 두고 값만 바꿈 (primary = 노랑 채움색). 노랑 위 글자는 onPrimary(갈색), 링크·강조 글자는 link
export const C = {
  primary: '#FFD54F', // 주 색 노랑 (버튼·선택·게이지 채움)
  primaryStrong: '#F2B705', // 노랑 테두리·진한 채움
  primarySoft: '#FFF1C2', // 연한 노랑 (강조 카드·선택 바탕)
  primaryDeep: '#D9A400', // 노랑 버튼 아래 그림자 (부모 앱 두툼한 버튼)
  onPrimary: '#4E3B2A', // 노랑 위 글자
  link: '#8A5A00', // 링크·강조 글자 (크림 바탕에서 읽히는 진한 호박색)
  green: '#B5D96B', // 보조 색 연두
  greenSoft: '#EEF7DC',
  accent: '#FFB26B', // 강조·칭찬 살구색
  bg: '#FFF9E6', // 바탕 크림색
  card: '#FFF3D6',
  border: '#E8D9B5',
  text: '#4E3B2A', // 글자 진한 갈색
  sub: '#7A6650',
  muted: '#B3A38C',
  track: '#F0E6CC', // 게이지 바탕
  ok: '#5E8C1F',
  warn: '#C2410C',
  warnSoft: '#FFF4EC', // 확인 필요 상자 바탕
  warnLine: '#F6C9A8', // 확인 필요 상자 테두리
  white: '#FFFFFF',
};

export const R = { sm: 12, md: 16, lg: 24, pill: 999 };

export const T = {
  h1: { fontSize: 26, fontWeight: '800' as const, color: C.text },
  h2: { fontSize: 20, fontWeight: '800' as const, color: C.text },
  body: { fontSize: 16, color: C.text },
  sub: { fontSize: 15, color: C.sub },
  small: { fontSize: 13, color: C.sub },
};

/** 감각 일지 색 (민철 디자인 Report): 시각 호박 · 촉각 주홍 · 청각 파랑 — 밝기·색상이 모두 달라 구분이 쉬움 */
export const SENSE = {
  visual: { color: '#C99A00', soft: '#FFF1C2' },
  touch: { color: '#C2522B', soft: '#FFE4CC' },
  audio: { color: '#3F7FB8', soft: '#E3EEF8' },
};
