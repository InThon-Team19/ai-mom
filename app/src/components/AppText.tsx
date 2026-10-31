// 큰 글자는 학교안심 둥근미소 Bold, 본문·탭·작은 글자는 카페24 써라운드 Air.
import { createContext, useContext, type ComponentProps, type ComponentRef } from 'react';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextProps, type TextStyle } from 'react-native';
import Animated from 'react-native-reanimated';

export const FONT_FILES = {
  'Hakgyoansim-Dunggeunmiso-Bold': require('@/assets/fonts/Hakgyoansim Dunggeunmiso OTF B.otf'),
  'Cafe24-Ssurround-Air': require('@/assets/fonts/Cafe24SsurroundAir-v1.1.ttf'),
};
type Family = keyof typeof FONT_FILES;

function familyOf(size: number): Family {
  return size >= 20 ? 'Hakgyoansim-Dunggeunmiso-Bold' : 'Cafe24-Ssurround-Air';
}

// 중첩된 Text는 바깥 글자 크기를 이어받아 같은 기준으로 글꼴을 선택함.
const Inherited = createContext(14);

function pick(style: TextProps['style'], inherited: number) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const size = flat.fontSize ?? inherited;
  return { family: flat.fontFamily ?? familyOf(size), size };
}

export function Text({ style, ...rest }: ComponentProps<typeof RNText>) {
  const inherited = useContext(Inherited);
  const { family, size } = pick(style, inherited);
  return (
    <Inherited.Provider value={size}>
      <RNText style={[style, { fontFamily: family, fontWeight: 'normal' }]} {...rest} />
    </Inherited.Provider>
  );
}

/** useRef 타입용 (react-native TextInput 의 ref 와 같음) */
export type TextInputRef = ComponentRef<typeof RNTextInput>;

export function TextInput({ style, ...rest }: ComponentProps<typeof RNTextInput>) {
  const { family } = pick(style as TextProps['style'], 14);
  return <RNTextInput style={[style, { fontFamily: family, fontWeight: 'normal' }]} {...rest} />;
}

export const AnimatedText = Animated.createAnimatedComponent(Text);
