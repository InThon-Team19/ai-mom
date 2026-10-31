// 아이 태블릿 3-7 청각 집중 모드 (화면을 어둡게 하고 부모 목소리로만 이어서 들려줌 — 스크린 타임 대응) — 담당: 태희 (민철 Design 보드 KidAudio)
// 보드: 밤하늘(별·달·언덕) · 부모/홈 · "엄마 목소리만 들어요" · 동그라미 속 아바타 · 소리 막대 · 지금 문장 · 화면 켜기
// 감각 자극 제한: 깜빡임 없음 — 원·막대는 목소리 크기만큼 부드럽게만 움직임
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, G } from 'react-native-svg';

import { ParentFrameAvatar } from '@/components/ParentFrameAvatar';
import { ChunkyButton, HomePill, K, KidScreen, MonitorIcon, SkipNextIcon, useKid } from '@/components/child/design';
import { sleep, useMouthScale, who } from '@/components/child/kit';
import { ParentExit } from '@/components/ParentExit';
import { dayOf, fill, ITEMS } from '@/content/curriculum';
import { useSpeak } from '@/hooks/useSpeak';
import { logEvent } from '@/lib/sense';
import { useProfile } from '@/lib/store';
import { Text } from '@/components/AppText';

export default function AudioOnly() {
  const profile = useProfile();
  const { u, f, width, height, compact, insets } = useKid();
  const { speak, stop, mouth, avatarDriver } = useSpeak(profile?.childId, true);
  const scale = useMouthScale(profile?.childId);
  const { name, me, english } = who(profile);
  const [from, setFrom] = useState({ at: 0 }); // "다음" 누를 때마다 새 객체 → 흐름을 그 문장부터 다시 시작
  const [now, setNow] = useState(''); // 지금 들려주는 문장
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
          setNow(lines[i].text);
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

  // 동그라미 크기: 보드 비율이되 남는 높이를 넘지 않게 (4:3 아이패드·Galaxy Tab 에서 문장 두 줄이면 위 알약·아래 버튼과 겹치던 문제)
  const lineH = (n: number) => Math.round(n * 1.35);
  const rest =
    u(48, 36) + // 위 알약
    lineH(f(32, 18)) + // 제목
    u(56, 26) + u(16, 2) + // 소리 막대
    (compact ? 0 : lineH(f(38, 18)) * 2) + // 지금 문장 (최대 두 줄)
    u(78, 44) + u(4, 2) + // 버튼
    u(18, 4) * (compact ? 3 : 4); // 사이 간격
  const avail = height - insets.top - insets.bottom - u(30, 8) - u(34, 8);
  const ring = Math.round(Math.max(120, Math.min(u(366, 150), avail - rest - 8)));
  const av = Math.round(ring * (186 / 366));
  const k = Math.max(0, Math.min(1, mouth));
  const bars = [18, 32, 46, 56, 42, 30, 44];

  return (
    <KidScreen dark gap={0} style={{ alignItems: 'center' }}>
      {/* 밤하늘: 별 · 초승달 · 언덕 */}
      <Svg width={width} height={height} viewBox="0 0 1180 820" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', left: 0, top: 0 }}>
        <G fill={K.moon}>
          <Circle cx="310" cy="88" r="3" />
          <Circle cx="160" cy="140" r="3" />
          <Circle cx="528" cy="160" r="3" />
          <Circle cx="766" cy="96" r="3" />
          <Circle cx="1092" cy="88" r="3" />
          <Circle cx="100" cy="425" r="3" />
          <Circle cx="1100" cy="465" r="3" />
          <Circle cx="252" cy="640" r="3" />
          <Circle cx="905" cy="300" r="2.5" />
          <Circle cx="260" cy="330" r="2.5" />
        </G>
        <Circle cx="1018" cy="138" r="60" fill={K.moon} />
        <Circle cx="1044" cy="114" r="54" fill={K.night} />
        <Ellipse cx="182" cy="702" rx="172" ry="58" fill={K.nightSoft} />
        <Ellipse cx="1008" cy="730" rx="178" ry="68" fill={K.nightSoft} />
      </Svg>

      <View style={{ alignSelf: 'stretch', flexDirection: 'row', gap: u(10, 6) }}>
        <ParentExit dark />
        <HomePill dark onBefore={stop} />
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: u(18, 4) }}>
        <Text style={{ fontSize: f(32, 18), fontWeight: '800', color: K.white }}>{me} 목소리만 들어요</Text>
        {/* 동그라미 속 아바타 (목소리 크기만큼 안쪽 원이 살짝 커짐) */}
        <View style={{ width: ring, height: ring, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={ring} height={ring} viewBox="0 0 366 366" style={{ position: 'absolute' }}>
            <Circle cx="183" cy="183" r={181} stroke={K.nightRing} strokeWidth={2.5} fill="none" />
            <Circle cx="183" cy="183" r={148 + k * 8} stroke={K.nightRing} strokeWidth={3} fill="none" />
            <Circle cx="183" cy="183" r={116 + k * 6} stroke={K.nightRing2} strokeWidth={4} fill="none" />
          </Svg>
          <View style={{ width: av, height: av, borderRadius: av / 2, borderWidth: u(6, 3), borderColor: K.bg, backgroundColor: K.peach, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' }}>
            <ParentFrameAvatar driver={avatarDriver} config={profile?.avatar} mouth={mouth} scale={scale} size={Math.round(av * 0.86)} expression="smile" />
          </View>
        </View>
        {/* 소리 막대 */}
        <View accessibilityElementsHidden style={{ flexDirection: 'row', alignItems: 'flex-end', gap: u(9, 5), height: u(56, 26), marginTop: u(16, 2) }}>
          {bars.map((b, i) => (
            <View key={i} style={{ width: u(10, 6), borderRadius: u(5, 3), backgroundColor: K.mint, height: Math.max(u(10, 6), u(b, 6) * (0.35 + 0.65 * k)) }} />
          ))}
        </View>
        {!compact && !!now && (
          <Text numberOfLines={2} style={{ maxWidth: '86%', fontSize: f(38, 18), fontWeight: '800', color: K.white, textAlign: 'center' }}>
            &quot;{now}&quot;
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(18, 10), marginTop: u(4, 2) }}>
          <ChunkyButton
            label="화면 켜기"
            icon={<MonitorIcon size={u(26, 18)} />}
            onPress={() => {
              stop();
              if (router.canGoBack()) router.back();
              else router.replace('/child');
            }}
            height={u(78, 44)}
            width={u(355, 180)}
            fontSize={f(28, 16)}
            d={u(6, 3)}
          />
          <ChunkyButton a11y="다음 문장" icon={<SkipNextIcon size={u(28, 18)} />} onPress={skip} color={K.nightSoft} deep="#1E1940" height={u(78, 44)} width={u(78, 44)} fontSize={f(20)} d={u(6, 3)} />
        </View>
      </View>
    </KidScreen>
  );
}
