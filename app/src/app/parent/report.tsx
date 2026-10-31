// 부모 앱 2-2 리포트 (민철 디자인 Report) "오늘 {이름}의 감각 일지": 감각별 반응 도넛 + 발전/유지·무리 신호 · 시각/촉각/청각 칸 · 아바타 제안 · 확인 필요 · 아이 녹음 기록 — 담당: 태희
// 진단이 아니라 활동 기록으로 본 참고용 관찰 (lib/sensory)
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

import { Avatar } from '@/components/Avatar';
import { ChecksBox } from '@/components/ChecksBox';
import { Art, BigButton, Bubble, MicIcon, Panel, artOf } from '@/components/ui';
import { ITEMS, dayOf, type Item } from '@/content/curriculum';
import { useDevice } from '@/lib/layout';
import { josa } from '@/lib/progress';
import { duration, loadSensory, type SenseKey, type SensoryReport } from '@/lib/sensory';
import { useProfile } from '@/lib/store';
import type { Summary } from '@/lib/types';
import { C, SENSE, T } from '@/theme';
import { Text } from '@/components/AppText';

const LABEL: Record<SenseKey, string> = { visual: '시각', touch: '촉각', audio: '청각' };
const ORDER: SenseKey[] = ['visual', 'touch', 'audio'];

const itemList = Object.values(ITEMS);
/** 서버가 주는 단어/사물(한글·영어·id)을 커리큘럼 사물로 매칭 */
const findItem = (w: string): Item | undefined => {
  const k = w.trim().toLowerCase();
  return itemList.find((it) => it.id === k || it.ko === k || it.en.toLowerCase() === k);
};

const dateLabel = () => {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`;
};

/** 감각별 반응 수 (lib/sensory 의 활동량 계산과 같은 기준: 응시는 10초당 1번) */
function senseCounts(s: Summary | null): Record<SenseKey, number> {
  if (!s) return { visual: 0, touch: 0, audio: 0 };
  const ex = (k: string) => s.expressions?.[k] ?? 0;
  return {
    visual: Math.round(s.gaze_s / 10) + s.smiles + ex('smile') + ex('surprise'),
    touch: s.touches,
    audio: s.repeats + (s.voices ?? 0),
  };
}

/** 도넛 차트 (react-native-svg) */
function Donut({ counts, size = 112 }: { counts: Record<SenseKey, number>; size?: number }) {
  const total = ORDER.reduce((a, k) => a + counts[k], 0);
  const r = 40;
  const len = 2 * Math.PI * r;
  const gap = total > 0 && ORDER.filter((k) => counts[k] > 0).length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <Svg width={size} height={size} viewBox="0 0 112 112">
      <Circle cx={56} cy={56} r={r} stroke={C.track} strokeWidth={20} fill="none" />
      <G transform="rotate(-90 56 56)">
        {total > 0 &&
          ORDER.map((k) => {
            const seg = (counts[k] / total) * len;
            if (seg <= 0) return null;
            const el = (
              <Circle
                key={k}
                cx={56}
                cy={56}
                r={r}
                stroke={SENSE[k].color}
                strokeWidth={20}
                fill="none"
                strokeDasharray={`${Math.max(0, seg - gap)} ${len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += seg;
            return el;
          })}
      </G>
      <SvgText x={56} y={56} textAnchor="middle" fontSize={19} fontFamily="Hakgyoansim-Dunggeunmiso-Bold" fill={C.text}>
        {`${total}번`}
      </SvgText>
      <SvgText x={56} y={72} textAnchor="middle" fontSize={11} fontFamily="Cafe24-Ssurround-Air" fill={C.sub}>
        반응
      </SvgText>
    </Svg>
  );
}

/** 감각 머리: 색 테두리 알약 + 설명 */
const SenseHead = ({ k, desc }: { k: SenseKey; desc: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    <View style={{ paddingHorizontal: 12, paddingVertical: 3, borderRadius: 999, borderWidth: 2, borderColor: SENSE[k].color, backgroundColor: SENSE[k].soft }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: C.text }}>{LABEL[k]}</Text>
    </View>
    <Text style={{ flexShrink: 1, fontSize: 12, color: C.sub }}>{desc}</Text>
  </View>
);

/** 감각 칸 한 개: 작은 제목 · 아이콘 · 값 */
const Tile = ({ label, icon, value }: { label: string; icon: ReactNode; value: string }) => (
  <View style={{ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16, borderWidth: 2, borderColor: C.border, backgroundColor: C.white }}>
    <Text style={{ fontSize: 11, color: C.sub, textAlign: 'center' }} numberOfLines={1}>
      {label}
    </Text>
    <View style={{ height: 34, justifyContent: 'center' }}>{icon}</View>
    <Text style={{ fontSize: 14, fontWeight: '800', color: C.text, textAlign: 'center' }} numberOfLines={2}>
      {value}
    </Text>
  </View>
);

export default function Report() {
  const profile = useProfile();
  const childId = profile?.childId;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [sensory, setSensory] = useState<SensoryReport | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading');
  const { frame, width } = useDevice();
  const narrow = width < 400; // 폰 폭 360: 도넛 옆 줄(색·감각·n번·상태 칩)이 넘치지 않게 도넛·간격을 줄임

  useFocusEffect(
    useCallback(() => {
      if (!childId) return;
      let alive = true;
      loadSensory(childId)
        .then(({ today: s, report }) => {
          if (!alive) return;
          setSummary(s);
          setSensory(report);
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
  const hasData = !!s && (s.sessions > 0 || s.touches > 0 || s.words.length > 0 || s.gaze_s > 0 || (s.listen_s ?? 0) > 0);
  const counts = senseCounts(s);
  const total = ORDER.reduce((a, k) => a + counts[k], 0);
  const statusOf = (k: SenseKey) => sensory?.senses.find((x) => x.key === k)?.status ?? '기록 없음';

  const favs = (s?.favorites ?? []).map(findItem).filter((x): x is Item => !!x);
  const fav = favs[0];
  const word = (s?.words ?? []).map(findItem).find((x): x is Item => !!x);
  const smiles = (s?.smiles ?? 0) + (s?.expressions?.smile ?? 0) + (s?.expressions?.surprise ?? 0);
  // 아바타 제안: 좋아한 사물 → 오늘 동화 → 오늘 주제 순
  const talk = fav?.ko ?? today.story?.title ?? today.topic;
  const withJosa = `${name}${josa(name, '이랑', '랑')}`;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={[{ padding: 20, paddingTop: 24, gap: 14, flexGrow: 1 }, frame]}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 12, color: C.sub }}>
            {dateLabel()} · {today.day}일차
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: C.text }}>오늘 {name}의 감각 일지</Text>
        </View>

        {/* 감각별 반응 도넛 + 지난 기록 대비 발전/유지 (해커톤 주제 '감각') */}
        <Panel>
          {state === 'loading' && !s ? (
            <Text style={T.sub}>불러오는 중...</Text>
          ) : state === 'fail' && !s ? (
            <Text style={T.sub}>서버에 연결하지 못했어요. 태블릿과 서버가 켜져 있는지 확인해 주세요.</Text>
          ) : (
            <>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: narrow ? 12 : 18 }}
                accessible
                accessibilityLabel={`오늘 감각 반응 ${total}번: ${ORDER.map((k) => `${LABEL[k]} ${counts[k]}번 ${statusOf(k)}`).join(', ')}`}>
                <Donut counts={counts} size={narrow ? 92 : 112} />
                <View style={{ flex: 1, gap: 10 }}>
                  {ORDER.map((k) => (
                    <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: narrow ? 6 : 8 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: SENSE[k].color }} />
                      <Text style={{ fontSize: 14, color: C.text }}>{LABEL[k]}</Text>
                      <Text style={{ flex: 1, minWidth: 28, fontSize: 14, fontWeight: '800', color: C.text }} numberOfLines={1}>
                        {counts[k]}번
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              {sensory && (
                <View style={{ gap: 4, borderTopWidth: 1, borderTopColor: C.track, paddingTop: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>{sensory.overall}</Text>
                  {sensory.strain.map((t) => (
                    <Text key={t} style={{ fontSize: 13, fontWeight: '700', color: C.text }}>
                      · {t}
                    </Text>
                  ))}
                </View>
              )}
            </>
          )}
        </Panel>

        <ChecksBox summary={s} name={name} />

        {hasData && s ? (
          <>
            <View style={{ gap: 8 }}>
              <SenseHead k="visual" desc="보고 반응한 것" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Tile label="바라본 시간" icon={<Art name="clock" />} value={duration(s.gaze_s)} />
                <Tile label="가장 오래 바라본" icon={<Art name={artOf(fav?.id) ?? 'eye'} />} value={fav?.ko ?? '아직 없어요'} />
                <Tile label="많이 반응한" icon={<Art name="smile" />} value={smiles > 0 ? `웃음 ${smiles}번` : '-'} />
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <SenseHead k="touch" desc="만지고 눌러 본 것" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Tile label="가장 많이 터치한" icon={<Art name={artOf(fav?.id) ?? 'hand'} />} value={fav?.ko ?? '아직 없어요'} />
                <Tile
                  label="터치 · 평균 반응"
                  icon={<Art name="hand" />}
                  value={`${s.touches}번${s.reaction_ms > 0 ? ` · ${(s.reaction_ms / 1000).toFixed(1)}초` : ''}`}
                />
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <SenseHead k="audio" desc="듣고 따라 말한 것" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Tile label="따라 말한 단어" icon={<Art name={artOf(word?.id) ?? 'talk'} />} value={s.words.length ? s.words.join(', ') : '아직 없어요'} />
                <Tile label="따라 말하기" icon={<Art name="repeat" />} value={s.repeats > 0 ? `${s.repeats}번 중 ${s.repeat_ok}번` : '-'} />
                <Tile label="들은 시간" icon={<Art name="ear" />} value={(s.listen_s ?? 0) > 0 ? duration(s.listen_s ?? 0) : '-'} />
              </View>
            </View>
          </>
        ) : (
          state !== 'loading' && (
            <View style={{ alignItems: 'center', gap: 6, paddingVertical: 18, paddingHorizontal: 14, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: C.border, backgroundColor: C.white }}>
              <Art name="sprout" />
              <Text style={[T.body, { fontWeight: '700', textAlign: 'center' }]}>아직 오늘 대화 기록이 없어요</Text>
              <Text style={[T.small, { textAlign: 'center' }]}>
                {name}
                {josa(name, '과', '와')} 아바타가 놀고 나면 감각 일지가 채워져요.
              </Text>
            </View>
          )
        )}

        {/* 아바타 제안 말풍선 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.primarySoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' }}>
            {profile && <Avatar config={profile.avatar} size={48} expression="smile" />}
          </View>
          <Bubble>
            <Text style={{ fontSize: 14, lineHeight: 22, color: C.text }}>
              오늘 {withJosa} <Text style={{ fontWeight: '800' }}>{talk}</Text> 얘기를 해 보는 건 어때요?
            </Text>
          </Bubble>
        </View>

        <View style={{ flex: 1, minHeight: 8 }} />
        <BigButton variant="outline" label="아이 녹음 기록" icon={<MicIcon />} onPress={() => router.navigate('/parent/recordings' as Href)} />
      </ScrollView>
    </SafeAreaView>
  );
}
