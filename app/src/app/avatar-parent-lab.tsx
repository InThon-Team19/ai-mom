import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, ScrollView, Text, TextInput, View } from 'react-native';
import { ParentFrameAvatar } from '@/components/ParentFrameAvatar';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { useSpeak } from '@/hooks/useSpeak';
import { PARENT_FRAMES } from '@/lib/parentFrames';
import { loadApiUrl } from '@/lib/config';
import { useProfile } from '@/lib/store';
import { sapiViseme } from '@/lib/lipsync';
import samples from '../../assets/avatar-demo/samples.json';

const sample = samples[0];
const sampleCues = sample.visemes.map((cue) => ({ start: cue.start, end: cue.end, viseme: sapiViseme(cue.id), label: '' }));
const subscribeClient = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Same playback hook and renderer as the child-facing parent conversation screens. */
export default function ParentAvatarLab() {
  const mounted = useSyncExternalStore(subscribeClient, clientSnapshot, serverSnapshot);
  // expo-audio's web player needs window.Audio; Expo server rendering has none.
  return mounted ? <ParentAvatarPlayer /> : <Text>부모 아바타 준비 중…</Text>;
}

function ParentAvatarPlayer() {
  const profile = useProfile();
  const childId = profile?.onboarded ? profile.childId : undefined;
  const { speak, stop, speaking, usingFallback, avatarDriver, setSlow, playbackError } = useSpeak(childId);
  const [ready, setReady] = useState(false);
  const [text, setText] = useState('안녕, 우리 아가. 엄마랑 사과 이야기를 해 볼까?');
  const [mode, setMode] = useState('입모양을 선택하거나 음성을 재생하세요.');
  useEffect(() => { void loadApiUrl(); }, []);
  return (
    <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 24, gap: 14, backgroundColor: '#FFF7ED', minHeight: '100%' }}>
      <Text style={{ fontSize: 24, color: '#654939', fontWeight: '700' }}>아이맘 · 부모 아바타</Text>
      <ParentFrameAvatar driver={avatarDriver} size={320} onReady={() => setReady(true)} />
      <Text>{ready ? '전체 이미지 6장 준비됨' : '이미지 불러오는 중…'}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
        {PARENT_FRAMES.map((frame) => <Button key={frame} title={frame} disabled={!ready} onPress={() => {
          stop(); avatarDriver.preview(frame); setMode('수동 입모양 확인 · 음성 동기화 테스트 아님');
        }} />)}
      </View>
      <TextInput accessibilityLabel="읽을 문장" value={text} onChangeText={setText} multiline style={{ width: '100%', maxWidth: 560, padding: 16, borderWidth: 1, borderColor: '#D9BFA9', borderRadius: 12, backgroundColor: '#fff' }} />
      <Button title="타임스탬프 포함 로컬 음성 재생" disabled={!ready} onPress={() => {
        setMode('Windows 한국어 TTS 녹음 + 실제 엔진 Viseme 이벤트 · 부모 복제 음성 아님');
        void speak(sample.text, { source: require('../../assets/avatar-demo/hello.wav'), cues: sampleCues });
      }} />
      <Button title={speaking ? '다시 말하기' : 'TTS로 말하기'} disabled={!ready || !text.trim()} onPress={() => {
        setMode(childId ? '기존 부모 TTS 요청 · 음량과 텍스트로 입모양 추정' : '등록된 부모 프로필 없음 · 기기 음성으로 시연');
        void speak(text);
      }} />
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <Button title="0.8배속" onPress={() => setSlow(true)} />
        <Button title="1배속" onPress={() => setSlow(false)} />
        <Button title="정지" onPress={stop} />
      </View>
      <Text>{mode}</Text>
      {!!playbackError && <Text accessibilityRole="alert">재생 실패: {playbackError}</Text>}
      <Text>{speaking ? '말하는 중' : '대기 중'}{usingFallback ? ' · 기기 기본 음성 / 예상 시간 기반' : ''}</Text>
      <Text style={{ color: '#795F4D', maxWidth: 560 }}>기존 TTS 서버는 Viseme 타임스탬프를 제공하지 않습니다. 음성의 재생 위치·음량과 한국어 텍스트로 추정한 입모양이며 정확한 발음 정렬은 아닙니다.</Text>
      <Text style={{ fontSize: 20, color: '#654939' }}>아이 아바타</Text>
      <FamilyAvatar role="child" size={240} />
    </ScrollView>
  );
}
