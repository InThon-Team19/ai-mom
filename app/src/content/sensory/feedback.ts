import { createAudioPlayer, type AudioPlayer, type AudioSource } from 'expo-audio';
import { Platform } from 'react-native';

import { haptic, type HapticKind as SenseHaptic } from '@/lib/sense';

export type SoundId = 'fire' | 'roar' | 'wind' | 'loosen' | 'untie' | 'magic' | 'crack' | 'break' | 'flap' | 'water' | 'waterMore' | 'splash' | 'rub';
// Add actual, licensed resources here using static require(). No placeholder paths.
export const sounds: Record<SoundId, AudioSource | null> = {
  fire: null, roar: null, wind: null, loosen: null, untie: null, magic: null,
  crack: null, break: null, flap: null, water: null, waterMore: null, splash: null, rub: null,
};
// 진동은 lib/sense haptic() 으로만 (Android 진동·진동 끄기·화면 흔들기 공통). 감각 자극 제한: 해 진동은 0.9초 안에 끝
const KIND: Record<HapticKind, SenseHaptic> = { soft: 'tap', medium: 'tap', strong: 'strong', rough: 'tick' };
export const hapticConfig = {
  minInterval: 85, sunInterval: 300, sunMaxDuration: 900,
  rubDistance: 12, rubMinInterval: 100, rubMaxInterval: 220,
};
export type HapticKind = 'soft' | 'medium' | 'strong' | 'rough';
let lastHaptic = 0;
export function pulse(kind: HapticKind) {
  if (Platform.OS === 'web' || Date.now() - lastHaptic < hapticConfig.minInterval) return;
  lastHaptic = Date.now();
  haptic(KIND[kind]);
}
let player: AudioPlayer | null = null;
let owner: string | null = null;
export function stopSound(id?: string) {
  if (id && owner !== id) return;
  try { player?.pause(); player?.remove(); } catch {}
  player = null; owner = null;
}
export function playSound(id: string, sound: SoundId, loop = false) {
  stopSound();
  if (!sounds[sound]) return;
  try {
    player = createAudioPlayer(sounds[sound]); owner = id;
    player.volume = 0.28; player.loop = loop; player.play();
  } catch { stopSound(); }
}
