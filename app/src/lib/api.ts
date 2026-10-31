// 담당: 민주 — 서버 API 호출은 전부 여기에 모으기 (화면에서 fetch 직접 쓰지 않기)
import { API_URL } from './config';

export async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${path}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  health: () => req<{ ok: boolean }>('/health'),
};
