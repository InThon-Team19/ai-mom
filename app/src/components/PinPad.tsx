// PIN 입력 창 (숫자 4자리, 큰 숫자 버튼). 아이 모드 → 부모 모드 복귀 확인용 — 담당: 태희
// PIN 을 잊으면: 부모 아이디·로그인 비밀번호로 대신 확인 (onForgot)
import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

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
  onForgot,
}: {
  visible: boolean;
  childId: string;
  hash?: string;
  title?: string;
  onSuccess: () => void;
  onCancel: () => void;
  /** 아이디·비밀번호로 확인. 성공하면 null, 실패하면 보여줄 문구 */
  onForgot?: (loginId: string, password: string) => Promise<string | null>;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [forgot, setForgot] = useState(false);
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setPin('');
    setError('');
    setForgot(false);
    setPw('');
    onCancel();
  };

  const submitForgot = async () => {
    if (!onForgot) return;
    setBusy(true);
    setError('');
    const err = await onForgot(id, pw);
    setBusy(false);
    if (err) return setError(err);
    setForgot(false);
    setPw('');
  };

  const input = { fontSize: 17, borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 12, color: C.text, width: '100%' } as const;

  const press = async (k: string) => {
    if (k === '취소') return close();
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(78,59,42,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: C.bg, borderRadius: R.lg, padding: 24, gap: 16, width: '100%', maxWidth: 360, alignItems: 'center' }}>
          {forgot ? (
            <>
              <Text style={T.h2}>부모 계정으로 확인</Text>
              <Text style={[T.small, { textAlign: 'center' }]}>가입할 때 만든 아이디와 로그인 비밀번호를 넣으면 PIN 없이 부모 모드로 들어가요.</Text>
              <TextInput value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false} placeholder="아이디" placeholderTextColor={C.muted} style={input} />
              <TextInput value={pw} onChangeText={setPw} secureTextEntry placeholder="로그인 비밀번호" placeholderTextColor={C.muted} onSubmitEditing={submitForgot} style={input} />
              <Text style={{ color: C.warn, minHeight: 20, textAlign: 'center' }}>{error}</Text>
              <Pressable
                onPress={submitForgot}
                disabled={busy || id.trim().length < 3 || !pw}
                style={{ width: '100%', minHeight: 52, borderRadius: R.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, opacity: busy || id.trim().length < 3 || !pw ? 0.4 : 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: C.onPrimary }}>{busy ? '확인 중…' : '확인'}</Text>
              </Pressable>
              <Pressable onPress={() => { setForgot(false); setError(''); }} hitSlop={8}>
                <Text style={{ color: C.link, fontWeight: '700' }}>PIN으로 돌아가기</Text>
              </Pressable>
            </>
          ) : (
            <>
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
              {onForgot && (
                <Pressable onPress={() => { setForgot(true); setError(''); setPin(''); }} hitSlop={8}>
                  <Text style={{ color: C.link, fontWeight: '700' }}>PIN을 잊었어요</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
