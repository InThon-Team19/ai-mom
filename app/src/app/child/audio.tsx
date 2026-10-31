// 아이 태블릿 3-7 청각 집중 모드 (화면을 어둡게 하고 부모 목소리로만 이어서 들려줌 — 스크린 타임 대응) — 담당: 태희 (민철 와이어프레임 기준)
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PillButton, RoundButton, SkipIcon, Waveform, sleep, who } from '@/components/child/kit';
import { dayOf, fill, ITEMS } from '@/content/curriculum';
import { useSpeak } from '@/hooks/useSpeak';
import { logEvent } from '@/lib/sense';
import { useProfile } from '@/lib/store';
import { ParentExit } from '@/components/ParentExit';

const BG = '#2A2219'; // 어둡게 (스크린 타임 대응) — 따뜻한 진한 갈색

export default function AudioOnly() {
  const profile = useProfile();
  const insets = useSafeAreaInsets();
  const compact = useWindowDimensions().height < 520;
  const { speak, stop, mouth } = useSpeak(profile?.childId);
  const { name, me, english } = who(profile);
  const [from, setFrom] = useState({ at: 0 }); // "다음" 누를 때마다 새 객체 → 흐름을 그 문장부터 다시 시작
  const pos = useRef(0);
  const run = useRef(0);

  // 오늘 사물 권하기·이름·따라 말하기 → 동화 → 인사 (사이사이 쉬어 감)
  const lines = useMemo(() => {
    const d = dayOf(profile?.day ?? 1);
    const out: { text: string; pause: number }[] = [];
    for (const id of d.items) {
      const it = ITEMS[id];
      out.push({ text: fill(it.invite, { name, me }), pause: 1500 });
      out.push({ text: english ? `${it.ko}! ${it.en}!` : `${it.ko}!`, pause: 1500 });
      out.push({ text: `같이 따라 해 볼까? ${it.ko}!`, pause: 3000 }); // 아이가 따라 말할 틈
    }
    if (d.story) {
      out.push({ text: fill(`{me}가 동화책 읽어줄게. ${d.story.title}!`, { name, me }), pause: 1000 });
      for (const p of d.story.pages) out.push({ text: p.text, pause: 1500 });
    }
    out.push({ text: fill('잘 들었어, 우리 {name}! 사랑해.', { name, me }), pause: 0 });
    return out;
  }, [profile?.day, name, me, english]);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      const t = ++run.current;
      (async () => {
        await sleep(600);
        for (let i = from.at; i < lines.length; i++) {
          if (t !== run.current) return;
          pos.current = i;
          const t0 = Date.now();
          await speak(lines[i].text);
          if (t !== run.current) return;
          logEvent('listen', { seconds: Math.round((Date.now() - t0) / 100) / 10, mode: 'audio' });
          await sleep(lines[i].pause);
        }
      })();
      return () => {
        run.current++;
        stop();
      };
    }, [profile, lines, speak, stop, from]),
  );

  /** 다음 문장으로 건너뛰기 (끝이면 처음부터) */
  const skip = () => {
    const n = pos.current + 1;
    setFrom({ at: n < lines.length ? n : 0 });
  };

  return (
    // 폰 가로(높이 약 360)에선 간격을 줄여 '다음' 버튼이 아래에 붙거나 잘리지 않게
    <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', gap: compact ? 16 : 36, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <ParentExit dark home />
      <Waveform level={mouth} />
      <Text style={{ fontSize: compact ? 26 : 32, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' }}>{me} 목소리를 들어봐요</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
        <PillButton
          dark
          label="화면 켜기"
          onPress={() => {
            stop();
            if (router.canGoBack()) router.back();
            else router.replace('/child');
          }}
        />
        <RoundButton label="다음" size={88} onPress={() => skip()}>
          <SkipIcon size={30} color={BG} />
        </RoundButton>
      </View>
    </View>
  );
}
