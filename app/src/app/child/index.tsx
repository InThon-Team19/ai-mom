// 아이 홈 3-1: 아바타가 먼저 인사, 오늘 만날 친구들, 놀자·동화·소리만 (+ 처음 한 번 태블릿 연결) — 담당: 태희
// 글자 최소. 들어오자마자 학습이 시작되지 않고 아이가 고름. 부모 모드는 오른쪽 위 "부모 · 3초 꾹" + PIN (민철 Design 보드 KidHome · TabLink)
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle, Ellipse } from 'react-native-svg';

import { Avatar } from '@/components/Avatar';
import { Logo } from '@/components/Logo';
import {
  AvatarCircle,
  BookIcon,
  Bubble,
  ChatIcon,
  ChevIcon,
  ChunkyButton,
  depth,
  HandIcon,
  ItemArt,
  K,
  KidScreen,
  PlayTriIcon,
  SOFT2,
  StarIcon,
  useKid,
} from '@/components/child/design';
import { useMouthScale, who } from '@/components/child/kit';
import { CHILD_LINKED_KEY as LINKED_KEY, ParentExit } from '@/components/ParentExit';
import { dayOf, fill, type ItemId } from '@/content/curriculum';
import { useSpeak } from '@/hooks/useSpeak';
import { getDeviceId, registerThisDevice } from '@/lib/device';
import { getOverride, getParentToken, getToken } from '@/lib/session';
import { prefetchDay } from '@/lib/prefetch';
import { api } from '@/lib/api';
import { clearRole, linkTablet, loadProfile, refreshProfile, resetLocal, useProfile } from '@/lib/store';

export default function ChildStart() {
  const profile = useProfile();
  const [relink, setRelink] = useState(false);
  const linked = !!profile?.child.name;

  // 다음날 일차 받기 + 기기 등록, 부모 폰에서 연결 해제·연결 키 재발급했으면 연결 화면으로
  useEffect(() => {
    if (!linked) return;
    (async () => {
      // 비밀번호 변경·연결 해제·새 연결 코드로 서버가 이 태블릿 토큰을 끊었으면 연결 화면으로
      const cur = await loadProfile();
      try {
        await api.getProfile(cur.childId);
      } catch (e) {
        // 401: 기기 토큰 끊김. 404·403: 부모 토큰으로 다시 시도했지만 이 계정의 아이가 아님 → 둘 다 다시 연결해야 함
        if (/^(Error: )?(401|403|404)\b/.test(String(e))) {
          await AsyncStorage.removeItem(LINKED_KEY).catch(() => {});
          await resetLocal();
          return;
        }
      }
      // 일차 넘김(기획 2-7)은 refreshProfile 이 화면에 반영, 서버 저장은 부모 앱이 함
      const p = await refreshProfile();
      const me = await getDeviceId();
      let flag: string | null = null;
      try {
        flag = await AsyncStorage.getItem(LINKED_KEY);
      } catch {}
      const registered = (p.devices ?? []).some((d) => d.device_id === me && d.role === 'child');
      // 부모 토큰으로 도는 아이 모드(같은 폰)는 기기 등록 자체가 안 되므로 연결 해제 검사를 하지 않음
      const usingParent = (getOverride() ?? (await getToken())) === (await getParentToken());
      if (!usingParent && flag === p.childId && p.devices && !registered) {
        await resetLocal();
        await AsyncStorage.removeItem(LINKED_KEY).catch(() => {});
        return;
      }
      // 연결됨 표시는 기기 토큰으로 등록에 성공했을 때만 (부모 토큰으로 도는 아이 모드에서 다음 진입 때 프로필이 지워지던 문제)
      if (await registerThisDevice(p.childId, 'child')) await AsyncStorage.setItem(LINKED_KEY, p.childId).catch(() => {});
    })().catch(() => {}); // 기기 등록·저장소 실패는 다음에 다시 (빨간 경고 없이 홈은 그대로)
  }, [linked]);

  if (!profile) return null;
  if (!linked || relink) return <LinkScreen onDone={() => setRelink(false)} canCancel={linked} />;
  return <Greeting />;
}

type Tile = { key: string; label: string; color: [string, string, string]; icon: (color: string, size: number) => ReactNode; items?: ItemId[]; onPress: () => void };
/** 보드 KidHome 타일 색: 빨강 · 초록 · 노랑 · 보라 · 청록 · 주황 */
const TILE_COLORS: [string, string, string][] = [
  [K.red, K.redDeep, K.white],
  [K.green, K.greenDeep, K.white],
  [K.yellow, K.yellowDeep, K.ink],
  [K.purple, K.purpleDeep, K.white],
  [K.teal, K.tealDeep, K.white],
  [K.orange, K.orangeDeep, K.white],
];

/** 아이 홈 (보드 KidHome): 왼쪽 말풍선 + 둥근 아바타가 먼저 인사 · 오른쪽 같은 크기의 큰 버튼 2x2 (자동으로 학습이 시작되지 않음) */
function Greeting() {
  const profile = useProfile();
  const { u, f, compact, height, insets } = useKid();
  const { speak, stop, mouth } = useSpeak(profile?.childId);
  const scale = useMouthScale(profile?.childId);
  const { name, me } = who(profile);
  const day = dayOf(profile?.day ?? 1);
  // 기획 2-7: 첫 인사는 현재 일차 값으로 만듦
  const line = fill(`{name}야, ${day.greeting}`, { name, me });

  const hello = `${fill('안녕 {name}! {me}랑 같이 놀자!', { name, me })} ${line}`;
  const greet = useCallback(() => {
    speak(hello);
  }, [speak, hello]);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(greet, 600);
      return () => {
        clearTimeout(t);
        stop();
      };
    }, [greet, stop]),
  );

  // 그날 엄마 목소리 문장을 미리 만들어 둠 (첫 문장은 만드는 데 4~5초 걸림)
  useEffect(() => {
    if (profile?.child.name) prefetchDay(profile); // 같은 일차는 한 번만 돎
  }, [profile]);

  const go = (path: '/child/session' | '/child/story' | '/child/audio' | '/child/play' | '/child/chat') => {
    stop();
    router.push(path);
  };

  // 큰 버튼 4개 (사용자 요청 — 사과·바나나 그림이 놀자와 같은 곳으로 가서 헷갈림): 놀자 · 손 놀이 · 동화 듣기(동화 있는 날만) · {엄마}랑 이야기
  // 오늘 사물 그림은 놀자 버튼 안에 작게만 (따로 누르는 버튼 아님). 소리만 듣기는 홈에서 뺌 (동화 화면 · 쉬기 화면에서 들어감)
  const tiles: Tile[] = [
    { key: 'play', label: '놀자!', color: TILE_COLORS[0], icon: (c, z) => <PlayTriIcon size={z * 0.48} color={c} />, items: day.items, onPress: () => go('/child/session') },
    { key: 'hand', label: '손 놀이', color: TILE_COLORS[1], icon: (_c, z) => <HandIcon size={z * 0.55} />, onPress: () => go('/child/play') },
    ...(day.story
      ? [{ key: 'story', label: '동화 듣기', color: TILE_COLORS[3], icon: (c: string, z: number) => <BookIcon size={z * 0.48} color={c} />, onPress: () => go('/child/story') }]
      : []),
    { key: 'chat', label: `${me}랑 이야기`, color: TILE_COLORS[5], icon: (c, z) => <ChatIcon size={z * 0.5} color={c} dots />, onPress: () => go('/child/chat') },
  ];

  // 크기: 보드 비율. 폰 가로(높이 약 360)에선 아바타 원을 남는 높이에 맞춤
  const topH = u(56, 40);
  const mainH = height - insets.top - insets.bottom - u(30, 8) - u(38, 8) - topH - u(22, 6);
  const bubbleFont = f(27, 14);
  const circle = Math.round(Math.max(90, Math.min(u(320, 110), mainH - bubbleFont * 2.8 * 1.4 - u(18, 8) * 2 - u(24, 8) - 8)));
  const iconCircle = u(96, 36);
  const tileFont = f(36, 16);
  const cols = tiles.length === 4 ? 2 : 3; // 4개면 2x2, 동화 없는 날(3개)은 한 줄
  const rows = Math.ceil(tiles.length / cols);
  const mini = f(34, 18);

  return (
    <KidScreen gap={22} style={{ paddingBottom: u(38, 8) + insets.bottom }}>
      {/* 위: 아이맘 · 부모(3초 꾹) · 일차 */}
      <View style={{ height: topH, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(8, 4) }}>
          <Logo size={u(52, 30)} />
          <Text style={{ fontSize: f(38, 20), fontWeight: '900', color: K.red }}>아이맘</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: u(10, 6) }}>
          <ParentExit label={compact ? '부모' : '부모 · 3초 꾹'} />
          <View
            style={{
              height: u(48, 36),
              paddingHorizontal: u(18, 12),
              borderRadius: u(24, 18),
              backgroundColor: K.yellow,
              boxShadow: depth(K.yellowDeep, u(4, 2)),
              flexDirection: 'row',
              alignItems: 'center',
              gap: u(8, 5),
            }}>
            <StarIcon size={u(20, 14)} outline={K.ink} />
            <Text style={{ fontSize: f(18, 13), fontWeight: '800', color: K.ink }}>{day.day}일차</Text>
          </View>
        </View>
      </View>

      <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: u(48, 14) }}>
        {/* 왼쪽: 말풍선 + 둥근 아바타 (누르면 다시 인사) */}
        <Pressable onPress={greet} accessibilityLabel={`${me} 아바타`} style={{ width: u(380, 170), alignItems: 'center', justifyContent: 'center', gap: u(24, 8) }}>
          <Animated.View entering={FadeIn.duration(500)}>
            <Bubble size={bubbleFont}>{line}</Bubble>
          </Animated.View>
          <AvatarCircle size={circle} border={u(8, 4)}>
            <Avatar config={profile?.avatar} mouth={mouth} scale={scale} size={Math.round(circle * 0.86)} expression="smile" />
          </AvatarCircle>
        </Pressable>

        {/* 오른쪽: 같은 크기의 큰 버튼 (2x2) */}
        <View style={{ flex: 1, gap: u(24, 10), paddingBottom: u(8, 4) }}>
          {Array.from({ length: rows }, (_, r) => (
            <View key={r} style={{ flex: 1, flexDirection: 'row', gap: u(20, 10) }}>
              {Array.from({ length: cols }, (_, c) => {
                const i = r * cols + c;
                const t = tiles[i];
                if (!t) return <View key={c} style={{ flex: 1 }} />;
                const [bg, deep, ink] = t.color;
                return (
                  <Pressable
                    key={t.key}
                    accessibilityRole="button"
                    accessibilityLabel={t.label}
                    onPress={t.onPress}
                    style={({ pressed }) => ({
                      flex: 1,
                      borderRadius: u(30, 16),
                      backgroundColor: bg,
                      boxShadow: depth(deep, pressed ? u(3, 2) : u(8, 4)),
                      transform: [{ translateY: pressed ? u(5, 2) : 0 }],
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: u(14, 3),
                    })}>
                    <View style={{ width: iconCircle, height: iconCircle, borderRadius: iconCircle / 2, backgroundColor: K.white, alignItems: 'center', justifyContent: 'center' }}>
                      {t.icon(bg, iconCircle)}
                    </View>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: tileFont, fontWeight: '800', color: ink }}>
                      {t.label}
                    </Text>
                    {/* 놀자 버튼 안: 오늘 만날 사물 그림 (따로 누르는 버튼 아님) */}
                    {!!t.items?.length && (
                      <View pointerEvents="none" style={{ flexDirection: 'row', gap: u(8, 4), paddingHorizontal: u(14, 8), paddingVertical: u(4, 2), borderRadius: mini, backgroundColor: 'rgba(255,255,255,0.9)' }}>
                        {t.items.map((id) => (
                          <ItemArt key={id} id={id} size={mini} />
                        ))}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </KidScreen>
  );
}

const CODE_COLORS: [string, string, string][] = [
  [K.red, K.redDeep, K.white],
  [K.yellow, K.yellowDeep, K.ink],
  [K.green, K.greenDeep, K.white],
];

/** 처음 한 번 (보드 TabLink): 부모 폰 1-7 화면의 6자리 연결 코드 입력 (어른이 함) */
function LinkScreen({ onDone, canCancel }: { onDone: () => void; canCancel: boolean }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { u, f, width, height, insets } = useKid();
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const p = await linkTablet(code);
      await registerThisDevice(p.childId, 'child');
      await AsyncStorage.setItem(LINKED_KEY, p.childId).catch(() => {});
      onDone();
    } catch (e) {
      const msg = String((e as Error)?.message ?? '');
      setError(
        msg.startsWith('404')
          ? '코드가 맞지 않거나 10분이 지났어요. 부모 폰 설정 탭에서 새 코드를 받아 주세요.'
          : msg.includes('가입 설정')
            ? '부모 폰에서 가입을 끝까지 마친 뒤 연결해 주세요.'
            : msg.includes('이미 사용한')
              ? '이미 쓴 코드예요. 부모 폰 설정 탭에서 새 코드를 받아 주세요.'
              : msg.startsWith('429')
                ? '시도가 너무 많아요. 잠시 후 다시 해 주세요.'
                : '서버에 연결할 수 없어요. 잠시 후 다시 해 주세요.',
      );
    } finally {
      setBusy(false);
    }
  };

  const back = async () => {
    if (canCancel) return onDone();
    await clearRole(); // 아이 태블릿으로 잘못 골랐을 때: 기기 용도 선택 화면으로
    router.replace('/');
  };

  const av = u(124, 72);
  const boxW = u(74, 40);
  const boxH = u(93, 52);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: K.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* 바탕 장식: 살구 원 · 흰 구름 */}
      <Svg width={width} height={height} viewBox="0 0 1180 820" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', left: 0, top: 0 }}>
        <Circle cx="1074" cy="123" r="136" fill={K.peach} />
        <Circle cx="117" cy="691" r="142" fill={K.peach} />
        <Ellipse cx="210" cy="150" rx="86" ry="28" fill={K.white} />
        <Ellipse cx="252" cy="130" rx="50" ry="26" fill={K.white} />
        <Ellipse cx="1030" cy="634" rx="62" ry="26" fill={K.white} />
        <Ellipse cx="1060" cy="616" rx="36" ry="22" fill={K.white} />
      </Svg>
      {/* 폰 가로(높이 360)·키보드가 올라오면 카드가 화면보다 커서 스크롤 */}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: u(37, 10) + insets.top,
          paddingBottom: u(37, 10) + insets.bottom,
          paddingLeft: u(59, 16) + insets.left,
          paddingRight: u(59, 16) + insets.right,
        }}
        keyboardShouldPersistTaps="handled">
        <Pressable onPress={back} accessibilityRole="button" style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: u(14, 8) }}>
          <View style={{ width: u(52, 40), height: u(52, 40), borderRadius: u(26, 20), backgroundColor: K.white, boxShadow: SOFT2, alignItems: 'center', justifyContent: 'center' }}>
            <ChevIcon left size={u(22, 16)} />
          </View>
          <Text style={{ fontSize: f(20, 14), fontWeight: '800', color: K.ink }}>{canCancel ? '취소' : '처음 화면으로'}</Text>
        </Pressable>

        <View
          style={{
            alignSelf: 'center',
            width: '100%',
            maxWidth: u(747, 440),
            marginTop: av / 2 + u(18, 8),
            paddingTop: av / 2 + u(34, 10),
            paddingHorizontal: u(46, 16),
            paddingBottom: u(36, 14),
            borderRadius: u(40, 22),
            backgroundColor: K.white,
            boxShadow: '0px 10px 30px rgba(58,54,78,0.08)',
            alignItems: 'center',
            gap: u(18, 8),
          }}>
          <View style={{ position: 'absolute', top: -av / 2, left: '50%', marginLeft: -av / 2 }}>
            <AvatarCircle size={av} border={u(6, 4)}>
              <Avatar size={Math.round(av * 0.86)} expression="smile" />
            </AvatarCircle>
          </View>
          <Text style={{ fontSize: f(40, 20), fontWeight: '800', color: K.ink, textAlign: 'center' }}>아이 태블릿 연결하기</Text>
          <Text style={{ fontSize: f(18, 13), lineHeight: Math.round(f(18, 13) * 1.5), color: K.sub, textAlign: 'center' }}>
            부모 폰 설정 탭에서 받은{'\n'}연결 코드 6자리를 입력해 주세요.
          </Text>

          {/* 코드 6칸: 칸을 누르면 숨은 입력창에 글자를 넣음. 넣은 칸은 빨강·노랑·초록 두툼, 빈칸은 점선 */}
          <Pressable onPress={() => input.current?.focus()} accessibilityLabel="연결 코드 입력" style={{ flexDirection: 'row', gap: u(17, 6), marginTop: u(8, 2) }}>
            {Array.from({ length: 6 }, (_, i) => {
              const ch = code[i];
              const [bg, deep, ink] = CODE_COLORS[i % 3];
              return ch ? (
                <View key={i} style={{ width: boxW, height: boxH, borderRadius: u(16, 10), backgroundColor: bg, boxShadow: depth(deep, u(6, 3)), alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: f(40, 22), fontWeight: '800', color: ink }}>{ch}</Text>
                </View>
              ) : (
                <View
                  key={i}
                  style={{ width: boxW, height: boxH, borderRadius: u(16, 10), borderWidth: 3, borderStyle: 'dashed', borderColor: i === code.length ? K.teal : K.line, backgroundColor: K.cream }}
                />
              );
            })}
            <TextInput
              ref={input}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              caretHidden
              accessibilityLabel="연결 코드 6자리"
              onSubmitEditing={() => code.length === 6 && submit()}
              style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent', fontSize: 16 }}
            />
          </Pressable>
          {!!error && <Text style={{ fontSize: f(16, 13), fontWeight: '700', color: K.redDeep, textAlign: 'center' }}>{error}</Text>}
          <Text style={{ marginTop: u(6, 2), fontSize: f(15, 12), color: K.sub, textAlign: 'center' }}>코드는 10분 동안 한 번만 쓸 수 있어요. 시간이 지났다면 새로 받아 주세요.</Text>
          <ChunkyButton
            label={busy ? '연결 중...' : '연결'}
            disabled={code.length !== 6 || busy}
            onPress={submit}
            color={K.teal}
            deep={K.tealDeep}
            textColor={K.white}
            height={u(80, 52)}
            width="100%"
            fontSize={f(28, 18)}
            style={{ marginTop: u(4, 2) }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
