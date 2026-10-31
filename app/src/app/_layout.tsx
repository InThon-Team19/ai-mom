// 전체 내비게이션 — 담당: 태희. 화면 구조는 docs/wireframe.md (온보딩 7 · 부모 앱 탭 4 · 아이 태블릿 8)
import { Stack } from 'expo-router/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="parent" />
        <Stack.Screen name="child" options={{ orientation: 'landscape' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
