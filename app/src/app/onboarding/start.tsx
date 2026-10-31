// 온보딩 1-1 시작 — 담당: 태희 (민철 와이어프레임 기준)
// 역할 선택 없이 부모만 가입. 그림 자리: "부모 아바타가 사과를 건네는 장면" → 기본 아바타 + 사과
import { router, type Href } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, DEFAULT_AVATAR } from '@/components/Avatar';
import { Button, H1, Sub } from '@/components/ui';
import { C, R } from '@/theme';

export default function Start() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg, padding: 24 }}>
      <View style={{ flex: 1, gap: 20, paddingTop: 40 }}>
        <View
          style={{
            width: '100%',
            aspectRatio: 4 / 3,
            borderRadius: R.md,
            backgroundColor: C.primarySoft,
            alignItems: 'center',
            justifyContent: 'flex-end',
            overflow: 'hidden',
          }}>
          <Avatar config={{ ...DEFAULT_AVATAR, hair: 1, eyes: 1 }} size={170} mouth={0.3} />
          <Text style={{ position: 'absolute', right: '18%', bottom: '14%', fontSize: 52 }}>🍎</Text>
        </View>
        <View style={{ gap: 8 }}>
          <H1>아이맘</H1>
          <Sub>일하는 동안에도 내 아바타가 아이의 눈, 귀, 손을 깨워줘요.</Sub>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Button label="시작하기" onPress={() => router.push('/onboarding/child')} />
        <Button label="이미 계정이 있어요 · 로그인" variant="ghost" onPress={() => router.push('/onboarding/login' as Href)} />
      </View>
    </SafeAreaView>
  );
}
