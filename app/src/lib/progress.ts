// 학습 상태와 일차 연동 (기획서 v2 2-7). 담당: 태희
// - 단어 상태: 예정 / 만남(사물이 등장하고 아바타가 말함) / 배움(아이가 따라 말한 것이 인식됨)
// - 리포트 첫 줄은 '배움' 단어로만 만들고, 낭독 대본에 있거나 부모가 읽었다는 이유로 '배움'이 되지 않음
// - 일차: 밤 낭독 완료 → 다음날 아이 화면을 처음 켤 때 1 올라감. 낭독 안 한 날은 같은 일차 복습
import { DAYS, dayOf, ITEMS } from '@/content/curriculum';
import type { Profile } from '@/lib/store';
import type { Summary } from '@/lib/types';

/** 받침 있으면 a, 없으면 b (을/를, 과/와, 이/가) */
export function josa(word: string, a: string, b: string) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return b;
  return (c - 0xac00) % 28 ? a : b;
}

const joinKo = (ws: string[]) => ws.reduce((acc, w, i) => (i === 0 ? w : `${acc}${josa(ws[i - 1], '과', '와')} ${w}`), '');

export type WordStatus = { learned: string[]; met: string[]; planned: string[] };

/** 오늘 일차 단어별 상태 (요약은 서버 활동 기록 /activity/{id}/summary) */
export function wordStatus(day: number, s: Summary | null): WordStatus {
  const words = dayOf(day).items.map((id) => ITEMS[id].ko);
  if (!s || (s.sessions === 0 && s.touches === 0 && s.repeats === 0)) return { learned: [], met: [], planned: words };
  const learned = words.filter((w) => s.words.includes(w));
  // 만남: 그날 대화를 시작했으면 아바타가 그날 사물을 차례로 보여주고 말함 (터치한 사물은 확실히 만남)
  const met = words.filter((w) => !learned.includes(w) && (s.sessions > 0 || s.favorites.includes(w)));
  const planned = words.filter((w) => !learned.includes(w) && !met.includes(w));
  return { learned, met, planned };
}

/** 리포트 첫 줄: "오늘은 사과를 배우고, 바나나를 만났어요" */
export function headline(st: WordStatus) {
  const { learned, met } = st;
  if (learned.length && met.length) {
    const l = joinKo(learned);
    const m = joinKo(met);
    return `오늘은 ${l}${josa(learned[learned.length - 1], '을', '를')} 배우고, ${m}${josa(met[met.length - 1], '을', '를')} 만났어요`;
  }
  if (learned.length) return `오늘은 ${joinKo(learned)}${josa(learned[learned.length - 1], '을', '를')} 배웠어요`;
  if (met.length) return `오늘은 ${joinKo(met)}${josa(met[met.length - 1], '을', '를')} 만났어요`;
  return '아직 오늘 활동이 없어요';
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** 밤 낭독 완료 표시 (일차는 아직 그대로) */
export function readingDonePatch(p: Profile): Partial<Profile> {
  return { readingDone: { forDay: Math.min(p.day + 1, DAYS.length), date: today() } };
}

/** 다음날 아이 화면을 처음 켤 때: 낭독을 마쳤으면 일차 +1 (force: 시연용 즉시 넘기기) */
export function dayAdvancePatch(p: Profile, force = false): Partial<Profile> | null {
  const r = p.readingDone;
  if (!r || r.forDay <= p.day) return null;
  if (!force && r.date === today()) return null;
  return { day: r.forDay, readingDone: null };
}

/** 오늘 밤 낭독을 마쳤는지 (readingDone 이 오늘 날짜로 찍혔을 때만) */
export const readToday = (p: Profile | null | undefined) => !!p?.readingDone && p.readingDone.date === today();
