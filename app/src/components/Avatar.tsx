// 부모 아바타 — 아이에게 친근한 둥근 캐릭터 (실제 얼굴 X, 기획 2-3 "아이에게 친근한 아바타"). 담당: 태희
// 둥근 얼굴 · 큰 눈 · 또렷한 입. 사람과 너무 닮지 않게 (아이가 낯설어하거나 실제 부모로 오인하지 않도록)
// 부모가 1-4에서 고른 얼굴형·머리·눈·옷·색으로 그리고, 입은 mouth(0~1)로 움직임.
// mouth 크기는 부모 입모양 기준값(open_p90)에 맞춰 scale 로 조절 → "부모 입모양이 반영된 아바타"
// 표정 5종(expression): 기본·웃음·놀람·기다림·칭찬. look='right' 면 오른쪽 사물을 바라봄
// 자연스럽게: pose(입모양 아·이·오·우·닫힘, lib/parentFrames 신호)대로 입 모양이 바뀌고, 몇 초마다 눈을 깜빡임
import { useEffect, useState, type ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import type { ParentFrame } from '@/lib/parentFrames';
import type { PortraitConfig } from '@/lib/portraitConfig';
import type { MouthPose } from '@/lib/lipsync';

export type AvatarConfig = { face: number; hair: number; eyes: number; outfit: number; color: number } & PortraitConfig;
export const DEFAULT_AVATAR: AvatarConfig = { face: 0, hair: 0, eyes: 0, outfit: 0, color: 0 };
export const DAD_AVATAR: AvatarConfig = { ...DEFAULT_AVATAR, hair: 4, outfit: 1 }; // 짧은 머리 · 셔츠

/** 보여 줄 아바타: 꾸민 적 없으면 호칭에 맞는 기본 (아빠 → 짧은 머리) */
export function avatarFor(config: AvatarConfig | undefined, title?: string): AvatarConfig {
  const untouched = !config || (Object.keys(DEFAULT_AVATAR) as (keyof typeof DEFAULT_AVATAR)[])
    .every(key => config[key] === DEFAULT_AVATAR[key]);
  return untouched ? { ...config, ...(title === '아빠' ? DAD_AVATAR : DEFAULT_AVATAR) } : config;
}

// 1-4 카테고리별 선택지 (8개씩 — 와이어프레임 4x2 그리드). 어떤 선택을 해도 둥근 얼굴·큰 눈·또렷한 입은 유지
export const AVATAR_OPTIONS = {
  face: ['동그란', '달걀형', '각진', '하트형', '넓은', '갸름한', '통통한', '작은'],
  hair: ['단발', '긴 머리', '묶음', '곱슬', '짧은 머리', '앞머리', '올림머리', '모자'],
  eyes: ['동글', '웃는 눈', '큰 눈', '반달', '또렷', '졸린 눈', '안경', '윙크'],
  outfit: ['티셔츠', '셔츠', '니트', '원피스', '후드', '앞치마', '카디건', '정장'],
  color: ['#F2C9A0', '#E8B48A', '#D49A6A', '#B97A4E', '#8D5A3A', '#F5D7B8', '#EBC3A3', '#C98E62'], // 피부색
} as const;
export type AvatarCategory = keyof typeof AVATAR_OPTIONS;

/** 기본 · 웃음 · 놀람 · 기다림 · 칭찬 */
export type AvatarExpression = 'neutral' | 'smile' | 'surprise' | 'wait' | 'praise';
export type AvatarLook = 'center' | 'right';

const HAIR_COLORS = ['#3B2A1E', '#5A3E2B', '#7A5536', '#2E2522', '#8A6440', '#4A3428', '#6B4433', '#3A3340'];
const OUTFIT_COLORS = ['#FFD54F', '#FFB26B', '#B5D96B', '#7FC8A9', '#C3A6E8', '#F59AB0', '#8FCDE0', '#8C7B6B'];
const INK = '#3A2A20'; // 눈동자·눈썹 선 (진한 갈색 — 검정보다 부드럽게)
const MOUTH = '#8A3B32';
const TONGUE = '#F28C8C';
const CHEEK = '#FF9E8F';

// 얼굴은 모두 둥글게: [가로 반지름, 세로 반지름, 모서리] (모서리가 반지름 이상이면 타원)
const FACES: [number, number, number][] = [
  [66, 64, 99], // 동그란
  [60, 68, 99], // 달걀형
  [63, 60, 38], // 각진 → 모서리 둥근 네모
  [66, 62, 99], // 하트형
  [72, 60, 99], // 넓은
  [58, 66, 99], // 갸름한
  [70, 67, 99], // 통통한
  [58, 58, 99], // 작은
];

const CX = 100;
const CY = 100;

export function Avatar({
  config = DEFAULT_AVATAR,
  mouth = 0,
  scale = 1,
  size = 160,
  close = false,
  expression = 'neutral',
  look = 'center',
  pose: explicitPose,
  mouthPose,
  blink = true,
}: {
  config?: AvatarConfig;
  pose?: ParentFrame; // 말할 때 입모양 (neutral 이면 표정 입). 있으면 mouth 보다 우선
  mouthPose?: MouthPose; // Existing local lip-sync lab compatibility.
  blink?: boolean; // 몇 초마다 눈 깜빡임 (작은 선택지 미리보기에서는 끔)
  mouth?: number; // 0 닫힘 ~ 1 크게 벌림 (TTS 음량 등)
  scale?: number; // 부모 입모양 크기 반영 (기본 1)
  size?: number;
  close?: boolean; // 입모양 확대 (따라 말하기)
  expression?: AvatarExpression;
  look?: AvatarLook;
}) {
  const pose = explicitPose ?? (mouthPose ? mouthPose.press > .5 ? 'closed' : mouthPose.open < .08 ? 'neutral'
    : mouthPose.round > .7 ? mouthPose.open < .45 ? 'narrow' : 'round' : mouthPose.width > 1.08 ? 'wide' : 'open' : undefined);
  const skin = AVATAR_OPTIONS.color[config.color % 8];
  const hairC = HAIR_COLORS[config.hair % 8];
  const outfitC = OUTFIT_COLORS[config.outfit % 8];
  const [rx, ry, corner] = FACES[config.face % 8];
  const m = Math.max(0, Math.min(1, mouth)) * Math.max(0.6, Math.min(1.6, scale));
  const vb = close ? '56 117 88 66' : '0 0 200 220';
  const hairI = config.hair % 8;
  const cheekOp = { neutral: 0.4, smile: 0.6, surprise: 0.35, wait: 0.4, praise: 0.75 }[expression];
  const closedEyes = useBlink(blink);
  const s = Math.max(0.7, Math.min(1.4, scale));

  return (
    <Svg width={size} height={close ? size * 0.75 : size * 1.1} viewBox={vb}>
      {/* 목 + 턱 그림자 — 옷 뒤에 (얼굴이 몸 위에 둥둥 떠 보이지 않게) */}
      <Rect x={CX - 15} y={CY + ry - 14} width="30" height="26" rx="10" fill={skin} />
      <Rect x={CX - 15} y={CY + ry - 14} width="30" height="26" rx="10" fill="#000" opacity={0.08} />
      {/* 몸·옷 (작고 둥글게) */}
      <Outfit i={config.outfit % 8} c={outfitC} />
      {/* 뒷머리 */}
      <HairBack i={hairI} rx={rx} ry={ry} c={hairC} />
      {/* 귀 */}
      <Circle cx={CX - rx + 2} cy={CY + 8} r="11" fill={skin} />
      <Circle cx={CX + rx - 2} cy={CY + 8} r="11" fill={skin} />
      {/* 얼굴 */}
      {corner >= rx ? (
        <Ellipse cx={CX} cy={CY} rx={rx} ry={ry} fill={skin} />
      ) : (
        <Rect x={CX - rx} y={CY - ry} width={rx * 2} height={ry * 2} rx={corner} ry={corner} fill={skin} />
      )}
      {/* 앞머리 + 머리 윤기 */}
      <HairFront i={hairI} rx={rx} ry={ry} c={hairC} />
      {hairI !== 7 && <Path d={`M${CX - rx * 0.55} ${CY - ry * 0.72} Q${CX - rx * 0.2} ${CY - ry * 0.98} ${CX + rx * 0.2} ${CY - ry * 0.9}`} stroke="#FFFFFF" strokeWidth="4" opacity={0.16} fill="none" strokeLinecap="round" />}
      {/* 볼 */}
      <Ellipse cx={CX - 38} cy={CY + 24} rx="11" ry="8" fill={CHEEK} opacity={cheekOp} />
      <Ellipse cx={CX + 38} cy={CY + 24} rx="11" ry="8" fill={CHEEK} opacity={cheekOp} />
      {/* 눈썹 */}
      <Brows expression={expression} c={hairI === 7 ? INK : hairC} />
      {/* 눈 */}
      <Eyes i={config.eyes % 8} expression={expression} look={look} skin={skin} closed={closedEyes} />
      {/* 코 (작고 부드럽게) */}
      <Path d={`M${CX - 4} ${CY + 18} Q${CX} ${CY + 22} ${CX + 4} ${CY + 18}`} stroke="#000" strokeWidth="2.5" opacity={0.18} fill="none" strokeLinecap="round" />
      {/* 입: 말할 때는 입모양(pose), 없으면 음량(mouth) */}
      {pose && pose !== 'neutral' ? <PoseMouth pose={pose} s={s} /> : <Mouth m={m} expression={expression} />}
    </Svg>
  );
}

/** 2.5~5초마다 0.13초 눈을 감음 (깜빡임 효과가 아니라 사람처럼 눈을 감았다 뜸) */
function useBlink(on: boolean) {
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (!on) return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(() => {
        setClosed(true);
        t = setTimeout(() => {
          setClosed(false);
          loop();
        }, 130);
      }, 2500 + Math.random() * 2500);
    };
    loop();
    return () => clearTimeout(t);
  }, [on]);
  return on && closed;
}

// ---------- 입 ----------
/** 말하는 입모양: closed 닫힘(ㅁㅂㅍ) · open 아/어 · wide 이/에/으 · round 오 · narrow 우. s = 부모 입모양 크기 */
function PoseMouth({ pose, s }: { pose: ParentFrame; s: number }) {
  const y = CY + 34;
  switch (pose) {
    case 'closed':
      return <Path d={`M${CX - 11} ${y} Q${CX} ${y + 3} ${CX + 11} ${y}`} stroke={MOUTH} strokeWidth="4.5" fill="none" strokeLinecap="round" />;
    case 'wide':
      return (
        <G>
          <Ellipse cx={CX} cy={y + 1} rx={15 * s} ry={5.5 * s} fill={MOUTH} />
          <Rect x={CX - 10 * s} y={y - 4 * s} width={20 * s} height={3.5 * s} rx={1.5} fill="#FFFFFF" opacity={0.9} />
        </G>
      );
    case 'round':
      return (
        <G>
          <Ellipse cx={CX} cy={y + 2} rx={8.5 * s} ry={10 * s} fill={MOUTH} />
          <Ellipse cx={CX} cy={y + 2 + 5 * s} rx={4.5 * s} ry={3 * s} fill={TONGUE} />
        </G>
      );
    case 'narrow':
      return <Ellipse cx={CX} cy={y + 1} rx={5 * s} ry={5.5 * s} fill={MOUTH} />;
    default: // open
      return (
        <G>
          <Ellipse cx={CX} cy={y + 3} rx={12 * s} ry={11 * s} fill={MOUTH} />
          <Ellipse cx={CX} cy={y + 3 + 6 * s} rx={7 * s} ry={4 * s} fill={TONGUE} />
        </G>
      );
  }
}

function Mouth({ m, expression }: { m: number; expression: AvatarExpression }) {
  const y = CY + 32;
  // 말하는 중: 음량만큼 크게 벌어짐 (또렷하게 보이도록 크게)
  if (m >= 0.08) {
    const w = 20 + m * 10 + (expression === 'praise' || expression === 'smile' ? 6 : 0);
    const h = 5 + m * 20;
    if (expression === 'praise' || expression === 'smile') return <DMouth w={w} h={h} y={y - 2} />;
    return (
      <G>
        <Ellipse cx={CX} cy={y + h / 2 - 2} rx={w / 2} ry={h / 2} fill={MOUTH} />
        {h > 9 && <Ellipse cx={CX} cy={y + h * 0.72 - 2} rx={w / 3.2} ry={h / 5} fill={TONGUE} />}
      </G>
    );
  }
  switch (expression) {
    case 'praise':
      return <DMouth w={30} h={17} y={y - 3} />;
    case 'surprise':
      return <Ellipse cx={CX} cy={y + 3} rx="6.5" ry="8" fill={MOUTH} />;
    case 'smile':
      return <Path d={`M${CX - 14} ${y - 1} Q${CX} ${y + 14} ${CX + 14} ${y - 1}`} stroke={MOUTH} strokeWidth="4" fill="none" strokeLinecap="round" />;
    case 'wait':
      return <Path d={`M${CX - 7} ${y + 1} Q${CX} ${y + 6} ${CX + 7} ${y + 1}`} stroke={MOUTH} strokeWidth="4" fill="none" strokeLinecap="round" />;
    default:
      return <Path d={`M${CX - 10} ${y} Q${CX} ${y + 9} ${CX + 10} ${y}`} stroke={MOUTH} strokeWidth="4" fill="none" strokeLinecap="round" />;
  }
}

/** 활짝 웃는 입 (위는 평평, 아래는 둥글게) + 혀 */
function DMouth({ w, h, y }: { w: number; h: number; y: number }) {
  const l = CX - w / 2;
  const r = CX + w / 2;
  return (
    <G>
      <Path d={`M${l} ${y} Q${CX} ${y - 2} ${r} ${y} Q${r} ${y + h * 1.25} ${CX} ${y + h} Q${l} ${y + h * 1.25} ${l} ${y} Z`} fill={MOUTH} />
      <Ellipse cx={CX} cy={y + h * 0.78} rx={w / 3.6} ry={h / 4.5} fill={TONGUE} />
    </G>
  );
}

// ---------- 눈썹 ----------
function Brows({ expression, c }: { expression: AvatarExpression; c: string }) {
  const lift = { neutral: 0, smile: -1, surprise: -7, wait: -3, praise: -3 }[expression];
  const y = CY - 22 + lift;
  const arch = expression === 'surprise' ? 5 : 3;
  // 기다림: 한쪽(오른쪽)을 살짝 더 올림 → "어때?" 하는 얼굴
  const tilt = expression === 'wait' ? -3 : 0;
  return (
    <G>
      <Path d={`M${CX - 35} ${y + 2} Q${CX - 27} ${y - arch} ${CX - 18} ${y + 1}`} stroke={c} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <Path d={`M${CX + 18} ${y + 1 + tilt} Q${CX + 27} ${y - arch + tilt} ${CX + 35} ${y + 2 + tilt}`} stroke={c} strokeWidth="4.5" fill="none" strokeLinecap="round" />
    </G>
  );
}

// ---------- 눈 ----------
const EYE_Y = CY + 2;
const EYE_DX = 27;

/** 웃는 눈 ^^ */
const happyEye = (x: number, w = 9) => (
  <Path key={x} d={`M${x - w} ${EYE_Y + 3} Q${x} ${EYE_Y - 9} ${x + w} ${EYE_Y + 3}`} stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round" />
);

/** 둥근 큰 눈: 흰자 + 큰 눈동자 + 반짝이 두 개. dx 로 바라보는 쪽 */
function RoundEye({ x, r = 13, pupil = 9, dx = 0, lashes = false }: { x: number; r?: number; pupil?: number; dx?: number; lashes?: boolean }) {
  return (
    <G>
      <Ellipse cx={x} cy={EYE_Y} rx={r} ry={r * 1.08} fill="#FFFFFF" stroke={INK} strokeWidth="1.5" />
      <Circle cx={x + dx} cy={EYE_Y + 1} r={pupil} fill={INK} />
      <Circle cx={x + dx + pupil * 0.38} cy={EYE_Y - pupil * 0.35} r={pupil * 0.36} fill="#FFFFFF" />
      <Circle cx={x + dx - pupil * 0.35} cy={EYE_Y + pupil * 0.45} r={pupil * 0.16} fill="#FFFFFF" />
      {lashes && <Path d={`M${x + r * 0.7} ${EYE_Y - r * 0.8} l5 -4 M${x + r * 0.95} ${EYE_Y - r * 0.35} l6 -2`} stroke={INK} strokeWidth="2.5" strokeLinecap="round" />}
    </G>
  );
}

function Eyes({ i, expression, look, skin, closed }: { i: number; expression: AvatarExpression; look: AvatarLook; skin: string; closed?: boolean }) {
  const dx = look === 'right' ? 3.5 : 0;
  const L = CX - EYE_DX;
  const Rr = CX + EYE_DX;
  const pair = (render: (x: number) => ReactNode) => (
    <G>
      {render(L)}
      {render(Rr)}
    </G>
  );
  const glasses = i === 6 && (
    <G>
      <Circle cx={L} cy={EYE_Y} r="17" stroke={INK} strokeWidth="2.5" fill="none" />
      <Circle cx={Rr} cy={EYE_Y} r="17" stroke={INK} strokeWidth="2.5" fill="none" />
      <Path d={`M${L + 17} ${EYE_Y - 2} Q${CX} ${EYE_Y - 7} ${Rr - 17} ${EYE_Y - 2}`} stroke={INK} strokeWidth="2.5" fill="none" />
    </G>
  );

  // 눈 감음(깜빡): 웃는 눈·반달처럼 원래 감은 듯한 눈은 그대로
  if (closed && i !== 1 && i !== 3 && expression !== 'praise') {
    return (
      <G>
        {pair((x) => <Path key={x} d={`M${x - 11} ${EYE_Y + 1} Q${x} ${EYE_Y + 7} ${x + 11} ${EYE_Y + 1}`} stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />)}
        {glasses}
      </G>
    );
  }
  // 칭찬: 어떤 눈을 골라도 활짝 웃는 ^^
  if (expression === 'praise') {
    return (
      <G>
        {pair((x) => happyEye(x, 10))}
        {glasses}
      </G>
    );
  }
  // 놀람: 눈이 더 커지고 눈동자는 작게
  if (expression === 'surprise') {
    return (
      <G>
        {pair((x) => <RoundEye key={x} x={x} r={14} pupil={7} dx={dx} />)}
        {glasses}
      </G>
    );
  }

  let eyes: ReactNode;
  switch (i) {
    case 1: // 웃는 눈 (늘 웃는 ^^)
      eyes = pair((x) => happyEye(x));
      break;
    case 2: // 큰 눈
      eyes = pair((x) => <RoundEye key={x} x={x} r={14} pupil={10} dx={dx} />);
      break;
    case 3: // 반달: 눈동자 아래쪽만 둥글게
      eyes = pair((x) => <Path key={x} d={`M${x - 11} ${EYE_Y - 2} Q${x} ${EYE_Y - 4} ${x + 11} ${EYE_Y - 2} Q${x + 10} ${EYE_Y + 12} ${x} ${EYE_Y + 12} Q${x - 10} ${EYE_Y + 12} ${x - 11} ${EYE_Y - 2} Z`} fill={INK} />);
      break;
    case 4: // 또렷 (속눈썹)
      eyes = pair((x) => <RoundEye key={x} x={x} dx={dx} lashes />);
      break;
    case 5: // 졸린 눈: 윗눈꺼풀이 살짝 덮음 (그래도 눈동자는 크게)
      eyes = pair((x) => (
        <G key={x}>
          <RoundEye x={x} dx={dx} />
          <Path d={`M${x - 14} ${EYE_Y - 2} Q${x} ${EYE_Y - 18} ${x + 14} ${EYE_Y - 2} Z`} fill={skin} />
          <Path d={`M${x - 12} ${EYE_Y - 3} Q${x} ${EYE_Y - 6} ${x + 12} ${EYE_Y - 3}`} stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
        </G>
      ));
      break;
    case 7: // 윙크
      eyes = (
        <G>
          <RoundEye x={L} dx={dx} />
          {happyEye(Rr)}
        </G>
      );
      break;
    default: // 동글 · 안경
      eyes = pair((x) => <RoundEye key={x} x={x} dx={dx} />);
  }

  // 웃음: 아래 눈꺼풀이 올라가 눈웃음 (눈 모양은 그대로)
  const smileLids =
    expression === 'smile' &&
    i !== 1 &&
    i !== 3 &&
    pair((x) => <Ellipse key={x} cx={x} cy={EYE_Y + 15} rx="16" ry="8" fill={skin} />);

  return (
    <G>
      {eyes}
      {smileLids}
      {glasses}
    </G>
  );
}

// ---------- 머리 ----------
/** 정수리를 덮는 머리 모양. edgeY = 앞머리 끝이 이마에서 내려오는 높이, sway = 가르마 쪽으로 쏠림 */
function cap(rx: number, ry: number, edgeY: number, sway = 0, grow = 4) {
  const sideY = CY - ry * 0.05;
  const ctrlY = 2 * edgeY - sideY;
  return `M${CX - rx - grow} ${sideY} A${rx + grow} ${ry + grow} 0 0 1 ${CX + rx + grow} ${sideY} Q${CX + sway} ${ctrlY} ${CX - rx - grow} ${sideY} Z`;
}

function HairBack({ i, rx, ry, c }: { i: number; rx: number; ry: number; c: string }) {
  switch (i) {
    case 0: // 단발: 턱선까지 둥글게
      return <Rect x={CX - rx - 8} y={CY - ry - 6} width={(rx + 8) * 2} height={ry * 2 + 4} rx={rx} fill={c} />;
    case 1: // 긴 머리: 어깨 아래까지
      return <Rect x={CX - rx - 9} y={CY - ry - 6} width={(rx + 9) * 2} height={ry * 2 + 52} rx={rx * 0.9} fill={c} />;
    case 2: // 묶음: 양쪽 동그란 방울
      return (
        <G>
          <Circle cx={CX - rx - 10} cy={CY - 18} r="17" fill={c} />
          <Circle cx={CX + rx + 10} cy={CY - 18} r="17" fill={c} />
        </G>
      );
    case 6: // 올림머리: 위에 동그란 똥머리
      return <Circle cx={CX} cy={CY - ry - 12} r="20" fill={c} />;
    default:
      return null;
  }
}

function HairFront({ i, rx, ry, c }: { i: number; rx: number; ry: number; c: string }) {
  const top = CY - ry;
  switch (i) {
    case 3: // 곱슬: 동글동글
      return (
        <G>
          <Path d={cap(rx, ry, top + 26, 0, 2)} fill={c} />
          {[-0.85, -0.5, -0.15, 0.2, 0.55, 0.88].map((k) => (
            <Circle key={k} cx={CX + k * rx} cy={top + 14 + Math.abs(k) * 22} r="14" fill={c} />
          ))}
        </G>
      );
    case 4: // 짧은 머리: 이마가 드러나게 짧게
      return <Path d={cap(rx, ry, top + 16, 0, 3)} fill={c} />;
    case 5: // 앞머리: 일자로 내려옴
      return <Path d={`M${CX - rx - 4} ${CY - 4} A${rx + 4} ${ry + 4} 0 0 1 ${CX + rx + 4} ${CY - 4} L${CX + rx - 4} ${top + 38} L${CX - rx + 4} ${top + 38} Z`} fill={c} />;
    case 7: // 모자 (둥근 비니)
      return (
        <G>
          <Path d={cap(rx, ry, top + 30, 0, 6)} fill="#FFB26B" />
          <Rect x={CX - rx - 6} y={top + 20} width={(rx + 6) * 2} height="12" rx="6" fill="#F2994A" />
          <Circle cx={CX} cy={top - 6} r="9" fill="#FFD54F" />
        </G>
      );
    case 6: // 올림머리
      return <Path d={cap(rx, ry, top + 22, 0, 3)} fill={c} />;
    case 2: // 묶음
      return <Path d={cap(rx, ry, top + 28, 14)} fill={c} />;
    default: // 단발 · 긴 머리: 옆으로 넘긴 앞머리
      return <Path d={cap(rx, ry, top + 30, -22)} fill={c} />;
  }
}

// ---------- 옷 ----------
function Outfit({ i, c }: { i: number; c: string }) {
  const body = `M${CX - 54} 222 Q${CX - 56} 168 ${CX} 164 Q${CX + 56} 168 ${CX + 54} 222 Z`;
  return (
    <G>
      <Path d={body} fill={c} />
      {i === 1 && <Path d={`M${CX - 16} 166 L${CX} 184 L${CX + 16} 166`} stroke="#FFFFFF" strokeWidth="5" fill="none" strokeLinejoin="round" />}
      {i === 2 &&
        [184, 200].map((y) => <Path key={y} d={`M${CX - 50} ${y} Q${CX} ${y - 6} ${CX + 50} ${y}`} stroke="#FFFFFF" strokeWidth="4" opacity={0.6} fill="none" />)}
      {i === 3 && [-28, 0, 28].map((dx) => <Circle key={dx} cx={CX + dx} cy={196 + (dx === 0 ? 8 : 0)} r="4" fill="#FFFFFF" opacity={0.8} />)}
      {i === 4 && <Path d={`M${CX - 30} 168 Q${CX} 196 ${CX + 30} 168`} stroke="#FFFFFF" strokeWidth="5" opacity={0.55} fill="none" />}
      {i === 5 && <Rect x={CX - 24} y={178} width="48" height="44" rx="10" fill="#FFFFFF" opacity={0.9} />}
      {i === 6 && (
        <G>
          <Path d={`M${CX} 168 L${CX} 222`} stroke="#FFFFFF" strokeWidth="3" opacity={0.7} />
          {[186, 204].map((y) => <Circle key={y} cx={CX + 7} cy={y} r="3" fill="#FFFFFF" />)}
        </G>
      )}
      {i === 7 && (
        <G>
          <Path d={`M${CX - 16} 166 L${CX} 186 L${CX + 16} 166 Z`} fill="#FFFFFF" />
          <Path d={`M${CX - 5} 176 L${CX + 5} 176 L${CX + 4} 196 L${CX} 200 L${CX - 4} 196 Z`} fill="#FFB26B" />
        </G>
      )}
    </G>
  );
}
