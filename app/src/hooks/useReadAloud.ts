// 부모 낭독 공통 흐름 (가입 1-5 목소리, 1-6 입모양, 밤 2-4 계획 낭독). 담당: 태희
// 문장 하나 녹음 + (camera 면) 그동안 0.05초마다 입모양 수치 수집 → 서버 → 품질·학습률 갱신 → 다음 문장
import { useCallback, useEffect, useRef, useState } from 'react';

import type { FaceFrame } from '@/components/FaceTracker';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { api, friendlyError, reportError, trace } from '@/lib/api';
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
  const pending = useRef(false); // 녹음 시작·멈춤 처리 중 (빠르게 두 번 눌러 stop 이 두 번 불리지 않게)

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
    if (!childId || busy || pending.current) return;
    pending.current = true;
    try {
      if (!rec.isRecording) {
        setMessage('');
        track.current = [];
        t0.current = Date.now();
        await rec.start();
        return;
      }
      trace('readAloud 녹음 멈춤 요청');
      const uri = await rec.stop();
      trace(`readAloud 녹음 파일 ${uri}`);
      if (!uri) {
        reportError('readAloud', '녹음 파일 uri 없음');
        setMessage('녹음이 저장되지 않았어요. 다시 눌러 주세요.');
        return;
      }
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
        if (vr.status === 'rejected') reportError('readAloud upload', vr.reason); // 원문은 로그에만
        setMessage(friendlyError(vr.status === 'rejected' ? vr.reason : null, '목소리를 보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 읽어 주세요.'));
        setDone((d) => ({ ...d, [index]: 'retry' }));
        return;
      }
      const ok = v.quality.ok && (!m || m.ok);
      setMessage(!v.quality.ok ? v.quality.message : m && !m.ok ? m.message : '좋아요!');
      setDone((d) => ({ ...d, [index]: ok ? 'done' : 'retry' }));
      if (ok) setIndex((i) => Math.min(i + 1, sentences.length - 1));
    } catch (e) {
      reportError('readAloud', e);
      setMessage(friendlyError(e, '녹음을 보내지 못했어요. 다시 눌러 읽어 주세요.'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, [childId, busy, rec, sentences, index, kind, camera]);

  /** 녹음 중 화면을 떠날 때(다른 탭으로): 보내지 않고 녹음만 멈춤 (마이크가 계속 켜져 있지 않게) */
  const cancel = useCallback(async () => {
    if (!rec.isRecording || pending.current) return;
    pending.current = true;
    try {
      await rec.stop();
      track.current = [];
      setMessage('화면을 떠나서 녹음을 멈췄어요. 다시 눌러 읽어 주세요.');
    } catch (e) {
      reportError('readAloud cancel', e);
    } finally {
      pending.current = false;
    }
  }, [rec]);

  const statuses: SentenceStatus[] = sentences.map((_, i) => (i === index ? 'now' : done[i] === 'done' ? 'done' : done[i] === 'retry' ? 'retry' : 'todo'));
  const allDone = sentences.every((_, i) => done[i] === 'done');

  return {
    index,
    setIndex,
    statuses,
    allDone,
    recording: rec.isRecording,
    seconds: Math.floor(rec.seconds), // 화면 표시용 정수 초 (그대로면 3.217초처럼 보임)
    busy,
    toggle,
    cancel,
    voice,
    mouth,
    gain,
    message,
    face, // 촬영 중 표시: 얼굴 인식됨 / 입모양 인식 중
    onFrame,
  };
}
