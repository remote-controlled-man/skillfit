import assert from 'node:assert/strict';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { caseNames } from './cases.mjs';
import { files, regressionEvidence, testRun } from './regression-evidence.mjs';
const bench = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const specs = JSON.parse(readFileSync(join(bench, 'task-specs.json'), 'utf8'));
export async function grade(task, supplied) {
  const run = resolve(supplied), canonical = join(bench, 'tasks', task, 'fixture'), spec = specs[task];
  assert.ok(spec, 'unknown task');
  const checks = [];
  const check = (name, operation) => {
    try { operation(); checks.push({ name, pass: true }); }
    catch (error) { checks.push({ name, pass: false, detail: String(error.message).slice(0, 700) }); }
  };
  check('Protected supplied assets and ordinary smoke behavior', () => {
    for (const path of files(canonical).filter(path => !spec.sourcePaths.includes(path))) {
      assert.equal(existsSync(join(run, path)), true, path + ' missing');
      for (const prefix of path.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/'))) assert.equal(lstatSync(join(run, prefix)).isSymbolicLink(), false);
      assert.deepEqual(readFileSync(join(run, path)), readFileSync(join(canonical, path)), path + ' changed');
    }
    for (const path of spec.sourcePaths) if (existsSync(join(run, path))) assert.equal(lstatSync(join(run, path)).isSymbolicLink(), false);
    if (spec.metadataEditable.length) {
      const normalize = directory => { const value = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')); for (const field of spec.metadataEditable) delete value[field]; return value; };
      assert.deepEqual(normalize(run), normalize(canonical), 'Only the declared package metadata fields may change');
    }
    const smoke = testRun(run, ['test.mjs']);
    assert.equal(smoke.completed && smoke.passed && smoke.tests && smoke.noSkips, true, 'protected smoke must complete with registered passing tests');
  });
  for (const [index, name] of caseNames(task).entries()) {
    check(name, () => {
      const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
      const result = spawnSync(process.execPath, [join(bench, 'verifiers/probe.mjs'), task, run, String(index)], { encoding: 'utf8', timeout: 5000, env });
      assert.ok(!result.error && result.signal === null && result.status === 0, result.stderr || 'probe did not complete');
      const value = JSON.parse(result.stdout.trim()); assert.equal(value.name, name); assert.equal(value.pass, true, value.detail);
    });
  }
  let evidence = [];
  check('Submitted regression passes the repair and complete functional upstream fix, and fails the original', () => {
    evidence = regressionEvidence(run, canonical, join(bench, 'tasks', task, 'reference'), spec.sourcePaths);
    assert.ok(evidence.length > 0 && evidence.every(row => row.finalPassed) && evidence.some(row => row.caseWitnesses.length > 0), 'A retained registered regression must distinguish original and full maintainer fix');
  });
  const passed = checks.every(row => row.pass);
  console.log(JSON.stringify({ passed, score: checks.filter(row => row.pass).length / checks.length, checks, evidence }));
  process.exitCode = passed ? 0 : 1;
}
