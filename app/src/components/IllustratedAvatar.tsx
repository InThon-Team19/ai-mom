import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { AvatarExpression, AvatarLook } from './Avatar';
import { PORTRAITS } from '@/lib/portraitAssets';
import { mouthCalibration, type PortraitId } from '@/lib/portraitConfig';
import { PARENT_FRAMES, type ParentFrame, type ParentFrameDriver } from '@/lib/parentFrames';

type Props = { id: PortraitId; driver?: ParentFrameDriver; pose?: ParentFrame; size?: number; scale?: number;
  close?: boolean; expression?: AvatarExpression; look?: AvatarLook; blink?: boolean; onReady?: () => void };

/** A set is remounted on appearance/calibration changes so stale load events cannot mark a new set ready. */
export function IllustratedAvatar(props: Props) {
  return <PortraitSet key={`${props.id}-${mouthCalibration(props.scale)}`} {...props} />;
}

function PortraitSet({ id, driver, pose, size = 160, scale = 1, close = false, expression = 'neutral', look = 'center', blink = true, onReady }: Props) {
  const set = PORTRAITS[id];
  const sources = set[mouthCalibration(scale)];
  const [opacity] = useState(() => Object.fromEntries(PARENT_FRAMES.map(f => [f, new Animated.Value(f === 'neutral' ? 1 : 0)])) as Record<ParentFrame, Animated.Value>);
  const [blinkOpacity] = useState(() => new Animated.Value(0));
  const loaded = useRef(new Set<ParentFrame>());
  const ready = useRef(false);
  const callback = useRef(onReady);
  useEffect(() => { callback.current = onReady; }, [onReady]);
  const [failed, setFailed] = useState(false);
  const show = useCallback((frame: ParentFrame) => {
    const resting = expression === 'surprise' ? 'open' : expression === 'wait' ? 'closed' : 'neutral';
    const visible = frame === 'neutral' ? resting : frame;
    PARENT_FRAMES.forEach(f => opacity[f].setValue(f === visible ? 1 : 0));
  }, [expression, opacity]);
  useEffect(() => {
    if (!driver) return;
    return driver.subscribe(frame => { if (ready.current) show(frame); });
  }, [driver, show]);
  useEffect(() => { if (ready.current) show(driver?.current ?? pose ?? 'neutral'); }, [driver, pose, expression, show]);
  useEffect(() => {
    if (!blink) return;
    let opening: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      blinkOpacity.setValue(1);
      opening = setTimeout(() => blinkOpacity.setValue(0), 125);
    }, 4100);
    return () => { clearInterval(interval); clearTimeout(opening); blinkOpacity.setValue(0); };
  }, [blink, blinkOpacity]);
  const zoom = close ? 3 : 1;
  const height = close ? size * .75 : size * 1.1;
  const placement = { width: size * zoom, height: size * zoom,
    left: close ? size / 2 - set.anchor[0] * size * zoom : 0,
    top: close ? height / 2 - set.anchor[1] * size * zoom : size * .05 };
  return <View accessibilityLabel={id.startsWith('father') ? '아빠 일러스트 아바타' : '엄마 일러스트 아바타'} style={{ width: size, height, overflow: 'hidden' }}>
    <View style={[{ position: 'absolute' }, placement]}>
      {PARENT_FRAMES.map(frame => <Animated.View key={frame} pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: opacity[frame] }]}>
        <Image source={sources[frame]} style={StyleSheet.absoluteFill} contentFit="contain" transition={0} cachePolicy="memory" onLoad={() => {
          loaded.current.add(frame);
          if (!ready.current && loaded.current.size === PARENT_FRAMES.length) {
            ready.current = true; show(driver?.current ?? pose ?? 'neutral'); callback.current?.();
          }
        }} onError={() => setFailed(true)} />
      </Animated.View>)}
      {look === 'right' && <Image pointerEvents="none" source={set.right} style={StyleSheet.absoluteFill} contentFit="contain" transition={0} />}
      {blink && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: blinkOpacity }]}>
        <Image source={set.blink} style={StyleSheet.absoluteFill} contentFit="contain" transition={0} />
      </Animated.View>}
    </View>
    {failed && <Text accessibilityRole="alert">아바타 이미지를 불러오지 못했어요.</Text>}
  </View>;
}
