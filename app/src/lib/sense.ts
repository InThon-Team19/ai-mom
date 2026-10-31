// 감각 출력(효과음·진동)과 아이 반응 기록. 담당: 태희
// 안전망(기획 2-1-2): 진동은 짧고 약하게만, 효과음은 작은 음량(합성 시 최대 0.35, 재생 0.6), 진동 끄기 설정 존중
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

import { api, trace } from '@/lib/api';
import type { ActivityEvent, ActivityType } from '@/lib/types';

const SOURCES = {
  crunch: require('@/assets/sounds/crunch.wav'),
  peel: require('@/assets/sounds/peel.wav'),
  snap: require('@/assets/sounds/snap.wav'),
  pop: require('@/assets/sounds/pop.wav'),
  drum: require('@/assets/sounds/drum.wav'),
  tong: require('@/assets/sounds/tong.wav'), // 사물이 바닥에 닿음 (2-3)
  ssok: require('@/assets/sounds/ssok.wav'), // 바구니에 쏙 (2-3)
  swish: require('@/assets/sounds/swish.wav'), // 쓸어내기: 쓱 쓸리는 소리 (감각 놀이)
  drum_big: require('@/assets/sounds/drum_big.wav'), // 세게 친 북 (감각 놀이)
};
export type Sfx = keyof typeof SOURCES;

const players: Partial<Record<Sfx, AudioPlayer>> = {};
/** volume 은 0~0.6 (기본 0.6 — 더 크게는 못 냄. 북을 살살 칠 땐 더 작게) */
export function playSfx(name: Sfx, volume = 0.6) {
  try {
    const p = (players[name] ??= createAudioPlayer(SOURCES[name]));
    p.volume = Math.max(0, Math.min(0.6, volume));
    Promise.resolve(p.seekTo(0)).catch(() => {}); // Promise: 실패해도 경고 없이
    p.play();
  } catch {}
}

let vibrationOn = true;
export const setVibration = (on: boolean) => {
  vibrationOn = on;
};

export type HapticKind = 'tap' | 'soft' | 'praise' | 'tick' | 'strong';
const TICK_GAP_MS = 120; // 손가락을 따라오는 진동: 0.12초에 한 번까지만
let lastTick = 0;

/**
 * 진동은 반드시 이 함수로만 (진동 끄기 설정 존중, 모두 짧게).
 * tap: 순간 짧게 / soft: 진행 중 약하게 (최대 3번, 0.6초 안) / praise: 칭찬
 * tick: 손가락을 따라오는 아주 가벼운 톡 (스스로 0.12초 간격 제한) / strong: 북을 세게 쳤을 때 조금 더 (Medium 한 번, 여전히 짧게)
 */
/** Android 진동 길이(ms) — 모두 짧고 약하게. iOS 기본 Vibration 은 0.4초로 길어서 쓰지 않음 */
// 너무 짧으면(0.02초 미만) 대부분 폰 모터가 돌지 않아 안 느껴짐 → 느껴지는 최소 길이로, 그래도 짧고 약하게
const ANDROID_MS: Record<HapticKind, number | number[]> = {
  tick: 18,
  tap: 35,
  strong: 60,
  praise: [0, 40, 90, 40],
  soft: [0, 25, 170, 25, 170, 25],
};

/** 진동 진단: 종류마다 처음 한 번만 서버 기록에 남김 (진동이 안 느껴질 때 불렸는지·설정에 막혔는지 확인용) */
const hapticSeen = new Set<string>();
const hapticTrace = (key: string, msg: string) => {
  if (hapticSeen.has(key)) return;
  hapticSeen.add(key);
  trace(`haptic ${msg}`);
};

/** 화면 흔들기 구독 (components/HapticShake 가 구독). 진동이 안 되는 기기에서도 눈으로 촉각 신호를 받게 */
const shakeListeners = new Set<(kind: HapticKind) => void>();
export function onHapticShake(fn: (kind: HapticKind) => void) {
  shakeListeners.add(fn);
  return () => {
    shakeListeners.delete(fn);
  };
}

export function haptic(kind: HapticKind) {
  if (!vibrationOn) return void hapticTrace('off', `${kind} 막힘: 앱 설정에서 진동이 꺼져 있음`);
  shakeListeners.forEach((fn) => {
    try {
      fn(kind);
    } catch {}
  });
  if (kind === 'tick') {
    const now = Date.now();
    if (now - lastTick < TICK_GAP_MS) return;
    lastTick = now;
  }
  try {
    // Android: 이 Expo Go 에는 expo-haptics 가 없어서(… is not available on android) 기본 진동으로
    if (Platform.OS === 'android') {
      Vibration.vibrate(ANDROID_MS[kind]);
      return void hapticTrace(kind, `${kind} android Vibration ${JSON.stringify(ANDROID_MS[kind])}ms`);
    }
    hapticTrace(kind, `${kind} ios Haptics`);
    const quiet = () => {};
    if (kind === 'tick') Haptics.selectionAsync().catch(quiet);
    else if (kind === 'strong') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(quiet);
    else if (kind === 'tap') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(quiet);
    else if (kind === 'praise') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(quiet);
    else
      [0, 200, 400].forEach((ms) =>
        setTimeout(() => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(quiet); // 타이머 안에서 던지면 바깥 try 가 못 잡음
          } catch {}
        }, ms),
      );
  } catch (e) {
    hapticTrace(`err-${kind}`, `${kind} 실패: ${String(e).slice(0, 120)}`);
  }
}

// ---------- 아이 반응 기록: 모아서 3초마다 서버로 ----------
let childId = '';
let queue: ActivityEvent[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

export function startActivityLog(id: string) {
  childId = id;
  if (!timer) timer = setInterval(flush, 3000);
}

export function stopActivityLog() {
  flush();
  if (timer) clearInterval(timer);
  timer = null;
}

export function logEvent(type: ActivityType, data: Record<string, unknown> = {}) {
  queue.push({ type, t: Date.now() / 1000, data });
}

async function flush() {
  if (!childId || queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    await api.logActivity(childId, batch);
  } catch {
    queue = batch.concat(queue).slice(-500); // 서버가 안 되면 보관 후 재시도
  }
}
