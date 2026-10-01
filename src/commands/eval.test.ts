import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { MockExecutor } from '../harness/executors/mock.js';
import type { Executor } from '../harness/types.js';
import { runEval } from './eval.js';

const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BUNDLED_CODE_REVIEW = join(PACKAGE_ROOT, 'benches', 'code-review');
const BUNDLED_DEBUGGING = join(PACKAGE_ROOT, 'benches', 'debugging');

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

function makeConfigExperiment(
  t: import('node:test').TestContext,
  kind: 'rules' | 'mcp',
  projectFile: string,
): string {
  const dir = tmp(t, 'skillfit-config-');
  const treatmentFile = join(dir, 'treatment', ...projectFile.split('/'));
  mkdirSync(join(treatmentFile, '..'), { recursive: true });
  writeFileSync(treatmentFile, kind === 'mcp' ? '[mcp_servers.demo]\ncommand = "demo"\n' : '# project rules\n');
  writeFileSync(
    join(dir, 'skillfit-experiment.json'),
    JSON.stringify({ schemaVersion: 1, name: `demo-${kind}`, kind, treatment: 'treatment' }),
  );
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
  assert.match(output, /Target\s+: .* \(skill, 2 files, bundle sha256 [0-9a-f]{12}/);
  assert.match(output, /Bench\s+: code-review/);
  assert.match(output, /review-r1: fixture fixtures\/review-r1, verifier `node verifiers\/seeded-bugs\.mjs`/);
  assert.match(output, /5 task\(s\) × 2 conditions × 3 = 30 runs/);
  assert.match(output, /Scale\s+: below 8 tasks × 5 trials per condition/);
  assert.match(output, /Est\. cost: ~[\d.k]+ prompt-tokens\/run baseline, ~[\d.k]+ treatment \(estimate, before replies\)/);
  assert.match(output, /Dry run — nothing was written\./);
});

test('workspace dry-run reports disk presentation and only estimates the initial prompt', async (t) => {
  const runsRoot = join(tmp(t, 'skillfit-workspace-plan-'), 'runs');
  const { lines, log } = collector();
  await runEval({ skillPath: makeSkill(t), bench: BUNDLED_CODE_REVIEW, inputMode: 'workspace',
    dryRun: true, yes: true, executor: new MockExecutor(), runsRoot, log });
  assert.match(lines.join('\n'), /workspace files on disk \(no inline repository snapshot\)/);
  assert.match(lines.join('\n'), /initial prompt only; agent file reads and replies are not estimated/);
  assert.ok(!existsSync(runsRoot));
});

test('workspace API and explicit trigger input combinations fail before writing', async (t) => {
  const runsRoot = join(tmp(t, 'skillfit-invalid-input-'), 'runs');
  const base = { skillPath: makeSkill(t), bench: BUNDLED_CODE_REVIEW, yes: true, runsRoot, log: () => {} };
  const executor: Executor = { describe: () => ({ kind: 'api', model: 'offline' }), run: () => { throw new Error('must not run'); } };
  for (const dryRun of [true, false]) {
    await assert.rejects(() => runEval({ ...base, dryRun, inputMode: 'workspace', executor }), /requires a CLI executor/);
    for (const inputMode of ['workspace', 'snapshot'] as const) {
      await assert.rejects(() => runEval({ ...base, dryRun, mode: 'trigger', inputMode, executor: new MockExecutor() }), /applies only to paired inject mode/);
    }
  }
  assert.ok(!existsSync(runsRoot));
});

test('workspace without a CLI rejects dry/live plans independently of API credentials', async (t) => {
  const runsRoot = join(tmp(t, 'skillfit-no-cli-'), 'runs');
  const base = { skillPath: makeSkill(t), bench: BUNDLED_CODE_REVIEW, yes: true, runsRoot, log: () => {} };
  const saved = process.env['SKILLFIT_API_KEY'];
  try {
    for (const key of [undefined, 'offline-test-key']) {
      if (key === undefined) delete process.env['SKILLFIT_API_KEY'];
      else process.env['SKILLFIT_API_KEY'] = key;
      for (const dryRun of [true, false]) {
        await assert.rejects(() => runEval({ ...base, dryRun, inputMode: 'workspace' }), /requires --agent.*CLI executor/);
      }
    }
  } finally {
    if (saved === undefined) delete process.env['SKILLFIT_API_KEY'];
    else process.env['SKILLFIT_API_KEY'] = saved;
  }
  assert.ok(!existsSync(runsRoot));
});

test('runEval defaults to five trials in paired and trigger plans without running an agent', async (t) => {
  const runsRoot = join(tmp(t, 'skillfit-eval-'), 'runs');
  for (const mode of ['inject', 'trigger'] as const) {
    const { lines, log } = collector();
    const result = await runEval({
      skillPath: makeSkill(t),
      bench: BUNDLED_DEBUGGING,
      mode,
      dryRun: true,
      yes: false,
      executor: new MockExecutor(),
      runsRoot,
      runGroup: `default-${mode}`,
      log,
    });
    assert.equal(result, null);
    assert.match(lines.join('\n'), mode === 'inject'
      ? /8 task\(s\) × 2 conditions × 5 = 80 runs/
      : /Trials\s+: 5 per task \(single arm: skill installed\)/);
  }
  assert.ok(!existsSync(runsRoot));
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
  assert.ok(manifest && 'overall' in manifest);
  // summarize-s1 is a negative control whose mock treatment arm fails, so the pooled mock run is
  // 9 improved against 3 regressed — not significant at this sample size.
  assert.equal(manifest.overall.verdict, 'inconclusive');
  assert.ok(existsSync(join(runsRoot, 'eval-group', 'manifest.json')));
  const output = lines.join('\n');
  assert.match(output, /review-r1\s+0\/3 \(0%\)\s+3\/3 \(100%\)\s+\+100pp\s+inconclusive/);
  assert.match(output, /Token delta \(treatment - baseline\)/);
  assert.match(output, /Manifest: .*eval-group.*manifest\.json/);
});

test('runEval requires --bench when several bundled benches exist, and resolves one by name', async (t) => {
  const runsRoot = tmp(t, 'skillfit-eval-');
  await assert.rejects(
    () =>
      runEval({
        skillPath: makeSkill(t),
        trials: 1,
        dryRun: false,
        yes: true,
        executor: new MockExecutor(),
        runsRoot: join(runsRoot, 'a'),
        runGroup: 'omitted-bench-group',
        log: () => {},
      }),
    /pick one explicitly/,
  );
  const manifest = await runEval({
    skillPath: makeSkill(t),
    bench: 'code-review',
    trials: 1,
    dryRun: false,
    yes: true,
    executor: new MockExecutor(),
    runsRoot: join(runsRoot, 'b'),
    runGroup: 'by-name-group',
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

test('runEval trigger mode requires --agent', async (t) => {
  await assert.rejects(
    () =>
      runEval({
        skillPath: makeSkill(t),
        bench: BUNDLED_CODE_REVIEW,
        trials: 3,
        mode: 'trigger',
        dryRun: false,
        yes: true,
        runsRoot: tmp(t, 'skillfit-eval-'),
        runGroup: 'g',
        log: () => {},
      }),
    /trigger mode requires --agent/,
  );
});

test('runEval trigger mode dry-run prints the install plan and writes nothing', async (t) => {
  const runsRoot = join(tmp(t, 'skillfit-eval-'), 'runs');
  const { lines, log } = collector();
  const result = await runEval({
    skillPath: makeSkill(t),
    bench: BUNDLED_CODE_REVIEW,
    trials: 3,
    mode: 'trigger',
    agent: 'kimi-code',
    dryRun: true,
    yes: true,
    runsRoot,
    runGroup: 'trigger-dry',
    log,
  });
  assert.equal(result, null);
  assert.ok(!existsSync(runsRoot));
  const output = lines.join('\n');
  assert.match(output, /Trigger experiment plan \(dry run\)/);
  assert.match(output, /installed into \.kimi-code\/skills/);
  assert.match(output, /review-r1: should trigger/);
  assert.match(output, /explain-x1: should NOT trigger \(negative control\)/);
});

test('runEval --judge-agent plans a CLI judge and warns on same-family judging', async (t) => {
  const runsRoot = join(tmp(t, 'skillfit-eval-'), 'runs');
  const { lines, log } = collector();
  const result = await runEval({
    skillPath: makeSkill(t),
    bench: 'code-review',
    trials: 1,
    agent: 'kimi-code',
    judgeAgent: 'kimi-code',
    dryRun: true,
    yes: true,
    runsRoot,
    runGroup: 'judge-dry',
    log,
  });
  assert.equal(result, null);
  const output = lines.join('\n');
  assert.match(output, /Judge\s+: cli \(cli-configured\)/);
  assert.match(output, /self-preference bias risk/);
});

test('runEval without --judge-agent keeps the judge disabled by default', async (t) => {
  const saved = process.env['SKILLFIT_JUDGE'];
  delete process.env['SKILLFIT_JUDGE'];
  t.after(() => {
    if (saved === undefined) delete process.env['SKILLFIT_JUDGE'];
    else process.env['SKILLFIT_JUDGE'] = saved;
  });
  const { lines, log } = collector();
  await runEval({
    skillPath: makeSkill(t),
    bench: 'code-review',
    trials: 1,
    executor: new MockExecutor(),
    dryRun: true,
    yes: true,
    runsRoot: join(tmp(t, 'skillfit-eval-'), 'runs'),
    runGroup: 'no-judge-dry',
    log,
  });
  assert.match(lines.join('\n'), /Judge\s+: disabled/);
});

function apiLikeExecutor(): Executor {
  return {
    describe: () => ({ kind: 'api', model: 'gpt-test' }),
    run: (): Promise<{ output: string }> => Promise.resolve({ output: 'never used' }),
  };
}

test('runEval refuses an API executor against a command-graded bench', async (t) => {
  const runsRoot = tmp(t, 'skillfit-eval-b8-');
  await assert.rejects(
    runEval({
      skillPath: makeSkill(t),
      bench: BUNDLED_DEBUGGING,
      trials: 1,
      dryRun: false,
      yes: true,
      executor: apiLikeExecutor(),
      runsRoot,
      runGroup: 'b8-group',
      log: () => {},
    }),
    /graded by running a command inside the run directory/,
  );
  assert.ok(
    !existsSync(join(runsRoot, 'b8-group')),
    'the mismatch is caught at plan time, so no run directory is created',
  );
});

test('runEval surfaces the API/command-bench mismatch during --dry-run too', async (t) => {
  await assert.rejects(
    runEval({
      skillPath: makeSkill(t),
      bench: BUNDLED_DEBUGGING,
      trials: 1,
      dryRun: true,
      yes: true,
      executor: apiLikeExecutor(),
      runsRoot: join(tmp(t, 'skillfit-eval-b8dry-'), 'runs'),
      runGroup: 'b8-dry-group',
      log: () => {},
    }),
    /Use --agent <id> for a CLI executor/,
  );
});

test('runEval allows an API executor against an output-graded bench', async (t) => {
  const result = await runEval({
    skillPath: makeSkill(t),
    bench: BUNDLED_CODE_REVIEW,
    trials: 1,
    dryRun: true,
    yes: true,
    executor: apiLikeExecutor(),
    runsRoot: join(tmp(t, 'skillfit-eval-b8ok-'), 'runs'),
    runGroup: 'b8-ok-group',
    log: () => {},
  });
  assert.equal(result, null, 'a dry run plans without throwing');
});

test('runEval plans a first-class MCP workspace experiment for the selected agent', async (t) => {
  const { lines, log } = collector();
  const result = await runEval({
    skillPath: makeConfigExperiment(t, 'mcp', '.codex/config.toml'),
    bench: 'code-review',
    trials: 2,
    agent: 'codex',
    dryRun: true,
    yes: true,
    runsRoot: join(tmp(t, 'skillfit-mcp-eval-'), 'runs'),
    runGroup: 'mcp-dry',
    log,
  });
  assert.equal(result, null);
  const output = lines.join('\n');
  assert.match(output, /Target\s+: demo-mcp \(mcp,/);
  assert.match(output, /applied as project files; treatment material is never injected/);
  assert.match(output, /trusts each disposable project for config loading/);
  assert.match(output, /5 task\(s\) × 2 conditions × 2 = 20 runs/);
});

test('runEval rejects mismatched matrix paths and API-only config experiments', async (t) => {
  await assert.rejects(
    runEval({
      skillPath: makeConfigExperiment(t, 'mcp', '.wrong/config.json'),
      bench: 'code-review',
      trials: 1,
      agent: 'codex',
      dryRun: true,
      yes: true,
      runGroup: 'wrong-path',
      log: () => {},
    }),
    /matrix-defined project files: \.codex\/config\.toml/,
  );
  await assert.rejects(
    runEval({
      skillPath: makeConfigExperiment(t, 'rules', 'AGENTS.md'),
      bench: 'code-review',
      trials: 1,
      dryRun: true,
      yes: true,
      executor: apiLikeExecutor(),
      runsRoot: join(tmp(t, 'skillfit-rules-api-'), 'runs'),
      runGroup: 'rules-api',
      log: () => {},
    }),
    /rules experiments require a CLI executor/,
  );
});

test('runEval rejects config overlays that could modify the task fixture', async (t) => {
  const experiment = makeConfigExperiment(t, 'mcp', '.codex/config.toml');
  mkdirSync(join(experiment, 'treatment', 'src'), { recursive: true });
  writeFileSync(join(experiment, 'treatment', 'src', 'solution.js'), 'export const answer = 42;\n');
  await assert.rejects(
    runEval({
      skillPath: experiment,
      bench: 'code-review',
      trials: 1,
      agent: 'codex',
      dryRun: true,
      yes: true,
      runGroup: 'unsafe-overlay',
      log: () => {},
    }),
    /may contain only matrix-defined project config files.*unexpected: src\/solution\.js/,
  );
});
