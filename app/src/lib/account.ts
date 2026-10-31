// 부모 계정 로그인 (앱 쪽). 담당: 태희 — 서버 /auth/* 는 민주 구현 (계약: docs/api.md "로그인")
// 로그인 정보(아이디·토큰)는 프로필과 분리해 이 기기에만 저장 (프로필은 서버로 동기화되므로 토큰을 섞지 않음)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { setProfileFromServer, type Profile } from '@/lib/store';

export type Account = { loginId: string; token?: string; pending?: boolean }; // pending: 서버 가입 전 (기기에만 있음)

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
  if (m.startsWith('400')) return m.replace(/^400 [^:]*: /, '').replace(/^\{"detail":"(.*)"\}$/, '$1');
  if (m.startsWith('404') || m.startsWith('405')) return '로그인 서버가 아직 준비 중이에요. 잠시 후 다시 해주세요.';
  return '서버에 연결할 수 없어요. 잠시 후 다시 해주세요.';
}

/** 가입 마지막(1-7)·설정: 이 가족으로 계정 만들기. 서버가 아직 없으면 기기에만 저장(pending) 후 나중에 다시 등록 */
export async function signup(loginId: string, password: string, childId: string) {
  const id = loginId.trim().toLowerCase();
  try {
    const r = await api.signup({ login_id: id, password, child_id: childId });
    await save({ loginId: r.login_id, token: r.token });
    return { ok: true as const };
  } catch (e) {
    const msg = authMessage(e);
    // 로그인 서버 준비 전이면 아이디만 기억해 두고 가입은 계속 진행
    if (msg.includes('준비 중') || msg.includes('연결할 수 없어요')) {
      await save({ loginId: id, pending: true });
      return { ok: true as const, pending: true, message: msg };
    }
    return { ok: false as const, message: msg };
  }
}

/** 다른 기기·재설치: 로그인 → 같은 가족 프로필을 이 기기로 */
export async function login(loginId: string, password: string) {
  const r = await api.login({ login_id: loginId.trim().toLowerCase(), password });
  await setProfileFromServer({ ...(r.profile as Partial<Profile>), childId: r.child_id, onboarded: true });
  await save({ loginId: r.login_id, token: r.token });
}

export async function changePassword(loginId: string, password: string, newPassword: string) {
  const r = await api.changePassword({ login_id: loginId, password, new_password: newPassword });
  await save({ loginId, token: r.token });
}

export async function logoutAccount() {
  await save(null);
}
