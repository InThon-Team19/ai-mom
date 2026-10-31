// 가입 화면 공용 이동. 담당: 태희
import { router, type Href } from 'expo-router';

/** 뒤로 가기. 화면이 replace 로 열려 돌아갈 기록이 없으면 GO_BACK 오류가 나므로 정해 둔 이전 화면으로 */
export function goBack(fallback: Href) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/** 가입 단계 번호 → 그 이전 화면 (뒤로 갈 기록이 없을 때) */
const PREV_STEP: Record<number, Href> = {
  2: '/onboarding/start',
  3: '/onboarding/child',
  4: '/onboarding/parent',
  5: '/onboarding/avatar',
  6: '/onboarding/voice',
  7: '/onboarding/mouth',
};
export const prevOf = (step: number): Href => PREV_STEP[step] ?? '/onboarding/start';

/** 설정 탭에서 "수정"으로 들어왔으면(edit=1) 저장 후 설정으로 돌아가고, 아니면 다음 가입 단계로 */
export function goNext(edit: boolean, next: Href) {
  if (edit) goBack('/parent/settings' as Href);
  else router.push(next);
}
