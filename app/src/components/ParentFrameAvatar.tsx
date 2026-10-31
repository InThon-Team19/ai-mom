// Keep the customizable SVG renderer; selected parent illustrations use fixed full-image frames.
// Both consume the same TTS-clock driver. Illustration swaps update refs, not React state.
import { memo, useEffect, useState, type ComponentProps } from 'react';

import { Avatar, avatarFor } from './Avatar';
import { useProfile } from '@/lib/store';
import type { MouthPose } from '@/lib/lipsync';
import type { ParentFrame, ParentFrameDriver } from '@/lib/parentFrames';
import { IllustratedAvatar } from './IllustratedAvatar';
import { portraitId } from '@/lib/portraitConfig';

type Props = ComponentProps<typeof Avatar> & { driver: ParentFrameDriver; mouthPose?: MouthPose; onReady?: () => void };

export const ParentFrameAvatar = memo(function ParentFrameAvatar(props: Props) {
  const profile = useProfile();
  const config = props.config ?? profile?.avatar;
  const id = portraitId(config, profile?.parent.title);
  if (id) return <IllustratedAvatar {...props} id={id} blink={props.blink ?? !profile?.settings.reduceMotion} />;
  return <SvgParentAvatar {...props} config={config} />;
});

function SvgParentAvatar({
  driver,
  onReady,
  mouthPose: _mouthPose,
  config,
  ...rest
}: Props) {
  const title = useProfile()?.parent.title;
  const [pose, setPose] = useState<ParentFrame>(driver.current);
  useEffect(() => driver.subscribe(setPose), [driver]);
  useEffect(() => {
    onReady?.(); // SVG 라 불러올 그림이 없음 → 바로 준비됨
  }, [onReady]);
  return <Avatar {...rest} config={avatarFor(config, title)} pose={pose} />;
}
