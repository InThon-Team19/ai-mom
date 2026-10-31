// 설정 탭 "로그인" 구역: 로그인 상태·계정 만들기·비밀번호 변경·로그아웃. 담당: 태희 (서버 /auth/* 는 민주)
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';

import { Button, fieldStyle } from '@/components/ui';
import { authMessage, changePassword, logoutAccount, signup, useAccount } from '@/lib/account';
import { clearRole, resetLocal } from '@/lib/store';
import { C, T } from '@/theme';
import { Text, TextInput } from '@/components/AppText';

const inputStyle = { ...fieldStyle, minHeight: 46, fontSize: 16 } as const;

/** 디자인 Settings: 카드 안 글자 링크 */
const LinkText = ({ label, onPress, warn }: { label: string; onPress: () => void; warn?: boolean }) => (
  <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={{ minHeight: 32, justifyContent: 'center' }}>
    <Text style={{ fontSize: 14, fontWeight: '700', color: warn ? C.warn : C.link }}>{label}</Text>
  </Pressable>
);

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
    <View style={{ gap: 6 }}>
      {account ? (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Text style={{ fontSize: 14, color: C.sub }}>아이디</Text>
            <Text style={{ flexShrink: 1, fontSize: 14, color: C.text }}>
              {account.loginId}
              {account.pending && <Text style={{ color: C.warn }}> (서버 등록 전)</Text>}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
            {account.pending ? <LinkText label="다시 등록" onPress={() => setMode('create')} /> : <LinkText label="비밀번호 바꾸기" onPress={() => setMode(mode === 'password' ? 'none' : 'password')} />}
            <LinkText label="로그아웃" onPress={logout} />
          </View>
        </>
      ) : (
        <>
          <Text style={T.small}>아직 로그인하지 않았어요. 계정을 만들면 다른 폰에서도 우리 아이 정보를 불러올 수 있어요.</Text>
          <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
            <LinkText label="계정 만들기" onPress={() => setMode('create')} />
            <LinkText label="다른 계정으로 로그인" onPress={() => router.push('/onboarding/login' as Href)} />
          </View>
        </>
      )}

      {mode === 'create' && (
        <View style={{ gap: 8 }}>
          {!account?.pending && <TextInput value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false} placeholder="아이디 (영문·숫자 3자 이상)" placeholderTextColor={C.sub} style={inputStyle} />}
          <TextInput value={pw} onChangeText={setPw} secureTextEntry placeholder="비밀번호 (8자 이상)" placeholderTextColor={C.sub} style={inputStyle} />
          <TextInput value={pw2} onChangeText={setPw2} secureTextEntry placeholder="비밀번호 확인" placeholderTextColor={C.sub} style={inputStyle} />
          <Button label={busy ? '등록 중…' : '등록'} disabled={busy || pw.length < 8 || pw !== pw2 || (!account?.pending && id.trim().length < 3)} onPress={create} />
        </View>
      )}
      {mode === 'password' && (
        <View style={{ gap: 8 }}>
          <TextInput value={pw} onChangeText={setPw} secureTextEntry placeholder="지금 비밀번호" placeholderTextColor={C.sub} style={inputStyle} />
          <TextInput value={pw2} onChangeText={setPw2} secureTextEntry placeholder="새 비밀번호 (8자 이상)" placeholderTextColor={C.sub} style={inputStyle} />
          <Button label={busy ? '바꾸는 중…' : '비밀번호 바꾸기'} disabled={busy || pw.length < 8 || pw2.length < 8} onPress={change} />
        </View>
      )}
      {!!msg && <Text style={{ fontSize: 13, color: msg.includes('바꿨어요') ? C.ok : C.warn }}>{msg}</Text>}
    </View>
  );
}
