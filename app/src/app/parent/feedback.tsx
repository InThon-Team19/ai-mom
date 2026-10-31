// 부모 앱 2-3 피드백 (민철 디자인 Feedback) "내일을 함께 준비해요": 내일 계획(낭독하기) · 복습 추가 · 내 아바타에게 바라는 점 · 저장 — 담당: 태희
// 저장 형식은 그대로 (profile.feedback: day · issues · note · review · newWords). '+ 기타' 두 칸은 note 에 합쳐 저장
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { BigButton, Panel, PillChip } from '@/components/ui';
import { DAYS, ITEMS, dayOf, fill } from '@/content/curriculum';
import { useDevice } from '@/lib/layout';
import { josa, readToday } from '@/lib/progress';
import { updateProfile, useProfile, type Profile } from '@/lib/store';
import { C, R } from '@/theme';

const ISSUES = ['말이 빨라요', '질문이 어려워요', '진동이 세요', '목소리가 어색해요'];
const PLAN_PREFIX = '내일 해 보고 싶은 것: ';

const MicIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24">
    <Rect x={9} y={3} width={6} height={11} rx={3} stroke={C.text} strokeWidth={2.2} fill="none" />
    <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke={C.text} strokeWidth={2.2} fill="none" strokeLinecap="round" />
  </Svg>
);

/** '+ 기타' 밑줄 입력 */
function Extra({ value, onChange, placeholder, label = '+ 기타' }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: C.sub }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        accessibilityLabel={`${label.replace('+ ', '')} 입력`}
        style={{ flex: 1, minWidth: 0, height: 40, borderBottomWidth: 2, borderBottomColor: C.border, paddingHorizontal: 4, fontSize: 14, color: C.text }}
      />
    </View>
  );
}

export default function Feedback() {
  const profile = useProfile();
  if (!profile) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} />;
  // 오늘 저장한 피드백이 있으면 채워서 시작 (일차가 바뀌면 새로)
  return <FeedbackForm key={profile.day} profile={profile} />;
}

function FeedbackForm({ profile }: { profile: Profile }) {
  const { frame } = useDevice();
  const dayNum = profile.day;
  const saved = profile.feedback.find((f) => f.day === dayNum);
  const savedLines = (saved?.note ?? '').split('\n');
  const [issues, setIssues] = useState<string[]>(saved?.issues ?? []);
  const [planExtra, setPlanExtra] = useState(savedLines.find((l) => l.startsWith(PLAN_PREFIX))?.slice(PLAN_PREFIX.length) ?? '');
  const [note, setNote] = useState(savedLines.filter((l) => !l.startsWith(PLAN_PREFIX)).join('\n'));
  const [review, setReview] = useState<string[]>(saved?.review ?? []);
  const [newWords, setNewWords] = useState(saved?.newWords ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const today = dayOf(dayNum);
  const tomorrow = dayOf(Math.min(dayNum + 1, DAYS.length));
  const name = profile.child.nickname || profile.child.name;
  const sentences = useMemo(
    () => tomorrow.planSentences.map((t) => fill(t, { name, me: profile.parent.title })),
    [tomorrow, name, profile.parent.title],
  );
  const read = readToday(profile);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => {
    setMsg('');
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const fullNote = [note.trim(), planExtra.trim() ? `${PLAN_PREFIX}${planExtra.trim()}` : ''].filter(Boolean).join('\n');
      // 같은 날 다시 저장하면 덮어씀 (중복 방지)
      const old = profile.feedback.filter((f) => f.day !== dayNum);
      await updateProfile({ feedback: [...old, { day: dayNum, issues, note: fullNote, review, newWords: newWords.trim() }] });
      setMsg(read ? '저장했어요. 내일 대화에 반영돼요.' : '저장했어요. 이제 내일 계획을 낭독해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[{ padding: 20, paddingTop: 24, gap: 16, flexGrow: 1 }, frame]} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: C.text }}>내일을 함께 준비해요</Text>
            <Text style={{ fontSize: 13, color: C.sub }}>남겨 주신 말은 내일 대화에 바로 반영돼요.</Text>
          </View>

          <Panel>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: R.pill, backgroundColor: C.primarySoft }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: C.text }}>내일 계획 · {tomorrow.day}일차</Text>
              </View>
              <BigButton
                small
                label={read ? '낭독 완료 · 다시' : '낭독하기'}
                icon={<MicIcon />}
                onPress={() => router.navigate('/parent/plan' as Href)}
                style={{ borderRadius: R.pill, borderBottomWidth: 3 }}
              />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.text }}>
              {tomorrow.day === dayNum ? `${tomorrow.topic}${josa(tomorrow.topic, '을', '를')} 한 번 더 이어가요` : `${tomorrow.topic}에 대해 배워 봐요`}
            </Text>
            <View style={{ gap: 4 }}>
              {sentences.map((t, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: 4 }}>
                  <Text style={{ fontSize: 14, lineHeight: 21, color: C.text }}>•</Text>
                  <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: C.text }}>{t}</Text>
                </View>
              ))}
            </View>
            <Extra value={planExtra} onChange={setPlanExtra} placeholder="내일 더 해 보고 싶은 것" />
          </Panel>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>
              복습 추가 <Text style={{ fontWeight: '400', fontSize: 12, color: C.sub }}>내일 한 번 더 만나요</Text>
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {today.items.map((id) => (
                <PillChip
                  key={id}
                  label={ITEMS[id].ko}
                  icon={<Text style={{ fontSize: 20 }}>{ITEMS[id].emoji}</Text>}
                  selected={review.includes(id)}
                  onPress={() => toggle(review, setReview, id)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>내 아바타에게 바라는 점</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ISSUES.map((v) => (
                <PillChip key={v} label={v} selected={issues.includes(v)} onPress={() => toggle(issues, setIssues, v)} />
              ))}
            </View>
            {issues.includes('진동이 세요') && <Text style={{ fontSize: 12, color: C.sub }}>진동은 설정에서 끌 수 있어요. 내일은 더 약하게 쓸게요.</Text>}
            <Extra value={note} onChange={setNote} placeholder="예: 대답을 조금 더 기다려 주세요" />
            <Extra value={newWords} onChange={setNewWords} placeholder="예: 사과" label="+ 오늘 새로 말한 단어" />
          </View>

          <View style={{ flex: 1, minHeight: 8 }} />
          {!!msg && <Text style={{ fontSize: 14, fontWeight: '700', color: C.ok, textAlign: 'center' }}>{msg}</Text>}
          <BigButton label={saving ? '저장 중...' : '저장하기'} disabled={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
