// 부모 앱 2-3 피드백: 아쉬운 점 · 직접 쓰기 · 내일 주제(보기만) · 복습 추가 · 새로 말한 단어 — 담당: 태희 (민철 와이어프레임 기준)
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, H1, Sub } from '@/components/ui';
import { DAYS, ITEMS, dayOf } from '@/content/curriculum';
import { updateProfile, useProfile } from '@/lib/store';
import { C, R, T } from '@/theme';
import { useDevice } from '@/lib/layout';

const ISSUES = ['말이 빨라요', '질문이 어려워요', '진동이 세요', '목소리가 어색해요'];

const Label = ({ title, optional }: { title: string; optional?: boolean }) => (
  <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>
    {title}
    {optional && <Text style={{ fontWeight: '400', color: C.sub }}> (선택)</Text>}
  </Text>
);

const input = { borderWidth: 1, borderColor: C.sub, borderRadius: R.sm, padding: 12, fontSize: 16, color: C.text } as const;

export default function Feedback() {
  const { frame } = useDevice();
  const profile = useProfile();
  const [issues, setIssues] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [review, setReview] = useState<string[]>([]);
  const [newWords, setNewWords] = useState('');
  const [saving, setSaving] = useState(false);

  const dayNum = profile?.day ?? 1;
  const today = dayOf(dayNum);
  const tomorrow = dayOf(Math.min(dayNum + 1, DAYS.length));

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = async () => {
    if (!profile || saving) return;
    setSaving(true);
    try {
      // 같은 날 다시 저장하면 덮어씀 (중복 방지)
      const old = profile.feedback.filter((f) => f.day !== dayNum);
      await updateProfile({ feedback: [...old, { day: dayNum, issues, note: note.trim(), review, newWords: newWords.trim() }] });
      setIssues([]);
      setNote('');
      setReview([]);
      setNewWords('');
      router.navigate('/parent/plan' as Href);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[{ padding: 20, gap: 14 }, frame]} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 6 }}>
            <H1>피드백</H1>
            <Sub>남긴 내용은 내일 아바타의 대화에 반영돼요.</Sub>
          </View>

          <Label title="오늘 아쉬웠던 점" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ISSUES.map((v) => (
              <Chip key={v} label={v} selected={issues.includes(v)} onPress={() => toggle(issues, setIssues, v)} />
            ))}
          </View>
          {issues.includes('진동이 세요') && (
            <Text style={T.small}>진동은 설정에서 끌 수 있어요. 기록해 두고 내일은 더 약하게 쓸게요.</Text>
          )}

          <Text style={T.sub}>직접 쓰기 (선택)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="예: 질문 후에 조금 더 기다려 주세요"
            placeholderTextColor={C.muted}
            style={[input, { minHeight: 72, textAlignVertical: 'top' }]}
          />

          <Card style={{ gap: 6 }}>
            <Text style={T.sub}>내일 · {tomorrow.day}일차</Text>
            <Text style={T.h2}>{tomorrow.topic}에 대해 배워봐요</Text>
            <Text style={T.small}>
              {tomorrow.day === dayNum ? '마지막 일차예요. 오늘 주제를 한 번 더 이어가요.' : '정해진 커리큘럼 순서대로 진행돼요.'}
            </Text>
          </Card>

          <Label title="복습 추가" optional />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {today.items.map((id) => (
              <Chip key={id} label={`${ITEMS[id].ko} 복습`} selected={review.includes(id)} onPress={() => toggle(review, setReview, id)} />
            ))}
          </View>

          <Label title="오늘 새로 말한 단어" optional />
          <TextInput value={newWords} onChangeText={setNewWords} placeholder="예: 사과" placeholderTextColor={C.muted} style={input} />

          <Button label={saving ? '저장 중...' : '내일 계획 읽으러 가기'} disabled={!profile || saving} onPress={save} style={{ marginTop: 10 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
