// 담당: 민주 — 서버 models.py / docs/api.md 와 맞춰서 타입 정의
// ↓ 입력 파이프라인 (태희) — server/app/routers/vision.py, voice.py 응답과 동일

export type SpeechFeatures = {
  duration_s: number;
  speech_s: number;
  speech_ratio: number;
  syllables_per_s: number;
  volume: number;
};

export type ParentSampleOut = {
  url: string;
  features: SpeechFeatures;
  total_speech_s: number;
  progress: number; // 학습률 0~1
  sample_count: number;
};

export type SttOut = {
  text: string;
  features: SpeechFeatures;
  matched: boolean | null;
};

export type ParentMouthOut = {
  ok: boolean;
  face_ratio: number;
  frames: number;
  open_range: number[];
  sprites: string[]; // 립싱크용 입 사진 4장 (닫힘 → 크게 벌림)
  face_url: string | null;
  video_url: string;
  audio_url: string | null;
  track_url: string | null;
  message: string;
};

export type ChildFrameOut = {
  face: boolean;
  looking: boolean;
  mouth_open: boolean;
  mouth: { open: number; width: number } | null;
  gaze: { yaw: number; pitch: number; iris: number; looking: boolean } | null;
};
