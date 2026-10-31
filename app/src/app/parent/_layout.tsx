// 부모 앱 2-x 하단 탭 5개 (홈 · 리포트 · 피드백 · 아바타 · 설정) + 탭 밖 화면 내일 계획(plan, 피드백에서) · 아이 녹음 기록(recordings, 리포트에서) — 담당: 태희 (민철 와이어프레임 기준)
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { registerThisDevice } from '@/lib/device';
import { router, type Href } from 'expo-router';

import { logoutAccount } from '@/lib/account';
import { api } from '@/lib/api';
import { dayAdvancePatch } from '@/lib/progress';
import { loadProfile, refreshProfile, updateProfile, type Profile } from '@/lib/store';
import { C } from '@/theme';

type IconProps = { color: ColorValue; size: number };
const stroke = (color: ColorValue) => ({ stroke: color as string, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' });

const HomeIcon = ({ color, size }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" {...stroke(color)} />
  </Svg>
);
const ReportIcon = ({ color, size }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M6 20v-7M12 20V5M18 20v-10" {...stroke(color)} />
  </Svg>
);
const PenIcon = ({ color, size }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 20l1-4L16 5l3 3L8 19z M14 7l3 3" {...stroke(color)} />
  </Svg>
);
/** 아바타 탭: 둥근 얼굴 + 어깨 (다른 아이콘과 같은 선 굵기) */
const AvatarIcon = ({ color, size }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={9} r={5} {...stroke(color)} />
    <Path d="M10 9.5h.01M14 9.5h.01M10.5 11.5q1.5 1 3 0" {...stroke(color)} />
    <Path d="M4 21c1.2-3.6 4.3-5.5 8-5.5s6.8 1.9 8 5.5" {...stroke(color)} />
  </Svg>
);

const GearIcon = ({ color, size }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx={12} cy={12} r={3} {...stroke(color)} />
    <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" {...stroke(color)} />
  </Svg>
);

export default function ParentTabs() {
  // 이 기기를 부모 폰으로 등록 (모드를 바꿨다 돌아온 경우·이전에 가입한 기기 포함)
  useEffect(() => {
    (async () => {
      const p = await loadProfile();
      if (!p.onboarded) return;
      let remote: Partial<Profile> | null = null;
      try {
        remote = (await api.getProfile(p.childId)) as Partial<Profile>;
      } catch (e) {
        // 비밀번호를 바꾸는 등으로 서버가 토큰을 끊었으면 다시 로그인
        if (String(e).includes('401')) {
          await logoutAccount();
          router.replace('/onboarding/login' as Href);
          return;
        }
      }
      registerThisDevice(p.childId, 'parent');
      // 기획 2-7: 낭독 다음날이면 일차 +1 을 서버에 저장 (태블릿은 저장 권한이 없어 부모 앱이 맡음). 서버 원본 기준으로 판단
      const adv = remote ? dayAdvancePatch({ ...p, ...remote } as Profile) : null;
      if (adv) await updateProfile(adv);
      else refreshProfile();
    })();
  }, []);

  return (
    <Tabs
      // 숨긴 화면(내일 계획·녹음 기록)에서 뒤로 가면 들어온 탭으로 돌아가게
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.link,
        tabBarInactiveTintColor: C.text,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        sceneStyle: { backgroundColor: C.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: '홈', tabBarIcon: (p) => <HomeIcon color={p.color} size={22} /> }} />
      <Tabs.Screen name="report" options={{ title: '리포트', tabBarIcon: (p) => <ReportIcon color={p.color} size={22} /> }} />
      <Tabs.Screen name="feedback" options={{ title: '피드백', tabBarIcon: (p) => <PenIcon color={p.color} size={22} /> }} />
      <Tabs.Screen name="avatar" options={{ title: '아바타', tabBarIcon: (p) => <AvatarIcon color={p.color} size={22} /> }} />
      <Tabs.Screen name="settings" options={{ title: '설정', tabBarIcon: (p) => <GearIcon color={p.color} size={22} /> }} />
      {/* 내일 계획 낭독: 탭 막대에는 숨기고 피드백 '낭독하기'에서 들어감 */}
      <Tabs.Screen name="plan" options={{ href: null, title: '내일 계획' }} />
      {/* 아이 녹음 기록: 리포트 아래 버튼에서 들어감 */}
      <Tabs.Screen name="recordings" options={{ href: null, title: '아이 녹음 기록' }} />
    </Tabs>
  );
}
