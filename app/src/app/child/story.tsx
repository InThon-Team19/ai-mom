// 아이 태블릿 3-6 전래동화 (아바타가 읽어주고 장면 그림이 넘어감) — 담당: 태희 (민철 Design 보드 Story)
// 보드: 머리줄(닫기 · 책 + 제목 · n / N장 · 부모) · 큰 흰 카드(위 장면 그림 + "읽어 주는 중" · 아래 문장) · 아래 이전 장 / 소리만 듣기 / 다음 장
import { router, useFocusEffect, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { FadeIn } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { Avatar } from '@/components/Avatar';
import { BookIcon, ChevIcon, ChunkyButton, CloseButton, K, KidScreen, SOFT2, SpeakerIcon, TopBar, useKid } from '@/components/child/design';
import { sleep, useDailyLimit, useMouthScale, who } from '@/components/child/kit';
import { ParentExit } from '@/components/ParentExit';
import { dayOf, fill } from '@/content/curriculum';
import { useSpeak } from '@/hooks/useSpeak';
import { api } from '@/lib/api';
import { logEvent } from '@/lib/sense';
import { useProfile } from '@/lib/store';
import { AnimatedText, Text } from '@/components/AppText';

export default function Story() {
  const profile = useProfile();
  const { fav, basket } = useLocalSearchParams<{ fav?: string; basket?: string }>();
  const { u, f, compact } = useKid();
  const focused = useIsFocused();
  const { speak, stop, mouth, speaking } = useSpeak(profile?.childId);
  const scale = useMouthScale(profile?.childId);
  const { me, name } = who(profile);
  const story = dayOf(profile?.day ?? 1).story;
  const childId = profile?.childId;
  const [page, setPage] = useState(0);
  const [scene, setScene] = useState({ w: 0, h: 0 });
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

  if (!story) return <View style={{ flex: 1, backgroundColor: K.bg }} />;
  const cur = story.pages[page];
  const textFont = f(34, 17);
  const btnH = u(72, 42);
  const chip = u(32, 24);

  return (
    <KidScreen gap={18}>
      <TopBar
        left={<CloseButton onBefore={stop} />}
        title={story.title}
        icon={<BookIcon size={u(24, 16)} />}
        right={<ParentExit />}
      />
      <Text style={{ marginTop: -u(14, 6), alignSelf: 'center', fontSize: f(15, 11), color: K.sub }}>
        {page + 1} / {story.pages.length}장
      </Text>

      {/* 큰 흰 카드: 위 장면 그림 · 아래 문장 */}
      <View style={{ flex: 1, minHeight: 0, borderRadius: u(36, 18), backgroundColor: K.white, boxShadow: '0px 6px 20px rgba(58,54,78,0.06)', overflow: 'hidden' }}>
        <View style={{ flex: 1, minHeight: 0 }} onLayout={(e) => setScene({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {/* 장면 바탕 (보드: 하늘 · 구름 · 해 · 언덕). 장마다 그림은 가운데 큰 그림 */}
          {scene.w > 0 && (
            <Svg width={scene.w} height={scene.h} viewBox="0 0 1077 411" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', left: 0, top: 0 }}>
              <Rect width="1077" height="411" fill="#CFE6F8" />
              <Ellipse cx="200" cy="54" rx="82" ry="26" fill="#fff" />
              <Ellipse cx="242" cy="36" rx="50" ry="26" fill="#fff" />
              <Ellipse cx="690" cy="28" rx="80" ry="24" fill="#fff" />
              <Ellipse cx="732" cy="12" rx="46" ry="22" fill="#fff" />
              <Circle cx="919" cy="62" r="53" fill="#F2D060" />
              <Path d="M0 318 Q270 268 540 292 Q810 316 1077 262 V411 H0 Z" fill="#9AD66A" />
              <Path d="M0 372 Q300 344 600 366 Q850 384 1077 352 V411 H0 Z" fill="#84C457" />
            </Svg>
          )}
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            <AnimatedText
              key={page}
              entering={FadeIn.duration(700)}
              allowFontScaling={false}
              style={{ fontSize: Math.max(48, scene.h * 0.55), lineHeight: Math.max(58, scene.h * 0.68), includeFontPadding: false }}>
              {cur.emoji}
            </AnimatedText>
          </View>
          {/* 읽어 주는 중 (작은 아바타) */}
          <View
            style={{
              position: 'absolute',
              top: u(20, 8),
              left: u(20, 8),
              height: u(44, 32),
              paddingLeft: u(6, 4),
              paddingRight: u(16, 10),
              borderRadius: u(22, 16),
              backgroundColor: K.white,
              boxShadow: SOFT2,
              flexDirection: 'row',
              alignItems: 'center',
              gap: u(8, 5),
            }}>
            <View style={{ width: chip, height: chip, borderRadius: chip / 2, backgroundColor: K.peach, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' }}>
              <Avatar config={profile?.avatar} mouth={mouth} scale={scale} size={chip} expression={speaking ? 'neutral' : 'smile'} />
            </View>
            <Text style={{ fontSize: f(16, 12), fontWeight: '700', color: K.ink }}>{speaking ? '읽어 주는 중' : `${me}랑 동화`}</Text>
          </View>
        </View>
        <View style={{ height: u(156, 64), paddingHorizontal: u(32, 14), alignItems: 'center', justifyContent: 'center' }}>
          <AnimatedText
            key={page}
            entering={FadeIn.duration(500)}
            numberOfLines={compact ? 2 : 3}
            adjustsFontSizeToFit
            style={{ fontSize: textFont, lineHeight: Math.round(textFont * 1.5), fontWeight: '800', color: K.ink, textAlign: 'center' }}>
            {cur.text}
          </AnimatedText>
        </View>
      </View>

      {/* 아래: 이전 장 · 소리만 듣기 · 다음 장 */}
      <View style={{ height: u(80, 46), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: u(24, 10) }}>
        <ChunkyButton
          label="이전 장"
          icon={<ChevIcon left size={u(20, 14)} />}
          onPress={() => setPage(Math.max(0, page - 1))}
          color={K.white}
          deep={K.whiteDeep}
          height={btnH}
          width={u(186, 120)}
          fontSize={f(23, 15)}
          d={u(6, 3)}
        />
        <ChunkyButton
          label="소리만 듣기"
          icon={<SpeakerIcon size={u(24, 16)} waves={1} />}
          onPress={() => {
            stop();
            router.push('/child/audio');
          }}
          color={K.teal}
          deep={K.tealDeep}
          textColor={K.white}
          height={btnH}
          width={u(236, 150)}
          fontSize={f(23, 15)}
          d={u(6, 3)}
        />
        <ChunkyButton
          label="다음 장"
          iconRight={<ChevIcon size={u(20, 14)} />}
          onPress={() => (page + 1 < story.pages.length ? setPage(page + 1) : toEnd())}
          height={btnH}
          width={u(188, 120)}
          fontSize={f(23, 15)}
          d={u(6, 3)}
        />
      </View>
    </KidScreen>
  );
}

