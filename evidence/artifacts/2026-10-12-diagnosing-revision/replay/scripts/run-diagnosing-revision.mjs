// Live experiment entry point. Never imported by the offline test suite.
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { runEval } from '../dist/commands/eval.js';
import { runBenchCheck } from '../dist/commands/bench.js';
import { collectInstalledSkillTarget } from '../dist/harness/installed-skill.js';
import { loadBench } from '../dist/harness/bench.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: {
  phase: { type: 'string', default: 'plan' },
  'runs-root': { type: 'string', default: join(tmpdir(), 'skillfit-diagnosing-revision-20261012') },
  'run-group': { type: 'string' },
} });
if (!['plan', 'calibration', 'validation'].includes(values.phase)) throw new Error('phase must be plan, calibration or validation');
const declaration = JSON.parse(readFileSync(join(root, 'evidence/plans/2026-10-12-diagnosing-revision.json'), 'utf8'));
const runsRoot = resolve(values['runs-root']);
const bench = join(root, declaration.bench.path);
const baselineSkillPath = join(root, declaration.baseline.path);
const skillPath = join(root, declaration.treatment.path);
for (const [path, expected] of [[baselineSkillPath, declaration.baseline.sha256], [skillPath, declaration.treatment.sha256]]) {
  if (collectInstalledSkillTarget(path).sha256 !== expected) throw new Error('Declared Skill input changed; create a new declaration instead of reusing this study.');
}
if (loadBench(bench).contentSha256 !== declaration.bench.sha256) throw new Error('Declared bench changed; create a new declaration.');
const dryRun = values.phase === 'plan';
if (dryRun || values.phase === 'calibration') {
  const report = await runBenchCheck({ dir: bench, calibrate: {
    agent: 'codex', inputMode: 'workspace', trials: declaration.calibration.trials,
    maxCalls: declaration.calibration.calls, dryRun, runsRoot,
    runGroup: values['run-group'] ?? 'calibration-20261012',
  } });
  if (report.failures > 0) throw new Error('Bench/calibration failed; retain its records and declare a fresh run after repair.');
}
if (dryRun || values.phase === 'validation') {
  await runEval({ skillPath, baselineSkillPath, bench, mode: 'installed', agent: 'codex',
    trials: declaration.validation.trials, maxCalls: declaration.validation.calls,
    judgeExecutor: null, dryRun, yes: true, runsRoot,
    runGroup: values['run-group'] ?? 'validation-20261012',
  });
}
