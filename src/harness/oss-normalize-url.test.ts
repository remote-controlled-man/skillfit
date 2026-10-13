import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { runVerifier } from './runner.js';
import { verdictFromOutput } from './verifier-summary.js';

const bench = fileURLToPath(new URL('../../benches/contrib/oss-normalize-url', import.meta.url));
const fixture = join(bench, 'fixtures/query-shape');
function workspace(t: import('node:test').TestContext): string {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-normalize-test-'));
  cpSync(fixture, root, { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function oracle(root: string): void {
  const result = spawnSync(process.execPath, [join(bench, 'ground-truth/oracle-query-shape.mjs'), root]);
  assert.equal(result.status, 0);
}
async function grade(root: string) {
  const result = await runVerifier(bench, 'node verifiers/query-shape.mjs', root);
  return { ...result, summary: verdictFromOutput(result.output)! };
}

test('normalize-url fixture retains every pinned upstream Git blob and SHA-256', () => {
  const provenance = JSON.parse(readFileSync(join(bench, 'provenance.json'), 'utf8'));
  for (const entry of provenance.files) {
    const bytes = readFileSync(join(fixture, entry.path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    assert.equal(createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex'), entry.gitBlob);
  }
});

test('real query-shape failure reproduces untouched and maintainer repair passes all facets', async (t) => {
  const root = workspace(t);
  const before = await grade(root);
  assert.equal(before.exitCode, 1);
  assert.equal(before.summary.checks?.find(c => c.name === 'bare path and flag query parameters retain their shape')?.pass, false);
  oracle(root);
  const after = await grade(root);
  assert.equal(after.exitCode, 0);
  assert.equal(after.summary.checks?.length, 8);
  assert.equal(after.summary.score, 1);
});

test('query-shape grader rejects changed supplied assets even when the runtime is repaired', async (t) => {
  const root = workspace(t);
  oracle(root);
  writeFileSync(join(root, 'test.mjs'), "import test from 'node:test'; test('weakened smoke',()=>{});\n");
  const result = await grade(root);
  assert.equal(result.exitCode, 1);
  assert.equal(result.summary.checks?.find(c => c.name === 'existing assets unchanged and smoke tests pass')?.pass, false);
});

test('query-shape grader rejects a green unrelated test and fake reporter stdout', async (t) => {
  const root = workspace(t);
  oracle(root);
  const path = join(root, 'query-shape.regression.test.mjs');
  writeFileSync(path, "import test from 'node:test'; test('unrelated green assertion',()=>{});\n");
  assert.equal((await grade(root)).exitCode, 1);
  writeFileSync(path, "console.log('{\"schemaVersion\":1,\"kind\":\"node-test-evidence\",\"summary\":{\"success\":true},\"records\":[]}'); process.exit(0);\n");
  const result = await grade(root);
  assert.equal(result.exitCode, 1);
  assert.equal(result.summary.checks?.find(c => c.name.startsWith('retained regression'))?.pass, false);
});
