// 부모 앱 2-2 리포트: 대화 기록 대신 요약 (주제 · 따라 말한 단어 · 집중도 · 감각 균형 · 언어 연계 팁 · 확인 필요) — 담당: 태희 (민철 와이어프레임 기준)
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, H1 } from '@/components/ui';
import { ITEMS, dayOf, type Item } from '@/content/curriculum';
import { api } from '@/lib/api';
import { useProfile } from '@/lib/store';
import type { Summary } from '@/lib/types';
import { C, R, T } from '@/theme';

const SENSES = [
  { key: 'visual', label: '시각 (입모양·그림)', short: '시각' },
  { key: 'audio', label: '청각 (말·소리)', short: '청각' },
  { key: 'touch', label: '촉각 (터치·진동)', short: '촉각' },
] as const;

const itemList = Object.values(ITEMS);
/** 서버가 주는 단어/사물(한글·영어·id)을 커리큘럼 사물로 매칭 */
const findItem = (w: string): Item | undefined => {
  const k = w.trim().toLowerCase();
  return itemList.find((it) => it.id === k || it.ko === k || it.en.toLowerCase() === k);
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
const duration = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}분 ${s % 60}초` : `${s}초`;
};

/** 흰 바탕 테두리 카드 (와이어프레임 감각 균형 카드) */
const Box = ({ children }: { children: ReactNode }) => (
  <Card style={{ backgroundColor: C.white, borderWidth: 1, borderColor: C.border, gap: 10 }}>{children}</Card>
);

const Tag = ({ label }: { label: string }) => (
  <View style={{ backgroundColor: C.white, borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
    <Text style={{ fontSize: 14, color: C.text }}>{label}</Text>
  </View>
);

const Title = ({ children }: { children: ReactNode }) => (
  <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>{children}</Text>
);

export default function Report() {
  const profile = useProfile();
  const childId = profile?.childId;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading');

  useFocusEffect(
    useCallback(() => {
      if (!childId) return;
      let alive = true;
      api
        .summary(childId)
        .then((s) => {
          if (!alive) return;
          setSummary(s);
          setState('ok');
        })
        .catch(() => {
          if (alive) setState('fail');
        });
      return () => {
        alive = false;
      };
    }, [childId]),
  );

  const name = profile?.child.nickname || profile?.child.name || '아이';
  const today = dayOf(profile?.day ?? 1);
  const s = summary;
  const hasData = !!s && (s.sessions > 0 || s.touches > 0 || s.words.length > 0 || s.gaze_s > 0);

  // 감각 균형: 한쪽이 60% 넘으면 부드럽게 알려줌
  const skewed = s ? SENSES.find((x) => (s.balance?.[x.key] ?? 0) > 0.6) : undefined;

  // 언어 연계 팁: 교육 방향에 '영어'가 있고, 커리큘럼 사물 단어를 말했을 때
  const wantsEnglish = !!profile?.parent.goals.some((g) => g.includes('영어'));
  const tipItem = wantsEnglish && s ? s.words.map(findItem).find((x): x is Item => !!x) : undefined;

  const favorites = (s?.favorites ?? []).map((f) => {
    const it = findItem(f);
    return it ? `${it.emoji} ${it.ko}` : f;
  });

  // 아이가 불편함을 말한 순간(alerts)을 맨 앞에
  const checks = [
    ...(s?.alerts ?? []).map((t) => ({ t, alert: true })),
    ...(s?.out_of_scope ?? []).map((t) => ({ t, alert: false })),
  ];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <H1>오늘의 리포트</H1>

        <Card soft style={{ gap: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.primary }}>{today.day}일차</Text>
          <Text style={T.sub}>오늘은 이 주제를 배웠어요</Text>
          <Text style={T.h2}>{today.items.map((id) => `${ITEMS[id].emoji} ${ITEMS[id].ko}`).join(' · ')}</Text>
          {hasData && s && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {s.words.map((w) => (
                <Tag key={w} label={`'${w}' 따라 말함`} />
              ))}
              {s.gaze_s > 0 && <Tag label={`함께한 시간 ${duration(s.gaze_s)}`} />}
            </View>
          )}
        </Card>

        {!hasData || !s ? (
          <Box>
            <Title>{state === 'loading' ? '불러오는 중...' : '아직 오늘 대화 기록이 없어요'}</Title>
            {state !== 'loading' && (
              <Text style={T.sub}>
                {state === 'fail'
                  ? '서버에 연결하지 못했어요. 태블릿과 서버가 켜져 있는지 확인해 주세요.'
                  : `${name}와(과) 아바타가 대화를 마치면 여기에 요약이 보여요.`}
              </Text>
            )}
          </Box>
        ) : (
          <>
            <Box>
              <Title>따라 말한 단어</Title>
              {s.words.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {s.words.map((w) => (
                    <View key={w} style={{ backgroundColor: C.primarySoft, borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{w}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={T.sub}>아직 따라 말한 단어는 없어요. 듣는 것만으로도 충분해요.</Text>
              )}
              {s.repeats > 0 && (
                <Text style={T.small}>
                  따라 말하기 {s.repeats}번 중 {s.repeat_ok}번 비슷하게 말했어요.
                </Text>
              )}
            </Box>

            <Box>
              <Title>집중도</Title>
              <Text style={T.body}>화면을 {duration(s.gaze_s)} 봤어요</Text>
            </Box>

            <Box>
              <Title>세 감각 활동 균형</Title>
              {SENSES.map((x) => {
                const v = Math.max(0, Math.min(1, s.balance?.[x.key] ?? 0));
                return (
                  <View key={x.key} style={{ gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={T.body}>{x.label}</Text>
                      <Text style={T.body}>{pct(v)}</Text>
                    </View>
                    <View style={{ height: 12, borderRadius: 6, backgroundColor: C.track }}>
                      <View style={{ width: `${v * 100}%`, height: 12, borderRadius: 6, backgroundColor: C.primary }} />
                    </View>
                  </View>
                );
              })}
              <Text style={T.small}>
                {skewed
                  ? `오늘은 ${skewed.short} 활동이 많았어요. 내일은 다른 감각 활동도 골고루 섞어볼게요.`
                  : '세 감각이 한쪽으로 치우치지 않게 골고루 쓰고 있어요.'}
              </Text>
            </Box>

            <Box>
              <Title>반응</Title>
              <Text style={T.body}>좋아한 사물: {favorites.length ? favorites.join(', ') : '아직 없어요'}</Text>
              <Text style={T.body}>
                터치 {s.touches}번{s.reaction_ms > 0 ? ` · 평균 반응 ${(s.reaction_ms / 1000).toFixed(1)}초` : ''}
              </Text>
              <Text style={T.body}>웃음 {s.smiles}번</Text>
            </Box>

            {tipItem && (
              <Card soft style={{ borderWidth: 0 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.primary }}>언어 연계 팁</Text>
                <Text style={T.body}>
                  {`한국어로 '${tipItem.ko}'를 잘 말했으니, 이제 영어 '${tipItem.en}'을 들려줄 타이밍이에요.`}
                </Text>
              </Card>
            )}
          </>
        )}

        {checks.length > 0 && (
          <Card dashed style={[{ gap: 10 }, checks[0].alert && { borderColor: C.warn }]}>
            <Title>확인 필요 {checks.length}건</Title>
            {checks.map((c, i) => (
              <View key={`${c.alert ? 'a' : 'o'}-${i}`} style={{ gap: 2 }}>
                {c.alert ? (
                  <>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: C.warn }}>{`⚠ ${name} "${c.t}"`}</Text>
                    <Text style={T.sub}>불편함을 말한 순간이에요. 아바타는 판단하지 않았어요. 아이 상태를 직접 살펴봐 주세요.</Text>
                  </>
                ) : (
                  <Text style={T.sub}>{`${name} "${c.t}" → 답을 만들지 않고 오늘 주제로 돌려 안내했어요.`}</Text>
                )}
              </View>
            ))}
          </Card>
        )}

        <Button label="피드백 쓰러 가기" onPress={() => router.navigate('/parent/feedback' as Href)} style={{ marginTop: 8 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
