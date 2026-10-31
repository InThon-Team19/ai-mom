import { FamilyAvatar } from '@/components/FamilyAvatar';
// 앱 시작: 이 기기를 부모 폰으로 쓸지, 아이 태블릿으로 쓸지 + 서버 주소 설정 — 담당: 태희
// 와이어프레임 1-1 은 "역할 선택 없이 부모만 가입". 아이 태블릿은 1-7 의 연결 코드로 붙음 → 여기서는 기기 용도만 고름
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Note, fieldStyle } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';
import { loadApiUrl, saveApiUrl } from '@/lib/config';
import { loadAccount, parentEntry } from '@/lib/account';
import { getRole, loadProfile, setRole, type Role } from '@/lib/store';
import { C } from '@/theme';
import { useDevice } from '@/lib/layout';
import { Text, TextInput } from '@/components/AppText';

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

  // 디자인 Device: 아이맘 32px · 질문 20px · 노랑 카드(부모 폰) · 흰 카드(아이 태블릿) · 아래 안내 상자
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: 48, paddingBottom: 24, paddingHorizontal: gutter, gap: 20 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Logo size={56} />
          <Text style={{ fontSize: 32, fontWeight: '900', color: C.text }}>아이맘</Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: C.text }}>이 기기를 어떻게 쓸까요?</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => choose('parent')}
          style={({ pressed }) => ({ gap: 6, paddingVertical: 22, paddingHorizontal: 20, borderRadius: 18, backgroundColor: C.primary, opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.text }}>부모 폰으로 쓰기</Text>
          <FamilyAvatar role="parent" size={100} />
          <Text style={{ fontSize: 14, lineHeight: 21, color: C.text }}>가입하고, 밤에 리포트를 보고 내일 계획을 읽어 줘요.</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => choose('child')}
          style={({ pressed }) => ({ gap: 6, paddingVertical: 22, paddingHorizontal: 20, borderRadius: 18, backgroundColor: C.white, borderWidth: 2, borderColor: C.border, opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: C.text }}>아이 태블릿으로 쓰기</Text>
          <FamilyAvatar role="child" size={100} />
          <Text style={{ fontSize: 14, lineHeight: 21, color: C.sub }}>부모 폰에서 받은 연결 코드로 연결해요.</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Note>나중에 바꾸고 싶으면 부모 앱 설정 탭이나, 아이 화면의 자물쇠를 3초 눌러 바꿀 수 있어요.</Note>

        {/* 개발·시연용: 서버 주소 (디자인에는 없음, 작게) */}
        <Pressable onPress={() => setShowServer((v) => !v)} hitSlop={8}>
          <Text style={{ fontSize: 12, color: C.muted }}>
            서버: {server} {showServer ? '▲' : '▼'}
          </Text>
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
              placeholderTextColor={C.muted}
              style={[fieldStyle, { flex: 1, minHeight: 44, fontSize: 15 }]}
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
        <Pressable onPress={() => router.push('/terms')} accessibilityRole="link" hitSlop={8} style={{ alignSelf: 'center', minHeight: 36, justifyContent: 'center' }}>
          <Text style={{ fontSize: 13, color: C.link, textDecorationLine: 'underline' }}>이용약관 · 개인정보 처리 안내</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
