import assert from 'node:assert/strict';
import { cpSync, existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checksFor } from './cases.mjs';

const bench = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function files(root, rel = '') { return readdirSync(join(root, rel), { withFileTypes: true }).flatMap(entry => {
  if (entry.name === '.git' || entry.name.startsWith('_')) return [];
  const child = rel ? `${rel}/${entry.name}` : entry.name;
  if (entry.isSymbolicLink()) return [];
  return entry.isDirectory() ? files(root, child) : entry.isFile() ? [child] : [];
}); }
function testRun(root, tests) {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...tests], { cwd: root, encoding: 'utf8', timeout: 5000, env });
  return { completed: !result.error && result.signal == null && typeof result.status === 'number',
    passed: result.status === 0, tests: /# tests [1-9][0-9]*/.test(result.stdout ?? ''),
    noSkips: /# skipped 0/.test(result.stdout ?? '') && /# todo 0/.test(result.stdout ?? '') };
}
function regressionEvidence(run, canonical, source) {
  const candidates = files(run).filter(p => /(?:^|\/)[^/]+\.(?:test|spec)\.mjs$/.test(p) && !existsSync(join(canonical, p)));
  return candidates.map(p => {
    const final = testRun(run, [p]); const restored = mkdtempSync(join(tmpdir(), 'skillfit-lru-regression-'));
    try {
      cpSync(run, restored, { recursive: true, filter: file => !relative(run, file).split(/[\\/]/).some(s => s === '.git' || s.startsWith('_')) && !lstatSync(file).isSymbolicLink() });
      cpSync(join(canonical, source), join(restored, source));
      const original = testRun(restored, [p]);
      return { path: p, finalPassed: final.completed && final.passed && final.tests && final.noSkips,
        originalFailed: original.completed && !original.passed && original.tests && original.noSkips };
    } finally { rmSync(restored, { recursive: true, force: true }); }
  });
}

export async function grade(id, run) {
  const canonical = join(bench, 'fixtures', id); const source = id === 'fetch-lifecycle' ? 'src/index.ts' : 'index.js';
  const checks = [];
  const check = async (name, body) => { try { await body(); checks.push({ name, pass: true }); }
    catch (error) { checks.push({ name, pass: false, detail: String(error.message).slice(0, 400) }); } };
  await check('existing assets unchanged and smoke tests pass', () => {
    for (const p of files(canonical).filter(p => p !== source)) {
      assert.equal(lstatSync(join(run, p)).isSymbolicLink(), false); assert.deepEqual(readFileSync(join(run, p)), readFileSync(join(canonical, p)));
    }
    assert.equal(lstatSync(join(run, source)).isSymbolicLink(), false);
    const smoke = testRun(run, ['test.mjs']); assert.equal(smoke.completed && smoke.passed && smoke.tests && smoke.noSkips, true);
  });
  try {
    // Grade in a subprocess: an implementation that exits early cannot exit this grader with 0.
    const result = spawnSync(process.execPath, [join(bench, 'verifiers/probe.mjs'), id, run], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.error == null && result.signal == null && result.status === 0, true, 'runtime probe did not complete');
    const summary = JSON.parse((result.stdout ?? '').trim().split('\n').at(-1));
    const names = checksFor(id, undefined).map(([name]) => name);
    assert.deepEqual(summary.checks?.map(c => c.name), names, 'runtime probe omitted checks');
    assert.ok(summary.checks.every(c => typeof c.pass === 'boolean'));
    checks.push(...summary.checks);
  } catch (error) { checks.push({ name: 'runtime probe completeness', pass: false, detail: error.message }); }
  let evidence = [];
  await check('new regression passes fixed code and fails restored original', () => {
    evidence = regressionEvidence(run, canonical, source); assert.ok(evidence.some(row => row.finalPassed && row.originalFailed));
  });
  const count = checks.filter(c => c.pass).length; const passed = count === checks.length;
  console.log(JSON.stringify({ score: count / checks.length, passed, checks, evidence }));
  return passed;
}
