// 웹(데모 링크) 전용 소리 허용 도우미 — 담당: 태희. 폰 앱(Android/iOS)에서는 아무것도 하지 않음.
// 브라우저는 사용자가 화면을 한 번 누르기 전엔 소리 재생(자동 재생)을 막음. 특히 iPhone Safari 는 기기 음성(speechSynthesis)도 막음.
// - installWebAudioUnlock(): 첫 터치/클릭 때 기기 음성을 소리 없이 한 번 불러 깨워 둠
// - onNextGesture(fn): 재생이 막혔을 때, 다음 터치/클릭 순간에 다시 재생 (터치 안에서 부르면 브라우저가 허용)
import { Platform } from 'react-native';

type Doc = { addEventListener: (t: string, f: () => void, o?: unknown) => void; removeEventListener: (t: string, f: () => void, o?: unknown) => void };
const doc = (): Doc | null => (Platform.OS === 'web' && typeof document !== 'undefined' ? (document as unknown as Doc) : null);
const EVENTS = ['pointerdown', 'touchend', 'keydown'];

let pending: (() => void)[] = [];
let listening = false;

function fire() {
  const fns = pending;
  pending = [];
  const d = doc();
  if (d) EVENTS.forEach((e) => d.removeEventListener(e, fire, true));
  listening = false;
  fns.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

/** 다음 사용자 터치/클릭/키 입력 순간에 fn 실행 (웹만). 폰에선 바로 실행 */
export function onNextGesture(fn: () => void) {
  const d = doc();
  if (!d) return fn();
  pending.push(fn);
  if (listening) return;
  listening = true;
  EVENTS.forEach((e) => d.addEventListener(e, fire, true));
}

let installed = false;
/** 앱 시작 때 한 번: 첫 터치에서 기기 음성을 깨움 (iPhone Safari 는 터치 안에서 한 번 불러야 이후 말함) */
export function installWebAudioUnlock() {
  if (installed || !doc()) return;
  installed = true;
  onNextGesture(() => {
    const g = globalThis as unknown as { speechSynthesis?: { speak: (u: unknown) => void }; SpeechSynthesisUtterance?: new (t: string) => { volume: number } };
    if (!g.speechSynthesis || !g.SpeechSynthesisUtterance) return;
    const u = new g.SpeechSynthesisUtterance(' ');
    u.volume = 0;
    g.speechSynthesis.speak(u);
  });
}
