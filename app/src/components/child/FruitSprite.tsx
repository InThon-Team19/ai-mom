import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

const FRUIT = {
  apple: { source: require('../../../assets/images/fruit/apple.png'), columns: 4, rows: 1, steps: 1 },
  banana: { source: require('../../../assets/images/fruit/banana.png'), columns: 5, rows: 5, steps: 8 },
};

/** Bundled transparent 3D renders: no network or live GPU scene required. */
export function FruitSprite({ id, size, presses, reduceMotion }: {
  id: keyof typeof FRUIT;
  size: number;
  presses: number;
  reduceMotion?: boolean;
}) {
  const fruit = FRUIT[id];
  const target = Math.min(3, presses) * fruit.steps;
  const [frame, setFrame] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (reduceMotion || id === 'apple') {
      current.current = target;
      const timer = setTimeout(() => setFrame(target), 0);
      return () => clearTimeout(timer);
    }
    if (current.current === target) return;
    // Continue toward the newest target even when a child taps repeatedly.
    const timer = setInterval(() => {
      current.current += Math.sign(target - current.current);
      setFrame(current.current);
      if (current.current === target) clearInterval(timer);
    }, 65);
    return () => clearInterval(timer);
  }, [id, target, reduceMotion]);

  const visibleFrame = reduceMotion || id === 'apple' ? target : frame;

  return (
    <View pointerEvents="none" style={{ width: size, height: size, overflow: 'hidden' }}>
      <Image
        source={fruit.source}
        accessible={false}
        contentFit="fill"
        transition={0}
        style={{
          width: size * fruit.columns,
          height: size * fruit.rows,
          transform: [
            { translateX: -(visibleFrame % fruit.columns) * size },
            { translateY: -Math.floor(visibleFrame / fruit.columns) * size },
          ],
        }}
      />
    </View>
  );
}
