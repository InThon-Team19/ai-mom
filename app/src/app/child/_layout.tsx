// 아이 태블릿 3-x 내비게이션 (가로 화면, 아이 배경색) — 담당: 태희 (민철 와이어프레임 기준)
import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useEffect } from 'react';

import { setAuthLostHandler } from '@/lib/session';

import { C } from '@/theme';

export default function ChildLayout() {
  // 놀이 중 토큰이 끊기면(부모가 새 연결 코드를 받음 등) 아이 홈으로 → 홈이 확인 후 연결 화면을 보여 줌
  useEffect(() => {
    setAuthLostHandler(() => router.replace('/child'));
    return () => setAuthLostHandler(null);
  }, []);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.primarySoft }, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="session" />
      <Stack.Screen name="play" />
      <Stack.Screen name="story" />
      <Stack.Screen name="audio" options={{ contentStyle: { backgroundColor: '#21242B' } }} />
      <Stack.Screen name="end" />
    </Stack>
  );
}
