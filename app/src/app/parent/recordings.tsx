// 부모 앱 아이 녹음 기록 (민철 디자인 Recordings, 탭 막대에는 없음 — 리포트에서 들어옴): 오늘 자동 녹음된 아이 말소리 + 확인해 주세요 — 담당: 태희
import { useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChecksBox } from '@/components/ChecksBox';
import { ClipList } from '@/components/ClipList';
import { BackHeader } from '@/components/ui';
import { dayOf } from '@/content/curriculum';
import { api } from '@/lib/api';
import { useDevice } from '@/lib/layout';
import { goBack } from '@/lib/nav';
import { today as todayYmd, named } from '@/lib/progress';
import { useProfile } from '@/lib/store';
import type { ChildClip, Summary } from '@/lib/types';
import { C, T } from '@/theme';
import { Text } from '@/components/AppText';

export default function Recordings() {
  const profile = useProfile();
  const childId = profile?.childId;
  const { frame } = useDevice();
  const [clips, setClips] = useState<ChildClip[]>([]);
  const [clipState, setClipState] = useState<'loading' | 'ok' | 'fail'>('loading');
  const [summary, setSummary] = useState<Summary | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!childId) return;
      let alive = true;
      api
        .childClips(childId, todayYmd())
        .then((cs) => {
          if (!alive) return;
          setClips([...cs].sort((a, b) => b.at - a.at));
          setClipState('ok');
        })
        .catch(() => {
          if (alive) setClipState('fail');
        });
      api
        .summary(childId)
        .then((s) => {
          if (alive) setSummary(s);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [childId]),
  );

  const name = profile?.child.nickname || profile?.child.name || '아이';
  const d = new Date();
  const day = dayOf(profile?.day ?? 1).day;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={[{ padding: 20, gap: 14, paddingBottom: 32 }, frame]}>
        <BackHeader title="아이 녹음 기록" backLabel="리포트로 돌아가기" onBack={() => goBack('/parent/report' as Href)} />
        <Text style={{ fontSize: 13, color: C.sub }}>
          {named(name, '가')} 말한 순간 자동으로 녹음돼요. ✓는 따라 말한 단어와 비슷했다는 뜻이에요.
        </Text>
        <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>
          {d.getMonth() + 1}월 {d.getDate()}일 · {day}일차
        </Text>
        {childId ? <ClipList childId={childId} clips={clips} state={clipState} /> : <Text style={T.sub}>오늘 녹음된 목소리가 없어요</Text>}
        <ChecksBox summary={summary} name={name} />
      </ScrollView>
    </SafeAreaView>
  );
}
