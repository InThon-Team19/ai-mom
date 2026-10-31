// 감각 발달 리포트 (시각·청각·촉각): 오늘 vs 지난 3일 평균 비교 → 발전/유지/줄었어요 + 무리 신호 + 내일 제안 — 담당: 태희
// 진단이 아니라 활동 기록으로 본 '참고용 관찰'. 의학적 판단·원인 해석은 하지 않는다 (기획서 3. 감각 설계).
import { api } from '@/lib/api';
import type { Summary } from '@/lib/types';

export type SenseKey = 'visual' | 'audio' | 'touch';
export type SenseStatus = '발전' | '유지' | '줄었어요' | '첫 기록' | '기록 없음';

export type SenseRow = {
  key: SenseKey;
  label: string; // 시각 / 청각 / 촉각
  status: SenseStatus;
  score: number; // 오늘 활동량 (비교용)
  change: number | null; // (오늘-평균)/평균, 비교 불가면 null
  detail: string; // 수치 한 줄 "화면 3분 · 웃음 4번"
  line: string; // 판단 한 줄 "평소보다 오래 봤어요"
};

export type SensoryReport = {
  hasData: boolean;
  historyDays: number; // 비교에 쓴 지난 날 수 (기록 있는 날만)
  overall: string;
  senses: SenseRow[];
  strain: string[]; // 무리 신호 (있으면 경고색)
  suggestions: string[]; // 1~3개, 가능성으로 부드럽게
  balance: Record<SenseKey, number>; // 0~1
  note: string;
};

// ── 기준값 (README 보고용으로 한곳에 모음) ──
export const RULES = {
  historyDays: 3, // 지난 며칠과 비교
  upRatio: 0.2, // +20% 이상 → 발전
  downRatio: 0.2, // -20% 이상 → 줄었어요
  fastReactionMs: 350, // 평균 반응이 이보다 빠르고
  manyTouches: 30, // 터치가 이 이상이면 → 무리 신호
  frowns: 3, // 찡그림 이 이상 → 무리 신호
  gazeDrop: 0.4, // 응시가 40% 이상 줄었는데
  touchKeep: 0.8, // 터치는 평균의 80% 이상 유지 (그리고 10번 이상) → 무리 신호
  longScreenS: 20 * 60, // 하루 화면 응시+듣기 20분 이상 → 무리 신호
};

const NOTE = '활동 기록으로 본 참고용 관찰이에요. 진단이 아니며, 아이마다 하루하루 다를 수 있어요.';

const LABEL: Record<SenseKey, string> = { visual: '시각', audio: '청각', touch: '촉각' };
const PLAY: Record<SenseKey, string> = { visual: '눈으로 보는 놀이', audio: '듣고 말하는 놀이', touch: '손으로 하는 놀이' };

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const expr = (s: Summary, k: string) => s.expressions?.[k] ?? 0; // 'state'는 기분 기록이라 표정 수에서 뺌

export function hasActivity(s: Summary | null | undefined): s is Summary {
  return !!s && (s.sessions > 0 || s.touches > 0 || s.gaze_s > 0 || s.repeats > 0 || (s.voices ?? 0) > 0 || (s.listen_s ?? 0) > 0);
}

/** 감각별 활동량 (서버 balance 계산과 같은 방식: 응시·듣기는 10초당 1) */
function scores(s: Summary): Record<SenseKey, number> {
  return {
    visual: s.gaze_s / 10 + s.smiles + expr(s, 'smile') + expr(s, 'surprise'),
    audio: s.repeats + (s.voices ?? 0) + (s.listen_s ?? 0) / 10,
    touch: s.touches,
  };
}

export const duration = (sec: number) => {
  const v = Math.max(0, Math.round(sec));
  const m = Math.floor(v / 60);
  return m > 0 ? `${m}분${v % 60 ? ` ${v % 60}초` : ''}` : `${v}초`;
};

function detailOf(k: SenseKey, s: Summary) {
  if (k === 'visual') {
    const parts = [`화면 ${duration(s.gaze_s)}`];
    const smile = s.smiles + expr(s, 'smile');
    if (smile) parts.push(`웃음 ${smile}번`);
    if (expr(s, 'surprise')) parts.push(`놀람 ${expr(s, 'surprise')}번`);
    if (expr(s, 'frown')) parts.push(`찡그림 ${expr(s, 'frown')}번`);
    return parts.join(' · ');
  }
  if (k === 'audio') {
    const parts: string[] = [];
    if (s.repeats) parts.push(`따라 말하기 ${s.repeats}번(${s.repeat_ok}번 비슷)`);
    parts.push(`소리 반응 ${s.voices ?? 0}번`);
    if ((s.listen_s ?? 0) > 0) parts.push(`들은 시간 ${duration(s.listen_s ?? 0)}`);
    return parts.join(' · ');
  }
  return `터치 ${s.touches}번${s.reaction_ms > 0 ? ` · 평균 반응 ${(s.reaction_ms / 1000).toFixed(1)}초` : ''}`;
}

const LINES: Record<SenseKey, Record<SenseStatus, string>> = {
  visual: {
    발전: '평소보다 화면과 표정에 오래 반응했어요.',
    유지: '보는 반응이 평소와 비슷해요.',
    줄었어요: '평소보다 화면을 보는 반응이 줄었어요.',
    '첫 기록': '첫 기록이에요. 내일부터 비교해 드릴게요.',
    '기록 없음': '오늘은 아직 보는 반응 기록이 없어요.',
  },
  audio: {
    발전: '평소보다 소리에 더 많이 반응하고 말했어요.',
    유지: '듣고 말하는 반응이 평소와 비슷해요.',
    줄었어요: '평소보다 소리 반응이 줄었어요.',
    '첫 기록': '첫 기록이에요. 내일부터 비교해 드릴게요.',
    '기록 없음': '오늘은 아직 소리 반응 기록이 없어요.',
  },
  touch: {
    발전: '평소보다 손으로 누르고 만지는 반응이 늘었어요.',
    유지: '손으로 하는 반응이 평소와 비슷해요.',
    줄었어요: '평소보다 누르는 반응이 줄었어요.',
    '첫 기록': '첫 기록이에요. 내일부터 비교해 드릴게요.',
    '기록 없음': '오늘은 아직 터치 기록이 없어요.',
  },
};

const UP_TIP: Record<SenseKey, string> = {
  visual: '보는 반응이 늘었어요 → 내일은 입모양을 크게 보여주는 활동을 조금 늘려볼까요?',
  audio: '소리 반응이 늘었어요 → 내일은 노래나 동화처럼 듣는 활동을 조금 늘려볼까요?',
  touch: '촉각 반응이 늘었어요 → 내일은 누르고 만지는 활동을 조금 늘려볼까요?',
};
const DOWN_TIP: Record<SenseKey, string> = {
  visual: '보는 반응이 줄었어요 → 피곤했을 수도 있어요. 내일은 화면을 짧게 보고 목소리로 이어가 볼까요?',
  audio: '소리 반응이 줄었어요 → 내일은 부모님 목소리로 이름을 불러주며 시작해 볼까요?',
  touch: '누르는 반응이 줄었어요 → 내일은 크게 한 번 누르는 쉬운 놀이부터 해볼까요?',
};

/** 순수 계산: 오늘 요약 + 지난 날 요약들(기록 없는 날 제외 전) → 리포트 */
export function computeSensory(today: Summary | null, history: (Summary | null)[]): SensoryReport {
  const past = history.filter(hasActivity);
  const balance = { visual: today?.balance?.visual ?? 0, audio: today?.balance?.audio ?? 0, touch: today?.balance?.touch ?? 0 };
  if (!hasActivity(today)) {
    return {
      hasData: false,
      historyDays: past.length,
      overall: '아직 오늘 감각 활동 기록이 없어요',
      senses: (['visual', 'audio', 'touch'] as const).map((k) => ({
        key: k, label: LABEL[k], status: '기록 없음', score: 0, change: null, detail: '', line: LINES[k]['기록 없음'],
      })),
      strain: [],
      suggestions: [],
      balance,
      note: NOTE,
    };
  }

  const now = scores(today);
  const avgOf = (k: SenseKey) => (past.length ? past.reduce((a, s) => a + scores(s)[k], 0) / past.length : 0);

  const senses: SenseRow[] = (['visual', 'audio', 'touch'] as const).map((k) => {
    let status: SenseStatus;
    let change: number | null = null;
    if (!past.length) status = '첫 기록';
    else {
      const avg = avgOf(k);
      if (avg <= 0) status = now[k] > 0 ? '발전' : '유지';
      else {
        change = (now[k] - avg) / avg;
        status = change >= RULES.upRatio ? '발전' : change <= -RULES.downRatio ? '줄었어요' : '유지';
      }
    }
    if (now[k] === 0 && avgOf(k) === 0) status = '기록 없음';
    return { key: k, label: LABEL[k], status, score: now[k], change, detail: detailOf(k, today), line: LINES[k][status] };
  });

  // ── 무리 신호 ──
  const strain: string[] = [];
  const tips: string[] = [];
  const fast = today.reaction_ms > 0 && today.reaction_ms < RULES.fastReactionMs && today.touches >= RULES.manyTouches;
  if (fast) {
    strain.push(`누르기가 아주 빠르고 많았어요 (평균 ${(today.reaction_ms / 1000).toFixed(1)}초, ${today.touches}번). 자극이 많았을 수 있어요.`);
  }
  const avgGaze = past.length ? past.reduce((a, s) => a + s.gaze_s, 0) / past.length : 0;
  const avgTouch = past.length ? past.reduce((a, s) => a + s.touches, 0) / past.length : 0;
  const gazeDrop =
    avgGaze > 0 && today.gaze_s <= avgGaze * (1 - RULES.gazeDrop) && today.touches >= 10 && today.touches >= avgTouch * RULES.touchKeep;
  if (gazeDrop) strain.push('화면을 보는 시간은 많이 줄었는데 누르기는 그대로예요. 화면보다 손에만 반응했을 수 있어요.');
  if (fast || gazeDrop) {
    tips.push(
      gazeDrop
        ? '화면을 보는 시간이 줄고 누르기가 이어졌어요 → 자극이 많았을 수 있어요. 내일은 청각 집중 모드로 짧게 시작해 보세요.'
        : '누르기가 빨라졌어요 → 자극이 많았을 수 있어요. 내일은 청각 집중 모드로 짧게 시작해 보세요.',
    );
  }
  const frown = expr(today, 'frown');
  if (frown >= RULES.frowns) {
    strain.push(`찡그린 표정이 ${frown}번 보였어요.`);
    tips.push('찡그림이 여러 번 보였어요 → 설정에서 진동을 끄거나 효과음을 줄여 보는 것도 방법이에요.');
  }
  // 학습 화면이 사물마다 추정한 아이 상태 (감각 반응 기반)
  const moods = today.moods ?? {};
  if ((moods.overloaded ?? 0) >= 2) strain.push(`활동 중 무리한 것처럼 보인 순간이 ${moods.overloaded}번 있었어요 (빠른 연속 누르기·찡그림 등).`);
  if ((moods.distracted ?? 0) >= 2) tips.push('집중이 흐트러진 순간이 여러 번 있었어요. 내일은 활동을 짧게 나누고 엄마 목소리로 먼저 불러 주면 좋을 수 있어요.');
  if (today.alerts.length) {
    strain.push(`불편함을 말한 순간이 ${today.alerts.length}번 있었어요. 아래 확인 필요에서 살펴봐 주세요.`);
  }
  const screenS = today.gaze_s + (today.listen_s ?? 0);
  if (screenS >= RULES.longScreenS) {
    strain.push(`오늘 화면·소리 활동이 ${duration(screenS)}로 길었어요.`);
    tips.push('활동 시간이 길었어요 → 내일은 대화를 짧게 두 번으로 나눠볼까요?');
  }

  // ── 감각 변화 제안 ──
  const ups = senses.filter((x) => x.status === '발전').sort((a, b) => (b.change ?? 9) - (a.change ?? 9));
  const downs = senses.filter((x) => x.status === '줄었어요').sort((a, b) => (a.change ?? 0) - (b.change ?? 0));
  // 무리 신호가 있으면 촉각을 '더 늘리자'는 제안은 하지 않음
  for (const u of ups) if (!(strain.length && u.key === 'touch')) tips.push(UP_TIP[u.key]);
  for (const d of downs) if (!(gazeDrop && d.key === 'visual')) tips.push(DOWN_TIP[d.key]);
  const skew = (['visual', 'audio', 'touch'] as const).find((k) => balance[k] > 0.6);
  if (skew) {
    const others = (['visual', 'audio', 'touch'] as const).filter((k) => k !== skew).map((k) => LABEL[k]).join('·');
    tips.push(`오늘은 ${LABEL[skew]} 활동이 ${Math.round(balance[skew] * 100)}%로 많았어요 → 내일은 ${others} 활동도 섞어볼까요?`);
  }
  if (!tips.length) tips.push('세 감각을 고르게 쓰고 있어요 → 내일도 오늘처럼 이어가 볼게요.');

  // ── 전체 한 문장 ──
  let overall: string;
  const dominant = (['visual', 'audio', 'touch'] as const).reduce((a, b) => (balance[b] > balance[a] ? b : a));
  if (!past.length) overall = `오늘은 ${PLAY[dominant]}에 가장 많이 반응했어요`;
  else if (ups.length) {
    overall = `오늘은 ${PLAY[ups[0].key]}에 반응이 커졌어요`;
    if (downs.length) overall += `. ${PLAY[downs[0].key]}는 조금 줄었어요`;
  } else if (downs.length) overall = `오늘은 ${PLAY[downs[0].key]}에 반응이 평소보다 조금 줄었어요`;
  else overall = '오늘은 세 감각 모두 평소와 비슷하게 반응했어요';

  return {
    hasData: true,
    historyDays: past.length,
    overall,
    senses,
    strain,
    suggestions: tips.slice(0, 3),
    balance,
    note: NOTE,
  };
}

export type SensoryLoad = { today: Summary; report: SensoryReport };

/** 오늘 요약 + 지난 3일 요약을 불러와 계산. 오늘 요약이 실패하면 throw (지난 날 실패는 기록 없음으로 처리) */
export async function loadSensory(childId: string): Promise<SensoryLoad> {
  const days = Array.from({ length: RULES.historyDays }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (i + 1));
    return ymd(d);
  });
  const [todayRes, ...pastRes] = await Promise.allSettled([api.summary(childId), ...days.map((d) => api.summary(childId, d))]);
  if (todayRes.status === 'rejected') throw todayRes.reason;
  const past = pastRes.map((r) => (r.status === 'fulfilled' ? r.value : null));
  return { today: todayRes.value, report: computeSensory(todayRes.value, past) };
}
