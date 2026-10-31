const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const filename = path.resolve('src/content/sensory/machine.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = new Module(filename); mod._compile(compiled, filename);
const { initial, transition: t } = mod.exports;
let checks = 0;
function check(value) { assert.ok(value); checks++; }
let s=initial();
for(let i=1;i<=8;i++){s=t('moon',s,'tap',i*100).state;check(s.step===i%4);}
for(const id of ['tiger','crow']){
 let a=t(id,initial(),'tap',1000);check(a.reset===2000);
 let b=t(id,a.state,'tap',2999);check(b.reset===1500);check(t(id,b.state,'tap',3000)===null);
 check(t(id,a.state,'tap',3001).state.taps===1);
}
for(const [id,count] of [['hat',1],['pouch',3],['pitcher',3],['stick',2]]){
 let s=initial();const input=id==='stick'?'tap':'swipe';
 check(t(id,s,input==='tap'?'swipe':'tap',1)===null);
 for(let i=1;i<=count;i++){const r=t(id,s,input,i*1000);s=r.state;check(s.step===i);check(r.reset===(i===count?2000:undefined));}
 check(t(id,s,input,9999)===null);
}
let sun=t('sun',initial(),'tap',1000);check(sun.reset===1500);let again=t('sun',sun.state,'tap',2000);check(again.reset===1500 && again.state.activeSince===1000);
check(t('stone',initial(),'tap',1000)===null);
const manifest=JSON.parse(fs.readFileSync('assets/images/sensory_story_assets/manifest.json','utf8'));
check(manifest.words.length===9);check(new Set(manifest.words.map(w=>w.story_id)).size===3);
let pngs=0;
for(const word of manifest.words) for(const frame of word.frames){
 const file=path.join('assets/images/sensory_story_assets',frame.path);const bytes=fs.readFileSync(file);
 check(bytes.subarray(1,4).toString()==='PNG');check(bytes.readUInt32BE(16)===1024 && bytes.readUInt32BE(20)===1024);pngs++;
}
check(pngs===25);
console.log(`${checks} checks passed: transitions, timing contracts, input guards, manifest paths, 25 PNG dimensions.`);
