// 가입 첫 단계: 부모 계정 만들기 (기획서 v2 2-6 "아이디를 만들어 로그인한 뒤" 아바타·녹음) — 담당: 태희
// 서버(민주)는 모든 저장 API 에 로그인 토큰을 요구하므로, 목소리·입모양 녹음(1-5·1-6) 전에 계정을 먼저 만든다
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, H1, Sub } from '@/components/ui';
import { signup } from '@/lib/account';
import { loadProfile } from '@/lib/store';
import { C, R, T } from '@/theme';
import { useDevice } from '@/lib/layout';

const input = { fontSize: 17, borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 14, paddingVertical: 14, color: C.text } as const;

export default function Account() {
  const { gutter } = useDevice();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ok = /^\S{3,60}$/.test(id.trim()) && pw.length >= 8 && pw === pw2;

  const submit = async () => {
    setBusy(true);
    setError('');
    const p = await loadProfile();
    const r = await signup(id, pw, p.childId);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    router.replace('/onboarding/child');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, paddingVertical: 24, paddingHorizontal: gutter, gap: 16 }}>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="뒤로">
        <Text style={{ fontSize: 28, color: C.text }}>‹</Text>
      </Pressable>
      <View style={{ gap: 6 }}>
        <H1>아이디 만들기</H1>
        <Sub>우리 아이 정보와 엄마 목소리를 안전하게 저장해요. 다른 폰에서도 이 아이디로 로그인하면 그대로 불러와요.</Sub>
      </View>
      <View style={{ gap: 6 }}>
        <Text style={T.small}>아이디</Text>
        <TextInput value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false} placeholder="예: jihomom" placeholderTextColor={C.muted} style={input} />
      </View>
      <View style={{ gap: 6 }}>
        <Text style={T.small}>비밀번호 (8자 이상)</Text>
        <TextInput value={pw} onChangeText={setPw} secureTextEntry placeholder="비밀번호" placeholderTextColor={C.muted} style={input} />
        <TextInput value={pw2} onChangeText={setPw2} secureTextEntry placeholder="비밀번호 확인" placeholderTextColor={C.muted} onSubmitEditing={() => ok && submit()} style={input} />
        {pw2.length > 0 && pw !== pw2 && <Text style={{ color: C.warn }}>비밀번호가 서로 달라요.</Text>}
      </View>
      {!!error && <Text style={{ color: C.warn, fontSize: 15 }}>{error}</Text>}
      <View style={{ flex: 1 }} />
      <Button label={busy ? '만드는 중…' : '아이디 만들고 시작하기'} disabled={busy || !ok} onPress={submit} />
      <Button label="이미 아이디가 있어요 · 로그인" variant="ghost" onPress={() => router.replace('/onboarding/login' as Href)} />
    </SafeAreaView>
  );
}
