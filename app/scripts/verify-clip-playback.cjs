const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = ts.createSourceFile('ClipList.tsx', fs.readFileSync('src/components/ClipList.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(node, predicate) { return predicate(node) ? node : ts.forEachChild(node, child => find(child, predicate)); }
function evaluate(node, scope) {
  const code = ts.transpileModule(`module.exports = (${node.getText(source)});`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('scope', 'module', `with (scope) { ${code} }`)(scope, module);
  return module.exports;
}
const toggleNode = find(source, n => ts.isVariableDeclaration(n) && n.name.getText(source) === 'toggle').initializer;
const focusNode = find(source, n => ts.isCallExpression(n) && n.expression.getText(source) === 'useFocusEffect').arguments[0].arguments[0];
function setup() {
  const sources = [], played = [], selected = [];
  const scope = {
    request: { current: 0 }, childId: 'child', isActive: () => false,
    setError: () => {}, setPlayingId: id => selected.push(id),
    setAudioModeAsync: async () => {},
    api: { childClipSource: () => new Promise(resolve => sources.push(resolve)) },
    player: { pause: () => {}, replace: source => played.push(source), play: () => {} },
  };
  return { scope, sources, played, selected, toggle: evaluate(toggleNode, scope), leave: evaluate(focusNode, scope)() };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const h = setup();
  const first = h.toggle({ id: '1' }); await flush();
  const second = h.toggle({ id: '2' }); await flush();
  h.sources[1]('second.wav'); await second;
  h.sources[0]('first.wav'); await first;
  assert.deepEqual(h.played, ['second.wav'], 'late request must not replace latest clip');
  h.leave(); assert.equal(h.selected.at(-1), null);
  const left = setup();
  const pending = left.toggle({ id: '1' }); await flush();
  left.leave(); left.sources[0]('late.wav'); await pending;
  assert.deepEqual(left.played, [], 'leaving screen must cancel pending playback');
  console.log('Clip playback passed: latest selection wins; blur stops playback and cancels pending requests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
