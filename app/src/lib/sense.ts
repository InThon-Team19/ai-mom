// 감각 출력(효과음·진동)과 아이 반응 기록. 담당: 태희
// 안전망(기획 2-1-2): 진동은 짧고 약하게만, 효과음은 작은 음량(합성 시 최대 0.35, 재생 0.6), 진동 끄기 설정 존중
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import { api } from '@/lib/api';
import type { ActivityEvent, ActivityType } from '@/lib/types';

const SOURCES = {
  crunch: require('@/assets/sounds/crunch.wav'),
  peel: require('@/assets/sounds/peel.wav'),
  snap: require('@/assets/sounds/snap.wav'),
  pop: require('@/assets/sounds/pop.wav'),
  drum: require('@/assets/sounds/drum.wav'),
};
export type Sfx = keyof typeof SOURCES;

const players: Partial<Record<Sfx, AudioPlayer>> = {};
export function playSfx(name: Sfx) {
  try {
    const p = (players[name] ??= createAudioPlayer(SOURCES[name]));
    p.volume = 0.6;
    p.seekTo(0);
    p.play();
  } catch {}
}

let vibrationOn = true;
export const setVibration = (on: boolean) => {
  vibrationOn = on;
};

/** tap: 순간 짧게 / soft: 진행 중 약하게 (최대 3번, 0.6초 안) / praise: 칭찬 */
export function haptic(kind: 'tap' | 'soft' | 'praise') {
  if (!vibrationOn) return;
  try {
    if (kind === 'tap') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (kind === 'praise') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else [0, 200, 400].forEach((ms) => setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft), ms));
  } catch {}
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
