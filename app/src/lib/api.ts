// 담당: 민주 — 서버 API 호출은 전부 여기에 모으기 (화면에서 fetch 직접 쓰지 않기)
// ↓ 입력 파이프라인·아이 반응·프로필(임시) 부분: 태희
import { File } from 'expo-file-system';

import { getApiUrl } from './config';
import type {
  ActivityEvent,
  AnalysisOut,
  Gauge,
  MouthProfile,
  MouthTrackOut,
  ParentSampleOut,
  SttOut,
  Summary,
  TrackPoint,
} from './types';

export async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${path}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** 앱 오류를 서버 터미널로 보냄 (폰 로그를 못 볼 때 원인 확인용) */
export function reportError(where: string, e: unknown) {
  const msg = `${where}: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`;
  console.warn(msg);
  fetch(`${getApiUrl()}/debug/log`, { method: 'POST', body: msg }).catch(() => {});
}

/** 로컬 녹음 파일(uri) → base64 JSON 업로드.
 * Expo 58 기본 fetch(expo/fetch)로는 multipart 파일 첨부가 폰에서 실패해서, 이미 잘 되는 JSON 경로로 보냄 */
async function uploadB64<T>(path: string, uri: string, fields: Record<string, string>) {
  try {
    const audio_b64 = await new File(uri).base64();
    const ext = (uri.split('?')[0].split('.').pop() || 'm4a').toLowerCase();
    return await req<T>(path, json('POST', { ...fields, audio_b64, ext }));
  } catch (e) {
    reportError(`upload ${path} (${uri})`, e);
    throw e;
  }
}

function form<T>(path: string, fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return req<T>(path, { method: 'POST', body: f });
}

export const api = {
  health: () => req<{ ok: boolean }>('/health'),

  // 부모 음성 (가입 1-5, 밤 2-4)
  parentVoiceSample: (childId: string, uri: string, text: string, kind: 'signup' | 'plan' = 'signup') =>
    uploadB64<ParentSampleOut>('/voice/parent-sample-b64', uri, { child_id: childId, text, kind }),
  voiceGauge: (childId: string) => req<Gauge>(`/voice/gauge/${childId}`),
  voiceAnalysis: (childId: string) => req<AnalysisOut>(`/voice/analysis/${childId}`),
  coaching: (childId: string) => req<{ messages: string[] }>(`/voice/coaching/${childId}`),

  // 부모 입모양 (가입 1-6, 밤 2-4) — 기기 안에서 잰 수치만 전송
  mouthTrack: (childId: string, track: TrackPoint[], text: string, kind: 'signup' | 'plan' = 'signup') =>
    req<MouthTrackOut>('/vision/parent-mouth-track', json('POST', { child_id: childId, kind, text, track })),
  mouthGauge: (childId: string) => req<Gauge>(`/vision/gauge/${childId}`),
  mouthProfile: (childId: string) => req<MouthProfile>(`/vision/mouth-profile/${childId}`),

  // STT (아이 따라 말하기). expected 는 '사과|apple' 처럼 여러 답 가능
  stt: (uri: string, expected = '', who: 'child' | 'parent' = 'child') =>
    uploadB64<SttOut>('/voice/stt-b64', uri, { expected, who }),

  // TTS (민주) — 부모 목소리
  registerVoice: (childId: string) =>
    form<{ model_id: string; state: string; sample_count: number }>('/voice/register', { child_id: childId }),
  tts: (childId: string, text: string) => req<{ url: string }>('/voice/tts', json('POST', { child_id: childId, text })),

  // 아이 반응 기록 · 하루 요약 (리포트 원자료)
  logActivity: (childId: string, events: ActivityEvent[]) =>
    req<{ ok: boolean }>(`/activity/${childId}`, json('POST', { events })),
  summary: (childId: string, day?: string) => req<Summary>(`/activity/${childId}/summary${day ? `?day=${day}` : ''}`),

  // (임시) 프로필·태블릿 연결 — 민주 children API 생기면 교체
  getProfile: (childId: string) => req<Record<string, unknown>>(`/profile/${childId}`),
  putProfile: (childId: string, body: unknown) => req<Record<string, unknown>>(`/profile/${childId}`, json('PUT', body)),
};
