// 부모 앱 2-1 홈: 오늘 밤 할 일 · 오늘/내일 주제 · 확인 필요 · 아바타 학습률 — 담당: 태희 (민철 와이어프레임 기준)
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RingGauge } from '@/components/RingGauge';
import { Button, Card, H1 } from '@/components/ui';
import { DAYS, dayOf } from '@/content/curriculum';
import { headline, wordStatus } from '@/lib/progress';
import { api } from '@/lib/api';
import { useProfile } from '@/lib/store';
import type { Gauge, Summary } from '@/lib/types';
import { C, T } from '@/theme';

export default function ParentHome() {
  const profile = useProfile();
  const childId = profile?.childId;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null); // null = 확인 중
  const [voice, setVoice] = useState<Gauge | null>(null);
  const [mouth, setMouth] = useState<Gauge | null>(null);

  // 탭에 들어올 때마다 새로고침 (낭독 후 학습률, 낮 동안 쌓인 기록)
  useFocusEffect(
    useCallback(() => {
      if (!childId) return;
      let alive = true;
      api
        .summary(childId)
        .then((s) => {
          if (!alive) return;
          setSummary(s);
          setLinked(true);
        })
        .catch(() => {
          if (!alive) return;
          setSummary(null);
          setLinked(false);
        });
      api.voiceGauge(childId).then((g) => { if (alive) setVoice(g); }).catch(() => {});
      api.mouthGauge(childId).then((g) => { if (alive) setMouth(g); }).catch(() => {});
      return () => {
        alive = false;
      };
    }, [childId]),
  );

  const name = profile?.child.nickname || profile?.child.name || '우리 아이';
  const dayNum = profile?.day ?? 1;
  const today = dayOf(dayNum);
  const tomorrowNum = Math.min(dayNum + 1, DAYS.length);
  const tomorrow = dayOf(tomorrowNum);
  const alerts = summary?.alerts.length ?? 0;
  const outOfScope = summary?.out_of_scope.length ?? 0;
  const checks = alerts + outOfScope;

  const go = (tab: 'report' | 'feedback' | 'plan') => router.navigate(`/parent/${tab}` as Href);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <View style={{ gap: 6 }}>
          <H1>{name}의 오늘</H1>
          {/* 기획 2-5: 맨 위 정보는 오늘의 일차와 주제 한 줄 */}
          <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>
            오늘은 {today.day}일차, {today.topic}
          </Text>
          <Text style={T.sub}>{headline(wordStatus(today.day, summary))}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: linked ? C.primary : C.muted }} />
            <Text style={T.sub}>
              {linked === null ? '연결 확인 중...' : linked ? `태블릿 연결됨 · 오늘 대화 ${summary?.sessions ?? 0}번` : '태블릿 연결 대기'}
            </Text>
          </View>
        </View>

        <Card soft style={{ gap: 10 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.link }}>오늘 밤 할 일</Text>
          {['오늘의 리포트 보기', '피드백 남기기', '내일 계획 읽기'].map((t, i) => (
            <Pressable key={t} onPress={() => go((['report', 'feedback', 'plan'] as const)[i])}>
              <Text style={T.body}>
                {i + 1}. {t}
              </Text>
            </Pressable>
          ))}
          <Button label="리포트 보기" onPress={() => go('report')} style={{ marginTop: 6 }} />
        </Card>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Card style={{ flex: 1, gap: 2 }}>
            <Text style={T.sub}>오늘 · {today.day}일차</Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{today.topic}</Text>
          </Card>
          <Card style={{ flex: 1, gap: 2 }}>
            <Text style={T.sub}>
              내일 · {tomorrow.day}일차{tomorrowNum === dayNum ? ' (마지막)' : ''}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{tomorrow.topic}</Text>
            <Text style={T.small}>
              {profile?.readingDone ? '낭독 완료 · 내일 아침 시작' : '오늘 밤 낭독하면 넘어가요'}
            </Text>
          </Card>
        </View>

        <Pressable onPress={() => go('report')}>
          <Card dashed style={[{ flexDirection: 'row', alignItems: 'center' }, alerts > 0 && { borderColor: C.warn }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: alerts > 0 ? C.warn : C.text }}>확인 필요 {checks}건</Text>
              <Text style={T.sub}>
                {alerts > 0
                  ? `아이가 불편함을 말한 순간이 ${alerts}번 있었어요. 꼭 확인해 주세요.`
                  : outOfScope > 0
                    ? '범위 밖 질문이 있었어요.'
                    : summary
                      ? '오늘은 확인할 일이 없어요.'
                      : '대화 기록이 생기면 여기에 알려드려요.'}
              </Text>
            </View>
            <Text style={{ fontSize: 24, color: C.text }}>›</Text>
          </Card>
        </Pressable>

        <Card style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.border, gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>내 아바타 학습률</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <RingGauge progress={voice?.progress ?? 0} baseline={voice?.baseline ?? 0.5} size={100} label="음성" />
            <RingGauge progress={mouth?.progress ?? 0} baseline={mouth?.baseline ?? 0.5} size={100} label="입모양" />
          </View>
          <Text style={[T.small, { textAlign: 'center' }]}>검은 눈금이 최소 기준이에요. 계획을 읽을수록 올라가요.</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
