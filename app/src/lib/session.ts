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

/** 이 기기에 로그인한 부모 계정 토큰 (account.ts 가 'aibom.account' 에 저장).
 *  같은 폰을 아이 태블릿으로 연결했다가 부모로 돌아오면, 끊긴 기기 토큰 대신 이 토큰으로 복구한다 */
export async function getParentToken(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem('aibom.account');
    const a = raw ? (JSON.parse(raw) as { token?: string }) : null;
    return a?.token ?? null;
  } catch {
    return null;
  }
}

/** 부모 모드로 들어갈 때: 요청 토큰을 부모 계정 토큰으로 되돌림 */
export async function restoreParentToken(): Promise<boolean> {
  const p = await getParentToken();
  if (p) await setToken(p);
  return !!p;
}
