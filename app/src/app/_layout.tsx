import { Stack } from 'expo-router/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="child/index" options={{ headerShown: false }} />
        <Stack.Screen name="child/talk" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
