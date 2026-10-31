import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as lipsync from '../src/lib/lipsync.ts';
import * as frames from '../src/lib/parentFrames.ts';

test('six distinguishable shapes, closures bypass vowel dwell; silence and seek reset', () => {
  const driver = frames.createParentFrameDriver();
  const seen = [];
  const off = driver.subscribe((f) => seen.push(f));
  for (const [i, viseme] of ['a', 'i', 'o', 'u', 'closed', 'rest'].entries()) driver.update(i, viseme, 1);
  assert.deepEqual(new Set(seen), new Set(frames.PARENT_FRAMES));
  driver.update(6, 'a', 1); driver.update(6.01, 'closed', 1);
  assert.equal(driver.current, 'closed');
  driver.update(7, 'a', 0); assert.equal(driver.current, 'neutral');
  driver.update(1, 'u', 1); assert.equal(driver.current, 'narrow');
  const count = seen.length; off(); driver.reset(); assert.equal(seen.length, count);
});

test('true timestamp cues are not suppressed by estimated envelope or dwell', () => {
  const driver = frames.createParentFrameDriver();
  driver.update(0.1, 'a', 0, true);
  driver.update(0.12, 'u', 0, true);
  assert.equal(driver.current, 'narrow');
  driver.update(0.13, 'rest', 1, true);
  assert.equal(driver.current, 'neutral');
});

// Execute the real hook with controlled Expo clock/events. This is not a device audio test.
function harness(tts = async () => ({ url: 'test.wav', env: Array(100).fill(0.6), env_ms: 40 })) {
  const timers = new Map(), listeners = new Map(), effects = [], stateWrites = [];
  let id = 0, speechOptions;
  const player = {
    currentTime: 0, duration: 2, playing: false, isBuffering: false, isAudioSamplingSupported: false,
    addListener(name, cb) { listeners.set(name, cb); return { remove() { listeners.delete(name); } }; },
    replace(source) { this.source = source; this.currentTime = 0; },
    play() { this.playing = true; }, pause() { this.playing = false; },
    setPlaybackRate(rate) { this.rate = rate; }, setAudioSamplingEnabled() {},
  };
  const modules = {
    react: { useCallback: (f) => f, useRef: (v) => ({ current: v }), useEffect: (f) => effects.push(f()),
      useState: (v) => [typeof v === 'function' ? v() : v, (next) => stateWrites.push(next)] },
    'react-native': { Platform: { OS: 'web' } },
    'expo-audio': { useAudioPlayer: () => player, setAudioModeAsync: async () => {}, getRecordingPermissionsAsync: async () => ({ granted: false }) },
    'expo-speech': { stop: async () => {}, speak: (_text, options) => { speechOptions = options; } },
    '@/lib/api': { api: { tts }, reportError() {} }, '@/lib/lipsync': lipsync, '@/lib/parentFrames': frames,
  };
  const source = readFileSync(new URL('../src/hooks/useSpeak.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => { assert.ok(name in modules, name); return modules[name]; },
    Date, Promise, setTimeout: (fn, ms) => { timers.set(++id, {fn, ms, once: true}); return id; },
    clearTimeout: (key) => timers.delete(key), setInterval: (fn, ms) => { timers.set(++id, { fn, ms }); return id; }, clearInterval: (key) => timers.delete(key) });
  const hook = exports.useSpeak('test-parent');
  return { hook, player, stateWrites, timers, listeners, get speechOptions() { return speechOptions; },
    tick: () => [...timers.values()].filter(t => !t.once).forEach(t => t.fn()),
    cleanup: () => effects.forEach(f => f?.()), flush: async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); } };
}

test('actual playback clock drives timed clip, pause/buffer/stop close mouth without per-tick React writes', async () => {
  const h = harness();
  const completion = h.hook.speak('아 우', { source: 1, cues: [
    { start: 0, end: 1, viseme: 'a', label: '' }, { start: 1, end: 2, viseme: 'u', label: '' },
  ] });
  await h.flush();
  const writes = h.stateWrites.length;
  h.player.currentTime = 0.5; h.tick(); assert.equal(h.hook.avatarDriver.current, 'open');
  h.hook.setSlow(true); assert.equal(h.player.rate, 0.8);
  h.player.currentTime = 1.2; h.tick(); assert.equal(h.hook.avatarDriver.current, 'narrow');
  h.player.isBuffering = true; h.tick(); assert.equal(h.hook.avatarDriver.current, 'neutral');
  h.player.isBuffering = false; h.player.playing = false; h.tick(); assert.equal(h.hook.avatarDriver.current, 'neutral');
  assert.equal(h.stateWrites.length, writes, 'no state setter runs during audio ticks');
  h.hook.stop(); await completion; assert.equal(h.timers.size, 0); h.cleanup();
});

test('stopped pending TTS cannot start playback; next request and completion clean up', async () => {
  let respond;
  const h = harness(() => new Promise(resolve => { respond = resolve; }));
  const first = h.hook.speak('엄마'); h.hook.stop(); await first;
  respond({ url: 'late.wav' }); await h.flush(); assert.equal(h.player.source, undefined);
  const next = h.hook.speak('아'); respond({ url: 'next.wav' }); await h.flush();
  assert.equal(h.player.source.uri, 'next.wav');
  h.player.currentTime = 0.5; h.tick(); assert.equal(h.hook.avatarDriver.current, 'open');
  h.listeners.get('playbackStatusUpdate')({ playing: false, didJustFinish: true });
  await next; assert.equal(h.hook.avatarDriver.current, 'neutral'); assert.equal(h.timers.size, 0); h.cleanup();
});

test('bundled real TTS event timestamps are ordered and within WAV duration', () => {
  const samples = JSON.parse(readFileSync(new URL('../assets/avatar-demo/samples.json', import.meta.url), 'utf8'));
  const sample = samples[0];
  assert.equal(sample.voice, 'Microsoft Heami Desktop');
  assert.ok(sample.visemes.length > 10);
  let previous = 0;
  for (const cue of sample.visemes) {
    assert.ok(cue.start >= previous && cue.end >= cue.start && cue.end <= sample.duration + 0.01);
    previous = cue.end;
  }
});

test('upstream HTTP 400 fallback is preserved without retrying missing parent voice', async () => {
  let calls = 0;
  const h = harness(async () => { calls++; throw new Error('HTTP 400'); });
  const completion = h.hook.speak('엄마');
  await h.flush();
  assert.equal(calls, 1);
  assert.equal(h.speechOptions.language, 'ko-KR');
  h.hook.stop(); await completion; h.cleanup();
});
