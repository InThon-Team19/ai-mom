// 부모 모드 복귀 PIN (기획서 v2 2-5). 담당: 태희
// 원문은 저장하지 않고 child_id 를 섞은 SHA-256 해시만 프로필에 둠 → 아이 태블릿도 같은 해시로 확인
// (상용화 시 서버의 bcrypt 해시로 옮김 — 기획 2-6 보안 기준)
import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';

export const pinHash = (childId: string, pin: string) => digestStringAsync(CryptoDigestAlgorithm.SHA256, `ai-mom:${childId}:${pin}`);

export async function checkPin(childId: string, pin: string, hash?: string) {
  if (!hash) return true; // PIN 기능 전에 가입한 가족: 확인 없이 통과
  return (await pinHash(childId, pin)) === hash;
}

export const validPin = (pin: string) => /^\d{4}$/.test(pin);
