// 전체 내비게이션 — 담당: 태희. 화면 구조는 docs/wireframe.md (온보딩 7 · 부모 앱 탭 4 · 아이 태블릿 8)
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FONT_FILES } from '@/components/AppText';
import { installWebAudioUnlock } from '@/lib/webAudio';

installWebAudioUnlock(); // 웹만: 첫 터치에서 기기 음성 깨우기 (폰 앱은 아무것도 안 함)

export default function RootLayout() {
  // UI 글꼴을 다 불러온 뒤 화면을 그림 (못 불러오면 기본 글꼴로 그냥 진행)
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  if (!fontsLoaded && !fontError) return null;
  // 손 놀이(쓸어내기·끌어서 옮기기)의 제스처가 동작하려면 앱 맨 바깥에 GestureHandlerRootView 가 있어야 함
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="parent" />
          <Stack.Screen name="child" options={{ orientation: 'landscape' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
