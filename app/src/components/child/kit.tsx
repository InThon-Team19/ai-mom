// 아이 태블릿 3-x 공용 조각 (아이콘·큰 버튼·누르고 말하는 마이크·하루 사용 상한·응시 센서) — 담당: 태희 (민철 와이어프레임 기준)
// 공용 파일(ui.tsx, theme.ts 등)은 건드리지 않고 아이 화면에만 필요한 것을 여기 모음
import AsyncStorage from '@react-native-async-storage/async-storage';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { FaceTracker, type FaceFrame } from '@/components/FaceTracker';
import { api } from '@/lib/api';
import type { Profile } from '@/lib/store';
import { C, R } from '@/theme';

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 아이를 부르는 말·부모 호칭·영어 노출 여부 */
export function who(p: Profile | null) {
  return {
    name: p?.child.nickname || p?.child.name || '',
    me: p?.parent.title || '엄마',
    english: !!p?.parent.goals?.some((g) => g.includes('영어')),
  };
}

/** 부모 입모양 크기(open_p90) → 아바타 입 크기 배율. 실패하면 1 */
export function useMouthScale(childId: string | undefined) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!childId) return;
    let alive = true;
    api
      .mouthProfile(childId)
      .then((m) => alive && setScale(Math.max(0.6, Math.min(1.6, (m.open_p90 || 0.25) / 0.25))))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [childId]);
  return scale;
}

// ---------- 아이콘 (글자 기호는 기기마다 이모지로 바뀌어서 SVG 로 그림) ----------
export function PlayIcon({ size = 40, color = C.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 4.5 L19.5 12 L7 19.5 Z" fill={color} strokeLinejoin="round" />
    </Svg>
  );
}
export function SkipIcon({ size = 28, color = C.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 5 L15.5 12 L5 19 Z" fill={color} />
      <Rect x="16.5" y="5" width="3" height="14" rx="1" fill={color} />
    </Svg>
  );
}
export function ChevronIcon({ size = 28, color = C.white, left }: { size?: number; color?: string; left?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={left ? 'M15 5 L8 12 L15 19' : 'M9 5 L16 12 L9 19'} stroke={color} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
export function MicIcon({ size = 48, color = C.white }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="9" y="3" width="6" height="11" rx="3" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M5.5 11 a6.5 6.5 0 0 0 13 0 M12 17.5 V21" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
/** ◎ 눌러봐 힌트 */
export function TargetIcon({ size = 22, color = C.sub }: { size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size * 0.38, height: size * 0.38, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

// ---------- 버튼 ----------
/** 파란 원형 버튼 (시작 ▶, 다음 ▶|, 이전/다음 ‹ ›). 기본 96px — 아이 손가락 기준 88px 이상 */
export function RoundButton({
  onPress,
  children,
  size = 96,
  color = C.primary,
  label,
  style,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  size?: number;
  color?: string;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 },
        style,
      ]}>
      {children}
    </Pressable>
  );
}

/** 흰 바탕 테두리 알약 버튼 (천천히, 다시 들려줘, 소리만 듣기, 화면 켜기) */
export function PillButton({
  label,
  onPress,
  selected,
  dark,
  primary,
  small,
  style,
}: {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  dark?: boolean;
  primary?: boolean; // 파란 바탕 (3-8 한 번 더 볼래요)
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const h = small ? 52 : 88;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        {
          minHeight: h,
          paddingHorizontal: small ? 18 : 30,
          borderRadius: R.pill,
          borderWidth: 2,
          borderColor: dark ? C.white : primary || selected ? C.primary : C.text,
          backgroundColor: dark ? 'transparent' : primary ? C.primary : selected ? C.primarySoft : C.white,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}>
      <Text style={{ fontSize: small ? 16 : 22, fontWeight: '800', color: dark || primary ? C.white : selected ? C.primary : C.text }}>{label}</Text>
    </Pressable>
  );
}

/** 따라 말하기 마이크: 누르고 있는 동안 녹음 (onPressIn / onPressOut). 녹음 중엔 부드러운 물결 테두리 */
export function HoldMic({ recording, onPressIn, onPressOut, size = 120, disabled }: { recording: boolean; onPressIn: () => void; onPressOut: () => void; size?: number; disabled?: boolean }) {
  const ring = useSharedValue(0);
  useEffect(() => {
    if (recording) ring.value = withRepeat(withTiming(1, { duration: 1100 }), -1, false);
    else {
      cancelAnimation(ring);
      ring.value = 0;
    }
  }, [recording, ring]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: recording ? 0.45 * (1 - ring.value) : 0, transform: [{ scale: 1 + ring.value * 0.35 }] }));
  return (
    <View style={{ width: size * 1.4, height: size * 1.4, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: C.primary }, ringStyle]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="누르고 말하기"
        disabled={disabled}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: recording ? '#1A3FA8' : C.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.6 : 1,
        }}>
        <MicIcon size={size * 0.45} />
      </Pressable>
    </View>
  );
}

// ---------- 하루 사용 상한 (1-7 설정) ----------
const USAGE_KEY = 'aibom.child.usage';
const today = () => new Date().toISOString().slice(0, 10);
let usage: { date: string; seconds: number } | null = null;

async function loadUsage() {
  if (!usage || usage.date !== today()) {
    try {
      const raw = await AsyncStorage.getItem(USAGE_KEY);
      const u = raw ? (JSON.parse(raw) as { date: string; seconds: number }) : null;
      usage = u && u.date === today() ? u : { date: today(), seconds: 0 };
    } catch {
      usage = { date: today(), seconds: 0 };
    }
  }
  return usage;
}

/** 화면이 켜져 있는 동안 오늘 사용 시간을 쌓고, 상한(분)을 넘으면 onExceeded. 0 이하면 제한 없음 */
export function useDailyLimit(limitMin: number | undefined, active: boolean, onExceeded: () => void) {
  const cb = useRef(onExceeded);
  useEffect(() => {
    cb.current = onExceeded;
  }, [onExceeded]);
  useEffect(() => {
    if (!active || !limitMin || limitMin <= 0) return;
    const limit = limitMin * 60;
    let fired = false;
    const check = (u: { seconds: number }) => {
      if (!fired && u.seconds >= limit) {
        fired = true;
        cb.current();
      }
    };
    loadUsage().then(check);
    const STEP = 5;
    const id = setInterval(async () => {
      const u = await loadUsage();
      u.seconds += STEP;
      AsyncStorage.setItem(USAGE_KEY, JSON.stringify(u)).catch(() => {});
      check(u);
    }, STEP * 1000);
    return () => clearInterval(id);
  }, [limitMin, active]);
}

// ---------- 아이 얼굴 센서 (응시·웃음·입모양 따라 하기) ----------
/** FaceTracker 를 작게 띄우고 다시 그려지지 않게 고정 (WebView 재시작 방지). onFrame 은 ref 로 최신값 사용 */
export const FaceSensor = memo(function FaceSensor({ onFrame, style }: { onFrame: (f: FaceFrame) => void; style?: ViewStyle }) {
  const ref = useRef(onFrame);
  useEffect(() => {
    ref.current = onFrame;
  }, [onFrame]);
  const handler = useMemo(() => (f: FaceFrame) => ref.current(f), []);
  return <FaceTracker onFrame={handler} onError={() => {}} style={style} />;
});

/** 소리 파형 막대 (3-7). level 0~1 로 높이 변화, 말 안 할 때는 낮게 숨쉬듯 */
export function Waveform({ level, color = '#9BB0F2' }: { level: number; color?: string }) {
  const base = [0.3, 0.55, 0.9, 0.65, 1, 0.45, 0.85, 0.4, 0.2];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, height: 130 }}>
      {base.map((b, i) => (
        <View key={i} style={{ width: 10, borderRadius: 5, backgroundColor: color, height: 16 + b * 100 * (0.35 + 0.65 * level) }} />
      ))}
    </View>
  );
}
