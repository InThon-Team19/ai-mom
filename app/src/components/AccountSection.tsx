// 설정 탭 "로그인" 구역: 로그인 상태·계정 만들기·비밀번호 변경·로그아웃. 담당: 태희 (서버 /auth/* 는 민주)
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui';
import { authMessage, changePassword, logoutAccount, signup, useAccount } from '@/lib/account';
import { clearRole, resetLocal } from '@/lib/store';
import { C, R, T } from '@/theme';

const inputStyle = { fontSize: 16, borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 10, color: C.text } as const;

function ask(title: string, msg: string, ok: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n${msg}`)) onOk();
    return;
  }
  Alert.alert(title, msg, [
    { text: '취소', style: 'cancel' },
    { text: ok, style: 'destructive', onPress: onOk },
  ]);
}

export function AccountSection({ childId }: { childId: string }) {
  const account = useAccount();
  const [mode, setMode] = useState<'none' | 'create' | 'password'>('none');
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setMode('none');
    setPw('');
    setPw2('');
    setMsg('');
  };

  const create = async () => {
    setBusy(true);
    const r = await signup(id || account?.loginId || '', pw, childId);
    setBusy(false);
    if (!r.ok) return setMsg(r.message);
    if (r.pending) return setMsg('아이디를 기기에 저장했어요. 로그인 서버가 준비되면 "다시 등록"을 눌러 주세요.');
    reset();
  };

  const change = async () => {
    if (!account) return;
    setBusy(true);
    try {
      await changePassword(account.loginId, pw, pw2);
      reset();
      setMsg('비밀번호를 바꿨어요. 다른 기기는 다시 로그인해야 해요.');
    } catch (e) {
      setMsg(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const logout = () =>
    ask('로그아웃할까요?', '이 기기의 가입 정보가 지워지고 로그인 화면으로 가요. (서버의 우리 아이 기록은 남아요)', '로그아웃', async () => {
      await logoutAccount();
      await resetLocal();
      await clearRole();
      router.replace('/onboarding/login' as Href);
    });

  return (
    <View style={{ gap: 10 }}>
      {account ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={[T.small, { width: 76 }]}>로그인 아이디</Text>
            <Text style={{ flex: 1, fontSize: 15, color: C.text }}>
              {account.loginId}
              {account.pending && <Text style={{ color: C.warn }}> (서버 등록 전)</Text>}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {account.pending ? (
              <Button label="다시 등록" variant="outline" style={{ minHeight: 42 }} onPress={() => setMode('create')} />
            ) : (
              <Button label="비밀번호 변경" variant="outline" style={{ minHeight: 42 }} onPress={() => setMode('password')} />
            )}
            <Button label="로그아웃" variant="ghost" style={{ minHeight: 42 }} onPress={logout} />
          </View>
        </>
      ) : (
        <>
          <Text style={T.small}>아직 로그인하지 않았어요. 계정을 만들면 다른 폰에서도 우리 아이 정보를 불러올 수 있어요.</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button label="계정 만들기" variant="outline" style={{ minHeight: 42 }} onPress={() => setMode('create')} />
            <Button label="다른 계정으로 로그인" variant="ghost" style={{ minHeight: 42 }} onPress={() => router.push('/onboarding/login' as Href)} />
          </View>
        </>
      )}

      {mode === 'create' && (
        <View style={{ gap: 8 }}>
          {!account?.pending && <TextInput value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false} placeholder="아이디 (영문·숫자 3자 이상)" placeholderTextColor={C.muted} style={inputStyle} />}
          <TextInput value={pw} onChangeText={setPw} secureTextEntry placeholder="비밀번호 (8자 이상)" placeholderTextColor={C.muted} style={inputStyle} />
          <TextInput value={pw2} onChangeText={setPw2} secureTextEntry placeholder="비밀번호 확인" placeholderTextColor={C.muted} style={inputStyle} />
          <Button label={busy ? '등록 중…' : '등록'} disabled={busy || pw.length < 8 || pw !== pw2 || (!account?.pending && id.trim().length < 3)} onPress={create} />
        </View>
      )}
      {mode === 'password' && (
        <View style={{ gap: 8 }}>
          <TextInput value={pw} onChangeText={setPw} secureTextEntry placeholder="지금 비밀번호" placeholderTextColor={C.muted} style={inputStyle} />
          <TextInput value={pw2} onChangeText={setPw2} secureTextEntry placeholder="새 비밀번호 (8자 이상)" placeholderTextColor={C.muted} style={inputStyle} />
          <Button label={busy ? '바꾸는 중…' : '비밀번호 바꾸기'} disabled={busy || pw.length < 8 || pw2.length < 8} onPress={change} />
        </View>
      )}
      {!!msg && <Text style={{ color: msg.includes('바꿨어요') ? C.ok : C.warn }}>{msg}</Text>}
    </View>
  );
}
