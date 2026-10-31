// 서버 주소. 기본값은 app/.env 의 EXPO_PUBLIC_API_URL (빌드 때 고정됨)
// APK 는 주소가 박혀 나가므로 홈 화면에서 바꿀 수 있게 기기에 저장 (태희)
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.0.10:8000').replace(/\/$/, '');
const KEY = 'aibom.apiUrl';
let current = DEFAULT_API_URL;

export const getApiUrl = () => current;

/** 앱 시작 시 한 번: 저장된 주소 불러오기 */
export async function loadApiUrl() {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved) current = saved;
  } catch {}
  return current;
}

/** 빈 값이면 기본 주소로 되돌림 */
export async function saveApiUrl(url: string) {
  current = url.trim().replace(/\/$/, '') || DEFAULT_API_URL;
  try {
    await AsyncStorage.setItem(KEY, current);
  } catch {}
  return current;
}

// 시연용 아이 id. 가입(children API)이 생기면 거기서 받은 id 로 교체
export const CHILD_ID = process.env.EXPO_PUBLIC_CHILD_ID ?? 'demo';
