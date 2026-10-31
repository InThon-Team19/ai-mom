// 온보딩 1-5 목소리 등록 — 담당: 태희 (민철 와이어프레임 기준)
// 문장 낭독 녹음 → 서버 품질 확인 → 원형 학습률(최소 기준 눈금) 상승 → 다음 문장.
// 3문장 이상 읽으면 AI 특성 분석 + 의사소통 피드백 (기획 2-1-1 ⑤⑥). 떠날 때 TTS 목소리 등록 요청(실패 무시)
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { RingGauge } from '@/components/RingGauge';
import { Button, MicButton, Note, OnboardingScaffold, SentenceLine } from '@/components/ui';
import { VOICE_SENTENCES, fill } from '@/content/curriculum';
import { useReadAloud, type SentenceStatus } from '@/hooks/useReadAloud';
import { api } from '@/lib/api';
import { useProfile } from '@/lib/store';
import type { AnalysisOut } from '@/lib/types';
import { goNext } from '@/lib/nav';
import { C } from '@/theme';

const STATUS_LABEL: Record<SentenceStatus, string> = { done: '읽음', now: '지금', todo: '남음', retry: '다시' };

export default function VoiceSignup() {
  const edit = useLocalSearchParams<{ edit?: string }>().edit === '1';
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
    if (ra.recording || ra.busy) return; // '그래도 다음으로'를 녹음 중에 눌러도 마이크가 켜진 채 넘어가지 않게
    if (childId) api.registerVoice(childId).catch(() => {});
    goNext(edit, '/onboarding/mouth');
  };
  const onNext = () => {
    if (ra.recording || ra.busy) return;
    if (!g.usable && !warn) return setWarn(true);
    leave();
  };

  const footer = (
    <View style={{ gap: 12 }}>
      {warn && !g.usable && (
        <View style={warnBox}>
          <Text style={{ fontSize: 13, lineHeight: 20, color: C.text }}>
            아직 최소 기준에 닿지 않았어요. 지금 넘어가도 쓸 수 있지만 아바타 목소리가 어색할 수 있어요. 나중에 밤 낭독으로 채울 수 있어요.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="더 읽기" variant="outline" style={{ flex: 1, minHeight: 44 }} onPress={() => setWarn(false)} />
            <Button label="그래도 다음으로" style={{ flex: 1, minHeight: 44 }} onPress={leave} />
          </View>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          hitSlop={12}
          disabled={ra.recording || ra.index === 0}
          onPress={() => ra.setIndex(Math.max(0, ra.index - 1))}
          style={{ width: 84, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: ra.recording || ra.index === 0 ? 0.4 : 1 }}>
          <Text style={{ fontSize: 15, color: C.sub }}>이전 문장</Text>
        </Pressable>
        {/* 가운데 안내 글이 길어도 양옆 버튼을 밀어내지 않게 (폰 폭 360에서 '다음 단계'가 밖으로 밀리던 문제) */}
        <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <MicButton recording={ra.recording} onPress={ra.toggle} />
          <Text style={{ fontSize: 12, color: C.sub, minHeight: 16, textAlign: 'center' }}>
            {ra.recording ? `녹음 중 ${ra.seconds}초 · 다 읽으면 누르세요` : ra.busy ? '확인하는 중...' : ''}
          </Text>
        </View>
        <Pressable hitSlop={12} onPress={onNext} style={{ width: 84, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: ra.recording || ra.busy ? 0.4 : 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.link }}>다음 단계</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <OnboardingScaffold step={5} title="평소 목소리로 읽어 주세요" subtitle="읽을 때마다 아바타 목소리가 부모님과 더 닮아져요." footer={footer}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <RingGauge progress={g.progress} baseline={g.baseline} size={110} stroke={11} showBaselineText={false} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>음성 학습률</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.link }}>+{gainPct}%</Text>
          <Text style={{ fontSize: 13, color: C.sub }}>
            {g.usable ? '이제 아바타 목소리로 쓸 수 있어요. 더 읽으면 더 자연스러워져요.' : `${g.remaining_sentences}문장 더 읽으면 쓸 수 있어요`}
          </Text>
          <Text style={{ fontSize: 12, color: C.muted }}>지금까지 {g.sentences}문장</Text>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        {visible.map(({ text, i }) => (
          <SentenceLine
            key={i}
            text={text}
            state={ra.statuses[i]}
            right={STATUS_LABEL[ra.statuses[i]]}
            disabled={ra.recording || ra.busy || ra.statuses[i] === 'now'}
            onPress={() => ra.setIndex(i)}
          />
        ))}
      </View>

      {!!ra.message && (
        <Text style={{ fontSize: 14, fontWeight: '600', color: ra.message === '좋아요!' ? C.ok : C.warn }}>{ra.message}</Text>
      )}

      {doneCount >= 3 && analysis && (analysis.traits.length > 0 || analysis.tips.length > 0) && (
        <Note tone="green">
          <Text style={{ fontSize: 13, lineHeight: 21, color: C.text }}>
            <Text style={{ fontWeight: '800' }}>AI 말하기 특성</Text>
            {analysis.traits.map((t) => ` · ${t}`).join('')}
            {analysis.tips.length > 0 ? `
${analysis.tips.join(' ')}` : ''}
          </Text>
        </Note>
      )}
    </OnboardingScaffold>
  );
}

const warnBox = { gap: 10, padding: 14, borderRadius: 14, borderWidth: 2, borderColor: C.warnLine, backgroundColor: C.warnSoft } as const;
