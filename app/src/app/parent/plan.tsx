// 부모 앱 2-4 내일 계획 낭독: 입모양을 보이며 읽기 → 입모양·음성 학습률 상승, 코칭, "낭독 완료" → 다음날 — 담당: 태희 (민철 와이어프레임 기준)
// 카메라 위 인식 표시(얼굴 틀·입 윤곽·체크)와 상태 문구는 기획 2-4 → components/FaceGuide
import { router, useIsFocused, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FaceGuide, ReadingText, doneSignal, useReadingWord } from '@/components/FaceGuide';
import type { FaceFrame } from '@/components/FaceTracker';
import { RingGauge } from '@/components/RingGauge';
import { Button, Card, H1, MicButton, Sub } from '@/components/ui';
import { DAYS, dayOf, fill, type Day } from '@/content/curriculum';
import { useReadAloud } from '@/hooks/useReadAloud';
import { api } from '@/lib/api';
import { prefetchDay } from '@/lib/prefetch';
import { readingDonePatch } from '@/lib/progress';
import { updateProfile, useProfile, type Profile } from '@/lib/store';
import { C, R, T } from '@/theme';
import { useDevice } from '@/lib/layout';

const DEFAULT_TIP = '카메라에 얼굴이 잘 보이게 하고, 입모양을 크게 보이며 천천히 읽어주세요.';

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

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={[{ padding: 20, gap: 14 }, device.frame]}>
        <View style={{ gap: 6 }}>
          <H1>내일 {plan.day}일차 계획</H1>
          <Sub>쭉 읽어주세요. 입모양을 보이며 읽을수록 학습률이 올라가요.</Sub>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <RingGauge progress={progress} baseline={baseline} size={92} stroke={10} showBaselineText={false} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>입모양·음성 학습률</Text>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.link }}>+{Math.max(0, gain)}%</Text>
            <Text style={T.small}>검은 눈금이 최소 기준 · 문장 {remaining}개 남음</Text>
          </View>
        </View>

        {focused ? (
          <FaceGuide
            onFrame={onFrame}
            onError={setCamError}
            recording={ra.recording}
            doneCount={doneSignal(ra.statuses, ra.allDone)}
            style={{ ...device.camera, borderRadius: R.sm, borderWidth: 1, borderColor: C.border }}
          />
        ) : (
          <View style={{ ...device.camera, borderRadius: R.sm, backgroundColor: C.card }} />
        )}
        {!!camError && <Text style={[T.small, { color: C.warn }]}>카메라 오류: {camError.slice(0, 60)}</Text>}

        <Card style={{ gap: 8 }}>
          <Text style={T.small}>
            {plan.day}일차 · {plan.topic} · 문장 {current} / {sentences.length}
          </Text>
          {sentences.map((t, i) => {
            const st = ra.statuses[i];
            const now = st === 'now';
            return (
              <View
                key={i}
                style={now ? { backgroundColor: C.primarySoft, borderRadius: R.sm, paddingHorizontal: 10, paddingVertical: 8 } : { paddingHorizontal: 2 }}>
                <Text
                  style={{
                    fontSize: now ? 18 : 15,
                    fontWeight: now ? '800' : '400',
                    color: st === 'done' ? C.muted : st === 'retry' ? C.warn : C.text,
                  }}>
                  {st === 'done' ? '✓ ' : st === 'retry' ? '↻ ' : ''}
                  {now ? <ReadingText text={t} word={reading.word} /> : t}
                </Text>
              </View>
            );
          })}
        </Card>

        {!!ra.message && (
          <Text style={{ fontSize: 14, fontWeight: '600', color: ra.message === '좋아요!' ? C.ok : C.warn }}>{ra.message}</Text>
        )}

        <Card style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.border, gap: 4 }}>
          {(coaching.length ? coaching : [DEFAULT_TIP]).map((m, i) => (
            <Text key={i} style={T.body}>
              {i === 0 && <Text style={{ fontWeight: '800' }}>코칭 </Text>}
              {m}
            </Text>
          ))}
        </Card>
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 }}>
        <MicButton recording={ra.recording} onPress={ra.toggle} size={64} />
        <Button
          label={profile.readingDone ? "낭독 완료됨 · 내일 아침 시작" : "낭독 완료"}
          variant="outline"
          disabled={ra.recording || ra.busy || finishing}
          onPress={finish}
          style={{ flex: 1 }}
        />
      </View>
      {ra.busy && <Text style={[T.small, { textAlign: 'center', paddingBottom: 6 }]}>보내는 중...</Text>}
    </SafeAreaView>
  );
}
