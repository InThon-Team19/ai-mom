// 부모 아바타 (실제 얼굴 X — 기획 4장: 아이가 AI를 실제 부모로 오인하지 않게). 담당: 태희
import type { ReactNode } from 'react';
// 부모가 1-4에서 고른 얼굴형·머리·눈·옷·색으로 그리고, 입은 mouth(0~1)로 움직임.
// mouth 크기는 부모 입모양 기준값(open_p90)에 맞춰 scale 로 조절 → "부모 입모양이 반영된 아바타"
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

export type AvatarConfig = { face: number; hair: number; eyes: number; outfit: number; color: number };
export const DEFAULT_AVATAR: AvatarConfig = { face: 0, hair: 0, eyes: 0, outfit: 0, color: 0 };

// 1-4 카테고리별 선택지 (8개씩 — 와이어프레임 4x2 그리드)
export const AVATAR_OPTIONS = {
  face: ['동그란', '달걀형', '각진', '하트형', '넓은', '갸름한', '통통한', '작은'],
  hair: ['단발', '긴 머리', '묶음', '곱슬', '짧은 머리', '앞머리', '올림머리', '모자'],
  eyes: ['동글', '웃는 눈', '큰 눈', '반달', '또렷', '졸린 눈', '안경', '윙크'],
  outfit: ['티셔츠', '셔츠', '니트', '원피스', '후드', '앞치마', '카디건', '정장'],
  color: ['#F2C9A0', '#E8B48A', '#D49A6A', '#B97A4E', '#8D5A3A', '#F5D7B8', '#EBC3A3', '#C98E62'], // 피부색
} as const;
export type AvatarCategory = keyof typeof AVATAR_OPTIONS;

const HAIR_COLORS = ['#2B2118', '#4A3426', '#6B4A2F', '#1F1F1F', '#7A5A3A', '#3A2A20', '#5C3D2E', '#2E2E3A'];
const OUTFIT_COLORS = ['#2453D6', '#E07A5F', '#81B29A', '#F2CC8F', '#9B5DE5', '#EF476F', '#118AB2', '#3D405B'];

function faceShape(i: number) {
  const shapes: [number, number, number][] = [
    [50, 50, 40], [44, 52, 40], [46, 46, 14], [48, 50, 30], [54, 48, 34], [42, 52, 36], [52, 52, 46], [40, 44, 40],
  ];
  return shapes[i % shapes.length]; // rx, ry, corner
}

export function Avatar({
  config = DEFAULT_AVATAR,
  mouth = 0,
  scale = 1,
  size = 160,
  close = false,
}: {
  config?: AvatarConfig;
  mouth?: number; // 0 닫힘 ~ 1 크게 벌림 (TTS 음량 등)
  scale?: number; // 부모 입모양 크기 반영 (기본 1)
  size?: number;
  close?: boolean; // 입모양 확대 (3-4 따라 말하기)
}) {
  const skin = AVATAR_OPTIONS.color[config.color % 8];
  const hairC = HAIR_COLORS[config.hair % 8];
  const outfitC = OUTFIT_COLORS[config.outfit % 8];
  const [rx, ry] = faceShape(config.face);
  const m = Math.max(0, Math.min(1, mouth)) * Math.max(0.6, Math.min(1.6, scale));
  const mouthW = 16 + m * 4;
  const mouthH = 2 + m * 14;
  const vb = close ? '50 105 100 75' : '0 0 200 220';

  return (
    <Svg width={size} height={close ? size * 0.75 : size * 1.1} viewBox={vb}>
      {/* 몸·옷 */}
      <G>
        <Path d="M30 220 Q30 165 100 160 Q170 165 170 220 Z" fill={outfitC} />
        {config.outfit % 8 === 5 && <Rect x="75" y="170" width="50" height="50" rx="6" fill="#fff" opacity={0.9} />}
        {config.outfit % 8 === 1 && <Path d="M88 162 L100 182 L112 162" stroke="#fff" strokeWidth="4" fill="none" />}
      </G>
      {/* 뒷머리 */}
      {[1, 2, 6].includes(config.hair % 8) && <Ellipse cx="100" cy="110" rx={rx + 10} ry={ry + 18} fill={hairC} />}
      {/* 목 */}
      <Rect x="88" y="135" width="24" height="30" fill={skin} />
      {/* 얼굴 */}
      <Rect x={100 - rx} y={100 - ry} width={rx * 2} height={ry * 2} rx={faceShape(config.face)[2]} fill={skin} />
      {/* 앞머리 */}
      <HairFront i={config.hair % 8} rx={rx} ry={ry} c={hairC} />
      {/* 눈 */}
      <Eyes i={config.eyes % 8} />
      {/* 볼 */}
      <Circle cx="70" cy="122" r="7" fill="#F28B82" opacity={0.35} />
      <Circle cx="130" cy="122" r="7" fill="#F28B82" opacity={0.35} />
      {/* 입: m 에 따라 벌어짐 */}
      {m < 0.08 ? (
        <Path d={`M${100 - mouthW / 2} 130 Q100 ${136} ${100 + mouthW / 2} 130`} stroke="#9C3D3D" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <G>
          <Ellipse cx="100" cy={131 + mouthH / 4} rx={mouthW / 2} ry={mouthH / 2} fill="#7A2E2E" />
          <Ellipse cx="100" cy={131 + mouthH / 2} rx={mouthW / 3} ry={mouthH / 5} fill="#E57373" />
        </G>
      )}
    </Svg>
  );
}

function HairFront({ i, rx, ry, c }: { i: number; rx: number; ry: number; c: string }) {
  const top = 100 - ry;
  switch (i) {
    case 4: // 짧은 머리
      return <Path d={`M${100 - rx} ${top + 20} Q100 ${top - 14} ${100 + rx} ${top + 20} L${100 + rx} ${top + 8} Q100 ${top - 22} ${100 - rx} ${top + 8} Z`} fill={c} />;
    case 5: // 앞머리
      return <Path d={`M${100 - rx} ${top + 30} Q100 ${top - 20} ${100 + rx} ${top + 30} L${100 + rx - 6} ${top + 34} L${100 - rx + 6} ${top + 34} Z`} fill={c} />;
    case 3: // 곱슬
      return (
        <G>
          {[-36, -18, 0, 18, 36].map((dx) => (
            <Circle key={dx} cx={100 + dx} cy={top + 6} r="14" fill={c} />
          ))}
        </G>
      );
    case 6: // 올림머리
      return (
        <G>
          <Circle cx="100" cy={top - 14} r="16" fill={c} />
          <Path d={`M${100 - rx} ${top + 22} Q100 ${top - 16} ${100 + rx} ${top + 22}`} fill={c} />
        </G>
      );
    case 7: // 모자
      return (
        <G>
          <Path d={`M${100 - rx - 6} ${top + 18} Q100 ${top - 30} ${100 + rx + 6} ${top + 18} Z`} fill="#E07A5F" />
          <Rect x={100 - rx - 12} y={top + 12} width={(rx + 12) * 2} height="8" rx="4" fill="#C0583F" />
        </G>
      );
    default: // 단발·긴 머리·묶음
      return <Path d={`M${100 - rx - 4} ${top + 34} Q${100 - rx} ${top - 12} 100 ${top - 8} Q${100 + rx} ${top - 12} ${100 + rx + 4} ${top + 34} Q100 ${top + 6} ${100 - rx - 4} ${top + 34} Z`} fill={c} />;
  }
}

function Eyes({ i }: { i: number }) {
  const y = 104;
  const pair = (render: (x: number) => ReactNode) => (
    <G>
      {render(78)}
      {render(122)}
    </G>
  );
  switch (i) {
    case 1: // 웃는 눈
      return pair((x) => <Path key={x} d={`M${x - 7} ${y + 2} Q${x} ${y - 6} ${x + 7} ${y + 2}`} stroke="#222" strokeWidth="3" fill="none" strokeLinecap="round" />);
    case 2: // 큰 눈
      return pair((x) => (
        <G key={x}>
          <Circle cx={x} cy={y} r="8" fill="#222" />
          <Circle cx={x + 2.5} cy={y - 2.5} r="2.5" fill="#fff" />
        </G>
      ));
    case 3: // 반달
      return pair((x) => <Path key={x} d={`M${x - 7} ${y - 2} Q${x} ${y + 6} ${x + 7} ${y - 2}`} stroke="#222" strokeWidth="3" fill="none" strokeLinecap="round" />);
    case 5: // 졸린 눈
      return pair((x) => <Path key={x} d={`M${x - 7} ${y} L${x + 7} ${y}`} stroke="#222" strokeWidth="3" strokeLinecap="round" />);
    case 6: // 안경
      return (
        <G>
          {pair((x) => (
            <G key={x}>
              <Circle cx={x} cy={y} r="4" fill="#222" />
              <Circle cx={x} cy={y} r="12" stroke="#333" strokeWidth="2.5" fill="none" />
            </G>
          ))}
          <Path d={`M90 ${y} L110 ${y}`} stroke="#333" strokeWidth="2.5" />
        </G>
      );
    case 7: // 윙크
      return (
        <G>
          <Circle cx={78} cy={y} r="5" fill="#222" />
          <Path d={`M115 ${y + 2} Q122 ${y - 6} 129 ${y + 2}`} stroke="#222" strokeWidth="3" fill="none" strokeLinecap="round" />
        </G>
      );
    case 4: // 또렷
      return pair((x) => (
        <G key={x}>
          <Ellipse cx={x} cy={y} rx="6" ry="7" fill="#222" />
          <Path d={`M${x - 8} ${y - 10} L${x + 6} ${y - 12}`} stroke="#222" strokeWidth="2.5" strokeLinecap="round" />
        </G>
      ));
    default: // 동글
      return pair((x) => <Circle key={x} cx={x} cy={y} r="5" fill="#222" />);
  }
}
