// 원형 학습률 게이지 + 최소 기준 눈금 (와이어프레임 1-5, 1-6, 2-1, 2-4). 담당: 태희
import { View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { C } from '@/theme';
import { Text } from '@/components/AppText';

export function RingGauge({
  progress,
  baseline = 0.5,
  size = 120,
  stroke = 12,
  label,
  showBaselineText = true,
  color = C.primary,
  showTick = true,
  fontScale = 0.2,
}: {
  progress: number; // 0~1
  baseline?: number; // 최소 기준 위치 0~1
  size?: number;
  stroke?: number;
  label?: string;
  showBaselineText?: boolean;
  color?: string; // 채움 색 (기본 노랑)
  showTick?: boolean; // 최소 기준 눈금 (디자인: 작은 링은 눈금 없음)
  fontScale?: number; // 가운데 % 글자 크기 비율 (디자인: 작은 링일수록 큼)
}) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const len = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  // 기준 눈금: 12시 방향에서 시계방향 baseline 만큼
  const a = baseline * 2 * Math.PI - Math.PI / 2;
  const tick = (d: number) => ({ x: cx + Math.cos(a) * d, y: cx + Math.sin(a) * d });
  const t1 = tick(r - stroke * 0.9);
  const t2 = tick(r + stroke * 0.9);
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cx} r={r} stroke={C.track} strokeWidth={stroke} fill="none" />
          <Circle
            cx={cx}
            cy={cx}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${len * p} ${len}`}
            transform={`rotate(-90 ${cx} ${cx})`}
          />
          {showTick && <Line x1={t1.x} y1={t1.y} x2={t2.x} y2={t2.y} stroke={C.text} strokeWidth={3} strokeLinecap="round" />}
        </Svg>
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: size * fontScale, fontWeight: '800', color: C.text }}>{Math.round(p * 100)}%</Text>
        </View>
      </View>
      {!!label && <Text style={{ fontSize: 14, color: C.text }}>{label}</Text>}
      {showBaselineText && showTick && !label && <Text style={{ fontSize: 11, color: C.sub }}>최소 기준</Text>}
    </View>
  );
}
