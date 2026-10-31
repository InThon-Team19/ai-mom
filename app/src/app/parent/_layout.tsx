// 부모 앱 2-x 하단 탭 5개 (홈 · 리포트 · 피드백 · 아바타 · 설정) + 탭 밖 화면 내일 계획(plan, 피드백에서) · 아이 녹음 기록(recordings, 리포트에서) — 담당: 태희 (민철 와이어프레임 기준)
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { registerThisDevice } from '@/lib/device';
import { router, type Href } from 'expo-router';

import { logoutAccount } from '@/lib/account';
import { api } from '@/lib/api';
import { dayAdvancePatch } from '@/lib/progress';
import { loadProfile, refreshProfile, updateProfile, type Profile } from '@/lib/store';
import { C } from '@/theme';

/** 탭 글자 (디자인: 12~13px, 지금 탭만 굵게) */
const TabLabel = ({ focused, text }: { focused: boolean; text: string }) => (
  <Text style={{ fontSize: 13, fontWeight: focused ? '800' : '500', color: focused ? C.text : C.sub }}>{text}</Text>
);

export default function ParentTabs() {
  const insets = useSafeAreaInsets();
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
      // 디자인 nav: 아이콘 없이 글자만 · 흰 바탕 · 위 1px 연한 선 · 높이 64 · 지금 탭은 진한 갈색 굵게, 나머지는 연한 갈색
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.text,
        tabBarInactiveTintColor: C.sub,
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: { fontSize: 13, fontWeight: '500', marginTop: 0 },
        tabBarItemStyle: { justifyContent: 'center', alignItems: 'center' },
        tabBarStyle: { height: 64 + insets.bottom, paddingBottom: insets.bottom, paddingTop: 0, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, elevation: 0, shadowOpacity: 0 },
        sceneStyle: { backgroundColor: C.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: '홈', tabBarLabel: (p) => <TabLabel focused={p.focused} text="홈" /> }} />
      <Tabs.Screen name="report" options={{ title: '리포트', tabBarLabel: (p) => <TabLabel focused={p.focused} text="리포트" /> }} />
      <Tabs.Screen name="feedback" options={{ title: '피드백', tabBarLabel: (p) => <TabLabel focused={p.focused} text="피드백" /> }} />
      <Tabs.Screen name="avatar" options={{ title: '아바타', tabBarLabel: (p) => <TabLabel focused={p.focused} text="아바타" /> }} />
      <Tabs.Screen name="settings" options={{ title: '설정', tabBarLabel: (p) => <TabLabel focused={p.focused} text="설정" /> }} />
      {/* 내일 계획 낭독: 탭 막대에는 숨기고 피드백 '낭독하기'에서 들어감 */}
      <Tabs.Screen name="plan" options={{ href: null, title: '내일 계획' }} />
      {/* 아이 녹음 기록: 리포트 아래 버튼에서 들어감 */}
      <Tabs.Screen name="recordings" options={{ href: null, title: '아이 녹음 기록' }} />
    </Tabs>
  );
}
