// 아이 태블릿 3-2 사과 · 3-3 바나나 · 3-5 과자 (누르는 놀이) + 3-4 따라 말하기 — 담당: 태희 (민철 와이어프레임 기준)
// 기획 1-1 "세 감각을 한 동작에 묶는 방식": 아바타가 권함 → 사물이 툭 떨어짐 → 누르면 소리·진동·화면 반응 → 이름 → 따라 말하기 → 톡 튀며 칭찬
// 기획 2-1-2 안전망: 고정 문장만 말함, 범위 밖 질문은 지어내지 않고 주제로 되돌린 뒤 부모 확인 목록(out_of_scope)에 기록, 틀렸다는 표시 없음
// 기획 2-2 ② 아이의 투입: 터치(반응 속도), 응시 시간, 웃음, 입모양 따라 하기, 따라 말하기 음성
import { router, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import type { FaceFrame } from '@/components/FaceTracker';
import { ItemToy, PopEmoji } from '@/components/child/ItemToy';
import { FaceSensor, HoldMic, PillButton, RoundButton, SkipIcon, TargetIcon, sleep, useDailyLimit, useMouthScale, who } from '@/components/child/kit';
import { dayOf, fill, ITEMS, type Day, type ItemId } from '@/content/curriculum';
import { useSpeak } from '@/hooks/useSpeak';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { agentSay } from '@/lib/agent';
import { api } from '@/lib/api';
import { haptic, logEvent, playSfx, setVibration, startActivityLog } from '@/lib/sense';
import { refreshProfile, useProfile } from '@/lib/store';
import type { SttOut } from '@/lib/types';
import { C, R } from '@/theme';

type Phase = 'object' | 'repeat';

const PANEL = '#EEF0F3'; // 오른쪽 사물 패널 (와이어프레임 회색) — 사과 베어 문 자국도 이 색
const SENSOR_STYLE: ViewStyle = { width: 72, height: 54, borderRadius: 12 };

/** 범위 밖 질문처럼 보이는지 (왜/뭐/어디/누구, 물음표) */
const looksLikeQuestion = (t: string) => /왜|뭐|어디|누구/.test(t) || /\?\s*$/.test(t);

export default function Session() {
  const profile = useProfile();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const focused = useIsFocused();
  const { speak, stop, mouth, speaking, setSlow } = useSpeak(profile?.childId);
  const scale = useMouthScale(profile?.childId);
  const rec = useVoiceRecorder();
  const { name, me, english } = who(profile);

  const [plan, setPlan] = useState<Day | null>(null);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('object');
  const [presses, setPresses] = useState(0); // 지금 사물을 누른 횟수 (의성어 다시 띄우기)
  const [slow, setSlowState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pop, setPop] = useState(0);

  const run = useRef(0); // 진행 중인 말하기 흐름 취소용
  const shownAt = useRef(0);
  const lastPress = useRef(0);
  const counts = useRef<Partial<Record<ItemId, number>>>({});
  const startRec = useRef<Promise<boolean> | null>(null);
  // 얼굴 센서용 최신 상태 (0.05초마다 들어오므로 state 대신 ref)
  const live = useRef({ phase: 'object' as Phase, word: '', speaking: false, recording: false });
  const looked = useRef(0);
  const smileOn = useRef(false);
  const lastSmile = useRef(0);
  const imitated = useRef(new Set<string>());

  const item = plan ? ITEMS[plan.items[idx]] : null;
  const say = (it: typeof item) => (it ? (english ? `${it.ko}! ${it.en}!` : `${it.ko}!`) : '');

  // ---------- 시작: 오늘 계획 받기 + 기록 시작 ----------
  useEffect(() => {
    let alive = true;
    refreshProfile().then((p) => {
      if (!alive) return;
      const d = dayOf(p.day);
      startActivityLog(p.childId);
      setVibration(p.settings.vibration !== false);
      logEvent('session', { topic: d.topic, day: d.day });
      setPlan(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    live.current = { phase, word: item?.ko ?? '', speaking, recording: rec.isRecording };
  }, [phase, item, speaking, rec.isRecording]);

  // ---------- 하루 사용 상한 ----------
  const goEnd = useCallback(() => {
    stop();
    router.replace('/child/end');
  }, [stop]);
  useDailyLimit(profile?.settings.dailyLimitMin, !!plan && focused, goEnd);

  // ---------- 화면마다 아바타가 먼저 말함 ----------
  useEffect(() => {
    if (!plan || !focused) return;
    const it = ITEMS[plan.items[idx]];
    const t = ++run.current;
    (async () => {
      await sleep(350);
      if (t !== run.current) return;
      if (phase === 'object') {
        shownAt.current = Date.now();
        // 에이전트(충항)가 있으면 그 대사, 없으면 커리큘럼 고정 문장
        const line = profile
          ? (await agentSay({ child_id: profile.childId, day: plan.day, item: it.id, moment: 'invite' }, fill(it.invite, { name, me }))).text
          : fill(it.invite, { name, me });
        if (t !== run.current) return;
        await speak(line);
      } else {
        await speak(`같이 따라 해 볼까? ${it.ko}!`);
      }
    })();
    return () => {
      run.current++;
      stop();
    };
  }, [plan, idx, phase, focused, speak, stop, name, me, profile]);

  // ---------- 아이 얼굴: 응시 시간 5초마다, 웃음, 입모양 따라 하기 ----------
  useEffect(() => {
    if (!plan || !focused) return;
    const id = setInterval(() => {
      if (looked.current > 0) {
        logEvent('gaze', { seconds: Math.round(looked.current * 0.05 * 10) / 10 });
        looked.current = 0;
      }
    }, 5000);
    return () => clearInterval(id);
  }, [plan, focused]);

  const onFrame = useCallback((f: FaceFrame) => {
    if (f.looking) looked.current += 1;
    const now = Date.now();
    if (f.smile && !smileOn.current && now - lastSmile.current > 3000) {
      logEvent('smile');
      lastSmile.current = now;
    }
    smileOn.current = f.smile;
    const l = live.current;
    if (l.phase === 'repeat' && !l.speaking && l.word && f.mouthOpen && !imitated.current.has(l.word)) {
      imitated.current.add(l.word);
      logEvent('imitate', { word: l.word });
    }
  }, []);

  // ---------- 누르는 놀이 ----------
  const onToy = () => {
    if (!item) return;
    const now = Date.now();
    logEvent('touch', { target: item.ko, reaction_ms: now - (presses === 0 ? shownAt.current : lastPress.current), count: presses + 1 });
    lastPress.current = now;
    counts.current[item.id] = (counts.current[item.id] ?? 0) + 1;
    setPresses((n) => n + 1);
    playSfx(item.sound);
    haptic(item.haptic);
    // 한 번 누를 때마다 이름을 다시 말해줌 (효과음이 들리게 살짝 뒤에)
    const t = ++run.current;
    stop();
    setTimeout(() => {
      if (t === run.current) speak(say(item));
    }, 450);
  };

  // ---------- 따라 말하기 (누르고 있는 동안 녹음) ----------
  const onMicIn = () => {
    if (busy || startRec.current) return;
    run.current++;
    stop();
    startRec.current = rec.start().then(
      () => true,
      () => false,
    );
  };

  const onMicOut = async () => {
    const started = startRec.current;
    if (!started || !item) return;
    setBusy(true);
    const ok = await started;
    startRec.current = null;
    let uri: string | null = null;
    if (ok) {
      try {
        uri = await rec.stop();
      } catch {}
    }
    const t = ++run.current;
    let res: SttOut | null = null;
    if (uri) {
      try {
        res = await api.stt(uri, `${item.ko}|${item.en}`);
      } catch {}
    }
    setBusy(false);
    if (t !== run.current) return;
    const text = res?.text?.trim() ?? '';
    logEvent('repeat', { word: item.ko, matched: res ? res.matched : null, text });
    if (res?.alert) logEvent('alert', { text });

    if (res && !res.matched && text) {
      // 안전망: 범위 밖 질문 → 지어내지 않고 주제로 되돌림. 판단은 에이전트, 없으면 간단 규칙
      const redirect = fill(`그건 이따 {me}한테 물어보자! 우리 ${item.ko} 계속 볼까?`, { name, me });
      const a = profile
        ? await agentSay({ child_id: profile.childId, day: plan?.day ?? 1, item: item.id, moment: 'reply', child_text: text }, redirect)
        : null;
      if (t !== run.current) return;
      if (a?.outOfScope || (!a?.outOfScope && looksLikeQuestion(text))) {
        if (!a?.outOfScope) logEvent('out_of_scope', { text }); // 에이전트가 이미 기록했으면 중복 기록 안 함
        await speak(a?.outOfScope ? a.text : redirect);
        return;
      }
    }
    // 맞았든 아니든 시도 자체를 칭찬 (틀렸다는 표시 없음). 서버가 안 되면 시도한 것으로 봄
    setPop((n) => n + 1);
    playSfx('pop');
    const praised = !res || res.matched === true;
    haptic(praised ? 'praise' : 'tap');
    await speak(praised ? fill('잘했어, 우리 {name}!', { name, me }) : '우와, 좋아! 한 번 더 해볼까?');
  };

  // ---------- 다음 ----------
  const next = () => {
    if (!plan) return;
    stop();
    if (phase === 'object') {
      setPhase('repeat');
      return;
    }
    if (idx + 1 < plan.items.length) {
      setIdx(idx + 1);
      setPresses(0);
      setPhase('object');
      return;
    }
    const top = (Object.entries(counts.current) as [ItemId, number][]).sort((a, b) => b[1] - a[1])[0];
    const fav = ITEMS[top ? top[0] : plan.items[0]].ko;
    router.replace({ pathname: plan.story ? '/child/story' : '/child/end', params: { fav } });
  };

  const toggleSlow = () => {
    const s = !slow;
    setSlowState(s);
    setSlow(s);
    if (item) setTimeout(() => speak(say(item)), 50);
  };

  if (!plan || !item) return <View style={{ flex: 1, backgroundColor: C.primarySoft }} />;

  const total = plan.items.length * 2;
  const progress = (idx * 2 + (phase === 'repeat' ? 1 : 0) + 1) / total;
  const toySize = Math.min(height * 0.3, width * 0.2, 220);
  const pad = { paddingTop: 16 + insets.top, paddingBottom: 16 + insets.bottom, paddingLeft: 40 + insets.left, paddingRight: 40 + insets.right };

  return (
    <View style={{ flex: 1, backgroundColor: C.primarySoft }}>
      {phase === 'object' ? (
        <View key={`o${idx}`} style={[{ flex: 1, gap: 16 }, pad]}>
          {/* 상단: 일차 · 소리만 듣기 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 }}>
            <View style={{ backgroundColor: C.primary, borderRadius: R.pill, paddingHorizontal: 18, paddingVertical: 10 }}>
              <Text style={{ color: C.white, fontSize: 18, fontWeight: '800' }}>{plan.day}일차</Text>
            </View>
            <PillButton
              small
              label="소리만 듣기"
              onPress={() => {
                stop();
                router.push('/child/audio');
              }}
            />
          </View>

          <View style={{ flex: 1, flexDirection: 'row', gap: 20 }}>
            {/* 왼쪽: 부모 아바타 */}
            <View style={{ flex: 32, backgroundColor: C.white, borderRadius: R.lg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Avatar config={profile?.avatar} mouth={mouth} scale={scale} size={Math.min(height * 0.32, width * 0.2)} />
              <Text style={{ fontSize: 15, color: C.sub }}>입모양을 크게 보여줘요</Text>
            </View>
            {/* 오른쪽: 사물 */}
            <View style={{ flex: 68, backgroundColor: PANEL, borderRadius: R.lg, borderWidth: 1.5, borderColor: C.muted, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <View style={{ height: 76, alignItems: 'center', justifyContent: 'flex-end' }}>
                {presses > 0 && (
                  <Animated.View key={presses} entering={ZoomIn.duration(220)} style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 34, fontWeight: '900', color: C.text }}>{item.sfxWord}</Text>
                    <View style={{ height: 24, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: C.muted, marginTop: 4 }} />
                  </Animated.View>
                )}
              </View>
              <ItemToy id={item.id} emoji={item.emoji} size={toySize} bg={PANEL} onPress={onToy} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                <TargetIcon />
                <Text style={{ fontSize: 18, color: C.sub }}>{item.action}</Text>
              </View>
            </View>
          </View>

          {/* 단어 막대 */}
          <View style={{ backgroundColor: C.white, borderRadius: R.md, minHeight: 72, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 32, fontWeight: '900', color: C.text }}>
              {item.ko}!{english && <Text style={{ color: C.sub, fontWeight: '800' }}> {item.en}</Text>}
            </Text>
          </View>

          {/* 진행 · 천천히 · 다음 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
            <View style={{ flex: 1, height: 14, borderRadius: 7, backgroundColor: C.white, overflow: 'hidden' }}>
              <View style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 7, backgroundColor: C.primary }} />
            </View>
            <PillButton label="천천히" selected={slow} onPress={toggleSlow} />
            <RoundButton label="다음" onPress={next}>
              <SkipIcon size={34} />
            </RoundButton>
          </View>
        </View>
      ) : (
        <Animated.View key={`r${idx}`} entering={FadeIn.duration(300)} style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 40 }, pad]}>
          {/* 왼쪽: 엄마 입모양 확대 */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={{
                width: Math.min(height * 0.62, width * 0.4),
                aspectRatio: 1,
                backgroundColor: C.white,
                borderRadius: R.lg,
                borderWidth: 1.5,
                borderColor: C.muted,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Avatar config={profile?.avatar} mouth={mouth} scale={scale} close size={Math.min(height * 0.62, width * 0.4)} />
            </View>
          </View>
          {/* 오른쪽: 그림 · 단어 · 마이크 · 다시 들려줘 */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <View style={{ width: toySize * 1.0, height: toySize * 1.0, backgroundColor: C.white, borderRadius: R.lg, borderWidth: 1.5, borderColor: C.muted, alignItems: 'center', justifyContent: 'center' }}>
              <PopEmoji emoji={item.emoji} size={toySize * 0.8} trigger={pop} />
            </View>
            <Animated.Text entering={FadeInDown.duration(300)} style={{ fontSize: 60, fontWeight: '900', color: C.text }}>
              {item.ko}
            </Animated.Text>
            <HoldMic recording={rec.isRecording} disabled={busy} onPressIn={onMicIn} onPressOut={onMicOut} size={Math.min(124, height * 0.17)} />
            <PillButton
              label="다시 들려줘"
              onPress={() => {
                run.current++;
                speak(say(item));
              }}
            />
          </View>
          <RoundButton label="다음" size={88} onPress={next} style={{ position: 'absolute', right: 24 + insets.right, bottom: 20 + insets.bottom }}>
            <SkipIcon size={30} />
          </RoundButton>
        </Animated.View>
      )}

      {/* 아이 얼굴 센서: 작고 흐리게 (기기 안에서만 처리, 영상은 저장·전송 안 함) */}
      {focused && (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 14 + insets.top, left: width / 2 - 36, opacity: 0.45 }}>
          <FaceSensor onFrame={onFrame} style={SENSOR_STYLE} />
        </View>
      )}
    </View>
  );
}
