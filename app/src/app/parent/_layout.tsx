// 부모 앱 2-x 하단 탭 5개 (홈 · 리포트 · 피드백 · 내일 계획 · 설정) — 담당: 태희 (민철 와이어프레임 기준)
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { registerThisDevice } from '@/lib/device';
import { loadProfile } from '@/lib/store';
import { C } from '@/theme';

type IconProps = { color: ColorValue; size: number };
const stroke = (color: ColorValue) => ({ stroke: color as string, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' });

const HomeIcon = ({ color, size }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" {...stroke(color)} />
  </Svg>
);
const ReportIcon = ({ color, size }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 20v-7M12 20V5M18 20v-10" {...stroke(color)} />
  </Svg>
);
const PenIcon = ({ color, size }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 20l1-4L16 5l3 3L8 19z M14 7l3 3" {...stroke(color)} />
  </Svg>
);
const PlanIcon = ({ color, size }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x={4} y={4} width={16} height={16} rx={2} {...stroke(color)} />
    <Path d="M8 9h8M8 13h8M8 17h5" {...stroke(color)} />
  </Svg>
);

const GearIcon = ({ color, size }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={3} {...stroke(color)} />
    <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" {...stroke(color)} />
  </Svg>
);

export default function ParentTabs() {
  // 이 기기를 부모 폰으로 등록 (모드를 바꿨다 돌아온 경우·이전에 가입한 기기 포함)
  useEffect(() => {
    loadProfile().then((p) => {
      if (p.onboarded) registerThisDevice(p.childId, 'parent');
    });
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.text,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        sceneStyle: { backgroundColor: C.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: '홈', tabBarIcon: (p) => <HomeIcon color={p.color} size={22} /> }} />
      <Tabs.Screen name="report" options={{ title: '리포트', tabBarIcon: (p) => <ReportIcon color={p.color} size={22} /> }} />
      <Tabs.Screen name="feedback" options={{ title: '피드백', tabBarIcon: (p) => <PenIcon color={p.color} size={22} /> }} />
      <Tabs.Screen name="plan" options={{ title: '내일 계획', tabBarIcon: (p) => <PlanIcon color={p.color} size={22} /> }} />
      <Tabs.Screen name="settings" options={{ title: '설정', tabBarIcon: (p) => <GearIcon color={p.color} size={22} /> }} />
    </Tabs>
  );
}
