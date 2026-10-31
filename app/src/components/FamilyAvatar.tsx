import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import type { Avatar } from './Avatar';

const portraits = {
  parent: require('../../assets/parent-2d/neutral.png'),
  child: require('../../assets/child-2d/neutral.png'),
};

/** Approved full portraits. Parent speech uses ParentFrameAvatar separately. */
export function FamilyAvatar({ role = 'parent', size = 160 }: ComponentProps<typeof Avatar> & { role?: 'parent' | 'child' }) {
  return <Image source={portraits[role]} accessibilityLabel={role === 'parent' ? '부모 아바타' : '아이 아바타'} style={{ width: size, height: size * 1.1 }} contentFit="contain" transition={0} />;
}
