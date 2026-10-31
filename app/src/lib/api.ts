// 담당: 민주 — 서버 API 호출은 전부 여기에 모으기 (화면에서 fetch 직접 쓰지 않기)
import { API_URL } from './config';
import type { ChildFrameOut, ParentMouthOut, ParentSampleOut, SttOut } from './types';

export async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${path}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** 로컬 파일(uri) + 폼 필드 → multipart 업로드 (RN fetch 방식) */
function upload<T>(path: string, uri: string, type: string, fields: Record<string, string> = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const name = uri.split('/').pop() || 'file';
  form.append('file', { uri, name, type } as unknown as Blob);
  return req<T>(path, { method: 'POST', body: form });
}

export const api = {
  health: () => req<{ ok: boolean }>('/health'),

  // ↓ 입력 파이프라인 (태희)
  /** 부모 목소리 녹음 1개 → 학습률 */
  parentVoiceSample: (childId: string, uri: string) =>
    upload<ParentSampleOut>('/voice/parent-sample', uri, 'audio/m4a', { child_id: childId }),
  /** 음성 → 텍스트. expected: 따라 말하기 목표 문장 */
  stt: (uri: string, expected = '', who: 'child' | 'parent' = 'child') =>
    upload<SttOut>('/voice/stt', uri, 'audio/m4a', { expected, who }),
  /** 부모 입모양 영상 → 립싱크 입 사진. kind: signup(가입) | plan(밤 낭독) */
  parentMouth: (childId: string, uri: string, kind: 'signup' | 'plan' = 'signup') =>
    upload<ParentMouthOut>('/vision/parent-mouth', uri, 'video/mp4', { child_id: childId, kind }),
  /** 아이 카메라 프레임 → 얼굴·응시·입 벌림 */
  childFrame: (uri: string) => upload<ChildFrameOut>('/vision/child-frame', uri, 'image/jpeg'),
};
