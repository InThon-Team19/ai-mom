// 기획 2-4 카메라 인식 화면: 얼굴 틀·입 윤곽·체크 표시 + 상태 문구 (1-6 입모양 등록, 2-4 저녁 낭독) — 담당: 태희
// 표시는 전부 FaceTracker 실제 인식값(face·lips·box·dark)으로만 바뀜. 얼굴이 안 잡혔는데 연두색이 뜨면 안 됨.
//   찾는 중  : 노란 점선 틀   "얼굴을 틀 안에 맞춰주세요"
//   찾음     : 연두 실선, 살짝 커짐 "잘 보여요"
//   읽는 중  : 입 둘레 점·윤곽선이 입을 따라 움직임 "입모양을 배우고 있어요" (+ ReadingText 로 읽는 단어 강조)
//   한 문장 완료 : 체크 표시 "좋아요! 한 문장 더 배웠어요" (학습률 링은 화면의 RingGauge 가 서버값으로 차오름)
//   인식이 어려움 : 다시 노란색 + 이유 (어두움 / 녹화 중 얼굴 1.5초 넘게 사라짐 / 너무 멀리)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View, type LayoutChangeEvent, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { ZoomIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Polygon } from 'react-native-svg';

import { FaceTracker, type FaceFrame } from '@/components/FaceTracker';
import { C, R } from '@/theme';

export type GuideState = 'searching' | 'found' | 'reading' | 'done' | 'hard';
type Reason = 'dark' | 'lost' | 'far';

const LOST_MS = 1500; // 녹화 중 얼굴이 이만큼 안 보이면 "인식이 어려움"
const GRACE_MS = 400; // 한두 프레임 놓쳤을 때 깜빡이지 않게
const DONE_MS = 2500; // 한 문장 완료 표시 시간
const FAR_H = 0.25; // 얼굴 상자 높이가 미리보기의 25% 미만이면 너무 멂
const FILL = { flex: 1 }; // FaceTracker memo 유지용 고정 스타일

const MESSAGE: Record<Exclude<GuideState, 'hard'>, string> = {
  searching: '얼굴을 틀 안에 맞춰주세요',
  found: '잘 보여요',
  reading: '입모양을 배우고 있어요',
  done: '좋아요! 한 문장 더 배웠어요',
};
const REASON: Record<Reason, string> = {
  dark: '조금 더 밝은 곳에서 해볼까요?',
  lost: '얼굴을 틀 안에 맞춰주세요',
  far: '조금 더 가까이 와주세요',
};

/** 한 문장 완료 신호: 완료된 문장 수 (마지막 문장은 index 가 안 넘어가므로 allDone 으로 보탬) */
export function doneSignal(statuses: string[], allDone: boolean) {
  return statuses.filter((s) => s === 'done').length + (allDone ? 1 : 0);
}

export function FaceGuide({
  onFrame,
  onError,
  recording,
  doneCount,
  style,
  overlay,
  caption,
  captionAlign = 'center',
}: {
  onFrame: (f: FaceFrame) => void;
  onError?: (msg: string) => void;
  recording: boolean; // 낭독 녹음 중
  doneCount: number; // 늘어나면 "한 문장 완료" 표시 (doneSignal)
  style?: ViewStyle; // 카메라 상자 크기·모양
  overlay?: boolean; // 디자인 AvatarLearn·Mouth·Plan: 상태 알약을 카메라 왼쪽 위에 겹쳐 표시
  caption?: string; // 카메라 아래쪽에 겹치는 작은 안내 (overlay 일 때)
  captionAlign?: 'center' | 'right';
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [live, setLive] = useState<{ state: Exclude<GuideState, 'done'>; reason?: Reason }>({ state: 'searching' });
  const [lips, setLips] = useState<[number, number][] | null>(null);

  // 한 문장 완료: doneCount 가 늘면 DONE_MS 동안 체크 표시
  const [seenDone, setSeenDone] = useState(doneCount);
  const [celebrate, setCelebrate] = useState(0); // 늘 때마다 1씩 (0 = 표시 안 함)
  if (doneCount !== seenDone) {
    setSeenDone(doneCount);
    setCelebrate(doneCount > seenDone ? celebrate + 1 : 0);
  }
  useEffect(() => {
    if (!celebrate) return;
    const id = setTimeout(() => setCelebrate(0), DONE_MS);
    return () => clearTimeout(id);
  }, [celebrate]);

  // 프레임마다 상태 판정 (이벤트 처리 안이라 시간·ref 사용 가능)
  const t = useRef({ lastFace: 0, recStart: 0, wasRec: false, recording, onFrame });
  useEffect(() => {
    t.current.recording = recording;
    t.current.onFrame = onFrame;
  }, [recording, onFrame]);

  const handle = useCallback((f: FaceFrame) => {
    const r = t.current;
    r.onFrame(f);
    const now = Date.now();
    if (r.recording && !r.wasRec) r.recStart = now;
    r.wasRec = r.recording;
    if (f.face) r.lastFace = now;
    const lostFor = now - Math.max(r.lastFace, r.recording ? r.recStart : 0);

    let next: { state: Exclude<GuideState, 'done'>; reason?: Reason };
    if (f.dark) next = { state: 'hard', reason: 'dark' };
    else if (!f.face) {
      if (r.recording) next = lostFor > LOST_MS ? { state: 'hard', reason: 'lost' } : { state: 'reading' };
      else next = lostFor > GRACE_MS ? { state: 'searching' } : { state: 'found' };
    } else if (f.box && f.box.h < FAR_H) next = { state: 'hard', reason: 'far' };
    else next = { state: r.recording ? 'reading' : 'found' };

    // 이전과 같으면 그대로 (불필요한 다시 그리기 줄임)
    setLive((p) => (p.state === next.state && p.reason === next.reason ? p : next));
    if (f.face && f.lips) setLips(f.lips);
    else if (!f.face && lostFor > GRACE_MS) setLips(null);
  }, []);

  const state: GuideState = celebrate ? 'done' : live.state;
  const message = state === 'hard' ? REASON[live.reason ?? 'lost'] : MESSAGE[state];
  const good = state === 'found' || state === 'reading' || state === 'done';

  // 찾음 이후 틀이 살짝 커짐
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withTiming(good ? 1.06 : 1, { duration: 250 });
  }, [good, scale]);
  const ovalStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }));
  };

  const { w, h } = size;
  const ry = h * 0.42;
  const rx = Math.min(ry * 0.74, w * 0.42);
  const lipPts = useMemo(
    () => (state === 'reading' && lips ? lips.map(([x, y]) => [x * w, y * h] as const) : null),
    [state, lips, w, h],
  );

  const pill = (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        maxWidth: overlay ? '64%' : '100%', // 오른쪽 위 '인식 카메라' 표시와 겹치지 않게
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: R.pill,
        backgroundColor: good ? C.greenSoft : C.primarySoft,
      }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: good ? C.ok : C.primaryStrong }} />
      <Text style={{ flexShrink: 1, fontSize: overlay ? 12 : 14, fontWeight: '700', color: good ? C.ok : C.onPrimary }}>{message}</Text>
    </View>
  );

  return (
    <View style={{ gap: 8 }}>
      <View style={[{ overflow: 'hidden', backgroundColor: '#000' }, style]} onLayout={onLayout}>
        <FaceTracker onFrame={handle} onError={onError} style={FILL} />
        {w > 0 && (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
            <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h }, ovalStyle]}>
              <Svg width={w} height={h}>
                <Ellipse
                  cx={w / 2}
                  cy={h / 2}
                  rx={rx}
                  ry={ry}
                  fill="none"
                  stroke={good ? C.green : C.primaryStrong}
                  strokeWidth={good ? 3.5 : 3}
                  strokeDasharray={good ? undefined : '9 7'}
                />
              </Svg>
            </Animated.View>
            {lipPts && (
              <Svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
                <Polygon
                  points={lipPts.map((p) => `${p[0]},${p[1]}`).join(' ')}
                  fill="rgba(181,217,107,0.18)"
                  stroke={C.green}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                {lipPts.map((p, i) => (
                  <Circle key={i} cx={p[0]} cy={p[1]} r={2.6} fill={C.white} stroke={C.green} strokeWidth={1.2} />
                ))}
              </Svg>
            )}
            {state === 'done' && (
              <Animated.View
                key={celebrate}
                entering={ZoomIn.duration(250)}
                style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={56} height={56} viewBox="0 0 56 56">
                  <Circle cx={28} cy={28} r={26} fill={C.green} stroke={C.white} strokeWidth={2} />
                  <Path d="M16 29 L24.5 37 L40 20" fill="none" stroke={C.onPrimary} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </Animated.View>
            )}
          </View>
        )}
        {overlay && (
          <View pointerEvents="none" style={{ position: 'absolute', top: 12, left: 12, right: 12 }}>
            {pill}
          </View>
        )}
        {overlay && !!caption && (
          <Text
            pointerEvents="none"
            style={{ position: 'absolute', bottom: 10, left: 12, right: 12, textAlign: captionAlign, fontSize: 12, color: C.border, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 }}>
            {caption}
          </Text>
        )}
      </View>

      {!overlay && pill}
    </View>
  );
}

// ---------- 읽는 단어 강조 ----------
// 실시간 글자 인식은 없으므로, 녹음 중 "입이 움직인 시간"을 실제 입모양 수치(open)로 재서
// 한국어 낭독 속도(초당 약 3.5음절)로 지금 읽는 단어를 추정. 입을 멈추면 강조도 멈춤.
const SYL_PER_SEC = 3.5;
const sylCount = (word: string) => {
  const hangul = (word.match(/[가-힣]/g) ?? []).length;
  const other = word.replace(/[가-힣\s.,!?~·'"]/g, '').length;
  return Math.max(1, hangul + Math.ceil(other / 2));
};

/** 읽는 단어 추정. feed 를 FaceTracker onFrame 에 같이 연결. 녹음 중이 아니면 word = -1 */
export function useReadingWord(text: string, recording: boolean) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const ends = useMemo(() => {
    const out: number[] = [];
    for (const wd of words) out.push((out[out.length - 1] ?? 0) + sylCount(wd));
    return out;
  }, [words]);
  const key = `${text}|${recording}`;
  const [st, setSt] = useState({ key: '', word: 0 });
  const acc = useRef({ key: '', spoken: 0, lastT: 0, lastOpen: 0 });

  const feed = useCallback(
    (f: FaceFrame) => {
      if (!recording) return;
      const a = acc.current;
      const now = Date.now();
      if (a.key !== key) {
        a.key = key;
        a.spoken = 0;
        a.lastT = now;
        a.lastOpen = f.open;
      }
      const dt = Math.min(0.15, (now - a.lastT) / 1000);
      const moving = f.face && (f.open > 0.04 || Math.abs(f.open - a.lastOpen) > 0.012);
      a.lastT = now;
      a.lastOpen = f.open;
      if (moving) a.spoken += dt;
      const syl = a.spoken * SYL_PER_SEC;
      let i = ends.findIndex((e) => syl < e);
      if (i < 0) i = ends.length - 1;
      setSt((p) => (p.key === key && p.word === i ? p : { key, word: i }));
    },
    [recording, key, ends],
  );

  const word = !recording ? -1 : st.key === key ? st.word : 0;
  return { feed, word };
}

/** 문장을 단어 단위로 보여주고 지금 읽는 단어를 노란 바탕으로 강조 */
export function ReadingText({ text, word, style }: { text: string; word: number; style?: TextStyle }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <Text style={style}>
      {words.map((wd, i) => (
        <Text
          key={i}
          style={
            i === word
              ? { backgroundColor: C.primary, color: C.onPrimary, fontWeight: '800' }
              : word >= 0 && i < word
                ? { color: C.sub }
                : undefined
          }>
          {wd}
          {i < words.length - 1 ? ' ' : ''}
        </Text>
      ))}
    </Text>
  );
}
