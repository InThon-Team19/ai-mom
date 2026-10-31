// 담당: 민주 — 서버 API 호출은 전부 여기에 모으기 (화면에서 fetch 직접 쓰지 않기)
// ↓ 입력 파이프라인·아이 반응·프로필(임시) 부분: 태희
import { File } from 'expo-file-system';
import { readAsStringAsync } from 'expo-file-system/legacy';

import { getApiUrl } from './config';
import { getOverride, getParentToken, getToken, isParentDevice, notifyAuthLost, setOverride, setToken } from './session';
import type {
  ActivityEvent,
  AnalysisOut,
  ChildClip,
  ChildClipOut,
  BackendChild,
  BackendContext,
  BackendDevice,
  BackendFeedback,
  BackendHome,
  BackendOnboarding,
  BackendPersona,
  BackendPlan,
  BackendReply,
  BackendReport,
  BackendSample,
  BackendSession,
  BackendToken,
  DeviceInfo,
  History,
  Gauge,
  MouthProfile,
  MouthTrackOut,
  ParentSampleOut,
  SttOut,
  Summary,
  TrackPoint,
} from './types';

export async function req<T>(path: string, init?: RequestInit): Promise<T> {
  // 저장된 토큰을 자동으로 붙임 (이미 Authorization 을 넣은 호출은 그대로)
  // 아이 모드에서 부모 토큰으로 성공한 적이 있으면 처음부터 그 토큰 (매번 401 을 거치지 않게)
  const t = getOverride() ?? (await getToken());
  const headers = new Headers(init?.headers);
  if (t && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${t}`);
  let res = await fetch(`${getApiUrl()}${path}`, { ...init, headers });
  if ((res.status === 401 || res.status === 403) && !new Headers(init?.headers).has('Authorization')) {
    // 같은 폰을 아이 태블릿으로 연결했다가 끊긴(401)·부모 권한 없는(403) 기기 토큰이 남은 경우 → 부모 계정 토큰으로 한 번 더
    // 서버는 부모 토큰으로 그 계정의 아이만 허용하므로 다른 가족 데이터엔 닿지 않음.
    // 부모 모드면 토큰 자리를 부모 토큰으로 바꾸고, 아이 모드(같은 폰을 태블릿으로 쓸 때)면 이번 요청만 다시 시도 (기기 토큰 자리는 그대로)
    const parentMode = await isParentDevice();
    // 아이 모드는 401(기기 토큰 끊김)에만 부모 토큰으로 복구. 403(부모 전용 API)은 권한을 올리지 않음
    const p = parentMode || res.status === 401 ? await getParentToken() : null;
    if (p && p !== t) {
      if (parentMode) await setToken(p);
      headers.set('Authorization', `Bearer ${p}`);
      res = await fetch(`${getApiUrl()}${path}`, { ...init, headers });
      if (!parentMode && res.ok) setOverride(p);
    }
  }
  if (res.status === 401 && getOverride()) setOverride(null); // 임시 토큰도 끊김
  if (res.status === 401 && !(await isParentDevice())) notifyAuthLost(); // 아이 모드: 다시 연결해야 함
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

/** 서버·기기 오류 → 부모가 읽을 쉬운 문장. 오류 원문(상태 코드·영어 메시지)은 화면에 보이지 않고 reportError 로그에만 남김.
 *  req() 가 던지는 '401 /경로: {"detail":"..."}' 모양은 그대로 두므로 상태 코드로 판단하는 기존 코드는 영향 없음 */
export function friendlyError(e: unknown, fallback = '잠시 문제가 생겼어요. 잠시 후 다시 해 주세요.'): string {
  const raw = String((e as Error)?.message ?? e ?? '');
  const status = Number(/^(\d{3}) /.exec(raw)?.[1] ?? 0);
  // 서버가 보낸 안내 문장이 이미 쉬운 한국어면 그대로 (영어 낱말·기술 용어가 섞이면 쓰지 않음)
  const detail = /"detail"\s*:\s*"([^"]+)"/.exec(raw)?.[1]?.trim();
  if (detail && /[가-힣]/.test(detail) && /요[.!]?$/.test(detail) && !/[A-Za-z_]{3,}/.test(detail)) return detail;
  if (status === 401) return '로그인이 끊겼어요. 다시 로그인해 주세요.';
  if (status === 403) return '이 기기에서는 할 수 없는 일이에요. 부모 폰에서 해 주세요.';
  if (status === 404) return '찾는 정보가 없어요. 앱을 다시 열고 한 번 더 해 주세요.';
  if (status === 409) return '이미 처리된 요청이에요. 화면을 새로 고친 뒤 다시 해 주세요.';
  if (status === 413) return '파일이 너무 커요. 조금 짧게 다시 해 주세요.';
  if (status === 422) return '입력한 내용을 다시 확인해 주세요.';
  if (status === 429) return '요청이 너무 많았어요. 1분쯤 뒤에 다시 해 주세요.';
  if (status >= 500) return '서버에 잠시 문제가 생겼어요. 잠시 후 다시 해 주세요.';
  if (/시간 초과|timeout/i.test(raw)) return '응답이 늦어요. 인터넷 연결을 확인하고 다시 해 주세요.';
  if (/network|fetch|connect/i.test(raw)) return '서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.';
  // 앱이 직접 만든 한국어 안내(예: 마이크 권한)는 그대로
  const plain = raw.replace(/^Error:\s*/, '');
  if (!status && /[가-힣]/.test(plain) && !/[A-Za-z_]{3,}/.test(plain)) return plain;
  return fallback;
}

/** 앱 진행 기록을 서버 터미널로 (원인 추적용, 실패해도 무시) */
export function trace(msg: string) {
  fetch(`${getApiUrl()}/debug/log`, { method: 'POST', body: `trace ${msg}` }).catch(() => {});
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} 시간 초과(${ms}ms)`)), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

/** 녹음 파일 → base64. 오래 검증된 legacy API 먼저, 실패하면 새 File API */
async function readBase64(uri: string) {
  try {
    return await withTimeout(readAsStringAsync(uri, { encoding: 'base64' }), 8000, 'legacy 읽기');
  } catch (e) {
    reportError('readBase64 legacy', e);
    return await withTimeout(new File(uri).base64(), 8000, 'File 읽기');
  }
}

/** 로컬 녹음 파일(uri) → base64 JSON 업로드.
 * Expo 58 기본 fetch(expo/fetch)로는 multipart 파일 첨부가 폰에서 실패해서, 이미 잘 되는 JSON 경로로 보냄 */
async function uploadB64<T>(path: string, uri: string, fields: Record<string, string>) {
  try {
    trace(`${path} 읽기 시작 ${uri}`);
    const audio_b64 = await readBase64(uri);
    trace(`${path} 읽기 완료 ${audio_b64.length}자`);
    const ext = (uri.split('?')[0].split('.').pop() || 'm4a').toLowerCase();
    return await withTimeout(req<T>(path, json('POST', { ...fields, audio_b64, ext })), 30000, '업로드');
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
  // 아이 태블릿도 쓰는 입 크기 기준 (/mouth-profile/ 은 부모 전용이라 기기 토큰으로 403)
  mouthProfile: (childId: string) => req<MouthProfile>(`/vision/mouth-scale/${childId}`),

  // STT (아이 따라 말하기). expected 는 '사과|apple' 처럼 여러 답 가능
  stt: (uri: string, expected = '', who: 'child' | 'parent' = 'child') =>
    uploadB64<SttOut>('/voice/stt-b64', uri, { expected, who }),

  // 아이 말소리 클립: 소음 감지로 녹음한 토막 → 말소리면 저장·받아쓰기 / 부모가 목록·재생
  childClip: async (childId: string, uri: string, info: { item?: string; phase?: string; expected?: string }) => {
    const audio_b64 = await readBase64(uri);
    const ext = (uri.split('?')[0].split('.').pop() || 'm4a').toLowerCase();
    return req<ChildClipOut>('/voice/child-clip-b64', json('POST', { child_id: childId, audio_b64, ext, ...info }));
  },
  childClips: (childId: string, day?: string) => req<ChildClip[]>(`/voice/child-clips/${childId}${day ? `?day=${day}` : ''}`),
  /** 재생용 주소 + 인증 헤더 (expo-audio 의 { uri, headers }) */
  childClipSource: async (childId: string, clipId: string) => {
    const t = await getToken();
    return { uri: `${getApiUrl()}/voice/child-clip/${childId}/${clipId}`, headers: t ? { Authorization: `Bearer ${t}` } : undefined };
  },

  // TTS (민주) — 부모 목소리
  registerVoice: (childId: string) =>
    form<{ model_id: string; state: string; sample_count: number }>('/voice/register', { child_id: childId }),
  // 서버가 멈춰도 아바타 말이 계속 기다리지 않게 20초 제한 (넘으면 기기 음성으로 대신 말함)
  // env: 0.04초마다 소리 크기(0~1) → 아바타 입을 재생 위치에 맞춤
  tts: (childId: string, text: string) => withTimeout(req<{ url: string; env?: number[] | null; env_ms?: number }>('/voice/tts', json('POST', { child_id: childId, text })), 20000, 'TTS'),

  // 아이 반응 기록 · 하루 요약 (리포트 원자료)
  logActivity: (childId: string, events: ActivityEvent[]) =>
    req<{ ok: boolean }>(`/activity/${childId}`, json('POST', { events })),
  summary: (childId: string, day?: string) => req<Summary>(`/activity/${childId}/summary${day ? `?day=${day}` : ''}`),

  // (임시) 프로필·태블릿 연결 — 민주 children API 생기면 교체
  getProfile: (childId: string) => req<Record<string, unknown>>(`/profile/${childId}`),
  /** 태블릿: 연결 코드로 프로필 받기 (재발급된 이전 코드는 404) */
  link: (code: string) => req<Record<string, unknown>>(`/link/${encodeURIComponent(code)}`),
  reissueLinkCode: (childId: string) => req<{ linkCode: string }>(`/profile/${childId}/link-code`, { method: 'POST' }),
  registerDevice: (childId: string, d: { device_id: string; role: 'parent' | 'child'; name: string }) =>
    req<{ devices: DeviceInfo[] }>(`/profile/${childId}/devices`, json('POST', d)),
  removeDevice: (childId: string, deviceId: string) =>
    req<{ devices: DeviceInfo[] }>(`/profile/${childId}/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' }),
  history: (childId: string) => req<History>(`/profile/${childId}/history`),

  // 로그인 (서버 구현: 민주 — 계약은 docs/api.md "로그인")
  signup: (b: { login_id: string; password: string; child_id: string; profile?: unknown }) =>
    req<{ login_id: string; child_id: string; token: string }>('/auth/signup', json('POST', b)),
  login: (b: { login_id: string; password: string }) =>
    req<{ login_id: string; child_id: string; token: string; profile: Record<string, unknown> }>('/auth/login', json('POST', b)),
  changePassword: (b: { login_id: string; password: string; new_password: string }) =>
    req<{ token: string }>('/auth/password', json('POST', b)),
  putProfile: (childId: string, body: unknown) => req<Record<string, unknown>>(`/profile/${childId}`, json('PUT', body)),
};

/** 새 영속 백엔드. 부모/태블릿은 각각 받은 토큰으로 인스턴스를 만든다.
 * 예: const parent = backendApi(login.access_token). 기존 api는 시연 호환용이다. */
export function backendApi(token?: string) {
  const call = <T>(path: string, method = 'GET', body?: unknown) => req<T>(`/api${path}`, {
    ...(body === undefined ? { method } : json(method, body)),
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const id = encodeURIComponent;
  const query = (values: Record<string, string>) => Object.entries(values).map(([k, v]) => `${id(k)}=${id(v)}`).join('&');
  const recording = async (uri: string) => {
    const ext = (uri.split('?')[0].split('.').pop() || 'm4a').toLowerCase();
    return { audio_b64: await readBase64(uri), ext };
  };
  return {
    signup: (email: string, password: string, display_name: string) =>
      call<BackendToken & { parent: { id: string; email: string; display_name: string } }>('/auth/signup', 'POST', { email, password, display_name }),
    login: (email: string, password: string) => call<BackendToken>('/auth/login', 'POST', { email, password }),
    logout: () => call<{ ok: boolean }>('/auth/logout', 'POST'),
    me: () => call<{ id: string; email: string; display_name: string }>('/me'),
    createChild: (body: Pick<BackendChild, 'nickname' | 'birth_month'> & Partial<Pick<BackendChild, 'speech_level' | 'interests'>>) =>
      call<BackendChild>('/children', 'POST', body),
    children: () => call<BackendChild[]>('/children'),
    createPersona: (body: Partial<Pick<BackendPersona, 'parent_title' | 'speaking_style' | 'english_enabled' | 'education_goals' | 'avatar'>>) =>
      call<BackendPersona>('/personas', 'POST', body),
    personas: () => call<BackendPersona[]>('/personas'),
    confirmPersona: (personaId: string) => call<BackendPersona>(`/personas/${id(personaId)}/confirm`, 'POST'),
    consent: (childId: string, parent_biometrics: boolean, child_signals: boolean) =>
      call(`/children/${id(childId)}/consents`, 'PUT', { parent_biometrics, child_signals, policy_version: 'demo-v1' }),
    settings: (childId: string, body: Pick<BackendChild, 'haptics_enabled' | 'daily_limit_minutes' | 'window_start' | 'window_end'>) =>
      call<BackendChild>(`/children/${id(childId)}/settings`, 'PUT', body),
    onboarding: (childId: string, personaId: string) =>
      call<BackendOnboarding>(`/children/${id(childId)}/onboarding?${query({ persona_id: personaId })}`),
    audioSample: async (childId: string, personaId: string, uri: string, text: string, planId?: string) =>
      call<{ sample: BackendSample; analysis: ParentSampleOut }>(`/children/${id(childId)}/samples/audio-b64`, 'POST', {
        ...await recording(uri), persona_id: personaId, text, purpose: planId ? 'night_reading' : 'onboarding', ...(planId ? { plan_id: planId } : {}),
      }),
    mouthSample: (childId: string, personaId: string, track: TrackPoint[], text: string, planId?: string) =>
      call<{ sample: BackendSample; analysis: MouthTrackOut }>(`/children/${id(childId)}/samples/mouth`, 'POST', {
        persona_id: personaId, text, track, purpose: planId ? 'night_reading' : 'onboarding', ...(planId ? { plan_id: planId } : {}),
      }),
    pairingCode: (childId: string, personaId: string) =>
      call<{ code: string; expires_at: string }>(`/children/${id(childId)}/pairing-codes`, 'POST', { persona_id: personaId }),
    pair: (code: string, label = '아이 태블릿') => call<BackendToken & { device: BackendDevice }>('/tablet/pair', 'POST', { code, label }),
    devices: () => call<BackendDevice[]>('/devices'),
    revokeDevice: (deviceId: string) => call<{ ok: boolean }>(`/devices/${id(deviceId)}`, 'DELETE'),
    context: () => call<BackendContext>('/tablet/context'),
    createPlan: (childId: string, body: Pick<BackendPlan, 'date' | 'persona_id' | 'day_number'> & { feedback_id?: string }) =>
      call<BackendPlan>(`/children/${id(childId)}/plans`, 'POST', body),
    plan: (planId: string) => call<BackendPlan>(`/plans/${id(planId)}`),
    submitReading: (planId: string, audioSampleId: string, mouthSampleId: string) =>
      call<BackendPlan>(`/plans/${id(planId)}/reading`, 'POST', { audio_sample_id: audioSampleId, mouth_sample_id: mouthSampleId }),
    start: (planId: string, mode: BackendSession['mode'] = 'multisensory') =>
      call<{ session: BackendSession; message: BackendReply['message']; source_ids: string[]; haptics_enabled: boolean }>('/tablet/sessions', 'POST', { plan_id: planId, mode }),
    message: (sessionId: string, text: string) => call<BackendReply>(`/tablet/sessions/${id(sessionId)}/messages`, 'POST', { text }),
    voiceTurn: async (sessionId: string, uri: string) =>
      call<{ heard: boolean; reply: BackendReply | null }>(`/tablet/sessions/${id(sessionId)}/turn-b64`, 'POST', await recording(uri)),
    stt: async (sessionId: string, uri: string) => call<SttOut>(`/tablet/sessions/${id(sessionId)}/stt-b64`, 'POST', await recording(uri)),
    tts: (sessionId: string, messageId: string) => call<{ url: string }>(`/tablet/sessions/${id(sessionId)}/messages/${id(messageId)}/tts`, 'POST'),
    mode: (sessionId: string, mode: BackendSession['mode']) =>
      call<{ session: BackendSession; haptics_enabled: boolean }>(`/tablet/sessions/${id(sessionId)}`, 'PATCH', { mode }),
    event: (sessionId: string, body: { content_id: string; sense: 'auditory' | 'visual' | 'tactile'; action: 'repeat' | 'listen' | 'gaze' | 'tap' | 'peel' | 'bite' | 'drag' | 'swipe'; reaction_ms?: number }) =>
      call(`/tablet/sessions/${id(sessionId)}/events`, 'POST', body),
    end: (sessionId: string) => call<BackendSession>(`/tablet/sessions/${id(sessionId)}/end`, 'POST'),
    report: (childId: string, date: string, period: 'day' | 'week' = 'day') =>
      call<BackendReport>(`/children/${id(childId)}/report?${query({ date, period })}`),
    home: (childId: string, date: string, personaId: string) =>
      call<BackendHome>(`/children/${id(childId)}/home?${query({ date, persona_id: personaId })}`),
    eveningReview: (childId: string, date: string) => call(`/children/${id(childId)}/evening-review`, 'POST', { date }),
    feedback: (childId: string, body: Pick<BackendFeedback, 'for_date'> & Partial<Pick<BackendFeedback, 'concerns' | 'new_words'>>) =>
      call<BackendFeedback>(`/children/${id(childId)}/feedback`, 'POST', body),
  };
}
