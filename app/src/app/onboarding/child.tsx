// 온보딩 1-2 아이 정보 — 담당: 태희 (민철 와이어프레임 기준)
// 이름·부르는 말(아바타가 부를 때), 생년월(콘텐츠 난이도), 말하기 수준(시작 템포), 좋아하는 것(선택). 건강 정보는 받지 않음
import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button, Chip, OnboardingScaffold } from '@/components/ui';
import { updateProfile, useProfile, type Profile } from '@/lib/store';
import { goNext } from '@/lib/nav';
import { C, R, T } from '@/theme';

const LEVELS: Profile['child']['level'][] = ['한 단어', '두 단어', '짧은 문장'];
const LIKE_PRESETS = ['초록 공룡', '동물', '자동차', '노래'];

export default function ChildInfo() {
  const p = useProfile();
  if (!p) return null;
  return <Form initial={p.child} />;
}

function Form({ initial }: { initial: Profile['child'] }) {
  const edit = useLocalSearchParams<{ edit?: string }>().edit === '1';
  const [name, setName] = useState(initial.nickname || initial.name);
  const [year, setYear] = useState(initial.birth.split('-')[0] ?? '');
  const [month, setMonth] = useState(initial.birth.split('-')[1] ?? '');
  const [level, setLevel] = useState<Profile['child']['level'] | null>(initial.birth ? initial.level : null);
  const [likes, setLikes] = useState<string[]>(initial.likes);
  const [extra, setExtra] = useState<string[]>(initial.likes.filter((l) => !LIKE_PRESETS.includes(l)));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const thisYear = new Date().getFullYear();
  const y = Number(year);
  const m = Number(month);
  const birthOk = year.length === 4 && y >= thisYear - 10 && y <= thisYear && m >= 1 && m <= 12;
  const ready = name.trim().length > 0 && birthOk && !!level;

  const toggleLike = (l: string) => setLikes((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]));
  const addLike = () => {
    const t = draft.trim();
    if (t && !LIKE_PRESETS.includes(t) && !extra.includes(t)) setExtra((e) => [...e, t]);
    if (t && !likes.includes(t)) setLikes((cur) => [...cur, t]);
    setDraft('');
    setAdding(false);
  };

  const next = async () => {
    if (!ready || !level) return;
    const n = name.trim();
    await updateProfile({ child: { name: n, nickname: n, birth: `${year}-${String(m).padStart(2, '0')}`, level, likes } });
    goNext(edit, '/onboarding/parent');
  };

  return (
    <OnboardingScaffold step={2} title="아이를 알려주세요" footer={<Button label="다음" disabled={!ready} onPress={next} />}>
      <Field label="이름 또는 집에서 부르는 말">
        <TextInput value={name} onChangeText={setName} placeholder="예: 지호" placeholderTextColor={C.muted} style={input} />
      </Field>

      <Field label="생년월">
        <View style={[input, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
          <TextInput
            value={year}
            onChangeText={(t) => setYear(t.replace(/\D/g, ''))}
            placeholder="YYYY"
            placeholderTextColor={C.muted}
            keyboardType="number-pad"
            maxLength={4}
            style={{ fontSize: 16, minWidth: 52, color: C.text, padding: 0 }}
          />
          <Text style={T.body}>년</Text>
          <TextInput
            value={month}
            onChangeText={(t) => setMonth(t.replace(/\D/g, ''))}
            placeholder="MM"
            placeholderTextColor={C.muted}
            keyboardType="number-pad"
            maxLength={2}
            style={{ fontSize: 16, minWidth: 30, color: C.text, padding: 0, marginLeft: 8 }}
          />
          <Text style={T.body}>월</Text>
        </View>
        {year.length === 4 && month.length > 0 && !birthOk && <Text style={{ fontSize: 13, color: C.warn }}>생년월을 다시 확인해주세요</Text>}
      </Field>

      <Field label="지금 말하는 수준">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {LEVELS.map((l) => (
            <Box key={l} label={l} selected={level === l} onPress={() => setLevel(l)} />
          ))}
        </View>
      </Field>

      <Field label="좋아하는 것" hint="(선택)">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[...LIKE_PRESETS, ...extra].map((l) => (
            <Chip key={l} label={l} selected={likes.includes(l)} onPress={() => toggleLike(l)} />
          ))}
          {!adding && (
            <Pressable
              onPress={() => setAdding(true)}
              style={{ paddingHorizontal: 16, minHeight: 42, justifyContent: 'center', borderRadius: R.pill, borderWidth: 1, borderStyle: 'dashed', borderColor: C.sub }}>
              <Text style={{ fontSize: 15, color: C.text }}>직접 추가</Text>
            </Pressable>
          )}
        </View>
        {adding && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              autoFocus
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={addLike}
              placeholder="예: 기차"
              placeholderTextColor={C.muted}
              style={[input, { flex: 1 }]}
            />
            <Button label="추가" variant="outline" onPress={addLike} style={{ minHeight: 50 }} />
          </View>
        )}
      </Field>
    </OnboardingScaffold>
  );
}

const input = {
  minHeight: 50,
  borderWidth: 1,
  borderColor: C.sub,
  borderRadius: R.sm,
  paddingHorizontal: 14,
  fontSize: 16,
  color: C.text,
} as const;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
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

/** 네모 선택 상자 (말하기 수준 3단계) */
function Box({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected }}
      style={{
        flex: 1,
        minHeight: 50,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: R.sm,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? C.primary : C.sub,
        backgroundColor: selected ? C.primarySoft : C.white,
      }}>
      <Text style={{ fontSize: 15, fontWeight: selected ? '700' : '500', color: C.text }}>{label}</Text>
    </Pressable>
  );
}
