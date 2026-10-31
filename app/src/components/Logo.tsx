// 아이맘 로고 (엄마와 아이가 하트 안에 안긴 그림, 배경 투명). 담당: 태희
import { Image } from 'react-native';

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/logo.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="아이맘 로고"
    />
  );
}
