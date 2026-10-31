// 온보딩 1-4 부모 아바타 확인 — 승인된 고정 일러스트 사용.
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { Text } from '@/components/AppText';
import { Button, OnboardingScaffold } from '@/components/ui';
import { goNext } from '@/lib/nav';
import { C, R } from '@/theme';

export default function AvatarMaker() {
  const edit = useLocalSearchParams<{ edit?: string }>().edit === '1';
  return (
    <OnboardingScaffold step={4} title="아이와 함께할 아바타예요" subtitle="부모님의 목소리와 말투로 아이에게 말을 건네요." footer={<Button label="이 아바타로 계속하기" onPress={() => goNext(edit, '/onboarding/voice')} />}>
      <View style={{ height: 280, borderRadius: R.md, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <FamilyAvatar role="parent" size={250} />
      </View>
      <Text style={{ fontSize: 14, color: C.sub, textAlign: 'center' }}>다음 단계에서 부모님의 목소리를 들려주세요.</Text>
    </OnboardingScaffold>
  );
}
