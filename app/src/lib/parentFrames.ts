import type { Viseme } from './lipsync';

export const PARENT_FRAMES = ['neutral', 'closed', 'open', 'wide', 'round', 'narrow'] as const;
export type ParentFrame = typeof PARENT_FRAMES[number];
const mapping: Record<Viseme, ParentFrame> = {
  rest: 'neutral', closed: 'closed', a: 'open', eo: 'open',
  e: 'wide', i: 'wide', eu: 'wide', o: 'round', u: 'narrow',
};

/** Mutable signal: audio ticks never schedule React renders. */
export function createParentFrameDriver() {
  let current: ParentFrame = 'neutral';
  let changedAt = -Infinity;
  let lastTime = -Infinity;
  const listeners = new Set<(frame: ParentFrame) => void>();
  const show = (frame: ParentFrame) => {
    if (frame === current) return;
    current = frame;
    listeners.forEach((listener) => listener(frame));
  };
  return {
    get current() { return current; },
    subscribe(listener: (frame: ParentFrame) => void) {
      listeners.add(listener);
      listener(current);
      return () => { listeners.delete(listener); };
    },
    reset() { changedAt = lastTime = -Infinity; show('neutral'); },
    preview(frame: ParentFrame) { changedAt = lastTime = -Infinity; show(frame); },
    update(seconds: number, viseme: Viseme, energy?: number, timestamped = false) {
      if (!Number.isFinite(seconds) || seconds < 0) { this.reset(); return; }
      if (seconds < lastTime) changedAt = -Infinity; // seeking backwards
      lastTime = seconds;
      // Hysteresis suppresses envelope noise; do not gate true timed visemes.
      const silent = !timestamped && energy !== undefined && energy < (current === 'neutral' ? 0.035 : 0.018);
      const next = silent ? 'neutral' : mapping[viseme];
      // Only estimated vowels have a minimum dwell. Closures/rest/true cues remain prompt.
      if (!timestamped && next !== 'neutral' && next !== 'closed' && seconds - changedAt < 0.065) return;
      if (next !== current) { changedAt = seconds; show(next); }
    },
  };
}
export type ParentFrameDriver = ReturnType<typeof createParentFrameDriver>;
