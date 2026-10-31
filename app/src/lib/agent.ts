// 아바타 대사 가져오기: 에이전트(충항) API → 실패·없음·차단이면 커리큘럼 고정 문장. 담당: 태희 (연결)
// 계약: docs/api.md "에이전트 대화 (충항)" — POST /conversation/turn
import { req } from '@/lib/api';
import { logEvent } from '@/lib/sense';

export type TurnIn = {
  child_id: string;
  day: number;
  item: string; // 'apple' | 'banana' | 'snack' (chat 은 '' 도 됨)
  moment: 'invite' | 'reply' | 'chat'; // invite: 사물 권하기, reply: 아이 말에 대답, chat: 학습 뒤 자유 이야기 (child_text 없으면 여는 말)
  child_text?: string; // reply·chat 일 때 STT 결과
  /** chat: 최근 대화 (최대 6턴) — 앞뒤 맥락을 이어서 대답하게 */
  history?: { role: 'child' | 'avatar'; text: string }[];
  /** 지금 이 사물에서 아이 감각 반응 (기획 1-1: 반응을 읽어 다음 활동을 바꿈) — 에이전트가 말·속도·활동을 고르는 근거 */
  signals?: {
    touches: number; // 누른 횟수
    reaction_ms?: number; // 처음 누르기까지 걸린 시간
    gaze_ratio?: number; // 화면을 본 비율 0~1
    smiles: number;
    voices: number; // 말소리·소리 반응 수
    repeated?: boolean; // 따라 말하기 성공
    mood?: 'engaged' | 'calm' | 'overloaded' | 'distracted'; // 앱이 추정한 상태
  };
};

export type TurnOut = {
  text: string; // 아바타가 말할 문장 (검증된 범위 안)
  out_of_scope?: boolean; // 아이 말이 학습 범위 밖 → 부모 확인 목록
  blocked?: string | null; // 출력 전 검사에서 막은 원래 문장 → 부모 확인 목록
};

let unavailableUntil = 0; // 404 면 1분 동안 묻지 않음 (예전엔 앱을 다시 켤 때까지 안 물어서 서버가 생겨도 고정 문장만 나왔음) // 한 번 404 면 이번 실행 동안 다시 안 물어봄 (아이 화면 지연 방지). 앱을 다시 불러오면 초기화

/** 에이전트 대사. fallback 은 지금 커리큘럼 문장 (에이전트가 없거나 5.5초 안에 답이 없으면 사용. 서버는 AI 를 4.5초까지 기다림) */
export async function agentSay(input: TurnIn, fallback: string): Promise<{ text: string; outOfScope: boolean }> {
  if (Date.now() < unavailableUntil) return { text: fallback, outOfScope: false };
  try {
    const res = await Promise.race([
      req<TurnOut>('/conversation/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), input.moment === 'chat' ? 6500 : 5500)),
    ]);
    if (res.blocked) logEvent('blocked', { text: res.blocked });
    if (res.out_of_scope && input.child_text) logEvent('out_of_scope', { text: input.child_text });
    const text = res.text?.trim();
    return { text: text || fallback, outOfScope: !!res.out_of_scope };
  } catch (e) {
    if (String(e).includes('404') || String(e).includes('405')) unavailableUntil = Date.now() + 60_000;
    return { text: fallback, outOfScope: false };
  }
}
