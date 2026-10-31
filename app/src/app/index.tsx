// 앱 시작: 이 기기를 부모 폰으로 쓸지, 아이 태블릿으로 쓸지 + 서버 주소 설정 — 담당: 태희
// 와이어프레임 1-1 은 "역할 선택 없이 부모만 가입". 아이 태블릿은 1-7 의 연결 코드로 붙음 → 여기서는 기기 용도만 고름
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { loadApiUrl, saveApiUrl } from '@/lib/config';
import { loadAccount, parentEntry } from '@/lib/account';
import { getRole, loadProfile, setRole, type Role } from '@/lib/store';
import { C, T } from '@/theme';
import { useDevice } from '@/lib/layout';

export default function Entry() {
  const { gutter } = useDevice();
  const [ready, setReady] = useState(false);
  const [dest, setDest] = useState<string | null>(null);
  const [server, setServer] = useState('확인 중...');
  const [url, setUrl] = useState('');
  const [showServer, setShowServer] = useState(false);

  const check = useCallback(() => {
    setServer('확인 중...');
    api.health().then(() => setServer('연결됨')).catch(() => setServer('연결 실패'));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setUrl(await loadApiUrl());
        check();
        const [role, p, a] = await Promise.all([getRole(), loadProfile(), loadAccount()]);
        // 서버가 모든 API 에 로그인을 요구: 부모 기기인데 로그인 토큰이 없으면(이전 버전 가입 기기 포함) 로그인부터
        // 부모 폰: 로그인돼 있으면 가입 정보를 서버에서 되살려 바로 이어서 (아이 소개를 다시 하지 않게)
        if (role === 'parent' && (p.onboarded || a?.token)) setDest(await parentEntry());
        else if (role === 'child') setDest('/child');
      } finally {
        setReady(true); // 무슨 일이 있어도 빈 화면에 멈추지 않게 (최소한 기기 용도 고르기는 보이게)
      }
    })();
  }, [check]);

  if (!ready) return null;
  if (dest) return <Redirect href={dest as '/parent'} />;

  const choose = async (r: Role) => {
    await setRole(r);
    // 부모 모드: 로그인돼 있으면 서버 정보로 되살려 부모 앱 또는 가입 이어서, 아니면 로그인/가입
    const dest = r === 'child' ? '/child' : await parentEntry();
    router.replace(dest as '/parent');
  };

  return (
    <SafeAreaView style={{ flex: 1, paddingVertical: 24, paddingHorizontal: gutter, gap: 16, backgroundColor: C.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
        <Text style={{ fontSize: 34, fontWeight: '900', color: C.link }}>아이맘</Text>
        <Text style={T.sub}>이 기기를 어떻게 쓸까요?</Text>
        <Button label="부모 폰으로 쓰기" onPress={() => choose('parent')} />
        <Button label="아이 태블릿으로 쓰기" variant="outline" onPress={() => choose('child')} />
      </View>

      <Pressable onPress={() => setShowServer((v) => !v)}>
        <Text style={T.small}>서버: {server} {showServer ? '▲' : '▼'}</Text>
      </Pressable>
      {showServer && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://노트북IP:8000"
            style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10 }}
          />
          <Button
            label="저장"
            style={{ minHeight: 44 }}
            onPress={async () => {
              setUrl(await saveApiUrl(url));
              check();
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}
