// 서버 인증 토큰 보관 — 담당: 태희
// 서버(민주)는 모든 API 에 토큰을 요구함. 쿠키는 http 환경에서 저장되지 않으므로(Secure) 요청 헤더로 보냄
// 부모 폰: 가입·로그인 때 받은 토큰 / 아이 태블릿: 연결 코드로 연결할 때 받은 기기 토큰
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'aibom.token';
let token: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (token !== undefined) return token;
  try {
    token = await AsyncStorage.getItem(KEY);
  } catch {
    token = null;
  }
  return token;
}

export async function setToken(t: string | null) {
  token = t;
  try {
    if (t) await AsyncStorage.setItem(KEY, t);
    else await AsyncStorage.removeItem(KEY);
  } catch {}
}
