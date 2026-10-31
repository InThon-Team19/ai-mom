// 온보딩 1-1 시작 — 담당: 태희 (민철 와이어프레임 기준)
// 역할 선택 없이 부모만 가입. 그림 자리: "부모 아바타가 사과를 건네는 장면" → 기본 아바타 + 사과
import { router, type Href } from 'expo-router';

import { loadAccount, parentEntry } from '@/lib/account';
import { resetLocal, setRole } from '@/lib/store';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, DEFAULT_AVATAR } from '@/components/Avatar';
import { BigApple, Button } from '@/components/ui';
import { C } from '@/theme';
import { useDevice } from '@/lib/layout';

export default function Start() {
  const { gutter, height } = useDevice();
  // 가입은 아이디 만들기부터 (서버가 모든 저장에 로그인을 요구). 이미 로그인했으면 아이 정보로
  const start = async () => {
    const a = await loadAccount();
    if (!a?.token) {
      // 새 가입: 이전 버전에서 남은 기기 가입 정보를 비우고 새 아이 ID로 시작 (부모 기기로 표시)
      await resetLocal();
      await setRole('parent');
      router.push('/onboarding/account' as Href);
      return;
    }
    await setRole('parent'); // 부모 계정 토큰으로 되돌림
    // 이미 로그인: 계정의 서버 프로필로 맞추고(다른 가족 태블릿으로 연결했던 폰 포함) 가입을 마쳤으면 부모 앱, 아니면 멈춘 곳부터
    router.replace((await parentEntry()) as Href);
  };

  // 디자인 Main: 크림 바탕 · 높이 300 노랑 그림 칸(아바타 + 사과) · 아이맘 30px · 설명 · 아래 노랑 버튼 56 + 로그인 글자 링크
  const art = Math.min(300, Math.max(200, height * 0.36));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, paddingHorizontal: gutter }}>
      <View style={{ flex: 1, gap: 20, paddingTop: 32 }}>
        <View
          style={{
            width: '100%',
            height: art,
            borderRadius: 16,
            backgroundColor: C.primarySoft,
            alignItems: 'center',
            justifyContent: 'flex-end',
            overflow: 'hidden',
          }}
          accessibilityLabel="엄마 아바타가 사과를 건네는 그림">
          <Avatar config={{ ...DEFAULT_AVATAR, hair: 1, eyes: 1 }} size={art * 0.77} mouth={0.3} expression="smile" />
          <View style={{ position: 'absolute', right: '11%', bottom: art * 0.13 }}>
            <BigApple size={art * 0.21} />
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 30, fontWeight: '900', color: C.text }}>아이맘</Text>
          <Text style={{ fontSize: 15, lineHeight: 24, color: C.sub }}>일하는 동안에도 내 아바타가 아이의 눈, 귀, 손을 깨워 줘요.</Text>
        </View>
      </View>
      <View style={{ gap: 4, paddingBottom: 24 }}>
        <Button label="시작하기" onPress={start} />
        <Button label="이미 계정이 있어요 · 로그인" variant="ghost" onPress={() => router.push('/onboarding/login' as Href)} />
      </View>
    </SafeAreaView>
  );
}
