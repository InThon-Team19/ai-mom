// 기존 SVG 아바타용 입모양. 한국어 자모 규칙은 근사치이며 음소 인식/강제 정렬 모델이 아니다.
export type Viseme = 'rest' | 'closed' | 'a' | 'eo' | 'e' | 'i' | 'o' | 'u' | 'eu';
export type MouthPose = { open: number; width: number; round: number; press: number };
export type LipCue = { start: number; end: number; viseme: Viseme; label: string; charIndex?: number };
export type MouthEnvelope = { v: number[]; ms: number };

export const REST_POSE: MouthPose = { open: 0, width: 1, round: 0, press: 0 };
export const POSES: Record<Viseme, MouthPose> = {
  rest: REST_POSE,
  closed: { open: 0, width: 0.87, round: 0, press: 1 },
  a: { open: 0.86, width: 1.02, round: 0.05, press: 0 },
  eo: { open: 0.62, width: 0.89, round: 0.16, press: 0 },
  e: { open: 0.42, width: 1.13, round: 0, press: 0 },
  i: { open: 0.22, width: 1.22, round: 0, press: 0 },
  o: { open: 0.59, width: 0.65, round: 0.9, press: 0 },
  u: { open: 0.34, width: 0.54, round: 1, press: 0 },
  eu: { open: 0.16, width: 1.1, round: 0, press: 0 },
};
const VOWELS: Viseme[][] = [
  ['a'], ['e'], ['i', 'a'], ['i', 'e'], ['eo'], ['e'], ['i', 'eo'], ['i', 'e'],
  ['o'], ['o', 'a'], ['o', 'e'], ['o', 'e'], ['i', 'o'], ['u'], ['u', 'eo'],
  ['u', 'e'], ['u', 'i'], ['i', 'u'], ['eu'], ['eu', 'i'], ['i'],
];
const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, Number.isFinite(x) ? x : lo));

/** 새 TTS 음성에 타임스탬프가 없을 때 사용하는 대체 시간표. 실제 음성과 정확히 일치하지는 않는다. */
export function createLipTimeline(text: string, duration?: number): LipCue[] {
  const parts: { viseme: Viseme; weight: number; label: string; charIndex: number }[] = [];
  let charIndex = 0;
  for (const char of text) {
    const code = char.charCodeAt(0) - 0xac00;
    const add = (viseme: Viseme, weight: number) => parts.push({ viseme, weight, label: char, charIndex });
    if (code >= 0 && code < 11172) {
      const initial = Math.floor(code / 588);
      const vowel = Math.floor((code % 588) / 28);
      const final = code % 28;
      const closesFirst = [6, 7, 8, 17].includes(initial); // ㅁ, ㅂ, ㅃ, ㅍ
      const closesLast = [16, 17, 18].includes(final); // ㅁ, ㅂ, ㅄ (연음은 별도 모델에서 처리)
      if (closesFirst) add('closed', 0.18);
      const shapes = VOWELS[vowel];
      const weight = 1 - (closesFirst ? 0.18 : 0) - (closesLast ? 0.18 : 0);
      shapes.forEach((shape) => add(shape, weight / shapes.length));
      if (closesLast) add('closed', 0.18);
    } else if (/\s/.test(char)) add('rest', 0.25);
    else if (/[.,!?，。！？…]/.test(char)) add('rest', 1.2);
    else if (/[a-z0-9]/i.test(char)) add(/[ou]/i.test(char) ? 'u' : /[ei]/i.test(char) ? 'i' : 'a', 0.8);
    charIndex += char.length;
  }
  if (!parts.length) return [];
  const total = parts.reduce((sum, p) => sum + p.weight, 0);
  const length = duration && Number.isFinite(duration) && duration > 0 ? duration : total * 0.19;
  let cursor = 0;
  return parts.map((p, index) => {
    const start = cursor;
    cursor += (p.weight / total) * length;
    return { start, end: index === parts.length - 1 ? length : cursor, viseme: p.viseme, label: p.label, charIndex: p.charIndex };
  });
}

export function cueAt(cues: readonly LipCue[], seconds: number): LipCue | undefined {
  if (!Number.isFinite(seconds) || seconds < 0) return;
  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const cue = cues[mid];
    if (seconds < cue.start) hi = mid - 1;
    else if (seconds >= cue.end) lo = mid + 1;
    else return cue;
  }
}

export function blendPose(a: MouthPose, b: MouthPose, amount: number): MouthPose {
  const t = clamp(amount);
  return {
    open: a.open + (b.open - a.open) * t,
    width: a.width + (b.width - a.width) * t,
    round: a.round + (b.round - a.round) * t,
    press: a.press + (b.press - a.press) * t,
  };
}

/** 실제 음성 재생 시각을 사용해 일시정지·탐색·배속 변경 때 누적 오차를 피한다. */
export function sampleLipPose(cues: readonly LipCue[], seconds: number, envelope?: MouthEnvelope | null): MouthPose {
  const cue = cueAt(cues, seconds);
  if (!cue) return REST_POSE;
  const previous = cueAt(cues, Math.max(0, cue.start - 0.0001));
  const t = clamp((seconds - cue.start) / Math.min(0.045, (cue.end - cue.start) * 0.3));
  const pose = blendPose(previous ? POSES[previous.viseme] : REST_POSE, POSES[cue.viseme], t * t * (3 - 2 * t));
  if (!envelope || envelope.ms <= 0) return pose;
  const amplitude = clamp(envelope.v[Math.floor(seconds * 1000 / envelope.ms)] ?? 0);
  if (amplitude <= 0.015) return REST_POSE;
  const activity = clamp((amplitude - 0.015) / 0.06);
  return { ...pose, open: pose.open * activity * clamp(amplitude * 1.8, 0.2, 1) };
}

/** Windows SpeechSynthesizer가 실제 음성과 함께 내보낸 viseme ID를 공통 입모양에 매핑. */
export function sapiViseme(id: number): Viseme {
  return ([
    'rest', 'eo', 'a', 'o', 'e', 'eu', 'i', 'u', 'o', 'a', 'o', 'a',
    'eo', 'eo', 'eo', 'eo', 'eo', 'eo', 'e', 'eo', 'eo', 'closed',
  ] as Viseme[])[id] ?? 'rest';
}

export function seekSeconds(pageX: number, left: number, width: number, duration: number): number | undefined {
  if (![pageX, left, width, duration].every(Number.isFinite) || width <= 0 || duration <= 0) return;
  return clamp((pageX-left)/width) * duration;
}
