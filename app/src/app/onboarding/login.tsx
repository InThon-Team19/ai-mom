// 부모 로그인 — 담당: 태희
// 이미 가입한 가족: 새 폰·앱 재설치·아이 태블릿에서 부모 모드로 바꿀 때 아이디·비밀번호로 같은 가족 정보를 불러옴
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, H1, fieldStyle } from '@/components/ui';
import { authMessage, login, resumeStep } from '@/lib/account';
import { registerThisDevice } from '@/lib/device';
import { setRole } from '@/lib/store';
import { C, T } from '@/theme';
import { useDevice } from '@/lib/layout';
import { goBack } from '@/lib/nav';

const input = fieldStyle;

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
      const p = await login(id, pw);
      await setRole('parent');
      registerThisDevice(p.childId, 'parent');
      // 서버에서 가입을 마쳤으면 부모 앱, 아니면 멈춘 단계부터 (PIN·동의를 건너뛰지 않게)
      router.replace(resumeStep(p) as Href);
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* 키보드가 올라오면 아래 버튼이 가려지지 않게 스크롤 (iOS 는 padding, Android 는 창이 줄어듦) */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: 16, paddingBottom: 24, paddingHorizontal: gutter, gap: 18 }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => goBack('/' as Href)} hitSlop={8} accessibilityLabel="뒤로" style={{ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 28, color: C.text }}>‹</Text>
      </Pressable>
      <View style={{ gap: 6 }}>
        <H1>로그인</H1>
        <Text style={{ fontSize: 15, lineHeight: 24, color: C.sub }}>가입할 때 만든 부모 계정으로 로그인하면 우리 아이 정보와 학습 기록을 그대로 불러와요.</Text>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={T.small}>아이디</Text>
        <TextInput value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false} placeholder="예: jihomom" placeholderTextColor={C.sub} style={input} />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={T.small}>비밀번호</Text>
        <TextInput value={pw} onChangeText={setPw} secureTextEntry placeholder="비밀번호" placeholderTextColor={C.sub} onSubmitEditing={() => !busy && id.trim().length >= 3 && pw.length > 0 && submit()} style={input} />
      </View>
      {!!error && <Text style={{ color: C.warn, fontSize: 13 }}>{error}</Text>}
      <View style={{ flex: 1 }} />
      <Button label={busy ? '로그인 중…' : '로그인'} disabled={busy || id.trim().length < 3 || pw.length < 1} onPress={submit} />
      <Button label="처음이에요 · 가입하기" variant="ghost" onPress={() => router.replace('/onboarding/start')} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
