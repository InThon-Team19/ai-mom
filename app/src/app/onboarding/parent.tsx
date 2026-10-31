// 온보딩 1-3 부모 성향·교육 방향 — 담당: 태희 (민철 와이어프레임 기준)
// 호칭 → 아바타의 자기 호칭, 말투 → 대화 문체, 바라는 방향(복수) → 콘텐츠 제안
import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button, Chip, OnboardingScaffold } from '@/components/ui';
import { updateProfile, useProfile, type Profile } from '@/lib/store';
import { goNext } from '@/lib/nav';
import { C, R } from '@/theme';

type Tone = Profile['parent']['tone'];
const TONES: { tone: Tone; example: string }[] = [
  { tone: '다정한', example: '{name}야, 오늘도 잘 놀고 있어?' },
  { tone: '장난스러운', example: '{name} 대장님, 출동 준비됐나요?' },
  { tone: '차분한', example: '{name}야, 천천히 같이 해볼까?' },
];
const GOALS = ['한국어 표현 늘리기', '영어 노출', '노래와 놀이', '소리 중심'];

export default function ParentInfo() {
  const p = useProfile();
  if (!p) return null;
  return <Form initial={p.parent} childName={p.child.nickname || p.child.name} />;
}

function Form({ initial, childName }: { initial: Profile['parent']; childName: string }) {
  const edit = useLocalSearchParams<{ edit?: string }>().edit === '1';
  const preset = initial.title === '엄마' || initial.title === '아빠';
  const [title, setTitle] = useState(preset ? initial.title : '엄마');
  const [custom, setCustom] = useState(!preset);
  const [customText, setCustomText] = useState(preset ? '' : initial.title);
  const [tone, setTone] = useState<Tone>(initial.tone);
  const [goals, setGoals] = useState<string[]>(initial.goals);

  const finalTitle = custom ? customText.trim() : title;
  const ready = finalTitle.length > 0 && goals.length > 0;
  const name = childName || '우리 아기';

  const toggleGoal = (g: string) => setGoals((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  const pickTitle = (t: string) => {
    setCustom(false);
    setTitle(t);
  };

  const next = async () => {
    if (!ready) return;
    await updateProfile({ parent: { title: finalTitle, tone, goals } });
    goNext(edit, '/onboarding/avatar');
  };

  return (
    <OnboardingScaffold
      step={3}
      title="어떻게 말해주는 부모인가요?"
      subtitle="AI가 평소 말투에 가깝게 문장을 만들어요."
      footer={<Button label="다음" disabled={!ready} onPress={next} />}>
      <Section label="아이가 나를 부르는 말">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {['엄마', '아빠'].map((t) => (
            <Box key={t} selected={!custom && title === t} onPress={() => pickTitle(t)}>
              <Text style={boxText(!custom && title === t)}>{t}</Text>
            </Box>
          ))}
          <Box dashed selected={custom} onPress={() => setCustom(true)}>
            <Text style={boxText(custom)}>직접 입력</Text>
          </Box>
        </View>
        {custom && (
          <TextInput
            autoFocus
            value={customText}
            onChangeText={setCustomText}
            placeholder="예: 할머니, 이모"
            placeholderTextColor={C.muted}
            maxLength={8}
            style={{ minHeight: 50, borderWidth: 1, borderColor: C.sub, borderRadius: R.sm, paddingHorizontal: 14, fontSize: 16, color: C.text }}
          />
        )}
      </Section>

      <Section label="말투">
        {TONES.map(({ tone: t, example }) => (
          <Box key={t} selected={tone === t} onPress={() => setTone(t)} card>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{t}</Text>
            <Text style={{ fontSize: 14, color: C.sub }}>{example.replaceAll('{name}', name)}</Text>
          </Box>
        ))}
      </Section>

      <Section label="바라는 방향" hint="(여러 개 선택)">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {GOALS.map((g) => (
            <Chip key={g} label={g} selected={goals.includes(g)} onPress={() => toggleGoal(g)} />
          ))}
        </View>
      </Section>
    </OnboardingScaffold>
  );
}

const boxText = (selected: boolean) => ({ fontSize: 15, fontWeight: selected ? ('700' as const) : ('500' as const), color: C.text });

function Section({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>
        {label}
        {!!hint && <Text style={{ fontWeight: '400', color: C.sub }}> {hint}</Text>}
      </Text>
      {children}
    </View>
  );
}

/** 네모 선택 상자 — card 면 왼쪽 정렬 2줄(말투), dashed 면 점선(직접 입력) */
function Box({
  selected,
  onPress,
  dashed,
  card,
  children,
}: {
  selected: boolean;
  onPress: () => void;
  dashed?: boolean;
  card?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected }}
      style={{
        flex: card ? undefined : 1,
        minHeight: card ? 60 : 50,
        paddingHorizontal: 16,
        paddingVertical: card ? 10 : 0,
        gap: 2,
        alignItems: card ? 'flex-start' : 'center',
        justifyContent: 'center',
        borderRadius: R.sm,
        borderWidth: selected ? 2 : 1,
        borderStyle: dashed && !selected ? 'dashed' : 'solid',
        borderColor: selected ? C.primary : C.sub,
        backgroundColor: selected ? C.primarySoft : C.white,
      }}>
      {children}
    </Pressable>
  );
}
