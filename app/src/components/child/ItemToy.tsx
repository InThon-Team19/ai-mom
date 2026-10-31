// 아이 태블릿 3-2 · 3-3 · 3-5 누르는 사물 — 담당: 태희 (민철 와이어프레임 · 기획 2-3 "사과 한 바퀴의 움직임")
// 기획 1-1 "아바타가 단어를 말할 때의 연출": 사과 = 베어 문 자국 / 바나나 = 껍질이 한 줄씩 / 과자 = 금이 쩍 → 둘로 부러짐 + 부스러기
// 움직임: 위에서 떨어져 납작하게 닿고 두 번 통통(움직임 줄이기면 한 번) · 기다리면 살짝 흔들림 · 누르면 눌렸다 튀어 오름
//        · 아이 말소리 크기만큼 커짐 · 딴 데를 보면(attention) 더 크게 통통 튀며 흔들림 · 성공하면 크게 튀며 별 · 넘어갈 때 굴러서 바구니로 쏙
// 감각 자극 제한: 깜빡임 없음, 움직임 한 번은 1초 안
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';

import Svg, { Path } from 'react-native-svg';

import { ItemArt } from '@/components/child/design';
import { StarBurst } from '@/components/child/stage';
import type { ItemId } from '@/content/curriculum';
import { playSfx } from '@/lib/sense';

const GENTLE = { damping: 14, stiffness: 120 };
const out = Easing.out(Easing.quad);
const inn = Easing.in(Easing.quad);

/** 떨어지는 시간(ms)과 튀는 구간 — 소리 타이밍도 여기서 계산 */
const FALL = 340;
const SQUASH = 80;
export const dropDuration = (reduceMotion?: boolean) => FALL + SQUASH + 300 + (reduceMotion ? 0 : 200);
const LEAVE = 720;

function Glyph({ emoji, size }: { emoji: string; size: number }) {
  return (
    <Text
      allowFontScaling={false}
      style={{ width: size, height: size, fontSize: size * 0.78, lineHeight: size, textAlign: 'center', includeFontPadding: false }}>
      {emoji}
    </Text>
  );
}

/** 사과: 누를 때마다 오른쪽 가장자리에 한 입씩 (최대 3입) */
function Bites({ count, size, bg }: { count: number; size: number; bg: string }) {
  const spots = [
    { x: 0.82, y: 0.3 },
    { x: 0.88, y: 0.52 },
    { x: 0.8, y: 0.73 },
  ];
  const r = size * 0.13;
  return (
    <>
      {spots.slice(0, count).map((s, i) => (
        <Animated.View
          key={i}
          entering={ZoomIn.duration(160)}
          pointerEvents="none"
          style={{ position: 'absolute', left: s.x * size - r, top: s.y * size - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: bg }}
        />
      ))}
    </>
  );
}

/** 바나나: 누를 때마다 위쪽을 덮던 껍질 한 줄이 바깥으로 벗겨져 내려옴 (최대 3줄) */
function PeelStrip({ index, peeled, size }: { index: number; peeled: boolean; size: number }) {
  const angle = [-140, 140, 165][index];
  const rot = useSharedValue(0);
  const op = useSharedValue(0);
  useEffect(() => {
    if (peeled) {
      op.set(withTiming(1, { duration: 120 }));
      rot.set(withTiming(angle, { duration: 600 }));
    }
  }, [peeled, angle, op, rot]);
  const st = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ rotate: `${rot.value}deg` }] }));
  const w = size * 0.16;
  const h = size * 0.42;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: size * 0.5 - w / 2 + (index - 1) * w * 0.4,
          top: size * 0.5 - h,
          width: w,
          height: h,
          borderRadius: w / 2,
          backgroundColor: '#F6D649',
          borderWidth: 2,
          borderColor: '#C9A21C',
          transformOrigin: 'bottom',
        },
        st,
      ]}
    />
  );
}

/** 과자: 반쪽 두 개를 따로 그려서 누르면 벌어졌다가 다시 붙음 */
function Half({ id, size, side, apart }: { id: ItemId; size: number; side: 'left' | 'right'; apart: SharedValue<number> }) {
  const sign = side === 'left' ? -1 : 1;
  const st = useAnimatedStyle(() => ({
    transform: [{ translateX: sign * apart.value * size * 0.14 }, { rotate: `${sign * apart.value * 14}deg` }],
  }));
  return (
    <Animated.View style={[{ width: size / 2, height: size, overflow: 'hidden' }, st]}>
      <View style={{ position: 'absolute', left: side === 'left' ? 0 : -size / 2 }}>
        <ItemArt id={id} size={size} />
      </View>
    </Animated.View>
  );
}

/** 과자: 누르면 가운데에 금이 먼저 쩍 가고(0.1초) → 반쪽이 벌어지면 금은 틈에 묻혀 흐려졌다가 → 다시 붙으면 옅은 금 자국이 남음 */
function Crack({ trigger, size }: { trigger: number; size: number }) {
  const op = useSharedValue(0);
  const draw = useSharedValue(0); // 위에서 아래로 금이 그어짐 (세로 크기 비율)
  useEffect(() => {
    if (!trigger) return;
    draw.set(0);
    draw.set(withTiming(1, { duration: 110, easing: out }));
    op.set(withSequence(withTiming(1, { duration: 60 }), withDelay(120, withTiming(0, { duration: 160 })), withDelay(1100, withTiming(0.45, { duration: 300 }))));
  }, [trigger, op, draw]);
  const st = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scaleY: draw.value }] }));
  const w = size * 0.22;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: size / 2 - w / 2, top: size * 0.12, width: w, height: size * 0.76, transformOrigin: 'top' }, st]}>
      <Svg width={w} height={size * 0.76} viewBox="0 0 20 76">
        <Path d="M10 0 L6 12 L13 22 L7 34 L14 46 L8 58 L12 68 L10 76" stroke="#6B4423" strokeWidth={3} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

/** 과자 부스러기: 부러지는 순간 작은 조각 몇 개가 아래로 톡 떨어지며 사라짐 (0.7초 한 번) */
const CRUMBS = [
  { dx: -0.32, dy: 0.42, r: 0.05, rot: -120 },
  { dx: -0.12, dy: 0.5, r: 0.035, rot: 90 },
  { dx: 0.1, dy: 0.48, r: 0.045, rot: -60 },
  { dx: 0.3, dy: 0.4, r: 0.035, rot: 140 },
];
function Crumb({ trigger, size, c, reduceMotion }: { trigger: number; size: number; c: (typeof CRUMBS)[number]; reduceMotion?: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!trigger) return;
    p.set(0);
    p.set(withDelay(90, withTiming(1, { duration: reduceMotion ? 500 : 700, easing: Easing.out(Easing.quad) })));
  }, [trigger, p, reduceMotion]);
  const k = reduceMotion ? 0.5 : 1;
  const st = useAnimatedStyle(() => {
    const v = p.value;
    return {
      opacity: v <= 0 ? 0 : v < 0.1 ? v * 10 : 1 - (v - 0.1) / 0.9,
      // 옆으로 퍼지면서 아래로 떨어짐 (포물선)
      transform: [{ translateX: c.dx * size * k * v }, { translateY: (c.dy * v * v - 0.08 * v) * size * k }, { rotate: `${c.rot * v}deg` }],
    };
  });
  const d = c.r * size * 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: size / 2 - d / 2, top: size * 0.5 - d / 2, width: d, height: d, borderRadius: d * 0.3, backgroundColor: '#C68B4E', borderWidth: 1, borderColor: '#8E5B2C' }, st]}
    />
  );
}

export type ToyLeave = { dx: number; dy: number };

export function ItemToy({
  id,
  size,
  bg,
  onPress,
  drop,
  reduceMotion,
  wiggle = 0,
  attention = 0,
  voice = 0,
  success = 0,
  leave = null,
  onLeft,
  interactive = true,
  instant = false,
}: {
  id: ItemId;
  emoji?: string; // 예전 이모지 (지금은 보드 SVG 그림 ItemArt 로 그림)
  size: number;
  bg: string; // 무대 바탕색 (사과 베어 문 자국 색)
  onPress: () => void;
  drop: boolean; // true 가 되는 순간 위에서 떨어짐 (그 전엔 안 보임)
  reduceMotion?: boolean; // 설정 '움직임 줄이기': 튀는 횟수 1번
  wiggle?: number; // 바뀔 때마다 살짝 흔들림 (눌러주길 기다림)
  attention?: number; // 바뀔 때마다 크게 튀며 흔들림 (아이가 딴 데를 볼 때 시선 끌기, 1초 안)
  voice?: number; // 0~1 아이 말소리 크기 → 1.0~1.3배
  success?: number; // 바뀔 때마다 크게 튀고 별이 퍼짐
  leave?: ToyLeave | null; // 값이 생기면 그만큼 굴러가서 바구니로 쏙
  onLeft?: () => void;
  interactive?: boolean;
  instant?: boolean; // 떨어지는 움직임·소리 없이 바로 보임 (따라 말하기 화면으로 넘어올 때 — 이미 떨어진 사물)
}) {
  const [presses, setPresses] = useState(0);
  const ty = useSharedValue(0);
  const tx = useSharedValue(0);
  const op = useSharedValue(0);
  const sq = useSharedValue(1); // 닿을 때 납작 (세로 비율)
  const press = useSharedValue(1); // 손가락 아래 눌림 (세로 비율)
  const pop = useSharedValue(1); // 성공 때 크게
  const vol = useSharedValue(1); // 말소리 크기
  const away = useSharedValue(1); // 바구니로 들어가며 작아짐
  const rot = useSharedValue(0);
  const apart = useSharedValue(0);
  const leftCb = useRef(onLeft);
  useEffect(() => {
    leftCb.current = onLeft;
  }, [onLeft]);

  // 등장: 위에서 떨어짐 → 납작하게 닿음 → 통, 통 (움직임 줄이기면 통 한 번)
  const dropped = useRef(false);
  useEffect(() => {
    if (!drop || dropped.current) return;
    dropped.current = true;
    if (instant) {
      op.set(1);
      return;
    }
    const h1 = size * 0.2;
    const h2 = size * 0.08;
    ty.set(-size * 1.7);
    op.set(withTiming(1, { duration: 120 }));
    const bounces = [withDelay(SQUASH, withTiming(-h1, { duration: 150, easing: out })), withTiming(0, { duration: 150, easing: inn })];
    if (!reduceMotion) bounces.push(withTiming(-h2, { duration: 100, easing: out }), withTiming(0, { duration: 100, easing: inn }));
    ty.set(withSequence(withTiming(0, { duration: FALL, easing: inn }), ...bounces));
    sq.set(withSequence(
      withDelay(FALL, withTiming(0.72, { duration: 40 })),
      withTiming(1, { duration: 70 }),
      withDelay(SQUASH + 300 - 110, withTiming(0.88, { duration: 40 })),
      withTiming(1, { duration: 60 }),
    ));
    // 통, 통 (닿을 때 · 첫 번째 튐이 내려올 때). 화면을 떠나도 소리만 짧게 남는 정도라 취소하지 않음
    setTimeout(() => playSfx('tong'), FALL);
    setTimeout(() => playSfx('tong'), FALL + SQUASH + 300);
  }, [drop, instant, reduceMotion, size, ty, op, sq]);

  // 기다림: 살짝 흔들림 (0.5초)
  useEffect(() => {
    if (!wiggle) return;
    const a = reduceMotion ? 5 : 8;
    rot.set(withSequence(
      withTiming(-a, { duration: 90 }),
      withTiming(a, { duration: 140 }),
      withTiming(-a * 0.6, { duration: 120 }),
      withTiming(a * 0.4, { duration: 100 }),
      withTiming(0, { duration: 90 }),
    ));
  }, [wiggle, reduceMotion, rot]);

  // 시선 끌기: 통 튀어 오르며 크게 흔들림 (움직임 줄이기면 작게 한 번)
  useEffect(() => {
    if (!attention) return;
    const a = reduceMotion ? 6 : 14;
    rot.set(withSequence(
      withTiming(-a, { duration: 110 }),
      withTiming(a, { duration: 170 }),
      withTiming(-a * 0.6, { duration: 140 }),
      withTiming(a * 0.3, { duration: 120 }),
      withTiming(0, { duration: 100 }),
    ));
    const h = size * (reduceMotion ? 0.08 : 0.22);
    const hops = [withTiming(-h, { duration: 200, easing: out }), withTiming(0, { duration: 200, easing: inn })];
    if (!reduceMotion) hops.push(withTiming(-h * 0.4, { duration: 140, easing: out }), withTiming(0, { duration: 140, easing: inn }));
    ty.set(withSequence(...hops));
    pop.set(withSequence(withTiming(reduceMotion ? 1.06 : 1.15, { duration: 200, easing: out }), withSpring(1, GENTLE)));
  }, [attention, reduceMotion, size, rot, ty, pop]);

  // 따라 말하기: 아이 말소리 크기에 맞춰 커졌다 작아짐
  useEffect(() => {
    vol.set(withTiming(1 + 0.3 * Math.max(0, Math.min(1, voice)), { duration: 110 }));
  }, [voice, vol]);

  // 성공: 크게 튐 (별은 아래 StarBurst)
  useEffect(() => {
    if (!success) return;
    const hops = [withTiming(-size * 0.38, { duration: 260, easing: out }), withTiming(0, { duration: 240, easing: inn })];
    if (!reduceMotion) hops.push(withTiming(-size * 0.1, { duration: 130, easing: out }), withTiming(0, { duration: 130, easing: inn }));
    ty.set(withSequence(...hops));
    pop.set(withSequence(withTiming(1.2, { duration: 260, easing: out }), withSpring(1, GENTLE)));
  }, [success, reduceMotion, size, ty, pop]);

  // 넘어감: 통통 굴러서 바구니로 쏙 (0.7초)
  useEffect(() => {
    if (!leave) return;
    const { dx, dy } = leave;
    tx.set(withTiming(dx, { duration: LEAVE, easing: Easing.inOut(Easing.quad) }));
    const hop = Math.min(size * 0.25, 60);
    ty.set(withSequence(
      withTiming(-hop, { duration: 160, easing: out }),
      withTiming(0, { duration: 160, easing: inn }),
      withTiming(dy, { duration: LEAVE - 320, easing: inn }),
    ));
    rot.set(withTiming(dx >= 0 ? 360 : -360, { duration: LEAVE, easing: Easing.inOut(Easing.quad) }));
    away.set(withTiming(0.28, { duration: LEAVE, easing: inn }));
    op.set(withDelay(LEAVE - 100, withTiming(0, { duration: 120 })));
    const a = setTimeout(() => playSfx('ssok'), LEAVE - 60);
    const b = setTimeout(() => leftCb.current?.(), LEAVE + 40);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [leave, size, tx, ty, rot, away, op]);

  const st = useAnimatedStyle(() => {
    const squashY = sq.value * press.value;
    const squashX = (1 + (1 - sq.value) * 0.8) * (1 + (1 - press.value) * 0.5);
    const k = pop.value * vol.value * away.value;
    return {
      opacity: op.value,
      transform: [
        { translateX: tx.value },
        // 납작해질 때 바닥에 붙어 있도록 아래로 보정
        { translateY: ty.value + (size * (1 - squashY)) / 2 },
        { rotate: `${rot.value}deg` },
        { scaleX: squashX * k },
        { scaleY: squashY * k },
      ],
    };
  });

  // 누름: 손가락 아래로 눌렸다가 (pressIn) 통 튀어 오름 (pressOut)
  const onIn = () => {
    press.set(withTiming(0.82, { duration: 70 }));
  };
  const onOut = () => {
    press.set(withSpring(1, { damping: 6, stiffness: 260, mass: 0.6 }));
  };
  const onTap = () => {
    setPresses((n) => n + 1);
    // 과자: 금이 먼저 간 뒤(0.1초) 반쪽이 벌어지고, 1.3초 뒤 다시 붙음
    if (id === 'snack') apart.set(withSequence(withDelay(110, withSpring(1, GENTLE)), withDelay(1300, withSpring(0, GENTLE))));
    onPress();
  };

  return (
    <View style={{ width: size, height: size }}>
      <StarBurst trigger={success} radius={size * 0.85} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="눌러봐"
        disabled={!interactive || !drop || !!leave}
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={onTap}
        hitSlop={24}>
        <Animated.View style={[{ width: size, height: size }, st]}>
          {id === 'snack' ? (
            <View style={{ flexDirection: 'row' }}>
              <Half id={id} size={size} side="left" apart={apart} />
              <Half id={id} size={size} side="right" apart={apart} />
            </View>
          ) : (
            <ItemArt id={id} size={size} />
          )}
          {id === 'apple' && <Bites count={Math.min(3, presses)} size={size} bg={bg} />}
          {id === 'banana' && [0, 1, 2].map((i) => <PeelStrip key={i} index={i} peeled={presses > i} size={size} />)}
          {id === 'snack' && (
            <>
              <Crack trigger={presses} size={size} />
              {CRUMBS.map((c, i) => (
                <Crumb key={i} trigger={presses} size={size} c={c} reduceMotion={reduceMotion} />
              ))}
            </>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}

/** 그림이 톡 튐. trigger 가 바뀔 때마다 한 번 (예전 3-4 화면용, 지금은 ItemToy success 로 대신) */
export function PopEmoji({ emoji, size, trigger }: { emoji: string; size: number; trigger: number }) {
  const y = useSharedValue(0);
  const s = useSharedValue(1);
  useEffect(() => {
    if (!trigger) return;
    y.set(withSequence(withTiming(-size * 0.22, { duration: 180 }), withSpring(0, { damping: 8, stiffness: 140 })));
    s.set(withSequence(withTiming(1.18, { duration: 180 }), withSpring(1, { damping: 8, stiffness: 140 })));
  }, [trigger, size, y, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scale: s.value }] }));
  return (
    <Animated.View style={st}>
      <Glyph emoji={emoji} size={size} />
    </Animated.View>
  );
}
