// 온보딩 1-7 동의·설정·연결 — 담당: 태희 (민철 디자인 Setup 보드 기준)
// 페르소나 확정 카드(기획 2-1-1 ⑦) + 부모 PIN + 데이터 동의 2개(필수), 대화 시간대·하루 사용 상한, 진동 사용, 태블릿 연결 코드
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { PersonaCard } from '@/components/PersonaCard';
import { Button, OnboardingScaffold, Toggle, fieldStyle } from '@/components/ui';
import { api, friendlyError } from '@/lib/api';
import { pinHash, validPin } from '@/lib/pin';
import { prefetchDay } from '@/lib/prefetch';
import { registerThisDevice } from '@/lib/device';
import { updateProfile, useProfile, type Profile } from '@/lib/store';
import { C, R, T } from '@/theme';
import { Text, TextInput } from '@/components/AppText';

const inputStyle = { ...fieldStyle, minHeight: 46, fontSize: 16 } as const;

const hours = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `${String(from + i).padStart(2, '0')}:00`);
const START_TIMES = hours(6, 14);
const END_TIMES = hours(12, 22);
const LIMITS = [
  { min: 20, label: '20분' },
  { min: 30, label: '30분' },
  { min: 60, label: '1시간' },
];

/** "18:00" → "오후 06:00" (펼친 목록 표기) */
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
  const [open, setOpen] = useState<'time' | 'limit' | null>(null);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [issued, setIssued] = useState<string | null>(null); // 가입 저장 후 받은 태블릿 연결 코드 (10분 유효)
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');

  const timeOk = start < end; // "HH:00" 문자열 비교로 충분
  const pinOk = (!pin && !pin2 && !!profile.pinHash) || (validPin(pin) && pin === pin2);
  const validation = !pinOk ? '부모 PIN 숫자 4자리와 PIN 확인을 동일하게 입력해 주세요.'
    : !consentBio || !consentChild ? '데이터 동의 두 항목을 모두 체크해 주세요.'
    : !timeOk ? '대화 끝 시간을 시작 시간보다 늦게 선택해 주세요.' : '';

  const finish = async () => {
    if (saving) return;
    if (validation) { setError(validation); return; }
    setSaving(true);
    setError('');
    try {
      const settings = { ...profile.settings, consentBio, consentChild, start, end, dailyLimitMin: limit, vibration };
      const hash = pin ? await pinHash(code, pin) : profile.pinHash;
      await api.putProfile(profile.childId, { settings, pinHash: hash, onboarded: true });
      const p = await updateProfile({
        settings: { ...profile.settings, consentBio, consentChild, start, end, dailyLimitMin: limit, vibration },
        pinHash: hash,
        onboarded: true,
      });
      // 이 화면에서 정한 것만 서버에 확실히 저장 (태블릿 연결은 가입 완료 뒤에만 됨)
      const r = await api.reissueLinkCode(p.childId); // 지금 쓸 수 있는 연결 코드 (10분 유효)
      setIssued(r.linkCode);
      registerThisDevice(p.childId, 'parent');
      prefetchDay(p, p.day);
    } catch (e) {
      setError(friendlyError(e, '서버에 저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleOpen = (k: 'time' | 'limit') => setOpen((o) => (o === k ? null : k));
  const limitLabel = LIMITS.find((l) => l.min === limit)?.label ?? `${limit}분`;

  // 디자인 Setup: 페르소나 요약 · PIN 두 칸 · 데이터 동의 · 대화 시간 두 칸 + 진동 토글 · 노랑 점선 연결 코드 상자
  return (
    <OnboardingScaffold
      step={7}
      titleSize={24}
      title="마지막으로 몇 가지만 정해 주세요"
      footer={
        issued ? (
          <Button label="부모 앱으로" onPress={() => router.replace('/parent')} />
        ) : (
          <Button label={saving ? '저장하는 중…' : '시작하기'} disabled={saving} onPress={finish} />
        )
      }>
      <PersonaCard profile={profile} />
      {!!validation && <Text style={{ fontSize: 13, color: C.warn }}>{validation}</Text>}

      <Section label="부모 PIN (숫자 4자리)">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            placeholder="PIN"
            placeholderTextColor={C.sub}
            accessibilityLabel="부모 PIN"
            style={[inputStyle, { flex: 1 }]}
          />
          <TextInput
            value={pin2}
            onChangeText={(t) => setPin2(t.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            placeholder="PIN 확인"
            placeholderTextColor={C.sub}
            accessibilityLabel="부모 PIN 확인"
            style={[inputStyle, { flex: 1 }]}
          />
        </View>
        {pin2.length === 4 && pin !== pin2 ? (
          <Text style={{ fontSize: 12, color: C.warn }}>PIN이 서로 달라요.</Text>
        ) : (
          <Text style={{ fontSize: 12, lineHeight: 18, color: C.sub }}>아이 모드에서 부모 모드로 돌아올 때 써요. 로그인 비밀번호와는 달라요.</Text>
        )}
      </Section>

      <Section label="데이터 동의">
        <Check checked={consentBio} onPress={() => setConsentBio((v) => !v)} label="내 목소리와 입모양 수치로 아바타를 만드는 데 동의해요 (얼굴 영상은 저장하지 않아요)" />
        <Check checked={consentChild} onPress={() => setConsentChild((v) => !v)} label="보호자로서 아이의 목소리·표정·터치 반응을 기록하는 데 동의해요" />
      </Section>

      <Section label="대화 시간">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <BoxButton label={`${start} ~ ${end}`} open={open === 'time'} onPress={() => toggleOpen('time')} a11y="대화 시간대 고르기" />
          <BoxButton label={`하루 ${limitLabel}`} open={open === 'limit'} onPress={() => toggleOpen('limit')} a11y="하루 사용 상한 고르기" />
        </View>
        {open === 'time' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={T.small}>시작</Text>
              <OptionList options={START_TIMES.map((t) => ({ key: t, label: ampm(t) }))} selected={start} onSelect={setStart} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={T.small}>끝</Text>
              <OptionList options={END_TIMES.map((t) => ({ key: t, label: ampm(t) }))} selected={end} onSelect={setEnd} />
            </View>
          </View>
        )}
        {open === 'limit' && (
          <OptionList
            options={LIMITS.map((l) => ({ key: String(l.min), label: `하루 ${l.label}` }))}
            selected={String(limit)}
            onSelect={(k) => {
              setLimit(Number(k));
              setOpen(null);
            }}
          />
        )}
        {!timeOk && <Text style={{ fontSize: 12, color: C.warn }}>끝 시간은 시작 시간보다 늦어야 해요</Text>}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, gap: 12 }}>
          <Text style={{ flex: 1, fontSize: 14, color: C.text }}>진동 쓰기 (짧고 약하게만)</Text>
          <Toggle value={vibration} onChange={setVibration} label="진동 쓰기" />
        </View>
      </Section>

      <View style={{ borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: C.primaryStrong, backgroundColor: C.primarySoft, padding: 12, alignItems: 'center', gap: 4 }}>
        {issued ? (
          <>
            <Text style={{ fontSize: 12, color: C.sub, textAlign: 'center' }}>아이 태블릿에서 이 코드를 입력해 주세요 · 10분 동안 한 번만</Text>
            <Text selectable style={{ fontSize: 28, fontWeight: '900', letterSpacing: 6, color: C.text }}>
              {issued}
            </Text>
            <Text style={{ fontSize: 11, color: C.sub, textAlign: 'center' }}>시간이 지나면 설정 탭에서 새로 받으면 돼요.</Text>
          </>
        ) : (
          <Text style={{ fontSize: 12, lineHeight: 18, color: C.sub, textAlign: 'center' }}>
            {'"시작하기"를 누르면 가입이 저장되고\n여기에 아이 태블릿 연결 코드가 나와요.'}
          </Text>
        )}
      </View>
      {!!error && <Text style={{ fontSize: 13, color: C.warn }}>{error}</Text>}
    </OnboardingScaffold>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: '800', color: C.text }}>{label}</Text>
      {children}
    </View>
  );
}

/** 동의 체크 (디자인: 20px 노랑 네모) */
function Check({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }} hitSlop={4} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
      <View
        style={{
          width: 20,
          height: 20,
          marginTop: 1,
          borderRadius: 5,
          borderWidth: checked ? 0 : 2,
          borderColor: C.border,
          backgroundColor: checked ? C.primary : C.white,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {checked && <Text style={{ color: C.onPrimary, fontSize: 13, fontWeight: '900', lineHeight: 16 }}>✓</Text>}
      </View>
      <Text style={{ flex: 1, fontSize: 13, lineHeight: 20, color: C.text }}>{label}</Text>
    </Pressable>
  );
}

/** 대화 시간 칸 (디자인: 흰 바탕 · 1px 테두리 · 가운데 글자). 누르면 아래 목록이 펼쳐짐 */
function BoxButton({ label, open, onPress, a11y }: { label: string; open: boolean; onPress: () => void; a11y: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ expanded: open }}
      style={{
        flex: 1,
        minHeight: 44,
        padding: 10,
        borderRadius: R.sm,
        borderWidth: open ? 2 : 1,
        borderColor: open ? C.primaryStrong : C.border,
        backgroundColor: open ? C.primarySoft : C.white,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ fontSize: 14, color: C.text, fontWeight: open ? '700' : '400' }}>{label}</Text>
    </Pressable>
  );
}

/** 펼친 선택 목록 (새 의존성 없이) */
function OptionList({ options, selected, onSelect }: { options: { key: string; label: string }[]; selected: string; onSelect: (key: string) => void }) {
  return (
    <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: R.sm, overflow: 'hidden', backgroundColor: C.white }}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => onSelect(o.key)}
          accessibilityRole="button"
          accessibilityState={{ selected: o.key === selected }}
          style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: o.key === selected ? C.primarySoft : C.white }}>
          <Text style={{ fontSize: 14, color: C.text, fontWeight: o.key === selected ? '700' : '400' }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
