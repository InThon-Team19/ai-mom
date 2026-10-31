// 이 기기 식별 + 서버 등록 (설정 탭 "등록된 기기"). 담당: 태희
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

import { api } from '@/lib/api';

const KEY = 'aibom.deviceId';
let cached: string | null = null;

export async function getDeviceId() {
  if (cached) return cached;
  try {
    cached = await AsyncStorage.getItem(KEY);
  } catch {}
  if (!cached) {
    cached = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      await AsyncStorage.setItem(KEY, cached);
    } catch {}
  }
  return cached;
}

export const deviceName = () => Device.deviceName || [Device.brand, Device.modelName].filter(Boolean).join(' ') || '이 기기';

/** 이 기기를 아이 프로필에 등록 (부모 폰 / 아이 태블릿). 실패해도 앱은 계속 */
export async function registerThisDevice(childId: string, role: 'parent' | 'child') {
  try {
    await api.registerDevice(childId, { device_id: await getDeviceId(), role, name: deviceName() });
  } catch {}
}
