// 아이 화면의 말하는 부모 아바타 — 부모가 꾸민 캐릭터(Avatar, 실제 얼굴 X)에 입모양 신호(driver: 아·이·오·우·닫힘)를 입힘. 담당: 태희
// driver 는 소리 재생 시계에 맞춰 입모양이 바뀔 때만 알려 줌 (바뀔 때만 이 아바타만 다시 그림)
// (팀원이 만든 고정 일러스트 6장 방식은 꾸미기·아빠 아바타가 안 돼서 사용자 요청으로 되돌림. 그림 파일은 assets/parent-2d 에 남겨 둠)
import { memo, useEffect, useState, type ComponentProps } from 'react';

import { Avatar, avatarFor } from './Avatar';
import { useProfile } from '@/lib/store';
import type { MouthPose } from '@/lib/lipsync';
import type { ParentFrame, ParentFrameDriver } from '@/lib/parentFrames';

export const ParentFrameAvatar = memo(function ParentFrameAvatar({
  driver,
  onReady,
  mouthPose: _mouthPose,
  config,
  ...rest
}: ComponentProps<typeof Avatar> & { driver: ParentFrameDriver; mouthPose?: MouthPose; onReady?: () => void }) {
  const title = useProfile()?.parent.title;
  const [pose, setPose] = useState<ParentFrame>(driver.current);
  useEffect(() => driver.subscribe(setPose), [driver]);
  useEffect(() => {
    onReady?.(); // SVG 라 불러올 그림이 없음 → 바로 준비됨
  }, [onReady]);
  return <Avatar {...rest} config={avatarFor(config, title)} pose={pose} />;
});
