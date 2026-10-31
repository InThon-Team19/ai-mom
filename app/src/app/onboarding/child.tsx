// 온보딩 1-2 아이 정보 — 담당: 태희 (민철 와이어프레임 기준)
// 이름·별명(아바타가 부를 때), 태어난 해·달(콘텐츠 난이도), 요즘 말하는 모습(시작 템포), 좋아하는 것(선택). 건강 정보·싫어하는 것은 받지 않음
import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button, Chip, OnboardingScaffold } from '@/components/ui';
import { updateProfile, useProfile, type Profile } from '@/lib/store';
import { goNext } from '@/lib/nav';
import { C, R } from '@/theme';

type Level = Profile['child']['level'];

/** 말하기 수준: 부모가 고르기 쉽게 설명과 예시를 함께 보여줘요 */
const LEVELS: { value: Level; desc: string; example: string }[] = [
  { value: '옹알이', desc: '아직은 소리로 표현해요', example: '아-, 바바, 음마' },
  { value: '한 단어', desc: '단어 하나로 말해요', example: '엄마, 물, 까까' },
  { value: '두 단어', desc: '단어 두 개를 이어 말해요', example: '엄마 물, 사과 줘' },
  { value: '짧은 문장', desc: '짧은 문장으로 말해요', example: '사과 먹고 싶어요' },
];

/** 좋아하는 것: 구체적인 물건보다 넓은 갈래로 */
const LIKE_PRESETS = ['공주', '왕자', '강아지', '고양이', '공룡', '자동차', '기차', '노래·춤', '그림 그리기', '블록 놀이'];

export default function ChildInfo() {
  const p = useProfile();
  if (!p) return null;
  return <Form initial={p.child} />;
}

/** 태어난 해·달을 확인하고, 안 되면 이유를 알려줘요. 괜찮으면 null */
function birthProblem(year: string, month: string): string | null {
  const now = new Date();
  const thisYear = now.getFullYear();
  const y = Number(year);
  const m = Number(month);
  if (year.length < 4) return '태어난 해는 숫자 4자리로 적어 주세요. (예: 2022)';
  if (y > thisYear) return `아직 오지 않은 해예요. ${thisYear}년이나 그 전으로 적어 주세요.`;
  if (y < thisYear - 8) return `아이맘은 2~5세 아이와 함께 놀아요. ${thisYear - 8}년 이후로 적어 주세요.`;
  if (month.length === 0) return '태어난 달도 적어 주세요.';
  if (m < 1 || m > 12) return '태어난 달은 1부터 12 사이로 적어 주세요.';
  if (y === thisYear && m > now.getMonth() + 1) return '아직 오지 않은 달이에요. 다시 확인해 주세요.';
  return null;
}

function ageText(year: string, month: string): string {
  const now = new Date();
  const months = (now.getFullYear() - Number(year)) * 12 + (now.getMonth() + 1 - Number(month));
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y > 0 ? `지금 만 ${y}살 ${m}개월이에요` : `지금 ${m}개월이에요`;
}

function Form({ initial }: { initial: Profile['child'] }) {
  const edit = useLocalSearchParams<{ edit?: string }>().edit === '1';
  const [name, setName] = useState(initial.nickname || initial.name);
  const [year, setYear] = useState(initial.birth.split('-')[0] ?? '');
  const [month, setMonth] = useState(String(Number(initial.birth.split('-')[1] ?? '') || ''));
  const [level, setLevel] = useState<Level | null>(initial.birth ? initial.level : null);
  const [likes, setLikes] = useState<string[]>(initial.likes);
  const [extra, setExtra] = useState<string[]>(initial.likes.filter((l) => !LIKE_PRESETS.includes(l)));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const problem = birthProblem(year, month);
  const touched = year.length > 0 || month.length > 0;
  const ready = name.trim().length > 0 && !problem && !!level;

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
    await updateProfile({ child: { name: n, nickname: n, birth: `${year}-${String(Number(month)).padStart(2, '0')}`, level, likes } });
    goNext(edit, '/onboarding/parent');
  };

  return (
    <OnboardingScaffold
      step={2}
      title="우리 아이를 소개해 주세요"
      subtitle="아바타가 아이 이름을 불러 주고, 아이에게 맞는 속도로 함께 놀아요."
      footer={<Button label="다음" disabled={!ready} onPress={next} />}>
      <Field label="아이의 이름 또는 별명" hint="아바타가 이렇게 불러 줘요">
        <TextInput value={name} onChangeText={setName} placeholder="예: 지호, 콩이" placeholderTextColor={C.muted} style={input} />
      </Field>

      <Field label="태어난 해와 달">
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[input, unitBox, { flex: 3 }]}>
            <TextInput
              value={year}
              onChangeText={(t) => setYear(t.replace(/\D/g, ''))}
              placeholder="2022"
              placeholderTextColor={C.muted}
              keyboardType="number-pad"
              maxLength={4}
              accessibilityLabel="태어난 해"
              style={unitInput}
            />
            <Text style={unitText}>년</Text>
          </View>
          <View style={[input, unitBox, { flex: 2 }]}>
            <TextInput
              value={month}
              onChangeText={(t) => setMonth(t.replace(/\D/g, ''))}
              placeholder="5"
              placeholderTextColor={C.muted}
              keyboardType="number-pad"
              maxLength={2}
              accessibilityLabel="태어난 달"
              style={unitInput}
            />
            <Text style={unitText}>월</Text>
          </View>
        </View>
        {touched && !!problem && <Text style={{ fontSize: 13, lineHeight: 19, color: C.warn }}>{problem}</Text>}
        {!problem && <Text style={{ fontSize: 13, color: C.sub }}>{ageText(year, month)}</Text>}
      </Field>

      <Field label="요즘 말하는 모습" hint="가장 가까운 것을 골라 주세요">
        <View style={{ gap: 8 }}>
          {LEVELS.map((l) => (
            <LevelRow key={l.value} item={l} selected={level === l.value} onPress={() => setLevel(l.value)} />
          ))}
        </View>
      </Field>

      <Field label="좋아하는 것" hint="(선택 · 여러 개 골라도 돼요)">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[...LIKE_PRESETS, ...extra].map((l) => (
            <Chip key={l} label={l} selected={likes.includes(l)} onPress={() => toggleLike(l)} />
          ))}
          {!adding && (
            <Pressable
              onPress={() => setAdding(true)}
              style={{ paddingHorizontal: 16, minHeight: 42, justifyContent: 'center', borderRadius: R.pill, borderWidth: 1, borderStyle: 'dashed', borderColor: C.sub }}>
              <Text style={{ fontSize: 15, color: C.text }}>+ 직접 적기</Text>
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
              placeholder="예: 버스, 바다"
              placeholderTextColor={C.muted}
              style={[input, { flex: 1 }]}
            />
            <Button label="추가" variant="outline" onPress={addLike} style={{ minHeight: 50 }} />
          </View>
        )}
        <Text style={{ fontSize: 12, color: C.sub }}>건강 정보나 싫어하는 것은 받지 않아요.</Text>
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

const unitBox = { flexDirection: 'row', alignItems: 'center', gap: 6 } as const;
const unitInput = { flex: 1, fontSize: 17, lineHeight: 24, color: C.text, paddingVertical: 10, paddingHorizontal: 0 } as const;
const unitText = { fontSize: 16, lineHeight: 24, color: C.text } as const;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: '700', color: C.text }}>
        {label}
        {!!hint && <Text style={{ fontSize: 13, fontWeight: '400', color: C.sub }}>  {hint}</Text>}
      </Text>
      {children}
    </View>
  );
}

/** 말하기 수준 한 줄: 이름 + 설명 + 예시 */
function LevelRow({ item, selected, onPress }: { item: (typeof LEVELS)[number]; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={{
        minHeight: 56,
        paddingHorizontal: 14,
        paddingVertical: 10,
        gap: 2,
        borderRadius: R.sm,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? C.primaryStrong : C.sub,
        backgroundColor: selected ? C.primarySoft : C.white,
      }}>
      <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: '700', color: C.text }}>
        {item.value}
        <Text style={{ fontSize: 14, fontWeight: '400' }}>  {item.desc}</Text>
      </Text>
      <Text style={{ fontSize: 13, color: C.sub }}>예: {item.example}</Text>
    </Pressable>
  );
}
