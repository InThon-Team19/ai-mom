// 공용 UI — 와이어프레임 스타일 (파란 주색, 회색 카드, 둥근 모서리). 담당: 태희
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C, R, T } from '@/theme';

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
      <Text style={[{ fontSize: 17, fontWeight: '700', color: primary ? C.white : variant === 'ghost' ? C.primary : C.text }, textStyle]}>
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
        borderColor: selected ? C.primary : C.border,
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
          borderColor: soft ? C.primary : C.text,
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
  const head = (
    <View style={{ gap: 6 }}>
      <H1>{title}</H1>
      {!!subtitle && <Sub>{subtitle}</Sub>}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ paddingHorizontal: 24, paddingTop: 8, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 40 }}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="뒤로">
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
      {scroll ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, gap: 16 }}>
          {head}
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: 24, gap: 16 }}>
          {head}
          {children}
        </View>
      )}
      {!!footer && <View style={{ padding: 24, paddingTop: 8 }}>{footer}</View>}
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
      <Text style={{ fontSize: size * 0.4, color: C.white }}>{recording ? '■' : '🎤'}</Text>
    </Pressable>
  );
}
