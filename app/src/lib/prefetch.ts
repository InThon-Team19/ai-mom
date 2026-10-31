// 엄마 목소리 TTS 미리 만들기 — 담당: 태희
// 서버가 문장마다 엄마 녹음으로 즉석 복제(4~5초)하므로, 그날 아이 화면이 말할 문장을 미리 요청해 서버에 저장해 둠
// 문장은 child/*.tsx 가 실제로 말하는 문장과 글자까지 같아야 저장본을 씀 (바꾸면 여기도 같이)
import { dayOf, ENDING, fill, ITEMS } from '@/content/curriculum';
import { api } from '@/lib/api';
import type { Profile } from '@/lib/store';

function who(p: Profile) {
  return {
    name: p.child.nickname || p.child.name || '우리 아기',
    me: p.parent.title || '엄마',
    english: p.parent.goals.some((g) => g.includes('영어')),
  };
}

/** 그 일차에 아이 화면이 말할 문장 (먼저 쓰는 순서) */
export function dayLines(p: Profile, dayNum = p.day): string[] {
  const d = dayOf(dayNum);
  const { name, me, english } = who(p);
  const lines: string[] = [`${fill('안녕 {name}! {me}랑 같이 놀자!', { name, me })} ${fill(`{name}야, ${d.greeting}`, { name, me })}`];
  for (const id of d.items) {
    const it = ITEMS[id];
    const word = english ? `${it.ko}! ${it.en}!` : `${it.ko}!`;
    lines.push(word, fill(it.invite, { name, me }), '눌러볼까?', `같이 따라 해 볼까? ${it.ko}!`, `좋아! ${word}`);
  }
  lines.push(fill('잘했어, 우리 {name}!', { name, me }));
  if (d.story) {
    lines.push(fill(`{me}가 동화책 읽어줄게. ${d.story.title}!`, { me, name }));
    d.story.pages.forEach((pg) => lines.push(pg.text));
  }
  for (const id of d.items) lines.push(fill(ENDING, { name, me, fav: ITEMS[id].ko }));
  return [...new Set(lines)];
}

const running = new Set<string>();

/** 서버에 미리 만들어 두기 (동시에 2개씩, 실패해도 무시). 같은 일차를 두 번 돌리지 않음 */
export async function prefetchDay(p: Profile, dayNum = p.day) {
  const key = `${p.childId}:${dayNum}`;
  if (running.has(key)) return;
  running.add(key);
  const queue = dayLines(p, dayNum);
  const worker = async () => {
    while (queue.length) {
      const text = queue.shift()!;
      try {
        await api.tts(p.childId, text);
      } catch {
        return; // 목소리 녹음이 없거나 서버 문제: 그만 (앱은 기기 음성으로 대신 말함)
      }
    }
  };
  await Promise.all([worker(), worker()]);
  running.delete(key);
}
