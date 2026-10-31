// 온보딩 1-5 목소리 등록 — 담당: 태희 (민철 와이어프레임 기준)
// 문장 낭독 녹음 → 서버 품질 확인 → 원형 학습률(최소 기준 눈금) 상승 → 다음 문장.
// 3문장 이상 읽으면 AI 특성 분석 + 의사소통 피드백 (기획 2-1-1 ⑤⑥). 떠날 때 TTS 목소리 등록 요청(실패 무시)
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { RingGauge } from '@/components/RingGauge';
import { Button, Card, MicButton, OnboardingScaffold } from '@/components/ui';
import { VOICE_SENTENCES, fill } from '@/content/curriculum';
import { useReadAloud, type SentenceStatus } from '@/hooks/useReadAloud';
import { api } from '@/lib/api';
import { useProfile } from '@/lib/store';
import type { AnalysisOut } from '@/lib/types';
import { C, R } from '@/theme';

const STATUS_LABEL: Record<SentenceStatus, string> = { done: '읽음', now: '지금', todo: '남음', retry: '다시' };

export default function VoiceSignup() {
  const p = useProfile();
  const childId = p?.childId;
  const name = p?.child.nickname || p?.child.name;
  const me = p?.parent.title;
  const sentences = useMemo(() => VOICE_SENTENCES.map((s) => fill(s, { name, me })), [name, me]);
  const ra = useReadAloud({ childId, sentences, kind: 'signup', camera: false });
  const [analysis, setAnalysis] = useState<AnalysisOut | null>(null);
  const [warn, setWarn] = useState(false);

  const doneCount = ra.statuses.filter((s) => s === 'done').length;
  useEffect(() => {
    if (!childId || doneCount < 3) return;
    api.voiceAnalysis(childId).then(setAnalysis).catch(() => {});
  }, [childId, doneCount]);

  const g = ra.voice;
  const gainPct = Math.round(ra.gain.voice * 100);
  // 와이어프레임처럼 지금 문장 주변 5개만 (읽은 2 · 지금 · 남은 2)
  const from = Math.max(0, Math.min(ra.index - 2, sentences.length - 5));
  const visible = sentences.slice(from, from + 5).map((text, k) => ({ text, i: from + k }));

  const leave = () => {
    if (childId) api.registerVoice(childId).catch(() => {});
    router.push('/onboarding/mouth');
  };
  const onNext = () => {
    if (ra.recording || ra.busy) return;
    if (!g.usable && !warn) return setWarn(true);
    leave();
  };

  const footer = (
    <View style={{ gap: 12 }}>
      {warn && !g.usable && (
        <Card dashed>
          <Text style={{ fontSize: 14, color: C.text }}>
            아직 최소 기준에 닿지 않았어요. 지금 넘어가도 쓸 수 있지만 아바타 목소리가 어색할 수 있어요. 나중에 밤 낭독으로 채울 수 있어요.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="더 읽기" variant="outline" style={{ flex: 1, minHeight: 44 }} onPress={() => setWarn(false)} />
            <Button label="그래도 다음으로" style={{ flex: 1, minHeight: 44 }} onPress={leave} />
          </View>
        </Card>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          hitSlop={12}
          disabled={ra.recording || ra.index === 0}
          onPress={() => ra.setIndex(Math.max(0, ra.index - 1))}
          style={{ width: 96, alignItems: 'center', opacity: ra.recording || ra.index === 0 ? 0.4 : 1 }}>
          <Text style={{ fontSize: 16, color: C.sub }}>이전 문장</Text>
        </Pressable>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <MicButton recording={ra.recording} onPress={ra.toggle} />
          <Text style={{ fontSize: 12, color: C.sub, minHeight: 16 }}>
            {ra.recording ? `녹음 중 ${ra.seconds}초 · 다 읽으면 누르세요` : ra.busy ? '확인하는 중...' : ''}
          </Text>
        </View>
        <Pressable hitSlop={12} onPress={onNext} style={{ width: 96, alignItems: 'center', opacity: ra.recording || ra.busy ? 0.4 : 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: C.primary }}>다음 단계</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <OnboardingScaffold step={5} title="평소 목소리로 읽어주세요" subtitle="읽을 때마다 아바타 목소리가 더 정확해져요." footer={footer}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
        <RingGauge progress={g.progress} baseline={g.baseline} size={124} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>음성 학습률</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.primary }}>+{gainPct}%</Text>
          <Text style={{ fontSize: 14, color: C.sub }}>
            {g.usable ? '이제 아바타 목소리로 쓸 수 있어요. 더 읽으면 더 자연스러워져요.' : `${g.remaining_sentences}문장 더 읽으면 쓸 수 있어요`}
          </Text>
          <Text style={{ fontSize: 12, color: C.muted }}>지금까지 {g.sentences}문장</Text>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        {visible.map(({ text, i }) => (
          <SentenceRow key={i} text={text} status={ra.statuses[i]} disabled={ra.recording || ra.busy} onPress={() => ra.setIndex(i)} />
        ))}
      </View>

      {!!ra.message && (
        <Text style={{ fontSize: 14, fontWeight: '600', color: ra.message === '좋아요!' ? C.ok : C.warn }}>{ra.message}</Text>
      )}

      {doneCount >= 3 && analysis && (analysis.traits.length > 0 || analysis.tips.length > 0) && (
        <Card soft>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>AI 특성 분석</Text>
          {analysis.traits.map((t) => (
            <Text key={t} style={{ fontSize: 14, color: C.text }}>
              · {t}
            </Text>
          ))}
          {analysis.tips.length > 0 && <Text style={{ fontSize: 15, fontWeight: '800', color: C.text, marginTop: 4 }}>의사소통 피드백</Text>}
          {analysis.tips.map((t) => (
            <Text key={t} style={{ fontSize: 14, color: C.text }}>
              · {t}
            </Text>
          ))}
        </Card>
      )}
    </OnboardingScaffold>
  );
}

function SentenceRow({ text, status, disabled, onPress }: { text: string; status: SentenceStatus; disabled: boolean; onPress: () => void }) {
  const now = status === 'now';
  const done = status === 'done';
  return (
    <Pressable
      disabled={disabled || now}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: now ? 22 : 12,
        borderRadius: R.sm,
        borderWidth: now ? 2 : done ? 0 : 1,
        borderColor: now ? C.primary : C.border,
        backgroundColor: now ? C.primarySoft : done ? C.card : C.white,
      }}>
      <Text style={{ flex: 1, fontSize: now ? 20 : 15, fontWeight: now ? '800' : '400', color: done ? C.sub : C.text }}>{text}</Text>
      <Text style={{ fontSize: 13, color: status === 'retry' ? C.warn : C.sub, fontWeight: status === 'retry' ? '700' : '400' }}>
        {STATUS_LABEL[status]}
      </Text>
    </Pressable>
  );
}
