// 큰 글자(20px 이상)와 굵게 지정한 글자(fontWeight 700 이상)는 학교안심 둥근미소 Bold, 나머지 본문·탭·작은 글자는 카페24 써라운드 Air.
// (안드로이드는 글꼴 파일 하나에 fontWeight 를 줘도 굵어지지 않아서, 굵기는 글꼴 파일로 나눔)
import { createContext, useContext, type ComponentProps, type ComponentRef } from 'react';
import { Platform, StyleSheet, Text as RNText, TextInput as RNTextInput, type TextProps, type TextStyle } from 'react-native';
import Animated from 'react-native-reanimated';

export const FONT_FILES = {
  'Hakgyoansim-Dunggeunmiso-Bold': require('@/assets/fonts/Hakgyoansim-Dunggeunmiso-B.otf'), // 파일 이름에 띄어쓰기가 있으면 웹에서 404
  'Cafe24-Ssurround-Air': require('@/assets/fonts/Cafe24SsurroundAir-v1.1.ttf'),
};
type Family = keyof typeof FONT_FILES;

const weightOf = (w: TextStyle['fontWeight']) => (w === 'bold' ? 700 : w === 'normal' ? 400 : Number(w) || 400);

function familyOf(size: number, weight: number): Family {
  return size >= 20 || weight >= 700 ? 'Hakgyoansim-Dunggeunmiso-Bold' : 'Cafe24-Ssurround-Air';
}

// 중첩된 Text는 바깥 글자 크기·굵기를 이어받아 같은 기준으로 글꼴을 선택함.
const Inherited = createContext({ size: 14, weight: 400 });

function pick(style: TextProps['style'], inherited: { size: number; weight: number }) {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const size = flat.fontSize ?? inherited.size;
  const weight = flat.fontWeight != null ? weightOf(flat.fontWeight) : inherited.weight;
  return { family: flat.fontFamily ?? familyOf(size, weight), inherit: { size, weight } };
}

// 웹: 한국어가 글자 중간에서 줄이 바뀌지 않게 단어 단위로 (앱은 원래 단어 단위). overflowWrap 'anywhere' 는 쓰지 말 것 — 글자 칸이 한 글자 폭으로 줄어 세로로 쌓임
const WEB_WRAP = (Platform.OS === 'web' ? { wordBreak: 'keep-all', overflowWrap: 'break-word' } : {}) as TextStyle;

export function Text({ style, ...rest }: ComponentProps<typeof RNText>) {
  const inherited = useContext(Inherited);
  const { family, inherit } = pick(style, inherited);
  return (
    <Inherited.Provider value={inherit}>
      <RNText style={[WEB_WRAP, style, { fontFamily: family, fontWeight: 'normal' }]} {...rest} />
    </Inherited.Provider>
  );
}

/** useRef 타입용 (react-native TextInput 의 ref 와 같음) */
export type TextInputRef = ComponentRef<typeof RNTextInput>;

export function TextInput({ style, ...rest }: ComponentProps<typeof RNTextInput>) {
  const { family } = pick(style as TextProps['style'], { size: 14, weight: 400 });
  return <RNTextInput style={[style, { fontFamily: family, fontWeight: 'normal' }]} {...rest} />;
}

export const AnimatedText = Animated.createAnimatedComponent(Text);
