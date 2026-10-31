import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { PanGestureHandler, State, TapGestureHandler, type PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import { frames, type WordId } from '@/content/sensory/assets';
import { hapticConfig, playSound, pulse, stopSound } from '@/content/sensory/feedback';
import { initial, transition, type Input } from '@/content/sensory/machine';
import { K, SOFT2, useKid } from '@/components/child/design';
import { logEvent } from '@/lib/sense';
import { useProfile } from '@/lib/store';
import { Text } from '@/components/AppText';

const AnimatedImage = Animated.createAnimatedComponent(Image);
function Frame({ source, visible, duration }: { source: number; visible: boolean; duration: number }) {
  const [opacity] = useState(() => new Animated.Value(visible ? 1 : 0));
  useEffect(() => {
    const fade = Animated.timing(opacity, { toValue: visible ? 1 : 0, duration, useNativeDriver: true });
    fade.start(); return () => fade.stop();
  }, [visible, duration, opacity]);
  return <AnimatedImage source={source} contentFit="contain" style={[StyleSheet.absoluteFill, { opacity }]} />;
}

export function SensoryToy({ id, label }: { id: WordId; label: string }) {
  const profile = useProfile();
  const { u, f } = useKid(); // 큰 태블릿에서 글자·여백도 보드 비율로 (폰 가로는 예전 크기가 최소)
  const feedback = (kind: Parameters<typeof pulse>[0]) => { if (profile?.settings.vibration !== false) pulse(kind); };
  const state = useRef(initial());
  const [step, setStep] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [motion] = useState(() => new Animated.ValueXY());
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const lastRub = useRef({ x: 0, y: 0, time: 0, pulse: 0 });
  const rubStarted = useRef(false);
  const touchSize = useRef({ width: 0, height: 0 });
  const swipe = ['hat', 'pouch', 'pitcher'].includes(id);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    if (repeat.current) clearInterval(repeat.current);
    if (idle.current) clearTimeout(idle.current);
    timer.current = null; repeat.current = null; idle.current = null;
    animation.current?.stop(); motion.setValue({ x: 0, y: 0 }); stopSound(id);
  };
  const reset = () => { clear(); state.current = initial(); setStep(0); };
  // Parent unmounts on blur/background, so no timer, movement or sound survives.
  useEffect(() => () => { clear(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (x: number, y: number, loop = false) => {
    if (profile?.settings.reduceMotion) return;
    animation.current?.stop();
    motion.setValue({ x: 0, y: 0 });
    const sequence = Animated.sequence([
      Animated.timing(motion, { toValue: { x, y }, duration: 180, useNativeDriver: true }),
      Animated.timing(motion, { toValue: { x: 0, y: 0 }, duration: 220, useNativeDriver: true }),
    ]);
    animation.current = loop ? Animated.loop(sequence) : sequence;
    animation.current.start();
  };
  const input = (kind: Input, dx = 0, dy = 0) => {
    const next = transition(id, state.current, kind, Date.now());
    if (!next) return;
    state.current = next.state; setStep(next.state.step);
    logEvent('touch', { action: kind, target: label, story: true }); // 부모 리포트 촉각에 동화 놀이도 남김
    if (timer.current) clearTimeout(timer.current);
    if (next.reset) timer.current = setTimeout(reset, next.reset);
    if (next.haptic) feedback(next.haptic);
    if (next.sound) playSound(id, next.sound, id === 'sun');
    if (id === 'sun' && !repeat.current) {
      repeat.current = setInterval(() => {
        if (Date.now() - state.current.activeSince >= hapticConfig.sunMaxDuration) {
          if (repeat.current) clearInterval(repeat.current);
          repeat.current = null;
        } else feedback('strong');
      }, hapticConfig.sunInterval);
    }
    if (id === 'hat') move(Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) * 12 : 0, dy < 0 ? -10 : 0);
    if (id === 'stick' && next.state.step === 2) move(4, 0);
    if ((id === 'crow' && next.state.step === 1) || (id === 'pouch' && next.state.step === 3) || (id === 'pitcher' && next.state.step === 2)) move(0, -3, true);
    else if (id === 'pitcher') { animation.current?.stop(); motion.setValue({ x: 0, y: 0 }); }
  };
  const endRub = () => {
    stopSound(id); rubStarted.current = false;
    if (idle.current) clearTimeout(idle.current);
  };
  const rub = (e: PanGestureHandlerEventPayload) => {
    if (e.x < 0 || e.y < 0 || e.x > touchSize.current.width || e.y > touchSize.current.height) { endRub(); return; }
    const now = Date.now();
    const last = lastRub.current;
    const distance = Math.hypot(e.translationX - last.x, e.translationY - last.y);
    if (distance < hapticConfig.rubDistance) return;
    const speed = distance / Math.max(1, now - last.time);
    const interval = Math.max(hapticConfig.rubMinInterval, hapticConfig.rubMaxInterval - speed * 100);
    if (now - last.pulse >= interval) { feedback('rough'); last.pulse = now; }
    last.x = e.translationX; last.y = e.translationY; last.time = now;
    if (!rubStarted.current) { playSound(id, 'rub', true); rubStarted.current = true; logEvent('touch', { action: 'rub', target: label, story: true }); }
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(endRub, 180);
  };
  const picture = <Animated.View style={[styles.picture, { transform: motion.getTranslateTransform() }]} pointerEvents="none">
    {frames[id].map((source, index) => <Frame key={index} source={source} visible={step === index} duration={id === 'sun' ? 100 : 150} />)}
  </Animated.View>;
  // Keep every PNG mounted and decoded; animate layer opacity without changing layout.
  return <View style={[styles.card, { padding: u(14, 8), borderRadius: u(32, 24) }]}>
    <Text style={[styles.label, { fontSize: f(30, 22) }]}>{label}</Text>
    {swipe || id === 'stone' ? <PanGestureHandler minDist={id === 'stone' ? 2 : 40} maxPointers={1}
      onGestureEvent={event => { if (id === 'stone') rub(event.nativeEvent); }}
      onHandlerStateChange={({ nativeEvent: e }) => {
        if (e.state === State.BEGAN && id === 'stone') lastRub.current = { x: 0, y: 0, time: Date.now(), pulse: 0 };
        if (e.state === State.END && swipe && Math.hypot(e.translationX, e.translationY) >= 40 && (id !== 'hat' || Math.abs(e.translationX) >= 40 || e.translationY <= -40)) input('swipe', e.translationX, e.translationY);
        if ((e.state === State.END || e.state === State.CANCELLED || e.state === State.FAILED) && id === 'stone') endRub();
      }}><View style={styles.touch} onLayout={e => { touchSize.current = e.nativeEvent.layout; }} accessible accessibilityLabel={`${label}, ${id === 'stone' ? '문질러 보세요' : '밀어 보세요'}`}>{picture}</View></PanGestureHandler>
      : <TapGestureHandler maxDist={20} onHandlerStateChange={e => { if (e.nativeEvent.state === State.END) input('tap'); }}>
        <View style={styles.touch} accessible accessibilityRole="button" accessibilityLabel={`${label}, 만져 보세요`} accessibilityActions={[{ name: 'activate' }]} onAccessibilityAction={() => input('tap')}>{picture}</View>
      </TapGestureHandler>}
    <Text style={[styles.hint, { fontSize: f(19, 14), paddingVertical: u(6, 4) }]}>{id === 'stone' ? '살살 문질러요' : swipe ? '손가락으로 밀어요' : id === 'crow' || id === 'tiger' ? '톡, 톡! 두 번 만져요' : '톡! 만져요'}</Text>
  </View>;
}
const styles = StyleSheet.create({
  card: { flex: 1, minWidth: 0, borderRadius: 24, boxShadow: SOFT2, backgroundColor: K.white, padding: 8, alignItems: 'center' },
  label: { color: K.ink, fontSize: 22, fontWeight: '800' },
  touch: { flex: 1, width: '100%', minHeight: 100, alignItems: 'center', justifyContent: 'center' },
  picture: { width: '88%', height: '88%' },
  hint: { fontSize: 14, color: K.sub, textAlign: 'center', paddingVertical: 4 },
});
