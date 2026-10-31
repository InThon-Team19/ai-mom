// 아이 태블릿 3-x 내비게이션 (가로 화면, 아이 배경색) — 담당: 태희 (민철 와이어프레임 기준)
import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useEffect } from 'react';

import { HapticShake } from '@/components/HapticShake';
import { setAuthLostHandler } from '@/lib/session';
import { useProfile } from '@/lib/store';

import { K } from '@/components/child/design';

export default function ChildLayout() {
  const reduceMotion = !!useProfile()?.settings?.reduceMotion;
  // 놀이 중 토큰이 끊기면(부모가 새 연결 코드를 받음 등) 아이 홈으로 → 홈이 확인 후 연결 화면을 보여 줌
  useEffect(() => {
    setAuthLostHandler(() => router.replace('/child'));
    return () => setAuthLostHandler(null);
  }, []);
  // 진동과 함께 아이 화면 전체를 아주 살짝 흔듦 (진동이 안 되는 기기에서도 촉각 신호를 눈으로). 움직임 줄이기면 끔
  return (
    <HapticShake disabled={reduceMotion}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: K.bg }, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="session" />
      <Stack.Screen name="play" />
      <Stack.Screen name="story" />
      <Stack.Screen name="audio" options={{ contentStyle: { backgroundColor: K.night } }} />
      <Stack.Screen name="chat" />
      <Stack.Screen name="end" />
    </Stack>
    </HapticShake>
  );
}
