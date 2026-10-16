import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// Usage: node 0.11.0-feature-smoke.mjs <installed-or-extracted-package> <fresh-output-parent>
// No real agent, model API or login probe is used. The package path is supplied
// by the caller; this check alone does not establish registry publication.
assert.equal(process.argv.length, 4, 'Provide a package directory and a fresh output parent.');
const installed = resolve(process.argv[2]), parent = resolve(process.argv[3]);
const insidePackage = relative(installed, parent);
assert.ok(isAbsolute(insidePackage) || insidePackage.startsWith(`..${sep}`) || insidePackage === '..', 'Keep smoke output outside the installed package.');
assert.equal(existsSync(parent), false, 'The output parent must be fresh; prior smoke receipts are never overwritten.');
assert.equal(JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8')).version, '0.11.0');
mkdirSync(parent, { recursive: true });
const root = mkdtempSync(join(parent, 'offline-foundations-'));
const home = join(root, 'home'), runsRoot = join(root, 'runs');
mkdirSync(home);
const load = file => import(pathToFileURL(join(installed, 'dist', file)).href);
const { runBenchInit, runBenchCalibration } = await load('commands/bench.js');
const { runEval } = await load('commands/eval.js');
const { runEvalCli } = await load('commands/eval-cli.js');
const { readEvaluationReport } = await load('commands/evaluation-report.js');
const { exportEvaluation } = await load('commands/eval-export.js');
const { packageFiles } = await load('harness/replay-package.js');
const { sha256File, hashFileSet, listFilesRecursive } = await load('harness/hash.js');

// Public CLI previews have an empty PATH. Fake-executor runs and replay need
// only Node's directory to execute the package's trusted fixture programs.
// Every child receives isolated homes and no API/judge credentials.
const originalEnvironment = { ...process.env }, originalFetch = globalThis.fetch;
for (const key of Object.keys(process.env)) {
  if (key.toUpperCase() === 'PATH' || /^(SKILLFIT_|OPENAI_|ANTHROPIC_)/.test(key)) delete process.env[key];
}
Object.assign(process.env, { PATH: dirname(process.execPath), HOME: home, USERPROFILE: home, CODEX_HOME: join(home, 'codex'), SKILLFIT_JUDGE: '0' });
const env = { ...process.env, PATH: '' }, replayEnv = { ...process.env };
let networkAttempts = 0, skillfitCliCalls = 0;
globalThis.fetch = async () => { networkAttempts++; throw new Error('Network calls are forbidden in this offline smoke.'); };
const counts = { calibrationHardFailure: 0, calibration: 0, pairedAgent: 0, judge: 0, triggerLine: 0, triggerPartial: 0, triggerUnknown: 0 };
const checks = {}, tests = {};
const final = { output: 'skillfit-ok', tokens: { input: 10, cachedInput: 2, output: 3 }, usageStatus: 'final' };
const limits = { input: 1000, cachedInput: 1000, uncachedInput: 1000, output: 1000, durationSeconds: 1000 };
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const quiet = () => {};
const fake = (name, response) => ({
  describe: () => ({ kind: 'stub', model: `offline-smoke-${name}` }),
  run: async () => { counts[name]++; return typeof response === 'function' ? response() : structuredClone(response); },
});
const cli = (args, expected = 0) => {
  skillfitCliCalls++;
  const child = spawnSync(process.execPath, [join(installed, 'dist/cli.js'), ...args],
    { cwd: root, env, encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  assert.equal(child.status, expected, child.stderr || child.stdout);
  return child;
};
const noAdoption = report => {
  assert.notEqual(report.acceptance.decision, 'accept');
  assert.equal(report.acceptance.eligibleForUpgrade, false);
  assert.equal(report.acceptance.automaticUpgrade, false);
};
const snapshotCosts = report => JSON.parse(JSON.stringify({
  costs: report.costs ?? null, invocationCosts: report.invocationCosts ?? null,
  usage: report.usage ?? null, spendingBudget: report.spendingBudget ?? null,
}));
const ledger = run => readFileSync(join(run, '_calls.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
const files = run => packageFiles(run).map(file => [file, sha256File(join(run, file))]);
const fixture = async (name, kind = 'output', sentinel = null) => {
  const bench = join(root, name);
  await runBenchInit({ dir: bench, kind, yes: true, log: quiet });
  const file = join(bench, 'bench.json'), definition = json(file);
  definition.tasks[0].shouldTrigger = true;
  definition.tasks[0].triggerClass = 'explicit';
  definition.tasks.push({ ...definition.tasks[0], id: 'negative-task', shouldTrigger: false, triggerClass: undefined });
  if (sentinel) for (const script of ['verifiers/example-task.mjs', 'ground-truth/oracle-example-task.mjs']) {
    writeFileSync(join(bench, script), `import{writeFileSync as markProbe}from'node:fs';markProbe(${JSON.stringify(sentinel)},'unexpected');\n` + readFileSync(join(bench, script), 'utf8'));
  }
  writeFileSync(file, JSON.stringify(definition));
  return bench;
};

try {
  assert.equal(cli(['--version']).stdout.trim(), '0.11.0');
  const help = cli(['--help']).stdout;
  for (const flag of ['--plan-sha', '--task', '--spending-budget', '--executor-timeout-seconds', '--runs-root', '--export']) assert.ok(help.includes(flag));
  checks.versionAndPublicFlags = true;

  const skill = join(root, 'skill'); mkdirSync(skill);
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: smoke-skill\ndescription: Synthetic offline release workflow check.\n---\nInspect the task and return the answer.\n');
  const sentinel = join(root, 'unexpected-preview-probe'), previewBench = await fixture('preview-bench', 'output', sentinel);
  const settings = ['--agent', 'codex', '--trials', '1', '--executor-timeout-seconds', '17', '--runs-root', join(root, 'preview-runs'), '--json', '--dry-run'];
  const previewRows = [
    ['paired', ['eval', skill, '--mode', 'installed', '--bench', previewBench, '--task', 'example-task', '--max-calls', '2', '--run-group', 'preview-paired']],
    ['calibration', ['bench', 'check', previewBench, '--calibrate', '--task', 'example-task', '--max-calls', '1', '--input', 'workspace', '--run-group', 'preview-calibration']],
    ['trigger', ['eval', skill, '--mode', 'trigger', '--bench', previewBench, '--task', 'example-task', '--task', 'negative-task', '--max-calls', '2', '--run-group', 'preview-trigger']],
  ];
  for (const [mode, args] of previewRows) {
    const child = cli([...args, ...settings]);
    const report = JSON.parse(child.stdout), plan = report.plan, evaluation = plan.evaluation ?? plan;
    assert.equal(report.status, 'planned'); noAdoption(report);
    assert.equal(evaluation.agentPreflight.status, 'blocked');
    assert.ok(evaluation.agentPreflight.checks.some(check => check.code === 'CLI_AVAILABLE' && check.status === 'FAIL'));
    assert.ok(evaluation.agentPreflight.checks.some(check => check.code === 'AUTHENTICATION' && check.status === 'UNKNOWN'));
    assert.deepEqual(evaluation.agentPreflight.cost, { modelCalls: 0, cliInvocations: 0 });
    assert.equal(evaluation.executorTimeoutSeconds, 17);
    assert.equal(evaluation.plannedCalls, mode === 'calibration' ? 1 : 2);
    tests[`${mode}PublicPreview`] = { status: report.status, plannedCalls: evaluation.plannedCalls, environment: 'blocked', authentication: 'UNKNOWN', modelCalls: 0, agentCliCalls: 0 };
  }
  assert.equal(existsSync(sentinel), false); assert.equal(existsSync(join(root, 'preview-runs')), false);
  assert.equal(Object.values(counts).reduce((sum, value) => sum + value, 0), 0);
  checks.publicPreviewsArePureWithoutAgentCli = true;

  const broken = await fixture('broken-command-bench', 'command');
  writeFileSync(join(broken, 'verifiers/example-task.mjs'), 'process.exit(0);\n');
  await assert.rejects(runBenchCalibration({ dir: broken, taskIds: ['example-task'], log: quiet,
    calibrate: { executor: fake('calibrationHardFailure', final), trials: 1, maxCalls: 1, runsRoot, runGroup: 'blocked-calibration' } }),
  error => error.name === 'CasePreflightFailed' && error.preflight.checks.some(check => check.code === 'UNTOUCHED_FIXTURE' && check.status === 'FAIL'));
  assert.equal(counts.calibrationHardFailure, 0); assert.equal(existsSync(join(runsRoot, 'blocked-calibration')), false);
  tests.calibrationHardFailure = { gate: 'UNTOUCHED_FIXTURE', fakeCalls: 0, nativeRunCreated: false, modelCalls: 0 };
  checks.calibrationHardFailurePreventsSpending = true;

  const bench = await fixture('bench'), originals = [];
  await runBenchCalibration({ dir: bench, taskIds: ['example-task'], log: quiet,
    calibrate: { executor: fake('calibration', final), trials: 1, maxCalls: 1, spendingBudget: limits, runsRoot, runGroup: 'calibration' } });
  assert.equal(counts.calibration, 1);
  originals.push({ name: 'calibration', mode: 'calibration', run: join(runsRoot, 'calibration'), calls: 1 });

  const checklist = JSON.stringify({ A: { correct: true, complete: true, grounded: true }, B: { correct: true, complete: true, grounded: true } });
  await runEval({ skillPath: skill, bench, taskIds: ['example-task'], trials: 1, maxCalls: 4,
    executor: fake('pairedAgent', final), judgeExecutor: fake('judge', { output: checklist, rawOutput: 'offline judge transcript', tokens: { input: 5, cachedInput: 1, output: 2 }, usageStatus: 'final' }),
    spendingBudget: limits, yes: true, dryRun: false, runsRoot, runGroup: 'paired-judge', log: quiet });
  assert.equal(counts.pairedAgent, 2); assert.equal(counts.judge, 2);
  const pairedRun = join(runsRoot, 'paired-judge'), paired = await readEvaluationReport(pairedRun);
  assert.equal(paired.invocationCosts.agent.runs, 2); assert.equal(paired.invocationCosts.judge.runs, 2); assert.equal(paired.invocationCosts.total.runs, 4);
  assert.equal(paired.invocationCosts.agent.metrics.input.knownTotal, 20); assert.equal(paired.invocationCosts.judge.metrics.input.knownTotal, 10);
  assert.equal(paired.invocationCosts.total.metrics.input.knownTotal, 30); assert.equal(paired.invocationCosts.total.metrics.cachedInput.knownTotal, 6);
  assert.equal(paired.invocationCosts.total.metrics.uncachedInput.knownTotal, 24); assert.equal(paired.invocationCosts.total.metrics.output.knownTotal, 10);
  for (const metric of ['input', 'cachedInput', 'uncachedInput', 'output', 'durationSeconds']) assert.equal(paired.invocationCosts.total.metrics[metric].coverage.final, 4);
  assert.equal(ledger(pairedRun).filter(event => event.event === 'started').length, 4);
  for (const index of [1, 2]) assert.equal(json(join(pairedRun, `example-task/judge-trial-1/call-${index}.json`)).usageStatus, 'final');
  tests.pairedJudge = { fakeAgentCalls: 2, fakeJudgeCalls: 2, totalCalls: 4, invocationCosts: paired.invocationCosts, modelCalls: 0 };
  checks.judgeBothOrdersRetainCompleteRoleAndTotalCosts = true;
  originals.push({ name: 'paired-judge', mode: 'paired', run: pairedRun, calls: 4 });

  for (const [name, counter, response, expected] of [
    ['trigger-line', 'triggerLine', { ...final, skillTriggered: true }, 'SPENDING_BUDGET_REACHED'],
    ['trigger-partial', 'triggerPartial', { output: final.output, skillTriggered: true, tokens: { input: 7, output: 2 }, usageStatus: 'partial' }, 'FINAL_USAGE_MISSING'],
    ['trigger-unknown', 'triggerUnknown', { output: final.output, skillTriggered: true, usageStatus: 'unknown' }, 'FINAL_USAGE_MISSING'],
  ]) {
    const options = { skillPath: skill, bench, taskIds: ['example-task'], mode: 'trigger', skillInstallDir: '.offline-skills',
      executor: fake(counter, response), judgeExecutor: null, trials: 3, maxCalls: 3, spendingBudget: { ...limits, input: name === 'trigger-line' ? 10 : 1000 },
      yes: true, runsRoot, runGroup: name, log: quiet };
    const preview = await runEvalCli({ ...options, dryRun: true });
    assert.equal(counts[counter], 0);
    const report = await runEvalCli({ ...options, dryRun: false }, preview.plan.sha256);
    assert.equal(report.status, 'stopped'); assert.equal(report.evaluationType, 'trigger'); assert.equal(counts[counter], 1); noAdoption(report);
    const run = join(runsRoot, name), session = json(join(run, '_session.json'));
    assert.equal(session.callsStarted, 1); assert.equal(session.stopCode, expected);
    assert.equal(ledger(run).filter(event => event.event === 'started').length, 1);
    assert.equal(existsSync(join(run, 'example-task/installed/trial-2')), false);
    assert.equal(report.usage.runs, 1);
    if (name === 'trigger-line') assert.equal(report.usage.metrics.input.knownTotal, 10);
    else {
      assert.equal(report.usage.metrics.cachedInput.coverage.unknown, 1);
      assert.equal(report.usage.metrics.input.coverage[name === 'trigger-partial' ? 'partial' : 'unknown'], 1);
    }
    tests[name] = { status: report.status, stopCode: session.stopCode, fakeCalls: 1, usage: report.usage, modelCalls: 0 };
    originals.push({ name, mode: 'trigger', run, calls: 1 });
  }
  checks.triggerBudgetAndIncompleteUsageStopWithoutRetries = true;

  for (const item of originals) {
    item.report = await readEvaluationReport(item.run); noAdoption(item.report);
    assert.equal(item.report.evidence.verified, true, JSON.stringify(item.report.evidence));
    item.costs = snapshotCosts(item.report); item.nativeFiles = files(item.run);
  }
  const frozenCounts = structuredClone(counts);
  rmSync(bench, { recursive: true }); rmSync(skill, { recursive: true });
  for (const item of originals) {
    const output = join(root, `export-${item.name}`), moved = join(root, `moved ${item.name}`);
    const plan = await exportEvaluation(item.run, output, { log: quiet });
    assert.equal(plan.status, 'planned'); assert.equal(plan.inputSource, 'sealed-snapshot'); assert.equal(existsSync(output), false);
    await exportEvaluation(item.run, output, { yes: true, log: quiet });
    assert.deepEqual(files(item.run), item.nativeFiles, 'Export must preserve original native evidence.');
    renameSync(output, moved); rmSync(item.run, { recursive: true });
    const reproduce = args => {
      const child = spawnSync(process.execPath, [join(moved, 'reproduce.mjs'), ...args], { cwd: root, env: replayEnv, encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
      assert.equal(child.status, 0, child.stderr || child.stdout); return JSON.parse(child.stdout);
    };
    assert.equal(reproduce(['--verify-only']).modelCalls, 0);
    const replayed = reproduce([]);
    assert.equal(replayed.evidence.verified, true, JSON.stringify(replayed.evidence)); assert.equal(replayed.status, item.report.status);
    assert.deepEqual(snapshotCosts(replayed), item.costs); noAdoption(replayed);
    assert.equal(replayed.portableReplay.modelCalls, 0); assert.deepEqual(counts, frozenCounts);
    // The public report also regrades trusted Node verifiers, so it receives
    // the replay environment rather than the empty-PATH preview environment.
    const inspectedChild = spawnSync(process.execPath, [join(installed, 'dist/cli.js'), 'report', 'eval', moved, '--json', '--replay'],
      { cwd: root, env: replayEnv, encoding: 'utf8', timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
    skillfitCliCalls++; assert.equal(inspectedChild.status, 0, inspectedChild.stderr || inspectedChild.stdout);
    const inspected = JSON.parse(inspectedChild.stdout);
    assert.equal(inspected.portablePackage.integrityVerified, true); assert.deepEqual(snapshotCosts(inspected), item.costs); noAdoption(inspected);
    tests[`${item.name}PortableReplay`] = { evaluationType: item.mode, status: replayed.status,
      deletedOriginalInputs: true, deletedOriginalRun: true, movedPackage: true, exactCostsRetained: true,
      retainedCosts: item.costs,
      fakeCallsBeforeReplay: item.calls, additionalFakeCalls: 0, modelCalls: 0, eligibleForUpgrade: false, automaticUpgrade: false };
  }
  checks.allModesMoveDeleteOriginalReplayWithExactCosts = true;
  checks.noAdoptionFromSyntheticOrStoppedEvidence = true;
  assert.equal(networkAttempts, 0); assert.deepEqual(counts, frozenCounts);
  assert.equal(Object.values(counts).reduce((sum, value) => sum + value, 0), 8);
  const receipt = { schemaVersion: 1, kind: 'skillfit.release-foundations-smoke', version: '0.11.0',
    verifiedAt: new Date().toISOString(), nodeVersion: process.version,
    packagePath: installed, implementationSha256: hashFileSet(join(installed, 'dist'), listFilesRecursive(join(installed, 'dist'))),
    scope: 'Offline check of the caller-supplied package; no registry/publication claim or Skill efficacy evidence.',
    modelCalls: 0, agentCliCalls: 0, networkAttempts, skillfitCliCalls,
    syntheticExecutorCalls: Object.values(counts).reduce((sum, value) => sum + value, 0), fakeCallCounts: counts, checks, tests };
  writeFileSync(join(parent, 'feature-smoke.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  rmSync(root, { recursive: true, force: true });
  console.log(JSON.stringify(receipt));
} finally {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
}
