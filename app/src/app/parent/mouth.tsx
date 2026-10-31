// 가입 4/5 입모양 영상 (부모 영상 입력) — 담당: 태희
// 기능만 동작하는 임시 화면. 디자인은 민철 와이어프레임 나오면 교체
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { CHILD_ID } from '@/lib/config';
import type { ParentMouthOut } from '@/lib/types';

const SCRIPT = '아, 에, 이, 오, 우. 사과, 바나나, 엄마, 아빠. 안녕, 사랑해!';
const MAX_SECONDS = 15;

export default function Screen() {
  const cam = useRef<CameraView>(null);
  const [camPerm, reqCam] = useCameraPermissions();
  const [micPerm, reqMic] = useMicrophonePermissions();
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState<ParentMouthOut | null>(null);

  if (!camPerm?.granted || !micPerm?.granted) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 24, gap: 16, justifyContent: 'center' }}>
        <Text style={{ fontSize: 18 }}>입모양을 찍으려면 카메라와 마이크 권한이 필요해요.</Text>
        <Pressable onPress={async () => { await reqCam(); await reqMic(); }} style={{ padding: 16, backgroundColor: '#208AEF', borderRadius: 12 }}>
          <Text style={{ color: 'white', textAlign: 'center', fontSize: 18 }}>권한 허용</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  async function toggle() {
    if (recording) {
      cam.current?.stopRecording();
      return;
    }
    setResult(null);
    setStatus('');
    setRecording(true);
    try {
      const video = await cam.current?.recordAsync({ maxDuration: MAX_SECONDS });
      setRecording(false);
      if (!video?.uri) return;
      setStatus('분석 중... (10초 정도 걸려요)');
      const res = await api.parentMouth(CHILD_ID, video.uri, 'signup');
      setResult(res);
      setStatus(res.message);
    } catch (e) {
      setRecording(false);
      setStatus(String(e));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>가입 4/5 입모양 영상</Text>
      <Text style={{ color: '#666' }}>얼굴이 화면 가운데 오게 하고, 천천히 또박또박 읽어 주세요.</Text>
      <Text style={{ fontSize: 18, padding: 12, backgroundColor: '#f2f2f2', borderRadius: 12 }}>{SCRIPT}</Text>
      <CameraView ref={cam} style={{ flex: 1, borderRadius: 16 }} facing="front" mode="video" />
      <Pressable
        onPress={toggle}
        style={{ padding: 18, borderRadius: 40, alignItems: 'center', backgroundColor: recording ? '#e5484d' : '#208AEF' }}>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>
          {recording ? '■ 멈추기' : `● 촬영 시작 (최대 ${MAX_SECONDS}초)`}
        </Text>
      </Pressable>
      {!!status && <Text>{status}</Text>}
      {result && result.sprites.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {result.sprites.map((uri) => (
            <Image key={uri} source={{ uri }} style={{ width: 64, height: 64, borderRadius: 8 }} />
          ))}
        </View>
      )}
      {result?.ok && (
        <Link href="/parent/persona" style={{ fontSize: 18, color: '#208AEF' }}>
          다음: 페르소나 →
        </Link>
      )}
    </SafeAreaView>
  );
}
