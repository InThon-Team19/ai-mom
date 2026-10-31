// 가족 아바타 (말하지 않는 곳): 부모 = 부모가 꾸민 캐릭터(Avatar), 아이 = 아이 일러스트(팀원 그림). 담당: 태희
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';

import { Avatar, avatarFor } from './Avatar';
import { useProfile } from '@/lib/store';
import { portraitId } from '@/lib/portraitConfig';
import { IllustratedAvatar } from './IllustratedAvatar';

const childPortrait = require('../../assets/child-2d/neutral.png');

export function FamilyAvatar({ role = 'parent', size = 160, config, ...rest }: ComponentProps<typeof Avatar> & { role?: 'parent' | 'child' }) {
  const profile = useProfile();
  if (role === 'child') {
    return <Image source={childPortrait} accessibilityLabel="아이 아바타" style={{ width: size, height: size * 1.1 }} contentFit="contain" transition={0} />;
  }
  const appearance = config ?? profile?.avatar;
  const id = portraitId(appearance, profile?.parent.title);
  if (id) return <IllustratedAvatar {...rest} id={id} size={size} blink={rest.blink ?? !profile?.settings.reduceMotion} />;
  return <Avatar {...rest} size={size} config={avatarFor(appearance, profile?.parent.title)} />;
}
