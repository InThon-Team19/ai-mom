// 가입 3/5 목소리 등록 (부모 음성 입력) — 담당: 태희 (녹음·업로드) · 민주 (TTS 등록·학습률)
// 기능만 동작하는 임시 화면. 디자인은 민철 와이어프레임 나오면 교체
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { api } from '@/lib/api';
import { CHILD_ID } from '@/lib/config';
import type { ParentSampleOut } from '@/lib/types';

const SCRIPTS = [
  '우리 아기, 오늘도 잘 잤어? 엄마랑 같이 놀자.',
  '이건 사과야. 빨갛고 동그랗지? 사과, 따라 해 볼까?',
  '와, 정말 잘했어! 최고야. 한 번 더 해 볼까?',
  '오늘은 어떤 동물을 만나 볼까? 멍멍 강아지가 왔어요.',
  '이제 잘 시간이야. 사랑해, 좋은 꿈 꿔.',
];

export default function Screen() {
  const rec = useVoiceRecorder();
  const [i, setI] = useState(0);
  const [last, setLast] = useState<ParentSampleOut | null>(null);
  const [status, setStatus] = useState('');

  async function toggle() {
    try {
      if (!rec.isRecording) {
        setStatus('');
        await rec.start();
        return;
      }
      const uri = await rec.stop();
      if (!uri) return;
      setStatus('업로드 중...');
      const res = await api.parentVoiceSample(CHILD_ID, uri);
      setLast(res);
      setStatus(res.features.speech_s < 1 ? '목소리가 작아요. 다시 읽어 주세요.' : '');
      if (res.features.speech_s >= 1) setI((n) => (n + 1) % SCRIPTS.length);
    } catch (e) {
      setStatus(String(e));
    }
  }

  const progress = last?.progress ?? 0;
  return (
    <SafeAreaView style={{ flex: 1, padding: 24, gap: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: '700' }}>가입 3/5 목소리 등록</Text>
      <Text style={{ color: '#666' }}>아래 문장을 아이에게 말하듯 읽어 주세요.</Text>
      <Text style={{ fontSize: 20, lineHeight: 30, padding: 16, backgroundColor: '#f2f2f2', borderRadius: 12 }}>
        {SCRIPTS[i]}
      </Text>

      <Pressable
        onPress={toggle}
        style={{ padding: 18, borderRadius: 40, alignItems: 'center', backgroundColor: rec.isRecording ? '#e5484d' : '#208AEF' }}>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>
          {rec.isRecording ? `■ 멈추기 (${rec.seconds.toFixed(0)}초)` : '● 녹음 시작'}
        </Text>
      </Pressable>

      <View style={{ height: 12, backgroundColor: '#eee', borderRadius: 6, overflow: 'hidden' }}>
        <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: '#30a46c' }} />
      </View>
      <Text>
        학습률 {(progress * 100).toFixed(0)}% · 누적 {last?.total_speech_s ?? 0}초 · 샘플 {last?.sample_count ?? 0}개
      </Text>
      {!!status && <Text style={{ color: '#e5484d' }}>{status}</Text>}
      {progress >= 1 && (
        <Link href="/parent/mouth" style={{ fontSize: 18, color: '#208AEF' }}>
          다음: 입모양 영상 →
        </Link>
      )}
    </SafeAreaView>
  );
}
