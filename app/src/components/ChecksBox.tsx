// 확인 필요 상자 (리포트·아이 녹음 기록): 불편함 알림 먼저, 그다음 범위 밖 질문 — 담당: 태희 (민철 디자인 Recordings)
import { Pressable, Text, View } from 'react-native';

import { josa } from '@/lib/progress';
import type { Summary } from '@/lib/types';
import { C, T } from '@/theme';

export function checksOf(s: Summary | null) {
  return [...(s?.alerts ?? []).map((t) => ({ t, alert: true })), ...(s?.out_of_scope ?? []).map((t) => ({ t, alert: false }))];
}

/** compact: 한 줄 요약 + › (누르면 자세히) */
export function ChecksBox({ summary, name, compact, onPress }: { summary: Summary | null; name: string; compact?: boolean; onPress?: () => void }) {
  const checks = checksOf(summary);
  if (!checks.length) return null;
  const alerts = checks.filter((c) => c.alert).length;
  const box = (
    <View
      style={{
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: alerts ? C.warn : C.warnLine,
        backgroundColor: C.warnSoft,
        gap: 6,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: alerts ? C.warn : C.text }}>
          {alerts ? '⚠ ' : ''}확인해 주세요 {checks.length}건
        </Text>
        {onPress && <Text style={{ fontSize: 22, color: C.sub }}>›</Text>}
      </View>
      {compact ? (
        <Text style={[T.small, { color: C.text }]} numberOfLines={2}>
          {alerts ? `${name}${josa(name, '이', '가')} 불편함을 말한 순간이 ${alerts}번 있었어요. 아이 상태를 직접 살펴봐 주세요.` : '배우는 범위 밖 질문이 있었어요.'}
        </Text>
      ) : (
        checks.map((c, i) => (
          <Text key={`${c.alert ? 'a' : 'o'}-${i}`} style={{ fontSize: 13, lineHeight: 20, color: c.alert ? C.warn : C.text, fontWeight: c.alert ? '700' : '400' }}>
            {c.alert
              ? `• "${c.t}" · 위험 신호라 기록해 뒀어요. 아바타는 판단하지 않았어요. 아이 상태를 직접 살펴봐 주세요.`
              : `• "${c.t}" · 배우는 범위 밖 질문이라 답을 만들지 않고 주제로 돌아갔어요`}
          </Text>
        ))
      )}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`확인해 주세요 ${checks.length}건`}>
      {box}
    </Pressable>
  ) : (
    box
  );
}
