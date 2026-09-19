import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { MockExecutor } from '../harness/executors/mock.js';
import { runEval } from './eval.js';

const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BUNDLED_CODE_REVIEW = join(PACKAGE_ROOT, 'benches', 'code-review');

function tmp(t: import('node:test').TestContext, prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function makeSkill(t: import('node:test').TestContext): string {
  const dir = tmp(t, 'skillfit-skill-');
  mkdirSync(join(dir, 'refs'), { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), '# review discipline\n');
  writeFileSync(join(dir, 'refs', 'checklist.yaml'), '- boundaries\n');
  return dir;
}

function collector(): { lines: string[]; log: (msg: string) => void } {
  const lines: string[] = [];
  return { lines, log: (msg: string) => lines.push(msg) };
}

test('runEval --dry-run prints the plan and writes nothing', async (t) => {
  const runsRoot = join(tmp(t, 'skillfit-eval-'), 'runs');
  const { lines, log } = collector();
  const result = await runEval({
    skillPath: makeSkill(t),
    bench: BUNDLED_CODE_REVIEW,
    trials: 3,
    dryRun: true,
    yes: true,
    executor: new MockExecutor(),
    runsRoot,
    runGroup: 'dry-group',
    log,
  });
  assert.equal(result, null);
  assert.ok(!existsSync(runsRoot));
  const output = lines.join('\n');
  assert.match(output, /Experiment plan \(dry run\)/);
  assert.match(output, /Skill\s+: .* \(2 files, bundle sha256 [0-9a-f]{12}/);
  assert.match(output, /Bench\s+: code-review/);
  assert.match(output, /review-r1: fixture fixtures\/review-r1, verifier `node verifiers\/seeded-bugs\.mjs`/);
  assert.match(output, /3 task\(s\) × 2 conditions × 3 = 18 runs/);
  assert.match(output, /Dry run — nothing was written\./);
});

test('runEval runs the experiment and prints the summary table', async (t) => {
  const runsRoot = tmp(t, 'skillfit-eval-');
  const { lines, log } = collector();
  const manifest = await runEval({
    skillPath: makeSkill(t),
    bench: BUNDLED_CODE_REVIEW,
    trials: 3,
    dryRun: false,
    yes: true,
    executor: new MockExecutor(),
    runsRoot,
    runGroup: 'eval-group',
    log,
  });
  assert.ok(manifest);
  assert.equal(manifest.overall.verdict, 'effective');
  assert.ok(existsSync(join(runsRoot, 'eval-group', 'manifest.json')));
  const output = lines.join('\n');
  assert.match(output, /review-r1\s+0\/3 \(0%\)\s+3\/3 \(100%\)\s+\+100pp\s+inconclusive/);
  assert.match(output, /Token delta \(treatment - baseline\)/);
  assert.match(output, /Manifest: .*eval-group.*manifest\.json/);
});

test('runEval resolves the bundled bench when --bench is omitted', async (t) => {
  const runsRoot = tmp(t, 'skillfit-eval-');
  const manifest = await runEval({
    skillPath: makeSkill(t),
    trials: 1,
    dryRun: false,
    yes: true,
    executor: new MockExecutor(),
    runsRoot,
    runGroup: 'default-bench-group',
    log: () => {},
  });
  assert.equal(manifest?.bench.name, 'code-review');
});

test('runEval rejects unknown agents before running anything', async (t) => {
  const runsRoot = tmp(t, 'skillfit-eval-');
  await assert.rejects(
    () =>
      runEval({
        skillPath: makeSkill(t),
        bench: BUNDLED_CODE_REVIEW,
        trials: 3,
        dryRun: false,
        yes: true,
        agent: 'not-an-agent',
        runsRoot,
        runGroup: 'g',
        log: () => {},
      }),
    /Unknown agent/,
  );
  assert.ok(!existsSync(join(runsRoot, 'g')));
});

test('runEval without --agent requires an API key', async (t) => {
  const saved = {
    SKILLFIT_API_KEY: process.env['SKILLFIT_API_KEY'],
    OPENAI_API_KEY: process.env['OPENAI_API_KEY'],
  };
  delete process.env['SKILLFIT_API_KEY'];
  delete process.env['OPENAI_API_KEY'];
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  await assert.rejects(
    () =>
      runEval({
        skillPath: makeSkill(t),
        bench: BUNDLED_CODE_REVIEW,
        trials: 3,
        dryRun: false,
        yes: true,
        runsRoot: tmp(t, 'skillfit-eval-'),
        runGroup: 'g',
        log: () => {},
      }),
    /API key/,
  );
});

test('runEval --dry-run tolerates missing executor credentials', async (t) => {
  const saved = {
    SKILLFIT_API_KEY: process.env['SKILLFIT_API_KEY'],
    OPENAI_API_KEY: process.env['OPENAI_API_KEY'],
  };
  delete process.env['SKILLFIT_API_KEY'];
  delete process.env['OPENAI_API_KEY'];
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const runsRoot = join(tmp(t, 'skillfit-eval-'), 'runs');
  const { lines, log } = collector();
  const result = await runEval({
    skillPath: makeSkill(t),
    bench: BUNDLED_CODE_REVIEW,
    trials: 3,
    dryRun: true,
    yes: true,
    runsRoot,
    runGroup: 'dry-group',
    log,
  });
  assert.equal(result, null);
  assert.ok(!existsSync(runsRoot));
  assert.match(lines.join('\n'), /Executor : unresolved/);
});

test('runEval rejects bad trials values', async (t) => {
  await assert.rejects(
    () =>
      runEval({
        skillPath: makeSkill(t),
        bench: BUNDLED_CODE_REVIEW,
        trials: 0,
        dryRun: true,
        yes: true,
        executor: new MockExecutor(),
        runsRoot: tmp(t, 'skillfit-eval-'),
        runGroup: 'g',
        log: () => {},
      }),
    /--trials must be/,
  );
});
