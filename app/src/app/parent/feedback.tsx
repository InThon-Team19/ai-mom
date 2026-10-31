// 부모 앱 2-3 피드백 (민철 디자인 Feedback 개정판): 머리 막대 "피드백" · 내일 N일차 · 아바타 말풍선 · 내일 계획(낭독하기) · 복습 추가 · 피드백(바라는 점) · 저장 — 담당: 태희
// 저장 형식은 그대로 (profile.feedback: day · issues · note · review · newWords). 내일 계획 '+ 기타'는 note 에 합쳐 저장, 복습 '+ 기타'는 newWords
import { router, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Avatar } from '@/components/Avatar';
import { BigButton, Bubble, MicIcon } from '@/components/ui';
import { DAYS, ITEMS, dayOf, fill } from '@/content/curriculum';
import { useDevice } from '@/lib/layout';
import { josa, readToday } from '@/lib/progress';
import { updateProfile, useProfile, type Profile } from '@/lib/store';
import { C, R } from '@/theme';

const ISSUES = ['말이 빨라요', '질문이 어려워요', '진동이 세요', '더 기다려 주세요'];
const PLAN_PREFIX = '내일 해 보고 싶은 것: ';

const ReviewIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path d="M20 12a8 8 0 1 1-2.34-5.66" stroke={C.text} strokeWidth={2.2} fill="none" strokeLinecap="round" />
    <Path d="M20 4v5h-5" stroke={C.text} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const TalkIcon = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24">
    <Path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" stroke={C.text} strokeWidth={2} fill="none" strokeLinejoin="round" />
  </Svg>
);

/** 구역 머리: 둥근 색 아이콘 + 제목 */
function SectionHead({ icon, color, title }: { icon: ReactNode; color: string; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <Text style={{ fontSize: 19, fontWeight: '800', color: C.text }}>{title}</Text>
    </View>
  );
}

/** 두툼한 선택 칩 (디자인: 높이 46 · 모서리 14 · 아래 테두리 4) */
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 46,
        paddingHorizontal: 18,
        justifyContent: 'center',
        borderRadius: 14,
        borderWidth: 2,
        borderBottomWidth: 4,
        borderColor: selected ? C.primaryStrong : C.border,
        backgroundColor: selected ? C.primarySoft : C.white,
      }}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>{label}</Text>
    </Pressable>
  );
}

/** '+ 기타' 입력 (한 줄 / 여러 줄) */
function Extra({ value, onChange, placeholder, multiline }: { value: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: C.sub }}>+ 기타</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.sub}
        accessibilityLabel={placeholder}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          minHeight: multiline ? 96 : 48,
          borderWidth: 2,
          borderColor: C.track,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
          backgroundColor: C.card,
          fontSize: 14,
          color: C.text,
        }}
      />
    </View>
  );
}

const Divider = () => <View style={{ height: 1, backgroundColor: C.border }} />;

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

  const edit = (set: (v: string) => void) => (v: string) => {
    setMsg('');
    set(v);
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
      <View style={{ height: 52, paddingLeft: 20, paddingRight: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>피드백</Text>
        <View style={{ flexShrink: 1, marginLeft: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, backgroundColor: C.primarySoft }}>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: C.link }}>
            내일 {tomorrow.day}일차 · {tomorrow.topic}
          </Text>
        </View>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[{ padding: 20, paddingBottom: 28, gap: 20, flexGrow: 1 }, frame]} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }} accessibilityLabel={`${profile.parent.title} 아바타`}>
              <Avatar config={profile.avatar} size={96} expression="smile" />
            </View>
            <Bubble style={{ alignSelf: 'stretch' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', lineHeight: 22, color: C.text }}>
                내일 내가 아이에게 할 말을 정해 주세요. 남겨 주신 내용은 내일 대화에 바로 반영돼요.
              </Text>
            </Bubble>
          </View>

          <View style={{ gap: 10 }}>
            <SectionHead icon={<MicIcon />} color={C.primary} title="내일 계획" />
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>
              {tomorrow.day === dayNum ? `${tomorrow.topic}${josa(tomorrow.topic, '을', '를')} 한 번 더 이어가요` : `${tomorrow.topic}에 대해 배워 봐요`}
            </Text>
            <View style={{ gap: 8 }}>
              {sentences.map((t, i) => (
                <View key={i} style={{ paddingVertical: 13, paddingHorizontal: 16, borderRadius: 14, borderWidth: 2, borderBottomWidth: 4, borderColor: C.border, backgroundColor: C.white }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', lineHeight: 21, color: C.text }}>{t}</Text>
                </View>
              ))}
            </View>
            <BigButton
              variant="outline"
              label={read ? '낭독 완료 · 다시 낭독하기' : '탭하여 낭독하기'}
              icon={<MicIcon color={C.link} />}
              onPress={() => router.navigate('/parent/plan' as Href)}
              style={{ minHeight: 54, borderRadius: 14 }}
            />
            {read && <Text style={{ fontSize: 12, fontWeight: '700', color: C.ok, textAlign: 'center' }}>오늘 밤 낭독을 마쳤어요</Text>}
            <Extra value={planExtra} onChange={edit(setPlanExtra)} placeholder="더 하고 싶은 말을 적어 주세요" />
          </View>

          <Divider />

          <View style={{ gap: 10 }}>
            <SectionHead icon={<ReviewIcon />} color={C.green} title="복습 추가" />
            <Text style={{ fontSize: 13, color: C.sub }}>내일 한 번 더 보여 줄 단어를 골라 주세요</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {today.items.map((id) => (
                <Choice key={id} label={ITEMS[id].ko} selected={review.includes(id)} onPress={() => toggle(review, setReview, id)} />
              ))}
            </View>
            <Extra value={newWords} onChange={edit(setNewWords)} placeholder="집에서 새로 말한 단어 (예: 까까)" />
          </View>

          <Divider />

          <View style={{ gap: 10 }}>
            <SectionHead icon={<TalkIcon />} color={C.warnLine} title="피드백" />
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>내 아바타에게 바라는 점</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ISSUES.map((v) => (
                <Choice key={v} label={v} selected={issues.includes(v)} onPress={() => toggle(issues, setIssues, v)} />
              ))}
            </View>
            {issues.includes('진동이 세요') && <Text style={{ fontSize: 12, color: C.sub }}>진동은 설정에서 끌 수 있어요. 내일은 더 약하게 쓸게요.</Text>}
            <Extra value={note} onChange={edit(setNote)} placeholder="예: 바나나를 좋아하니 내일 한 번 더 보여 주세요" multiline />
          </View>

          <View style={{ flex: 1, minHeight: 4 }} />
          {!!msg && <Text style={{ fontSize: 14, fontWeight: '700', color: msg.startsWith('저장했어요') ? C.ok : C.warn, textAlign: 'center' }}>{msg}</Text>}
          <BigButton label={saving ? '저장 중...' : '저장하기'} disabled={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
