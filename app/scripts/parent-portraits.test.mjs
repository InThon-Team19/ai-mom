import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const app = fileURLToPath(new URL('../', import.meta.url));
function loader(mocks = {}) {
  const cache = new Map();
  return function load(file) {
    file = path.resolve(app, file);
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const require = name => {
      if (name in mocks) return mocks[name];
      const resolved = name.startsWith('@/') ? path.join(app, 'src', name.slice(2)) : path.resolve(path.dirname(file), name);
      if (name.endsWith('.png')) { assert.ok(existsSync(resolved), name); return resolved; }
      const candidate = [resolved, resolved + '.ts', resolved + '.tsx'].find(existsSync);
      assert.ok(candidate, `unmocked module: ${name}`);
      return load(candidate);
    };
    vm.runInNewContext(code, { exports, require, console, Math, JSON, Promise,
      setInterval: mocks.setInterval ?? (() => 1), clearInterval() {}, setTimeout: mocks.setTimeout ?? (() => 1), clearTimeout() {} }, { filename: file });
    return exports;
  };
}

test('old SVG profiles are preserved; all eight illustration IDs and calibrated frame sets resolve', () => {
  const load = loader();
  const { portraitId, portraitSelection, mouthCalibration } = load('src/lib/portraitConfig.ts');
  const { PORTRAITS } = load('src/lib/portraitAssets.ts');
  const original = { face: 3, hair: 4, eyes: 2, outfit: 6, color: 1 };
  assert.equal(portraitId(original, '아빠'), null);
  assert.equal(portraitSelection({ style: 'illustration' }, '아빠').character, 'father');
  for (const character of ['mother', 'father']) for (const hair of [0, 1]) for (const outfit of [0, 1]) {
    const config = { ...original, style: 'illustration', portrait: { version: 1, character, hair, outfit } };
    const id = portraitId(config);
    for (const size of ['small', 'normal', 'large']) assert.equal(Object.keys(PORTRAITS[id][size]).length, 6);
    assert.equal(config.face, original.face);
    assert.equal(portraitId({ ...config, style: 'svg' }), null);
  }
  assert.equal(mouthCalibration(.8), 'small'); assert.equal(mouthCalibration(1), 'normal'); assert.equal(mouthCalibration(1.2), 'large');
  assert.equal(portraitId({ style: 'illustration', portrait: { character: 'bad', hair: -4, outfit: 99 } }, '아빠'), 'father-0-0');
});

test('illustration metadata does not break the existing father SVG default or overwrite customized SVG fields', () => {
  const load = loader({ react: {}, 'react/jsx-runtime': {}, 'react-native-svg': {} });
  const { avatarFor, DEFAULT_AVATAR } = load('src/components/Avatar.tsx');
  const portrait = { version: 1, character: 'father', hair: 1, outfit: 1 };
  const dad = avatarFor({ ...DEFAULT_AVATAR, style: 'illustration', portrait }, '아빠');
  assert.equal(dad.hair, 4); assert.equal(dad.outfit, 1);
  assert.equal(dad.style, 'illustration'); assert.equal(dad.portrait, portrait);
  const custom = { ...DEFAULT_AVATAR, face: 3, hair: 2, style: 'svg', portrait };
  assert.equal(avatarFor(custom, '아빠'), custom);
});

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
test('all 8 parent combinations preload 6 frames and switch without React state writes; cleanup unsubscribes', () => {
  for (const character of ['mother','father']) for (const hair of [0,1]) for (const outfit of [0,1]) {
    const effects = [], values = [], writes = [];
    const jsx = (type, props, key) => ({ type, props, key });
    const load = loader({
      react: { useCallback: fn => fn, useRef: current => ({ current }), useState: initial => [typeof initial === 'function' ? initial() : initial, next => writes.push(next)], useEffect: fn => effects.push(fn) },
      'react/jsx-runtime': { jsx, jsxs: jsx }, 'expo-image': { Image: 'Image' },
      'react-native': { View:'View',Text:'Text',StyleSheet:{ absoluteFill:{} },Animated:{View:'AnimatedView',Value:class{constructor(v){this.v=v;values.push(this);}setValue(v){this.v=v;}}}},
    });
    const { IllustratedAvatar } = load('src/components/IllustratedAvatar.tsx');
    const driver = load('src/lib/parentFrames.ts').createParentFrameDriver();
    let ready = 0;
    const element = IllustratedAvatar({ id:`${character}-${hair}-${outfit}`, driver, blink:false, onReady:()=>ready++ });
    const tree = element.type(element.props);
    const cleanup = effects.map(fn=>fn());
    const images = nodes(tree).filter(n=>n.type==='Image');
    assert.equal(images.length,6);
    images.slice(0,5).forEach(i=>i.props.onLoad()); assert.equal(ready,0);
    images[5].props.onLoad(); images[5].props.onLoad(); assert.equal(ready,1);
    const frames=['neutral','closed','open','wide','round','narrow'];
    for(const f of frames){driver.preview(f);assert.deepEqual(values.slice(0,6).map(v=>v.v),frames.map(s=>Number(s===f)));}
    assert.equal(writes.length,0,'audio pose events must never set React state');
    cleanup.forEach(fn=>fn?.());driver.preview('open');
    assert.equal(values[5].v,1,'unmounted renderer no longer receives events');
    const resized=IllustratedAvatar({id:`${character}-${hair}-${outfit}`,scale:.8});
    assert.notEqual(resized.key,element.key,'calibration change resets readiness');
  }
});

test('appearance survives local restart; awaited server failures surface instead of reporting sync success', async()=>{
  const storage=new Map(); const sent=[];let fail=false;
  const mocks={
    react:{useState:v=>[v,()=>{}],useEffect:()=>{}},
    '@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async key=>storage.get(key)??null,setItem:async(key,value)=>storage.set(key,value)}},
    '@/components/Avatar':{DEFAULT_AVATAR:{face:0,hair:0,eyes:0,outfit:0,color:0}},
    '@/lib/api':{api:{putProfile:async(id,body)=>{sent.push({id,body});if(fail)throw Error('offline');}}},
    '@/lib/progress':{dayAdvancePatch:()=>null}, '@/lib/session':{restoreParentToken:async()=>{},setToken:async()=>{}},
    './account':{syncAccountProfile:async()=>{}},
  };
  const store=loader(mocks)('src/lib/store.ts');
  const initial=await store.loadProfile();
  const avatar={...initial.avatar,style:'illustration',portrait:{version:1,character:'father',hair:1,outfit:1}};
  await store.updateProfile({avatar},{awaitRemote:true});
  assert.deepEqual(JSON.parse(storage.get('aibom.profile')).avatar,avatar);
  assert.equal(sent.at(-1).body.avatar.portrait.character,'father');
  const restarted=loader(mocks)('src/lib/store.ts');
  assert.deepEqual(JSON.parse(JSON.stringify((await restarted.loadProfile()).avatar)),avatar);
  fail=true;
  await assert.rejects(store.updateProfile({avatar:{...avatar,style:'svg'}},{awaitRemote:true}),/offline/);
  assert.equal(JSON.parse(storage.get('aibom.profile')).avatar.style,'svg','offline local choice is retained for retry');
});
