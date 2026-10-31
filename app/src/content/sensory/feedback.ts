import { createAudioPlayer, type AudioPlayer, type AudioSource } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export type SoundId = 'fire' | 'roar' | 'wind' | 'loosen' | 'untie' | 'magic' | 'crack' | 'break' | 'flap' | 'water' | 'waterMore' | 'splash' | 'rub';
// Add actual, licensed resources here using static require(). No placeholder paths.
export const sounds: Record<SoundId, AudioSource | null> = {
  fire: null, roar: null, wind: null, loosen: null, untie: null, magic: null,
  crack: null, break: null, flap: null, water: null, waterMore: null, splash: null, rub: null,
};
export const hapticConfig = {
  soft: Haptics.ImpactFeedbackStyle.Soft,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  strong: Haptics.ImpactFeedbackStyle.Heavy,
  rough: Haptics.ImpactFeedbackStyle.Light,
  minInterval: 85, sunInterval: 300, sunMaxDuration: 4500,
  rubDistance: 12, rubMinInterval: 100, rubMaxInterval: 220,
};
export type HapticKind = 'soft' | 'medium' | 'strong' | 'rough';
let lastHaptic = 0;
export function pulse(kind: HapticKind) {
  if (Platform.OS === 'web' || Date.now() - lastHaptic < hapticConfig.minInterval) return;
  lastHaptic = Date.now();
  try { void Haptics.impactAsync(hapticConfig[kind]).catch(() => {}); } catch {}
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
