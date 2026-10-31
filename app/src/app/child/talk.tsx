// 아이 대화 (아바타 + 감각 놀이, 아이 영상·음성 입력) — 담당: 태희
// 지금은 입력 확인용 임시 화면: 카메라로 응시·입 벌림, 마이크로 따라 말하기 판정.
// 아바타·에이전트 대화(충항)·TTS(민주)가 붙으면 이 화면에 합침. 디자인은 민철 와이어프레임 기준
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useChildSensing } from '@/hooks/useChildSensing';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { api } from '@/lib/api';
import type { SttOut } from '@/lib/types';

const WORDS = ['사과', '바나나', '엄마', '강아지', '안녕'];

export default function Screen() {
  const cam = useRef<CameraView>(null);
  const [perm, reqPerm] = useCameraPermissions();
  const sensing = useChildSensing(cam, !!perm?.granted);
  const rec = useVoiceRecorder();
  const [w, setW] = useState(0);
  const [stt, setStt] = useState<SttOut | null>(null);
  const [status, setStatus] = useState('');

  async function onPressIn() {
    setStt(null);
    setStatus('');
    try {
      await rec.start();
    } catch (e) {
      setStatus(String(e));
    }
  }

  async function onPressOut() {
    try {
      const uri = await rec.stop();
      if (!uri) return;
      setStatus('듣는 중...');
      const res = await api.stt(uri, WORDS[w], 'child');
      setStt(res);
      setStatus('');
      if (res.matched) setW((n) => (n + 1) % WORDS.length);
    } catch (e) {
      setStatus(String(e));
    }
  }

  const s = sensing.latest;
  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ width: 160, height: 120, borderRadius: 12, overflow: 'hidden', backgroundColor: '#ddd' }}>
          {perm?.granted ? (
            <CameraView ref={cam} style={{ flex: 1 }} facing="front" animateShutter={false} />
          ) : (
            <Pressable onPress={reqPerm} style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={{ textAlign: 'center' }}>카메라 허용</Text>
            </Pressable>
          )}
        </View>
        <View style={{ gap: 4, justifyContent: 'center' }}>
          <Text>얼굴: {s ? (s.face ? '보임' : '안 보임') : '-'}</Text>
          <Text>화면 응시: {s ? (s.looking ? '👀 보는 중' : '딴 곳') : '-'}</Text>
          <Text>입: {s ? (s.mouth_open ? '벌림' : '닫힘') : '-'}</Text>
          {!!sensing.error && <Text style={{ color: '#e5484d' }} numberOfLines={2}>{sensing.error}</Text>}
        </View>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Text style={{ fontSize: 64, fontWeight: '800' }}>{WORDS[w]}</Text>
        <Text style={{ color: '#666' }}>버튼을 누르고 있는 동안 말해요</Text>
        {stt && (
          <Text style={{ fontSize: 22 }}>
            {stt.matched ? '🎉 잘했어!' : '한 번 더!'} ({stt.text || '…'})
          </Text>
        )}
        {!!status && <Text>{status}</Text>}
      </View>

      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{ padding: 24, borderRadius: 48, alignItems: 'center', backgroundColor: rec.isRecording ? '#e5484d' : '#30a46c' }}>
        <Text style={{ color: 'white', fontSize: 22, fontWeight: '700' }}>{rec.isRecording ? '듣고 있어요...' : '🎤 말하기'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}
