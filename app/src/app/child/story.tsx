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
import { logEvent } from '@/lib/sense';
import { useProfile } from '@/lib/store';
import { C, R } from '@/theme';

export default function Story() {
  const profile = useProfile();
  const { fav } = useLocalSearchParams<{ fav?: string }>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const focused = useIsFocused();
  const { speak, stop, mouth, speaking } = useSpeak(profile?.childId);
  const scale = useMouthScale(profile?.childId);
  const { me, name } = who(profile);
  const story = dayOf(profile?.day ?? 1).story;
  const [page, setPage] = useState(0);
  const run = useRef(0);
  const introDone = useRef(false);

  const toEnd = useCallback(() => {
    stop();
    router.replace({ pathname: '/child/end', params: fav ? { fav } : {} });
  }, [stop, fav]);

  useDailyLimit(profile?.settings.dailyLimitMin, focused, toEnd);

  useEffect(() => {
    if (profile && !story) toEnd();
  }, [profile, story, toEnd]);

  // 한 장씩 읽고 → 잠깐 쉬고 → 자동으로 넘김. 마지막 장 다음은 마무리(3-8)
  useFocusEffect(
    useCallback(() => {
      if (!story) return;
      const t = ++run.current;
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
        run.current++;
        stop();
      };
    }, [story, page, speak, stop, me, name, toEnd]),
  );

  if (!story) return <View style={{ flex: 1, backgroundColor: C.primarySoft }} />;
  const cur = story.pages[page];

  return (
    <View style={{ flex: 1, backgroundColor: C.primarySoft, gap: 16, paddingTop: 16 + insets.top, paddingBottom: 16 + insets.bottom, paddingLeft: 40 + insets.left, paddingRight: 40 + insets.right }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 }}>
        <View style={{ backgroundColor: C.primary, borderRadius: R.pill, paddingHorizontal: 18, paddingVertical: 10 }}>
          <Text style={{ color: C.onPrimary, fontSize: 18, fontWeight: '800' }}>{story.title}</Text>
        </View>
        <PillButton
          small
          label="소리만 듣기"
          onPress={() => {
            stop();
            router.push('/child/audio');
          }}
        />
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: 20 }}>
        <View style={{ flex: 26, backgroundColor: C.white, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Avatar config={profile?.avatar} mouth={mouth} scale={scale} size={Math.min(height * 0.28, width * 0.16)} />
          <Text style={{ fontSize: 15, color: C.sub }}>{speaking ? '읽어주는 중' : ' '}</Text>
        </View>
        <View style={{ flex: 74, backgroundColor: '#EEF0F3', borderRadius: R.lg, borderWidth: 1.5, borderColor: C.muted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <Animated.Text
            key={page}
            entering={FadeIn.duration(700)}
            allowFontScaling={false}
            style={{ fontSize: Math.min(height * 0.3, 220), lineHeight: Math.min(height * 0.36, 260), includeFontPadding: false }}>
            {cur.emoji}
          </Animated.Text>
        </View>
      </View>

      <View style={{ backgroundColor: C.white, borderRadius: R.md, minHeight: 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Animated.Text key={page} entering={FadeIn.duration(500)} style={{ fontSize: 26, fontWeight: '800', color: C.text, textAlign: 'center' }}>
          {cur.text}
        </Animated.Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
        <View style={{ flex: 1, flexDirection: 'row', gap: 10 }}>
          {story.pages.map((_, i) => (
            <View
              key={i}
              style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: i === page ? C.primaryStrong : C.muted, backgroundColor: i === page ? C.primary : 'transparent' }}
            />
          ))}
        </View>
        <RoundButton label="이전 장" color={C.card} onPress={() => setPage(Math.max(0, page - 1))}>
          <ChevronIcon left color={C.sub} size={34} />
        </RoundButton>
        <RoundButton label="다음 장" onPress={() => (page + 1 < story.pages.length ? setPage(page + 1) : toEnd())}>
          <ChevronIcon size={34} />
        </RoundButton>
      </View>
    </View>
  );
}
