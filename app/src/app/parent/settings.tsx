// 부모 앱 설정 탭 — 담당: 태희 (아바타 모습 바꾸기는 아바타 탭 '꾸미기'로 옮김)
// 로그인 · 계정 정보 · 태블릿 연결 키(조회·재발급) · 등록된 기기 · 학습 이력 · 대화 설정 · 이 기기 모드 전환
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountSection } from '@/components/AccountSection';
import { RingGauge } from '@/components/RingGauge';
import { Button, Chip } from '@/components/ui';
import { api } from '@/lib/api';
import { getDeviceId } from '@/lib/device';
import { pinHash, validPin } from '@/lib/pin';
import { dayAdvancePatch } from '@/lib/progress';
import { refreshProfile, resetLocal, setRole, updateProfile, useProfile, type Profile } from '@/lib/store';
import type { Gauge, History } from '@/lib/types';
import { C, R, T } from '@/theme';
import { useDevice } from '@/lib/layout';

const fmt = (sec: number) => {
  const d = new Date(sec * 1000);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** 확인 창 (웹은 window.confirm) */
function confirm(title: string, msg: string, ok: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n${msg}`)) onOk();
    return;
  }
  Alert.alert(title, msg, [
    { text: '취소', style: 'cancel' },
    { text: ok, style: 'destructive', onPress: onOk },
  ]);
}

function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ borderRadius: R.md, borderWidth: 1, borderColor: C.border, padding: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={[T.small, { width: 76 }]}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 15, color: C.text }}>{value}</Text>
    </View>
  );
}

const Link = ({ label, href }: { label: string; href: string }) => (
  <Pressable onPress={() => router.push(href as Href)} hitSlop={8}>
    <Text style={{ color: C.link, fontWeight: '700' }}>{label}</Text>
  </Pressable>
);

export default function Settings() {
  const { frame } = useDevice();
  const p = useProfile();
  const [me, setMe] = useState('');
  const [voice, setVoice] = useState<Gauge | null>(null);
  const [mouth, setMouth] = useState<Gauge | null>(null);
  const [hist, setHist] = useState<History | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<string | null>(null); // 받은 연결 코드 (10분, 한 번만)
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');

  useEffect(() => {
    getDeviceId().then(setMe);
  }, []);

  const load = useCallback(() => {
    refreshProfile().then((cur) => {
      api.voiceGauge(cur.childId).then(setVoice).catch(() => {});
      api.mouthGauge(cur.childId).then(setMouth).catch(() => {});
      api.history(cur.childId).then(setHist).catch(() => {});
    });
  }, []);
  useFocusEffect(load);

  if (!p) return null;
  const hasTablet = (p.devices ?? []).some((d) => d.role === 'child');
  const getCode = async () => {
    setBusy(true);
    try {
      const r = await api.reissueLinkCode(p.childId);
      setIssued(r.linkCode);
      load();
    } catch (e) {
      Alert.alert('연결 코드를 받지 못했어요', String(e).slice(0, 120));
    } finally {
      setBusy(false);
    }
  };
  // 새 코드를 받으면 서버가 이미 연결된 아이 태블릿을 끊음 → 태블릿이 있을 때만 확인
  const reissue = () =>
    !hasTablet
      ? getCode()
      : confirm('새 연결 코드를 받을까요?', '지금 연결된 아이 태블릿은 연결이 끊기고, 새 코드로 다시 연결해야 해요.', '받기', async () => {
      setBusy(true);
      try {
        const r = await api.reissueLinkCode(p.childId);
        setIssued(r.linkCode);
        load();
      } catch (e) {
        Alert.alert('재발급 실패', String(e).slice(0, 120));
      } finally {
        setBusy(false);
      }
    });

  const unlink = (deviceId: string, name: string) =>
    confirm('기기 연결을 해제할까요?', `${name} 은(는) 연결 키를 다시 입력해야 써요.`, '해제', async () => {
      await api.removeDevice(p.childId, deviceId).catch(() => {});
      load();
    });

  const savePin = async () => {
    if (!validPin(newPin)) return setPinMsg('숫자 4자리로 정해 주세요');
    await updateProfile({ pinHash: await pinHash(p.childId, newPin) });
    setNewPin('');
    setPinMsg('PIN을 바꿨어요');
  };

  const nextDayNow = async () => {
    const adv = dayAdvancePatch(p, true);
    if (adv) await updateProfile(adv);
  };

  const toChild = () =>
    confirm('아이 모드로 바꿀까요?', '아이 학습 화면만 보여요. 부모 모드로 돌아올 때는 화면 왼쪽 위를 3초 길게 누른 뒤 부모 PIN을 입력해요.', '전환', async () => {
      await setRole('child');
      router.replace('/child');
    });

  const restart = () =>
    confirm('처음부터 다시 가입할까요?', '이 기기에 저장된 가입 정보가 지워져요. (서버의 학습 기록은 남아요)', '다시 가입', async () => {
      await resetLocal();
      router.replace('/');
    });

  const setSettings = (patch: Partial<Profile["settings"]>) => {
    updateProfile({ settings: { ...p.settings, ...patch } });
  };

  const recent = [
    ...(hist?.voice ?? []).map((v) => ({ ...v, type: '목소리' })),
    ...(hist?.mouth ?? []).map((m) => ({ ...m, type: '입모양' })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={[{ padding: 20, gap: 16, paddingBottom: 40 }, frame]}>
        <Text style={T.h1}>설정</Text>

        {/* 기획 2-5: 설정 탭 맨 위 정보는 '아이 모드로 바꾸기' */}
        <Button label="아이 모드로 바꾸기" onPress={toChild} />
        {!p.pinHash && <Text style={[T.small, { color: C.warn }]}>부모 PIN이 아직 없어요. 아래 “부모 PIN”에서 먼저 정해 주세요.</Text>}

        <Section title="로그인">
          <AccountSection childId={p.childId} />
        </Section>

        <Section title="계정 정보" right={<Link label="아이 정보 수정" href="/onboarding/child?edit=1" />}>
          <Row label="아이" value={`${p.child.nickname || p.child.name || '-'} · ${p.child.birth || '-'} · ${p.child.level}`} />
          <Row label="부모" value={`${p.parent.title} · ${p.parent.tone} 말투`} />
          <Row label="교육 방향" value={p.parent.goals.join(', ') || '-'} />
          <Row label="가입 ID" value={p.childId} />
          <Link label="부모 성향 수정" href="/onboarding/parent?edit=1" />
        </Section>

        <Section title="아이 기기 연결">
          <Text style={T.small}>
            {hasTablet ? '아이 태블릿이 연결돼 있어요. 다른 태블릿을 연결하려면 새 코드를 받으세요.' : '코드를 받아 아이 태블릿에 입력하면 연결돼요.'} 코드는 보안을 위해 10분 동안 한 번만 쓸 수 있어요.
          </Text>
          {issued && (
            <View style={{ backgroundColor: C.card, borderRadius: R.sm, paddingVertical: 14, alignItems: 'center' }}>
              <Text selectable style={{ fontSize: 30, fontWeight: '900', letterSpacing: 6, color: C.text }}>
                {issued.slice(0, 3)} {issued.slice(3)}
              </Text>
            </View>
          )}
          <Button label={busy ? '받는 중…' : issued ? '새 코드 다시 받기' : '연결 코드 받기'} variant="outline" disabled={busy} onPress={reissue} />
        </Section>

        <Section title="등록된 기기">
          {(p.devices ?? []).length === 0 && <Text style={T.small}>아직 등록된 기기가 없어요.</Text>}
          {(p.devices ?? [])
            .slice()
            .sort((a, b) => (a.role === b.role ? b.last_seen - a.last_seen : a.role === 'parent' ? -1 : 1))
            .map((d) => (
              <View key={d.device_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: R.pill, backgroundColor: d.role === 'parent' ? C.primary : C.primarySoft }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: d.role === 'parent' ? C.onPrimary : C.link }}>{d.role === 'parent' ? '부모' : '아이'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, color: C.text }}>
                    {d.name || '기기'} {d.device_id === me && <Text style={{ color: C.link }}>(이 기기)</Text>}
                  </Text>
                  <Text style={T.small}>마지막 사용 {fmt(d.last_seen)}</Text>
                </View>
                {d.device_id !== me && (
                  <Pressable onPress={() => unlink(d.device_id, d.name || '기기')} hitSlop={8}>
                    <Text style={{ color: C.warn, fontWeight: '700' }}>연결 해제</Text>
                  </Pressable>
                )}
              </View>
            ))}
        </Section>

        <Section title="학습 이력">
          <Text style={{ fontSize: 15, color: C.text }}>
            지금 {p.day}일차 · {p.readingDone ? `낭독 완료, 다음에 아이 화면을 켜면 ${p.readingDone.forDay}일차` : '오늘 밤 낭독하면 다음날 넘어가요'}
          </Text>
          {!!p.readingDone && <Chip label="시연: 지금 다음 일차로 넘기기" onPress={nextDayNow} />}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <RingGauge progress={voice?.progress ?? 0} baseline={voice?.baseline} size={96} stroke={10} label="음성" />
            <RingGauge progress={mouth?.progress ?? 0} baseline={mouth?.baseline} size={96} stroke={10} label="입모양" />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            <Chip label="목소리 더 녹음" onPress={() => router.push('/onboarding/voice?edit=1' as Href)} />
            <Chip label="입모양 더 촬영" onPress={() => router.push('/onboarding/mouth?edit=1' as Href)} />
          </View>
          <Text style={{ fontWeight: '700', color: C.text, marginTop: 4 }}>최근 낭독</Text>
          {recent.length === 0 && <Text style={T.small}>아직 기록이 없어요.</Text>}
          {recent.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Text style={[T.small, { width: 74 }]}>{fmt(r.at)}</Text>
              <Text style={[T.small, { width: 72 }]}>
                {r.type}·{r.kind === 'plan' ? '밤 낭독' : '가입'}
              </Text>
              <Text style={{ flex: 1, fontSize: 14, color: C.text }} numberOfLines={1}>
                {r.text || '-'}
              </Text>
              <Text style={{ color: r.ok ? C.ok : C.warn }}>{r.ok ? '✓' : '↻'}</Text>
            </View>
          ))}
          <Text style={{ fontWeight: '700', color: C.text, marginTop: 4 }}>아이 하루 기록</Text>
          {(hist?.days ?? []).length === 0 && <Text style={T.small}>아직 아이 기록이 없어요.</Text>}
          {(hist?.days ?? []).map((d) => (
            <View key={d.day} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={[T.small, { width: 74 }]}>{d.day.slice(5).replace('-', '/')}</Text>
              <Text style={{ flex: 1, fontSize: 14, color: C.text }}>
                대화 {d.sessions}번 · 따라 말하기 {d.repeat_ok}/{d.repeats}
                {d.words.length ? ` · ${d.words.join(', ')}` : ''}
              </Text>
            </View>
          ))}
        </Section>

        <Section title="사용 시간">
          <Text style={T.small}>대화 시간</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['09:00', '18:00'],
              ['10:00', '17:00'],
              ['08:00', '20:00'],
            ].map(([s, e]) => (
              <Chip key={s + e} label={`${s}~${e}`} selected={p.settings.start === s && p.settings.end === e} onPress={() => setSettings({ start: s, end: e })} />
            ))}
          </View>
          <Text style={T.small}>하루 사용 상한</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[20, 30, 60].map((m) => (
              <Chip key={m} label={m === 60 ? '1시간' : `${m}분`} selected={p.settings.dailyLimitMin === m} onPress={() => setSettings({ dailyLimitMin: m })} />
            ))}
          </View>
        </Section>

        <Section title="소리·진동·화면">
          <Text style={T.small}>소리 크기</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(
              [
                ['작게', 0.4],
                ['보통', 0.7],
                ['크게', 1],
              ] as const
            ).map(([label, v]) => (
              <Chip key={label} label={label} selected={Math.abs((p.settings.volume ?? 0.8) - v) < 0.16} onPress={() => setSettings({ volume: v })} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, color: C.text }}>진동 사용 (약하게, 짧게)</Text>
            <Switch value={p.settings.vibration} onValueChange={(v) => setSettings({ vibration: v })} trackColor={{ true: C.green }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, color: C.text }}>움직임 줄이기 (튀는 효과 한 번만)</Text>
            <Switch value={!!p.settings.reduceMotion} onValueChange={(v) => setSettings({ reduceMotion: v })} trackColor={{ true: C.green }} />
          </View>
        </Section>

        <Section title="부모 PIN">
          <Text style={T.small}>아이 모드에서 부모 모드로 돌아올 때 입력하는 숫자 4자리예요. 로그인 비밀번호와는 따로예요.</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={newPin}
              onChangeText={(t) => setNewPin(t.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder={p.pinHash ? '새 PIN' : 'PIN 정하기'}
              placeholderTextColor={C.muted}
              style={{ flex: 1, fontSize: 16, borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 12, color: C.text }}
            />
            <Button label="저장" style={{ minHeight: 44 }} onPress={savePin} />
          </View>
          {!!pinMsg && <Text style={{ color: pinMsg.includes('바꿨어요') ? C.ok : C.warn }}>{pinMsg}</Text>}
        </Section>

        <Section title="이 기기">
          <Text style={T.small}>지금 이 기기는 부모 폰으로 쓰고 있어요.</Text>
          <Button label="이 기기 데이터 삭제 · 처음부터 다시 가입" variant="ghost" onPress={restart} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}
