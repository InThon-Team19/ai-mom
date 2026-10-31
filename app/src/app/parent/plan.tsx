// 부모 앱 2-4 내일 계획 낭독 (탭 막대에는 없음 — 피드백 '낭독하기'에서 들어옴, 위 '‹'로 돌아감) · 민철 디자인 Plan 보드: 입모양을 보이며 읽기 → 입모양·음성 학습률 상승, 코칭, "낭독 완료" → 다음날 — 담당: 태희 (민철 와이어프레임 기준)
// 카메라 위 인식 표시(얼굴 틀·입 윤곽·체크)와 상태 문구는 기획 2-4 → components/FaceGuide
import { router, useIsFocused, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FaceGuide, ReadingText, doneSignal, useReadingWord } from '@/components/FaceGuide';
import type { FaceFrame } from '@/components/FaceTracker';
import { RingGauge } from '@/components/RingGauge';
import { BackHeader, Note, RecDot, SentenceLine } from '@/components/ui';
import { DAYS, dayOf, fill, type Day } from '@/content/curriculum';
import { useReadAloud } from '@/hooks/useReadAloud';
import { api } from '@/lib/api';
import { prefetchDay } from '@/lib/prefetch';
import { readingDonePatch } from '@/lib/progress';
import { updateProfile, useProfile, type Profile } from '@/lib/store';
import { C, T } from '@/theme';
import { useDevice } from '@/lib/layout';
import { goBack } from '@/lib/nav';
import { Text } from '@/components/AppText';

const DEFAULT_TIP = '카메라에 얼굴이 잘 보이게 하고, 입모양을 크게 보이며 천천히 읽어 주세요.';

export default function PlanScreen() {
  const profile = useProfile();
  if (!profile) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} />;
  const tomorrow = dayOf(Math.min(profile.day + 1, DAYS.length));
  // 일차가 바뀌면 낭독 상태(문장 진행)를 새로 시작
  return <PlanReader key={`${profile.day}-${tomorrow.day}`} profile={profile} plan={tomorrow} />;
}

function PlanReader({ profile, plan }: { profile: Profile; plan: Day }) {
  const focused = useIsFocused(); // 다른 탭에 있을 때는 카메라를 끔
  const name = profile.child.nickname || profile.child.name;
  const sentences = useMemo(
    () => plan.planSentences.map((t) => fill(t, { name, me: profile.parent.title })),
    [plan, name, profile.parent.title],
  );
  const device = useDevice();
  const ra = useReadAloud({ childId: profile.childId, sentences, kind: 'plan', camera: true });
  const [coaching, setCoaching] = useState<string[]>([]);
  const [camError, setCamError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const reading = useReadingWord(sentences[ra.index] ?? '', ra.recording);
  const { onFrame: raFrame } = ra;
  const { feed } = reading;
  const onFrame = useCallback(
    (f: FaceFrame) => {
      raFrame(f);
      feed(f);
    },
    [raFrame, feed],
  );

  // 녹음 중 다른 탭으로 가면 카메라와 함께 마이크도 끔 (보내지 않음)
  const { cancel, recording } = ra;
  useEffect(() => {
    if (!focused && recording) cancel();
  }, [focused, recording, cancel]);

  // 문장 하나 전송이 끝날 때마다(busy true → false) 코칭 갱신
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !ra.busy) {
      api
        .coaching(profile.childId)
        .then((r) => setCoaching(r.messages ?? []))
        .catch(() => {});
    }
    wasBusy.current = ra.busy;
  }, [ra.busy, profile.childId]);

  const progress = (ra.voice.progress + ra.mouth.progress) / 2;
  const baseline = (ra.voice.baseline + ra.mouth.baseline) / 2;
  const gain = Math.round(((ra.gain.voice + ra.gain.mouth) / 2) * 100);
  const doneCount = ra.statuses.filter((s) => s === 'done').length;
  const remaining = sentences.length - doneCount;
  const current = Math.min(ra.index + 1, sentences.length);

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      // 기획 2-7: 낭독 완료만 표시 → 다음날 아이 화면을 처음 켤 때 일차 +1 (설정 탭에 시연용 즉시 넘기기)
      const done = await updateProfile(readingDonePatch(profile));
      if (done.readingDone) prefetchDay(done, done.readingDone.forDay); // 다음 일차 엄마 목소리 미리 만들기
      api.registerVoice(profile.childId).catch(() => {}); // 부모 목소리 모델 갱신 (실패해도 계속)
      router.navigate('/parent' as Href);
    } finally {
      setFinishing(false);
    }
  };

  const tips = coaching.length ? coaching : [DEFAULT_TIP];

  // 디자인 Plan: ‹ 제목 · 설명 · 어두운 카메라(왼쪽 위 상태 알약) · 문장 목록(읽음/지금/남음) · 연두 도움말 · 아래 [● 읽기 시작][낭독 완료]
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={[{ padding: 20, paddingBottom: 12, gap: 12 }, device.frame]}>
        <View style={{ gap: 4 }}>
          <BackHeader title="내일 계획을 읽어 주세요" backLabel="피드백으로 돌아가기" onBack={() => goBack('/parent/feedback' as Href)} />
          <Text style={{ fontSize: 13, lineHeight: 20, color: C.sub }}>읽어 주신 목소리와 입모양으로 내일 아바타가 말해요.</Text>
        </View>

        {/* 학습률 (디자인 보드에는 없지만 낭독할 때마다 오르는 실제 값이라 작게 남김) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <RingGauge progress={progress} baseline={baseline} size={44} stroke={5} showBaselineText={false} fontScale={0.26} />
          <Text style={{ flex: 1, fontSize: 13, color: C.sub }}>
            입모양·음성 학습률 <Text style={{ fontWeight: '800', color: C.link }}>+{Math.max(0, gain)}%</Text> · {plan.day}일차 {plan.topic} · 문장 {remaining}개 남음
          </Text>
        </View>

        {focused ? (
          <FaceGuide
            onFrame={onFrame}
            onError={setCamError}
            recording={ra.recording}
            doneCount={doneSignal(ra.statuses, ra.allDone)}
            overlay
            style={{ ...device.camera, borderRadius: 16, backgroundColor: '#3A3128' }}
          />
        ) : (
          <View style={{ ...device.camera, borderRadius: 16, backgroundColor: '#3A3128' }} />
        )}
        {!!camError && <Text style={[T.small, { color: C.warn }]}>카메라를 켜지 못했어요. 카메라 권한을 확인해 주세요.</Text>}

        <View style={{ gap: 6 }} accessibilityLabel={`문장 ${current} / ${sentences.length}`}>
          {sentences.map((t, i) => {
            const st = ra.statuses[i];
            return (
              <SentenceLine
                key={i}
                state={st}
                text={st === 'now' ? <ReadingText text={t} word={reading.word} /> : t}
                right={st === 'done' ? '읽음' : st === 'retry' ? '다시' : undefined}
                disabled={ra.recording || ra.busy || st === 'now'}
                onPress={() => ra.setIndex(i)}
              />
            );
          })}
        </View>

        {!!ra.message && (
          <Text style={{ fontSize: 14, fontWeight: '600', color: ra.message === '좋아요!' ? C.ok : C.warn }}>{ra.message}</Text>
        )}

        <Note tone="green">
          <Text style={{ fontSize: 13, lineHeight: 21, color: C.text }}>
            <Text style={{ fontWeight: '800' }}>말하기 도움말</Text> · {tips.join(' ')}
          </Text>
        </Note>
      </ScrollView>

      <View style={[{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }, device.frame]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ra.recording ? '읽기 멈추고 보내기' : '읽기 시작'}
          onPress={ra.toggle}
          disabled={ra.busy || !focused}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 52,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: ra.recording ? '#E5484D' : C.primaryStrong,
            backgroundColor: ra.recording ? '#FDECEC' : 'transparent',
            flexDirection: 'row',
            gap: 6,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: ra.busy ? 0.5 : pressed ? 0.85 : 1,
          })}>
          {ra.recording ? <View style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: '#E5484D' }} /> : <RecDot />}
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{ra.busy ? '보내는 중...' : ra.recording ? `멈추기 · ${ra.seconds}초` : '읽기 시작'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: ra.recording || ra.busy || finishing }}
          onPress={finish}
          disabled={ra.recording || ra.busy || finishing}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 52,
            borderRadius: 14,
            paddingHorizontal: 8,
            backgroundColor: C.primary,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: ra.recording || ra.busy || finishing ? 0.45 : pressed ? 0.85 : 1,
          })}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: C.onPrimary, textAlign: 'center' }} numberOfLines={2}>
            {profile.readingDone ? '낭독 완료됨 · 내일 아침 시작' : '낭독 완료'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
