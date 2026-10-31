// 감각 발달 카드 (리포트 맨 위) + 홈용 3칸 요약 칩 — 담당: 태희
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import type { SenseStatus, SensoryReport } from '@/lib/sensory';
import { C, R, T } from '@/theme';

const ICON = { visual: '👀', audio: '👂', touch: '✋' } as const;

const chipBg = (s: SenseStatus) =>
  s === '발전' ? C.green : s === '유지' ? C.primarySoft : s === '줄었어요' ? C.accent : s === '첫 기록' ? C.primary : C.track;

export function StatusChip({ status }: { status: SenseStatus }) {
  return (
    <View style={{ backgroundColor: chipBg(status), borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: C.onPrimary }}>
        {status === '발전' ? '↑ ' : status === '줄었어요' ? '↓ ' : ''}
        {status}
      </Text>
    </View>
  );
}

/** 홈: 시각/청각/촉각 상태 3칸 */
export function SensoryChips({ report }: { report: SensoryReport }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {report.senses.map((s) => (
        <View
          key={s.key}
          style={{ flex: 1, alignItems: 'center', gap: 4, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: R.md, paddingVertical: 8 }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>
            {ICON[s.key]} {s.label}
          </Text>
          <StatusChip status={s.status} />
        </View>
      ))}
    </View>
  );
}

/** 무리 신호 경고 (홈: 누르면 리포트로) */
export function StrainCard({ strain, onPress }: { strain: string[]; onPress?: () => void }) {
  if (!strain.length) return null;
  const body = (
    <Card dashed style={{ borderColor: C.warn, gap: 6, flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.warn }}>⚠ 무리 신호 {strain.length}개</Text>
        <Text style={T.sub}>{strain[0]}</Text>
      </View>
      {onPress && <Text style={{ fontSize: 24, color: C.text }}>›</Text>}
    </Card>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

const pct = (v: number) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;

/** 리포트: 감각 발달 카드 */
export function SensoryCard({ report, loading, failed }: { report: SensoryReport | null; loading?: boolean; failed?: boolean }) {
  return (
    <Card soft style={{ gap: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: C.link }}>감각 발달 · 시각 청각 촉각</Text>
      {!report ? (
        <Text style={T.sub}>
          {loading ? '불러오는 중...' : failed ? '서버에 연결하지 못했어요. 잠시 후 다시 열어 주세요.' : '아직 오늘 감각 활동 기록이 없어요'}
        </Text>
      ) : (
        <>
          <Text style={T.h2}>{report.overall}</Text>
          {report.hasData && (
            <Text style={T.small}>
              {report.historyDays ? `지난 ${report.historyDays}일 평균과 비교했어요` : '비교할 지난 기록이 아직 없어요'}
            </Text>
          )}

          <View style={{ gap: 10 }}>
            {report.senses.map((s) => (
              <View key={s.key} style={{ backgroundColor: C.white, borderRadius: R.md, padding: 12, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>
                    {ICON[s.key]} {s.label}
                    {report.hasData ? <Text style={{ fontSize: 13, fontWeight: '600', color: C.sub }}>{`  ${pct(report.balance[s.key])}`}</Text> : null}
                  </Text>
                  <StatusChip status={s.status} />
                </View>
                <Text style={T.body}>{s.line}</Text>
                {!!s.detail && <Text style={T.small}>{s.detail}</Text>}
              </View>
            ))}
          </View>

          {report.strain.length > 0 && (
            <View style={{ borderWidth: 1.5, borderColor: C.warn, borderRadius: R.md, padding: 12, gap: 6, backgroundColor: C.white }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: C.warn }}>⚠ 무리 신호</Text>
              {report.strain.map((t) => (
                <Text key={t} style={{ fontSize: 14, color: C.warn }}>
                  · {t}
                </Text>
              ))}
            </View>
          )}

          {report.suggestions.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>내일 해볼 만한 것</Text>
              {report.suggestions.map((t) => (
                <View key={t} style={{ flexDirection: 'row', gap: 6 }}>
                  <Text style={{ fontSize: 15, color: C.link }}>•</Text>
                  <Text style={[T.body, { flex: 1, fontSize: 15 }]}>{t}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={[T.small, { color: C.muted }]}>{report.note}</Text>
        </>
      )}
    </Card>
  );
}
