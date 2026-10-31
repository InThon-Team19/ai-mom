// 아이 태블릿 3-1 아바타가 말 걸기 (+ 처음 한 번 태블릿 연결) — 담당: 태희 (민철 와이어프레임 기준)
// 글자 최소, 큰 버튼 하나. 아바타가 먼저 말을 검 (기획: 아바타가 먼저 말 걸기)
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { PlayIcon, RoundButton, who } from '@/components/child/kit';
import { Button } from '@/components/ui';
import { dayOf, fill, ITEMS } from '@/content/curriculum';
import { useSpeak } from '@/hooks/useSpeak';
import { linkTablet, refreshProfile, useProfile } from '@/lib/store';
import { C, R, T } from '@/theme';

export default function ChildStart() {
  const profile = useProfile();
  const [relink, setRelink] = useState(false);
  const linked = !!profile?.child.name;

  useEffect(() => {
    if (linked) refreshProfile(); // 다음날 일차 받기
  }, [linked]);

  if (!profile) return null;
  if (!linked || relink) return <LinkScreen onDone={() => setRelink(false)} canCancel={linked} />;
  return <Greeting onRelink={() => setRelink(true)} />;
}

function Greeting({ onRelink }: { onRelink: () => void }) {
  const profile = useProfile();
  const insets = useSafeAreaInsets();
  const { speak, stop, mouth } = useSpeak(profile?.childId);
  const { name, me } = who(profile);
  const first = ITEMS[dayOf(profile?.day ?? 1).items[0]];
  const line = fill(`{name}야, ${first.ko} 같이 만나볼까?`, { name, me });

  const greet = useCallback(() => {
    speak(`${fill('안녕 {name}! {me}랑 같이 놀자!', { name, me })} ${line}`);
  }, [speak, name, me, line]);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(greet, 400);
      return () => {
        clearTimeout(t);
        stop();
      };
    }, [greet, stop]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', gap: 28, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <Pressable onPress={greet} accessibilityLabel={`${me} 아바타`}>
        <View style={{ width: 290, height: 290, borderRadius: 145, backgroundColor: C.white, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Avatar config={profile?.avatar} mouth={mouth} size={250} />
        </View>
      </Pressable>
      <Animated.Text entering={FadeIn.duration(500)} style={{ fontSize: 34, fontWeight: '900', color: C.text, textAlign: 'center' }}>
        {line}
      </Animated.Text>
      <RoundButton
        size={128}
        label="시작"
        onPress={() => {
          stop();
          router.push('/child/session');
        }}>
        <PlayIcon size={56} />
      </RoundButton>

      <Pressable onPress={onRelink} hitSlop={12} style={{ position: 'absolute', right: 24 + insets.right, bottom: 16 + insets.bottom }}>
        <Text style={{ fontSize: 13, color: C.muted }}>연결 바꾸기</Text>
      </Pressable>
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
      await linkTablet(code);
      onDone();
    } catch (e) {
      const msg = String((e as Error)?.message ?? '');
      setError(msg.startsWith('404') ? '코드를 찾을 수 없어요. 부모 폰의 연결 코드를 확인해 주세요.' : '서버에 연결할 수 없어요. 잠시 후 다시 해주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ backgroundColor: C.white, borderRadius: R.lg, padding: 32, gap: 18, width: '100%', maxWidth: 520, alignItems: 'stretch' }}>
        <Text style={T.h1}>태블릿 연결</Text>
        <Text style={T.sub}>부모 폰의 설정 화면에 있는 연결 코드 6자리를 입력해 주세요.</Text>
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
            borderColor: C.primary,
            borderRadius: R.md,
            paddingVertical: 14,
            backgroundColor: C.primarySoft,
          }}
        />
        {!!error && <Text style={{ fontSize: 15, color: C.warn }}>{error}</Text>}
        <Button label={busy ? '연결 중...' : '연결'} disabled={code.length !== 6 || busy} onPress={submit} style={{ minHeight: 64 }} />
        {canCancel && <Button label="취소" variant="ghost" onPress={onDone} />}
      </View>
    </View>
  );
}
