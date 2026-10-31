// 페르소나 확정 (기획 2-1-1 ⑦): 아바타·입모양·목소리·말투·성향을 합친 초안을 부모가 가입 때 1회 확인·수정. 담당: 태희
// 와이어프레임에 별도 화면이 없어 1-7 맨 위 카드로 넣음
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { api } from '@/lib/api';
import type { Profile } from '@/lib/store';
import type { Gauge } from '@/lib/types';
import { C, R, T } from '@/theme';

function Row({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
      <Text style={[T.small, { width: 64 }]}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 15, color: C.text }} numberOfLines={2}>
        {value}
      </Text>
      <Pressable onPress={() => router.push(href as never)} hitSlop={8}>
        <Text style={{ color: C.primary, fontWeight: '700' }}>수정</Text>
      </Pressable>
    </View>
  );
}

const gaugeText = (g: Gauge | null) => (g ? `${Math.round(g.progress * 100)}% ${g.usable ? '· 사용 가능' : '· 최소 기준 전 (어색할 수 있어요)'}` : '확인 중…');

export function PersonaCard({ profile }: { profile: Profile }) {
  const [voice, setVoice] = useState<Gauge | null>(null);
  const [mouth, setMouth] = useState<Gauge | null>(null);
  const [traits, setTraits] = useState<string[]>([]);

  useEffect(() => {
    const id = profile.childId;
    api.voiceGauge(id).then(setVoice).catch(() => {});
    api.mouthGauge(id).then(setMouth).catch(() => {});
    api.voiceAnalysis(id).then((a) => setTraits(a.traits)).catch(() => {});
  }, [profile.childId]);

  const name = profile.child.nickname || profile.child.name || '아이';
  return (
    <View style={{ borderRadius: R.md, borderWidth: 2, borderColor: C.primary, backgroundColor: C.primarySoft, padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>내 아바타 페르소나 확인</Text>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 84, height: 92, borderRadius: R.sm, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <Avatar config={profile.avatar} size={80} mouth={0.2} />
        </View>
        <Text style={{ flex: 1, fontSize: 15, color: C.text, lineHeight: 22 }}>
          {`"${name}야, ${profile.parent.title}랑 같이 놀자!"`}
          {'\n'}
          <Text style={T.small}>{`${profile.parent.tone} 말투로 ${name}에게 말을 걸어요.`}</Text>
        </Text>
      </View>
      <View style={{ backgroundColor: C.white, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 4 }}>
        <Row label="호칭·말투" value={`${profile.parent.title} · ${profile.parent.tone}`} href="/onboarding/parent" />
        <Row label="교육 방향" value={profile.parent.goals.join(', ') || '선택 안 함'} href="/onboarding/parent" />
        <Row label="목소리" value={gaugeText(voice)} href="/onboarding/voice" />
        <Row label="입모양" value={gaugeText(mouth)} href="/onboarding/mouth" />
        {traits.length > 0 && <Row label="말하기" value={traits.join(' · ')} href="/onboarding/voice" />}
      </View>
      <Text style={T.small}>확인은 가입 때 한 번만 해요. 이후 대화마다 승인할 필요는 없어요.</Text>
    </View>
  );
}
