// PIN 입력 창 (숫자 4자리, 큰 숫자 버튼). 아이 모드 → 부모 모드 복귀 확인용 — 담당: 태희
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { checkPin } from '@/lib/pin';
import { C, R, T } from '@/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '취소', '0', '⌫'];

export function PinPad({
  visible,
  childId,
  hash,
  title = '부모 PIN을 입력해 주세요',
  onSuccess,
  onCancel,
}: {
  visible: boolean;
  childId: string;
  hash?: string;
  title?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const press = async (k: string) => {
    if (k === '취소') {
      setPin('');
      setError('');
      onCancel();
      return;
    }
    if (k === '⌫') return setPin((p) => p.slice(0, -1));
    const next = (pin + k).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      if (await checkPin(childId, next, hash)) {
        setPin('');
        setError('');
        onSuccess();
      } else {
        setPin('');
        setError('PIN이 맞지 않아요');
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(78,59,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: C.bg, borderRadius: R.lg, padding: 24, gap: 16, width: '100%', maxWidth: 360, alignItems: 'center' }}>
          <Text style={T.h2}>{title}</Text>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: C.text, backgroundColor: i < pin.length ? C.text : 'transparent' }} />
            ))}
          </View>
          <Text style={{ color: C.warn, minHeight: 20 }}>{error}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, width: 264 }}>
            {KEYS.map((k) => (
              <Pressable
                key={k}
                onPress={() => press(k)}
                style={({ pressed }) => ({
                  width: 80,
                  height: 64,
                  borderRadius: R.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: k.length === 1 ? (pressed ? C.primaryStrong : C.primary) : C.card,
                })}>
                <Text style={{ fontSize: k.length === 1 ? 26 : 17, fontWeight: '800', color: C.onPrimary }}>{k}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
