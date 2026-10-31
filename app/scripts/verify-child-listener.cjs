const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function parse(file) { return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
function find(node, predicate) { return predicate(node) ? node : ts.forEachChild(node, child => find(child, predicate)); }
function evaluate(node, scope) {
  const code = ts.transpileModule(`module.exports = (${node.getText()});`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('scope', 'module', `with (scope) { ${code} }`)(scope, module);
  return module.exports;
}
const source = parse('src/hooks/useChildListener.ts');
const limits = find(source, n => ts.isVariableDeclaration(n) && n.name.getText() === 'LISTEN');
const LISTEN = evaluate(limits.initializer, {});
const effect = find(source, n => ts.isCallExpression(n) && n.expression.getText() === 'useEffect' && n.arguments[0].getText().includes('const waiters ='));
const flush = () => new Promise(resolve => setImmediate(resolve));

async function simulate(phase, dbAt, androidHold = false) {
  let time = 0, meteringCalls = 0;
  let windows = 0;
  const waits = [], uploads = [], results = [];
  const ref = current => ({ current });
  const scope = {
    active: true, LISTEN, Date: { now: () => time }, Platform: { OS: androidHold ? 'android' : 'ios' },
    cb: ref({ childId: 'child', meta: () => ({ item: 'apple', expected: 'apple', phase }), onClip: r => results.push(r), onBargeIn: () => {} }),
    stoppedWaiters: ref([]), uploads: ref(0), busyRef: ref(false), recording: ref(false),
    holds: ref(androidHold ? 1 : 0), resumeAt: ref(0), forceUntil: ref(0), traced: ref(false), statusRef: ref('off'),
    setSt: () => {}, setSpeechLevel: () => {}, setMode: () => {}, level: { set: () => {} },
    trace: () => {}, logEvent: () => {}, removeFile: () => {},
    setAudioModeAsync: async () => {}, requestRecordingPermissionsAsync: async () => ({ granted: true }),
    sleep: ms => new Promise(resolve => waits.push(() => { time += ms; if (androidHold && time >= 1000) scope.holds.current = 0; resolve(); })),
    recorder: { prepareToRecordAsync: async () => {}, record: () => { windows++; }, stop: async () => {}, get uri() { return `window-${windows}.wav`; },
      getStatus: () => ({ metering: dbAt(time, ++meteringCalls) }) },
    api: { childClip: async (...args) => { uploads.push(args); return { saved: true, id: 'clip', matched: true }; } },
  };
  const cleanup = evaluate(effect.arguments[0], scope)();
  await flush();
  while (time < 5500 && !uploads.length) {
    assert.ok(waits.length, 'listener must keep sampling');
    waits.shift()(); await flush();
  }
  cleanup();
  while (waits.length) { waits.shift()(); await flush(); }
  return { uploads, results };
}

(async () => {
  // A quiet word entirely inside the first calibration second used to be discarded.
  const early = await simulate('repeat', t => t >= 200 && t <= 500 ? -40 : -65);
  assert.equal(early.uploads.length, 1);
  assert.equal(early.uploads[0][2].phase, 'repeat');
  assert.equal(early.results.length, 1);
  assert.equal((await simulate('repeat', () => undefined)).uploads.length, 1);
  assert.equal((await simulate('object', () => -65)).uploads.length, 0);
  const android = await simulate('repeat', t => t < 1000 ? -10 : -65, true);
  assert.equal(android.uploads.length, 1);
  assert.equal(android.uploads[0][1], 'window-2.wav', 'discard avatar echo before recording child');

  const session = parse('src/app/child/session.tsx');
  const handler = find(session, n => ts.isVariableDeclaration(n) && n.name.getText() === 'handleClip');
  const utter = { current: null };
  const result = { meta: { item: 'apple', phase: 'repeat' }, res: { saved: true, matched: true } };
  const scope = { item: { ko: 'apple' }, phase: 'repeat', waiting: { current: false }, utter,
    sig: { current: { voices: 0 } }, freeClip: () => { throw new Error('repeat response lost'); }, evaluate: () => {} };
  evaluate(handler.initializer, scope)(result);
  assert.equal(utter.current, result, 'keep results received between prompt and waiter');
  console.log('Child listener passed: early quiet word, missing meter, silent object, Android echo isolation, and response arriving before waiter.');
})().catch(error => { console.error(error); process.exitCode = 1; });
