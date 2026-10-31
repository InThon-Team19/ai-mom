// 아이 태블릿 감각 놀이 (손 놀이) — 담당: 태희 (기획 3 "세 감각을 한 동작에 묶기" · "진동 원칙")
// 순서: 쓸어내기(그림 드러내기) → 두드리기(북) → 끌어서 옮기기(정리 놀이). 판마다 짧게(약 40초 안) 자동으로 넘어감
// 아이가 8초 동안 아무것도 안 하면 아바타가 다시 권하며 놀잇감이 살짝 흔들리고, 한 번 더 가만히 있으면 다음 판으로 (멈추지 않음)
// 흐름: 말 놀이(session) 끝 → 여기 → 동화(story) 또는 마무리(end). params: fav · basket · next('story' | 'end')
//       아이 홈 "손 놀이" 버튼으로 바로 오면 next 가 없어 끝나고 마무리로 감
// 모든 동작은 logEvent('touch', { action: 'swipe' | 'tap' | 'drag', ... }) 로 기록 → 부모 리포트 촉각
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { Avatar, type AvatarExpression } from '@/components/Avatar';
import { ParentExit } from '@/components/ParentExit';
import { DrumStation, RevealStation, SortStation, type StationProps } from '@/components/child/SenseStations';
import { AvatarPanel, ChunkyButton, CloseButton, HandIcon, K, KidScreen, SenseChip, TopBar, useKid, WhiteCard } from '@/components/child/design';
import { sleep, useDailyLimit, useMouthScale, who } from '@/components/child/kit';
import { NodBox } from '@/components/child/stage';
import { dayOf, fill, ITEMS, type ItemId } from '@/content/curriculum';
import { useSpeak } from '@/hooks/useSpeak';
import { setVibration, startActivityLog } from '@/lib/sense';
import { loadProfile, refreshProfile, useProfile } from '@/lib/store';

const IDLE_MS = 8000; // 이만큼 가만히 있으면 다시 권함, 한 번 더 가만히 있으면 다음 판
const STATIONS = 3;

// 엄마 목소리 대사 (물결·말줄임·이모지 없이)
const INTRO = [
  '{name}야, 손으로 쓱쓱 문질러 볼까? 뭐가 숨어 있을까?',
  '둥둥 북이야! 손으로 톡톡 두드려 볼까?',
  '이제 정리해 볼까? 바구니 제자리에 쏙 넣어 줘.',
];
const INVITE = ['여기를 손으로 쓱쓱 해 볼까?', '북을 톡 쳐 볼까?', '손으로 꾹 잡고 바구니로 옮겨 볼까?'];
const DRUM_DONE = '잘했어! 둥둥 최고야.';
const ALL_DONE = '다 정리했다! 최고야.';

export default function Play() {
  const profile = useProfile();
  const kid = useKid();
  const focused = useIsFocused();
  const { fav, basket, next } = useLocalSearchParams<{ fav?: string; basket?: string; next?: string }>();
  const { speak, stop, mouth } = useSpeak(profile?.childId);
  const scale = useMouthScale(profile?.childId);
  const { name, me, english } = who(profile);
  const reduceMotion = !!profile?.settings.reduceMotion;

  const [ready, setReady] = useState(false);
  const [station, setStation] = useState(0);
  const [nod, setNod] = useState(0);
  const [wiggle, setWiggle] = useState(0);
  const [expr, setExpr] = useState<AvatarExpression | null>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [line, setLine] = useState(''); // 아바타가 지금 하는 말 (왼쪽 말풍선)

  // 오늘 놀 사물: 말 놀이에서 모은 바구니, 없으면 오늘 계획의 사물
  const items = useMemo<ItemId[]>(() => {
    const ids = [...new Set((basket ?? '').split(',').filter((x): x is ItemId => x in ITEMS))];
    return ids.length ? ids : dayOf(profile?.day ?? 1).items;
  }, [basket, profile?.day]);

  const busy = useRef(false); // 아바타가 말하는 중
  const sayGen = useRef(0);
  const flowGen = useRef(0); // 판 바뀜·건너뛰기로 이전 흐름 취소
  const moving = useRef(false);
  const stationRef = useRef(0);
  const stationAt = useRef(0); // 판이 시작될 때 채움
  const lastAction = useRef(0); // 판이 시작될 때 채움
  const quietSince = useRef(0); // 아바타 말이 끝난 때 (말하는 동안은 가만히 있는 시간으로 안 셈)
  const idleStage = useRef(0);
  const exprTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stationRef.current = station;
  }, [station]);

  // ---------- 시작: 프로필 새로 받기 + 기록·진동 설정 (홈에서 바로 왔을 때도) ----------
  useEffect(() => {
    let alive = true;
    // 서버가 응답 없이 멈춰도 빈 화면으로 남지 않게 5초 뒤엔 기기에 저장된 프로필로 시작
    Promise.race([refreshProfile(), sleep(5000).then(loadProfile)])
      .then((p) => {
        if (!alive) return;
        startActivityLog(p.childId);
        setVibration(p.settings.vibration !== false);
        setReady(true);
      })
      .catch(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(
    () => () => {
      flowGen.current++; // 화면을 떠나면 남은 흐름이 다른 화면으로 이동시키지 않게 취소 (말하기가 끝나며 이어지던 문제)
      if (exprTimer.current) clearTimeout(exprTimer.current);
      stop();
    },
    [stop],
  );

  /** 아바타 말하기 (엄마 목소리). force 가 아니면 이미 말하는 중일 땐 건너뜀 (북 칠 때마다 말하지 않게) */
  const say = useCallback(
    async (text: string, force = false) => {
      if (busy.current && !force) return;
      busy.current = true;
      const my = ++sayGen.current;
      setLine(text);
      try {
        await speak(text);
      } finally {
        if (my === sayGen.current) {
          busy.current = false;
          quietSince.current = Date.now();
        }
      }
    },
    [speak],
  );

  /** 아바타 표정을 잠깐 바꿨다가 기본(웃음)으로 */
  const feel = useCallback((e: AvatarExpression, ms = 1200) => {
    if (exprTimer.current) clearTimeout(exprTimer.current);
    setExpr(e);
    exprTimer.current = setTimeout(() => setExpr(null), ms);
  }, []);

  const onActivity = useCallback(() => {
    lastAction.current = Date.now();
    idleStage.current = 0;
  }, []);

  // ---------- 끝: 동화 또는 마무리로 (받은 fav·basket 그대로) ----------
  const finish = useCallback(() => {
    stop();
    const params = { ...(fav ? { fav } : {}), ...(basket ? { basket } : {}) };
    router.replace({ pathname: next === 'story' ? '/child/story' : '/child/end', params });
  }, [stop, fav, basket, next]);

  const advanceNow = useCallback(() => {
    moving.current = false;
    if (stationRef.current < STATIONS - 1) setStation(stationRef.current + 1);
    else finish();
  }, [finish]);

  /** 한마디(있으면) 한 뒤 다음 판으로 */
  const goNext = useCallback(
    (line?: string) => {
      if (moving.current) return;
      moving.current = true;
      const my = ++flowGen.current;
      (async () => {
        if (line) await say(line, true);
        if (my !== flowGen.current) return;
        advanceNow();
      })();
    },
    [say, advanceNow],
  );

  /** "다음" 버튼: 말을 끊고 바로 다음 판 */
  const skip = () => {
    flowGen.current++;
    stop();
    advanceNow();
  };

  // ---------- 하루 사용 상한 ----------
  const toEnd = useCallback(() => {
    stop();
    router.replace({ pathname: '/child/end', params: { ...(fav ? { fav } : {}), ...(basket ? { basket } : {}) } });
  }, [stop, fav, basket]);
  useDailyLimit(profile?.settings.dailyLimitMin, ready && focused, toEnd);

  // ---------- 판마다 아바타가 먼저 말함 ----------
  useEffect(() => {
    if (!ready || !focused) return;
    const my = ++flowGen.current;
    moving.current = false;
    stationAt.current = Date.now();
    lastAction.current = Date.now();
    idleStage.current = 0;
    (async () => {
      await sleep(400);
      if (my !== flowGen.current) return;
      setNod((n) => n + 1);
      feel('smile', 1500);
      await say(fill(INTRO[station], { name, me }), true);
    })();
    return () => {
      if (my === flowGen.current) flowGen.current++; // 포커스를 잃으면 이 판의 첫 말도 취소
    };
  }, [station, ready, focused, name, me, say, feel]);

  // ---------- 가만히 있으면 다시 권하고, 또 가만히 있으면 다음 판 · 한 판 최대 시간 ----------
  const tick = () => {
    if (moving.current) return;
    const now = Date.now();
    const last = stationRef.current === STATIONS - 1;
    void last; // 저절로 다음 판으로 가지 않음 — 아이가 끝내거나 다음 버튼 (사용자 요청)
    if (busy.current) return;
    const idle = now - Math.max(lastAction.current, quietSince.current, stationAt.current);
    if (idle < IDLE_MS) return;
    {
      // 가만히 있으면 흔들며 다시 권함 (12초마다 반복, 넘어가지는 않음)
      lastAction.current = now + 4000;
      setWiggle((w) => w + 1);
      setNod((n) => n + 1);
      feel('wait', 2200);
      void say(fill(INVITE[stationRef.current], { name, me }));
    }
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

  // ---------- 판이 끝났을 때 ----------
  const onDone = useCallback(() => {
    const s = stationRef.current;
    if (s === 0) goNext(); // 그림 이름은 이미 말함
    else if (s === 1) goNext(DRUM_DONE);
    else goNext(ALL_DONE);
  }, [goNext]);

  if (!profile) return <View style={{ flex: 1, backgroundColor: K.bg }} />;

  // ---------- 크기: 보드(1180x820) 비율 (session 과 같은 기준). 폰 가로에선 감각 칩을 숨겨 놀이 칸을 넓게 ----------
  const { u, f, compact } = kid;
  const first = ITEMS[items[0]]?.ko ?? '';
  const chips: { kind: 'touch' | 'audio' | 'visual'; label: string }[][] = [
    [
      { kind: 'touch', label: '촉각 · 톡톡 진동' },
      { kind: 'audio', label: '청각 · 쓱쓱 소리' },
      { kind: 'visual', label: `시각 · 70% 보이면 "${first}!"` },
    ],
    [
      { kind: 'audio', label: '청각 · 세게 칠수록 큰 소리' },
      { kind: 'touch', label: '촉각 · 짧고 약한 진동' },
      { kind: 'visual', label: '시각 · 파동이 퍼져요' },
    ],
    [
      { kind: 'touch', label: '촉각 · 쏙! 짧은 진동' },
      { kind: 'audio', label: `청각 · ${me} 목소리 "잘했어!"` },
      { kind: 'visual', label: '시각 · 살며시 제자리로' },
    ],
  ];

  const common: StationProps = {
    w: stage.w,
    h: stage.h,
    reduceMotion,
    wiggle,
    english,
    onActivity,
    say,
    feel,
    onDone,
  };

  return (
    <KidScreen gap={20}>
      {/* 머리줄 (보드 PlaySwipe · PlayDrum · PlaySort): 닫기 · 손 놀이 n / 3 + 진행 · 부모 */}
      <TopBar
        left={
          <CloseButton
            onBefore={() => {
              flowGen.current++;
              stop();
            }}
          />
        }
        title="손 놀이"
        extra={`${station + 1} / ${STATIONS}`}
        icon={<HandIcon size={u(26, 18)} />}
        steps={3}
        right={<ParentExit />}
      />

      <View style={{ flex: 1, minHeight: 0, flexDirection: 'row', gap: u(24, 10) }}>
        {/* 왼쪽: 아바타 판 + 말풍선 */}
        <AvatarPanel
          line={line}
          avatar={(w, h) => (
            <NodBox nod={nod} reduceMotion={reduceMotion}>
              <Avatar config={profile.avatar} mouth={mouth} scale={scale} size={Math.round(Math.min(w * 0.8, (h * 0.72) / 1.1))} expression={expr ?? 'smile'} />
            </NodBox>
          )}
        />

        {/* 오른쪽: 흰 카드 = 놀이 무대 + 감각 칩 */}
        <WhiteCard style={{ overflow: 'hidden' }}>
          <View onLayout={(e) => setStage({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })} style={{ flex: 1, overflow: 'hidden' }}>
            {ready && stage.w > 0 && (
              <>
                {station === 0 && <RevealStation key="reveal" items={items} {...common} />}
                {station === 1 && <DrumStation key="drum" {...common} />}
                {station === 2 && <SortStation key="sort" items={items} {...common} />}
              </>
            )}
          </View>
          {!compact && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: u(10, 6), paddingTop: u(14, 6), paddingHorizontal: u(20, 8), paddingBottom: u(24, 8) }}>
              {chips[station].map((c) => (
                <SenseChip key={c.label} kind={c.kind} label={c.label} />
              ))}
            </View>
          )}
        </WhiteCard>
      </View>

      {/* 아래: 다음 (말을 끊고 바로 다음 판) */}
      <View style={{ height: u(86, 46), flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
        <ChunkyButton label="다음" onPress={skip} height={u(80, 42)} width={u(234, 110)} fontSize={f(36, 18)} d={u(6, 3)} />
      </View>
    </KidScreen>
  );
}
