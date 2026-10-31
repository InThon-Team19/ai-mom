// 가입 화면 공용: 설정 탭에서 "수정"으로 들어왔으면(edit=1) 저장 후 설정으로 돌아가고, 아니면 다음 가입 단계로. 담당: 태희
import { router, type Href } from 'expo-router';

export function goNext(edit: boolean, next: Href) {
  if (edit) router.back();
  else router.push(next);
}
