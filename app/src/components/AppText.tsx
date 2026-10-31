// 앱 글꼴: 프리텐다드(OFL). 화면은 react-native Text 대신 이 Text·TextInput 을 씀 — fontWeight 에 맞는 굵기 파일을 골라 줌. 담당: 태희
// (안드로이드는 글꼴 파일 하나에 fontWeight 를 줘도 굵어지지 않아서 굵기마다 다른 파일 이름을 씀)
import { createContext, useContext, type ComponentProps, type ComponentRef } from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextProps, type TextStyle } from 'react-native';
import Animated from 'react-native-reanimated';

export const FONT_FILES = {
  'Pretendard-Regular': require('@/assets/fonts/Pretendard-Regular.otf'),
  'Pretendard-Medium': require('@/assets/fonts/Pretendard-Medium.otf'),
  'Pretendard-SemiBold': require('@/assets/fonts/Pretendard-SemiBold.otf'),
  'Pretendard-Bold': require('@/assets/fonts/Pretendard-Bold.otf'),
  'Pretendard-ExtraBold': require('@/assets/fonts/Pretendard-ExtraBold.otf'),
  'Pretendard-Black': require('@/assets/fonts/Pretendard-Black.otf'),
};
type Family = keyof typeof FONT_FILES;

function familyOf(weight: TextStyle['fontWeight']): Family {
  const w = weight === 'bold' ? 700 : weight === 'normal' ? 400 : Number(weight) || 400;
  if (w >= 900) return 'Pretendard-Black';
  if (w >= 800) return 'Pretendard-ExtraBold';
  if (w >= 700) return 'Pretendard-Bold';
  if (w >= 600) return 'Pretendard-SemiBold';
  if (w >= 500) return 'Pretendard-Medium';
  return 'Pretendard-Regular';
}

// 글자 안의 글자(<Text> 안 <Text>)는 굵기를 안 주면 바깥 글자 굵기를 이어받음
const Inherited = createContext<Family | null>(null);

function pick(style: TextProps['style'], inherited: Family | null) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (flat.fontFamily) return { family: null, flat };
  return { family: flat.fontWeight != null ? familyOf(flat.fontWeight) : (inherited ?? 'Pretendard-Regular'), flat };
}

export function Text({ style, ...rest }: ComponentProps<typeof RNText>) {
  const inherited = useContext(Inherited);
  const { family } = pick(style, inherited);
  if (!family) return <RNText style={style} {...rest} />;
  return (
    <Inherited.Provider value={family}>
      <RNText style={[style, { fontFamily: family, fontWeight: 'normal' }]} {...rest} />
    </Inherited.Provider>
  );
}

/** useRef 타입용 (react-native TextInput 의 ref 와 같음) */
export type TextInputRef = ComponentRef<typeof RNTextInput>;

export function TextInput({ style, ...rest }: ComponentProps<typeof RNTextInput>) {
  const { family } = pick(style as TextProps['style'], null);
  return <RNTextInput style={family ? [style, { fontFamily: family, fontWeight: 'normal' }] : style} {...rest} />;
}

export const AnimatedText = Animated.createAnimatedComponent(Text);
