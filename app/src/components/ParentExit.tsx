// 아이 화면 → 부모 모드 전환 (기획서 v2 2-5: 화면 구석을 3초 길게 누른 뒤 PIN) — 담당: 태희
// 아이 화면 어디서든 왼쪽 위 작은 자물쇠. 누르고 있는 동안 링이 차오르고, 3초 다 차면 PIN → 어른 메뉴
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PinPad } from '@/components/PinPad';
import { api } from '@/lib/api';
import { getDeviceId } from '@/lib/device';
import { clearRole, resetLocal, useProfile } from '@/lib/store';
import { C } from '@/theme';

export const CHILD_LINKED_KEY = 'aibom.childLinked'; // 이 태블릿이 등록된 child_id (연결 해제 감지용)
const HOLD_MS = 3000;

function adultMenu(childId?: string, onDone?: () => void) {
  const toParent = async () => {
    await clearRole();
    router.replace('/');
  };
  const unlink = async () => {
    if (childId) await api.removeDevice(childId, await getDeviceId()).catch(() => {});
    await AsyncStorage.removeItem(CHILD_LINKED_KEY).catch(() => {});
    await resetLocal();
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

export function ParentExit({ dark = false }: { dark?: boolean }) {
  const profile = useProfile();
  const insets = useSafeAreaInsets();
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

  const size = 44;
  const r = 19;
  const len = 2 * Math.PI * r;
  return (
    <>
      <Pressable
        onPressIn={start}
        onPressOut={stop}
        accessibilityLabel="부모 모드 (3초 길게 누르기)"
        hitSlop={8}
        style={{ position: 'absolute', left: 10 + insets.left, top: 10 + insets.top, width: size, height: size, zIndex: 50, opacity: progress > 0 ? 1 : 0.5 }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={dark ? '#ffffff55' : C.border} strokeWidth={3} fill={dark ? 'transparent' : C.white} />
          {progress > 0 && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={C.primaryStrong}
              strokeWidth={4}
              fill="none"
              strokeDasharray={`${len * progress} ${len}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </Svg>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18 }}>🔒</Text>
        </View>
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
      />
    </>
  );
}
