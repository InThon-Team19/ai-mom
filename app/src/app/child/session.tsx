// 아이 태블릿 3-2 사과 · 3-3 바나나 · 3-5 과자 (누르는 놀이) + 3-4 따라 말하기 — 담당: 태희 (민철 와이어프레임 · 기획 2-3)
// 기획 1-1 "세 감각을 한 동작에 묶는 방식": 아바타가 말함 → 사물이 툭 떨어짐 → 누르면 소리·진동·화면 반응 → 이름 → 따라 말하기 → 톡 튀며 칭찬
// 기획 2-3 화면 구성: 왼쪽 약 40% 아바타(입모양 크게) · 오른쪽 약 60% 사물 무대(한 번에 하나) · 아래 오늘 모은 사물 바구니(글자 없이)
// 기획 2-3 "사과 한 바퀴의 움직임": 끄덕이며 "사과!" → 떨어져 통통 → 2초 뒤 흔들림 + "눌러볼까?" → 눌림·반응 → 말소리만큼 커짐
//   → 성공이면 크게 튀며 별 + "잘했어!" / 아니면 실패음 없이 한 번 더 말하고 → 굴러서 바구니에 쏙
// 기획 2-1-2 안전망: 고정 문장만 말함, 범위 밖 질문은 지어내지 않고 주제로 되돌린 뒤 부모 확인 목록(out_of_scope)에 기록, 틀렸다는 표시 없음
// 기획 2-2 ② 아이의 투입: 터치(반응 속도), 응시 시간, 웃음, 입모양 따라 하기, 따라 말하기 음성
import { router, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, useWindowDimensions, type HostInstance } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, type AvatarExpression, type AvatarLook } from '@/components/Avatar';
import type { FaceFrame } from '@/components/FaceTracker';
import { dropDuration, ItemToy, type ToyLeave } from '@/components/child/ItemToy';
import { ChildMirror } from '@/components/child/ChildMirror';
import { HoldMic, PillButton, RoundButton, SkipIcon, sleep, useDailyLimit, useMouthScale, who } from '@/components/child/kit';
import { Basket, NodBox } from '@/components/child/stage';
import { dayOf, fill, ITEMS, type Day, type ItemId } from '@/content/curriculum';
import { useSpeak } from '@/hooks/useSpeak';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { agentSay } from '@/lib/agent';
import { api } from '@/lib/api';
import { haptic, logEvent, playSfx, setVibration, startActivityLog } from '@/lib/sense';
import { refreshProfile, useProfile } from '@/lib/store';
import type { SttOut } from '@/lib/types';
import { C, R } from '@/theme';
import { ParentExit } from '@/components/ParentExit';

type Phase = 'object' | 'repeat';

const STAGE = C.greenSoft; // 오른쪽 사물 무대 바탕 — 사과 베어 문 자국도 이 색
const WAIT_MS = 2000; // 눌러주길 기다리는 시간 (2-3 초안)
const AUTO_REPEAT_MS = 3000; // 마지막으로 누른 뒤 이만큼 지나면 따라 말하기로
// 자동 듣기 (녹음 버튼 없이): 말소리가 들리면 녹음, 말이 끝나고 조용해지면 멈춤
const SPEECH_DB = -38; // 이보다 크면 말소리로 봄 (dB, 기기마다 조정)
const SILENCE_MS = 1000; // 말한 뒤 이만큼 조용하면 끝
const NO_SPEECH_MS = 4500; // 아무 말 없으면 이만큼 듣고 끝
const MAX_LISTEN_MS = 7000;

/** 범위 밖 질문처럼 보이는지 (왜/뭐/어디/누구, 물음표) */
const looksLikeQuestion = (t: string) => /왜|뭐|어디|누구/.test(t) || /\?\s*$/.test(t);

/** 마이크 dB(-60 조용 ~ 0 큼) → 0~1 */
const levelOf = (db: number | undefined) => (typeof db === 'number' ? Math.max(0, Math.min(1, (db + 60) / 60)) : 0);

export default function Session() {
  const profile = useProfile();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const focused = useIsFocused();
  const { speak, stop, mouth, speaking, setSlow } = useSpeak(profile?.childId);
  const scale = useMouthScale(profile?.childId);
  const rec = useVoiceRecorder();
  const { name, me, english } = who(profile);
  const reduceMotion = !!profile?.settings.reduceMotion;

  const [plan, setPlan] = useState<Day | null>(null);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('object');
  const [presses, setPresses] = useState(0); // 지금 사물을 누른 횟수 (의성어 다시 띄우기)
  const [slow, setSlowState] = useState(false);
  const [busy, setBusy] = useState(false);
  // 움직임 신호 (값이 바뀔 때마다 한 번씩)
  const [dropped, setDropped] = useState(false);
  const [nod, setNod] = useState(0);
  const [wiggle, setWiggle] = useState(0);
  const [success, setSuccess] = useState(0);
  const [leave, setLeave] = useState<ToyLeave | null>(null);
  const [basket, setBasket] = useState<ItemId[]>([]);
  // 아바타 표정: 잠깐 바뀌는 표정(mood) > 녹음 중 기다림 > 아이가 웃으면 같이 웃음 > 기본
  const [mood, setMood] = useState<AvatarExpression | null>(null);
  const [look, setLook] = useState<AvatarLook>('center');
  const [childSmile, setChildSmile] = useState(false);

  const run = useRef(0); // 진행 중인 말하기 흐름 취소용
  const shownAt = useRef(0);
  const lastPress = useRef(0);
  const pressCount = useRef(0);
  const droppedRef = useRef(false);
  const leaving = useRef(false);
  const counts = useRef<Partial<Record<ItemId, number>>>({});
  const moodTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const toyRef = useRef<HostInstance>(null);
  const slotRef = useRef<HostInstance>(null);
  // 얼굴 센서용 최신 상태 (0.05초마다 들어오므로 state 대신 ref)
  const meterRef = useRef(-160); // 녹음 중 음량 (dB)
  const listeningRef = useRef(false);
  const mouthStat = useRef({ max: 0, moving: 0, last: 0 }); // 듣는 동안 아이 입 움직임
  const listenRef = useRef<(t: number, word: string) => Promise<void>>(async () => {});
  const live = useRef({ phase: 'object' as Phase, word: '', speaking: false, recording: false });
  const looked = useRef(0);
  const smileOn = useRef(false);
  const lastSmile = useRef(0);
  const imitated = useRef(new Set<string>());

  const item = plan ? ITEMS[plan.items[idx]] : null;
  const say = (it: typeof item) => (it ? (english ? `${it.ko}! ${it.en}!` : `${it.ko}!`) : '');

  /** 표정을 차례로 잠깐 바꿨다가 기본으로 돌아옴. 예: [['surprise', 400], ['smile', 1400]] */
  const react = useCallback((steps: [AvatarExpression, number][], lookTo: AvatarLook = 'center') => {
    moodTimers.current.forEach(clearTimeout);
    moodTimers.current = [];
    setLook(lookTo);
    let at = 0;
    steps.forEach(([e, ms], i) => {
      if (i === 0) setMood(e);
      else moodTimers.current.push(setTimeout(() => setMood(e), at));
      at += ms;
    });
    moodTimers.current.push(
      setTimeout(() => {
        setMood(null);
        setLook('center');
      }, at),
    );
  }, []);
  useEffect(() => () => moodTimers.current.forEach(clearTimeout), []);

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
    router.replace({ pathname: '/child/end', params: { basket: basket.join(',') } });
  }, [stop, basket]);
  useDailyLimit(profile?.settings.dailyLimitMin, !!plan && focused, goEnd);

  // ---------- 다음 사물로: 굴러서 바구니에 쏙 → 다음 ----------
  const leaveRef = useRef<() => void>(() => {});
  const doLeave = () => {
    if (!plan || !item || leaving.current) return;
    leaving.current = true;
    run.current++;
    stop();
    const fallback = { dx: -width * 0.3, dy: height * 0.35 };
    const toy = toyRef.current;
    const slot = slotRef.current;
    if (!toy || !slot) {
      setLeave(fallback);
      return;
    }
    toy.measureInWindow((x1, y1, w1, h1) => {
      slot.measureInWindow((x2, y2, w2, h2) => {
        const ok = [x1, y1, w1, h1, x2, y2, w2, h2].every((v) => Number.isFinite(v)) && w1 > 0;
        setLeave(ok ? { dx: x2 + w2 / 2 - (x1 + w1 / 2), dy: y2 + h2 / 2 - (y1 + h1 / 2) } : fallback);
      });
    });
  };
  useEffect(() => {
    leaveRef.current = doLeave;
  });

  /** 사물이 바구니에 들어간 뒤 (ItemToy onLeft) */
  const onLeft = () => {
    if (!plan || !item) return;
    const nextBasket = [...basket, item.id];
    setBasket(nextBasket);
    setTimeout(() => {
      leaving.current = false;
      if (idx + 1 < plan.items.length) {
        droppedRef.current = false;
        pressCount.current = 0;
        setDropped(false);
        setLeave(null);
        setWiggle(0);
        setSuccess(0);
        setPresses(0);
        setIdx(idx + 1);
        setPhase('object');
        return;
      }
      const top = (Object.entries(counts.current) as [ItemId, number][]).sort((a, b) => b[1] - a[1])[0];
      const fav = ITEMS[top ? top[0] : plan.items[0]].ko;
      router.replace({ pathname: plan.story ? '/child/story' : '/child/end', params: { fav, basket: nextBasket.join(',') } });
    }, 350);
  };

  // ---------- 화면마다 아바타가 먼저 말함 ----------
  useEffect(() => {
    if (!plan || !focused) return;
    const it = ITEMS[plan.items[idx]];
    const word = english ? `${it.ko}! ${it.en}!` : `${it.ko}!`;
    const t = ++run.current;
    (async () => {
      await sleep(350);
      if (t !== run.current) return;
      if (phase === 'object') {
        if (!droppedRef.current) {
          // 1) 고개를 끄덕이며 "사과!" → 2) 사물이 위에서 떨어짐
          setNod((n) => n + 1);
          await speak(word);
          if (t !== run.current) return;
          droppedRef.current = true;
          setDropped(true);
          shownAt.current = Date.now();
          await sleep(dropDuration(reduceMotion) + 150);
          if (t !== run.current) return;
        }
        // 3) 권하는 말 — 에이전트(충항)가 있으면 그 대사, 없으면 커리큘럼 고정 문장
        const line = profile
          ? (await agentSay({ child_id: profile.childId, day: plan.day, item: it.id, moment: 'invite' }, fill(it.invite, { name, me }))).text
          : fill(it.invite, { name, me });
        if (t !== run.current) return;
        await speak(line);
        if (t !== run.current) return;
        // 4) 2초 동안 안 누르면 살짝 흔들리고 아바타가 사물을 보며 "눌러볼까?"
        await sleep(WAIT_MS);
        if (t !== run.current || pressCount.current > 0) return;
        setWiggle((n) => n + 1);
        react([['wait', 2600]], 'right');
        await speak('눌러볼까?');
      } else {
        await speak(`같이 따라 해 볼까? ${it.ko}!`);
        if (t !== run.current) return;
        // 녹음 버튼 없이 바로 들음 → 말소리가 끝나면 자동으로 인식·응답
        await listenRef.current(t, word);
      }
    })();
    return () => {
      run.current++;
      stop();
    };
  }, [plan, idx, phase, focused, speak, stop, name, me, profile, english, reduceMotion, react]);

  useEffect(() => {
    meterRef.current = rec.metering ?? -160;
  }, [rec.metering]);

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
    if (f.smile !== smileOn.current) setChildSmile(f.smile); // 아이가 웃으면 아바타도 같이 웃음
    smileOn.current = f.smile;
    if (listeningRef.current && f.face) {
      const m = mouthStat.current;
      if (f.open > m.max) m.max = f.open;
      if (Math.abs(f.open - m.last) > 0.012 || f.mouthOpen) m.moving += 1;
      m.last = f.open;
    }
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
    const n = pressCount.current;
    logEvent('touch', { target: item.ko, reaction_ms: now - (n === 0 ? shownAt.current : lastPress.current), count: n + 1 });
    lastPress.current = now;
    pressCount.current = n + 1;
    counts.current[item.id] = (counts.current[item.id] ?? 0) + 1;
    setPresses(n + 1);
    playSfx(item.sound);
    haptic(item.haptic);
    // 아바타도 사물을 봄: 놀람 → 웃음
    react(
      [
        ['surprise', 450],
        ['smile', 1500],
      ],
      'right',
    );
    // 한 번 누를 때마다 이름을 다시 말해줌 (효과음이 들리게 살짝 뒤에). 한동안 안 누르면 따라 말하기로
    const t = ++run.current;
    stop();
    setTimeout(async () => {
      if (t !== run.current) return;
      await speak(say(item));
      if (t !== run.current) return;
      await sleep(AUTO_REPEAT_MS);
      if (t === run.current) setPhase('repeat');
    }, 450);
  };

  // ---------- 따라 말하기: 자동 듣기 (말소리 감지 → 조용해지면 멈춤 → 인식) ----------
  const listenOnce = async (t: number): Promise<{ uri: string | null; spoke: boolean }> => {
    try {
      await rec.start();
    } catch {
      return { uri: null, spoke: false }; // 마이크 권한 없음 등
    }
    listeningRef.current = true;
    mouthStat.current = { max: 0, moving: 0, last: 0 };
    const t0 = Date.now();
    let spoke = false;
    let lastLoud = 0;
    while (t === run.current) {
      await sleep(100);
      const now = Date.now();
      if (meterRef.current > SPEECH_DB) {
        spoke = true;
        lastLoud = now;
      }
      if (spoke && now - lastLoud > SILENCE_MS) break;
      if (!spoke && now - t0 > NO_SPEECH_MS) break;
      if (now - t0 > MAX_LISTEN_MS) break;
    }
    listeningRef.current = false;
    let uri: string | null = null;
    try {
      uri = await rec.stop();
    } catch {}
    return { uri, spoke };
  };

  /** 따라 말하기 한 번: 듣고 → 기록하고 → 응답. 아무 말 없으면 아바타가 한 번 더 말하고 한 번 더 들은 뒤 넘어감 */
  const listenFlow = async (t: number, word: string, attempt = 1): Promise<void> => {
    if (!item) return;
    const { uri, spoke } = await listenOnce(t);
    if (t !== run.current) return;
    // 아이 입 움직임 기록 (듣는 동안 0.05초마다 잰 값)
    const m = mouthStat.current;
    if (m.moving >= 3) logEvent('imitate', { word: item.ko, max_open: Math.round(m.max * 1000) / 1000, moving_frames: m.moving });
    if (!spoke || !uri) {
      if (attempt >= 2) {
        logEvent('repeat', { word: item.ko, matched: null, text: '' });
        return leaveRef.current();
      }
      // 말하지 않음: 틀렸다는 표시 없이 아바타가 한 번 더 말하고 다시 들음
      react([['smile', 1600]]);
      await speak(word);
      if (t !== run.current) return;
      return listenFlow(t, word, attempt + 1);
    }
    setBusy(true);
    let res: SttOut | null = null;
    try {
      res = await api.stt(uri, `${item.ko}|${item.en}`);
    } catch {}
    setBusy(false);
    if (t !== run.current) return;
    if (res && !res.text?.trim()) logEvent('voice', { kind: 'sound', word: item.ko }); // 말소리는 있었지만 글자로 안 나옴 (옹알이·웃음 등)
    await respond(t, res);
  };
  useEffect(() => {
    listenRef.current = listenFlow;
  });

  /** 마이크 버튼: 다시 듣기 (자동 듣기 중이면 무시) */
  const onMic = () => {
    if (busy || listeningRef.current || leaving.current || !item) return;
    const t = ++run.current;
    stop();
    listenFlow(t, english ? `${item.ko}! ${item.en}!` : `${item.ko}!`, 2);
  };

  const respond = async (t: number, res: SttOut | null) => {
    if (!item) return;
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
    // 서버가 안 되면 시도한 것으로 봄
    const praised = !res || res.matched === true;
    if (praised) {
      // 성공: 사물이 크게 튀고 별이 퍼지며 아바타가 활짝 웃음 + "잘했어!" + 짧은 진동
      setSuccess((n) => n + 1);
      playSfx('pop');
      haptic('praise');
      react([
        ['praise', 2000],
        ['smile', 800],
      ]);
      await speak(fill('잘했어, 우리 {name}!', { name, me }));
      if (t !== run.current) return;
      await sleep(400);
    } else {
      // 말하지 않음 / 다르게 말함: 실패음·틀림 표시 없이 아바타가 한 번 더 말하고 넘어감
      react([['smile', 1800]]);
      await speak(text ? `좋아! ${say(item)}` : say(item));
      if (t !== run.current) return;
      await sleep(600);
    }
    if (t === run.current) doLeave();
  };

  // ---------- 다음 버튼 ----------
  const next = () => {
    if (!plan || leaving.current) return;
    stop();
    if (phase === 'object') {
      run.current++;
      if (!droppedRef.current) {
        droppedRef.current = true;
        setDropped(true);
        shownAt.current = Date.now();
      }
      setPhase('repeat');
      return;
    }
    doLeave();
  };

  const toggleSlow = () => {
    const s = !slow;
    setSlowState(s);
    setSlow(s);
    if (item) setTimeout(() => speak(say(item)), 50);
  };

  if (!plan || !item) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  const pad = { paddingTop: 12 + insets.top, paddingBottom: 14 + insets.bottom, paddingLeft: 28 + insets.left, paddingRight: 28 + insets.right };
  const basketH = Math.max(88, Math.min(110, height * 0.13));
  const mainH = height - pad.paddingTop - pad.paddingBottom - 52 - basketH - 28;
  const avatarSize = Math.max(120, Math.min(mainH / 1.18, width * 0.34));
  const toySize = Math.max(110, Math.min(mainH * 0.42, width * 0.22, 240));
  const micSize = Math.max(88, Math.min(116, mainH * 0.2));
  const voice = rec.isRecording ? levelOf(rec.metering) : 0;
  const expression: AvatarExpression = mood ?? (rec.isRecording ? 'wait' : childSmile ? 'smile' : 'neutral');

  return (
    <View style={[{ flex: 1, backgroundColor: C.bg, gap: 14 }, pad]}>
      <ParentExit />
      {/* 상단: 일차 · 소리만 듣기 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 }}>
        <View style={{ backgroundColor: C.primary, borderRadius: R.pill, paddingHorizontal: 18, paddingVertical: 10 }}>
          <Text style={{ color: C.onPrimary, fontSize: 18, fontWeight: '800' }}>{plan.day}일차</Text>
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

      <View style={{ flex: 1, flexDirection: 'row', gap: 16 }}>
        {/* 왼쪽 약 40%: 부모 아바타 (입모양이 잘 보이게 크게) */}
        <View style={{ flex: 40, backgroundColor: C.white, borderRadius: R.lg, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <NodBox nod={nod} reduceMotion={reduceMotion}>
            <Avatar config={profile?.avatar} mouth={mouth} scale={scale} size={avatarSize} expression={expression} look={look} />
          </NodBox>
        </View>

        {/* 오른쪽 약 60%: 사물 무대 (한 번에 하나) */}
        <View style={{ flex: 60, backgroundColor: STAGE, borderRadius: R.lg, borderWidth: 2, borderColor: C.green, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          {/* 의성어 (누를 때마다 톡) */}
          <View style={{ height: 52, alignItems: 'center', justifyContent: 'flex-end' }}>
            {phase === 'object' && presses > 0 && (
              <Animated.Text key={presses} entering={ZoomIn.duration(220)} style={{ fontSize: 34, fontWeight: '900', color: C.text }}>
                {item.sfxWord}
              </Animated.Text>
            )}
          </View>
          <View ref={toyRef} collapsable={false} style={{ alignItems: 'center' }}>
            <ItemToy
              key={idx}
              id={item.id}
              emoji={item.emoji}
              size={toySize}
              bg={STAGE}
              onPress={onToy}
              drop={dropped}
              reduceMotion={reduceMotion}
              wiggle={wiggle}
              voice={voice}
              success={success}
              leave={leave}
              onLeft={onLeft}
              interactive={phase === 'object'}
            />
            {/* 바닥 그림자 — 떨어져 닿는 자리 */}
            <View style={{ width: toySize * 0.6, height: 12, borderRadius: 6, backgroundColor: C.green, opacity: dropped && !leave ? 0.45 : 0, marginTop: -6 }} />
          </View>

          {phase === 'object' ? (
            <View style={{ minHeight: micSize * 1.2, alignItems: 'center', justifyContent: 'center' }}>
              {dropped && (
                <Animated.Text key={`w${idx}`} entering={FadeIn.duration(300)} style={{ fontSize: 34, fontWeight: '900', color: C.text }}>
                  {item.ko}!{english && <Text style={{ color: C.sub, fontWeight: '800' }}> {item.en}</Text>}
                </Animated.Text>
              )}
            </View>
          ) : (
            <Animated.View entering={FadeIn.duration(300)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: micSize * 1.2 }}>
              <Text style={{ fontSize: 40, fontWeight: '900', color: C.text }}>{item.ko}</Text>
              <HoldMic recording={rec.isRecording} disabled={busy || !!leave} onPressIn={onMic} onPressOut={() => {}} size={micSize} />
              <PillButton
                small
                label="다시 들려줘"
                onPress={() => {
                  run.current++;
                  speak(say(item));
                }}
              />
            </Animated.View>
          )}
        </View>
      </View>

      {/* 아래: 오늘 모은 사물 바구니 · 천천히 · 다음 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Basket emojis={basket.map((b) => ITEMS[b].emoji)} height={basketH} nextRef={slotRef} />
        <PillButton label="천천히" selected={slow} onPress={toggleSlow} />
        <RoundButton label="다음" size={92} onPress={next}>
          <SkipIcon size={34} />
        </RoundButton>
      </View>

      {/* 아이 얼굴 센서: 작고 흐리게 (기기 안에서만 처리, 영상은 저장·전송 안 함) */}
      {focused && (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 10 + insets.top, left: width / 2 - (phase === 'repeat' ? 110 : 36) }}>
          <ChildMirror onFrame={onFrame} big={phase === 'repeat'} />
        </View>
      )}
    </View>
  );
}
