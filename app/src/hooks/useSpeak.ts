// 아바타 말하기: 부모 목소리 TTS(민주, Fish Audio) 재생 + 음량으로 입 움직임. 담당: 태희
// TTS 서버가 안 되면 기기 기본 한국어 음성(expo-speech)으로 대신 말함 (시연이 끊기지 않게)
import { setAudioModeAsync, useAudioPlayer, useAudioSampleListener } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api';

export function useSpeak(childId: string | undefined) {
  const player = useAudioPlayer();
  const [mouth, setMouth] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const done = useRef<(() => void) | null>(null);
  const fake = useRef<ReturnType<typeof setInterval> | null>(null);
  const gotSamples = useRef(false);
  const rate = useRef(1);

  // 재생 중 PCM 음량 → 입 벌림 (0~1)
  useAudioSampleListener(player, (s) => {
    const f = s.channels[0]?.frames ?? [];
    if (!f.length) return;
    gotSamples.current = true;
    let sum = 0;
    for (const v of f) sum += v * v;
    setMouth(Math.min(1, Math.sqrt(sum / f.length) * 5));
  });

  const startFake = useCallback(() => {
    // 음량을 못 받으면 말하는 동안 입을 리듬 있게 여닫기
    if (fake.current) return;
    let t = 0;
    fake.current = setInterval(() => {
      t += 1;
      if (!gotSamples.current) setMouth(0.25 + 0.55 * Math.abs(Math.sin(t * 0.9)) * (t % 7 === 0 ? 0.2 : 1));
    }, 90);
  }, []);
  const stopFake = useCallback(() => {
    if (fake.current) clearInterval(fake.current);
    fake.current = null;
    setMouth(0);
  }, []);

  const finish = useCallback(() => {
    stopFake();
    setSpeaking(false);
    done.current?.();
    done.current = null;
  }, [stopFake]);

  // 재생이 끝나면 finish (상태 이벤트 구독)
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (st) => {
      if (st.didJustFinish) finish();
    });
    return () => sub.remove();
  }, [player, finish]);

  useEffect(() => () => stopFake(), [stopFake]);

  /** 문장 말하기 → 끝나면 resolve */
  const speak = useCallback(
    (text: string) =>
      new Promise<void>(async (resolve) => {
        Speech.stop();
        done.current?.();
        done.current = resolve;
        setSpeaking(true);
        gotSamples.current = false;
        startFake();
        try {
          if (!childId) throw new Error('no child');
          const { url } = await api.tts(childId, text);
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
          player.replace({ uri: url });
          player.setPlaybackRate(rate.current);
          player.play();
          setUsingFallback(false);
        } catch {
          setUsingFallback(true);
          Speech.speak(text, {
            language: 'ko-KR',
            rate: 0.9 * rate.current,
            pitch: 1.1,
            onDone: finish,
            onStopped: finish,
            onError: finish,
          });
        }
      }),
    [childId, player, startFake, finish],
  );

  const stop = useCallback(() => {
    Speech.stop();
    try {
      player.pause();
    } catch {}
    finish();
  }, [player, finish]);

  /** "천천히" 버튼: 0.8배속 토글 */
  const setSlow = useCallback((slow: boolean) => {
    rate.current = slow ? 0.8 : 1;
  }, []);

  return { speak, stop, speaking, mouth, setSlow, usingFallback };
}
