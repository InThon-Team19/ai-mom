import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createLipTimeline, cueAt, POSES, REST_POSE, sampleLipPose, sapiViseme, seekSeconds } from '../src/lib/lipsync.ts';

test('한국어 모음: 아/이/오/우/으가 서로 다른 입술 형태를 가진다', () => {
  const cues = createLipTimeline('아이오우으', 5);
  assert.deepEqual(cues.map((c) => c.viseme), ['a', 'i', 'o', 'u', 'eu']);
  assert.ok(POSES.i.width > POSES.u.width);
  assert.ok(POSES.a.open > POSES.i.open);
});
test('엄마/아빠/뽀뽀에는 실제로 입술을 붙이는 구간이 있다', () => {
  for (const text of ['엄마', '아빠', '뽀뽀']) {
    const cues = createLipTimeline(text, 2);
    const closures = cues.filter((c) => c.viseme === 'closed');
    assert.ok(closures.length > 0, text);
    const c = closures[0];
    const pose = sampleLipPose(cues, c.start + (c.end-c.start)*0.8);
    assert.equal(pose.open, 0);
    assert.equal(pose.press, 1);
  }
});
test('쉼표/무음/끝난 음성에서는 입이 닫힌다', () => {
  const cues = createLipTimeline('아, 우.', 3);
  const pause = cues.find((c) => c.label === ',');
  assert.deepEqual(sampleLipPose(cues, (pause.start+pause.end)/2), REST_POSE);
  assert.deepEqual(sampleLipPose(cues, -1), REST_POSE);
  assert.deepEqual(sampleLipPose(cues, 3), REST_POSE);
  assert.deepEqual(sampleLipPose(cues, 0.1, {v:[0,0,0,0],ms:40}), REST_POSE);
  assert.deepEqual(createLipTimeline(''), []);
  assert.equal(cueAt(cues, NaN), undefined);
});
test('시크/배속에 상관없이 같은 음성 시각은 같은 입모양이다', () => {
  const cues = createLipTimeline('엄마 아빠 사랑해요', 5);
  const reference = sampleLipPose(cues, 2.4);
  sampleLipPose(cues, 4.2);
  sampleLipPose(cues, 0.2);
  assert.deepEqual(sampleLipPose(cues, 2.4), reference);
});
test('웹/네이티브 재생 위치: 화면 좌표를 유효한 음성 시각으로 바꾼다', () => {
  assert.equal(seekSeconds(350,100,500,10),5);
  assert.equal(seekSeconds(-10,100,500,10),0);
  assert.equal(seekSeconds(9999,100,500,10),10);
  assert.equal(seekSeconds(NaN,100,500,10),undefined);
  assert.equal(seekSeconds(200,100,0,10),undefined);
});
test('세 음성 샘플: 시간표가 WAV 범위에 있고 침묵·다물기·모음이 존재한다', () => {
  const samples = JSON.parse(readFileSync(new URL('../assets/avatar-demo/samples.json',import.meta.url),'utf8'));
  assert.equal(samples.length, 3);
  for (const sample of samples) {
    assert.equal(sample.alignment, 'sapi-visemes');
    const bytes=readFileSync(new URL(`../assets/avatar-demo/${sample.id}.wav`,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.ok(bytes.length > 10000);
    const cues=sample.visemes.map((v)=>({...v,viseme:sapiViseme(v.id),label:''}));
    assert.ok(cues.some(c=>c.viseme==='closed'));
    assert.ok(cues.some(c=>c.viseme==='rest'));
    assert.ok(cues.every((c,i)=>c.start>=0 && c.end>c.start && c.end<=sample.duration+1e-5 && (!i || c.start>=cues[i-1].end)));
    assert.ok(sample.env.some(v=>v>0.1) && sample.env.some(v=>v===0));
    for(let t=0;t<sample.duration;t+=1/60) {
      const pose=sampleLipPose(cues,t,{v:sample.env,ms:sample.envMs});
      assert.ok(Object.values(pose).every(Number.isFinite));
      assert.ok(pose.open>=0 && pose.open<=1);
    }
  }
});
