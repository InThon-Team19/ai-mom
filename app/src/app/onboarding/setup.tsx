// 온보딩 1-7 동의·설정·연결 — 담당: 태희 (민철 와이어프레임 기준)
// 페르소나 확정 카드(기획 2-1-1 ⑦) + 데이터 동의 2개(필수), 대화 시간대, 하루 사용 상한, 진동 사용, 태블릿 연결 코드(= profile.childId)
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { PersonaCard } from '@/components/PersonaCard';
import { Button, OnboardingScaffold } from '@/components/ui';
import { signup } from '@/lib/account';
import { pinHash, validPin } from '@/lib/pin';
import { registerThisDevice } from '@/lib/device';
import { updateProfile, useProfile, type Profile } from '@/lib/store';
import { C, R, T } from '@/theme';

const inputStyle = { fontSize: 16, borderWidth: 1, borderColor: C.border, borderRadius: R.sm, paddingHorizontal: 12, paddingVertical: 12, color: C.text } as const;

const hours = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `${String(from + i).padStart(2, '0')}:00`);
const START_TIMES = hours(6, 14);
const END_TIMES = hours(12, 22);
const LIMITS = [
  { min: 20, label: '20분' },
  { min: 30, label: '30분' },
  { min: 60, label: '1시간' },
];

/** "18:00" → "오후 06:00" (와이어프레임 표기) */
function ampm(t: string) {
  const [h, m] = t.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h < 12 ? '오전' : '오후'} ${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function Setup() {
  const p = useProfile();
  if (!p) return null;
  return <Form initial={p.settings} code={p.childId} profile={p} />;
}

function Form({ initial, code, profile }: { initial: Profile['settings']; code: string; profile: Profile }) {
  const [consentBio, setConsentBio] = useState(initial.consentBio);
  const [consentChild, setConsentChild] = useState(initial.consentChild);
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [limit, setLimit] = useState(initial.dailyLimitMin);
  const [vibration, setVibration] = useState(initial.vibration);
  const [open, setOpen] = useState<'start' | 'end' | 'limit' | null>(null);
  const [saving, setSaving] = useState(false);

  const [loginId, setLoginId] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [accountError, setAccountError] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');

  const timeOk = start < end; // "HH:00" 문자열 비교로 충분
  const accountOk = /^[a-zA-Z0-9_.@-]{3,40}$/.test(loginId.trim()) && pw.length >= 4 && pw === pw2;
  const pinOk = validPin(pin) && pin === pin2;
  const ready = consentBio && consentChild && timeOk && accountOk && pinOk && !saving;

  const finish = async () => {
    if (!ready) return;
    setSaving(true);
    setAccountError('');
    const acc = await signup(loginId, pw, code);
    if (!acc.ok) {
      setAccountError(acc.message);
      setSaving(false);
      return;
    }
    const p = await updateProfile({
      settings: { ...profile.settings, consentBio, consentChild, start, end, dailyLimitMin: limit, vibration },
      pinHash: await pinHash(code, pin),
      onboarded: true,
    });
    setTimeout(() => registerThisDevice(p.childId, 'parent'), 800); // 프로필 저장(PUT)이 먼저 끝나게
    router.replace('/parent');
  };

  const toggleOpen = (k: 'start' | 'end' | 'limit') => setOpen((o) => (o === k ? null : k));

  return (
    <OnboardingScaffold step={7} title="마지막으로 정해주세요" footer={<Button label="시작하기" disabled={!ready} onPress={finish} />}>
      <PersonaCard profile={profile} />

      <Section label="부모 계정 만들기">
        <Text style={T.small}>다른 폰에서 로그인하거나 앱을 다시 설치해도 우리 아이 정보를 그대로 불러와요.</Text>
        <TextInput value={loginId} onChangeText={setLoginId} autoCapitalize="none" autoCorrect={false} placeholder="아이디 (영문·숫자 3자 이상)" placeholderTextColor={C.muted} style={inputStyle} />
        <TextInput value={pw} onChangeText={setPw} secureTextEntry placeholder="비밀번호 (4자 이상)" placeholderTextColor={C.muted} style={inputStyle} />
        <TextInput value={pw2} onChangeText={setPw2} secureTextEntry placeholder="비밀번호 확인" placeholderTextColor={C.muted} style={inputStyle} />
        {pw2.length > 0 && pw !== pw2 && <Text style={{ color: C.warn }}>비밀번호가 서로 달라요.</Text>}
        {!!accountError && <Text style={{ color: C.warn }}>{accountError}</Text>}
      </Section>

      <Section label="부모 PIN (숫자 4자리)">
        <Text style={T.small}>아이 모드에서 부모 모드로 돌아올 때 써요. 아이가 모르게 정해 주세요.</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="PIN" placeholderTextColor={C.muted} style={[inputStyle, { flex: 1 }]} />
          <TextInput value={pin2} onChangeText={(t) => setPin2(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="PIN 확인" placeholderTextColor={C.muted} style={[inputStyle, { flex: 1 }]} />
        </View>
        {pin2.length === 4 && pin !== pin2 && <Text style={{ color: C.warn }}>PIN이 서로 달라요.</Text>}
      </Section>
      <Section label="데이터 동의">
        <Check checked={consentBio} onPress={() => setConsentBio((v) => !v)} label="내 목소리와 얼굴 영상으로 아바타를 만드는 데 동의합니다" />
        <Check checked={consentChild} onPress={() => setConsentChild((v) => !v)} label="아이의 음성·영상·터치 반응 수집에 보호자로서 동의합니다" />
      </Section>

      <Section label="대화 시간">
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={T.small}>시작</Text>
            <Select
              value={ampm(start)}
              open={open === 'start'}
              onToggle={() => toggleOpen('start')}
              options={START_TIMES.map((t) => ({ key: t, label: ampm(t) }))}
              selected={start}
              onSelect={(k) => {
                setStart(k);
                setOpen(null);
              }}
            />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={T.small}>끝</Text>
            <Select
              value={ampm(end)}
              open={open === 'end'}
              onToggle={() => toggleOpen('end')}
              options={END_TIMES.map((t) => ({ key: t, label: ampm(t) }))}
              selected={end}
              onSelect={(k) => {
                setEnd(k);
                setOpen(null);
              }}
            />
          </View>
        </View>
        {!timeOk && <Text style={{ fontSize: 13, color: C.warn }}>끝 시간은 시작 시간보다 늦어야 해요</Text>}
        <Text style={[T.small, { marginTop: 4 }]}>하루 사용 상한</Text>
        <Select
          value={LIMITS.find((l) => l.min === limit)?.label ?? `${limit}분`}
          open={open === 'limit'}
          onToggle={() => toggleOpen('limit')}
          options={LIMITS.map((l) => ({ key: String(l.min), label: l.label }))}
          selected={String(limit)}
          onSelect={(k) => {
            setLimit(Number(k));
            setOpen(null);
          }}
        />
      </Section>

      <Check checked={vibration} onPress={() => setVibration((v) => !v)} label="진동 사용 (약하게, 짧게)" />

      <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: R.md, padding: 16, gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: C.text }}>아이 태블릿 연결</Text>
        <Text style={T.small}>아이 태블릿에서 아이맘을 열고 이 코드를 입력하세요.</Text>
        <View style={{ backgroundColor: C.card, borderRadius: R.sm, paddingVertical: 14, alignItems: 'center' }}>
          <Text selectable style={{ fontSize: 30, fontWeight: '800', letterSpacing: 6, color: C.text }}>
            {code.slice(0, 3)} {code.slice(3)}
          </Text>
        </View>
      </View>
    </OnboardingScaffold>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{label}</Text>
      {children}
    </View>
  );
}

function Check({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 5,
          borderWidth: 2,
          borderColor: checked ? C.primaryStrong : C.sub,
          backgroundColor: checked ? C.primary : C.white,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {checked && <Text style={{ color: C.onPrimary, fontSize: 15, fontWeight: '900', lineHeight: 18 }}>✓</Text>}
      </View>
      <Text style={{ flex: 1, fontSize: 15, color: C.text, lineHeight: 22 }}>{label}</Text>
    </Pressable>
  );
}

/** 드롭다운 대신 누르면 아래로 펼쳐지는 목록 (새 의존성 없이) */
function Select({
  value,
  open,
  onToggle,
  options,
  selected,
  onSelect,
}: {
  value: string;
  open: boolean;
  onToggle: () => void;
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        style={{
          minHeight: 50,
          borderWidth: open ? 2 : 1,
          borderColor: open ? C.primaryStrong : C.sub,
          borderRadius: R.sm,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
        <Text style={{ fontSize: 16, color: C.text }}>{value}</Text>
        <Text style={{ fontSize: 14, color: C.text }}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open && (
        <View style={{ marginTop: 4, borderWidth: 1, borderColor: C.border, borderRadius: R.sm, overflow: 'hidden' }}>
          {options.map((o) => (
            <Pressable
              key={o.key}
              onPress={() => onSelect(o.key)}
              style={{ paddingHorizontal: 14, paddingVertical: 11, backgroundColor: o.key === selected ? C.primarySoft : C.white }}>
              <Text style={{ fontSize: 15, color: C.text, fontWeight: o.key === selected ? '700' : '400' }}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
