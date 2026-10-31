// 아이 태블릿 감각 놀이 (손 놀이) — 담당: 태희 (기획 3 "세 감각을 한 동작에 묶기" · "진동 원칙")
// 순서: 쓸어내기(그림 드러내기) → 두드리기(북) → 끌어서 옮기기(정리 놀이). 판마다 짧게(약 40초 안) 자동으로 넘어감
// 아이가 8초 동안 아무것도 안 하면 아바타가 다시 권하며 놀잇감이 살짝 흔들리고, 한 번 더 가만히 있으면 다음 판으로 (멈추지 않음)
// 흐름: 말 놀이(session) 끝 → 여기 → 동화(story) 또는 마무리(end). params: fav · basket · next('story' | 'end')
//       아이 홈 "손 놀이" 버튼으로 바로 오면 next 가 없어 끝나고 마무리로 감
// 모든 동작은 logEvent('touch', { action: 'swipe' | 'tap' | 'drag', ... }) 로 기록 → 부모 리포트 촉각
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, type AvatarExpression } from '@/components/Avatar';
import { ParentExit } from '@/components/ParentExit';
import { DrumStation, RevealStation, SortStation, type StationProps } from '@/components/child/SenseStations';
import { RoundButton, SkipIcon, sleep, useDailyLimit, useMouthScale, who } from '@/components/child/kit';
import { NodBox } from '@/components/child/stage';
import { dayOf, fill, ITEMS, type ItemId } from '@/content/curriculum';
import { useSpeak } from '@/hooks/useSpeak';
import { useDevice } from '@/lib/layout';
import { setVibration, startActivityLog } from '@/lib/sense';
import { refreshProfile, useProfile } from '@/lib/store';
import { C, R } from '@/theme';

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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { isTablet } = useDevice();
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
    refreshProfile()
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

  if (!profile) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  // ---------- 크기: 폰(가로 약 800x360)은 줄이고 태블릿은 크게 (session 과 같은 기준) ----------
  const compact = !isTablet || height < 520;
  const gap = compact ? 8 : 14;
  const pad = {
    paddingTop: (compact ? 6 : 12) + insets.top,
    paddingBottom: (compact ? 6 : 14) + insets.bottom,
    paddingLeft: (compact ? 14 : 28) + insets.left,
    paddingRight: (compact ? 14 : 28) + insets.right,
  };
  const headerH = compact ? 52 : 68;
  const mainH = Math.max(140, height - pad.paddingTop - pad.paddingBottom - headerH - gap);
  const avatarSize = Math.max(80, Math.min(mainH / 1.2, width * 0.26));
  const nextSize = compact ? 48 : 64;

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
    <View style={[{ flex: 1, backgroundColor: C.bg, gap }, pad]}>
      <ParentExit home />
      {/* 위: (왼쪽은 자물쇠·홈 자리) 몇 번째 판인지 점 세 개 · 다음 */}
      <View style={{ height: headerH, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16 }}>
        <View accessibilityLabel={`${station + 1}번째 놀이`} style={{ flexDirection: 'row', gap: 8 }}>
          {Array.from({ length: STATIONS }, (_, i) => (
            <View
              key={i}
              style={{ width: compact ? 12 : 16, height: compact ? 12 : 16, borderRadius: 8, backgroundColor: i <= station ? C.primaryStrong : C.track }}
            />
          ))}
        </View>
        <RoundButton label="다음" size={nextSize} onPress={skip}>
          <SkipIcon size={compact ? 20 : 26} />
        </RoundButton>
      </View>

      <View style={{ flex: 1, flexDirection: 'row', gap: compact ? 10 : 16 }}>
        {/* 왼쪽: 부모 아바타 */}
        <View style={{ flex: 32, backgroundColor: C.white, borderRadius: R.lg, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <NodBox nod={nod} reduceMotion={reduceMotion}>
            <Avatar config={profile.avatar} mouth={mouth} scale={scale} size={avatarSize} expression={expr ?? 'smile'} />
          </NodBox>
        </View>

        {/* 오른쪽: 놀이 무대 */}
        <View
          onLayout={(e) => setStage({ w: Math.round(e.nativeEvent.layout.width), h: Math.round(e.nativeEvent.layout.height) })}
          style={{ flex: 68, backgroundColor: C.greenSoft, borderRadius: R.lg, borderWidth: 2, borderColor: C.green, overflow: 'hidden' }}>
          {ready && stage.w > 0 && (
            <>
              {station === 0 && <RevealStation key="reveal" items={items} {...common} />}
              {station === 1 && <DrumStation key="drum" {...common} />}
              {station === 2 && <SortStation key="sort" items={items} {...common} />}
            </>
          )}
        </View>
      </View>
    </View>
  );
}
