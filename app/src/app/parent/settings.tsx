// 부모 앱 설정 탭 — 담당: 태희 (민철 디자인 Settings 보드 기준. 아바타 모습 바꾸기는 아바타 탭 '꾸미기')
// 아이 모드로 바꾸기 · 로그인 · 아이 기기 연결(코드·등록된 기기) · 감각 자극 줄이기(진동·움직임·소리) · 사용 시간·학습 이력·아이 정보·부모 PIN · 이 기기 기록 지우기
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountSection } from '@/components/AccountSection';
import { RingGauge } from '@/components/RingGauge';
import { Button, Chip, Toggle, fieldStyle } from '@/components/ui';
import { logoutAccount } from '@/lib/account';
import { api, friendlyError } from '@/lib/api';
import { getDeviceId } from '@/lib/device';
import { pinHash, validPin } from '@/lib/pin';
import { dayAdvancePatch } from '@/lib/progress';
import { refreshProfile, resetLocal, setRole, updateProfile, useProfile, type Profile } from '@/lib/store';
import type { Gauge, History } from '@/lib/types';
import { C, T } from '@/theme';
import { useDevice } from '@/lib/layout';
import { Text, TextInput } from '@/components/AppText';

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (sec: number) => {
  const d = new Date(sec * 1000);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** 마지막 사용: 5분 안이면 "지금", 오늘이면 "오늘 10:40", 아니면 "10/31 10:40" */
const seen = (sec: number) => {
  const d = new Date(sec * 1000);
  const now = new Date();
  if (now.getTime() - d.getTime() < 5 * 60 * 1000) return '지금';
  if (d.toDateString() === now.toDateString()) return `오늘 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return fmt(sec);
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

/** 디자인 카드: 흰 바탕 · 1px 연한 테두리 · 모서리 14 · 굵은 제목 */
function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.white, padding: 12, gap: 8 }}>
      {!!title && <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>{title}</Text>}
      {children}
    </View>
  );
}

/** 이름 ─ 값 › 한 줄 (누르면 펼치거나 이동) */
function NavRow({ label, value, onPress, open }: { label: string; value?: string; onPress: () => void; open?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={open === undefined ? undefined : { expanded: open }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 }}>
      <Text style={{ flex: 1, fontSize: 14, color: C.text }}>{label}</Text>
      {!!value && (
        <Text style={{ flexShrink: 1, fontSize: 14, color: C.sub }} numberOfLines={1}>
          {value}
        </Text>
      )}
      <Text style={{ fontSize: 16, color: C.sub, transform: [{ rotate: open ? '90deg' : '0deg' }] }}>›</Text>
    </Pressable>
  );
}

const Divider = () => <View style={{ height: 1, backgroundColor: C.track }} />;

const VOLUMES = [
  { label: '작게', v: 0.4 },
  { label: '보통', v: 0.7 },
  { label: '크게', v: 1 },
] as const;

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
  const [open, setOpen] = useState<'time' | 'history' | 'pin' | null>(null);

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
  const toggle = (k: 'time' | 'history' | 'pin') => setOpen((o) => (o === k ? null : k));
  const hasTablet = (p.devices ?? []).some((d) => d.role === 'child');
  const getCode = async () => {
    setBusy(true);
    try {
      const r = await api.reissueLinkCode(p.childId);
      setIssued(r.linkCode);
      load();
    } catch (e) {
      Alert.alert('연결 코드를 받지 못했어요', friendlyError(e));
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
            Alert.alert('새 연결 코드를 받지 못했어요', friendlyError(e));
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
    confirm('이 기기 기록을 지울까요?', '이 기기에 저장된 가입 정보가 지워지고 처음부터 다시 가입해요. (서버의 학습 기록은 남아요)', '지우기', async () => {
      // 로그인도 끊어야 함: 계정 토큰이 남아 있으면 부모 모드로 들어갈 때 같은 가족 정보를 되살려 그대로 부모 앱으로 돌아감
      await logoutAccount();
      await resetLocal();
      router.replace('/');
    });

  const setSettings = (patch: Partial<Profile['settings']>) => {
    updateProfile({ settings: { ...p.settings, ...patch } });
  };

  const recent = [...(hist?.voice ?? []).map((v) => ({ ...v, type: '목소리' })), ...(hist?.mouth ?? []).map((m) => ({ ...m, type: '입모양' }))]
    .sort((a, b) => b.at - a.at)
    .slice(0, 8);
  const volume = p.settings.volume ?? 0.8;
  const volIdx = VOLUMES.reduce((best, x, i) => (Math.abs(x.v - volume) < Math.abs(VOLUMES[best].v - volume) ? i : best), 0);
  const limitText = p.settings.dailyLimitMin === 60 ? '1시간' : `${p.settings.dailyLimitMin}분`;
  const historyText = p.readingDone ? `${p.day}일차 · 낭독 완료` : `${p.day}일차 진행 중`;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={[{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 40, gap: 12 }, frame]} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>설정</Text>

        {/* 기획 2-5: 설정 탭 맨 위는 '아이 모드로 바꾸기' */}
        <Button label="이 기기를 아이 모드로 바꾸기" onPress={toChild} style={{ minHeight: 50 }} textStyle={{ fontSize: 15 }} />
        {!p.pinHash && <Text style={[T.small, { color: C.warn }]}>부모 PIN이 아직 없어요. 아래 “부모 PIN 바꾸기”에서 먼저 정해 주세요.</Text>}

        <Section title="로그인">
          <AccountSection childId={p.childId} />
        </Section>

        <Section title="아이 기기 연결">
          <Text style={{ fontSize: 12, lineHeight: 18, color: C.sub }}>
            {hasTablet ? '새 코드를 받으면 연결된 태블릿은 다시 연결해야 해요.' : '코드를 받아 아이 태블릿에 입력하면 연결돼요.'} 코드는 10분 동안 한 번만 쓸 수 있어요.
          </Text>
          {(p.devices ?? []).length === 0 && <Text style={T.small}>아직 등록된 기기가 없어요.</Text>}
          {(p.devices ?? [])
            .slice()
            .sort((a, b) => (a.role === b.role ? b.last_seen - a.last_seen : a.role === 'child' ? -1 : 1))
            .map((d) => (
              <View key={d.device_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 32 }}>
                <Text style={{ flex: 1, fontSize: 14, color: C.text }} numberOfLines={1}>
                  {d.name || '기기'} · {d.role === 'parent' ? '부모' : '아이'}
                  {d.device_id === me && <Text style={{ color: C.link }}> (이 기기)</Text>}
                </Text>
                <Text style={{ fontSize: 13, color: C.sub }}>{d.device_id === me ? '지금' : seen(d.last_seen)}</Text>
                {d.device_id !== me && (
                  <Pressable onPress={() => unlink(d.device_id, d.name || '기기')} hitSlop={8} accessibilityRole="button" style={{ minHeight: 32, justifyContent: 'center' }}>
                    <Text style={{ fontSize: 13, color: C.warn, fontWeight: '700' }}>해제</Text>
                  </Pressable>
                )}
              </View>
            ))}
          {issued && (
            <View style={{ borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: C.primaryStrong, backgroundColor: C.primarySoft, paddingVertical: 10, alignItems: 'center' }}>
              <Text selectable style={{ fontSize: 28, fontWeight: '900', letterSpacing: 6, color: C.text }}>
                {issued}
              </Text>
            </View>
          )}
          <Pressable onPress={reissue} disabled={busy} accessibilityRole="button" hitSlop={6} style={{ minHeight: 32, justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.link }}>{busy ? '받는 중…' : issued ? '새 코드 다시 받기' : '연결 코드 받기'}</Text>
          </Pressable>
        </Section>

        <Section title="감각 자극 줄이기">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 34 }}>
            <Text style={{ flex: 1, fontSize: 14, color: C.text }}>진동 <Text style={{ fontSize: 12, color: C.sub }}>(짧고 약하게)</Text></Text>
            <Toggle value={p.settings.vibration} onChange={(v) => setSettings({ vibration: v })} label="진동" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 34 }}>
            <Text style={{ flex: 1, fontSize: 14, color: C.text }}>움직임 줄이기 <Text style={{ fontSize: 12, color: C.sub }}>(튀는 효과 한 번만)</Text></Text>
            <Toggle value={!!p.settings.reduceMotion} onChange={(v) => setSettings({ reduceMotion: v })} label="움직임 줄이기" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 34, gap: 12 }}>
            <Text style={{ fontSize: 14, color: C.text }}>소리 크기</Text>
            {/* 디자인의 막대: 슬라이더 대신 세 칸 (작게·보통·크게) — 새 네이티브 의존성 없이 */}
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }} accessibilityRole="adjustable" accessibilityLabel={`소리 크기 ${VOLUMES[volIdx].label}`}>
              {VOLUMES.map((x, i) => (
                <Pressable key={x.label} onPress={() => setSettings({ volume: x.v })} hitSlop={{ top: 14, bottom: 14 }} accessibilityLabel={`소리 ${x.label}`} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 40, height: 6, borderRadius: 3, backgroundColor: i <= volIdx ? C.primaryStrong : C.border }} />
                  <Text style={{ fontSize: 11, color: i === volIdx ? C.text : C.sub, fontWeight: i === volIdx ? '700' : '400' }}>{x.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Section>

        <Section>
          <NavRow label="사용 시간" value={`${p.settings.start}~${p.settings.end} · 하루 ${limitText}`} open={open === 'time'} onPress={() => toggle('time')} />
          {open === 'time' && (
            <View style={{ gap: 8, paddingBottom: 6 }}>
              <Text style={T.small}>대화 시간</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[
                  ['09:00', '18:00'],
                  ['10:00', '17:00'],
                  ['08:00', '20:00'],
                ].map(([s, e]) => (
                  <Chip small key={s + e} label={`${s}~${e}`} selected={p.settings.start === s && p.settings.end === e} onPress={() => setSettings({ start: s, end: e })} />
                ))}
              </View>
              <Text style={T.small}>하루 사용 상한</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[20, 30, 60].map((m) => (
                  <Chip small key={m} label={m === 60 ? '1시간' : `${m}분`} selected={p.settings.dailyLimitMin === m} onPress={() => setSettings({ dailyLimitMin: m })} />
                ))}
              </View>
            </View>
          )}
          <Divider />
          <NavRow label="학습 이력" value={historyText} open={open === 'history'} onPress={() => toggle('history')} />
          {open === 'history' && (
            <View style={{ gap: 8, paddingBottom: 6 }}>
              <Text style={{ fontSize: 13, color: C.text }}>
                {p.readingDone ? `낭독 완료 · 다음에 아이 화면을 켜면 ${p.readingDone.forDay}일차` : '오늘 밤 낭독하면 다음날 넘어가요'}
              </Text>
              {!!p.readingDone && <Chip small label="시연: 지금 다음 일차로 넘기기" onPress={nextDayNow} />}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <RingGauge progress={voice?.progress ?? 0} baseline={voice?.baseline} size={80} stroke={9} label="음성" />
                <RingGauge progress={mouth?.progress ?? 0} baseline={mouth?.baseline} size={80} stroke={9} label="입모양" color={C.green} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                <Chip small label="목소리 더 녹음" onPress={() => router.push('/onboarding/voice?edit=1' as Href)} />
                <Chip small label="입모양 더 촬영" onPress={() => router.push('/onboarding/mouth?edit=1' as Href)} />
              </View>
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, marginTop: 4 }}>최근 낭독</Text>
              {recent.length === 0 && <Text style={T.small}>아직 기록이 없어요.</Text>}
              {recent.map((r, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Text style={[T.small, { fontSize: 12, width: 70 }]}>{fmt(r.at)}</Text>
                  <Text style={[T.small, { fontSize: 12, width: 70 }]}>
                    {r.type}·{r.kind === 'plan' ? '밤 낭독' : '가입'}
                  </Text>
                  <Text style={{ flex: 1, fontSize: 13, color: C.text }} numberOfLines={1}>
                    {r.text || '-'}
                  </Text>
                  <Text style={{ color: r.ok ? C.ok : C.warn }}>{r.ok ? '✓' : '↻'}</Text>
                </View>
              ))}
              <Text style={{ fontSize: 13, fontWeight: '800', color: C.text, marginTop: 4 }}>아이 하루 기록</Text>
              {(hist?.days ?? []).length === 0 && <Text style={T.small}>아직 아이 기록이 없어요.</Text>}
              {(hist?.days ?? []).map((d) => (
                <View key={d.day} style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={[T.small, { fontSize: 12, width: 70 }]}>{d.day.slice(5).replace('-', '/')}</Text>
                  <Text style={{ flex: 1, fontSize: 13, color: C.text }}>
                    대화 {d.sessions}번 · 따라 말하기 {d.repeat_ok}/{d.repeats}
                    {d.words.length ? ` · ${d.words.join(', ')}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Divider />
          <NavRow
            label="아이 정보 바꾸기"
            value={`${p.child.nickname || p.child.name || '-'} · ${p.child.level}`}
            onPress={() => router.push('/onboarding/child?edit=1' as Href)}
          />
          <Divider />
          <NavRow label="말투·호칭 바꾸기" value={`${p.parent.title} · ${p.parent.tone}`} onPress={() => router.push('/onboarding/parent?edit=1' as Href)} />
          <Divider />
          <NavRow label="부모 PIN 바꾸기" value={p.pinHash ? undefined : '아직 없어요'} open={open === 'pin'} onPress={() => toggle('pin')} />
          {open === 'pin' && (
            <View style={{ gap: 6, paddingBottom: 6 }}>
              <Text style={{ fontSize: 12, lineHeight: 18, color: C.sub }}>아이 모드에서 부모 모드로 돌아올 때 입력하는 숫자 4자리예요. 로그인 비밀번호와는 따로예요.</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={newPin}
                  onChangeText={(t) => setNewPin(t.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  placeholder={p.pinHash ? '새 PIN' : 'PIN 정하기'}
                  placeholderTextColor={C.sub}
                  accessibilityLabel="새 부모 PIN"
                  style={[fieldStyle, { flex: 1, minHeight: 44, fontSize: 16 }]}
                />
                <Button label="저장" style={{ minHeight: 44 }} onPress={savePin} />
              </View>
              {!!pinMsg && <Text style={{ fontSize: 13, color: pinMsg.includes('바꿨어요') ? C.ok : C.warn }}>{pinMsg}</Text>}
            </View>
          )}
        </Section>

        <Pressable onPress={restart} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' }}>
          <Text style={{ fontSize: 13, color: C.warn, textDecorationLine: 'underline' }}>이 기기 기록 지우기 · 처음부터 다시 가입</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

