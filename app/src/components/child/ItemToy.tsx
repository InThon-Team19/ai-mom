// 아이 태블릿 3-2 · 3-3 · 3-5 누르는 사물 (툭 떨어져 등장, 누르면 사물마다 다른 반응) — 담당: 태희 (민철 와이어프레임 기준)
// 기획 1-1 "아바타가 단어를 말할 때의 연출": 사과 = 베어 문 자국 / 바나나 = 껍질이 한 줄씩 / 과자 = 둘로 부러짐
// 감각 자극 제한: 깜빡임 없음, 움직임은 0.1~0.6초 부드럽게
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
  type SharedValue,
} from 'react-native-reanimated';

import type { ItemId } from '@/content/curriculum';

const GENTLE = { damping: 14, stiffness: 120 };

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
      op.value = withTiming(1, { duration: 120 });
      rot.value = withTiming(angle, { duration: 600 });
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
function Half({ emoji, size, side, apart }: { emoji: string; size: number; side: 'left' | 'right'; apart: SharedValue<number> }) {
  const sign = side === 'left' ? -1 : 1;
  const st = useAnimatedStyle(() => ({
    transform: [{ translateX: sign * apart.value * size * 0.14 }, { rotate: `${sign * apart.value * 14}deg` }],
  }));
  return (
    <Animated.View style={[{ width: size / 2, height: size, overflow: 'hidden' }, st]}>
      <View style={{ position: 'absolute', left: side === 'left' ? 0 : -size / 2 }}>
        <Glyph emoji={emoji} size={size} />
      </View>
    </Animated.View>
  );
}

export function ItemToy({ id, emoji, size, bg, onPress }: { id: ItemId; emoji: string; size: number; bg: string; onPress: () => void }) {
  const [presses, setPresses] = useState(0);
  const drop = useSharedValue(-size * 1.4);
  const fade = useSharedValue(0);
  const scale = useSharedValue(1);
  const apart = useSharedValue(0);

  // 등장: 위에서 툭 떨어짐
  useEffect(() => {
    drop.value = withDelay(350, withSpring(0, GENTLE));
    fade.value = withDelay(350, withTiming(1, { duration: 250 }));
  }, [drop, fade]);

  const st = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateY: drop.value }, { scale: scale.value }] }));

  const press = () => {
    setPresses((n) => n + 1);
    scale.set(withSequence(withTiming(0.92, { duration: 90 }), withSpring(1, GENTLE)));
    if (id === 'snack') apart.set(withSequence(withSpring(1, GENTLE), withDelay(1300, withSpring(0, GENTLE))));
    onPress();
  };

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="눌러봐" onPress={press} hitSlop={20}>
      <Animated.View style={[{ width: size, height: size }, st]}>
        {id === 'snack' ? (
          <View style={{ flexDirection: 'row' }}>
            <Half emoji={emoji} size={size} side="left" apart={apart} />
            <Half emoji={emoji} size={size} side="right" apart={apart} />
          </View>
        ) : (
          <Glyph emoji={emoji} size={size} />
        )}
        {id === 'apple' && <Bites count={Math.min(3, presses)} size={size} bg={bg} />}
        {id === 'banana' && [0, 1, 2].map((i) => <PeelStrip key={i} index={i} peeled={presses > i} size={size} />)}
      </Animated.View>
    </Pressable>
  );
}

/** 3-4 따라 말하기 성공(또는 시도) 때 그림이 톡 튐. trigger 가 바뀔 때마다 한 번 */
export function PopEmoji({ emoji, size, trigger }: { emoji: string; size: number; trigger: number }) {
  const y = useSharedValue(0);
  const s = useSharedValue(1);
  useEffect(() => {
    if (!trigger) return;
    y.value = withSequence(withTiming(-size * 0.22, { duration: 180 }), withSpring(0, { damping: 8, stiffness: 140 }));
    s.value = withSequence(withTiming(1.18, { duration: 180 }), withSpring(1, { damping: 8, stiffness: 140 }));
  }, [trigger, size, y, s]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scale: s.value }] }));
  return (
    <Animated.View style={st}>
      <Glyph emoji={emoji} size={size} />
    </Animated.View>
  );
}
