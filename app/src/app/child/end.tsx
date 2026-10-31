// 아이 태블릿 3-8 마무리 (실제 부모에게 연결 — AI가 부모를 대체하지 않도록) — 담당: 태희 (민철 와이어프레임 기준)
// 기획 4 리스크 "아이가 AI를 실제 부모로 오인" → "이따 엄마 오면 ○○ 이야기 해줄래?"로 실제 부모에게 넘김
// 기획 2-3: 마무리 장면에서 오늘 모은 사물 바구니를 함께 보며 끝냄 (글자 없이 그림으로)
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { PillButton, sleep, useMouthScale, who } from '@/components/child/kit';
import { BasketIcon } from '@/components/child/stage';
import { dayOf, ENDING, fill, ITEMS, type ItemId } from '@/content/curriculum';
import { useSpeak } from '@/hooks/useSpeak';
import { stopActivityLog } from '@/lib/sense';
import { useProfile } from '@/lib/store';
import { C, R } from '@/theme';
import { ParentExit } from '@/components/ParentExit';

export default function End() {
  const profile = useProfile();
  const { fav: favParam, basket: basketParam } = useLocalSearchParams<{ fav?: string; basket?: string }>();
  const insets = useSafeAreaInsets();
  // 폰 가로(높이 약 360)에선 아바타·바구니·버튼을 줄임 (예전엔 버튼이 화면 아래로 잘림). 그래도 넘치면 스크롤
  const compact = useWindowDimensions().height < 520;
  const circle = compact ? 110 : 230;
  const emoji = compact ? 36 : 56;
  const { speak, stop, mouth } = useSpeak(profile?.childId);
  const scale = useMouthScale(profile?.childId);
  const { name, me } = who(profile);
  const fav = favParam || ITEMS[dayOf(profile?.day ?? 1).items[0]].ko;
  const ready = !!profile;
  // 오늘 모은 사물 (세션에서 넘겨받음. 없으면 오늘 계획의 사물)
  const collected = useMemo(() => {
    const ids = (basketParam ?? '').split(',').filter((x): x is ItemId => x in ITEMS);
    return ids.length ? ids : profile ? dayOf(profile.day).items : [];
  }, [basketParam, profile]);

  // 천천히 위아래로 흔들리는 인사 (깜빡임 없이 2.4초 주기)
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [bob]);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -8 * bob.value }, { rotate: `${(bob.value - 0.5) * 4}deg` }] }));

  useEffect(() => {
    stopActivityLog(); // 남은 기록을 서버로 보내고 멈춤
  }, []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    (async () => {
      await sleep(500);
      if (alive) await speak(fill(ENDING, { name, me, fav }));
    })();
    return () => {
      alive = false;
      stop();
    };
  }, [ready, speak, stop, name, me, fav]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }}>
      <ParentExit home />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: compact ? 8 : 16, paddingVertical: compact ? 10 : 16, paddingHorizontal: 24 }}
        showsVerticalScrollIndicator={false}>
      <Animated.View style={bobStyle}>
        <View style={{ width: circle, height: circle, borderRadius: circle / 2, backgroundColor: C.white, borderWidth: 3, borderColor: C.primary, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Avatar config={profile?.avatar} mouth={mouth} scale={scale} size={Math.round(circle * 0.87)} expression="smile" />
        </View>
      </Animated.View>
      <Animated.Text entering={FadeIn.duration(600)} style={{ fontSize: compact ? 26 : 34, fontWeight: '900', color: C.text, textAlign: 'center' }}>
        {fill('잘했어, {name}야!', { name, me })}
      </Animated.Text>

      {/* 오늘 모은 바구니: 하나씩 톡톡 나타남 */}
      {collected.length > 0 && (
        <View
          accessibilityLabel="오늘 모은 바구니"
          style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%', alignItems: 'center', gap: compact ? 10 : 14, paddingHorizontal: compact ? 16 : 24, paddingVertical: compact ? 4 : 10, backgroundColor: C.card, borderRadius: R.lg, borderWidth: 2, borderColor: C.border }}>
          <BasketIcon size={compact ? 40 : 60} />
          {collected.map((id, i) => (
            <Animated.View key={`${id}${i}`} entering={ZoomIn.delay(500 + i * 350).duration(300)}>
              <Text allowFontScaling={false} style={{ fontSize: emoji, lineHeight: Math.round(emoji * 1.22), includeFontPadding: false }}>
                {ITEMS[id].emoji}
              </Text>
            </Animated.View>
          ))}
        </View>
      )}

      <Animated.Text entering={FadeIn.delay(300).duration(600)} style={{ fontSize: compact ? 18 : 22, color: C.sub, textAlign: 'center' }}>
        {fill('이따 {me} 오면 {fav} 이야기 해 줄래?', { name, me, fav })}
      </Animated.Text>
      {/* 학습 뒤 자유 대화: 엄마 아바타와 일상 이야기 (받은 fav·basket 그대로 넘김). 폰 가로 화면에선 줄을 바꿔 넘치지 않게 */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: compact ? 10 : 14, marginTop: 4, maxWidth: '100%' }}>
        <PillButton
          small={compact}
          label={`💬 ${me}랑 더 이야기하기`}
          onPress={() => {
            stop();
            const params = { ...(favParam ? { fav: favParam } : {}), ...(basketParam ? { basket: basketParam } : {}) };
            router.replace({ pathname: '/child/chat', params });
          }}
          style={{ minWidth: compact ? 220 : 280 }}
        />
        <PillButton
          label="한 번 더 볼래요"
          onPress={() => {
            stop();
            router.dismissTo('/child'); // 아래에 있던 아이 홈으로 (홈이 두 겹 쌓이지 않게)
          }}
          primary
          small={compact}
          style={{ minWidth: compact ? 170 : 220 }}
        />
      </View>
      </ScrollView>
    </View>
  );
}
