// 공용 UI — 와이어프레임 스타일 (파란 주색, 회색 카드, 둥근 모서리). 담당: 태희
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          minHeight: 52,
          paddingHorizontal: 20,
          borderRadius: R.sm,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? C.primary : C.white,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          borderColor: C.text,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}>
      <Text style={[{ fontSize: 17, fontWeight: '700', textAlign: 'center', color: primary ? C.onPrimary : variant === 'ghost' ? C.link : C.text }, textStyle]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** 선택 칩 (말투, 호칭, 카테고리 탭 등) */
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 16,
        minHeight: 42,
        justifyContent: 'center',
        borderRadius: R.pill,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? C.primaryStrong : C.border,
        backgroundColor: selected ? C.primarySoft : C.white,
      }}>
      <Text style={{ fontSize: 15, fontWeight: selected ? '700' : '500', color: C.text }}>{label}</Text>
    </Pressable>
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
}: {
  step: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
}) {
  const { frame } = useDevice();
  const head = (
    <View style={{ gap: 6 }}>
      <H1>{title}</H1>
      {!!subtitle && <Sub>{subtitle}</Sub>}
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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[{ padding: 24, gap: 16 }, frame]} keyboardShouldPersistTaps="handled">
          {head}
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, padding: 24, gap: 16 }, frame]}>
          {head}
          {children}
        </View>
      )}
      {!!footer && <View style={[{ padding: 24, paddingTop: 8 }, frame]}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** 마이크 원형 버튼 (녹음 중이면 빨강) */
export function MicButton({ recording, onPress, size = 76 }: { recording?: boolean; onPress?: () => void; size?: number }) {
  return (
    <Pressable
      accessibilityLabel={recording ? '녹음 멈추기' : '녹음 시작'}
      onPress={onPress}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: recording ? '#E5484D' : C.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontSize: size * 0.4, color: C.onPrimary }}>{recording ? '■' : '🎤'}</Text>
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
