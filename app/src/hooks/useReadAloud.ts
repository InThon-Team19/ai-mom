// 부모 낭독 공통 흐름 (가입 1-5 목소리, 1-6 입모양, 밤 2-4 계획 낭독). 담당: 태희
// 문장 하나 녹음 + (camera 면) 그동안 0.05초마다 입모양 수치 수집 → 서버 → 품질·학습률 갱신 → 다음 문장
import { useCallback, useEffect, useRef, useState } from 'react';

import type { FaceFrame } from '@/components/FaceTracker';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { api } from '@/lib/api';
import type { Gauge, TrackPoint } from '@/lib/types';

export type SentenceStatus = 'done' | 'now' | 'todo' | 'retry';

const EMPTY: Gauge = { progress: 0, baseline: 0.5, usable: false, amount: 0, sentences: 0, remaining_sentences: 0 };

export function useReadAloud({
  childId,
  sentences,
  kind,
  camera,
}: {
  childId: string | undefined;
  sentences: string[];
  kind: 'signup' | 'plan';
  camera: boolean; // 입모양도 수집할지
}) {
  const rec = useVoiceRecorder();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<Record<number, 'done' | 'retry'>>({});
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState<Gauge>(EMPTY);
  const [mouth, setMouth] = useState<Gauge>(EMPTY);
  const [gain, setGain] = useState({ voice: 0, mouth: 0 });
  const [message, setMessage] = useState('');
  const [face, setFace] = useState<FaceFrame | null>(null);
  const track = useRef<TrackPoint[]>([]);
  const t0 = useRef(0);

  useEffect(() => {
    if (!childId) return;
    api.voiceGauge(childId).then(setVoice).catch(() => {});
    if (camera) api.mouthGauge(childId).then(setMouth).catch(() => {});
  }, [childId, camera]);

  /** FaceTracker onFrame 에 연결 */
  const onFrame = useCallback(
    (f: FaceFrame) => {
      setFace(f);
      if (rec.isRecording) {
        track.current.push({ t: (Date.now() - t0.current) / 1000, open: f.open, width: f.width, face: f.face });
      }
    },
    [rec.isRecording],
  );

  const toggle = useCallback(async () => {
    if (!childId || busy) return;
    try {
      if (!rec.isRecording) {
        setMessage('');
        track.current = [];
        t0.current = Date.now();
        await rec.start();
        return;
      }
      const uri = await rec.stop();
      if (!uri) return;
      setBusy(true);
      const text = sentences[index] ?? '';
      const [vr, mr] = await Promise.allSettled([
        api.parentVoiceSample(childId, uri, text, kind),
        camera && track.current.length ? api.mouthTrack(childId, track.current, text, kind) : Promise.resolve(null),
      ]);
      const v = vr.status === 'fulfilled' ? vr.value : null;
      const m = mr.status === 'fulfilled' ? mr.value : null;
      if (v) setVoice(v.gauge);
      if (m) setMouth(m.gauge);
      setGain({ voice: v?.gained ?? 0, mouth: m?.gained ?? 0 });
      if (!v) {
        const err = vr.status === 'rejected' ? String(vr.reason).slice(0, 80) : '';
        setMessage(`목소리 전송 실패: ${err}`);
        setDone((d) => ({ ...d, [index]: 'retry' }));
        return;
      }
      const ok = v.quality.ok && (!m || m.ok);
      setMessage(!v.quality.ok ? v.quality.message : m && !m.ok ? m.message : '좋아요!');
      setDone((d) => ({ ...d, [index]: ok ? 'done' : 'retry' }));
      if (ok) setIndex((i) => Math.min(i + 1, sentences.length - 1));
    } catch (e) {
      setMessage(`전송 실패: ${String(e).slice(0, 80)}`);
    } finally {
      setBusy(false);
    }
  }, [childId, busy, rec, sentences, index, kind, camera]);

  const statuses: SentenceStatus[] = sentences.map((_, i) => (i === index ? 'now' : done[i] === 'done' ? 'done' : done[i] === 'retry' ? 'retry' : 'todo'));
  const allDone = sentences.every((_, i) => done[i] === 'done');

  return {
    index,
    setIndex,
    statuses,
    allDone,
    recording: rec.isRecording,
    seconds: rec.seconds,
    busy,
    toggle,
    voice,
    mouth,
    gain,
    message,
    face, // 촬영 중 표시: 얼굴 인식됨 / 입모양 인식 중
    onFrame,
  };
}
