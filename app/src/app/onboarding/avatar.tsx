// 온보딩 1-4 아바타 만들기 — 담당: 태희 (민철 와이어프레임 기준)
// 실제 얼굴 대신 부모가 직접 고른 아바타 (기획 4장). 카테고리 칩 + 4x2 선택지 + 미리보기
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, AVATAR_OPTIONS, avatarFor, type AvatarCategory, type AvatarConfig } from '@/components/Avatar';
import { Button, Chip, OnboardingScaffold } from '@/components/ui';
import { updateProfile, useProfile } from '@/lib/store';
import { goNext } from '@/lib/nav';
import { C, R } from '@/theme';
import { Text } from '@/components/AppText';

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
  // 아빠를 골랐고 아직 꾸미지 않았으면 짧은 머리·셔츠로 시작 (꾸미기에서 자유롭게 바꿀 수 있음)
  return <Maker initial={avatarFor(p.avatar, p.parent.title)} />;
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
      subtitle="실제 얼굴이 아닌 캐릭터예요. 입은 부모님 입모양 수치대로 움직여요."
      footer={<Button label="다음" onPress={next} />}>
      <View
        style={{ height: 220, borderRadius: R.md, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}
        accessibilityLabel="아바타 미리보기">
        <Avatar config={config} size={200} expression="smile" />
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
                  accessibilityRole="button"
                  style={{
                    flex: 1,
                    height: 76,
                    borderRadius: R.sm,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? C.primaryStrong : C.border,
                    backgroundColor: selected ? C.primarySoft : C.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                  {/* 디자인: 글자만 (색은 고를 색이 보이게 작은 아바타) */}
                  {cat === 'color' ? (
                    <Avatar config={{ ...config, [cat]: i }} size={52} blink={false} />
                  ) : (
                    <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: selected ? '700' : '400', color: C.text }}>
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
