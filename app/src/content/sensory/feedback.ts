import { createAudioPlayer, type AudioPlayer, type AudioSource } from 'expo-audio';
import { Platform } from 'react-native';

import { haptic, type HapticKind as SenseHaptic } from '@/lib/sense';

export type SoundId = 'fire' | 'moonChange' | 'wakeup' | 'roar' | 'wind' | 'whoosh' | 'loosen' | 'untie' | 'magic' | 'crack' | 'break' | 'call' | 'flap' | 'water' | 'waterMore' | 'splash' | 'rub';
export const sounds: Record<SoundId, AudioSource> = {
  fire: require('@/assets/sounds/sun_fire.wav'),
  moonChange: require('@/assets/sounds/moon_change.wav'),
  wakeup: require('@/assets/sounds/tiger_wakeup.wav'),
  roar: require('@/assets/sounds/tiger_roar.wav'),
  wind: require('@/assets/sounds/hat_wind.wav'),
  whoosh: require('@/assets/sounds/hat_whoosh.wav'),
  loosen: require('@/assets/sounds/pouch_rustle.wav'),
  untie: require('@/assets/sounds/pouch_untie.wav'),
  magic: require('@/assets/sounds/pouch_magic.wav'),
  crack: require('@/assets/sounds/stick_crack.wav'),
  break: require('@/assets/sounds/stick_break.wav'),
  call: require('@/assets/sounds/crow_call.wav'),
  flap: require('@/assets/sounds/crow_flap.wav'),
  water: require('@/assets/sounds/pitcher_pour.wav'),
  waterMore: require('@/assets/sounds/pitcher_pour.wav'),
  splash: require('@/assets/sounds/pitcher_splash.wav'),
  rub: require('@/assets/sounds/stone_rub.wav'),
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
let players: AudioPlayer[] = [];
let owner: string | null = null;
export function stopSound(id?: string) {
  if (id && owner !== id) return;
  for (const player of players) {
    try { player.pause(); player.remove(); } catch {}
  }
  players = []; owner = null;
}
export function playSound(id: string, sound: SoundId | SoundId[], loop = false) {
  stopSound();
  owner = id;
  try {
    for (const effect of Array.isArray(sound) ? sound : [sound]) {
      const player = createAudioPlayer(sounds[effect]);
      players.push(player);
      player.volume = 0.28; player.loop = loop; player.play();
    }
  } catch { stopSound(); }
}
