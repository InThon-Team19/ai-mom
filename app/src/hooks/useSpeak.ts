// 아바타 말하기: 부모 목소리 TTS(민주, Fish Audio) 재생 + 음량으로 입 움직임. 담당: 태희
// TTS 서버가 안 되면 기기 기본 한국어 음성(expo-speech)으로 대신 말함 (시연이 끊기지 않게)
import { getRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, type AudioSource } from 'expo-audio';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';

import { api, reportError } from '@/lib/api';
import { createLipTimeline, cueAt, type LipCue } from '@/lib/lipsync';
import { createParentFrameDriver } from '@/lib/parentFrames';

export type SpeakClip = { source: AudioSource; cues?: LipCue[]; env?: number[]; env_ms?: number };

/** 기기 음성 멈춤: 이 Expo Go 에 모듈이 없거나 실패해도 흐름이 멈추지 않게 (stop 은 Promise 라 거부도 삼킴) */
const stopSpeech = () => {
  try {
    void Speech.stop().catch(() => {});
  } catch {}
};

export function useSpeak(childId: string | undefined, legacyMeter = false) {
  const player = useAudioPlayer(null, { updateInterval: 40 });
  const [mouth, setMouth] = useState(0);
  const mouthPose = undefined; // Old SVG callers remain source-compatible; PNGs use the driver.
  const [avatarDriver] = useState(createParentFrameDriver);
  const actualCues = useRef<LipCue[] | null>(null);
  const pcm = useRef({ energy: 0, at: -Infinity });
  const meterAt = useRef(0);
  const [speaking, setSpeaking] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const done = useRef<(() => void) | null>(null);
  const fake = useRef<ReturnType<typeof setInterval> | null>(null);
  const rate = useRef(1);
  const gen = useRef(0); // 말하기 차례 번호: stop·새 speak 뒤에 늦게 도착한 TTS·끝남 알림은 버림
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Envelope is audio energy, NOT phoneme alignment.
  const env = useRef<{ v: number[]; ms: number } | null>(null);
  const playingGen = useRef(-1); // 지금 재생 중인 mp3 가 몇 번째 말하기인지 (앞 문장 끝남 알림 무시용)
  const envTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const phrase = useRef('');
  const lipCache = useRef<{ duration: number; cues: LipCue[] }>({ duration: 0, cues: [] });
  const syncPose = useCallback((seconds: number, duration = 0) => {
    if (!lipCache.current.cues.length || Math.abs(duration - lipCache.current.duration) > 0.1) {
      lipCache.current = { duration, cues: createLipTimeline(phrase.current, duration) };
    }
    const e = env.current;
    const energy = e ? e.v[Math.floor(seconds * 1000 / e.ms)] ?? 0
      : Date.now() - pcm.current.at < 180 ? pcm.current.energy : undefined;
    const cues = actualCues.current ?? lipCache.current.cues;
    avatarDriver.update(seconds, cueAt(cues, seconds)?.viseme ?? 'rest', energy, !!actualCues.current);
    // Audio-only screen's existing meter is throttled; avatar screens never set state here.
    if (legacyMeter && Date.now() - meterAt.current >= 150) {
      meterAt.current = Date.now();
      setMouth(energy ?? (avatarDriver.current === 'neutral' ? 0 : 0.5));
    }
  }, [avatarDriver, legacyMeter]);

  // Same sampling API used by useAudioSampleListener, but gated BEFORE enabling it.
  // Android needs already-granted RECORD_AUDIO; playback alone never prompts for mic.
  useEffect(() => {
    let cancelled = false;
    let sub: { remove(): void } | undefined;
    void (async () => {
      if (Platform.OS === 'android' && !(await getRecordingPermissionsAsync()).granted) return;
      if (cancelled || !player.isAudioSamplingSupported) return;
      sub = player.addListener('audioSampleUpdate', (sample) => {
        const frames = sample.channels[0]?.frames;
        if (!frames?.length || env.current || !done.current || !player.playing) return;
        let sum = 0;
        for (const value of frames) sum += value * value;
        pcm.current = { energy: Math.min(1, Math.sqrt(sum / frames.length) * 5), at: Date.now() };
      });
      player.setAudioSamplingEnabled(true);
    })().catch(() => {}); // Unsupported sampling must not prevent TTS playback.
    return () => { cancelled = true; sub?.remove(); try { player.setAudioSamplingEnabled(false); } catch {} };
  }, [player]);

  const startFake = useCallback(() => {
    // 음량을 못 받으면 말하는 동안 입을 리듬 있게 여닫기
    if (fake.current) return;
    let previous = Date.now();
    let elapsed = 0;
    fake.current = setInterval(() => {
      const now = Date.now();
      elapsed += (now - previous) / 1000 * rate.current;
      previous = now;
      syncPose(elapsed);
    }, 33);
  }, [syncPose]);
  const stopFake = useCallback(() => {
    if (fake.current) clearInterval(fake.current);
    fake.current = null;
    if (envTimer.current) clearInterval(envTimer.current);
    envTimer.current = null;
    if (legacyMeter) setMouth(0);
    avatarDriver.reset();
  }, [avatarDriver, legacyMeter]);

  /** 실제 소리가 나오기 시작할 때만 입을 움직임: 그래프가 있으면 재생 위치대로, 없으면 기기 음량 → 가짜 리듬 */
  const startMouth = useCallback(() => {
    if (envTimer.current) return;
    envTimer.current = setInterval(() => {
      const e = env.current;
      if (player.playing && !player.isBuffering) syncPose(player.currentTime, player.duration || (e ? e.v.length * e.ms / 1000 : 0));
      else avatarDriver.reset();
    }, 40);
  }, [player, avatarDriver, syncPose]);

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
      stopSpeech();
      stopFake();
      done.current?.();
      done.current = null;
    },
    [stopFake],
  );

  /** 문장 말하기 → 끝나면 resolve */
  const speak = useCallback(
    (text: string, clip?: SpeakClip) =>
      new Promise<void>(async (resolve) => {
        const my = ++gen.current;
        playingGen.current = -1;
        stopSpeech();
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
            setPlaybackError('재생 완료를 확인하지 못해 중지했어요. 음성 주소와 기기 오디오 상태를 확인해 주세요.');
            gen.current++;
            stopSpeech();
            try {
              player.pause();
            } catch {}
            finish();
          }, clip ? 60000 : 5000 + (text.length * 300) / rate.current);
        };
        const onEnd = () => {
          if (my === gen.current) finish();
        };
        setSpeaking(true);
        setPlaybackError('');
        pcm.current = { energy: 0, at: -Infinity };
        actualCues.current = clip?.cues?.length ? clip.cues : null;
        env.current = null;
        phrase.current = text;
        lipCache.current = { duration: 0, cues: [] };
        stopFake(); // 목소리가 오기 전에는 입을 닫고 기다림 (소리 없이 입만 움직이지 않게)
        try {
          if (!clip && !childId) throw new Error('no child');
          // 한 번 실패해도 바로 기기 음성(로봇 목소리)으로 바꾸지 않고 한 번 더 시도
          const result = clip ?? await api.tts(childId!, text).catch(async (e) => {
            if (/\b400\b/.test(String(e))) throw e; // No parent recording: preserve upstream immediate fallback.
            await new Promise((r) => setTimeout(r, 400));
            if (my !== gen.current) throw new Error('stale');
            return api.tts(childId!, text);
          });
          if (my !== gen.current) return; // 기다리는 사이 멈췄거나 다음 문장으로 넘어감 → 늦게 온 소리는 틀지 않음
          // 재생 모드 설정이 실패해도 받은 엄마 목소리는 그대로 틈 (예전엔 여기서 실패하면 기기 음성으로 바뀜)
          // iOS 만: 녹음 모드면 스피커 소리가 작아져서 재생 전에 끔. Android 는 끼어들기 감지용 녹음을 끊지 않게 그대로 둠
          if (Platform.OS === 'ios') await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch((e) => reportError('speak.audioMode', e));
          if (my !== gen.current) return;
          const { env: v, env_ms } = result;
          env.current = v && v.length ? { v, ms: env_ms && env_ms > 0 ? env_ms : 40 } : null;
          playingGen.current = my;
          player.replace('source' in result ? result.source : { uri: result.url });
          try {
            player.setPlaybackRate(rate.current); // 일부 기기에서 안 되면 보통 속도로 (엄마 목소리는 그대로)
          } catch {}
          player.play();
          startMouth(); // Always use playback time, including when no envelope is available.
          guard();
          setUsingFallback(false);
        } catch (e) {
          if (my !== gen.current) return;
          if (clip) { setPlaybackError(String(e)); finish(); return; } // Never disguise a failed sample as live TTS.
          actualCues.current = null;
          reportError('speak.fallback', e); // 왜 기기 음성으로 바뀌었는지 서버 기록에 남김
          setUsingFallback(true);
          guard();
          try {
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
          } catch (err) {
            // 기기 음성도 없으면 잠깐 뒤 끝냄 (흐름·듣기가 멈추지 않게)
            reportError('speak.device', err);
            setTimeout(onEnd, 800);
          }
        }
      }),
    [childId, player, startFake, stopFake, startMouth, finish],
  );

  const stop = useCallback(() => {
    gen.current++;
    stopSpeech();
    try {
      player.pause();
    } catch {}
    finish();
  }, [player, finish]);

  /** "천천히" 버튼: 0.8배속 토글 */
  const setSlow = useCallback((slow: boolean) => {
    rate.current = slow ? 0.8 : 1;
    try { player.setPlaybackRate(rate.current); } catch {}
  }, [player]);

  return { speak, stop, speaking, mouth, mouthPose, avatarDriver, setSlow, usingFallback, playbackError };
}
