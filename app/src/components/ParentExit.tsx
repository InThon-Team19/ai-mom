// 아이 화면 → 부모 모드 전환 (기획서 v2 2-5: 화면 구석을 3초 길게 누른 뒤 PIN) — 담당: 태희
// 아이 화면 머리줄의 "부모" 알약 (민철 Design 보드). 누르고 있는 동안 알약이 차오르고, 3초 다 차면 PIN → 어른 메뉴
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { PinPad } from '@/components/PinPad';
import { useKid } from '@/components/child/design';
import { api } from '@/lib/api';
import { getDeviceId } from '@/lib/device';
import { authMessage, loadAccount, login, parentEntry } from '@/lib/account';
import { resetLocal, setRole, useProfile } from '@/lib/store';
import { Text } from '@/components/AppText';

export const CHILD_LINKED_KEY = 'aibom.childLinked'; // 이 태블릿이 등록된 child_id (연결 해제 감지용)
const HOLD_MS = 3000;

function adultMenu(childId?: string, onDone?: () => void) {
  // PIN 통과 → 부모 모드. 이 기기에 부모 로그인이 있으면 바로 부모 앱, 없으면(따로 쓰는 태블릿) 비밀번호 로그인
  const toParent = async () => {
    try {
      const a = await loadAccount();
      await setRole('parent');
      // 로그인돼 있으면 서버 정보로 되살려 부모 앱으로 (아이 모드에서 초기화된 프로필이어도 아이 소개를 다시 하지 않게)
      router.replace((a?.token ? await parentEntry() : '/onboarding/login') as Href);
    } catch {
      router.replace('/onboarding/login' as Href); // 서버·저장소 실패여도 어른 메뉴가 아무 반응 없이 끝나지 않게
    }
  };
  const unlink = async () => {
    try {
      if (childId) await api.removeDevice(childId, await getDeviceId()).catch(() => {});
      await AsyncStorage.removeItem(CHILD_LINKED_KEY).catch(() => {});
      await resetLocal();
    } catch {}
    router.replace('/');
  };
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.('부모 모드로 바꿀까요? (취소를 누르면 연결 해제를 물어봐요)')) toParent();
    else if (globalThis.confirm?.('이 태블릿의 연결을 해제할까요?')) unlink();
    onDone?.();
    return;
  }
  Alert.alert('어른 메뉴', '이 기기를 어떻게 할까요?', [
    { text: '부모 모드로 바꾸기', onPress: toParent },
    { text: '아이 기기 연결 해제', style: 'destructive', onPress: unlink },
    { text: '취소', style: 'cancel', onPress: onDone },
  ]);
}

/**
 * 부모 알약 (보드: 흰 알약 "부모" / 홈은 "부모 · 3초 꾹"). 머리줄 안에 놓임.
 * 누르고 있는 동안 알약 안이 노랗게 차오르고, 3초 다 차면 PIN → 어른 메뉴. dark: 소리만 듣기(밤 화면)
 */
export function ParentExit({ dark = false, label = '부모' }: { dark?: boolean; label?: string; home?: boolean }) {
  const profile = useProfile();
  // 크기: 옆 SoftPill(소리만·천천히·홈)과 같은 비율 — 태블릿 크기에 따라 같이 커지고 줄어듦
  const { u, f } = useKid();
  const [progress, setProgress] = useState(0);
  const [pinOpen, setPinOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  };
  useEffect(() => stop, []);

  const start = () => {
    if (timer.current) clearInterval(timer.current); // 두 번 눌림이 와도 타이머가 겹쳐 남지 않게
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        stop();
        setPinOpen(true);
      }
    }, 50);
  };

  const h = u(48, 36);
  const ink = dark ? '#FFFFFF' : '#3A364E';
  return (
    <>
      <Pressable
        onPressIn={start}
        onPressOut={stop}
        // 웹(폰 브라우저): 길게 누르면 뜨는 메뉴(contextmenu)가 누르기를 끊지 않게 — RN Web 은 onLongPress 가 있으면 막아 줌
        onLongPress={Platform.OS === 'web' ? () => {} : undefined}
        delayLongPress={HOLD_MS + 1000}
        accessibilityRole="button"
        accessibilityLabel="부모 모드 (3초 길게 누르기)"
        hitSlop={8}
        style={{
          height: h,
          paddingHorizontal: u(18, 12),
          borderRadius: h / 2,
          backgroundColor: dark ? '#3D3470' : '#FFFFFF',
          boxShadow: dark ? undefined : '0px 3px 10px rgba(58,54,78,0.08)',
          flexDirection: 'row',
          alignItems: 'center',
          gap: u(8, 5),
          overflow: 'hidden',
        }}>
        {/* 3초 누르는 동안 왼쪽부터 노랗게 차오름 (깜빡임 없음) */}
        {progress > 0 && <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(progress * 100)}%`, backgroundColor: '#EFCA5A' }} />}
        <Svg width={u(14, 11)} height={u(16, 13)} viewBox="0 0 14 16">
          <Rect x="1" y="7" width="12" height="8" rx="2" fill={progress > 0 ? '#3A364E' : ink} />
          <Path d="M4 7V5a3 3 0 0 1 6 0v2" stroke={progress > 0 ? '#3A364E' : ink} strokeWidth={2} fill="none" />
        </Svg>
        <Text selectable={false} style={{ fontSize: f(17, 13), fontWeight: '800', color: progress > 0 ? '#3A364E' : ink }}>{label}</Text>
      </Pressable>
      <PinPad
        visible={pinOpen}
        childId={profile?.childId ?? ''}
        hash={profile?.pinHash}
        onCancel={() => setPinOpen(false)}
        onSuccess={() => {
          setPinOpen(false);
          adultMenu(profile?.childId);
        }}
        onForgot={async (loginId, password) => {
          // PIN 을 잊었을 때: 부모 아이디·비밀번호로 로그인 → 바로 부모 앱 → 설정에서 새 PIN
          try {
            await login(loginId, password);
          } catch (e) {
            return authMessage(e);
          }
          setPinOpen(false);
          await setRole('parent');
          router.replace('/parent/settings' as Href);
          setTimeout(() => {
            if (Platform.OS === 'web') globalThis.alert?.('설정 탭 "부모 PIN"에서 새 PIN을 정해 주세요.');
            else Alert.alert('부모 모드로 들어왔어요', '설정 탭 "부모 PIN"에서 새 PIN을 정해 주세요.');
          }, 600);
          return null;
        }}
      />
    </>
  );
}
