// 아이 태블릿 3-8 마무리 (실제 부모에게 연결 — AI가 부모를 대체하지 않도록) — 담당: 태희 (민철 와이어프레임 기준)
// 기획 4 리스크 "아이가 AI를 실제 부모로 오인" → "이따 엄마 오면 ○○ 이야기 해줄래?"로 실제 부모에게 넘김
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { PillButton, sleep, useMouthScale, who } from '@/components/child/kit';
import { dayOf, ENDING, fill, ITEMS } from '@/content/curriculum';
import { useSpeak } from '@/hooks/useSpeak';
import { stopActivityLog } from '@/lib/sense';
import { useProfile } from '@/lib/store';
import { C } from '@/theme';

export default function End() {
  const profile = useProfile();
  const { fav: favParam } = useLocalSearchParams<{ fav?: string }>();
  const insets = useSafeAreaInsets();
  const { speak, stop, mouth } = useSpeak(profile?.childId);
  const scale = useMouthScale(profile?.childId);
  const { name, me } = who(profile);
  const fav = favParam || ITEMS[dayOf(profile?.day ?? 1).items[0]].ko;
  const ready = !!profile;

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
    <View style={{ flex: 1, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', gap: 20, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <Animated.View style={bobStyle}>
        <View style={{ width: 250, height: 250, borderRadius: 125, backgroundColor: C.white, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Avatar config={profile?.avatar} mouth={mouth} scale={scale} size={215} />
        </View>
      </Animated.View>
      <Animated.Text entering={FadeIn.duration(600)} style={{ fontSize: 36, fontWeight: '900', color: C.text }}>
        {fill('잘했어, {name}야!', { name, me })}
      </Animated.Text>
      <Animated.Text entering={FadeIn.delay(300).duration(600)} style={{ fontSize: 22, color: C.sub }}>
        {fill('이따 {me} 오면 {fav} 이야기 해줄래?', { name, me, fav })}
      </Animated.Text>
      <PillButton
        label="한 번 더 볼래요"
        onPress={() => {
          stop();
          router.replace('/child');
        }}
        primary
        style={{ marginTop: 8, minWidth: 220 }}
      />
    </View>
  );
}
