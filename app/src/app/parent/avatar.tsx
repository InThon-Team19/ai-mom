// 부모 앱 아바타 탭 "내 아바타" (민철 디자인 AvatarLearn / AvatarEdit): 학습하기 | 꾸미기 — 담당: 태희
// 학습하기: 음성·입모양 학습률 카드 + 인식 카메라(FaceGuide) + 문장 읽기(useReadAloud). 영상은 저장하지 않고 입 벌림 수치만 서버로
// 꾸미기: 실제 얼굴이 아닌 캐릭터 고르기 (온보딩 1-4 와 같은 선택지) → updateProfile 로 저장
import { router, useFocusEffect, useIsFocused, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Avatar, AVATAR_OPTIONS, avatarFor, type AvatarCategory, type AvatarConfig } from '@/components/Avatar';
import { FaceGuide, ReadingText, doneSignal, useReadingWord } from '@/components/FaceGuide';
import type { FaceFrame } from '@/components/FaceTracker';
import { RingGauge } from '@/components/RingGauge';
import { BigButton, MicButton, Panel, PillChip } from '@/components/ui';
import { MOUTH_SENTENCES, VOICE_SENTENCES, fill } from '@/content/curriculum';
import { useReadAloud } from '@/hooks/useReadAloud';
import { useDevice } from '@/lib/layout';
import { updateProfile, useProfile, type Profile } from '@/lib/store';
import type { Gauge } from '@/lib/types';
import { C, R } from '@/theme';
import { Text } from '@/components/AppText';

type Mode = 'learn' | 'edit';

const CATEGORIES: { key: AvatarCategory; label: string }[] = [
  { key: 'face', label: '얼굴형' },
  { key: 'hair', label: '머리' },
  { key: 'eyes', label: '눈' },
  { key: 'outfit', label: '옷' },
  { key: 'color', label: '색' },
];

/** 카메라 아이콘 (촬영 시작 카드) */
const CameraIcon = ({ color = C.text, size = 44 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" stroke={color} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
    <Path d="M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" stroke={color} strokeWidth={1.8} fill="none" />
  </Svg>
);

export default function AvatarTab() {
  const profile = useProfile();
  const [mode, setMode] = useState<Mode>('learn');
  const [locked, setLocked] = useState(false); // 녹음 중에는 탭 전환 막기
  const { frame } = useDevice();

  if (!profile) return <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={[{ padding: 20, paddingTop: 24, gap: 14, flexGrow: 1 }, frame]}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: C.text }}>내 아바타</Text>
          <Text style={{ fontSize: 13, color: C.sub }}>
            {mode === 'learn' ? '읽어 줄수록 부모님 목소리·입모양을 닮아 가요.' : '실제 얼굴이 아닌 캐릭터예요. 언제든 바꿀 수 있어요.'}
          </Text>
        </View>

        {/* 학습하기 | 꾸미기 */}
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: C.track }}>
          {(
            [
              ['learn', '학습하기'],
              ['edit', '꾸미기'],
            ] as const
          ).map(([k, label]) => {
            const on = mode === k;
            return (
              <Pressable
                key={k}
                accessibilityRole="tab"
                accessibilityState={{ selected: on, disabled: locked && !on }}
                disabled={locked && !on}
                onPress={() => setMode(k)}
                style={{ flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.white : 'transparent', opacity: locked && !on ? 0.5 : 1 }}>
                <Text style={{ fontSize: 14, fontWeight: on ? '800' : '500', color: on ? C.text : C.sub }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {mode === 'learn' ? <Learn profile={profile} onLock={setLocked} /> : <Edit profile={profile} />}
      </ScrollView>
    </SafeAreaView>
  );
}

/** 학습률 카드: 작은 링 + 남은 % */
function GaugeCard({ label, g, color }: { label: string; g: Gauge; color?: string }) {
  const left = Math.max(0, Math.round((1 - g.progress) * 100));
  return (
    <Panel style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
      <RingGauge progress={g.progress} baseline={g.baseline} size={58} stroke={7} color={color} showTick={false} showBaselineText={false} fontScale={0.24} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>{label}</Text>
        <Text style={{ fontSize: 12, color: g.usable ? C.ok : C.sub, fontWeight: g.usable && left === 0 ? '700' : '400' }}>
          {left === 0 ? '다 배웠어요' : `${left}% 남았어요`}
        </Text>
      </View>
    </Panel>
  );
}

function Learn({ profile, onLock }: { profile: Profile; onLock: (v: boolean) => void }) {
  const focused = useIsFocused(); // 다른 탭에 있을 때는 카메라를 끔
  const device = useDevice();
  const name = profile.child.nickname || profile.child.name;
  const me = profile.parent.title;
  // 학습용 문장: 가입 때 쓰는 목소리·입모양 문장 (내일 계획 낭독은 피드백 → 낭독하기)
  const sentences = useMemo(
    () => [...VOICE_SENTENCES, ...MOUTH_SENTENCES].filter((t, i, a) => a.indexOf(t) === i).map((t) => fill(t, { name, me })),
    [name, me],
  );
  const ra = useReadAloud({ childId: profile.childId, sentences, kind: 'signup', camera: true });
  const [camError, setCamError] = useState('');
  const reading = useReadingWord(sentences[ra.index] ?? '', ra.recording);
  const { onFrame: raFrame } = ra;
  const { feed } = reading;
  const onFrame = useCallback(
    (f: FaceFrame) => {
      raFrame(f);
      feed(f);
    },
    [raFrame, feed],
  );

  // 녹음 중 다른 탭으로 가면 카메라와 함께 마이크도 끔 (보내지 않음)
  const { cancel, recording } = ra;
  useEffect(() => {
    if (!focused && recording) cancel();
  }, [focused, recording, cancel]);

  // 탭에 들어오자마자 카메라를 켜지 않음: '촬영 시작하기'를 눌러야 카메라·읽기 버튼이 켜짐. 탭을 떠나면 다시 시작 카드로
  const [camOn, setCamOn] = useState(false);
  useFocusEffect(useCallback(() => () => setCamOn(false), []));
  const showCam = camOn && focused;
  const endCam = () => {
    if (ra.recording) ra.cancel(); // 탭을 떠날 때와 같이 녹음은 보내지 않고 멈춤
    setCamOn(false);
  };

  const lock = ra.recording || ra.busy;
  // 녹음 중에는 꾸미기로 못 넘어가게
  useEffect(() => {
    onLock(lock);
  }, [lock, onLock]);

  const move = (d: number) => {
    if (lock) return;
    ra.setIndex((i) => Math.max(0, Math.min(sentences.length - 1, i + d)));
  };
  const status = ra.statuses[ra.index];

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <GaugeCard label="음성" g={ra.voice} />
        <GaugeCard label="입모양" g={ra.mouth} color={C.green} />
      </View>

      {/* 인식 카메라: 얼굴 틀·입 윤곽은 FaceGuide 가 실제 인식값으로만 그림. 아래 알약이 얼굴 인식 상태 */}
      <View style={{ gap: 6 }}>
        <View style={{ alignSelf: 'center' }}>
          {!showCam ? (
            <View
              style={{
                ...device.camera,
                borderRadius: 18,
                borderWidth: 2,
                borderBottomWidth: 4,
                borderColor: C.primaryStrong,
                backgroundColor: C.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: 16,
              }}>
              <CameraIcon color={C.link} />
              <Text style={{ fontSize: 15, fontWeight: '700', lineHeight: 22, color: C.text, textAlign: 'center' }}>
                카메라로 읽으면 목소리와 입모양을 함께 배워요
              </Text>
              <BigButton label="촬영 시작하기" onPress={() => setCamOn(true)} style={{ alignSelf: 'center', width: '100%', maxWidth: 320 }} />
            </View>
          ) : focused ? (
            <FaceGuide
              onFrame={onFrame}
              onError={setCamError}
              recording={ra.recording}
              doneCount={doneSignal(ra.statuses, ra.allDone)}
              overlay
              caption="얼굴은 저장하지 않고 입 벌림 수치만 남겨요"
              style={{ ...device.camera, borderRadius: 18, backgroundColor: '#3A3128', overflow: 'hidden' }}
            />
          ) : (
            <View style={{ ...device.camera, borderRadius: 18, backgroundColor: '#3A3128' }} />
          )}
          {showCam && (
            <View pointerEvents="none" style={{ position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.pill, backgroundColor: '#4E4338' }}>
              <Text style={{ fontSize: 12, color: C.bg }}>인식 카메라</Text>
            </View>
          )}
        </View>
        {!showCam && <Text style={{ fontSize: 12, color: C.sub, textAlign: 'center' }}>얼굴은 저장하지 않고 입 벌림 수치만 남겨요</Text>}
        {showCam && (
          <Pressable
            onPress={endCam}
            accessibilityRole="button"
            accessibilityLabel="촬영 끝내기"
            hitSlop={6}
            style={{ alignSelf: 'center', minHeight: 44, paddingHorizontal: 16, borderRadius: R.pill, borderWidth: 2, borderColor: C.border, backgroundColor: C.white, justifyContent: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>촬영 끝내기</Text>
          </Pressable>
        )}
        {!!camError && <Text style={{ fontSize: 12, color: C.warn }}>카메라를 켜지 못했어요. 카메라 권한을 확인해 주세요.</Text>}
      </View>

      <Panel tone="yellow" style={{ gap: 4, padding: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: C.sub }}>{status === 'retry' ? '한 번 더 읽어 주세요' : status === 'done' ? '읽었어요' : '이 문장을 읽어 주세요'}</Text>
          <Text style={{ fontSize: 12, color: C.sub }}>
            {ra.index + 1} / {sentences.length}
          </Text>
        </View>
        <Text style={{ fontSize: 19, fontWeight: '800', color: C.text }}>
          <ReadingText text={sentences[ra.index] ?? ''} word={reading.word} />
        </Text>
      </Panel>

      {!!ra.message && (
        <Text style={{ fontSize: 14, fontWeight: '600', textAlign: 'center', color: ra.message === '좋아요!' ? C.ok : C.warn }}>{ra.message}</Text>
      )}

      <View style={{ flex: 1, minHeight: 4 }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          onPress={() => move(-1)}
          disabled={!showCam || lock || ra.index === 0}
          accessibilityRole="button"
          style={{ minWidth: 84, height: 44, justifyContent: 'center', opacity: !showCam || lock || ra.index === 0 ? 0.4 : 1 }}>
          <Text style={{ fontSize: 15, color: C.sub }}>이전 문장</Text>
        </Pressable>
        <MicButton recording={ra.recording} onPress={ra.toggle} disabled={!showCam || ra.busy} size={72} shadow />
        <Pressable
          onPress={() => move(1)}
          disabled={!showCam || lock || ra.index >= sentences.length - 1}
          accessibilityRole="button"
          style={{ minWidth: 84, height: 44, justifyContent: 'center', alignItems: 'flex-end', opacity: !showCam || lock || ra.index >= sentences.length - 1 ? 0.4 : 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.link }}>다음 문장</Text>
        </Pressable>
      </View>
      <Text style={{ fontSize: 12, color: C.sub, textAlign: 'center' }}>
        {ra.busy ? '보내는 중...' : ra.recording ? `읽는 중 · ${ra.seconds}초 — 다 읽으면 다시 눌러 주세요` : showCam ? '마이크를 누르고 문장을 읽어 주세요' : '촬영을 시작하면 읽을 수 있어요'}
      </Text>
    </>
  );
}

function Edit({ profile }: { profile: Profile }) {
  const [config, setConfig] = useState<AvatarConfig>(avatarFor(profile.avatar, profile.parent.title));
  const [cat, setCat] = useState<AvatarCategory>('face');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const options: readonly string[] = AVATAR_OPTIONS[cat];
  const changed = JSON.stringify(config) !== JSON.stringify(profile.avatar);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateProfile({ avatar: config });
      setMsg('저장했어요. 아이 화면에도 바로 반영돼요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View style={{ height: 200, borderRadius: 18, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }} accessibilityLabel="아바타 미리보기">
        <Avatar config={config} size={160} expression="smile" />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CATEGORIES.map((c) => (
          <PillChip key={c.key} label={c.label} selected={cat === c.key} onPress={() => setCat(c.key)} />
        ))}
      </View>

      <View style={{ gap: 8 }}>
        {[0, 1].map((row) => (
          <View key={row} style={{ flexDirection: 'row', gap: 8 }}>
            {options.slice(row * 4, row * 4 + 4).map((label, j) => {
              const i = row * 4 + j;
              const selected = config[cat] === i;
              return (
                <Pressable
                  key={`${cat}-${i}`}
                  accessibilityRole="button"
                  accessibilityLabel={cat === 'color' ? `피부색 ${i + 1}` : label}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setMsg('');
                    setConfig((c) => ({ ...c, [cat]: i }));
                  }}
                  style={{
                    flex: 1,
                    minHeight: 68,
                    paddingVertical: 4,
                    borderRadius: 14,
                    borderWidth: 2,
                    borderBottomWidth: 4,
                    borderColor: selected ? C.primaryStrong : C.border,
                    backgroundColor: selected ? C.primarySoft : C.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}>
                  {cat === 'color' ? (
                    <Avatar config={{ ...config, [cat]: i }} size={44} blink={false} />
                  ) : (
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: selected ? '700' : '400', color: C.text }}>
                      {label}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => router.push('/onboarding/parent?edit=1' as Href)}
        accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
        <Text style={{ flex: 1, fontSize: 14, color: C.text }}>
          말투·호칭 바꾸기 <Text style={{ color: C.sub }}>({profile.parent.title} · {profile.parent.tone})</Text>
        </Text>
        <Text style={{ fontSize: 20, color: C.sub }}>›</Text>
      </Pressable>

      <View style={{ flex: 1, minHeight: 4 }} />
      {!!msg && <Text style={{ fontSize: 14, fontWeight: '700', color: C.ok, textAlign: 'center' }}>{msg}</Text>}
      <BigButton label={saving ? '저장 중...' : '저장하기'} disabled={saving || !changed} onPress={save} />
    </>
  );
}
