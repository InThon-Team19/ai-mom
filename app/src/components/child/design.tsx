// 아이 태블릿 디자인 조각 (민철 Design 보드 Kid* · Play* · Story · Chat · TabLink 기준, 1180x820 태블릿) — 담당: 태희
// 색·모양·크기를 보드 그대로 옮김. 크기는 화면 크기에 비례(useKid) — 폰 가로(약 800x360)에선 줄이되 누르는 곳은 최소 크기 유지
// 감각 자극 제한: 깜빡임 없음 (듣는 표시는 부드럽게 커졌다 작아짐), 움직임은 짧게
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import type { ItemId } from '@/content/curriculum';
import { Text } from '@/components/AppText';
import { FruitSprite } from '@/components/child/FruitSprite';

// ---------- 보드 색 ----------
export const K = {
  bg: '#FCF4E8', // 바탕 크림
  ink: '#3A364E', // 글자
  sub: '#6B6680', // 작은 글자
  white: '#FFFFFF',
  red: '#D5665B',
  redDeep: '#B04B40',
  green: '#57974A',
  greenDeep: '#3F7535',
  yellow: '#EFCA5A',
  yellowDeep: '#C9A43A',
  purple: '#8A6AD2',
  purpleDeep: '#6B4FB0',
  teal: '#589A8F',
  tealDeep: '#3F7A70',
  tealSoft: '#DCEDEA',
  orange: '#C06931',
  orangeDeep: '#9A4F20',
  peach: '#F7E4C8', // 아바타 바탕
  line: '#E6D3B5', // 점선·빈 칸
  cream: '#FBF1E2', // 감각 칩·빈 코드 칸
  basket: '#F7EADA',
  whiteDeep: '#E6D6BE', // 흰 버튼 아래 두께
  confetti: '#EEDFC9',
  star: '#F0C14B',
  starLine: '#D9A53A',
  starOff: '#F3EADB',
  starOffLine: '#E2D3BA',
  night: '#2A244D', // 소리만 듣기 바탕
  nightSoft: '#3D3470',
  nightRing: '#5C51A2',
  nightRing2: '#6E62BF',
  moon: '#F7E9B0',
  mint: '#8FD3C3',
};

export const SOFT = '0px 4px 14px rgba(58,54,78,0.06)';
export const SOFT2 = '0px 3px 10px rgba(58,54,78,0.08)';
export const depth = (color: string, d: number) => `0px ${d}px 0px ${color}`;

// ---------- 크기: 보드(1180x820) 기준 비율 ----------
export function useKid() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = Math.max(0.4, Math.min(1.3, Math.min(width / 1180, height / 820)));
  const compact = height < 520 || Math.min(width, height) < 600;
  /** 보드 px → 화면 px (min: 아이 손가락·읽기 최소) */
  const u = (n: number, min = 0) => Math.max(min, Math.round(n * s));
  /** 글자 크기 (폰에서도 너무 작아지지 않게) */
  const f = (n: number, min = 12) => Math.max(min, Math.round(n * Math.max(s, 0.52)));
  return { s, u, f, compact, width, height, insets };
}

/** 화면 바탕 + 보드 여백(위 30 · 옆 44 · 아래 34) */
export function KidScreen({ children, gap = 20, dark, style }: { children: ReactNode; gap?: number; dark?: boolean; style?: StyleProp<ViewStyle> }) {
  const { u, insets } = useKid();
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: dark ? K.night : K.bg,
          paddingTop: u(30, 8) + insets.top,
          paddingBottom: u(34, 8) + insets.bottom,
          paddingLeft: u(44, 14) + insets.left,
          paddingRight: u(44, 14) + insets.right,
          gap: u(gap, 6),
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/** 보드 글꼴 느낌(둥글고 굵게)에 가까운 기본 글자 */
export function KText({ size, color = K.ink, style, children, lines }: { size: number; color?: string; style?: StyleProp<TextStyle>; children: ReactNode; lines?: number }) {
  return (
    <Text numberOfLines={lines} style={[{ fontSize: size, color, fontWeight: '800', lineHeight: Math.round(size * 1.3) }, style]}>
      {children}
    </Text>
  );
}

// ---------- 아이콘 (보드 SVG 그대로) ----------
type IconP = { size?: number; color?: string };
export function CloseIcon({ size = 20, color = K.ink }: IconP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path d="M5 5l10 10M15 5L5 15" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}
export function LockIcon({ size = 16, color = K.ink }: IconP) {
  return (
    <Svg width={size * 0.875} height={size} viewBox="0 0 14 16">
      <Rect x="1" y="7" width="12" height="8" rx="2" fill={color} />
      <Path d="M4 7V5a3 3 0 0 1 6 0v2" stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}
export function HomeIcon({ size = 14, color = K.ink }: IconP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 11l9-7 9 7v9H3z" fill={color} />
    </Svg>
  );
}
const STAR_D = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z';
export function StarIcon({ size = 20, on = true, outline }: { size?: number; on?: boolean; outline?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={STAR_D}
        fill={outline ? 'none' : on ? K.star : K.starOff}
        stroke={outline ?? (on ? K.starLine : K.starOffLine)}
        strokeWidth={outline ? 2 : 1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
const HAND_D =
  'M9 12V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.6a6 6 0 0 1-4.8-2.4L4.3 16a1.6 1.6 0 0 1 2.4-2L9 16';
export function HandIcon({ size = 26, line }: { size?: number; line?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={HAND_D} fill={line ? 'none' : '#F2D160'} stroke={line ?? '#B48A2E'} strokeWidth={line ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export function MicIcon({ size = 24, color = K.red }: IconP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="9" y="3" width="6" height="11" rx="3" fill={color} />
      <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
export function SpeakerIcon({ size = 24, color = K.white, waves = 2 }: IconP & { waves?: 1 | 2 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 9h3.5L13 4.5v15L7.5 15H4z" fill={color} />
      <Path d={waves === 2 ? 'M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11' : 'M16 9a4 4 0 0 1 0 6'} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
export function BookIcon({ size = 24, color = K.purple }: IconP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 5.5c3-1.4 6-1.4 8.5.3v13.5c-2.5-1.7-5.5-1.7-8.5-.3zM21 5.5c-3-1.4-6-1.4-8.5.3v13.5c2.5-1.7 5.5-1.7 8.5-.3z" fill={color} />
    </Svg>
  );
}
export function ChatIcon({ size = 24, color = K.orange, dots }: IconP & { dots?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" fill={color} />
      {dots && (
        <>
          <Circle cx="9" cy="10.5" r="1.2" fill={K.white} />
          <Circle cx="12" cy="10.5" r="1.2" fill={K.white} />
          <Circle cx="15" cy="10.5" r="1.2" fill={K.white} />
        </>
      )}
    </Svg>
  );
}
export function EyeIcon({ size = 18, color = K.white }: IconP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke={color} strokeWidth={2} />
      <Circle cx="12" cy="12" r="3" fill={color} />
    </Svg>
  );
}
export function PlayTriIcon({ size = 46, color = K.red }: IconP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8.5 5.5v13l10.5-6.5z" fill={color} stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
export function ChevIcon({ size = 20, color = K.ink, left }: IconP & { left?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={left ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} stroke={color} strokeWidth={2.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export function MonitorIcon({ size = 26, color = K.ink }: IconP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="3" y="4" width="18" height="12" rx="2" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M9 20h6M12 16v4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
export function CheckIcon({ size = 24, color = K.white }: IconP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 12.5l4 4 8-9" stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export function SkipNextIcon({ size = 24, color = K.white }: IconP) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 5 L15.5 12 L5 19 Z" fill={color} />
      <Rect x="16.5" y="5" width="3" height="14" rx="1" fill={color} />
    </Svg>
  );
}

// ---------- 사물 그림 (보드 SVG. 과자는 보드에 없어 같은 선 굵기로 그림) ----------
export function ItemArt({ id, size, ghost }: { id: ItemId | 'strawberry' | 'grape'; size: number; ghost?: boolean }) {
  // ghost: 바구니 빈자리 (흐린 색 + 점선)
  const dash = ghost ? '3 3' : undefined;
  if (id === 'apple' || id === 'banana')
    return (
      <View style={{ opacity: ghost ? 0.35 : 1 }}>
        <FruitSprite id={id} size={size} presses={0} reduceMotion />
      </View>
    );
  if (id === 'snack')
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Circle cx="32" cy="33" r="22" fill={ghost ? '#E8C984' : '#D9A05B'} stroke={ghost ? '#B8914A' : '#A8743A'} strokeWidth={ghost ? 2 : 2.5} strokeDasharray={dash} />
        {!ghost && (
          <G fill="#6B4426">
            <Circle cx="24" cy="26" r="2.6" />
            <Circle cx="37" cy="23" r="2.2" />
            <Circle cx="41" cy="36" r="2.6" />
            <Circle cx="28" cy="40" r="2.4" />
            <Circle cx="33" cy="32" r="1.8" />
          </G>
        )}
      </Svg>
    );
  if (id === 'strawberry')
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Path d="M32 56 Q13 42 14 28 Q15 19 32 21 Q49 19 50 28 Q51 42 32 56 Z" fill="#E06660" stroke="#B5453E" strokeWidth={2.5} strokeLinejoin="round" />
        <Path d="M21 21 L27 14 L32 19 L37 14 L43 21 Q32 26 21 21 Z" fill="#7CC04B" />
      </Svg>
    );
  if (id === 'grape')
    return (
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <G fill="#8A6AD2" stroke="#6B4FB0" strokeWidth={2}>
          <Circle cx="22" cy="22" r="7" />
          <Circle cx="32" cy="22" r="7" />
          <Circle cx="42" cy="22" r="7" />
          <Circle cx="27" cy="32" r="7" />
          <Circle cx="37" cy="32" r="7" />
          <Circle cx="32" cy="42" r="7" />
        </G>
      </Svg>
    );
  return null;
}

// ---------- 버튼 ----------
/** 두툼한 버튼 (아래 진한 색 두께 — 보드 box-shadow 0 Npx 0). 누르면 살짝 내려감 */
export function ChunkyButton({
  label,
  onPress,
  color = K.yellow,
  deep = K.yellowDeep,
  textColor = K.ink,
  icon,
  iconRight,
  height,
  width,
  fontSize,
  radius,
  d = 6,
  disabled,
  style,
  a11y,
}: {
  label?: string;
  onPress?: () => void;
  color?: string;
  deep?: string;
  textColor?: string;
  icon?: ReactNode;
  iconRight?: ReactNode;
  height: number;
  width?: number | `${number}%`;
  fontSize: number;
  radius?: number;
  d?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  a11y?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        {
          height,
          width,
          paddingHorizontal: width ? 0 : Math.round(height * 0.4),
          borderRadius: radius ?? height / 2,
          backgroundColor: color,
          boxShadow: depth(deep, pressed ? Math.max(1, Math.round(d / 3)) : d),
          transform: [{ translateY: pressed ? d - Math.max(1, Math.round(d / 3)) : 0 }],
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Math.round(fontSize * 0.35),
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}>
      {icon}
      {!!label && (
        <Text numberOfLines={1} style={{ fontSize, fontWeight: '800', color: textColor }}>
          {label}
        </Text>
      )}
      {iconRight}
    </Pressable>
  );
}

/** 흰 알약 (부모 · 홈 · 소리만) — 그림자 살짝 */
export function SoftPill({
  label,
  icon,
  onPress,
  dark,
  active,
  style,
  a11y,
}: {
  label?: string;
  icon?: ReactNode;
  onPress?: () => void;
  dark?: boolean;
  active?: boolean; // 노란 두툼 (천천히 켜짐)
  style?: StyleProp<ViewStyle>;
  a11y?: string;
}) {
  const { u, f } = useKid();
  const h = u(48, 36);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        {
          height: h,
          paddingHorizontal: u(label ? 20 : 14, 10),
          borderRadius: h / 2,
          backgroundColor: dark ? K.nightSoft : active ? K.yellow : K.white,
          boxShadow: dark ? undefined : active ? depth(K.yellowDeep, u(4, 2)) : SOFT2,
          flexDirection: 'row',
          alignItems: 'center',
          gap: u(8, 5),
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}>
      {icon}
      {!!label && <Text style={{ fontSize: f(17, 13), fontWeight: '800', color: dark ? K.white : K.ink }}>{label}</Text>}
    </Pressable>
  );
}

/** 닫기(X) — 아이 홈으로 (쌓인 아이 화면을 닫음) */
export function CloseButton({ onBefore }: { onBefore?: () => void }) {
  const { u } = useKid();
  const n = u(56, 40);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="닫기 (아이 홈으로)"
      hitSlop={8}
      onPress={() => {
        onBefore?.();
        router.dismissTo('/child');
      }}
      style={({ pressed }) => ({ width: n, height: n, borderRadius: n / 2, backgroundColor: K.white, boxShadow: SOFT2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
      <CloseIcon size={Math.round(n * 0.36)} />
    </Pressable>
  );
}

/** 홈 알약 (소리만 듣기 · 마무리) */
export function HomePill({ dark, onBefore }: { dark?: boolean; onBefore?: () => void }) {
  const { u } = useKid();
  return (
    <SoftPill
      dark={dark}
      label="홈"
      a11y="아이 홈으로"
      icon={<HomeIcon size={u(14, 12)} color={dark ? K.white : K.ink} />}
      onPress={() => {
        onBefore?.();
        router.dismissTo('/child');
      }}
    />
  );
}

/** 진행 막대 5칸: 끝난 칸 초록 · 지금 칸 빨강 · 남은 칸 짧은 베이지 */
export function StepDots({ current, total = 5 }: { current: number; total?: number }) {
  const { u } = useKid();
  return (
    <View accessibilityLabel={`${total}단계 중 ${current + 1}단계`} style={{ flexDirection: 'row', gap: u(6, 4) }}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{ width: i <= current ? u(32, 18) : u(14, 8), height: u(8, 5), borderRadius: u(4, 3), backgroundColor: i < current ? K.green : i === current ? K.red : K.line }}
        />
      ))}
    </View>
  );
}

/** 머리줄: 왼쪽(닫기 등) · 가운데 제목(+진행) · 오른쪽(부모 등) */
export function TopBar({ left, title, icon, extra, steps, right }: { left?: ReactNode; title?: string; icon?: ReactNode; extra?: string; steps?: number; right?: ReactNode }) {
  const { u, f } = useKid();
  return (
    <View style={{ height: u(60, 40), flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: u(10, 6) }}>{left}</View>
      {!!title && (
        <View style={{ alignItems: 'center', gap: u(8, 3) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(8, 5) }}>
            {icon}
            <Text numberOfLines={1} style={{ fontSize: f(24, 15), fontWeight: '800', color: K.ink }}>
              {title}
              {!!extra && <Text style={{ fontSize: f(17, 12), color: K.sub }}> {extra}</Text>}
            </Text>
          </View>
          {steps !== undefined && <StepDots current={steps} />}
        </View>
      )}
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: u(10, 6) }}>{right}</View>
    </View>
  );
}

/** 말풍선 (흰 바탕, 아래 꼬리) */
export function Bubble({ children, size, tail = true, style }: { children: ReactNode; size: number; tail?: boolean; style?: StyleProp<ViewStyle> }) {
  const { u } = useKid();
  return (
    <View style={[{ paddingVertical: u(18, 8), paddingHorizontal: u(30, 12), borderRadius: u(24, 14), backgroundColor: K.white, boxShadow: '0px 4px 14px rgba(58,54,78,0.08)' }, style]}>
      <Text style={{ fontSize: size, lineHeight: Math.round(size * 1.4), fontWeight: '800', color: K.ink, textAlign: 'center' }}>{children}</Text>
      {tail && (
        <View style={{ position: 'absolute', bottom: -u(9, 5), left: '50%', marginLeft: -u(9, 5), width: u(18, 10), height: u(18, 10), backgroundColor: K.white, transform: [{ rotate: '45deg' }] }} />
      )}
    </View>
  );
}

/** 둥근 아바타 틀 (흰 테두리 · 살구 바탕 · 아래 정렬) */
export function AvatarCircle({ size, border, borderColor = K.white, shadow = true, children }: { size: number; border: number; borderColor?: string; shadow?: boolean; children: ReactNode }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: border,
        borderColor,
        backgroundColor: K.peach,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'flex-end',
        boxShadow: shadow ? '0px 8px 24px rgba(58,54,78,0.1)' : undefined,
      }}>
      {children}
    </View>
  );
}

/** 왼쪽 아바타 칸 (보드 423 폭 살구 판 + 위 말풍선). avatar 는 (판 폭, 판 높이) 를 받아 그림 */
export function AvatarPanel({ line, avatar }: { line?: string; avatar: (w: number, h: number) => ReactNode }) {
  const { u, f } = useKid();
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={{ width: u(423, 200), borderRadius: u(36, 18), backgroundColor: K.peach, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' }}>
      {box.w > 0 && avatar(box.w, box.h)}
      {!!line && (
        <View style={{ position: 'absolute', top: u(24, 8), left: u(24, 8), right: u(24, 8), padding: u(20, 8), borderRadius: u(24, 12), backgroundColor: K.white }}>
          <Text numberOfLines={3} style={{ fontSize: f(28, 14), lineHeight: Math.round(f(28, 14) * 1.4), fontWeight: '800', color: K.ink, textAlign: 'center' }}>
            {line.replace(/([?!])\s+(?=\S)/g, '$1\n') /* "볼까? 바나나!" → 물음표·느낌표 뒤에서 줄바꿈 */}
          </Text>
        </View>
      )}
    </View>
  );
}

/** 흰 큰 카드 (보드 radius 36 + 옅은 그림자) */
export function WhiteCard({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { u } = useKid();
  return <View style={[{ flex: 1, minWidth: 0, borderRadius: u(36, 18), backgroundColor: K.white, boxShadow: SOFT }, style]}>{children}</View>;
}

/** 감각 칩: 촉각(주황 손) · 청각(초록빛 스피커) · 시각(보라 눈) */
export function SenseChip({ kind, label }: { kind: 'touch' | 'audio' | 'visual'; label: string }) {
  const { u, f } = useKid();
  const bg = kind === 'touch' ? K.orange : kind === 'audio' ? K.teal : K.purple;
  const i = u(18, 12);
  return (
    <View style={{ height: u(44, 30), paddingLeft: u(6, 4), paddingRight: u(16, 10), borderRadius: u(22, 15), backgroundColor: K.cream, flexDirection: 'row', alignItems: 'center', gap: u(8, 5) }}>
      <View style={{ width: u(32, 22), height: u(32, 22), borderRadius: u(16, 11), backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        {kind === 'touch' ? <HandIcon size={i} line={K.white} /> : kind === 'audio' ? <SpeakerIcon size={i} waves={1} /> : <EyeIcon size={i} />}
      </View>
      <Text style={{ fontSize: f(16, 12), fontWeight: '700', color: K.ink }}>{label}</Text>
    </View>
  );
}

/** 별 n 개 중 on 개 */
export function Stars({ on, of = 3, size, gap }: { on: number; of?: number; size: number; gap: number }) {
  return (
    <View accessibilityLabel={`별 ${of}개 중 ${on}개`} style={{ flexDirection: 'row', gap }}>
      {Array.from({ length: of }, (_, i) => (
        <StarIcon key={i} size={size} on={i < on} />
      ))}
    </View>
  );
}

/** 보드 바구니 그림 (472x200). children 은 바구니 안쪽(위 30% 아래)에 가운데 정렬로 놓임 */
export function BasketArt({ width, children, tall }: { width: number; children?: ReactNode; tall?: boolean }) {
  const H = tall ? 200 : 190;
  const h = (width * H) / 472;
  return (
    <View style={{ width, height: h }}>
      <Svg width={width} height={h} viewBox={`0 0 472 ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Path d={tall ? 'M10 46 H462 V90 Q462 200 340 200 H132 Q10 200 10 90 Z' : 'M10 46 H462 V86 Q462 190 340 190 H132 Q10 190 10 86 Z'} fill="#B8914A" />
        <Path d={tall ? 'M10 40 H462 V84 Q462 192 340 192 H132 Q10 192 10 84 Z' : 'M10 40 H462 V80 Q462 182 340 182 H132 Q10 182 10 80 Z'} fill="#D9B369" />
        <Rect x="0" y="20" width="472" height="32" rx="16" fill="#C79B4E" />
      </Svg>
      <View style={{ position: 'absolute', top: h * 0.29, left: 0, right: 0, bottom: h * 0.1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: width * 0.085 }}>
        {children}
      </View>
    </View>
  );
}

/**
 * 듣고 있는 마이크 (보드 KidRepeat · Chat): 연한 원 + 초록빛 원 + 양옆 소리 막대.
 * 말소리 크기(level)만큼 막대·바깥 원이 부드럽게 커짐, 듣는 중엔 천천히 숨쉬듯. 깜빡임 없음. 누르면 지금 바로 들음
 */
export function ListeningMic({
  status,
  level,
  onPress,
  size,
  bars = true,
}: {
  status: 'off' | 'denied' | 'paused' | 'listening' | 'hearing';
  level: SharedValue<number>;
  onPress?: () => void;
  size: number; // 바깥 원 지름 (보드 184)
  bars?: boolean;
}) {
  const on = status === 'listening' || status === 'hearing';
  const breathe = useSharedValue(0);
  useEffect(() => {
    if (on) breathe.value = withRepeat(withTiming(1, { duration: 1600 }), -1, true);
    else {
      cancelAnimation(breathe);
      breathe.value = 0;
    }
  }, [on, breathe]);
  const ring = useAnimatedStyle(() => {
    const k = on ? Math.max(level.value, breathe.value * 0.3) : 0;
    return { transform: [{ scale: 1 + 0.08 * k }] };
  });
  const inner = size * (148 / 184);
  const barW = Math.max(4, size * (9 / 184));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.12, opacity: on ? 1 : 0.55 }}>
      {bars && <Bars level={level} on={on} w={barW} h={size * (44 / 184)} order={[14, 26, 40]} />}
      <Pressable accessibilityRole="button" accessibilityLabel="듣고 있어요" onPress={onPress} hitSlop={10} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: status === 'hearing' ? '#C7E3DE' : K.tealSoft }, ring]} />
        <View style={{ width: inner, height: inner, borderRadius: inner / 2, backgroundColor: K.teal, boxShadow: depth(K.tealDeep, Math.max(2, Math.round(size * (6 / 184)))), alignItems: 'center', justifyContent: 'center' }}>
          <MicIcon size={inner * 0.4} color={K.white} />
        </View>
      </Pressable>
      {bars && <Bars level={level} on={on} w={barW} h={size * (44 / 184)} order={[40, 26, 14]} />}
    </View>
  );
}

function Bars({ level, on, w, h, order }: { level: SharedValue<number>; on: boolean; w: number; h: number; order: number[] }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: w * 0.78, height: h }}>
      {order.map((b, i) => (
        <Bar key={i} level={level} on={on} w={w} full={(h * b) / 44} />
      ))}
    </View>
  );
}
function Bar({ level, on, w, full }: { level: SharedValue<number>; on: boolean; w: number; full: number }) {
  const st = useAnimatedStyle(() => ({ height: Math.max(w, full * (on ? 0.45 + 0.55 * Math.min(1, level.value * 1.4) : 0.45)) }));
  return <Animated.View style={[{ width: w, borderRadius: w / 2, backgroundColor: K.teal }, st]} />;
}
