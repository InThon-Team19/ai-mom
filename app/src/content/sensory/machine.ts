import type { WordId } from './assets';
import type { HapticKind, SoundId } from './feedback';

export type ToyState = { step: number; taps: number; lastTap: number; activeSince: number };
export const initial = (): ToyState => ({ step: 0, taps: 0, lastTap: 0, activeSince: 0 });
export type Input = 'tap' | 'swipe';
export type Change = { state: ToyState; reset?: number; sound?: SoundId | SoundId[]; haptic?: HapticKind };
// Pure transitions keep rapid inputs independent of React render timing.
export function transition(id: WordId, s: ToyState, input: Input, now: number): Change | null {
  const swipe = ['hat', 'pouch', 'pitcher'].includes(id);
  if (id === 'stone' || (swipe ? input !== 'swipe' : input !== 'tap')) return null;
  let state = { ...s, taps: s.taps + 1, lastTap: now };
  if (id === 'sun') return { state: { ...state, step: 1, activeSince: s.activeSince || now }, reset: 1500, sound: 'fire', haptic: 'strong' };
  if (id === 'moon') return { state: { ...state, step: (s.step + 1) % 4 }, sound: 'moonChange', haptic: 'soft' };
  if (id === 'tiger' || id === 'crow') {
    const final = id === 'tiger' ? 2 : 1;
    if (s.step === final) return null;
    if (s.taps > 0 && now - s.lastTap <= 2000) return { state: { ...state, step: final }, reset: 1500, sound: id === 'tiger' ? 'roar' : 'flap', haptic: 'strong' };
    return { state: { ...state, step: id === 'tiger' ? 1 : 0, taps: 1 }, reset: 2000, sound: id === 'tiger' ? 'wakeup' : 'call', haptic: 'soft' };
  }
  const final = id === 'hat' ? 1 : id === 'stick' ? 2 : 3;
  if (s.step === final) return null;
  state = { ...state, step: s.step + 1 };
  const effects: Partial<Record<WordId, SoundId[]>> = { hat: ['wind'], pouch: ['loosen', 'untie', 'magic'], stick: ['crack', 'break'], pitcher: ['water', 'waterMore', 'splash'] };
  return { state, reset: state.step === final ? 2000 : undefined,
    sound: id === 'hat' ? ['wind', 'whoosh'] : effects[id]![s.step], haptic: id === 'stick' && state.step === 2 ? 'strong' : id === 'pouch' && state.step === 2 ? 'medium' : 'soft' };
}
