// 아이 학습 화면 무대 조각 (기획 2-3): 고개 끄덕이는 아바타 틀 · 작은 별 퍼짐 · 오늘 모은 사물 바구니 — 담당: 태희
// 감각 자극 제한: 움직임 한 번은 1초 안, 깜빡임 없음 (별은 한 번 퍼지며 천천히 사라짐)
import { useEffect, type ReactNode, type Ref } from 'react';
import { View, type HostInstance } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { ItemArt, K } from '@/components/child/design';
import type { ItemId } from '@/content/curriculum';
import { Text } from '@/components/AppText';

/** 아바타가 단어를 말할 때 고개를 끄덕임. nod 가 바뀔 때마다 두 번 (움직임 줄이기면 한 번) */
export function NodBox({ nod, reduceMotion, children }: { nod: number; reduceMotion?: boolean; children: ReactNode }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (!nod) return;
    const down = withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) });
    const up = withTiming(0, { duration: 170, easing: Easing.inOut(Easing.quad) });
    v.value = reduceMotion ? withSequence(down, up) : withSequence(down, up, withTiming(0.6, { duration: 130 }), withTiming(0, { duration: 150 }));
  }, [nod, reduceMotion, v]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: v.value * 10 }, { rotate: `${v.value * 3}deg` }] }));
  return <Animated.View style={[{ transformOrigin: 'bottom' }, st]}>{children}</Animated.View>;
}

// ---------- 성공 때 작은 별이 퍼짐 ----------
const STAR_COLORS = [K.star, K.red, K.green];

function StarShape({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5 L14.6 8.6 L21.2 9.2 L16.2 13.6 L17.7 20.1 L12 16.7 L6.3 20.1 L7.8 13.6 L2.8 9.2 L9.4 8.6 Z" fill={color} strokeLinejoin="round" />
    </Svg>
  );
}

function Star({ p, angle, dist, size, color }: { p: SharedValue<number>; angle: number; dist: number; size: number; color: string }) {
  const st = useAnimatedStyle(() => {
    const k = p.value;
    return {
      opacity: k <= 0 ? 0 : k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85,
      transform: [{ translateX: Math.cos(angle) * dist * k }, { translateY: Math.sin(angle) * dist * k }, { scale: 0.5 + 0.6 * k }, { rotate: `${k * 90}deg` }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -size / 2, top: -size / 2 }, st]}>
      <StarShape size={size} color={color} />
    </Animated.View>
  );
}

/** trigger 가 바뀔 때마다 가운데서 별 7개가 한 번 퍼짐 (0.8초). 부모 View 가운데에 놓임 */
export function StarBurst({ trigger, radius }: { trigger: number; radius: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!trigger) return;
    p.value = 0;
    p.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [trigger, p]);
  const n = 7;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '45%', width: 0, height: 0 }}>
      {Array.from({ length: n }, (_, i) => (
        <Star key={i} p={p} angle={(i / n) * Math.PI * 2 - Math.PI / 2} dist={radius * (i % 2 ? 0.8 : 1)} size={i % 2 ? 22 : 30} color={STAR_COLORS[i % 3]} />
      ))}
    </View>
  );
}

// ---------- 오늘 모은 사물 바구니 (글자 없이 그림만) ----------
export function BasketIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M12 20 Q24 2 36 20" stroke="#B9814A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Path d="M5 19 H43 L38.5 41 Q38 43 36 43 H12 Q10 43 9.5 41 Z" fill="#E3A765" />
      <Path d="M7.5 27 H40.5 M9 34 H39 M17 20 L18.5 43 M24 20 V43 M31 20 L29.5 43" stroke="#B9814A" strokeWidth="2" />
    </Svg>
  );
}

/**
 * 바구니 (보드 KidPlay 아래 줄): 점선 테두리 알약 + "바구니" + 모은 사물 그림. 새로 들어온 것은 톡 커지며 나타남.
 * nextRef 는 다음 사물이 들어갈 빈 자리 — 굴러가는 사물의 도착점으로 씀
 */
export function Basket({ items, height = 80, label = '바구니', fontSize = 20, nextRef }: { items: ItemId[]; height?: number; label?: string; fontSize?: number; nextRef?: Ref<HostInstance> }) {
  const slot = height * 0.5;
  return (
    <View
      accessibilityLabel="오늘 모은 바구니"
      style={{
        flex: 1,
        height,
        flexDirection: 'row',
        alignItems: 'center',
        gap: height * 0.17,
        paddingHorizontal: height * 0.35,
        backgroundColor: K.basket,
        borderRadius: height / 2,
        borderWidth: 3,
        borderStyle: 'dashed',
        borderColor: K.line,
        overflow: 'hidden',
      }}>
      <Text style={{ fontSize, fontWeight: '800', color: K.ink }}>{label}</Text>
      {items.map((id, i) => (
        <Animated.View key={i} entering={ZoomIn.duration(260)} style={{ width: slot, height: slot, alignItems: 'center', justifyContent: 'center' }}>
          <ItemArt id={id} size={slot} />
        </Animated.View>
      ))}
      <View ref={nextRef} collapsable={false} style={{ width: slot, height: slot }} />
    </View>
  );
}
