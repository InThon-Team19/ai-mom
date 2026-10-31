// 전체 내비게이션 — 담당: 태희. 화면 구조는 docs/wireframe.md (온보딩 7 · 부모 앱 탭 4 · 아이 태블릿 8)
import { Stack } from 'expo-router/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
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
