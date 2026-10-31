// 아이 홈 3-1: 아바타가 먼저 인사, 오늘 만날 친구들, 놀자·동화·소리만 (+ 처음 한 번 태블릿 연결) — 담당: 태희
// 글자 최소. 들어오자마자 학습이 시작되지 않고 아이가 고름. 부모 모드는 왼쪽 위 자물쇠 3초 + PIN
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { PillButton, PlayIcon, RoundButton, useMouthScale, who } from '@/components/child/kit';
import { CHILD_LINKED_KEY as LINKED_KEY, ParentExit } from '@/components/ParentExit';
import { Button } from '@/components/ui';
import { dayOf, fill, ITEMS } from '@/content/curriculum';
import { useSpeak } from '@/hooks/useSpeak';
import { getDeviceId, registerThisDevice } from '@/lib/device';
import { prefetchDay } from '@/lib/prefetch';
import { api } from '@/lib/api';
import { clearRole, linkTablet, loadProfile, refreshProfile, resetLocal, useProfile } from '@/lib/store';
import { C, R, T } from '@/theme';


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
      if (flag === p.childId && p.devices && !registered) {
        await resetLocal();
        await AsyncStorage.removeItem(LINKED_KEY).catch(() => {});
        return;
      }
      await registerThisDevice(p.childId, 'child');
      await AsyncStorage.setItem(LINKED_KEY, p.childId).catch(() => {});
    })();
  }, [linked]);

  if (!profile) return null;
  if (!linked || relink) return <LinkScreen onDone={() => setRelink(false)} canCancel={linked} />;
  return <Greeting />;
}

/** 아이 홈: 아바타가 먼저 인사 → 오늘 만날 친구들 → 큰 "놀자" 버튼 (자동으로 학습이 시작되지 않음) */
function Greeting() {
  const profile = useProfile();
  const insets = useSafeAreaInsets();
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

  const go = (path: '/child/session' | '/child/story' | '/child/audio' | '/child/play') => {
    stop();
    router.push(path);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center', paddingTop: insets.top, paddingBottom: insets.bottom, paddingHorizontal: 32 + insets.left, gap: 32 }}>
      {/* 왼쪽: 아바타 (누르면 다시 인사) */}
      <Pressable onPress={greet} accessibilityLabel={`${me} 아바타`} style={{ flex: 4, alignItems: 'center', gap: 12 }}>
        <View style={{ width: 280, height: 280, borderRadius: 140, backgroundColor: C.primarySoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Avatar config={profile?.avatar} mouth={mouth} scale={scale} size={240} expression="smile" />
        </View>
        <Animated.Text entering={FadeIn.duration(500)} style={{ fontSize: 26, fontWeight: '900', color: C.text, textAlign: 'center' }}>
          {line}
        </Animated.Text>
      </Pressable>

      {/* 오른쪽: 오늘 만날 친구들 + 놀자 + 동화·소리만 */}
      <View style={{ flex: 6, alignItems: 'center', gap: 22 }}>
        <View style={{ backgroundColor: C.primary, borderRadius: R.pill, paddingHorizontal: 18, paddingVertical: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: C.onPrimary }}>{day.day}일차</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 18 }}>
          {day.items.map((id) => (
            <View key={id} style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.green }}>
              <Text style={{ fontSize: 60 }}>{ITEMS[id].emoji}</Text>
            </View>
          ))}
        </View>
        <RoundButton size={140} label="놀자" onPress={() => go('/child/session')}>
          <PlayIcon size={62} />
        </RoundButton>
        {/* 버튼이 셋이라 폰 가로 화면에선 줄을 바꿔 넘치지 않게 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, maxWidth: '100%' }}>
          <PillButton label="✋ 손 놀이" onPress={() => go('/child/play')} />
          {day.story && <PillButton label="📖 동화 듣기" onPress={() => go('/child/story')} />}
          <PillButton label="🎧 소리만 듣기" onPress={() => go('/child/audio')} />
        </View>
      </View>

      {/* 부모 모드: 왼쪽 위 자물쇠 3초 + PIN */}
      <ParentExit />
    </View>
  );
}

/** 처음 한 번: 부모 폰 1-7 화면의 6자리 연결 코드 입력 (어른이 함) */
function LinkScreen({ onDone, canCancel }: { onDone: () => void; canCancel: boolean }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <View style={{ flex: 1, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ backgroundColor: C.white, borderRadius: R.lg, padding: 32, gap: 18, width: '100%', maxWidth: 520, alignItems: 'stretch' }}>
        <Text style={T.h1}>태블릿 연결</Text>
        <Text style={T.sub}>부모 폰 설정 탭에서 받은 연결 코드 6자리를 입력해 주세요.</Text>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          placeholder="ABC123"
          placeholderTextColor={C.muted}
          onSubmitEditing={() => code.length === 6 && submit()}
          style={{
            fontSize: 44,
            fontWeight: '800',
            letterSpacing: 12,
            textAlign: 'center',
            color: C.text,
            borderWidth: 2,
            borderColor: C.primaryStrong,
            borderRadius: R.md,
            paddingVertical: 14,
            backgroundColor: C.primarySoft,
          }}
        />
        {!!error && <Text style={{ fontSize: 15, color: C.warn }}>{error}</Text>}
        <Button label={busy ? '연결 중...' : '연결'} disabled={code.length !== 6 || busy} onPress={submit} style={{ minHeight: 64 }} />
        {canCancel ? (
          <Button label="취소" variant="ghost" onPress={onDone} />
        ) : (
          <Button
            label="‹ 처음 화면으로 돌아가기"
            variant="ghost"
            onPress={async () => {
              await clearRole(); // 아이 태블릿으로 잘못 골랐을 때: 기기 용도 선택 화면으로
              router.replace('/');
            }}
          />
        )}
      </View>
    </View>
  );
}
