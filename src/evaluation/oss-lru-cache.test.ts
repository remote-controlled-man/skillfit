import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { loadBench } from "../bench/read.js";
import { sha256File } from "../shared/hash.js";
import { runVerifier } from "./execution/paired.js";
import { verdictFromOutput } from "../bench/gates/summary.js";
const root = fileURLToPath(new URL("../../benches/contrib/oss-lru-cache/", import.meta.url));
const bench = loadBench(root);

for (const task of bench.tasks) test(`OSS lru-cache ${task.id}: original failure, full oracle and counterexamples`, async t => {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-lru-gates-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(root, task.fixture), dir, { recursive: true });
  const nop = await runVerifier(root, task.verifier, dir);
  assert.equal(nop.exitCode, 1);
  const original = verdictFromOutput(nop.output);
  assert.ok(original && original.score !== null && original.score > 0 && original.score < 1);
  const specific = task.id === 'fetch-size' ? /out-of-order/ : task.id === 'fetch-abort' ? /deleted pending fetch/ : /onInsert hides/;
  assert.ok(original.checks!.some(c => specific.test(c.name) && !c.pass), 'the historical behavior failure must be reproduced');
  assert.equal((await runVerifier(root, task.oracle!, dir)).exitCode, 0);
  const fixed = await runVerifier(root, task.verifier, dir);
  assert.equal(fixed.exitCode, 0, fixed.output); assert.equal(verdictFromOutput(fixed.output)?.score, 1);
  if (task.id === 'fetch-abort') {
    const source = join(dir, 'index.js'); const bytes = readFileSync(source, 'utf8');
    writeFileSync(source, bytes.replaceAll("abort(new Error('deleted'))", 'abort()').replaceAll("abort(new Error('evicted'))", 'abort()').replaceAll("abort(new Error('replaced'))", 'abort()'));
    writeFileSync(join(dir, 'regression.test.mjs'), `import assert from 'node:assert/strict'; import { test } from 'node:test'; import Cache from './index.js';
      test('reject the actual signal reason before provider completion', async () => { let release,signal; const c=new Cache({max:2,fetchMethod:(k,v,o)=>{signal=o.signal;return new Promise(r=>release=r)}});
        let error; const p=c.fetch('x').catch(e=>error=e); c.delete('x'); await new Promise(r=>setImmediate(r)); const before=error;
        release('late'); await p; assert.equal(before,signal.reason); assert.equal(c.has('x'),false); });\n`);
    const actualReason = await runVerifier(root, task.verifier, dir); assert.equal(actualReason.exitCode, 0, actualReason.output);
    writeFileSync(source, bytes); await runVerifier(root, task.oracle!, dir);
  }
  const regression = join(dir, 'regression.test.mjs'); const bytes = readFileSync(regression);
  writeFileSync(regression, "import { test } from 'node:test'; test('vacuous', () => {});\n");
  const vacuous = await runVerifier(root, task.verifier, dir);
  assert.equal(vacuous.exitCode, 1); assert.equal(verdictFromOutput(vacuous.output)?.checks?.at(-1)?.pass, false);
  writeFileSync(regression, bytes);
  const source = join(dir, task.id === 'fetch-lifecycle' ? 'src/index.ts' : 'index.js');
  const fixedBytes = readFileSync(source);
  writeFileSync(source, fixedBytes.toString() + (task.id === 'fetch-lifecycle' ? '\nLRUCache.unrelatedReviewMarker = 42\n' : '\nmodule.exports.unrelatedReviewMarker = 42\n'));
  writeFileSync(regression, `import assert from 'node:assert/strict'; import { test } from 'node:test';
    import { loadCache } from './runtime.mjs'; import { dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
    const { Cache, cleanup } = await loadCache(dirname(fileURLToPath(import.meta.url)), ${task.id === 'fetch-lifecycle'});
    test('only an unrelated marker', () => { assert.equal(Cache.unrelatedReviewMarker, 42); cleanup(); });\n`);
  const unrelated = await runVerifier(root, task.verifier, dir);
  assert.equal(unrelated.exitCode, 1); assert.equal(verdictFromOutput(unrelated.output)?.checks?.at(-1)?.pass, false);
  assert.match(unrelated.output, /"finalPassed":true,"originalFailed":true,"referencePassed":false/);
  writeFileSync(source, fixedBytes); writeFileSync(regression, bytes);
  const smoke = join(dir, 'test.mjs'); writeFileSync(smoke, readFileSync(smoke, 'utf8') + '\n// tampered protected test\n');
  assert.equal((await runVerifier(root, task.verifier, dir)).exitCode, 1);
  cpSync(join(root, task.fixture, 'test.mjs'), smoke);
  writeFileSync(source, 'process.exit(0)\n' + readFileSync(source, 'utf8'));
  const earlyExit = await runVerifier(root, task.verifier, dir);
  assert.equal(earlyExit.exitCode, 1); assert.ok(verdictFromOutput(earlyExit.output)?.checks?.some(c => c.name === 'runtime probe completeness' && !c.pass));
});

test('OSS replay provenance matches every retained upstream source and license byte', () => {
  const provenance = JSON.parse(readFileSync(join(root, 'provenance.json'), 'utf8')) as { cases: { id: string; sourceSha256: Record<string, string> }[] };
  for (const item of provenance.cases) for (const [key, hash] of Object.entries(item.sourceSha256)) {
    const split = key.indexOf(':'); const arm = key.slice(0, split); const rel = key.slice(split + 1);
    assert.equal(sha256File(join(root, arm === 'pre' ? 'fixtures' : 'ground-truth', item.id, rel)), hash);
  }
});
