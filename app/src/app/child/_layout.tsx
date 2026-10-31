// 아이 태블릿 3-x 내비게이션 (가로 화면, 아이 배경색) — 담당: 태희 (민철 와이어프레임 기준)
import { Stack } from 'expo-router/stack';

import { C } from '@/theme';

export default function ChildLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.primarySoft }, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="session" />
      <Stack.Screen name="story" />
      <Stack.Screen name="audio" options={{ contentStyle: { backgroundColor: '#21242B' } }} />
      <Stack.Screen name="end" />
    </Stack>
  );
}
