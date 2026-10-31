// 아바타 말하기: 부모 목소리 TTS(민주, Fish Audio) 재생 + 음량으로 입 움직임. 담당: 태희
// TTS 서버가 안 되면 기기 기본 한국어 음성(expo-speech)으로 대신 말함 (시연이 끊기지 않게)
import { setAudioModeAsync, useAudioPlayer, useAudioSampleListener } from 'expo-audio';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api, reportError } from '@/lib/api';

export function useSpeak(childId: string | undefined) {
  const player = useAudioPlayer();
  const [mouth, setMouth] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const done = useRef<(() => void) | null>(null);
  const fake = useRef<ReturnType<typeof setInterval> | null>(null);
  const gotSamples = useRef(false);
  const rate = useRef(1);
  const gen = useRef(0); // 말하기 차례 번호: stop·새 speak 뒤에 늦게 도착한 TTS·끝남 알림은 버림
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 서버가 준 소리 크기 그래프(0.04초 간격)로 입 움직임 — 재생 위치에 맞춰서 목소리와 정확히 맞춤
  const env = useRef<{ v: number[]; ms: number } | null>(null);
  const playingGen = useRef(-1); // 지금 재생 중인 mp3 가 몇 번째 말하기인지 (앞 문장 끝남 알림 무시용)
  const envTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 재생 중 PCM 음량 → 입 벌림 (0~1)
  useAudioSampleListener(player, (s) => {
    const f = s.channels[0]?.frames ?? [];
    if (!f.length || env.current) return; // 소리 크기 그래프가 있으면 그걸 씀
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
    if (envTimer.current) clearInterval(envTimer.current);
    envTimer.current = null;
    setMouth(0);
  }, []);

  /** 실제 소리가 나오기 시작할 때만 입을 움직임: 그래프가 있으면 재생 위치대로, 없으면 기기 음량 → 가짜 리듬 */
  const startMouth = useCallback(() => {
    const e = env.current;
    if (!e) return startFake();
    if (envTimer.current) return;
    envTimer.current = setInterval(() => {
      const i = Math.floor((player.currentTime * 1000) / e.ms);
      setMouth(player.playing ? Math.min(1, (e.v[i] ?? 0) * 0.9 + 0.05 * Number((e.v[i] ?? 0) > 0)) : 0);
    }, 40);
  }, [player, startFake]);

  const finish = useCallback(() => {
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = null;
    stopFake();
    setSpeaking(false);
    done.current?.();
    done.current = null;
  }, [stopFake]);

  // 재생이 끝나면 finish (상태 이벤트 구독)
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (st) => {
      if (st.playing && st.currentTime > 0 && done.current) startMouth(); // 소리가 실제로 나기 시작함
      if (st.didJustFinish && playingGen.current === gen.current) finish(); // 앞 문장이 늦게 끝난 알림은 무시
    });
    return () => sub.remove();
  }, [player, finish, startMouth]);

  useEffect(
    () => () => {
      gen.current++; // 화면을 떠나면 늦게 온 TTS 를 틀거나 기기 음성으로 말하지 않게
      if (watchdog.current) clearTimeout(watchdog.current);
      Speech.stop();
      stopFake();
    },
    [stopFake],
  );

  /** 문장 말하기 → 끝나면 resolve */
  const speak = useCallback(
    (text: string) =>
      new Promise<void>(async (resolve) => {
        const my = ++gen.current;
        Speech.stop();
        try {
          player.pause(); // 앞 문장 재생이 남아 있으면 멈춤 (그 끝남 알림이 이 문장을 끝내지 않게)
        } catch {}
        done.current?.();
        done.current = resolve;
        if (watchdog.current) clearTimeout(watchdog.current);
        watchdog.current = null;
        // 재생 주소를 못 여는 등으로 끝남 알림이 안 오면 흐름이 멈추지 않게 넉넉한 시간 뒤 끝냄
        const guard = () => {
          watchdog.current = setTimeout(() => {
            if (my !== gen.current) return;
            gen.current++;
            Speech.stop();
            try {
              player.pause();
            } catch {}
            finish();
          }, 5000 + (text.length * 300) / rate.current);
        };
        const onEnd = () => {
          if (my === gen.current) finish();
        };
        setSpeaking(true);
        gotSamples.current = false;
        env.current = null;
        stopFake(); // 목소리가 오기 전에는 입을 닫고 기다림 (소리 없이 입만 움직이지 않게)
        try {
          if (!childId) throw new Error('no child');
          // 한 번 실패해도 바로 기기 음성(로봇 목소리)으로 바꾸지 않고 한 번 더 시도
          const { url, env: v, env_ms } = await api.tts(childId, text).catch(async () => {
            await new Promise((r) => setTimeout(r, 400));
            if (my !== gen.current) throw new Error('stale');
            return api.tts(childId, text);
          });
          if (my !== gen.current) return; // 기다리는 사이 멈췄거나 다음 문장으로 넘어감 → 늦게 온 소리는 틀지 않음
          // 재생 모드 설정이 실패해도 받은 엄마 목소리는 그대로 틈 (예전엔 여기서 실패하면 기기 음성으로 바뀜)
          await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch((e) => reportError('speak.audioMode', e));
          if (my !== gen.current) return;
          env.current = v && v.length ? { v, ms: env_ms || 40 } : null;
          playingGen.current = my;
          player.replace({ uri: url });
          player.setPlaybackRate(rate.current);
          player.play();
          if (env.current) startMouth(); // 0.04초마다 실제 재생 위치를 보고 입을 움직임 (재생 전엔 닫힘)
          guard();
          setUsingFallback(false);
        } catch (e) {
          if (my !== gen.current) return;
          reportError('speak.fallback', e); // 왜 기기 음성으로 바뀌었는지 서버 기록에 남김
          setUsingFallback(true);
          guard();
          Speech.speak(text, {
            language: 'ko-KR',
            rate: 0.9 * rate.current,
            pitch: 1.1,
            onStart: () => {
              if (my === gen.current) startFake(); // 기기 음성은 소리 크기를 못 받아 리듬으로
            },
            onDone: onEnd,
            onStopped: onEnd,
            onError: onEnd,
          });
        }
      }),
    [childId, player, startFake, stopFake, startMouth, finish],
  );

  const stop = useCallback(() => {
    gen.current++;
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
