// 가입 정보·설정·진행 상태. 기기에 저장 + 서버(/profile, 임시)에 동기화 → 아이 태블릿이 연결 코드로 불러옴. 담당: 태희
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { DEFAULT_AVATAR, type AvatarConfig } from '@/components/Avatar';
import { api } from '@/lib/api';
import type { DeviceInfo } from '@/lib/types';

export type Profile = {
  childId: string; // = 태블릿 연결 코드
  child: { name: string; nickname: string; birth: string; level: '한 단어' | '두 단어' | '짧은 문장'; likes: string[] };
  parent: { title: string; tone: '다정한' | '장난스러운' | '차분한'; goals: string[] };
  avatar: AvatarConfig;
  settings: { consentBio: boolean; consentChild: boolean; start: string; end: string; dailyLimitMin: number; vibration: boolean };
  day: number; // 진행 일차 (낭독 완료 시 +1)
  feedback: { day: number; issues: string[]; note: string; review: string[]; newWords: string }[];
  onboarded: boolean;
  linkCode?: string; // 태블릿 연결 코드 (재발급 가능, 서버가 관리)
  devices?: DeviceInfo[]; // 등록된 기기 (서버가 관리)
};

const KEY = 'aibom.profile';
const ROLE_KEY = 'aibom.role';

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export const newProfile = (): Profile => ({
  childId: makeCode(),
  child: { name: '', nickname: '', birth: '', level: '한 단어', likes: [] },
  parent: { title: '엄마', tone: '다정한', goals: [] },
  avatar: DEFAULT_AVATAR,
  settings: { consentBio: false, consentChild: false, start: '09:00', end: '18:00', dailyLimitMin: 30, vibration: true },
  day: 1,
  feedback: [],
  onboarded: false,
});

let current: Profile | null = null;
const listeners = new Set<(p: Profile) => void>();

export async function loadProfile(): Promise<Profile> {
  if (current) return current;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    current = raw ? { ...newProfile(), ...JSON.parse(raw) } : newProfile();
  } catch {
    current = newProfile();
  }
  return current!;
}

/** 일부 수정 → 기기 저장 + 서버 동기화(실패해도 계속) */
export async function updateProfile(patch: Partial<Profile>) {
  const p = { ...(await loadProfile()), ...patch };
  current = p;
  listeners.forEach((l) => l(p));
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
  } catch {}
  api.putProfile(p.childId, p).catch(() => {});
  return p;
}

/** 아이 태블릿: 연결 코드로 서버에서 프로필 받아오기 */
export async function linkTablet(code: string) {
  const p = (await api.link(code.trim().toUpperCase())) as Profile;
  current = { ...newProfile(), ...p };
  listeners.forEach((l) => l(current!));
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(current));
  } catch {}
  return current;
}

/** 로그인: 서버에서 받은 가족 프로필을 이 기기에 저장 */
export async function setProfileFromServer(p: Partial<Profile>) {
  current = { ...newProfile(), ...p } as Profile;
  listeners.forEach((l) => l(current!));
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(current));
  } catch {}
  return current;
}

/** 서버의 최신 프로필로 갱신 (태블릿이 다음날 일차 받기 등) */
export async function refreshProfile() {
  const p = await loadProfile();
  try {
    const remote = (await api.getProfile(p.childId)) as Profile;
    current = { ...p, ...remote };
    listeners.forEach((l) => l(current!));
    await AsyncStorage.setItem(KEY, JSON.stringify(current));
  } catch {}
  return current!;
}

export function useProfile() {
  const [p, setP] = useState<Profile | null>(current);
  useEffect(() => {
    listeners.add(setP);
    loadProfile().then(setP);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  return p;
}

export type Role = 'parent' | 'child';
export const getRole = async () => {
  try {
    return (await AsyncStorage.getItem(ROLE_KEY)) as Role | null;
  } catch {
    return null;
  }
};
export const setRole = async (r: Role) => {
  try {
    await AsyncStorage.setItem(ROLE_KEY, r);
  } catch {}
};

/** 이 기기의 프로필·모드 지우기 (설정 탭 "처음부터 다시" / 아이 태블릿 연결 해제) */
export async function resetLocal() {
  current = newProfile();
  listeners.forEach((l) => l(current!));
  try {
    await AsyncStorage.multiRemove([KEY, ROLE_KEY]);
  } catch {}
}

/** 아이 태블릿을 부모 폰 모드로 바꿀 때: 프로필은 그대로 두고 모드만 지움 */
export async function clearRole() {
  try {
    await AsyncStorage.removeItem(ROLE_KEY);
  } catch {}
}
