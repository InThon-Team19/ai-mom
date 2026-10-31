// 진동과 함께 화면을 아주 살짝 흔듦 — 진동이 안 되는 기기(태블릿 등)에서도 촉각 신호를 눈으로 받게. 담당: 태희
// 감각 자극 제한: 좌우 몇 px, 0.2초 안에 끝남, 깜빡임 없음. 움직임 줄이기·과부하·진동 끄기면 흔들지 않음
import { useEffect, type ReactNode } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { onHapticShake, type HapticKind } from '@/lib/sense';

const AMP: Record<HapticKind, number> = { tick: 1.5, soft: 2, tap: 3, praise: 4, strong: 6 };

export function HapticShake({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  const x = useSharedValue(0);

  useEffect(
    () =>
      onHapticShake((kind) => {
        if (disabled) return;
        const a = AMP[kind] ?? 3;
        x.set(
          withSequence(
            withTiming(a, { duration: 40 }),
            withTiming(-a, { duration: 60 }),
            withTiming(a * 0.5, { duration: 50 }),
            withTiming(0, { duration: 50 }),
          ),
        );
      }),
    [disabled, x],
  );

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <Animated.View style={[{ flex: 1 }, style]}>{children}</Animated.View>;
}
