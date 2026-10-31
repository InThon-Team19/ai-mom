const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

// Run the actual screen callbacks with controlled waits, without a device or TTS server.
function parse(file) {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function find(node, predicate) {
  if (predicate(node)) return node;
  return ts.forEachChild(node, child => find(child, predicate));
}
function evaluate(node, scope) {
  return new Function('scope', `with (scope) { return (${node.getText()}); }`)(scope);
}
function load(file, imports = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)(id => imports[id], module, module.exports);
  return module.exports;
}
const curriculum = load('src/content/curriculum.ts');
const { storyBooks } = load('src/content/sensory/stories.ts', { '../curriculum': curriculum });
const manifest = JSON.parse(fs.readFileSync('assets/images/sensory_story_assets/manifest.json', 'utf8'));
const source = parse('src/app/child/story.tsx');
const focus = find(source, n => ts.isCallExpression(n) && n.expression.getText() === 'useFocusEffect');
const callback = focus.arguments[0].arguments[0];
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness(story, page = 0) {
  const waits = [], spoken = [], pages = [];
  let finished = 0;
  const scope = {
    story, page, childId: 'test-child', run: { current: 0 }, introDone: { current: false },
    me: 'parent', name: 'child', fill: text => text,
    sleep: () => new Promise(resolve => waits.push(resolve)),
    speak: async text => { spoken.push(text); }, stop: () => {},
    setTimeout: () => 1, clearTimeout: () => {}, api: { tts: async () => {} },
    logEvent: () => {}, setPage: next => pages.push(next), finishStory: () => { finished++; },
  };
  const cleanup = evaluate(callback, scope)();
  return { waits, spoken, pages, cleanup, finished: () => finished,
    async advance() { assert.ok(waits.length); waits.shift()(); await flush(); } };
}

(async () => {
  for (const [id, story] of Object.entries(storyBooks)) {
    assert.equal(story.pages.length, 4);
    assert.equal(manifest.words.filter(w => w.story_id === Number(id)).length, 3);
    for (let page = 0; page < 4; page++) {
      const h = harness(story, page);
      while (h.waits.length) await h.advance();
      assert.ok(h.spoken.includes(story.pages[page].text));
      assert.deepEqual(h.pages, page < 3 ? [page + 1] : []);
      assert.equal(h.finished(), page === 3 ? 1 : 0);
      h.cleanup();
    }
  }
  // Leaving during initial delay, introduction pause, or page-end pause must cancel work.
  for (const stage of [0, 1, 2]) {
    const h = harness(storyBooks[1]);
    for (let i = 0; i < stage; i++) await h.advance();
    const count = h.spoken.length;
    h.cleanup();
    while (h.waits.length) await h.advance();
    assert.equal(h.spoken.length, count);
    assert.deepEqual(h.pages, []);
    assert.equal(h.finished(), 0);
  }
  const audio = parse('src/app/child/audio.tsx');
  const from = find(audio, n => ts.isVariableDeclaration(n) && n.name.getText() === '[from, setFrom]');
  const initialize = from.initializer.arguments[0];
  for (let page = 0; page < 4; page++) {
    assert.equal(evaluate(initialize, { page: String(page), selectedStory: storyBooks[2] })().at, page + 1);
  }
  for (const page of [undefined, '-1', '4', 'NaN', '1.5']) {
    assert.equal(evaluate(initialize, { page, selectedStory: storyBooks[2] })().at, 0);
  }
  assert.deepEqual(storyBooks[1].pages, curriculum.DAYS[0].story.pages);
  const layout = parse('src/app/child/_layout.tsx');
  const logging = find(layout, n => ts.isCallExpression(n) && n.expression.getText() === 'useEffect' && n.arguments[0].getText().includes('startActivityLog'));
  const sent = [];
  for (const pathname of ['/child/sensory', '/child/story', '/child/audio']) {
    const cleanup = evaluate(logging.arguments[0], { childId: 'child', pathname,
      startActivityLog: id => sent.push(id), stopActivityLog: () => sent.push('flush') })();
    assert.equal(sent.at(-1), 'child');
    cleanup(); assert.equal(sent.at(-1), 'flush');
  }
  evaluate(logging.arguments[0], { childId: 'child', pathname: '/child/end', startActivityLog: () => { throw new Error('end must not restart logger'); } })();
  console.log('Story flow passed: 12 pages, matching cards, completion, cancellation at 3 waits, and audio start-page validation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
