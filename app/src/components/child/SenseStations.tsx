// 아이 태블릿 감각 놀이 세 판 (쓸어내기 · 두드리기 · 끌어서 옮기기) — 담당: 태희 (기획 3 "세 감각을 한 동작에 묶기")
// 아이의 한 동작마다 촉각(짧은 진동) + 청각(효과음·엄마 목소리) + 시각(화면 변화)을 함께 돌려줌
//   - 쓸어내기: 손가락을 따라 가림막이 지워짐 · 손가락을 따라오는 가벼운 톡 · 쓱 쓸리는 소리 → 70% 드러나면 그림이 톡 튀며 이름
//   - 두드리기: 빠르게 칠수록 세게 → 파동이 더 크게 퍼짐 · 더 큰 북소리 · 조금 더 센(그래도 짧은) 진동
//   - 끌어서 옮기기: 바구니 제자리에 놓으면 착 맞춰짐 · 짧은 진동 · 엄마 목소리 "잘했어!" / 밖에 놓으면 살며시 제자리로 (실패음·틀림 표시 없음)
// 감각 자극 제한: 깜빡임 없음, 움직임 한 번은 1초 안, 움직임 줄이기면 튐·퍼짐을 작게, 진동은 lib/sense haptic() 으로만
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';

import type { AvatarExpression } from '@/components/Avatar';
import { BasketIcon, StarBurst } from '@/components/child/stage';
import { ITEMS, type ItemId } from '@/content/curriculum';
import { haptic, logEvent, playSfx } from '@/lib/sense';
import { C, R } from '@/theme';

const out = Easing.out(Easing.quad);
const SNAP = { damping: 13, stiffness: 220 };

export type StationProps = {
  w: number; // 무대 크기
  h: number;
  reduceMotion: boolean;
  wiggle: number; // 바뀔 때마다 놀잇감이 살짝 흔들림 (아이가 가만히 있을 때 다시 권하기)
  english: boolean;
  onActivity: () => void; // 아이가 무언가 함 → 가만히 있는 시간 초기화
  say: (text: string, force?: boolean) => Promise<void>; // 아바타(엄마 목소리)가 말함. force 가 아니면 말하는 중엔 건너뜀
  feel: (e: AvatarExpression, ms?: number) => void; // 아바타 표정 잠깐 바꾸기
  onDone: () => void; // 이 판이 끝남
};

function Glyph({ emoji, size }: { emoji: string; size: number }) {
  return (
    <Text
      allowFontScaling={false}
      style={{ width: size, height: size, fontSize: size * 0.78, lineHeight: size, textAlign: 'center', includeFontPadding: false }}>
      {emoji}
    </Text>
  );
}

/** 놀잇감 살짝 흔들기 (0.5초) */
function useWiggle(wiggle: number, reduceMotion: boolean) {
  const rot = useSharedValue(0);
  useEffect(() => {
    if (!wiggle) return;
    const a = reduceMotion ? 4 : 8;
    rot.set(withSequence(
      withTiming(-a, { duration: 90 }),
      withTiming(a, { duration: 140 }),
      withTiming(-a * 0.6, { duration: 120 }),
      withTiming(a * 0.4, { duration: 100 }),
      withTiming(0, { duration: 90 }),
    ));
  }, [wiggle, reduceMotion, rot]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
}

/** 화면을 떠난 뒤엔 타이머·말 흐름을 이어가지 않게 */
function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return alive;
}

// =====================================================================
// 1) 쓸어내기 — 그림 드러내기
// =====================================================================
const COLS = 8;
const ROWS = 8;
const TOTAL = COLS * ROWS;
const REVEAL_AT = 0.7; // 이만큼 지우면 그림이 드러남
const SWISH_GAP_MS = 240; // 쓸리는 소리 간격

/** 가림막 한 칸: 지워지면 0.22초 동안 작아지며 사라짐 (깜빡임 없음) */
const Tile = memo(function Tile({ x, y, size, cleared, light, reduceMotion }: { x: number; y: number; size: number; cleared: boolean; light: boolean; reduceMotion: boolean }) {
  const op = useSharedValue(1);
  const sc = useSharedValue(1);
  useEffect(() => {
    if (cleared) {
      op.set(withTiming(0, { duration: 220 }));
      sc.set(withTiming(reduceMotion ? 0.9 : 0.55, { duration: 220, easing: out }));
    } else {
      op.set(1);
      sc.set(1);
    }
  }, [cleared, reduceMotion, op, sc]);
  const st = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ scale: sc.value }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x, top: y, width: size + 0.5, height: size + 0.5, backgroundColor: light ? '#FFE48A' : C.primary }, st]}
    />
  );
});

export function RevealStation({ items, w, h, reduceMotion, wiggle, english, onActivity, say, feel, onDone }: StationProps & { items: ItemId[] }) {
  const alive = useAlive();
  const [idx, setIdx] = useState(0);
  const [cleared, setCleared] = useState<boolean[]>(() => Array(TOTAL).fill(false));
  const [revealed, setRevealed] = useState(false);
  const [pop, setPop] = useState(0);
  const item = ITEMS[items[idx] ?? items[0]];
  const box = Math.round(Math.max(120, Math.min(w * 0.72, h * 0.8, 440)));
  const cell = box / COLS;
  // 손가락 처리용 최신 값 (빠르게 들어오므로 ref)
  const st = useRef({ cleared: Array<boolean>(TOTAL).fill(false), count: 0, last: null as { x: number; y: number } | null, tickAt: null as { x: number; y: number } | null, revealed: false, lastSwish: 0, stroke: 0 });

  const picScale = useSharedValue(1);
  useEffect(() => {
    if (!pop) return;
    picScale.set(withSequence(withTiming(reduceMotion ? 1.06 : 1.18, { duration: 220, easing: out }), withSpring(1, { damping: 12, stiffness: 140 })));
  }, [pop, reduceMotion, picScale]);
  const picStyle = useAnimatedStyle(() => ({ transform: [{ scale: picScale.value }] }));
  const wiggleStyle = useWiggle(wiggle, reduceMotion);

  const reveal = () => {
    const s = st.current;
    s.revealed = true;
    s.cleared.fill(true);
    s.count = TOTAL;
    setCleared(s.cleared.slice());
    setRevealed(true);
    setPop((p) => p + 1);
    playSfx('pop');
    haptic('praise');
    feel('praise', 1800);
    logEvent('touch', { action: 'swipe', item: item.ko, revealed: true });
    (async () => {
      await say(english ? `${item.ko}! ${item.en}!` : `${item.ko}!`, true);
      await new Promise((r) => setTimeout(r, 700));
      if (!alive.current) return;
      if (idx + 1 < items.length) {
        // 다음 그림: 가림막을 다시 덮고 새 그림
        st.current = { cleared: Array<boolean>(TOTAL).fill(false), count: 0, last: null, tickAt: null, revealed: false, lastSwish: 0, stroke: 0 };
        setCleared(Array(TOTAL).fill(false));
        setRevealed(false);
        setIdx(idx + 1);
      } else onDone();
    })();
  };

  /** 손가락이 지나간 자리의 가림막 칸을 지움 (빠르게 쓸어도 빈틈 없게 앞 점과 사이를 이어서) */
  const brush = (x: number, y: number) => {
    const s = st.current;
    if (s.revealed) return;
    onActivity();
    const pts: { x: number; y: number }[] = [];
    if (s.last) {
      const dx = x - s.last.x;
      const dy = y - s.last.y;
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cell * 0.4)));
      for (let i = 1; i <= steps; i++) pts.push({ x: s.last.x + (dx * i) / steps, y: s.last.y + (dy * i) / steps });
    } else pts.push({ x, y });
    s.last = { x, y };
    // 손가락을 따라오는 가벼운 톡 (움직였을 때만, sense 가 0.12초 간격으로 제한)
    if (!s.tickAt || Math.hypot(x - s.tickAt.x, y - s.tickAt.y) > cell * 0.5) {
      s.tickAt = { x, y };
      haptic('tick');
    }
    const r = cell * 1.05;
    let added = 0;
    for (const p of pts) {
      const c0 = Math.max(0, Math.floor((p.x - r) / cell));
      const c1 = Math.min(COLS - 1, Math.floor((p.x + r) / cell));
      const r0 = Math.max(0, Math.floor((p.y - r) / cell));
      const r1 = Math.min(ROWS - 1, Math.floor((p.y + r) / cell));
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const i = row * COLS + col;
          if (s.cleared[i]) continue;
          if (Math.hypot((col + 0.5) * cell - p.x, (row + 0.5) * cell - p.y) <= r) {
            s.cleared[i] = true;
            added += 1;
          }
        }
      }
    }
    if (!added) return;
    s.count += added;
    s.stroke += added;
    setCleared(s.cleared.slice());
    const now = Date.now();
    if (now - s.lastSwish > SWISH_GAP_MS) {
      s.lastSwish = now;
      playSfx('swish', 0.4);
    }
    if (s.count / TOTAL >= REVEAL_AT) reveal();
  };

  /** 한 번 쓸고 손을 뗌 → 한 동작으로 기록 (촉각) */
  const endStroke = () => {
    const s = st.current;
    s.last = null;
    s.tickAt = null;
    if (s.revealed) return;
    logEvent('touch', { action: 'swipe', item: item.ko, cleared: Math.round((s.count / TOTAL) * 100) / 100 });
    s.stroke = 0;
  };

  const handlers = useRef({ brush, endStroke });
  useEffect(() => {
    handlers.current = { brush, endStroke };
  });
  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: (e) => {
      handlers.current.brush(e.x, e.y);
    },
    onUpdate: (e) => {
      handlers.current.brush(e.x, e.y);
    },
    onFinalize: () => {
      handlers.current.endStroke();
    },
  });

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <Animated.View style={wiggleStyle}>
        <GestureDetector gesture={pan}>
          <View
            accessibilityLabel="손으로 쓱쓱 문질러 봐"
            style={{ width: box, height: box, borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.white, borderWidth: 3, borderColor: C.primaryStrong }}>
            {/* 가림막 아래 숨은 그림 */}
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
              <StarBurst trigger={pop} radius={box * 0.42} />
              <Animated.View style={picStyle}>
                <Glyph emoji={item.emoji} size={box * 0.66} />
              </Animated.View>
            </View>
            {/* 가림막: 손가락이 지나간 칸만 사라짐 */}
            {cleared.map((c, i) => (
              <Tile
                key={i}
                x={(i % COLS) * cell}
                y={Math.floor(i / COLS) * cell}
                size={cell}
                cleared={c}
                light={(Math.floor(i / COLS) + (i % COLS)) % 2 === 0}
                reduceMotion={reduceMotion}
              />
            ))}
          </View>
        </GestureDetector>
      </Animated.View>
      <View style={{ height: 40, justifyContent: 'center' }}>
        {revealed && (
          <Animated.Text key={idx} entering={ZoomIn.duration(220)} style={{ fontSize: 28, fontWeight: '900', color: C.text }}>
            {item.ko}!
          </Animated.Text>
        )}
      </View>
    </View>
  );
}

// =====================================================================
// 2) 두드리기 — 북
// =====================================================================
const RATE_WINDOW_MS = 600; // 이 시간 안에 친 횟수로 세기를 정함
const LEVEL_NAME = ['soft', 'medium', 'strong'] as const;
const DRUM_HITS_DONE = 20; // 이만큼 치거나
const DRUM_TIME_DONE_MS = 28000; // 처음 친 뒤 이만큼 지나면 이 판 끝

/** 파동: 북을 칠 때마다 테두리 원이 퍼지며 사라짐. 셀수록 더 크게·더 굵게 (0.7초 한 번) */
function Ring({ level, size, reduceMotion }: { level: number; size: number; reduceMotion: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [p]);
  const spread = (0.3 + level * 0.25) * (reduceMotion ? 0.6 : 1);
  const st = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - p.value), transform: [{ scale: 1 + p.value * spread }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: size / 2, borderWidth: 4 + level * 3, borderColor: level === 2 ? C.accent : C.primaryStrong },
        st,
      ]}
    />
  );
}

export function DrumStation({ w, h, reduceMotion, wiggle, onActivity, say, feel, onDone }: StationProps) {
  const alive = useAlive();
  const size = Math.round(Math.max(120, Math.min(h * 0.6, w * 0.45, 300)));
  const [rings, setRings] = useState<{ id: number; level: number }[]>([]);
  const [word, setWord] = useState<{ id: number; level: number } | null>(null);
  const st = useRef({ times: [] as number[], hits: 0, firstAt: 0, lastLine: 0, softStreak: 0, strongStreak: 0, done: false, id: 0 });
  const head = useSharedValue(1);
  const headStyle = useAnimatedStyle(() => ({ transform: [{ scale: head.value }] }));
  const wiggleStyle = useWiggle(wiggle, reduceMotion);

  const hit = () => {
    const s = st.current;
    if (s.done) return;
    const now = Date.now();
    s.times = [...s.times.filter((t) => now - t < RATE_WINDOW_MS), now];
    const level = s.times.length >= 4 ? 2 : s.times.length >= 2 ? 1 : 0; // 빠르게 칠수록 셈
    s.hits += 1;
    if (!s.firstAt) s.firstAt = now;
    onActivity();
    // 청각: 셀수록 큰 북소리 (그래도 작은 음량)
    if (level === 2) playSfx('drum_big', 0.6);
    else playSfx('drum', level === 1 ? 0.5 : 0.32);
    // 촉각: 살살 = 아주 가볍게, 보통 = 짧게, 세게 = 조금 더 (모두 짧게)
    haptic(level === 2 ? 'strong' : level === 1 ? 'tap' : 'tick');
    // 시각: 가운데가 움푹 들어갔다 돌아옴 + 파동
    head.set(withSequence(withTiming(0.88 - level * 0.03, { duration: 60 }), withSpring(1, { damping: 7, stiffness: 260, mass: 0.6 })));
    const id = ++s.id;
    setRings((r) => [...r.slice(-4), { id, level }]);
    setTimeout(() => {
      if (alive.current) setRings((r) => r.filter((x) => x.id !== id));
    }, 850);
    setWord({ id, level });
    feel(level === 2 ? 'surprise' : 'smile', 700);
    logEvent('touch', { action: 'tap', strength: LEVEL_NAME[level], target: '북' });

    // 아바타는 가끔만 (매번 말하지 않음)
    if (level === 0) {
      s.softStreak += 1;
      s.strongStreak = 0;
    } else if (level === 2) {
      s.strongStreak += 1;
      s.softStreak = 0;
    }
    if (s.hits >= 2 && now - s.lastLine > 4500) {
      s.lastLine = now;
      const line =
        s.softStreak >= 5 ? '이번엔 세게 쳐 볼까?' : s.strongStreak >= 3 ? '이번엔 살살 쳐 볼까?' : level === 2 ? '우와, 세게! 둥!' : level === 0 ? '살살, 둥.' : '둥둥!';
      if (s.softStreak >= 5) s.softStreak = 0;
      if (s.strongStreak >= 3) s.strongStreak = 0;
      void say(line);
    }
    if (s.hits >= DRUM_HITS_DONE || now - s.firstAt > DRUM_TIME_DONE_MS) {
      s.done = true;
      setTimeout(() => {
        if (alive.current) onDone();
      }, 700);
    }
  };

  const wordSize = 30;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <View style={{ height: wordSize * 1.8, justifyContent: 'flex-end' }}>
        {word && (
          <Animated.Text key={word.id} entering={ZoomIn.duration(180)} style={{ fontSize: wordSize * (1 + word.level * 0.25), fontWeight: '900', color: C.text }}>
            둥!
          </Animated.Text>
        )}
      </View>
      <Animated.View style={[{ width: size, height: size }, wiggleStyle]}>
        {rings.map((r) => (
          <Ring key={r.id} level={r.level} size={size} reduceMotion={reduceMotion} />
        ))}
        <Pressable accessibilityRole="button" accessibilityLabel="북 두드리기" onPressIn={hit} hitSlop={20} style={{ width: size, height: size }}>
          {/* 북 몸통 */}
          <View
            style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#E8775A', borderWidth: 6, borderColor: '#B9513A', alignItems: 'center', justifyContent: 'center' }}>
            {/* 북 가죽: 칠 때 움푹 */}
            <Animated.View
              style={[
                { width: size * 0.78, height: size * 0.78, borderRadius: size, backgroundColor: '#FFF3D6', borderWidth: 3, borderColor: '#E3C79A', alignItems: 'center', justifyContent: 'center' },
                headStyle,
              ]}>
              <View style={{ width: size * 0.22, height: size * 0.22, borderRadius: size, backgroundColor: '#F4E2BC' }} />
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// =====================================================================
// 3) 끌어서 옮기기 — 정리 놀이
// =====================================================================
type Pt = { x: number; y: number };

/** 끌 수 있는 사물 하나. 놓으면 onDrop 이 바구니 자리(가운데 좌표)를 주면 착 맞춰지고, 없으면 살며시 제자리로 */
function Piece({
  emoji,
  size,
  home,
  placed,
  front,
  reduceMotion,
  wiggle,
  onPick,
  onDrop,
}: {
  emoji: string;
  size: number;
  home: Pt; // 처음 자리 (가운데 좌표)
  placed: boolean;
  front: boolean;
  reduceMotion: boolean;
  wiggle: number;
  onPick: () => void;
  onDrop: (center: Pt, moved: number) => Pt | null;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const lift = useSharedValue(1);
  const rot = useSharedValue(0);
  const last = useRef({ dx: 0, dy: 0 });

  useEffect(() => {
    if (!wiggle || placed) return;
    const a = reduceMotion ? 5 : 10;
    rot.set(withSequence(withTiming(-a, { duration: 90 }), withTiming(a, { duration: 140 }), withTiming(-a * 0.5, { duration: 120 }), withTiming(0, { duration: 100 })));
  }, [wiggle, placed, reduceMotion, rot]);

  const begin = () => {
    last.current = { dx: 0, dy: 0 };
    lift.set(withTiming(1.12, { duration: 120 }));
    onPick();
  };
  const move = (dx: number, dy: number) => {
    last.current = { dx, dy };
    tx.set(dx);
    ty.set(dy);
  };
  const end = () => {
    const { dx, dy } = last.current;
    const target = onDrop({ x: home.x + dx, y: home.y + dy }, Math.hypot(dx, dy));
    lift.set(withTiming(1, { duration: 160 }));
    if (target) {
      // 제자리에 착 맞춰짐 (움직임 줄이기면 튀지 않고 바로)
      const gx = target.x - home.x;
      const gy = target.y - home.y;
      tx.set(reduceMotion ? withTiming(gx, { duration: 180 }) : withSpring(gx, SNAP));
      ty.set(reduceMotion ? withTiming(gy, { duration: 180 }) : withSpring(gy, SNAP));
    } else {
      // 제자리로 살며시 (실패 표시 없음)
      tx.set(withTiming(0, { duration: 450, easing: out }));
      ty.set(withTiming(0, { duration: 450, easing: out }));
    }
  };
  const handlers = useRef({ begin, move, end });
  useEffect(() => {
    handlers.current = { begin, move, end };
  });
  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    enabled: !placed,
    onBegin: () => {
      handlers.current.begin();
    },
    onUpdate: (e) => {
      handlers.current.move(e.translationX, e.translationY);
    },
    onFinalize: () => {
      handlers.current.end();
    },
  });

  const st = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: lift.value }, { rotate: `${rot.value}deg` }] }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessibilityLabel="바구니로 옮겨 봐"
        style={[{ position: 'absolute', left: home.x - size / 2, top: home.y - size / 2, width: size, height: size, zIndex: front ? 20 : placed ? 1 : 10 }, st]}>
        <Glyph emoji={emoji} size={size} />
      </Animated.View>
    </GestureDetector>
  );
}

export function SortStation({ items, w, h, reduceMotion, wiggle, onActivity, say, feel, onDone }: StationProps & { items: ItemId[] }) {
  const alive = useAlive();
  // 사물이 하나뿐인 날(2일차 과자)은 두 개를 정리
  const pieces = useMemo<ItemId[]>(() => (items.length >= 2 ? items.slice(0, 4) : [items[0], items[0]]), [items]);
  const n = pieces.length;
  const basketH = Math.max(70, h * 0.36);
  const iconW = basketH * 0.6;
  const slot = Math.round(Math.max(52, Math.min(basketH * 0.78, ((w - iconW - 48) / n) * 0.8, 130)));
  const piece = Math.round(slot * 0.86);
  // 바구니 자리: 사물 순서를 뒤집어서 바로 아래가 아니게
  const slotItems = useMemo(() => [...pieces].reverse(), [pieces]);
  const slots = useMemo<Pt[]>(() => {
    const startX = 8 + 16 + iconW + 10;
    const avail = w - startX - 24;
    return slotItems.map((_, i) => ({ x: startX + (avail / n) * (i + 0.5), y: h - basketH / 2 - 6 }));
  }, [slotItems, w, h, n, iconW, basketH]);
  // 처음 자리: 위쪽에 흩어 놓음
  const homes = useMemo<Pt[]>(() => {
    const topH = h - basketH - 12;
    return pieces.map((_, i) => {
      const x = (w / n) * (i + 0.5) + (i % 2 ? 1 : -1) * w * 0.04;
      const y = topH * (i % 2 ? 0.62 : 0.4);
      return { x: Math.max(piece / 2 + 6, Math.min(w - piece / 2 - 6, x)), y: Math.max(piece / 2 + 4, Math.min(topH - piece / 2, y)) };
    });
  }, [pieces, w, h, n, basketH, piece]);

  const [filled, setFilled] = useState<boolean[]>(() => Array(n).fill(false));
  const [placed, setPlaced] = useState<boolean[]>(() => Array(n).fill(false));
  const [front, setFront] = useState(-1);
  const [star, setStar] = useState<{ slot: number; n: number }>({ slot: -1, n: 0 });
  const st = useRef({ filled: Array<boolean>(n).fill(false), count: 0 });

  const drop = useCallback(
    (pi: number, c: Pt, moved: number): Pt | null => {
      const s = st.current;
      const it = ITEMS[pieces[pi]];
      onActivity();
      // 같은 사물의 빈자리 중 가장 가까운 곳. 바구니 안에만 들어와도 받아 줌 (어린아이 손이라 넉넉하게)
      let best = -1;
      let bestD = Infinity;
      slots.forEach((p, j) => {
        if (s.filled[j] || slotItems[j] !== pieces[pi]) return;
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      });
      const inBasket = c.y > h - basketH - piece * 0.3;
      if (best < 0 || (bestD > slot * 1.1 && !inBasket)) {
        if (moved > 10) {
          // 바구니 밖: 실패음 없이 살며시 제자리로 + 아주 가벼운 톡
          playSfx('tong', 0.3);
          haptic('tick');
          logEvent('touch', { action: 'drag', item: it.ko, placed: false });
        } else logEvent('touch', { action: 'tap', item: it.ko });
        return null;
      }
      s.filled[best] = true;
      s.count += 1;
      setFilled(s.filled.slice());
      setPlaced((p) => p.map((v, k) => (k === pi ? true : v)));
      setStar((x) => ({ slot: best, n: x.n + 1 }));
      haptic('tap');
      playSfx('ssok');
      feel('praise', 1500);
      logEvent('touch', { action: 'drag', item: it.ko, placed: true });
      const all = s.count >= n;
      (async () => {
        await say('잘했어!', true);
        if (all && alive.current) onDone();
      })();
      return slots[best];
    },
    [pieces, slots, slotItems, h, basketH, piece, slot, n, onActivity, feel, say, onDone, alive],
  );

  return (
    <View style={{ width: w, height: h }}>
      {/* 아래: 바구니와 사물 모양 자리 (점선) */}
      <View
        accessibilityLabel="바구니"
        style={{ position: 'absolute', left: 8, right: 8, bottom: 6, height: basketH, borderRadius: R.lg, backgroundColor: C.card, borderWidth: 2, borderColor: C.border, paddingLeft: 16, justifyContent: 'center' }}>
        <BasketIcon size={iconW} />
      </View>
      {slots.map((p, j) => (
        <View
          key={j}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: p.x - slot / 2,
            top: p.y - slot / 2,
            width: slot,
            height: slot,
            borderRadius: slot / 2,
            borderWidth: 3,
            borderStyle: 'dashed',
            borderColor: filled[j] ? C.green : C.primaryStrong,
            backgroundColor: filled[j] ? C.greenSoft : C.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {/* 어떤 사물이 들어갈 자리인지 흐린 그림으로 */}
          <View style={{ opacity: filled[j] ? 0 : 0.22 }}>
            <Glyph emoji={ITEMS[slotItems[j]].emoji} size={slot * 0.7} />
          </View>
          {star.slot === j && <StarBurst key={star.n} trigger={star.n} radius={slot * 0.8} />}
        </View>
      ))}
      {pieces.map((id, i) => (
        <Piece
          key={i}
          emoji={ITEMS[id].emoji}
          size={piece}
          home={homes[i]}
          placed={placed[i]}
          front={front === i}
          reduceMotion={reduceMotion}
          wiggle={wiggle}
          onPick={() => {
            setFront(i);
            haptic('tick');
            onActivity();
          }}
          onDrop={(c, moved) => drop(i, c, moved)}
        />
      ))}
    </View>
  );
}
