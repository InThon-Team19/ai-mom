// 아이 말소리 상시 듣기 (녹음 버튼 없이) — 담당: 태희
// 기획 1-1 청각 반응(웃음·옹알이·울음·따라 말하기)을 읽기 위한 입력. 세션 화면이 켜져 있고 아바타가 말하지 않는 동안
// 짧은 창(window)으로 계속 녹음하며 음량(metering)을 봄 → 말소리가 시작되면 조용해질 때까지(최대 8초) 이어서 녹음
// → 서버(api.childClip)로 올려 말소리면 저장·받아쓰기 → 부모가 나중에 들을 수 있음. 올리는 동안에도 바로 다시 들음.
// - 기준: 처음 1초 주변 소음을 재고 말소리 = 주변 + 12dB (최소 -45dB, 최대 -25dB). 이후 조용할 때 주변값을 천천히 따라감
// - 대체(fallback): 음량 값이 아예 안 오거나 2초 넘게 -160 에 멈춰 있으면(일부 안드로이드) 3.5초 고정 창으로 녹음해 모두 올림
//   → 서버가 말소리 있는 창만 저장(saved:false 는 버림)
// - hold()/release(): 아바타가 말하기 전에 녹음을 멈추고(자기 목소리 녹음 방지), 말이 끝나면 0.3초 뒤 다시 들음
// - 녹음 ↔ 재생 오디오 모드: 녹음 시작 때 allowsRecording:true, 멈출 때 false (iOS 에서 TTS 가 수화기로 가지 않게 earpiece 끔)
// 영상과 달리 음성 토막은 서버 비공개 저장소에만 (부모 확인용). 효과음·진동 출력은 하지 않음.
import { File } from 'expo-file-system';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import { api, trace } from '@/lib/api';
import { logEvent } from '@/lib/sense';
import type { ChildClipOut } from '@/lib/types';

export const LISTEN = {
  TICK_MS: 100,
  CALIBRATE_MS: 1000, // 주변 소음 재는 시간
  OVER_AMBIENT_DB: 12, // 말소리 = 주변 + 12dB
  MIN_THRESHOLD_DB: -45, // 기준은 최소 이만큼 (아주 조용한 방에서 숨소리까지 잡지 않게)
  MAX_THRESHOLD_DB: -25, // 시끄러운 방에서도 이 이상으로 올리지 않음
  START_TICKS: 2, // 기준 넘는 값이 연속 2번(0.2초)이어야 말 시작
  HANG_DB: 3, // 말하는 중엔 기준 - 3dB 까지 말소리로 봄 (끊김 방지)
  SILENCE_MS: 1000, // 말한 뒤 이만큼 조용하면 끝
  MAX_SPEECH_MS: 8000,
  // 따라 말하기는 단어 하나만 들으면 됨 → 짧게 끊어서 바로 올림 (시끄러운 방에서 조용한 1초가 안 와 8초를 꽉 채우던 문제)
  REPEAT_MAX_SPEECH_MS: 2500,
  REPEAT_SILENCE_MS: 700,
  MIN_SPEECH_MS: 300, // 이보다 짧으면 소음(딸깍 등)으로 보고 버림
  IDLE_WINDOW_MS: 6000, // 말 없이 이만큼 지나면 창을 새로 시작 (파일이 커지지 않게)
  FIXED_WINDOW_MS: 3500, // 대체 모드 창 길이
  NO_METER_MS: 2000, // 음량 값이 이만큼 없으면 대체 모드
  FORCE_MS: 4000, // 귀를 눌러 강제로 듣는 시간
  RESUME_DELAY_MS: 300, // 아바타 말이 끝나고 다시 듣기까지 (스피커 잔향)
} as const;

export type ListenStatus = 'off' | 'denied' | 'paused' | 'listening' | 'hearing';
export type ClipMeta = { item: string; phase: string; expected: string };
export type ClipResult = {
  res: ChildClipOut | null; // null = 올리기 실패 (서버 꺼짐 등)
  spoke: boolean; // 음량으로 말소리를 확인했는지 (대체 모드 창은 false)
  forced: boolean;
  meta: ClipMeta;
  durationMs: number;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const removeFile = (uri: string | null) => {
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {}
};

export function useChildListener({
  childId,
  active,
  meta,
  onClip,
}: {
  childId: string | undefined;
  active: boolean; // 화면이 켜져 있고 듣기를 해도 될 때
  meta: () => ClipMeta; // 말 시작 순간의 사물·단계 (올릴 때 같이 보냄)
  onClip: (r: ClipResult) => void;
}) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const [status, setStatus] = useState<ListenStatus>('off');
  const [speechLevel, setSpeechLevel] = useState(0); // 말하는 동안만 0~1 (사물이 말소리만큼 커짐)
  const [mode, setMode] = useState<'meter' | 'fixed'>('meter');
  const level = useSharedValue(0); // 귀 표시용 (다시 그리지 않고 애니메이션만)

  const cb = useRef({ onClip, meta, childId });
  useEffect(() => {
    cb.current = { onClip, meta, childId };
  });

  const holds = useRef(0);
  const resumeAt = useRef(0);
  const stoppedWaiters = useRef<(() => void)[]>([]);
  const recording = useRef(false);
  const forceUntil = useRef(0);
  const busyRef = useRef(false); // 말 듣는 중 또는 올리는 중 (따라 말하기 기다림 연장용)
  const uploads = useRef(0);
  const traced = useRef(false);
  const statusRef = useRef<ListenStatus>('off');
  const setSt = useCallback((s: ListenStatus) => {
    if (statusRef.current !== s) {
      statusRef.current = s;
      setStatus(s);
    }
  }, []);

  /** 아바타가 말하기 전: 녹음을 멈춤 (최대 0.8초 기다림) */
  const hold = useCallback(async () => {
    holds.current += 1;
    if (!recording.current) return;
    await Promise.race([new Promise<void>((r) => stoppedWaiters.current.push(r)), sleep(800)]);
  }, []);
  /** 아바타 말이 끝남: 0.3초 뒤 다시 들음 */
  const release = useCallback(() => {
    holds.current = Math.max(0, holds.current - 1);
    if (holds.current === 0) resumeAt.current = Date.now() + LISTEN.RESUME_DELAY_MS;
  }, []);
  /** 귀를 눌렀을 때: 지금부터 4초는 말소리로 보고 녹음 */
  const force = useCallback(() => {
    forceUntil.current = Date.now() + LISTEN.FORCE_MS;
  }, []);

  useEffect(() => {
    if (!active) {
      setSt('off');
      return;
    }
    let alive = true;
    let ambient: number | null = null;
    const calib: number[] = [];
    let meterSeen = false;
    let fixed = false;

    const upload = (uri: string | null, m: ClipMeta, spoke: boolean, forced: boolean, durationMs: number) => {
      const id = cb.current.childId;
      if (!uri || !id) return;
      uploads.current += 1;
      busyRef.current = true;
      api
        .childClip(id, uri, m)
        .then((res) => {
          if (res.saved) logEvent('voice', { clip_id: res.id, text: res.text, item: m.item, matched: res.matched, phase: m.phase });
          if (res.alert) logEvent('alert', { text: res.text, item: m.item });
          cb.current.onClip({ res, spoke, forced, meta: m, durationMs });
        })
        .catch(() => cb.current.onClip({ res: null, spoke, forced, meta: m, durationMs }))
        .finally(() => {
          uploads.current -= 1;
          removeFile(uri); // 서버에 올렸으면 기기엔 남기지 않음
          if (uploads.current === 0 && statusRef.current !== 'hearing') busyRef.current = false;
        });
    };

    const startRec = async () => {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldRouteThroughEarpiece: false });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recording.current = true;
    };
    const stopRec = async () => {
      if (!recording.current) return null;
      recording.current = false;
      let uri: string | null = null;
      try {
        await recorder.stop();
        uri = recorder.uri;
      } catch {}
      return uri;
    };
    const releaseMode = async () => {
      try {
        await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldRouteThroughEarpiece: false });
      } catch {}
    };

    (async () => {
      const perm = await requestRecordingPermissionsAsync().catch(() => ({ granted: false }));
      if (!alive) return;
      if (!perm.granted) {
        setSt('denied');
        return;
      }
      // 한 녹음 창의 상태
      let winStart = 0;
      let loudTicks = 0;
      let speaking = false;
      let speechStart = 0;
      let lastLoud = 0;
      let forcedWin = false;
      let winMeta: ClipMeta = cb.current.meta();
      let failures = 0;

      const endWindow = async (keep: boolean) => {
        const uri = await stopRec();
        const dur = lastLoud - speechStart;
        if (keep) upload(uri, winMeta, speaking && !forcedWin, forcedWin, Math.max(0, Date.now() - winStart));
        else removeFile(uri);
        if (speaking || forcedWin) setSpeechLevel(0);
        speaking = false;
        forcedWin = false;
        loudTicks = 0;
        if (uploads.current === 0) busyRef.current = false;
        return dur;
      };

      while (alive) {
        const now = Date.now();
        const held = holds.current > 0 || now < resumeAt.current;
        if (held) {
          if (recording.current) {
            // 아바타가 말하기 직전까지 아이가 말하고 있었으면 (0.5초 이상) 그 토막은 살림
            const keep = (speaking && lastLoud - speechStart >= 500) || forcedWin;
            await endWindow(keep);
            await releaseMode();
          }
          stoppedWaiters.current.splice(0).forEach((r) => r());
          setSt('paused');
          level.set(0);
          await sleep(LISTEN.TICK_MS);
          continue;
        }

        if (!recording.current) {
          try {
            await startRec();
            failures = 0;
          } catch {
            failures += 1;
            await sleep(Math.min(3000, 400 * failures));
            continue;
          }
          winStart = Date.now();
          winMeta = cb.current.meta();
          setSt('listening');
        }

        await sleep(LISTEN.TICK_MS);
        if (!alive) break;
        if (!recording.current || holds.current > 0) continue;

        const t = Date.now();
        let db: number | undefined;
        try {
          db = recorder.getStatus().metering;
        } catch {}
        const valid = typeof db === 'number' && db > -159;

        // 음량 값이 오는지 진단 (서버 로그에 한 번만)
        if (valid && !meterSeen) {
          meterSeen = true;
          if (fixed) {
            fixed = false;
            setMode('meter');
          }
          if (!traced.current) {
            traced.current = true;
            trace(`child-listener metering ok first=${(db as number).toFixed(1)}dB`);
          }
        }
        if (!meterSeen && !fixed && t - winStart > LISTEN.NO_METER_MS) {
          fixed = true;
          setMode('fixed');
          if (!traced.current) {
            traced.current = true;
            trace(`child-listener metering missing (value=${String(db)}) -> fixed ${LISTEN.FIXED_WINDOW_MS}ms windows`);
          }
        }

        // 강제 듣기 (귀 누름)
        if (t < forceUntil.current && !forcedWin) {
          forcedWin = true;
          if (!speaking) {
            speaking = true;
            speechStart = t;
          }
          winMeta = cb.current.meta();
          busyRef.current = true;
          setSt('hearing');
        }

        if (fixed) {
          // 대체 모드: 음량을 모르므로 고정 창을 통째로 올림 (서버가 말소리만 저장)
          level.set(0.25 + 0.15 * Math.sin(t / 300));
          const len = forcedWin ? LISTEN.FORCE_MS : LISTEN.FIXED_WINDOW_MS;
          if (t - winStart >= len) {
            lastLoud = t;
            await endWindow(true);
          }
          continue;
        }

        const thr =
          ambient === null
            ? -35
            : Math.max(LISTEN.MIN_THRESHOLD_DB, Math.min(LISTEN.MAX_THRESHOLD_DB, ambient + LISTEN.OVER_AMBIENT_DB));
        const lv = valid ? Math.max(0, Math.min(1, ((db as number) + 60) / 50)) : 0;
        level.set(lv);

        if (valid && ambient === null) {
          calib.push(db as number);
          if (calib.length * LISTEN.TICK_MS >= LISTEN.CALIBRATE_MS) {
            const s = [...calib].sort((a, b) => a - b);
            ambient = s[Math.floor(s.length / 2)];
          }
        }

        if (!speaking) {
          if (valid && (db as number) > thr && ambient !== null) loudTicks += 1;
          else loudTicks = 0;
          if (valid && ambient !== null && (db as number) < thr) ambient = ambient * 0.97 + (db as number) * 0.03;
          if (loudTicks >= LISTEN.START_TICKS) {
            speaking = true;
            speechStart = t - LISTEN.TICK_MS * LISTEN.START_TICKS;
            lastLoud = t;
            winMeta = cb.current.meta();
            busyRef.current = true;
            setSt('hearing');
          } else if (t - winStart > LISTEN.IDLE_WINDOW_MS) {
            await endWindow(false); // 아무 말 없던 창은 버리고 새로 시작
          }
          continue;
        }

        // 말하는 중
        if ((valid && (db as number) > thr - LISTEN.HANG_DB) || t < forceUntil.current) lastLoud = t;
        setSpeechLevel(lv);
        const rep = winMeta.phase === 'repeat';
        const silent = t - lastLoud > (rep ? LISTEN.REPEAT_SILENCE_MS : LISTEN.SILENCE_MS);
        const tooLong = t - speechStart > (rep ? LISTEN.REPEAT_MAX_SPEECH_MS : LISTEN.MAX_SPEECH_MS);
        if (silent || tooLong) {
          const keep = forcedWin || lastLoud - speechStart >= LISTEN.MIN_SPEECH_MS;
          await endWindow(keep);
          setSt('listening');
        }
      }
      // 화면을 떠나는 사이 녹음이 막 시작됐으면 여기서 정리
      if (recording.current) {
        removeFile(await stopRec());
        await releaseMode();
      }
    })();

    return () => {
      alive = false;
      setSt('off');
      level.set(0);
      setSpeechLevel(0);
      busyRef.current = false;
      stoppedWaiters.current.splice(0).forEach((r) => r());
      if (recording.current) {
        recording.current = false;
        recorder
          .stop()
          .then(() => removeFile(recorder.uri))
          .catch(() => {})
          .finally(releaseMode);
      }
    };
  }, [active, recorder, level, setSt]);

  return { status, mode, level, speechLevel, hold, release, force, busyRef };
}
