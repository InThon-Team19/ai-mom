// 아이 태블릿 3-8 마무리 (실제 부모에게 연결 — AI가 부모를 대체하지 않도록) — 담당: 태희 (민철 Design 보드 KidEnd)
// 기획 4 리스크 "아이가 AI를 실제 부모로 오인" → "이따 엄마 오면 ○○ 이야기 해줄래?"로 실제 부모에게 넘김
// 기획 2-3: 마무리 장면에서 오늘 모은 사물 바구니를 함께 보며 끝냄 (글자 없이 그림으로)
// 보드: 색종이 바탕 · 부모/홈 · 왼쪽 큰 둥근 아바타 + 별 · 오른쪽 "오늘 정말 잘했어!" · 별 3개 · 바구니 · 실제 부모 연결 문장 · 안녕!
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Avatar } from '@/components/Avatar';
import { AvatarCircle, BasketArt, ChatIcon, ChunkyButton, HomePill, ItemArt, K, KidScreen, StarIcon, Stars, useKid } from '@/components/child/design';
import { sleep, useMouthScale, who } from '@/components/child/kit';
import { ParentExit } from '@/components/ParentExit';
import { dayOf, ENDING, fill, ITEMS, type ItemId } from '@/content/curriculum';
import { useSpeak } from '@/hooks/useSpeak';
import { stopActivityLog } from '@/lib/sense';
import { useProfile } from '@/lib/store';

const CONFETTI: [number, number, string, number][] = [
  [134, 128, K.red, -35],
  [302, 106, K.teal, 70],
  [476, 82, K.purple, 40],
  [808, 96, K.yellow, 80],
  [982, 112, K.purple, -25],
  [1074, 274, K.red, 75],
  [102, 420, K.yellow, 15],
  [1070, 530, K.teal, 20],
];

export default function End() {
  const profile = useProfile();
  const { fav: favParam, basket: basketParam } = useLocalSearchParams<{ fav?: string; basket?: string }>();
  const { u, f, width, height, insets } = useKid();
  const { speak, stop, mouth } = useSpeak(profile?.childId);
  const scale = useMouthScale(profile?.childId);
  const { name, me } = who(profile);
  const fav = favParam || ITEMS[dayOf(profile?.day ?? 1).items[0]].ko;
  const ready = !!profile;
  const reduceMotion = !!profile?.settings.reduceMotion;
  // 오늘 모은 사물 (세션에서 넘겨받음. 없으면 오늘 계획의 사물)
  const collected = useMemo(() => {
    const ids = (basketParam ?? '').split(',').filter((x): x is ItemId => x in ITEMS);
    return ids.length ? ids : profile ? dayOf(profile.day).items : [];
  }, [basketParam, profile]);

  // 천천히 위아래로 흔들리는 인사 (깜빡임 없이 2.4초 주기, 움직임 줄이기면 아주 작게)
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [bob]);
  const amp = reduceMotion ? 2 : 8;
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -amp * bob.value }, { rotate: `${(bob.value - 0.5) * (amp / 2)}deg` }] }));

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

  // 크기: 왼쪽 아바타 원은 남는 높이에 맞춤 (폰 가로에서도 한 화면)
  const avail = height - insets.top - insets.bottom - u(60, 16) - u(48, 36);
  const circle = Math.round(Math.max(110, Math.min(u(390, 120), avail * 0.85)));
  const basketW = Math.round(Math.min(u(472, 200), width * 0.36));
  const itemSize = Math.round(basketW * (80 / 472));

  return (
    <KidScreen gap={0} style={{ paddingBottom: u(30, 8) + insets.bottom }}>
      {/* 바탕: 베이지 원 · 색종이 조각 · 별 */}
      <Svg width={width} height={height} viewBox="0 0 1180 820" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', left: 0, top: 0 }}>
        <Circle cx="117" cy="691" r="130" fill={K.confetti} />
        <Circle cx="1074" cy="703" r="123" fill={K.confetti} />
        {CONFETTI.map(([x, y, c, r], i) => (
          <Rect key={i} x={x} y={y} width="28" height="9" rx="4.5" fill={c} transform={`rotate(${r} ${x + 14} ${y + 4})`} />
        ))}
        <Path d="M1043 640l7.2 15 16.5 2.2-12 11.5 3 16.3-14.7-7.9-14.7 7.9 3-16.3-12-11.5 16.5-2.2z" fill="#E9CF7E" opacity={0.6} />
      </Svg>

      <View style={{ flexDirection: 'row', gap: u(10, 6) }}>
        <ParentExit />
        <HomePill onBefore={stop} />
      </View>

      <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', alignItems: 'center' }}>
        {/* 왼쪽: 큰 둥근 아바타 + 별 */}
        <View style={{ width: u(560, 230), alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={bobStyle}>
            <AvatarCircle size={circle} border={u(10, 5)}>
              <Avatar config={profile?.avatar} mouth={mouth} scale={scale} size={Math.round(circle * 0.87)} expression="smile" />
            </AvatarCircle>
            <View style={{ position: 'absolute', top: -circle * 0.03, left: -circle * 0.04 }}>
              <StarIcon size={Math.round(circle * 0.17)} />
            </View>
          </Animated.View>
        </View>

        {/* 오른쪽: 칭찬 · 별 · 바구니 · 실제 부모에게 넘기는 말 · 버튼 */}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Animated.Text entering={FadeIn.duration(600)} style={{ fontSize: f(52, 24), fontWeight: '800', color: K.ink, textAlign: 'center' }}>
            {name ? fill('오늘 정말 잘했어, {name}!', { name, me }) : '오늘 정말 잘했어!'}
          </Animated.Text>
          <View style={{ marginTop: u(20, 4) }}>
            <Stars on={3} size={u(54, 24)} gap={u(14, 6)} />
          </View>
          {/* 오늘 모은 바구니: 하나씩 톡톡 나타남 */}
          {collected.length > 0 && (
            <View accessibilityLabel="오늘 모은 바구니" style={{ marginTop: u(22, 4) }}>
              <BasketArt width={basketW}>
                {collected.map((id, i) => (
                  <Animated.View key={`${id}${i}`} entering={ZoomIn.delay(500 + i * 350).duration(300)}>
                    <ItemArt id={id} size={itemSize} />
                  </Animated.View>
                ))}
              </BasketArt>
            </View>
          )}
          <Animated.Text entering={FadeIn.delay(300).duration(600)} style={{ marginTop: u(24, 4), fontSize: f(28, 15), lineHeight: Math.round(f(28, 15) * 1.5), fontWeight: '800', color: K.ink, textAlign: 'center' }}>
            {fill('이따 {me} 오면\n{fav} 이야기 해 줄래?', { name, me, fav })}
          </Animated.Text>
          <View style={{ marginTop: u(26, 6), flexDirection: 'row', gap: u(16, 8) }}>
            {/* 학습 뒤 자유 대화: 엄마 아바타와 일상 이야기 (받은 fav·basket 그대로 넘김) */}
            <ChunkyButton
              label={`${me}랑 더 이야기`}
              icon={<ChatIcon size={u(26, 16)} />}
              onPress={() => {
                stop();
                const params = { ...(favParam ? { fav: favParam } : {}), ...(basketParam ? { basket: basketParam } : {}) };
                router.replace({ pathname: '/child/chat', params });
              }}
              color={K.white}
              deep={K.whiteDeep}
              height={u(80, 44)}
              fontSize={f(24, 14)}
              d={u(6, 3)}
            />
            <ChunkyButton
              label="안녕!"
              onPress={() => {
                stop();
                router.dismissTo('/child'); // 아래에 있던 아이 홈으로 (홈이 두 겹 쌓이지 않게)
              }}
              height={u(80, 44)}
              width={u(316, 130)}
              fontSize={f(32, 18)}
              d={u(6, 3)}
            />
          </View>
        </View>
      </View>
    </KidScreen>
  );
}
