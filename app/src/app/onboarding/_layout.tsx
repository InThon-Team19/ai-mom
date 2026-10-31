// 온보딩 1-1~1-7 내비게이션 — 담당: 태희 (민철 와이어프레임 기준)
import { Stack } from 'expo-router/stack';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }} />;
}
