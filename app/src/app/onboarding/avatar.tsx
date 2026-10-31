// 온보딩 1-4 아바타 만들기 — 담당: 태희 (민철 와이어프레임 기준)
// 실제 얼굴 대신 부모가 직접 고른 아바타 (기획 4장). 카테고리 칩 + 4x2 선택지 + 미리보기
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar, AVATAR_OPTIONS, type AvatarCategory, type AvatarConfig } from '@/components/Avatar';
import { Button, Chip, OnboardingScaffold } from '@/components/ui';
import { updateProfile, useProfile } from '@/lib/store';
import { goNext } from '@/lib/nav';
import { C, R } from '@/theme';

const CATEGORIES: { key: AvatarCategory; label: string }[] = [
  { key: 'face', label: '얼굴형' },
  { key: 'hair', label: '머리' },
  { key: 'eyes', label: '눈' },
  { key: 'outfit', label: '옷' },
  { key: 'color', label: '색' },
];

export default function AvatarMaker() {
  const p = useProfile();
  if (!p) return null;
  return <Maker initial={p.avatar} />;
}

function Maker({ initial }: { initial: AvatarConfig }) {
  const edit = useLocalSearchParams<{ edit?: string }>().edit === '1';
  const [config, setConfig] = useState<AvatarConfig>(initial);
  const [cat, setCat] = useState<AvatarCategory>('face');
  const options: readonly string[] = AVATAR_OPTIONS[cat];

  const next = async () => {
    await updateProfile({ avatar: config });
    goNext(edit, '/onboarding/voice');
  };

  return (
    <OnboardingScaffold
      step={4}
      title="나만의 아바타를 만들어요"
      subtitle="아이를 만나러 갈 내 모습이에요. 입모양은 촬영한 영상으로 움직여요."
      footer={<Button label="다음" onPress={next} />}>
      <View
        style={{ height: 220, borderRadius: R.md, backgroundColor: C.card, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
        <Avatar config={config} size={180} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CATEGORIES.map((c) => (
          <Chip key={c.key} label={c.label} selected={cat === c.key} onPress={() => setCat(c.key)} />
        ))}
      </View>

      <View style={{ gap: 8 }}>
        {[0, 1].map((row) => (
          <View key={row} style={{ flexDirection: 'row', gap: 8 }}>
            {options.slice(row * 4, row * 4 + 4).map((label, j) => {
              const i = row * 4 + j;
              const selected = config[cat] === i;
              return (
                <Pressable
                  key={`${cat}-${i}`}
                  accessibilityLabel={cat === 'color' ? `피부색 ${i + 1}` : label}
                  accessibilityState={{ selected }}
                  onPress={() => setConfig((c) => ({ ...c, [cat]: i }))}
                  style={{
                    flex: 1,
                    aspectRatio: 0.9,
                    borderRadius: R.sm,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? C.primaryStrong : C.sub,
                    backgroundColor: selected ? C.primarySoft : C.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                  <Avatar config={{ ...config, [cat]: i }} size={52} />
                  {cat !== 'color' && (
                    <Text numberOfLines={1} style={{ fontSize: 11, color: C.sub }}>
                      {label}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </OnboardingScaffold>
  );
}
