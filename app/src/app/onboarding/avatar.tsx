// Both parent illustration and existing SVG customization share the profile format.
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { avatarFor, type AvatarConfig } from '@/components/Avatar';
import { ParentAppearancePicker } from '@/components/ParentAppearancePicker';
import { Button, OnboardingScaffold } from '@/components/ui';
import { updateProfile, useProfile } from '@/lib/store';
import { goNext } from '@/lib/nav';

export default function AvatarMaker() {
  const p = useProfile();
  if (!p) return null;
  return <Maker initial={avatarFor(p.avatar, p.parent.title)} title={p.parent.title} />;
}
function Maker({ initial, title }: { initial: AvatarConfig; title: string }) {
  const edit = useLocalSearchParams<{ edit?: string }>().edit === '1';
  const [config, setConfig] = useState(initial);
  const next = async () => {
    await updateProfile({ avatar: config });
    goNext(edit, '/onboarding/voice');
  };
  return <OnboardingScaffold step={4} title="나만의 아바타를 만들어요" subtitle="그림체와 머리, 옷을 골라 주세요." footer={<Button label="다음" onPress={next} />}>
    <ParentAppearancePicker config={config} onChange={setConfig} title={title} />
  </OnboardingScaffold>;
}
