// 아이 태블릿 "엄마랑 이야기하기" (학습이 끝난 뒤 자유 대화 — 가르치지 않고 정서 교감) — 담당: 태희
// 아바타가 먼저 말을 걸고(에이전트 moment 'chat', child_text 없음 → 여는 말), 이후 녹음 버튼 없이 계속 들음 (useChildListener)
// 아이 말 → 최근 대화(최대 6턴)와 함께 에이전트에 보냄 → 따뜻한 대답. 받아쓰기가 안 된 옹알이·웃음은 서버 없이 짧게 맞장구
// 12초 동안 조용하면 부드러운 질문 하나, 질문을 3번 해도 조용하면 마무리. 약 3분 또는 아이 말 10번이면 마무리 → 3-8 마무리 화면
// 틀렸다는 표시 없음. 범위 밖 질문은 서버가 주제로 부드럽게 되돌리고, agentSay 가 부모 확인 목록에 기록함
// 흐름: 마무리(end) "엄마랑 더 이야기하기" 또는 아이 홈 "이야기하기" → 여기 → 마무리(end). params: fav · basket (받은 그대로 넘김)
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, type AvatarExpression } from '@/components/Avatar';
import { ParentExit } from '@/components/ParentExit';
import { EarListener, PillButton, sleep, useDailyLimit, useMouthScale, who } from '@/components/child/kit';
import { NodBox } from '@/components/child/stage';
import { dayOf, fill } from '@/content/curriculum';
import { useChildListener, type ClipResult } from '@/hooks/useChildListener';
import { useSpeak } from '@/hooks/useSpeak';
import { agentSay, type TurnIn } from '@/lib/agent';
import { useDevice } from '@/lib/layout';
import { logEvent, setVibration, startActivityLog } from '@/lib/sense';
import { refreshProfile, useProfile } from '@/lib/store';
import { C, R } from '@/theme';

type Turn = NonNullable<TurnIn['history']>[number];

const IDLE_MS = 12000; // 이만큼 조용하면 부드러운 질문 하나
const IDLE_MAX = 3; // 질문을 이만큼 해도 조용하면 마무리
const CHAT_MAX_MS = 10 * 60 * 1000; // 약 10분이면 마무리 (하루 사용 상한도 따로 적용)
const CHAT_MAX_TURNS = 40; // 아이 말 40번이면 마무리
const HISTORY_MAX = 6;

// 엄마 목소리 대사 (물결·말줄임·이모지 없이)
const OPENING = '{name}야, 오늘 재미있었어? {me}랑 이야기하자!';
const ENDING = '오늘 {me}랑 이야기해서 정말 좋았어. 이따 {me} 오면 또 이야기해 줘!';
const ACKS = ['응응!', '우와!', '정말?', '히히, 좋아!', '오오, 그래서?', '와, 신난다!'];
const IDLE_ASKS = ['{name}는 뭐가 제일 좋아?', '오늘 뭐 하고 놀았어?', '기분이 어때?', '{name}는 무슨 놀이가 재미있어?'];
// 에이전트가 없거나 늦을 때의 대답 (아이 말에 맞장구만, 지어내지 않음)
const REPLY_FALLBACK = ['우와, 정말? 또 이야기해 줘!', '{name} 이야기 정말 재미있다!', '오, 그래서 어떻게 됐어?', '히히, {me}도 궁금해!'];

export default function Chat() {
  const profile = useProfile();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { isTablet } = useDevice();
  const focused = useIsFocused();
  const { fav, basket } = useLocalSearchParams<{
    fav?: string;
    basket?: string;
  }>();
  const { speak, stop, mouth } = useSpeak(profile?.childId);
  const stopRef = useRef(stop); // 끼어들기 때 아바타 말 멈추기용
  useEffect(() => {
    stopRef.current = stop;
  });
  const scale = useMouthScale(profile?.childId);
  const { name, me } = who(profile);
  const reduceMotion = !!profile?.settings.reduceMotion;

  const [ready, setReady] = useState(false);
  const [ending, setEnding] = useState(false);
  const [mood, setMood] = useState<AvatarExpression | null>(null);
  const [nod, setNod] = useState(0);

  const run = useRef(0); // 진행 중인 말하기 흐름 취소용
  const busy = useRef(false); // 아바타가 생각하거나 말하는 중
  const ended = useRef(false);
  const history = useRef<Turn[]>([]);
  const pending = useRef<string | null>(null); // 대답하는 동안 들어온 아이 말 (끝나면 이어서 대답)
  const startedAt = useRef(0);
  const lastActivity = useRef(0);
  const idleCount = useRef(0);
  const childTurns = useRef(0);
  const rot = useRef({ ack: 0, ask: 0, fb: 0 });
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const day = profile?.day ?? 1;
  const item = dayOf(day).items[0] ?? 'apple';

  // ---------- 시작: 프로필 새로 받기 + 기록 다시 시작 (마무리 화면이 기록을 멈췄으므로) ----------
  useEffect(() => {
    let alive = true;
    refreshProfile()
      .then((pr) => {
        if (!alive) return;
        startActivityLog(pr.childId);
        setVibration(pr.settings.vibration !== false);
        logEvent('session', { topic: 'chat', day: pr.day });
        setReady(true);
      })
      .catch(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  // ---------- 상시 듣기 (녹음 버튼 없이) ----------
  const flow = useRef({ onClip: (_r: ClipResult) => {} });
  const getMeta = useCallback(() => ({ item: '', phase: 'free', expected: '' }), []);
  const onClip = useCallback((r: ClipResult) => flow.current.onClip(r), []);
  const listener = useChildListener({
    childId: profile?.childId,
    active: ready && focused && !!profile && !ending,
    meta: getMeta,
    onClip,
    onBargeIn: () => stopRef.current(), // 아바타가 말하는 중에 아이가 끼어들면 아바타 말을 멈춤
  });
  const { hold, release } = listener;

  /** 아바타 말하기: 말하는 동안 듣기를 멈춤 (아바타 목소리가 녹음되지 않게) */
  const talk = useCallback(
    async (text: string) => {
      await hold();
      try {
        await speak(text);
      } finally {
        release();
        lastActivity.current = Date.now(); // 말이 끝난 뒤부터 조용한 시간을 셈
      }
    },
    [speak, hold, release],
  );

  /** 진행 중인 말하기 흐름 취소 (화면을 떠나거나 다시 들어올 때) */
  const cancel = useCallback(() => {
    run.current += 1;
    busy.current = false;
  }, []);

  /** 표정을 잠깐 바꿨다가 기본(웃음)으로 */
  const feel = useCallback((e: AvatarExpression, ms = 1600) => {
    if (moodTimer.current) clearTimeout(moodTimer.current);
    setMood(e);
    moodTimer.current = setTimeout(() => setMood(null), ms);
  }, []);
  useEffect(
    () => () => {
      if (moodTimer.current) clearTimeout(moodTimer.current);
      cancel();
      stop();
    },
    [stop, cancel],
  );

  const remember = (t: Turn) => {
    history.current = [...history.current, t].slice(-HISTORY_MAX);
  };

  // ---------- 마무리: 인사 한마디 → 3-8 마무리 화면 (받은 fav·basket 그대로) ----------
  const wrapUp = useCallback(async () => {
    if (ended.current) return;
    ended.current = true;
    const t = ++run.current;
    stop();
    busy.current = true;
    setEnding(true);
    feel('smile', 6000);
    setNod((n) => n + 1);
    void t;
    // 다른 흐름이 끼어들어도, 인사 목소리가 늦어도 반드시 마무리 화면으로 (그만할래가 안 먹던 문제)
    await Promise.race([talk(fill(ENDING, { name, me })), sleep(5000)]);
    stop();
    await sleep(300);
    const params = { ...(fav ? { fav } : {}), ...(basket ? { basket } : {}) };
    router.replace({ pathname: '/child/end', params });
  }, [stop, feel, talk, name, me, fav, basket]);

  const shouldEnd = () => childTurns.current >= CHAT_MAX_TURNS || Date.now() - startedAt.current >= CHAT_MAX_MS;

  useDailyLimit(profile?.settings.dailyLimitMin, ready && focused, () => {
    wrapUp();
  });

  // ---------- 아이 말에 대답 ----------
  const reply = async (text: string) => {
    if (!profile || ended.current) return;
    busy.current = true;
    const t = ++run.current;
    const prior = history.current.slice(-HISTORY_MAX);
    remember({ role: 'child', text });
    feel('wait', 3500); // 생각하는 동안 귀 기울이는 얼굴
    const fb = fill(REPLY_FALLBACK[rot.current.fb++ % REPLY_FALLBACK.length], {
      name,
      me,
    });
    const a = await agentSay(
      {
        child_id: profile.childId,
        day,
        item,
        moment: 'chat',
        child_text: text,
        history: prior,
        signals: {
          touches: 0,
          smiles: 0,
          voices: childTurns.current,
          mood: 'engaged',
        },
      },
      fb,
    );
    if (t !== run.current || ended.current) return;
    // 범위 밖이면 서버가 이미 부드럽게 되돌린 문장 (부모 확인 기록은 agentSay 가 함) → 그대로 말함
    feel('smile', 2200);
    setNod((n) => n + 1);
    await talk(a.text);
    if (t !== run.current || ended.current) return;
    remember({ role: 'avatar', text: a.text });
    settle();
  };

  /** 아바타 말이 끝난 뒤: 시간·횟수가 다 됐으면 마무리, 그사이 들어온 아이 말이 있으면 이어서 대답 */
  const settle = () => {
    busy.current = false;
    if (ended.current) return;
    if (shouldEnd()) return void wrapUp();
    const next = pending.current;
    pending.current = null;
    if (next) reply(next);
  };

  /** 받아쓰기가 안 된 옹알이·웃음소리: 서버 없이 웃으며 짧게 맞장구 */
  const acknowledge = async () => {
    if (busy.current || ended.current) return;
    busy.current = true;
    const t = ++run.current;
    feel('smile', 1800);
    await talk(ACKS[rot.current.ack++ % ACKS.length]);
    if (t !== run.current || ended.current) return;
    settle();
  };

  /** 듣기 hook 이 말소리 토막을 올린 뒤 (기록은 hook 이 이미 함) */
  const handleClip = (r: ClipResult) => {
    if (ended.current || !startedAt.current) return;
    const raw = r.res?.text?.trim() ?? '';
    const text = /[가-힣a-zA-Z]/.test(raw) ? raw : ''; // "." 처럼 기호만 인식되면 옹알이로
    const saved = !!r.res?.saved;
    if (saved && text) {
      lastActivity.current = Date.now();
      idleCount.current = 0;
      childTurns.current += 1;
      if (busy.current) {
        pending.current = pending.current ? `${pending.current} ${text}` : text;
        return;
      }
      reply(text);
      return;
    }
    if (saved || (!r.res && r.spoke)) {
      lastActivity.current = Date.now();
      idleCount.current = 0;
      acknowledge();
    }
  };
  useEffect(() => {
    flow.current.onClip = handleClip;
  });

  // ---------- 화면에 들어오면 아바타가 먼저 말을 검 ----------
  const open = (t: number) => {
    if (!profile) {
      busy.current = false;
      return;
    }
    (async () => {
      await sleep(400);
      if (t !== run.current) return;
      if (!startedAt.current) startedAt.current = Date.now();
      setNod((n) => n + 1);
      const a = await agentSay(
        {
          child_id: profile.childId,
          day,
          item,
          moment: 'chat',
          history: history.current,
        },
        fill(OPENING, { name, me }),
      );
      if (t !== run.current) return;
      feel('smile', 2500);
      await talk(a.text);
      if (t !== run.current) return;
      remember({ role: 'avatar', text: a.text });
      settle();
    })();
  };
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });
  // 처음 들어올 때·다시 돌아올 때만 (프로필 내용이 바뀌어도 다시 열지 않음)
  useEffect(() => {
    if (!ready || !focused || ended.current) return;
    const t = ++run.current;
    busy.current = true;
    openRef.current(t);
    return () => {
      cancel();
      stop();
    };
  }, [ready, focused, stop, cancel]);

  // ---------- 조용할 때: 부드러운 질문 · 시간 다 되면 마무리 (1초마다 확인) ----------
  const tick = () => {
    if (ended.current || busy.current || !startedAt.current) return;
    if (listener.status === 'hearing' || listener.busyRef.current) {
      lastActivity.current = Date.now(); // 아이가 말하는 중이거나 올리는 중
      return;
    }
    if (shouldEnd()) return void wrapUp();
    if (Date.now() - lastActivity.current < IDLE_MS) return;
    void IDLE_MAX; // 조용해도 저절로 끝내지 않음 — 그만할래 버튼·시간 상한으로만 (사용자 요청)
    idleCount.current += 1;
    busy.current = true;
    const t = ++run.current;
    const q = fill(IDLE_ASKS[rot.current.ask++ % IDLE_ASKS.length], {
      name,
      me,
    });
    (async () => {
      feel('smile', 2200);
      setNod((n) => n + 1);
      await talk(q);
      if (t !== run.current || ended.current) return;
      remember({ role: 'avatar', text: q });
      settle();
    })();
  };
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });
  useEffect(() => {
    if (!ready || !focused) return;
    const id = setInterval(() => tickRef.current(), 1000);
    return () => clearInterval(id);
  }, [ready, focused]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  // ---------- 크기: 폰은 줄이고 태블릿은 크게. 가로가 기본, 세로 화면이면 위아래로 ----------
  const compact = !isTablet || height < 520;
  const landscape = width > height;
  const pad = {
    paddingTop: (compact ? 10 : 20) + insets.top,
    paddingBottom: (compact ? 10 : 20) + insets.bottom,
    paddingLeft: (compact ? 16 : 32) + insets.left,
    paddingRight: (compact ? 16 : 32) + insets.right,
  };
  const innerW = width - pad.paddingLeft - pad.paddingRight;
  const innerH = height - pad.paddingTop - pad.paddingBottom;
  const sideW = landscape ? Math.max(compact ? 150 : 220, innerW * 0.28) : innerW;
  const cardW = landscape ? innerW - sideW - (compact ? 12 : 24) : innerW;
  const cardH = landscape ? innerH : innerH * 0.62;
  const avatarSize = Math.max(100, Math.min(cardH / 1.15, cardW * 0.8, 420));
  const earSize = compact ? 64 : 104;
  const expression: AvatarExpression = mood ?? (listener.status === 'hearing' ? 'wait' : 'smile');

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: C.bg,
          flexDirection: landscape ? 'row' : 'column',
          gap: compact ? 12 : 24,
        },
        pad,
      ]}>
      <ParentExit home />

      {/* 큰 아바타 (입모양이 잘 보이게) */}
      <View
        style={{
          width: cardW,
          height: cardH,
          backgroundColor: C.white,
          borderRadius: R.lg,
          borderWidth: 2,
          borderColor: C.border,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}>
        <NodBox nod={nod} reduceMotion={reduceMotion}>
          <Avatar config={profile?.avatar} mouth={mouth} scale={scale} size={avatarSize} expression={expression} />
        </NodBox>
      </View>

      {/* 듣고 있는 귀 (누르면 지금 바로 들음) · 그만할래 */}
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: compact ? 12 : 24,
        }}>
        <EarListener status={listener.status} level={listener.level} onPress={() => !ending && listener.force()} size={earSize} />
        <Text
          style={{
            fontSize: compact ? 18 : 24,
            fontWeight: '900',
            color: C.text,
            textAlign: 'center',
          }}>
          {me}랑 이야기
        </Text>
        {!ending && <PillButton small={compact} label="그만할래" onPress={() => wrapUp()} />}
      </View>
    </View>
  );
}
