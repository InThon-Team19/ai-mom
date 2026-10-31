// 공용 UI — 민철 디자인(Design 아티팩트) 스타일: 크림 바탕 · 노랑 버튼 · 2px 테두리 카드 · 단순한 SVG 아이콘. 담당: 태희
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { C, R, T } from '@/theme';
import { useDevice } from '@/lib/layout';
import { goBack, prevOf } from '@/lib/nav';

type BtnProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Button({ label, onPress, variant = 'primary', disabled, style, textStyle }: BtnProps) {
  const primary = variant === 'primary';
  const ghost = variant === 'ghost';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          // 디자인 온보딩 버튼: 높이 56 · 모서리 14 · 노랑 채움 / 글자 링크는 높이 44
          minHeight: ghost ? 44 : 56,
          paddingHorizontal: 20,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? C.primary : ghost ? 'transparent' : C.white,
          borderWidth: variant === 'outline' ? 2 : 0,
          borderColor: C.border,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}>
      <Text style={[{ fontSize: ghost ? 15 : 17, fontWeight: '700', textAlign: 'center', color: primary ? C.onPrimary : ghost ? C.link : C.text }, textStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 선택 칩 (온보딩): 선택 안 됨 1px 연한 테두리, 선택 2px 노랑. small = 디자인의 작은 알약(13px) */
export function Chip({ label, selected, onPress, small, dashed }: { label: string; selected?: boolean; onPress?: () => void; small?: boolean; dashed?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      hitSlop={small ? 4 : 0}
      style={{
        paddingHorizontal: small ? 12 : 14,
        minHeight: small ? 34 : 40,
        justifyContent: 'center',
        borderRadius: R.pill,
        borderWidth: selected ? 2 : 1,
        borderStyle: dashed && !selected ? 'dashed' : 'solid',
        borderColor: selected ? C.primaryStrong : dashed ? C.muted : C.border,
        backgroundColor: selected ? C.primarySoft : C.white,
      }}>
      <Text style={{ fontSize: small ? 13 : 14, fontWeight: selected ? '700' : '400', color: C.text }}>{label}</Text>
    </Pressable>
  );
}

/** 입력칸 공통 모양 (디자인: 흰 바탕 · 1px 연한 테두리 · 모서리 12) */
export const fieldStyle = {
  minHeight: 52,
  borderWidth: 1,
  borderColor: C.border,
  borderRadius: 12,
  paddingHorizontal: 14,
  fontSize: 17,
  backgroundColor: C.white,
  color: C.text,
} as const;

/** 안내 상자 (디자인: 연한 크림 바탕 · 작은 갈색 글자) */
export function Note({ children, tone = 'cream', style }: { children: ReactNode; tone?: 'cream' | 'green'; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: tone === 'green' ? C.greenSoft : C.card }, style]}>
      {typeof children === 'string' ? <Text style={{ fontSize: 13, lineHeight: 21, color: tone === 'green' ? C.text : C.sub }}>{children}</Text> : children}
    </View>
  );
}

export function Card({ children, style, soft, dashed }: { children: ReactNode; style?: StyleProp<ViewStyle>; soft?: boolean; dashed?: boolean }) {
  return (
    <View
      style={[
        {
          padding: 16,
          borderRadius: R.md,
          backgroundColor: soft ? C.primarySoft : dashed ? C.white : C.card,
          borderWidth: soft ? 2 : dashed ? 1.5 : 0,
          borderStyle: dashed ? 'dashed' : 'solid',
          borderColor: soft ? C.primaryStrong : C.text,
          gap: 8,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

export const H1 = ({ children }: { children: ReactNode }) => <Text style={T.h1}>{children}</Text>;
export const Sub = ({ children }: { children: ReactNode }) => <Text style={T.sub}>{children}</Text>;

/** 온보딩 7단계 공통 틀: 뒤로가기 · n/7 · 진행 막대 · 제목 · 설명 · 본문 · 하단 버튼 */
export function OnboardingScaffold({
  step,
  title,
  subtitle,
  children,
  footer,
  scroll = true,
  titleSize = 26,
  titleRight,
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  titleSize?: number; // 디자인: 보드마다 24 / 26
  titleRight?: ReactNode; // 제목 오른쪽 (입모양 화면의 학습률 링)
}) {
  const { frame } = useDevice();
  const head = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[T.h1, { fontSize: titleSize }]}>{title}</Text>
        {!!subtitle && <Text style={{ fontSize: titleSize >= 26 ? 14 : 13, lineHeight: 20, color: C.sub }}>{subtitle}</Text>}
      </View>
      {titleRight}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[{ paddingHorizontal: 24, paddingTop: 8, gap: 10 }, frame]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 }}>
          <Pressable onPress={() => goBack(prevOf(step))} hitSlop={8} accessibilityLabel="뒤로" style={{ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 28, color: C.text }}>‹</Text>
          </Pressable>
          <Text style={T.small}>
            {step} / 7
          </Text>
        </View>
        <View style={{ height: 4, backgroundColor: C.track, borderRadius: 2 }}>
          <View style={{ width: `${(step / 7) * 100}%`, height: 4, backgroundColor: C.primary, borderRadius: 2 }} />
        </View>
      </View>
      {/* iOS 는 키보드가 화면을 줄이지 않아 아래 입력칸·다음 버튼이 가려짐 → padding (Android 는 창이 줄어듦) */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, gap: 14 }, frame]} keyboardShouldPersistTaps="handled">
          {head}
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, paddingHorizontal: 24, paddingTop: 16, gap: 14 }, frame]}>
          {head}
          {children}
        </View>
      )}
      {!!footer && <View style={[{ paddingHorizontal: 24, paddingBottom: 20, paddingTop: 8 }, frame]}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** 마이크 SVG (디자인 공통: 둥근 막대 + 받침) */
export function MicIcon({ color = C.text, size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={9} y={3} width={6} height={11} rx={3} stroke={color} strokeWidth={2} fill="none" />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** 빨간 점 (촬영·읽기 시작) */
export const RecDot = ({ size = 14 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 14 14">
    <Circle cx={7} cy={7} r={6} fill="#E8584F" />
  </Svg>
);

/** 마이크 원형 버튼 (녹음 중이면 빨강 + 흰 네모). shadow = 부모 앱 두툼한 버튼 */
export function MicButton({ recording, onPress, size = 76, disabled, shadow }: { recording?: boolean; onPress?: () => void; size?: number; disabled?: boolean; shadow?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={recording ? '녹음 멈추기' : '녹음 시작'}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: recording ? '#E5484D' : C.primary,
        borderBottomWidth: shadow ? 4 : 0,
        borderBottomColor: recording ? '#B4282D' : C.primaryDeep,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : 1,
        transform: [{ translateY: pressed && shadow ? 2 : 0 }],
      })}>
      {recording ? <View style={{ width: size * 0.3, height: size * 0.3, borderRadius: 4, backgroundColor: C.white }} /> : <MicIcon size={size * 0.4} />}
    </Pressable>
  );
}

// ---------- 그림 (디자인 보드의 단순한 SVG — 이모지 대신) ----------

export type ArtName = 'apple' | 'banana' | 'snack' | 'story' | 'smile' | 'eye' | 'hand' | 'ear' | 'talk' | 'repeat' | 'clock' | 'sprout';

/** 사물·감각 그림. 커리큘럼 사물 id(apple·banana·snack)와 감각 아이콘을 같은 크기로 */
export function Art({ name, size = 34 }: { name: ArtName; size?: number }) {
  const line = { stroke: C.text, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'apple':
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48">
          <Path d="M24 15 C18 9 7 11 7 23 C7 34 15 43 20 43 C22 43 23 42 24 42 C25 42 26 43 28 43 C33 43 41 34 41 23 C41 11 30 9 24 15 Z" fill="#E8584F" />
          <Path d="M24 15 C24 11 25 8 27 5" stroke="#6B4A2B" strokeWidth={2.5} fill="none" strokeLinecap="round" />
          <Path d="M26 10 C29 5 35 5 37 7 C34 11 29 11 26 10 Z" fill="#7FB83A" />
        </Svg>
      );
    case 'banana':
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48">
          <Path d="M11 13 C12 30 24 41 41 37 C43 36.5 43 33.5 41 33.5 C28 34 18 26 15.5 12.5 C15 10 11.2 10.5 11 13 Z" fill="#FFD54F" stroke="#C99700" strokeWidth={2} strokeLinejoin="round" />
          <Path d="M11.5 12 L10.5 8" stroke="#6B4A2B" strokeWidth={3} strokeLinecap="round" />
        </Svg>
      );
    case 'snack':
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48">
          <Circle cx={24} cy={24} r={17} fill="#D9A25B" stroke="#A8702E" strokeWidth={2} />
          <Circle cx={18} cy={19} r={2.4} fill="#6B4426" />
          <Circle cx={29} cy={17} r={2.2} fill="#6B4426" />
          <Circle cx={30} cy={29} r={2.4} fill="#6B4426" />
          <Circle cx={19} cy={30} r={2} fill="#6B4426" />
        </Svg>
      );
    case 'story':
      return (
        <Svg width={size} height={size} viewBox="0 0 48 48">
          <Path d="M17 3v4M17 27v4M3 17h4M27 17h4M7 7l3 3M7 27l3-3M27 7l-3 3" stroke="#E0A800" strokeWidth={2.5} strokeLinecap="round" fill="none" />
          <Circle cx={17} cy={17} r={7} fill="#F2B705" />
          <Circle cx={34} cy={34} r={10} fill="#7C6BC4" />
          <Circle cx={38.5} cy={30.5} r={8.5} fill={C.card} />
        </Svg>
      );
    case 'smile':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={9} fill={C.primary} stroke={C.text} strokeWidth={1.8} />
          <Circle cx={9} cy={10} r={1.2} fill={C.text} />
          <Circle cx={15} cy={10} r={1.2} fill={C.text} />
          <Path d="M8.5 14 Q12 17.5 15.5 14" stroke={C.text} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        </Svg>
      );
    case 'eye':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M2.5 12 C5 7 8.5 5 12 5 C15.5 5 19 7 21.5 12 C19 17 15.5 19 12 19 C8.5 19 5 17 2.5 12 Z" {...line} strokeWidth={1.8} />
          <Circle cx={12} cy={12} r={3.2} fill={C.text} />
        </Svg>
      );
    case 'hand':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4.5a1.5 1.5 0 0 1 3 0V11M14 10.5V6a1.5 1.5 0 0 1 3 0v7c0 4.5-2.5 8-7 8-3 0-4.5-1.5-6-4l-1.5-2.8a1.4 1.4 0 0 1 2.3-1.5L8 14" {...line} strokeWidth={1.8} />
        </Svg>
      );
    case 'ear':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M7 9a5 5 0 0 1 10 0c0 3-2.5 4-3 6.5-.4 2-1.6 4.5-4 4.5a3 3 0 0 1-3-3" {...line} strokeWidth={1.8} />
          <Path d="M10 9.5a2 2 0 0 1 4 0c0 1.3-1.2 1.8-1.5 3" {...line} strokeWidth={1.8} />
        </Svg>
      );
    case 'talk':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" {...line} strokeWidth={1.8} />
          <Path d="M8 10.5h.01M12 10.5h.01M16 10.5h.01" {...line} strokeWidth={2.6} />
        </Svg>
      );
    case 'repeat':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M20 12a8 8 0 1 1-2.34-5.66" {...line} strokeWidth={2} />
          <Path d="M20 4v5h-5" {...line} strokeWidth={2} />
        </Svg>
      );
    case 'clock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={9} {...line} strokeWidth={2} />
          <Path d="M12 7v5l3 2" {...line} strokeWidth={2} />
        </Svg>
      );
    case 'sprout':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 21v-9" stroke="#5E8C1F" strokeWidth={2} strokeLinecap="round" />
          <Path d="M12 13C12 8 8.5 6 4 6c0 4.5 3 7 8 7z" fill={C.green} />
          <Path d="M12 11c0-4 3-6.5 8-6.5 0 4-3 6.5-8 6.5z" fill={C.green} />
          <Ellipse cx={12} cy={21} rx={5} ry={1.4} fill={C.track} />
        </Svg>
      );
  }
}

/** 서버 단어·사물 id → 그림 이름 (모르는 것은 null) */
export const artOf = (id?: string | null): ArtName | null => (id === 'apple' || id === 'banana' || id === 'snack' ? id : null);

/** 디자인 Main 보드의 사과 (아바타가 건네는 장면) */
export const BigApple = ({ size = 64 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 64 64">
    <Circle cx={32} cy={36} r={24} fill="#E8584F" />
    <Path d="M32 14 Q36 6 44 6" stroke="#6b4a2f" strokeWidth={4} fill="none" strokeLinecap="round" />
    <Ellipse cx={42} cy={14} rx={8} ry={4} fill="#8BC34A" />
  </Svg>
);

/** 켜고 끄기 (디자인: 44×26 둥근 막대, 켜면 연두) */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      hitSlop={10}
      style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: value ? C.green : C.border, padding: 3, alignItems: value ? 'flex-end' : 'flex-start' }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.white }} />
    </Pressable>
  );
}

/** 온보딩 문장 줄 (디자인 Voice·Mouth·Plan): 읽음 = 크림 바탕, 지금 = 노랑 테두리 큰 글자, 남음 = 얇은 테두리 */
export function SentenceLine({ text, state, right, onPress, disabled }: { text: ReactNode; state: 'done' | 'now' | 'todo' | 'retry'; right?: string; onPress?: () => void; disabled?: boolean }) {
  const now = state === 'now' || state === 'retry';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: now ? 14 : 11,
        borderRadius: 12,
        borderWidth: now ? 2 : state === 'todo' ? 1 : 0,
        borderColor: now ? C.primaryStrong : C.border,
        backgroundColor: now ? C.primarySoft : state === 'done' ? C.card : 'transparent',
      }}>
      <Text style={{ flex: 1, fontSize: now ? 18 : 14, fontWeight: now ? '800' : '400', lineHeight: now ? 26 : 20, color: state === 'todo' ? C.sub : C.text }}>{text}</Text>
      {!!right && (
        <Text style={{ fontSize: 13, fontWeight: state === 'retry' ? '700' : '400', color: state === 'done' ? C.ok : state === 'retry' ? C.warn : now ? C.text : C.sub }}>{right}</Text>
      )}
    </Pressable>
  );
}

// ---------- 부모 앱 (민철 디자인): 두툼한 카드 · 아래 그림자 있는 노랑 버튼 ----------

/** 흰 바탕 + 2px 테두리 + 아래 4px (부모 앱 카드) */
export function Panel({ children, style, tone = 'white' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'white' | 'yellow' }) {
  return (
    <View
      style={[
        {
          padding: 14,
          borderRadius: 18,
          borderWidth: 2,
          borderBottomWidth: 4,
          borderColor: tone === 'yellow' ? C.primaryStrong : C.border,
          backgroundColor: tone === 'yellow' ? C.primarySoft : C.white,
          gap: 10,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/** 부모 앱 큰 버튼: primary = 노랑 + 진한 아래 그림자, outline = 흰 바탕 두툼한 테두리 */
export function BigButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  icon,
  style,
  small,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline';
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          minHeight: small ? 44 : 52,
          paddingHorizontal: small ? 16 : 20,
          borderRadius: small ? 14 : 16,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? C.primary : C.white,
          borderWidth: primary ? 0 : 2,
          borderColor: C.border,
          borderBottomWidth: 4,
          borderBottomColor: primary ? C.primaryDeep : C.border,
          opacity: disabled ? 0.45 : 1,
          transform: [{ translateY: pressed && !disabled ? 2 : 0 }],
        },
        style,
      ]}>
      {icon}
      <Text style={{ flexShrink: 1, textAlign: 'center', fontSize: small ? 14 : 16, fontWeight: '800', color: C.text }}>{label}</Text>
    </Pressable>
  );
}

/** 선택 칩 (부모 앱): 2px 테두리, 선택되면 노랑 */
export function PillChip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 44,
        paddingHorizontal: 14,
        borderRadius: R.pill,
        borderWidth: 2,
        borderColor: selected ? C.primaryStrong : C.border,
        backgroundColor: selected ? C.primarySoft : C.white,
      }}>
      {icon}
      <Text style={{ flexShrink: 1, fontSize: 14, fontWeight: selected ? '700' : '500', color: C.text }}>{label}</Text>
    </Pressable>
  );
}

/** 탭 밖 화면 머리: ‹ 뒤로 + 제목 */
export function BackHeader({ title, onBack, backLabel }: { title: string; onBack: () => void; backLabel: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        hitSlop={8}
        style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 30, color: C.text }}>‹</Text>
      </Pressable>
      <Text style={{ flex: 1, fontSize: 22, fontWeight: '900', color: C.text }}>{title}</Text>
    </View>
  );
}

/** 말풍선 (왼쪽 꼬리) — 아바타 옆 */
export function Bubble({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flex: 1, justifyContent: 'center' }, style]}>
      <View
        style={{
          position: 'absolute',
          left: -7,
          top: '50%',
          marginTop: -8,
          width: 14,
          height: 14,
          backgroundColor: C.white,
          borderLeftWidth: 2,
          borderBottomWidth: 2,
          borderColor: C.border,
          transform: [{ rotate: '45deg' }],
          zIndex: 1,
        }}
      />
      <View style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 2, borderBottomWidth: 4, borderColor: C.border, backgroundColor: C.white }}>
        {children}
      </View>
    </View>
  );
}
