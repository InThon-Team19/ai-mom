// 디자인 토큰 — docs/wireframe/*.png 기준 (민철 와이어프레임). 담당: 태희
export const C = {
  primary: '#2453D6',
  primarySoft: '#E7ECFB', // 강조 카드·아이 화면 배경
  bg: '#FFFFFF',
  card: '#F2F3F5',
  border: '#D3D6DC',
  text: '#1B1D21',
  sub: '#5F6570',
  muted: '#9AA0AA',
  track: '#E3E5E9', // 게이지 바탕
  ok: '#1F9D55',
  warn: '#D9480F',
  white: '#FFFFFF',
};

export const R = { sm: 10, md: 14, lg: 20, pill: 999 };

export const T = {
  h1: { fontSize: 26, fontWeight: '800' as const, color: C.text },
  h2: { fontSize: 20, fontWeight: '800' as const, color: C.text },
  body: { fontSize: 16, color: C.text },
  sub: { fontSize: 15, color: C.sub },
  small: { fontSize: 13, color: C.sub },
};
