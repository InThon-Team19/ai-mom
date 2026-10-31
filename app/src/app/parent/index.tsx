// 부모 앱 2-1 홈 (민철 디자인 Home): 내 아바타 학습률(다 배우면 숨김) · {이름}의 오늘 · 아바타 말풍선(일차·배움 한 줄) · 오늘 {이름}는… 3줄 · 감각 일지 보기 — 담당: 태희
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Avatar } from '@/components/Avatar';
import { ChecksBox } from '@/components/ChecksBox';
import { RingGauge } from '@/components/RingGauge';
import { Art, BigButton, Bubble, Panel, artOf, type ArtName } from '@/components/ui';
import { ITEMS, dayOf, type Item } from '@/content/curriculum';
import { api } from '@/lib/api';
import { useDevice } from '@/lib/layout';
import { headline, josa, wordStatus } from '@/lib/progress';
import { duration, loadSensory, type SensoryReport } from '@/lib/sensory';
import { useProfile } from '@/lib/store';
import type { Gauge, Summary } from '@/lib/types';
import { C, R, T } from '@/theme';
import { Text } from '@/components/AppText';

const itemList = Object.values(ITEMS);
const findItem = (w: string): Item | undefined => {
  const k = w.trim().toLowerCase();
  return itemList.find((it) => it.id === k || it.ko === k || it.en.toLowerCase() === k);
};

const dateLabel = () => {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`;
};

/** 머리 아이콘: 노랑 칸 안 웃는 집 */
const HomeBadge = () => (
  <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M3.5 11 L12 4 L20.5 11 V20 H3.5 Z" stroke={C.text} strokeWidth={2} fill="none" strokeLinejoin="round" />
      <Circle cx={9.5} cy={13.5} r={1.2} fill={C.text} />
      <Circle cx={14.5} cy={13.5} r={1.2} fill={C.text} />
      <Path d="M9.5 16.5 Q12 18.5 14.5 16.5" stroke={C.text} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </Svg>
  </View>
);

type Row = { key: string; icon: ArtName; before?: string; bold: string; after: string };

/** '오늘 {이름}는…' 줄: 실제 활동 기록으로만 만듦 (없는 일을 지어내지 않음) */
function todayRows(s: Summary | null, story: { title: string } | null, me: string): Row[] {
  if (!s) return [];
  const rows: Row[] = [];
  const fav = (s.favorites ?? []).map(findItem).find((x): x is Item => !!x);
  const smiles = s.smiles + (s.expressions?.smile ?? 0);
  if (fav) {
    rows.push(
      smiles > 0
        ? { key: 'fav', icon: artOf(fav.id) ?? 'smile', bold: fav.ko, after: `${josa(fav.ko, '을', '를')} 보고 웃었어요` }
        : { key: 'fav', icon: artOf(fav.id) ?? 'eye', bold: fav.ko, after: `${josa(fav.ko, '을', '를')} 가장 좋아했어요` },
    );
  } else if (smiles > 0) {
    rows.push({ key: 'smile', icon: 'smile', bold: `${smiles}번`, after: ' 웃었어요' });
  }
  const word = s.words.map(findItem).find((x): x is Item => !!x);
  if (word || s.words.length) {
    const w = word?.ko ?? s.words[0];
    rows.push({
      key: 'word',
      icon: artOf(word?.id) ?? 'talk',
      bold: w,
      after: s.repeat_ok > 1 ? `${josa(w, '을', '를')} ${s.repeat_ok}번 따라 말했어요` : `${josa(w, '을', '를')} 따라 말했어요`,
    });
  } else if (s.repeats > 0) {
    rows.push({ key: 'word', icon: 'repeat', before: '따라 말하기를 ', bold: `${s.repeats}번`, after: ' 해 봤어요' });
  }
  const listen = s.listen_s ?? 0;
  if (story && listen > 0) {
    rows.push({ key: 'story', icon: 'story', before: '전래동화 ', bold: story.title, after: `${josa(story.title, '을', '를')} 들었어요` });
  } else if (listen > 0) {
    rows.push({ key: 'listen', icon: 'ear', before: `${me} 목소리를 `, bold: duration(listen), after: ' 들었어요' });
  } else if (s.gaze_s > 0) {
    rows.push({ key: 'gaze', icon: 'eye', before: '화면을 ', bold: duration(s.gaze_s), after: ' 바라봤어요' });
  }
  if (s.touches > 0 && rows.length < 3) rows.push({ key: 'touch', icon: 'hand', before: '화면을 ', bold: `${s.touches}번`, after: ' 눌러 봤어요' });
  return rows.slice(0, 3);
}

/** 학습률 작은 링 (디자인 Home: 48px · 눈금 없음 · 아래 굵은 이름) */
const MiniRing = ({ g, label, color }: { g: Gauge | null; label: string; color?: string }) => (
  <View style={{ alignItems: 'center', gap: 2 }}>
    <RingGauge progress={g?.progress ?? 0} baseline={g?.baseline} size={48} stroke={6} color={color} showTick={false} showBaselineText={false} fontScale={0.26} />
    <Text style={{ fontSize: 12, fontWeight: '700', color: C.text }}>{label}</Text>
  </View>
);

export default function ParentHome() {
  const profile = useProfile();
  const childId = profile?.childId;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sensory, setSensory] = useState<SensoryReport | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null); // null = 확인 중
  const { frame, isTablet } = useDevice();
  const [voice, setVoice] = useState<Gauge | null>(null);
  const [mouth, setMouth] = useState<Gauge | null>(null);

  // 탭에 들어올 때마다 새로고침 (낭독 후 학습률, 낮 동안 쌓인 기록)
  useFocusEffect(
    useCallback(() => {
      if (!childId) return;
      let alive = true;
      loadSensory(childId)
        .then(({ today: s, report }) => {
          if (!alive) return;
          setSummary(s);
          setSensory(report);
          setLinked(true);
        })
        .catch(() => {
          if (!alive) return;
          setSummary(null);
          setSensory(null);
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
  const me = profile?.parent.title || '엄마';
  const today = dayOf(profile?.day ?? 1);
  const st = wordStatus(today.day, summary);
  // "오늘은 사과를 배웠어요" → "지호는 오늘 사과를 배웠어요"
  const line = headline(st).replace(/^오늘은 /, `${name}${josa(name, '은', '는')} 오늘 `);
  const story = today.story ? { title: today.story.title } : null;
  const rows = todayRows(summary, story, me);
  // 학습률 카드: 음성·입모양 둘 다 100% 가 되기 전까지 계속 보임 (와이어프레임: 다 배우면 숨김). 하나만 불러와도 보임
  const done = (g: Gauge | null) => !!g && g.progress >= 1;
  const showLearn = !!(voice || mouth) && !(done(voice) && done(mouth));
  const canUse = !!voice?.usable && !!mouth?.usable;

  const go = (href: string) => router.navigate(href as Href);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={[{ padding: 20, paddingTop: 24, gap: 16, flexGrow: 1 }, frame]}>
        {showLearn && (
          <Panel>
            <View style={{ gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>내 아바타 학습률</Text>
              <Text style={{ fontSize: 12, color: C.sub }}>
                {canUse ? `지금도 ${name}에게 쓸 수 있어요. 더 배우면 더 자연스럽게 말해요` : `100%가 되면 ${name}에게 더 자연스럽게 말해요`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <MiniRing g={voice} label="음성" />
              <MiniRing g={mouth} label="입모양" color={C.green} />
              <View style={{ flex: 1 }} />
              <BigButton small label={canUse ? '더 학습하기' : '학습하러 가기'} onPress={() => go('/parent/avatar')} />
            </View>
          </Panel>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <HomeBadge />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: C.text }}>{name}의 오늘</Text>
            <Text style={{ fontSize: 12, color: C.sub }}>
              {dateLabel()}
              {'  ·  '}
              <Text style={{ color: linked ? C.ok : C.sub, fontWeight: '700' }}>
                {linked === null ? '연결 확인 중' : linked ? '태블릿 연결됨' : '태블릿 연결 대기'}
              </Text>
            </Text>
          </View>
        </View>

        {/* 아바타 + 말풍선: 오늘 일차 · 배움 한 줄 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View
            style={{
              width: isTablet ? 120 : 96,
              height: isTablet ? 140 : 112,
              borderRadius: 18,
              backgroundColor: C.primarySoft,
              alignItems: 'center',
              justifyContent: 'flex-end',
              overflow: 'hidden',
            }}
            accessibilityLabel={`${me} 아바타`}>
            {profile && <Avatar config={profile.avatar} size={isTablet ? 112 : 92} expression="smile" />}
          </View>
          <Bubble>
            <Text style={{ fontSize: 13, fontWeight: '800', color: C.link }}>오늘 {today.day}일차!</Text>
            <Text style={{ marginTop: 4, fontSize: 16, fontWeight: '700', lineHeight: 24, color: C.text }}>{line}</Text>
          </Bubble>
        </View>

        {/* 위험 신호·무리 신호는 작게라도 꼭 보이게 */}
        <ChecksBox summary={summary} name={name} compact onPress={() => go('/parent/recordings')} />
        {!!sensory?.strain.length && (
          <Pressable
            onPress={() => go('/parent/report')}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: C.primarySoft }}>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: C.text }} numberOfLines={2}>
              우리 아이 확인해 줄 점이 있어요 · {sensory.strain[0]}
            </Text>
            <Text style={{ fontSize: 22, color: C.sub }}>›</Text>
          </Pressable>
        )}

        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>
            오늘 {name}
            {josa(name, '은', '는')}…
          </Text>
          {rows.length ? (
            rows.map((r) => (
              <View
                key={r.key}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, paddingLeft: 8, paddingRight: 14, borderRadius: 16, borderWidth: 2, borderColor: C.border, backgroundColor: C.white }}>
                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
                  <Art name={r.icon} size={34} />
                </View>
                <Text style={{ flex: 1, fontSize: 15, color: C.text }}>
                  {r.before}
                  <Text style={{ fontWeight: '800' }}>{r.bold}</Text>
                  {r.after}
                </Text>
              </View>
            ))
          ) : (
            <View style={{ alignItems: 'center', gap: 6, paddingVertical: 18, paddingHorizontal: 14, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, backgroundColor: C.white }}>
              <Art name="sprout" size={34} />
              <Text style={[T.body, { textAlign: 'center', fontWeight: '700' }]}>
                {linked === false ? '서버에 연결하지 못했어요' : '아직 오늘 놀이 기록이 없어요'}
              </Text>
              <Text style={[T.small, { textAlign: 'center' }]}>
                {linked === false
                  ? '태블릿과 서버가 켜져 있는지 확인해 주세요.'
                  : `${name}${josa(name, '이', '가')} 아바타와 놀고 나면 여기에 보여요.`}
              </Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1, minHeight: 8 }} />
        <BigButton label={`자세한 오늘 ${name} 감각 일지 보기`} onPress={() => go('/parent/report')} style={{ borderRadius: R.md }} />
      </ScrollView>
    </SafeAreaView>
  );
}
