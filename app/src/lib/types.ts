// 담당: 민주 — 서버 models.py / docs/api.md 와 맞춰서 타입 정의
// ↓ 입력 파이프라인·리포트 원자료 (태희) — server/app/routers/{voice,vision,activity}.py 응답과 동일

export type SpeechFeatures = {
  duration_s: number;
  speech_s: number;
  speech_ratio: number;
  syllables_per_s: number;
  volume: number;
  pause_mean_s: number;
  pitch_hz: number;
  pitch_var: number;
  snr_db: number;
};

export type Quality = { ok: boolean; quiet: boolean; loud: boolean; message: string };

export type Gauge = {
  progress: number; // 0~1
  baseline: number; // 최소 기준 위치
  usable: boolean;
  amount: number; // 누적 초
  sentences: number;
  remaining_sentences: number;
};

export type ParentSampleOut = { features: SpeechFeatures; quality: Quality; gauge: Gauge; gained: number };

export type MouthProfile = {
  frames: number;
  face_ratio: number;
  face_s: number;
  open_p50: number;
  open_p90: number;
  width_p50: number;
};

export type MouthTrackOut = { ok: boolean; profile: MouthProfile; gauge: Gauge; gained: number; message: string };

export type TrackPoint = { t: number; open: number; width: number; face: boolean };

export type AnalysisOut = { summary: Record<string, number>; traits: string[]; tips: string[] };

export type SttOut = { text: string; features: SpeechFeatures; matched: boolean | null; alert: boolean };

export type ActivityType = 'touch' | 'gaze' | 'smile' | 'imitate' | 'repeat' | 'voice' | 'listen' | 'out_of_scope' | 'alert' | 'session';

export type ActivityEvent = { type: ActivityType; t?: number; data?: Record<string, unknown> };

export type Summary = {
  day: string;
  sessions: number;
  touches: number;
  reaction_ms: number;
  gaze_s: number;
  smiles: number;
  repeats: number;
  repeat_ok: number;
  words: string[];
  favorites: string[];
  balance: { visual: number; audio: number; touch: number };
  out_of_scope: string[];
  alerts: string[];
};

export type ChildFrameOut = {
  face: boolean;
  looking: boolean;
  mouth_open: boolean;
  mouth: { open: number; width: number } | null;
  gaze: { yaw: number; pitch: number; iris: number; looking: boolean } | null;
};
