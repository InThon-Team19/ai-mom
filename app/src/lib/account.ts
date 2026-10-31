// 부모 계정 로그인 (앱 쪽). 담당: 태희 — 서버 /auth/* 는 민주 구현 (계약: docs/api.md "로그인")
// 로그인 정보(아이디·토큰)는 프로필과 분리해 이 기기에만 저장 (프로필은 서버로 동기화되므로 토큰을 섞지 않음)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { api, req } from '@/lib/api';
import { setToken } from '@/lib/session';
import { loadProfile, setProfileFromServer, type Profile } from '@/lib/store';

export type Account = { loginId: string; token?: string; childId?: string; pending?: boolean }; // childId: 이 계정의 아이 (서버 기준) // pending: 서버 가입 전 (기기에만 있음)

const KEY = 'aibom.account';
let current: Account | null | undefined;
const listeners = new Set<(a: Account | null) => void>();

export async function loadAccount(): Promise<Account | null> {
  if (current !== undefined) return current;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    current = raw ? (JSON.parse(raw) as Account) : null;
  } catch {
    current = null;
  }
  return current;
}

async function save(a: Account | null) {
  current = a;
  await setToken(a?.token ?? null); // 모든 API 요청에 붙는 토큰
  listeners.forEach((l) => l(a));
  try {
    if (a) await AsyncStorage.setItem(KEY, JSON.stringify(a));
    else await AsyncStorage.removeItem(KEY);
  } catch {}
}

export function useAccount() {
  const [a, setA] = useState<Account | null>(current ?? null);
  useEffect(() => {
    listeners.add(setA);
    loadAccount().then(setA);
    return () => {
      listeners.delete(setA);
    };
  }, []);
  return a;
}

/** 서버 오류를 부모가 읽을 문장으로 */
export function authMessage(e: unknown) {
  const m = String((e as Error)?.message ?? e);
  if (m.startsWith('401')) return '아이디 또는 비밀번호가 맞지 않아요.';
  if (m.startsWith('409')) return '이미 쓰는 아이디예요. 다른 아이디를 써 주세요.';
  if (m.startsWith('422')) return '아이디는 공백 없이 3~60자, 비밀번호는 8자 이상으로 입력해 주세요.';
  if (m.startsWith('400')) return m.replace(/^400 [^:]*: /, '').replace(/^\{"detail":"(.*)"\}$/, '$1');
  if (m.startsWith('404') || m.startsWith('405')) return '로그인 서버가 아직 준비 중이에요. 잠시 후 다시 해주세요.';
  return '서버에 연결할 수 없어요. 잠시 후 다시 해주세요.';
}

/** 가입 마지막(1-7)·설정: 서버에 계정과 가족 프로필을 저장한 뒤 로그인 처리 */
export async function signup(loginId: string, password: string, childId: string) {
  const id = loginId.trim().toLowerCase();
  try {
    const r = await api.signup({ login_id: id, password, child_id: childId, profile: { ...(await loadProfile()), onboarded: false } }); // 가입 완료는 1-7 에서 (서버가 PIN·동의를 확인)
    await save({ loginId: r.login_id, token: r.token, childId: r.child_id ?? childId });
    return { ok: true as const, pending: false };
  } catch (e) {
    const msg = authMessage(e);
    return { ok: false as const, message: msg };
  }
}

/** 다른 기기·재설치: 로그인 → 같은 가족 프로필을 이 기기로 */
export async function login(loginId: string, password: string) {
  const r = await api.login({ login_id: loginId.trim().toLowerCase(), password });
  await setProfileFromServer({ ...(r.profile as Partial<Profile>), childId: r.child_id, onboarded: true });
  await save({ loginId: r.login_id, token: r.token, childId: r.child_id });
}

export async function changePassword(loginId: string, password: string, newPassword: string) {
  const r = await api.changePassword({ login_id: loginId, password, new_password: newPassword });
  await save({ ...(await loadAccount()), loginId, token: r.token });
}

export async function logoutAccount() {
  const a = await loadAccount();
  if (a?.token) await req('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${a.token}` } }).catch(() => {}); // 이미 끊긴 토큰이어도 로컬은 로그아웃
  await save(null);
}

export async function syncAccountProfile(profile: Profile) {
  const a = await loadAccount();
  if (!a?.token) return;
  // 빈 프로필(초기화된 폰)은 올리지 않음: 서버에 저장된 아이 정보를 빈칸으로 덮어쓰지 않게
  if (!profile.onboarded && !profile.child?.name) return;
  const view = await req<Partial<Profile>>('/auth/profile', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.token}` },
    body: JSON.stringify(profile),
  });
  if (!view?.childId) return;
  // 이 폰의 프로필이 계정의 아이와 다르면(다른 가족 태블릿으로 연결했던 폰 등) 계정 쪽 아이 번호로 맞춤.
  // 안 맞추면 목소리·입모양 업로드가 다른 아이 번호로 가서 404 로 거절됨
  if (view.childId !== profile.childId) await setProfileFromServer({ ...view, onboarded: profile.onboarded });
  if (a.childId !== view.childId) await save({ ...a, childId: view.childId });
}

/** 이 폰의 프로필이 비었거나 가입 중으로 남아 있으면 로그인 계정의 서버 프로필로 되살림 (아이 소개를 다시 하지 않게).
 *  같은 폰을 아이 모드로 쓰다 연결이 끊기면 프로필이 초기화되기 때문. 실패하면 null */
export async function restoreFromAccount(): Promise<Profile | null> {
  const a = await loadAccount();
  if (!a?.token) return null;
  const auth = { Authorization: `Bearer ${a.token}` };
  try {
    // childId 를 모르는 예전 계정은 빈 변경(PUT {})으로 서버 프로필만 받아옴 (아무것도 바꾸지 않음)
    const view = a.childId
      ? await req<Partial<Profile>>(`/profile/${a.childId}`, { headers: auth })
      : await req<Partial<Profile>>('/auth/profile', { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{}' });
    if (!view?.childId) return null;
    const p = await setProfileFromServer(view);
    if (a.childId !== view.childId) await save({ ...a, childId: view.childId });
    return p;
  } catch {
    return null;
  }
}

/** 가입을 멈춘 곳부터 이어서: 아이 소개를 했으면 그 다음 단계로 */
export function resumeStep(p: Profile): string {
  if (p.onboarded) return '/parent';
  if (!p.child?.name || !p.child?.birth) return '/onboarding/child';
  return '/onboarding/parent';
}

/** 부모 모드로 들어갈 때 갈 곳: 로그인돼 있으면 (필요하면 서버에서 되살린 뒤) 부모 앱 또는 가입 이어서 */
export async function parentEntry(): Promise<string> {
  const a = await loadAccount();
  let p = await loadProfile();
  if (!a?.token) return p.onboarded ? '/onboarding/login' : '/onboarding/start';
  if (!p.onboarded) p = (await restoreFromAccount()) ?? p;
  return resumeStep(p);
}
