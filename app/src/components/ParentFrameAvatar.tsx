import { Image } from 'expo-image';
import { memo, useEffect, useRef, useState, type ComponentProps } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { Avatar } from './Avatar';
import type { MouthPose } from '@/lib/lipsync';
import { PARENT_FRAMES, type ParentFrame, type ParentFrameDriver } from '@/lib/parentFrames';

const sources = {
  neutral: require('../../assets/parent-2d/neutral.png'),
  closed: require('../../assets/parent-2d/closed.png'),
  open: require('../../assets/parent-2d/open.png'),
  wide: require('../../assets/parent-2d/wide.png'),
  round: require('../../assets/parent-2d/round.png'),
  narrow: require('../../assets/parent-2d/narrow.png'),
};

/** Six finished portraits. No mouth layers, crossfade, or per-tick React state.
 * Legacy appearance props remain accepted for existing screens, but this demo uses
 * the single approved parent artwork (no config/expression/look/scale variations).
 */
export const ParentFrameAvatar = memo(function ParentFrameAvatar({
  driver, size = 240, onReady,
}: ComponentProps<typeof Avatar> & { driver: ParentFrameDriver; mouthPose?: MouthPose; onReady?: () => void }) {
  const opacity = useRef(Object.fromEntries(PARENT_FRAMES.map((name) => [name, new Animated.Value(0)])) as Record<ParentFrame, Animated.Value>).current;
  const loaded = useRef(new Set<ParentFrame>());
  const ready = useRef(false);
  const [error, setError] = useState(false);
  const display = (frame: ParentFrame) => {
    // All values change in one JS turn, with no interpolation or double lips.
    PARENT_FRAMES.forEach((name) => opacity[name].setValue(name === frame ? 1 : 0));
  };
  useEffect(() => driver.subscribe((frame) => {
    if (ready.current) PARENT_FRAMES.forEach((name) => opacity[name].setValue(name === frame ? 1 : 0));
  }), [driver, opacity]);
  return (
    <View accessibilityLabel="부모 아바타" style={{ width: size, height: size * 1.1 }}>
      {PARENT_FRAMES.map((name) => (
        <Animated.View key={name} pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: opacity[name] }]}>
          <Image source={sources[name]} style={StyleSheet.absoluteFill} contentFit="contain" transition={0} cachePolicy="memory" onLoad={() => {
            loaded.current.add(name);
            if (!ready.current && loaded.current.size === PARENT_FRAMES.length) {
              ready.current = true;
              display(driver.current);
              onReady?.();
            }
          }} onError={() => setError(true)} />
        </Animated.View>
      ))}
      {error && <Text>아바타 이미지를 불러오지 못했어요.</Text>}
    </View>
  );
});
