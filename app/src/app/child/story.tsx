// 아이 태블릿 3-6 전래동화 (아바타가 읽어주고 장면 그림이 넘어감) — 담당: 태희 (민철 와이어프레임 기준)
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { ChevronIcon, PillButton, RoundButton, sleep, useDailyLimit, useMouthScale, who } from '@/components/child/kit';
import { dayOf, fill } from '@/content/curriculum';
import { useSpeak } from '@/hooks/useSpeak';
import { api } from '@/lib/api';
import { logEvent } from '@/lib/sense';
import { useProfile } from '@/lib/store';
import { C, R } from '@/theme';
import { ParentExit, parentExitZone } from '@/components/ParentExit';
import { useDevice } from '@/lib/layout';

export default function Story() {
  const profile = useProfile();
  const { fav, basket } = useLocalSearchParams<{ fav?: string; basket?: string }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { isTablet } = useDevice();
  const focused = useIsFocused();
  const { speak, stop, mouth, speaking } = useSpeak(profile?.childId);
  const scale = useMouthScale(profile?.childId);
  const { me, name } = who(profile);
  const story = dayOf(profile?.day ?? 1).story;
  const childId = profile?.childId;
  const [page, setPage] = useState(0);
  const run = useRef(0);
  const introDone = useRef(false);

  const toEnd = useCallback(() => {
    stop();
    router.replace({ pathname: '/child/end', params: { ...(fav ? { fav } : {}), ...(basket ? { basket } : {}) } }); // 바구니는 마무리까지 넘김
  }, [stop, fav, basket]);

  useDailyLimit(profile?.settings.dailyLimitMin, focused, toEnd);

  useEffect(() => {
    if (profile && !story) toEnd();
  }, [profile, story, toEnd]);

  // 한 장씩 읽고 → 잠깐 쉬고 → 자동으로 넘김. 마지막 장 다음은 마무리(3-8)
  useFocusEffect(
    useCallback(() => {
      if (!story || !childId) return; // 프로필 전엔 childId 가 없어 기기 음성으로 읽게 됨 → 기다림
      const t = ++run.current;
      // 다음 장 엄마 목소리를 미리 만들어 둠 (지금 장 목소리를 받은 뒤쯤 · 읽는 동안 준비 → 넘어갈 때 오래 멈추거나 기기 음성으로 바뀌지 않게)
      const nextText = story.pages[page + 1]?.text;
      const pre = nextText ? setTimeout(() => api.tts(childId, nextText).catch(() => {}), 3000) : null;
      (async () => {
        await sleep(500);
        if (t !== run.current) return;
        if (page === 0 && !introDone.current) {
          introDone.current = true;
          await speak(fill(`{me}가 동화책 읽어줄게. ${story.title}!`, { me, name }));
          if (t !== run.current) return;
          await sleep(500);
        }
        const t0 = Date.now();
        await speak(story.pages[page].text);
        if (t !== run.current) return;
        logEvent('listen', { seconds: Math.round((Date.now() - t0) / 100) / 10, story: story.title, page: page + 1 });
        await sleep(1500);
        if (t !== run.current) return;
        if (page + 1 < story.pages.length) setPage(page + 1);
        else toEnd();
      })();
      return () => {
        if (pre) clearTimeout(pre);
        run.current++;
        stop();
      };
    }, [story, page, speak, stop, me, name, toEnd, childId]),
  );

  if (!story) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  const cur = story.pages[page];
  // 폰 가로(높이 약 360): 여백·글자·버튼을 줄여 아바타 칸이 문장 상자 위로 넘치지 않게 (태블릿은 그대로)
  const compact = height < 520;
  const gap = compact ? 8 : 16;
  const navSize = compact ? 64 : 96;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.bg,
        gap,
        paddingTop: (compact ? 6 : 16) + insets.top,
        paddingBottom: (compact ? 6 : 16) + insets.bottom,
        paddingLeft: parentExitZone(isTablet) + 10 + insets.left,
        paddingRight: (compact ? 20 : 40) + insets.right,
      }}>
      <ParentExit home />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: compact ? 44 : 52 }}>
        <View style={{ flexShrink: 1, backgroundColor: C.primary, borderRadius: R.pill, paddingHorizontal: 18, paddingVertical: compact ? 6 : 10 }}>
          <Text numberOfLines={1} style={{ color: C.onPrimary, fontSize: compact ? 16 : 18, fontWeight: '800' }}>
            {story.title}
          </Text>
        </View>
        <PillButton
          small
          style={compact ? { minHeight: 44 } : undefined}
          label="소리만 듣기"
          onPress={() => {
            stop();
            router.push('/child/audio');
          }}
        />
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: compact ? 12 : 20 }}>
        <View style={{ flex: 26, backgroundColor: C.white, borderRadius: R.lg, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', gap: compact ? 4 : 12, overflow: 'hidden' }}>
          <Avatar config={profile?.avatar} mouth={mouth} scale={scale} size={Math.min(height * (compact ? 0.22 : 0.3), width * 0.17)} expression={speaking ? 'neutral' : 'smile'} />
          <Text style={{ fontSize: compact ? 13 : 15, color: C.sub }}>{speaking ? '읽어주는 중' : ' '}</Text>
        </View>
        <View style={{ flex: 74, backgroundColor: C.greenSoft, borderRadius: R.lg, borderWidth: 2, borderColor: C.green, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <Animated.Text
            key={page}
            entering={FadeIn.duration(700)}
            allowFontScaling={false}
            style={{ fontSize: Math.min(height * (compact ? 0.24 : 0.3), 220), lineHeight: Math.min(height * (compact ? 0.29 : 0.36), 260), includeFontPadding: false }}>
            {cur.emoji}
          </Animated.Text>
        </View>
      </View>

      <View style={{ backgroundColor: C.white, borderRadius: R.md, minHeight: compact ? 52 : 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: compact ? 16 : 24, paddingVertical: compact ? 4 : 8 }}>
        <Animated.Text
          key={page}
          entering={FadeIn.duration(500)}
          numberOfLines={compact ? 2 : 3}
          adjustsFontSizeToFit
          style={{ fontSize: compact ? 20 : 26, lineHeight: compact ? 26 : 34, fontWeight: '800', color: C.text, textAlign: 'center' }}>
          {cur.text}
        </Animated.Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 14 : 20 }}>
        <View style={{ flex: 1, flexDirection: 'row', gap: 10 }}>
          {story.pages.map((_, i) => (
            <View
              key={i}
              style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: i === page ? C.primaryStrong : C.muted, backgroundColor: i === page ? C.primary : 'transparent' }}
            />
          ))}
        </View>
        <RoundButton label="이전 장" size={navSize} color={C.card} onPress={() => setPage(Math.max(0, page - 1))}>
          <ChevronIcon left color={C.onPrimary} size={compact ? 28 : 34} />
        </RoundButton>
        <RoundButton label="다음 장" size={navSize} onPress={() => (page + 1 < story.pages.length ? setPage(page + 1) : toEnd())}>
          <ChevronIcon size={compact ? 28 : 34} />
        </RoundButton>
      </View>
    </View>
  );
}
