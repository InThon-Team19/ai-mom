const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = ts.createSourceFile('api.ts', fs.readFileSync('src/lib/api.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'recordingPayload');
const code = ts.transpileModule(`${node.getText(source)}\nmodule.exports = recordingPayload;`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleForTest = { exports: {} };
new Function('module', 'withTimeout', 'readBase64', code)(moduleForTest, p => p, async uri => `native:${uri}`);
const payload = moduleForTest.exports;
(async () => {
  const bytes = Uint8Array.from({ length: 100003 }, (_, i) => i % 256);
  for (const [mime, ext] of [['audio/webm;codecs=opus', 'webm'], ['audio/mp4', 'm4a'], ['audio/ogg', 'ogg'], ['audio/wav', 'wav']]) {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    try {
      const result = await payload(url);
      assert.equal(result.ext, ext);
      assert.deepEqual(Buffer.from(result.audio_b64, 'base64'), Buffer.from(bytes));
    } finally { URL.revokeObjectURL(url); }
  }
  assert.deepEqual(await payload('data:audio/webm;base64,AQID'), { ext: 'webm', audio_b64: 'AQID' });
  assert.deepEqual(await payload('file:///recording.m4a'), { ext: 'm4a', audio_b64: 'native:file:///recording.m4a' });
  for (const blob of [new Blob([], { type: 'audio/webm' }), new Blob([bytes], { type: 'application/octet-stream' })]) {
    const url = URL.createObjectURL(blob);
    try { await assert.rejects(payload(url)); } finally { URL.revokeObjectURL(url); }
  }
  console.log('Recording upload passed: real blob/data URLs, WebM/MP4/Ogg/WAV MIME, chunked base64, native path, empty/unsupported rejection.');
})().catch(error => { console.error(error); process.exitCode = 1; });
