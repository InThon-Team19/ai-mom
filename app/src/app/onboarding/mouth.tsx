// 온보딩 1-6 입모양 등록 — 담당: 태희 (민철 와이어프레임 기준)
// 문장을 읽으며 정면 촬영. 영상은 저장·전송하지 않고 기기 안에서 0.05초마다 잰 입모양 수치만 서버로 → 학습률 상승.
// 실제 부모 얼굴은 이 화면의 실시간 카메라 미리보기에만 보임. (표정 샘플 줄은 디자인 Mouth 보드에 없어 뺌 — 저장 기능이 없던 자리)
// 카메라 위 인식 표시(얼굴 틀·입 윤곽·체크)와 상태 문구는 기획 2-4 → components/FaceGuide
import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FaceGuide, ReadingText, doneSignal, useReadingWord } from '@/components/FaceGuide';
import type { FaceFrame } from '@/components/FaceTracker';
import { RingGauge } from '@/components/RingGauge';
import { Button, OnboardingScaffold, RecDot, SentenceLine } from '@/components/ui';
import { MOUTH_SENTENCES, fill } from '@/content/curriculum';
import { useReadAloud } from '@/hooks/useReadAloud';
import { updateProfile, useProfile } from '@/lib/store';
import { goNext } from '@/lib/nav';
import { C } from '@/theme';
import { useDevice } from '@/lib/layout';

export default function MouthSignup() {
  const edit = useLocalSearchParams<{ edit?: string }>().edit === '1';
  const p = useProfile();
  const name = p?.child.nickname || p?.child.name;
  const me = p?.parent.title;
  const sentences = useMemo(() => MOUTH_SENTENCES.map((s) => fill(s, { name, me })), [name, me]);
  const focused = useIsFocused(); // 다음 단계(1-7)로 가도 이 화면은 스택에 남음 → 카메라를 꺼야 함
  const device = useDevice(); // 폰: 화면 폭 / 태블릿: 가운데 최대 520, 높이는 화면의 일부
  const ra = useReadAloud({ childId: p?.childId, sentences, kind: 'signup', camera: true });
  const [camError, setCamError] = useState('');
  const [warn, setWarn] = useState(false);

  const g = ra.mouth;
  const gainPct = Math.round(ra.gain.mouth * 100);
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

  const prev = ra.index > 0 ? { text: sentences[ra.index - 1], status: ra.statuses[ra.index - 1] } : null;
  const next = ra.index < sentences.length - 1 ? sentences[ra.index + 1] : null;

  const leave = async () => {
    if (ra.recording || ra.busy) return; // '그래도 다음으로'를 촬영 중에 눌러도 녹음이 켜진 채 넘어가지 않게
    await updateProfile({}); // 진행 상태 동기화 (입모양 수치는 이미 서버에 저장됨)
    goNext(edit, '/onboarding/setup');
  };
  const onNext = () => {
    if (ra.recording || ra.busy) return;
    if (!g.usable && !warn) return setWarn(true);
    leave();
  };

  const recordLabel = ra.busy ? '확인하는 중...' : ra.recording ? `멈추기 · ${ra.seconds}초` : '촬영 시작';

  // 디자인 Mouth: 아래 노랑 "● 촬영 시작" 큰 버튼 + "다음 단계" 글자 링크
  const footer = (
    <View style={{ gap: 6 }}>
      {warn && !g.usable && (
        <View style={warnBox}>
          <Text style={{ fontSize: 13, lineHeight: 20, color: C.text }}>
            아직 최소 기준 전이에요. 넘어가도 되지만 아바타 입모양이 덜 자연스러울 수 있어요. 밤 계획 낭독 때 더 채워져요.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="더 촬영하기" variant="outline" style={{ flex: 1, minHeight: 44 }} onPress={() => setWarn(false)} />
            <Button label="그래도 다음으로" style={{ flex: 1, minHeight: 44 }} onPress={leave} />
          </View>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recordLabel}
        disabled={ra.busy}
        onPress={ra.toggle}
        style={({ pressed }) => ({
          minHeight: 56,
          borderRadius: 14,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ra.recording ? '#E5484D' : C.primary,
          opacity: ra.busy ? 0.5 : pressed ? 0.85 : 1,
        })}>
        {ra.recording ? <View style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: C.white }} /> : <RecDot size={18} />}
        <Text style={{ fontSize: 17, fontWeight: '700', color: ra.recording ? C.white : C.onPrimary }}>{recordLabel}</Text>
      </Pressable>
      {!warn && (
        <Pressable
          hitSlop={8}
          onPress={onNext}
          disabled={ra.recording || ra.busy}
          accessibilityRole="button"
          style={{ minHeight: 40, alignItems: 'center', justifyContent: 'center', opacity: ra.recording || ra.busy ? 0.4 : 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.link }}>다음 단계</Text>
        </Pressable>
      )}
    </View>
  );

  const ring = (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <RingGauge progress={g.progress} baseline={g.baseline} size={72} stroke={8} color={C.green} showBaselineText={false} fontScale={0.24} />
      {gainPct > 0 && <Text style={{ fontSize: 12, fontWeight: '700', color: C.link }}>+{gainPct}%</Text>}
    </View>
  );

  return (
    <OnboardingScaffold step={6} titleSize={24} title="입모양을 보여주세요" subtitle="얼굴은 저장하지 않고 입 벌림 수치만 남겨요." titleRight={ring} footer={footer}>
      {focused ? (
        <FaceGuide
          onFrame={onFrame}
          onError={setCamError}
          recording={ra.recording}
          doneCount={doneSignal(ra.statuses, ra.allDone)}
          overlay
          caption="얼굴은 저장하지 않아요"
          captionAlign="right"
          style={{ ...device.camera, borderRadius: 18, backgroundColor: '#3A3128' }}
        />
      ) : (
        <View style={{ ...device.camera, borderRadius: 18, backgroundColor: '#3A3128' }} />
      )}
      {!!camError && <Text style={{ fontSize: 13, color: C.warn }}>카메라를 켜지 못했어요. 카메라 권한을 확인해 주세요.</Text>}

      <View style={{ gap: 8 }}>
        {prev && <SentenceLine text={prev.text} state={prev.status === 'retry' ? 'retry' : 'done'} />}
        <SentenceLine text={<ReadingText text={sentences[ra.index] ?? ''} word={reading.word} />} state={ra.statuses[ra.index] === 'retry' ? 'retry' : 'now'} right={ra.statuses[ra.index] === 'retry' ? '다시' : undefined} />
        {next && <SentenceLine text={next} state="todo" />}
      </View>

      <Text style={{ fontSize: 12, color: C.sub }}>
        {g.usable ? '이제 아바타 입모양으로 쓸 수 있어요' : `문장 ${g.remaining_sentences}개 더 읽으면 쓸 수 있어요`}
      </Text>

      {!!ra.message && (
        <Text style={{ fontSize: 14, fontWeight: '600', color: ra.message === '좋아요!' ? C.ok : C.warn }}>{ra.message}</Text>
      )}
    </OnboardingScaffold>
  );
}

const warnBox = { gap: 10, padding: 14, borderRadius: 14, borderWidth: 2, borderColor: C.warnLine, backgroundColor: C.warnSoft } as const;
