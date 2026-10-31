// 부모 로그인 — 담당: 태희
// 이미 가입한 가족: 새 폰·앱 재설치·아이 태블릿에서 부모 모드로 바꿀 때 아이디·비밀번호로 같은 가족 정보를 불러옴
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, H1, Sub } from '@/components/ui';
import { authMessage, login } from '@/lib/account';
import { registerThisDevice } from '@/lib/device';
import { loadProfile, setRole } from '@/lib/store';
import { C, R, T } from '@/theme';
import { useDevice } from '@/lib/layout';
import { goBack } from '@/lib/nav';

const input = {
  fontSize: 17,
  borderWidth: 1,
  borderColor: C.border,
  borderRadius: R.sm,
  paddingHorizontal: 14,
  paddingVertical: 14,
  color: C.text,
} as const;

export default function Login() {
  const { gutter } = useDevice();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await login(id, pw);
      await setRole('parent');
      const p = await loadProfile();
      registerThisDevice(p.childId, 'parent');
      router.replace('/parent');
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, paddingVertical: 24, paddingHorizontal: gutter, gap: 16 }}>
      <Pressable onPress={() => goBack('/' as Href)} hitSlop={12} accessibilityLabel="뒤로">
        <Text style={{ fontSize: 28, color: C.text }}>‹</Text>
      </Pressable>
      <View style={{ gap: 6 }}>
        <H1>로그인</H1>
        <Sub>가입할 때 만든 부모 계정으로 로그인하면 우리 아이 정보와 학습 기록을 그대로 불러와요.</Sub>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={T.small}>아이디</Text>
        <TextInput value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false} placeholder="예: jihomom" placeholderTextColor={C.muted} style={input} />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={T.small}>비밀번호</Text>
        <TextInput value={pw} onChangeText={setPw} secureTextEntry placeholder="비밀번호" placeholderTextColor={C.muted} onSubmitEditing={() => !busy && id.trim().length >= 3 && pw.length > 0 && submit()} style={input} />
      </View>
      {!!error && <Text style={{ color: C.warn, fontSize: 15 }}>{error}</Text>}
      <View style={{ flex: 1 }} />
      <Button label={busy ? '로그인 중…' : '로그인'} disabled={busy || id.trim().length < 3 || pw.length < 1} onPress={submit} />
      <Button label="처음이에요 · 가입하기" variant="ghost" onPress={() => router.replace('/onboarding/start')} />
    </SafeAreaView>
  );
}
