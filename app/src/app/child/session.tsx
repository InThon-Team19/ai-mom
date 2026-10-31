// 아이 태블릿 3-2 사과 · 3-3 바나나 · 3-5 과자 (누르는 놀이) + 3-4 따라 말하기 — 담당: 태희 (민철 와이어프레임 · 기획 2-3)
// 기획 1-1 "세 감각을 한 동작에 묶는 방식": 아바타가 말함 → 사물이 툭 떨어짐 → 누르면 소리·진동·화면 반응 → 이름 → 따라 말하기 → 톡 튀며 칭찬
// 기획 2-3 화면 구성: 왼쪽 약 40% 아바타(입모양 크게) · 오른쪽 약 60% 사물 무대(한 번에 하나) · 아래 오늘 모은 사물 바구니(글자 없이)
// 기획 2-3 "사과 한 바퀴의 움직임": 끄덕이며 "사과!" → 떨어져 통통 → 2초 뒤 흔들림 + "눌러볼까?" → 눌림·반응 → 말소리만큼 커짐
//   → 성공이면 크게 튀며 별 + "잘했어!" / 아니면 실패음 없이 한 번 더 말하고 → 굴러서 바구니에 쏙
// 기획 2-1-2 안전망: 고정 문장만 말함, 범위 밖 질문은 지어내지 않고 주제로 되돌린 뒤 부모 확인 목록(out_of_scope)에 기록, 틀렸다는 표시 없음
// 기획 2-2 ② 아이의 투입: 터치(반응 속도), 응시 시간, 웃음·표정, 말소리 (입 트래킹은 아이 앱에서 뺌)
// 기획 1-1 감각 설계 "에이전트가 읽는 반응 → 다음 활동 반영": 사물마다 터치·응시·표정·말소리를 모아 상태(mood)를 추정하고 반응을 바꿈
//   - 무리(overloaded): 아주 빠른 연속 터치·찡그림이 이어짐·울음 → 말 천천히, 움직임·진동 줄임, "천천히 해도 괜찮아" + 쉬기(소리만 듣기) 권함
//   - 주의 흐트러짐(distracted): 화면을 거의 안 보고 8초 넘게 반응 없음 → 이름 부르기 + 사물이 크게 튐 + 짧은 소리
//   - 손 놀이에 빠짐(engaged-touch): 터치 많음 → "한 번 더 눌러볼까?" / 말 놀이에 빠짐(engaged-voice): 말소리 2번 이상 → 단어를 천천히 한 번 더
// 녹음 버튼 없음: useChildListener 가 아바타가 말하지 않는 동안 계속 듣고, 말소리 토막을 서버에 저장 (부모가 나중에 들음)
// 폰(가로 약 800x360)과 태블릿 모두: 크기는 화면 크기에서 계산 (폰은 여백·글자·버튼을 줄여 겹치지 않게)
import { router, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, useWindowDimensions, type HostInstance } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, type AvatarExpression, type AvatarLook } from '@/components/Avatar';
import type { FaceExpr, FaceFrame } from '@/components/FaceTracker';
import { ParentExit, parentExitZone } from '@/components/ParentExit';
import { dropDuration, ItemToy, type ToyLeave } from '@/components/child/ItemToy';
import { EarListener, FaceSensor, PillButton, RoundButton, SkipIcon, sleep, useDailyLimit, useMouthScale, who } from '@/components/child/kit';
import { Basket, NodBox } from '@/components/child/stage';
import { dayOf, fill, ITEMS, type Day, type ItemId } from '@/content/curriculum';
import { useChildListener, type ClipResult } from '@/hooks/useChildListener';
import { useSpeak } from '@/hooks/useSpeak';
import { agentSay, type TurnIn } from '@/lib/agent';
import { useDevice } from '@/lib/layout';
import { haptic, logEvent, playSfx, setVibration, startActivityLog } from '@/lib/sense';
import { loadProfile, refreshProfile, useProfile } from '@/lib/store';
import type { ChildClipOut } from '@/lib/types';
import { C, R } from '@/theme';

type Phase = 'object' | 'repeat';
/** 앱이 추정한 아이 상태 (사물마다) */
type Mood = 'calm' | 'overloaded' | 'distracted' | 'engaged-touch' | 'engaged-voice';
type Signals = NonNullable<TurnIn['signals']>;

const STAGE = C.greenSoft; // 오른쪽 사물 무대 바탕 — 사과 베어 문 자국도 이 색
const WAIT_MS = 2000; // 눌러주길 기다리는 시간 (2-3 초안)
const AUTO_REPEAT_MS = 3000; // 마지막으로 누른 뒤 이만큼 지나면 따라 말하기로
const REPEAT_WAIT_MS = 7000; // 따라 말하기: 아이 말을 기다리는 시간 (말하는 중·올리는 중이면 최대 10초 더)

// 감각 반응 → 상태 추정 기준
const RAPID_TOUCHES = 6; // 3초 안에 이만큼 누르면 무리
const RAPID_WINDOW_MS = 3000;
const FROWN_STREAK_MS = 1500; // 찡그린 표정이 (안정된 뒤) 이만큼 더 이어지면 무리
const ALERT_RECENT_MS = 20000; // 울음 등 위험 신호 뒤 이 시간 동안 무리로 봄
const DISTRACT_GAZE = 0.3; // 최근 응시 비율이 이보다 낮고
const DISTRACT_IDLE_MS = 8000; // 이만큼 아무 반응 없으면 주의 흐트러짐
const ENGAGED_TOUCHES = 4;
const ENGAGED_VOICES = 2;
const CALM_MS = 60000; // 무리 뒤 움직임·진동을 줄이는 시간
const CALM_COOLDOWN_MS = 30000;
const CALL_COOLDOWN_MS = 20000;
const EXPR_STABLE_MS = 1500; // 표정이 이만큼 이어져야 바뀐 것으로 봄 (놀람은 짧아서 0.7초)
const SURPRISE_STABLE_MS = 700;

/** 범위 밖 질문처럼 보이는지 (왜/뭐/어디/누구, 물음표) */
const looksLikeQuestion = (t: string) => /왜|뭐|어디|누구/.test(t) || /\?\s*$/.test(t);
/** 이름 부르기: 받침 있으면 "아", 없으면 "야" */
const callName = (n: string) => {
  if (!n) return '';
  const c = n.charCodeAt(n.length - 1);
  const batchim = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return `${n}${batchim ? '아' : '야'}, `;
};
const SEVERITY: Record<Mood, number> = { calm: 0, 'engaged-touch': 1, 'engaged-voice': 2, distracted: 3, overloaded: 4 };
const agentMood = (m: Mood): Signals['mood'] => (m === 'engaged-touch' || m === 'engaged-voice' ? 'engaged' : m);

type ObjSig = {
  touches: number;
  touchTimes: number[];
  firstReactionMs?: number;
  faceFrames: number;
  lookFrames: number;
  smiles: number;
  voices: number;
  repeated: boolean;
  lastTouchAt: number;
  lastVoiceAt: number;
  alertAt: number;
  peak: Mood;
  touchPrompted: boolean;
  voiceModeled: boolean;
};
const newSig = (): ObjSig => ({
  touches: 0,
  touchTimes: [],
  faceFrames: 0,
  lookFrames: 0,
  smiles: 0,
  voices: 0,
  repeated: false,
  lastTouchAt: 0,
  lastVoiceAt: 0,
  alertAt: 0,
  peak: 'calm',
  touchPrompted: false,
  voiceModeled: false,
});

export default function Session() {
  const profile = useProfile();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { isTablet } = useDevice();
  const focused = useIsFocused();
  const { speak, stop, mouth, setSlow } = useSpeak(profile?.childId);
  const stopRef = useRef(stop); // 끼어들기 때 아바타 말 멈추기용 (듣기 hook 보다 먼저 만들어짐)
  useEffect(() => {
    stopRef.current = stop;
  });
  const scale = useMouthScale(profile?.childId);
  const { name, me, english } = who(profile);
  const reduceMotion = !!profile?.settings.reduceMotion;

  const [plan, setPlan] = useState<Day | null>(null);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('object');
  const [presses, setPresses] = useState(0); // 지금 사물을 누른 횟수 (의성어 다시 띄우기)
  const [slow, setSlowState] = useState(false);
  const [kick, setKick] = useState(0); // 바뀌면 지금 단계의 아바타 말 흐름을 다시 시작 (쉬기·이름 부르기 뒤)
  // 움직임 신호 (값이 바뀔 때마다 한 번씩)
  const [dropped, setDropped] = useState(false);
  const [nod, setNod] = useState(0);
  const [wiggle, setWiggle] = useState(0);
  const [attention, setAttention] = useState(0);
  const [success, setSuccess] = useState(0);
  const [leave, setLeave] = useState<ToyLeave | null>(null);
  const [basket, setBasket] = useState<ItemId[]>([]);
  // 아바타 표정: 잠깐 바뀌는 표정(mood) > 아이 말 듣는 중 기다림 > 아이 표정 따라 하기(웃음·놀람) > 기본
  const [mood, setMood] = useState<AvatarExpression | null>(null);
  const [look, setLook] = useState<AvatarLook>('center');
  const [childExpr, setChildExpr] = useState<FaceExpr>('neutral');
  const [calm, setCalm] = useState(false); // 무리 뒤: 움직임·진동 줄임
  const [rest, setRest] = useState(false); // 쉬기 권하기 (소리만 듣기 큰 버튼)

  const run = useRef(0); // 진행 중인 말하기 흐름 취소용
  const shownAt = useRef(0);
  const lastPress = useRef(0);
  const pressCount = useRef(0);
  const droppedRef = useRef(false);
  const leaving = useRef(false);
  const counts = useRef<Partial<Record<ItemId, number>>>({});
  const moodTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const leaveGuard = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLeftRef = useRef<() => void>(() => {});
  const toyRef = useRef<HostInstance>(null);
  const slotRef = useRef<HostInstance>(null);
  // 얼굴 센서용 최신 상태 (0.05초마다 들어오므로 state 대신 ref)
  const looked = useRef(0);
  const smileOn = useRef(false);
  const lastSmile = useRef(0);
  const exprCand = useRef<FaceExpr>('neutral');
  const exprCandSince = useRef(0);
  const exprStable = useRef<FaceExpr>('neutral');
  const exprStableSince = useRef(0);
  const gazeRecent = useRef(1); // 최근 몇 초 응시 비율 (지수 평균)
  const lastFrameAt = useRef(0);
  // 감각 반응 → 상태
  const sig = useRef<ObjSig>(newSig());
  const moodRef = useRef<Mood>('calm');
  const calmRef = useRef(false);
  const calmBusy = useRef(false); // 쉬기 권하는 말 중 (연속 터치가 끊지 않게)
  const calmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCalmAt = useRef(0);
  const lastCallAt = useRef(0);
  const slowRef = useRef(false);
  // 따라 말하기: 듣기 결과 기다림
  const waiting = useRef(false);
  const utter = useRef<ClipResult | null>(null);
  // 듣기 hook 에 넘길 최신 사물·단계
  const metaRef = useRef({ item: '', phase: 'object', expected: '' });

  const item = plan ? ITEMS[plan.items[idx]] : null;
  const say = (it: typeof item) => (it ? (english ? `${it.ko}! ${it.en}!` : `${it.ko}!`) : '');

  useEffect(() => {
    metaRef.current = { item: item?.ko ?? '', phase, expected: item ? `${item.ko}|${item.en}` : '' };
  }, [item, phase]);
  useEffect(() => {
    slowRef.current = slow;
  }, [slow]);

  // ---------- 상시 듣기 (녹음 버튼 없이) ----------
  const flow = useRef({ onClip: (_r: ClipResult) => {} });
  const getMeta = useCallback(() => metaRef.current, []);
  const onClip = useCallback((r: ClipResult) => flow.current.onClip(r), []);
  // 아바타가 말하는 중에 아이가 끼어들면 아바타 말을 멈추고 아이 말을 들음
  const onBargeIn = useCallback(() => stopRef.current(), []);
  const listener = useChildListener({ childId: profile?.childId, active: !!plan && focused && !!profile, meta: getMeta, onClip, onBargeIn });
  const { hold, release } = listener;

  /** 아바타 말하기: 말하는 동안 듣기를 멈춤 (아바타 목소리가 녹음되지 않게) */
  const talk = useCallback(
    async (text: string) => {
      const r = run.current;
      await hold();
      try {
        // 녹음을 멈추는 사이(최대 0.8초) 흐름이 바뀌었으면(누름·다음 등) 지난 문장은 말하지 않음 (두 문장이 겹쳐 들리던 문제)
        if (r === run.current) await speak(text);
      } finally {
        release();
      }
    },
    [speak, hold, release],
  );
  /** 진동: 무리 상태에선 쉼 */
  const buzz = (k: 'tap' | 'soft' | 'praise') => {
    if (!calmRef.current) haptic(k);
  };

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
  useEffect(
    () => () => {
      moodTimers.current.forEach(clearTimeout);
      if (calmTimer.current) clearTimeout(calmTimer.current);
      if (leaveGuard.current) clearTimeout(leaveGuard.current);
    },
    [],
  );

  /** 지금 사물에서 모은 감각 반응 (에이전트에 같이 보냄) */
  const signalsNow = useCallback((): Signals => {
    const s = sig.current;
    return {
      touches: s.touches,
      reaction_ms: s.firstReactionMs,
      gaze_ratio: s.faceFrames ? Math.round((s.lookFrames / s.faceFrames) * 100) / 100 : undefined,
      smiles: s.smiles,
      voices: s.voices,
      repeated: s.repeated,
      mood: agentMood(moodRef.current),
    };
  }, []);

  // ---------- 시작: 오늘 계획 받기 + 기록 시작 ----------
  useEffect(() => {
    let alive = true;
    // 서버가 응답 없이 멈춰도(연결 시간 제한 없음) 화면이 빈 채로 남지 않게 5초 뒤엔 기기에 저장된 프로필로 시작
    Promise.race([refreshProfile(), sleep(5000).then(loadProfile)]).then((p) => {
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
    setRest(false);
    // 안전망: 굴러가는 움직임의 끝 알림(onLeft)이 오지 않으면(측정 콜백 누락 등) 다음 버튼도 안 먹고 화면이 멈춤 → 2.5초 뒤 직접 넘김
    if (leaveGuard.current) clearTimeout(leaveGuard.current);
    leaveGuard.current = setTimeout(() => {
      leaveGuard.current = null;
      if (leaving.current) onLeftRef.current();
    }, 2500);
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
    if (leaveGuard.current) clearTimeout(leaveGuard.current);
    leaveGuard.current = null;
    // 이 사물에서 읽은 감각 상태를 한 번 기록 (부모 리포트: 사물별 상태)
    const s = signalsNow();
    logEvent('expression', {
      kind: 'state',
      mood: sig.current.peak,
      item: item.ko,
      gaze_ratio: s.gaze_ratio ?? null,
      touches: s.touches,
      voices: s.voices,
      smiles: s.smiles,
      reaction_ms: s.reaction_ms ?? null,
      repeated: s.repeated,
    });
    sig.current = newSig();
    moodRef.current = 'calm';
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
        setAttention(0);
        setSuccess(0);
        setPresses(0);
        setIdx(idx + 1);
        setPhase('object');
        return;
      }
      const top = (Object.entries(counts.current) as [ItemId, number][]).sort((a, b) => b[1] - a[1])[0];
      const fav = ITEMS[top ? top[0] : plan.items[0]].ko;
      // 말 놀이가 끝나면 손 놀이(쓸어내기·북·정리)를 거쳐 동화 또는 마무리로 — 갈 곳(next)을 같이 넘김
      router.replace({ pathname: '/child/play', params: { fav, basket: nextBasket.join(','), next: plan.story ? 'story' : 'end' } });
    }, 350);
  };

  useEffect(() => {
    onLeftRef.current = onLeft;
  });

  // ---------- 따라 말하기: 듣기 결과 기다리기 ----------
  /** 말소리 토막이 서버에서 돌아올 때까지 기다림. 아이가 말하는 중이거나 올리는 중이면 최대 10초 더 */
  const waitUtterance = useCallback(
    async (t: number, ms: number): Promise<ClipResult | null> => {
      utter.current = null;
      waiting.current = true;
      const t0 = Date.now();
      try {
        while (t === run.current) {
          if (utter.current) return utter.current;
          const el = Date.now() - t0;
          if (el > ms && !(listener.busyRef.current && el < ms + 10000)) break;
          await sleep(150);
        }
        return null;
      } finally {
        waiting.current = false;
        utter.current = null;
      }
    },
    [listener.busyRef],
  );

  const respondRef = useRef<(t: number, r: ClipResult) => Promise<void>>(async () => {});

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
          await talk(word);
          if (t !== run.current) return;
          droppedRef.current = true;
          setDropped(true);
          shownAt.current = Date.now();
          await sleep(dropDuration(reduceMotion) + 150);
          if (t !== run.current) return;
        }
        // 3) 권하는 말 — 에이전트(충항)가 있으면 그 대사, 없으면 커리큘럼 고정 문장. 아이 감각 반응을 같이 보냄
        const line = profile
          ? (
              await agentSay(
                { child_id: profile.childId, day: plan.day, item: it.id, moment: 'invite', signals: signalsNow() },
                fill(it.invite, { name, me }),
              )
            ).text
          : fill(it.invite, { name, me });
        if (t !== run.current) return;
        await talk(line);
        if (t !== run.current) return;
        // 4) 2초 동안 안 누르면 살짝 흔들리고 아바타가 사물을 보며 "눌러볼까?"
        await sleep(WAIT_MS);
        if (t !== run.current || pressCount.current > 0) return;
        setWiggle((n) => n + 1);
        react([['wait', 2600]], 'right');
        await talk('눌러볼까?');
      } else {
        await talk(`같이 따라 해 볼까? ${it.ko}!`);
        if (t !== run.current) return;
        // 녹음 버튼 없이 듣기 hook 이 계속 듣고 있음 → 말소리 토막 결과를 기다림
        let r = await waitUtterance(t, REPEAT_WAIT_MS);
        if (t !== run.current) return;
        if (!r) {
          // 말하지 않음: 틀렸다는 표시 없이 아바타가 한 번 더 말하고 다시 기다림
          react([['smile', 1600]]);
          await talk(word);
          if (t !== run.current) return;
          r = await waitUtterance(t, REPEAT_WAIT_MS);
          if (t !== run.current) return;
          // 그래도 조용하면 저절로 넘어가지 않고, 가끔 다시 권하며 계속 기다림 (넘어가는 건 아이가 말하거나 다음 버튼)
          const nudges = ['천천히 해도 괜찮아.', word, `준비되면 말해 줘. ${it.ko}!`];
          for (let i = 0; !r; i++) {
            if (i === 0) logEvent('repeat', { word: it.ko, matched: null, text: '' });
            r = await waitUtterance(t, 12000);
            if (t !== run.current) return;
            if (r) break;
            react([['smile', 1600]]);
            await talk(nudges[i % nudges.length]);
            if (t !== run.current) return;
          }
        }
        await respondRef.current(t, r);
      }
    })();
    return () => {
      run.current++;
      stop();
    };
  }, [plan, idx, phase, focused, talk, stop, name, me, profile, english, reduceMotion, react, kick, signalsNow, waitUtterance]);

  // ---------- 아이 얼굴: 응시 시간 5초마다, 웃음, 표정 변화 (입 트래킹은 아이 앱에서 뺌) ----------
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
    const now = Date.now();
    lastFrameAt.current = now;
    const s = sig.current;
    if (f.face) s.faceFrames += 1;
    if (f.looking) {
      looked.current += 1;
      s.lookFrames += 1;
    }
    gazeRecent.current = gazeRecent.current * 0.98 + (f.looking ? 0.02 : 0); // 얼굴이 안 보여도 안 본 것으로
    if (f.smile && !smileOn.current && now - lastSmile.current > 3000) {
      logEvent('smile');
      s.smiles += 1;
      lastSmile.current = now;
    }
    smileOn.current = f.smile;
    // 표정: 일정 시간 이어진 것만 바뀐 것으로 봄 → 기록 + 아바타가 따라 함 (웃음 → 웃음, 놀람 → 놀람)
    if (!f.face) return;
    const e: FaceExpr = f.expr ?? (f.smile ? 'smile' : 'neutral');
    if (e !== exprCand.current) {
      exprCand.current = e;
      exprCandSince.current = now;
      return;
    }
    const need = e === 'surprise' ? SURPRISE_STABLE_MS : EXPR_STABLE_MS;
    if (e !== exprStable.current && now - exprCandSince.current >= need) {
      const prev = exprStable.current;
      exprStable.current = e;
      exprStableSince.current = now;
      // 보통 표정은 웃음·놀람·찡그림에서 돌아올 때만 기록
      if (e !== 'neutral' || prev !== 'neutral') logEvent('expression', { kind: e, item: metaRef.current.item });
      setChildExpr(e);
    }
  }, []);

  // ---------- 감각 반응 → 상태 추정 (1초마다) ----------
  const estimateMood = (): Mood => {
    const s = sig.current;
    const now = Date.now();
    const rapid = s.touchTimes.filter((x) => now - x < RAPID_WINDOW_MS).length >= RAPID_TOUCHES;
    const frownStreak = exprStable.current === 'frown' && now - exprStableSince.current > FROWN_STREAK_MS;
    const alertRecent = s.alertAt > 0 && now - s.alertAt < ALERT_RECENT_MS;
    if (rapid || frownStreak || alertRecent) return 'overloaded';
    const lastAct = Math.max(s.lastTouchAt, s.lastVoiceAt, shownAt.current, lastCallAt.current);
    const camOn = now - lastFrameAt.current < 2000; // 카메라가 안 되면 응시로 판단하지 않음
    if (droppedRef.current && camOn && gazeRecent.current < DISTRACT_GAZE && now - lastAct > DISTRACT_IDLE_MS) return 'distracted';
    if (s.voices >= ENGAGED_VOICES) return 'engaged-voice';
    if (s.touches >= ENGAGED_TOUCHES) return 'engaged-touch';
    return 'calm';
  };

  /** 무리: 천천히 + 움직임·진동 줄이기 + 진정시키는 말 + 쉬기 권하기 */
  const onOverloaded = () => {
    const now = Date.now();
    if (leaving.current || now - lastCalmAt.current < CALM_COOLDOWN_MS || !item) return;
    lastCalmAt.current = now;
    calmRef.current = true;
    setCalm(true);
    setSlowState(true);
    setSlow(true);
    if (calmTimer.current) clearTimeout(calmTimer.current);
    calmTimer.current = setTimeout(() => {
      calmRef.current = false;
      setCalm(false);
    }, CALM_MS);
    const t = ++run.current;
    stop();
    react([['smile', 5000]]);
    calmBusy.current = true;
    (async () => {
      try {
        await talk('천천히 해도 괜찮아.');
        if (t !== run.current) return;
        setRest(true);
        await talk(`잠깐 쉬면서 ${me} 목소리만 들어볼까?`);
        if (t !== run.current) return;
      } finally {
        calmBusy.current = false;
      }
      await sleep(10000);
      if (t !== run.current) return;
      setRest(false);
      setKick((k) => k + 1);
    })();
  };

  /** 주의 흐트러짐: 이름 부르기(청각) + 사물이 크게 튐(시각) + 짧은 소리 */
  const onDistracted = () => {
    if (leaving.current || calmRef.current || !item) return;
    lastCallAt.current = Date.now();
    gazeRecent.current = 0.5;
    const t = ++run.current;
    stop();
    setAttention((n) => n + 1);
    playSfx('tong');
    react(
      [
        ['surprise', 400],
        ['smile', 1800],
      ],
      'right',
    );
    (async () => {
      await talk(`${callName(name)}여기 봐! ${say(item)}`);
      if (t !== run.current) return;
      await sleep(600);
      if (t === run.current) setKick((k) => k + 1);
    })();
  };

  const evaluate = () => {
    const m = estimateMood();
    const prev = moodRef.current;
    moodRef.current = m;
    const s = sig.current;
    if (SEVERITY[m] > SEVERITY[s.peak]) s.peak = m;
    if (m === prev) return;
    const now = Date.now();
    if (m === 'overloaded') onOverloaded();
    else if (m === 'distracted' && now - lastCallAt.current > CALL_COOLDOWN_MS) onDistracted();
  };
  const evalRef = useRef(evaluate);
  useEffect(() => {
    evalRef.current = evaluate;
  });
  useEffect(() => {
    if (!plan || !focused) return;
    const id = setInterval(() => evalRef.current(), 1000);
    return () => clearInterval(id);
  }, [plan, focused]);

  // ---------- 누르는 놀이 ----------
  const onToy = () => {
    if (!item || leaving.current) return; // 바구니로 굴러가는 중엔 반응하지 않음 (다음 사물 흐름과 겹치지 않게)
    const now = Date.now();
    const n = pressCount.current;
    const reaction = now - (n === 0 ? shownAt.current : lastPress.current);
    logEvent('touch', { target: item.ko, reaction_ms: reaction, count: n + 1 });
    const s = sig.current;
    s.touches += 1;
    s.touchTimes = [...s.touchTimes.slice(-9), now];
    s.lastTouchAt = now;
    if (n === 0) s.firstReactionMs = reaction;
    lastPress.current = now;
    pressCount.current = n + 1;
    counts.current[item.id] = (counts.current[item.id] ?? 0) + 1;
    setPresses(n + 1);
    playSfx(item.sound);
    buzz(item.haptic);
    // 아바타도 사물을 봄: 놀람 → 웃음
    react(
      [
        ['surprise', 450],
        ['smile', 1500],
      ],
      'right',
    );
    if (phase === 'repeat') return; // 따라 말하기 중엔 소리·진동·움직임만 (듣기 흐름은 그대로)
    if (calmBusy.current) return; // 진정시키는 말은 끊지 않음
    // 한 번 누를 때마다 이름을 다시 말해줌 (효과음이 들리게 살짝 뒤에). 한동안 안 누르면 따라 말하기로
    const t = ++run.current;
    stop();
    setTimeout(async () => {
      if (t !== run.current) return;
      await talk(say(item));
      if (t !== run.current) return;
      // 손 놀이에 빠진 아이: 한 번 더 눌러보게 권함 (사물마다 한 번)
      if (moodRef.current === 'engaged-touch' && !s.touchPrompted && !calmRef.current) {
        s.touchPrompted = true;
        setWiggle((w) => w + 1);
        await talk('한 번 더 눌러볼까?');
        if (t !== run.current) return;
      }
      await sleep(AUTO_REPEAT_MS);
      if (t === run.current) setPhase('repeat');
    }, 450);
  };

  // ---------- 말소리 반응 ----------
  /** 말 놀이에 빠진 아이: 단어를 천천히 한 번 더 들려줌 (영어 노출이면 영어도). 사물마다 한 번 */
  const modelWord = async (t: number) => {
    if (!item) return;
    sig.current.voiceModeled = true;
    const was = slowRef.current;
    setSlow(true);
    await talk(english ? `${item.ko}... ${item.ko}! ${item.en}!` : `${item.ko}... ${item.ko}!`);
    setSlow(was);
    if (t !== run.current) return;
  };

  /** 범위 밖 질문이면 지어내지 않고 주제로 되돌림 (판단은 에이전트, 없으면 간단 규칙). 처리했으면 true */
  const replyOutOfScope = async (t: number, text: string) => {
    if (!item) return false;
    const redirect = fill(`그건 이따 {me}한테 물어보자! 우리 ${item.ko} 계속 볼까?`, { name, me });
    const a = profile
      ? await agentSay(
          { child_id: profile.childId, day: plan?.day ?? 1, item: item.id, moment: 'reply', child_text: text, signals: signalsNow() },
          redirect,
        )
      : null;
    if (t !== run.current) return true;
    if (a?.outOfScope || looksLikeQuestion(text)) {
      if (!a?.outOfScope) logEvent('out_of_scope', { text }); // 에이전트가 이미 기록했으면 중복 기록 안 함
      await talk(a?.outOfScope ? a.text : redirect);
      return true;
    }
    return false;
  };

  /** 따라 말하기 결과에 응답 */
  const respond = async (t: number, r: ClipResult) => {
    if (!item) return;
    const res = r.res;
    const raw = res?.text?.trim() ?? '';
    const text = /[가-힣a-zA-Z]/.test(raw) ? raw : ''; // "." 처럼 기호만 인식되면 빈칸
    logEvent('repeat', { word: item.ko, matched: res ? res.matched : null, text, clip_id: res?.id ?? null });
    // 따라 말하기에서 소리를 냈으면 무조건 반응: 맞으면 크게 칭찬, 다르면 "좋아! 잘했어"로 칭찬하고 넘어감
    // (예전엔 엉뚱한 말로 보고 처음으로 되돌려서 "따라 해 볼까?"만 반복됐음)
    // 서버가 안 되면(음량으로 말소리는 확인) 시도한 것으로 봄
    const praised = !res || res.matched === true;
    if (praised) {
      // 성공: 사물이 크게 튀고 별이 퍼지며 아바타가 활짝 웃음 + "잘했어!" + 짧은 진동
      sig.current.repeated = true;
      setSuccess((n) => n + 1);
      playSfx('pop');
      buzz('praise');
      react([
        ['praise', 2000],
        ['smile', 800],
      ]);
      await talk(fill('참 잘했어, 우리 {name}!', { name, me }));
      if (t !== run.current) return;
      // 한 번 더 해 보기: 짧게 한 번만 기다리고, 말하든 안 하든 칭찬 후 넘어감 (계속 붙잡지 않음)
      await talk(`한 번 더 해 볼까? ${item.ko}!`);
      if (t !== run.current) return;
      const again = await waitUtterance(t, 4000);
      if (t !== run.current) return;
      if (again) {
        logEvent('repeat', { word: item.ko, matched: again.res ? again.res.matched : null, text: again.res?.text ?? '', clip_id: again.res?.id ?? null });
        setSuccess((n) => n + 1);
        playSfx('pop');
        react([['praise', 1500]]);
        await talk('우와, 최고야!');
        if (t !== run.current) return;
      }
      await talk('이제 다음으로 넘어가 볼까?');
      if (t !== run.current) return;
      await sleep(300);
    } else {
      // 다르게 말함·옹알이: 실패음·틀림 표시 없이 아바타가 한 번 더 말하고 넘어감
      react([['smile', 1800]]);
      await talk(`좋아! 잘했어. ${say(item)}`);
      if (t !== run.current) return;
      await sleep(600);
    }
    if (sig.current.voices >= ENGAGED_VOICES && !sig.current.voiceModeled) {
      await modelWord(t);
      if (t !== run.current) return;
    }
    if (t === run.current) doLeave();
  };

  /** 따라 말하기를 기다리지 않을 때 들어온 말소리 (사물 놀이 중 아이가 먼저 말함) */
  const freeClip = (res: ChildClipOut) => {
    if (!item || phase !== 'object' || leaving.current || calmBusy.current || !droppedRef.current) return;
    const raw = res.text?.trim() ?? '';
    const text = /[가-힣a-zA-Z]/.test(raw) ? raw : ''; // 기호만 인식되면 옹알이로
    const s = sig.current;
    if (res.matched) {
      // 시키지 않았는데 사물 이름을 말함 → 바로 칭찬 (말 반응을 놓치지 않음)
      s.repeated = true;
      const t = ++run.current;
      stop();
      setSuccess((n) => n + 1);
      playSfx('pop');
      buzz('praise');
      react([
        ['praise', 1800],
        ['smile', 800],
      ]);
      (async () => {
        await talk(`맞아, ${item.ko}! 잘했어!`);
        if (t !== run.current) return;
        if (s.voices >= ENGAGED_VOICES && !s.voiceModeled) await modelWord(t);
        if (t !== run.current) return;
        await sleep(AUTO_REPEAT_MS);
        if (t === run.current) setPhase('repeat');
      })();
      return;
    }
    if (!text) {
      react([['smile', 1200]], 'center'); // 옹알이·웃음소리: 아바타가 웃어 줌
      return;
    }
    const t = ++run.current;
    stop();
    (async () => {
      if (await replyOutOfScope(t, text)) {
        if (t === run.current) setKick((k) => k + 1);
        return;
      }
      if (t !== run.current) return;
      react([['smile', 1600]]);
      if (s.voices >= ENGAGED_VOICES && !s.voiceModeled) await modelWord(t);
      else await talk(`좋아! ${say(item)}`);
      if (t !== run.current) return;
      if (pressCount.current > 0) {
        await sleep(AUTO_REPEAT_MS);
        if (t === run.current) setPhase('repeat');
      } else setKick((k) => k + 1);
    })();
  };

  /** 듣기 hook 이 말소리 토막을 올린 뒤 */
  const handleClip = (r: ClipResult) => {
    if (!item || r.meta.item !== item.ko) return; // 앞 사물에서 들은 것 (기록은 hook 이 이미 함)
    const s = sig.current;
    const saved = !!r.res?.saved;
    if (saved) {
      s.voices += 1;
      s.lastVoiceAt = Date.now();
    }
    if (r.res?.alert) {
      s.alertAt = Date.now();
      evaluate(); // 울음 등은 바로 반영
      return;
    }
    if (waiting.current && (saved || (!r.res && r.spoke))) {
      utter.current = r;
      return;
    }
    if (saved && r.res) freeClip(r.res);
  };
  useEffect(() => {
    respondRef.current = respond;
    flow.current.onClip = handleClip;
  });

  /** 귀를 누름: 지금부터 몇 초 강제로 들음 (따라 말하기 중이면 그 결과로 응답) */
  const onEar = () => {
    if (leaving.current || !item) return;
    listener.force();
    if (phase !== 'repeat') return;
    const t = ++run.current;
    stop();
    (async () => {
      const r = await waitUtterance(t, 9000);
      if (t !== run.current) return;
      if (r) await respondRef.current(t, r);
      else setKick((k) => k + 1);
    })();
  };

  // ---------- 다음 버튼 ----------
  const next = () => {
    if (!plan || leaving.current) return;
    stop();
    setRest(false);
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
    if (item) setTimeout(() => talk(say(item)), 50);
  };

  const goRest = () => {
    run.current++;
    stop();
    setRest(false);
    router.push('/child/audio');
  };
  const keepPlaying = () => {
    run.current++;
    stop();
    setRest(false);
    setKick((k) => k + 1);
  };

  if (!plan || !item) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  // ---------- 크기: 폰(가로 약 800x360)은 줄이고 태블릿은 크게 ----------
  const compact = !isTablet || height < 520;
  const gap = compact ? 8 : 14;
  const pad = {
    paddingTop: (compact ? 6 : 12) + insets.top,
    paddingBottom: (compact ? 6 : 14) + insets.bottom,
    paddingLeft: (compact ? 14 : 28) + insets.left,
    paddingRight: (compact ? 14 : 28) + insets.right,
  };
  const headerH = compact ? 40 : 52;
  const basketH = compact ? Math.max(52, Math.min(64, height * 0.16)) : Math.max(88, Math.min(110, height * 0.13));
  const mainH = Math.max(140, height - pad.paddingTop - pad.paddingBottom - headerH - basketH - gap * 2);
  const avatarSize = Math.max(80, Math.min(mainH / 1.18, width * 0.34));
  const sfxH = compact ? 32 : 52;
  const sfxFont = compact ? 24 : 34;
  const wordFont = compact ? 26 : 34;
  const repeatFont = compact ? 30 : 40;
  const earSize = compact ? Math.max(38, Math.min(52, mainH * 0.2)) : Math.max(64, Math.min(88, mainH * 0.16));
  const rowH = Math.max(earSize * 1.45, compact ? 48 : 88);
  const toySize = Math.max(64, Math.min(mainH - sfxH - rowH - 24, mainH * 0.45, width * 0.22, 240));
  const nextSize = compact ? 60 : 92;
  const smallPill = compact ? { minHeight: 40 } : undefined;
  const motionLow = reduceMotion || calm;
  const expression: AvatarExpression =
    mood ?? (listener.status === 'hearing' ? 'wait' : childExpr === 'smile' ? 'smile' : childExpr === 'surprise' ? 'surprise' : 'neutral');

  return (
    <View style={[{ flex: 1, backgroundColor: C.bg, gap }, pad]}>
      <ParentExit home />
      {/* 상단: 일차 · 소리만 듣기 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: headerH }}>
        {/* 왼쪽 위 자물쇠·홈 버튼 자리를 비움 (예전엔 일차 표시가 자물쇠 밑에 가려졌음) */}
        <View style={{ marginLeft: parentExitZone(isTablet) + 8 - (compact ? 14 : 28), backgroundColor: C.primary, borderRadius: R.pill, paddingHorizontal: compact ? 14 : 18, paddingVertical: compact ? 6 : 10 }}>
          <Text style={{ color: C.onPrimary, fontSize: compact ? 15 : 18, fontWeight: '800' }}>{plan.day}일차</Text>
        </View>
        <PillButton
          small
          label="소리만 듣기"
          style={smallPill}
          onPress={() => {
            stop();
            router.push('/child/audio');
          }}
        />
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: compact ? 10 : 16 }}>
        {/* 왼쪽 약 40%: 부모 아바타 (입모양이 잘 보이게 크게) */}
        <View style={{ flex: 40, backgroundColor: C.white, borderRadius: R.lg, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <NodBox nod={nod} reduceMotion={motionLow}>
            <Avatar config={profile?.avatar} mouth={mouth} scale={scale} size={avatarSize} expression={expression} look={look} />
          </NodBox>
        </View>

        {/* 오른쪽 약 60%: 사물 무대 (한 번에 하나) */}
        <View style={{ flex: 60, backgroundColor: STAGE, borderRadius: R.lg, borderWidth: 2, borderColor: C.green, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          {/* 듣고 있는 귀 (사물 놀이 중엔 구석에 작게) */}
          {phase === 'object' && (
            <View style={{ position: 'absolute', top: 4, right: 4 }}>
              <EarListener status={listener.status} level={listener.level} onPress={onEar} size={compact ? 34 : 50} />
            </View>
          )}
          {/* 의성어 (누를 때마다 톡) */}
          <View style={{ height: sfxH, alignItems: 'center', justifyContent: 'flex-end' }}>
            {phase === 'object' && presses > 0 && (
              <Animated.Text key={presses} entering={ZoomIn.duration(220)} style={{ fontSize: sfxFont, fontWeight: '900', color: C.text }}>
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
              reduceMotion={motionLow}
              wiggle={wiggle}
              attention={attention}
              voice={listener.speechLevel}
              success={success}
              leave={leave}
              onLeft={onLeft}
              interactive // 따라 말하기 중에도 만지면 반응
            />
            {/* 바닥 그림자 — 떨어져 닿는 자리 */}
            <View style={{ width: toySize * 0.6, height: 12, borderRadius: 6, backgroundColor: C.green, opacity: dropped && !leave ? 0.45 : 0, marginTop: -6 }} />
          </View>

          {phase === 'object' ? (
            <View style={{ minHeight: rowH, alignItems: 'center', justifyContent: 'center' }}>
              {dropped && (
                <Animated.Text key={`w${idx}`} entering={FadeIn.duration(300)} style={{ fontSize: wordFont, fontWeight: '900', color: C.text }}>
                  {item.ko}!{english && <Text style={{ color: C.sub, fontWeight: '800' }}> {item.en}</Text>}
                </Animated.Text>
              )}
            </View>
          ) : (
            <Animated.View entering={FadeIn.duration(300)} style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 8 : 14, minHeight: rowH }}>
              <Text style={{ fontSize: repeatFont, fontWeight: '900', color: C.text }}>{item.ko}</Text>
              {/* 녹음 버튼 대신 듣고 있는 귀: 누르지 않아도 들음. 누르면 지금 바로 들음 */}
              <EarListener status={listener.status} level={listener.level} onPress={onEar} size={earSize} />
              <PillButton
                small
                label="다시 들려줘"
                style={smallPill}
                onPress={() => {
                  // 다시 들려준 뒤에도 아이 말을 기다림 (예전엔 흐름만 끊겨 따라 말해도 반응이 없었음)
                  const t = ++run.current;
                  stop();
                  (async () => {
                    await talk(say(item));
                    if (t !== run.current) return;
                    const r = await waitUtterance(t, REPEAT_WAIT_MS);
                    if (t !== run.current) return;
                    if (r) await respondRef.current(t, r);
                    else setKick((k) => k + 1);
                  })();
                }}
              />
            </Animated.View>
          )}
        </View>
      </View>

      {/* 아래: 오늘 모은 사물 바구니 · 천천히 · 다음 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? 10 : 16, height: Math.max(basketH, nextSize) }}>
        <Basket emojis={basket.map((b) => ITEMS[b].emoji)} height={basketH} nextRef={slotRef} />
        <PillButton label="천천히" small={compact} selected={slow} onPress={toggleSlow} />
        <RoundButton label="다음" size={nextSize} onPress={next}>
          <SkipIcon size={compact ? 24 : 34} />
        </RoundButton>
      </View>

      {/* 아이 얼굴 센서: 작고 흐리게 (기기 안에서만 처리, 영상은 저장·전송 안 함) */}
      {focused && (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: pad.paddingTop, left: width / 2 - (compact ? 28 : 36), opacity: 0.45 }}>
          <FaceSensor onFrame={onFrame} style={{ width: compact ? 56 : 72, height: compact ? 42 : 54, borderRadius: 12 }} />
        </View>
      )}

      {/* 무리일 때: 쉬기 권하기 — 큰 버튼으로 소리만 듣기 (엄마 목소리) */}
      {rest && (
        <Animated.View
          entering={FadeIn.duration(400)}
          exiting={FadeOut.duration(300)}
          style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,248,235,0.88)', alignItems: 'center', justifyContent: 'center', gap: compact ? 10 : 20 }}>
          <RoundButton label={`${me} 목소리 듣기`} size={compact ? Math.min(130, height * 0.4) : 190} onPress={goRest}>
            <Text allowFontScaling={false} style={{ fontSize: compact ? 48 : 72, includeFontPadding: false }}>
              🎧
            </Text>
          </RoundButton>
          <Text style={{ fontSize: compact ? 20 : 26, fontWeight: '900', color: C.text }}>{me} 목소리</Text>
          <PillButton small label="계속 놀기" style={smallPill} onPress={keepPlaying} />
        </Animated.View>
      )}
    </View>
  );
}
