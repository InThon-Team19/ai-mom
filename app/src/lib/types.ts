// 담당: 민주 — 서버 models.py / docs/api.md 와 맞춰서 타입 정의
// /api 계약은 snake_case. 기존 입력 파이프라인 타입은 아래에 유지한다.
export type BackendToken = { access_token: string; token_type: 'bearer'; expires_at: string };
export type BackendChild = {
  id: string; created_at: string; parent_id: string; nickname: string; birth_month: string;
  speech_level: 'babbling' | 'single_words' | 'two_words' | 'short_sentences'; interests: string[];
  haptics_enabled: boolean; daily_limit_minutes: number; window_start: string; window_end: string;
};
export type BackendPersona = {
  id: string; created_at: string; parent_id: string; parent_title: string;
  speaking_style: '다정한' | '장난스러운' | '차분한'; english_enabled: boolean;
  education_goals: string[]; avatar: Record<string, string>; status: 'draft' | 'confirmed';
};
export type BackendPlan = {
  id: string; created_at: string; child_id: string; persona_id: string; date: string; day_number: 1 | 2;
  feedback_id: string | null; pacing: 'normal' | 'slow'; reading_script: string;
  reading_status: 'required' | 'submitted'; content_ids: string[];
};
export type BackendSession = {
  id: string; created_at: string; child_id: string; plan_id: string; persona_id: string; device_id: string | null;
  mode: 'multisensory' | 'audio_only'; status: 'active' | 'ended'; pacing: 'normal' | 'slow'; ended_at: string | null;
};
export type BackendMessage = {
  id: string; created_at: string; session_id: string; sequence: number; speaker: 'agent'; text: string;
  safety_status: 'grounded' | 'out_of_scope' | 'needs_parent'; delivery_status: 'prepared';
};
export type BackendReview = {
  id: string; created_at: string; child_id: string; message_id: string;
  reason: 'out_of_scope' | 'needs_parent'; status: 'pending' | 'reviewed';
};
export type BackendReport = {
  from_date: string; to_date: string; period: 'day' | 'week'; session_count: number; duration_seconds: number;
  event_count: number; sense_counts: Record<'auditory' | 'visual' | 'tactile', number>;
  sense_ratios: Record<'auditory' | 'visual' | 'tactile', number> | null;
  practiced_words: string[]; review_items: BackendReview[]; learning_rate: null; development_score: null;
};
export type BackendFeedback = {
  id: string; created_at: string; parent_id: string; child_id: string; for_date: string;
  concerns: ('too_fast' | 'too_difficult' | 'haptics_too_strong' | 'voice_unnatural')[];
  new_words: string[]; pacing: 'normal' | 'slow';
};
export type BackendReply = {
  message: BackendMessage; source_ids: string[]; session_status: 'active' | 'ended';
  engine: 'curriculum' | 'llm_selection' | 'curriculum_fallback';
};
export type BackendSample = {
  id: string; created_at: string; parent_id: string; child_id: string; persona_id: string;
  kind: 'audio' | 'mouth_track'; purpose: 'onboarding' | 'night_reading'; plan_id: string | null;
  storage_key: string; sentence_count: number; status: 'submitted';
};
export type BackendDevice = {
  id: string; created_at: string; parent_id: string; child_id: string; persona_id: string;
  label: string; revoked_at: string | null;
};
export type BackendOnboarding = { ready: boolean; checks: Record<string, boolean> };
export type BackendContext = {
  device: BackendDevice; child: BackendChild; persona: BackendPersona;
  onboarding: BackendOnboarding; plan: BackendPlan | null;
};
export type BackendHome = {
  child: BackendChild; onboarding: BackendOnboarding; plan: BackendPlan | null; report: BackendReport;
  evening_tasks: { reviewed: boolean; feedback_submitted: boolean; next_reading_submitted: boolean };
};
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

export type ActivityType = 'touch' | 'gaze' | 'smile' | 'expression' | 'imitate' | 'repeat' | 'voice' | 'listen' | 'out_of_scope' | 'blocked' | 'alert' | 'session';

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
  expressions?: Record<string, number>; // 표정 변화 {smile, surprise, frown}
  voices?: number; // 소리 반응·자동 녹음된 말소리 수
  listen_s?: number; // 부모 목소리 들은 시간
};

// 아이 말소리 클립 (소음 감지 자동 녹음 → 부모가 나중에 들음)
export type ChildClipOut = { saved: boolean; id: string | null; text: string; matched: boolean | null; alert: boolean };
export type ChildClip = { id: string; at: number; item: string; phase: string; text: string; matched: boolean | null; alert: boolean; duration_s: number };

export type ChildFrameOut = {
  face: boolean;
  looking: boolean;
  mouth_open: boolean;
  mouth: { open: number; width: number } | null;
  gaze: { yaw: number; pitch: number; iris: number; looking: boolean } | null;
};

// 설정 탭 (태희) — server/app/routers/profile.py
export type DeviceInfo = { device_id: string; role: 'parent' | 'child'; name: string; linked_at: number; last_seen: number };

export type History = {
  voice: { kind: 'signup' | 'plan'; text: string; at: number; ok: boolean; speech_s: number }[];
  mouth: { kind: 'signup' | 'plan'; text: string; at: number; ok: boolean; face_s: number }[];
  days: { day: string; sessions: number; touches: number; repeats: number; repeat_ok: number; words: string[]; gaze_s: number }[];
};
