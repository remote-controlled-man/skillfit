import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { AgentPreflightFailed } from "../agents/preflight.js";
import { runEval, type EvalOptions } from "./eval.js";
import { runEvalCli } from "./eval-cli.js";

const CLI = fileURLToPath(new URL("./main.js", import.meta.url));
function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-workflow-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench'), skill = join(root, 'skill'), home = join(root, 'home');
  for (const dir of [join(bench, 'fixture'), join(skill, 'resources'), home]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: workflow-skill\ndescription: Return the correct answer.\n---\nReturn OK.\n');
  writeFileSync(join(skill, 'resources', 'image.bin'), Buffer.from([0, 1, 2, 3]));
  writeFileSync(join(bench, 'fixture', 'input.txt'), 'input\n');
  writeFileSync(join(bench, 'prompt.md'), 'Return OK.');
  writeFileSync(join(bench, 'verify.mjs'), "import{readFileSync,existsSync}from'node:fs';import{join}from'node:path';const p=join(process.argv[2],'_output.md');const passed=existsSync(p)&&readFileSync(p,'utf8').trim()==='OK';console.log(JSON.stringify({passed,checks:[{name:'correct',pass:passed},{name:'complete',pass:passed}]}));process.exit(passed?0:1);");
  writeFileSync(join(bench, 'oracle.mjs'), "import{writeFileSync}from'node:fs';import{join}from'node:path';writeFileSync(join(process.argv[2],'_output.md'),'OK');");
  writeFileSync(join(bench, 'bench.json'), JSON.stringify({ schemaVersion: 1, name: 'workflow', tasks: [true, false].map((shouldTrigger, i) => ({
    id: `task-${i + 1}`, fixture: 'fixture', prompt: 'prompt.md', verifier: 'node verify.mjs', oracle: 'node oracle.mjs', shouldTrigger,
  })) }));
  let calls = 0;
  const base: EvalOptions = { skillPath: skill, bench, mode: 'trigger', agent: 'codex', trials: 1, maxCalls: 2,
    dryRun: false, yes: true, runsRoot: join(root, 'runs'), runGroup: 'trigger', log: () => {},
    sessionOptions: { homeDir: home, env: { ...process.env, CODEX_HOME: join(home, 'profile') }, versionProbe: () => null },
    executor: { describe: () => ({ kind: 'cli', model: 'offline-injected', sampling: null }), run: async () => {
      calls++; return { output: 'OK', skillTriggered: true, tokens: { input: 10, cachedInput: 4, output: 2 } };
    } } };
  const limits = { input: 10000, cachedInput: 10000, uncachedInput: 10000, output: 10000, durationSeconds: 10000 };
  return { root, skill, bench, home, base, limits, calls: () => calls };
}

test('trigger shares reviewed JSON plans, configurable stop lines and sealed reports without paired adoption', async t => {
  const f = fixture(t), base = { ...f.base, executorTimeoutSeconds: 19, spendingBudget: f.limits };
  const preview = await runEvalCli({ ...base, dryRun: true });
  assert.equal(preview.plan.evaluation.mode, 'trigger'); assert.equal(preview.plan.evaluation.plannedCalls, 2);
  assert.equal(preview.plan.evaluation.executorTimeoutSeconds, 19); assert.deepEqual(preview.plan.evaluation.spendingBudget, f.limits);
  assert.equal(f.calls(), 0); assert.equal(existsSync(base.runsRoot!), false);
  const result = await runEvalCli(base, preview.plan.sha256); assert.ok('evaluationType' in result && result.evaluationType === 'trigger');
  assert.equal(result.status, 'completed'); assert.equal(result.evidence.verified, true, result.evidence.reasons.join('; '));
  assert.equal(result.usage?.runs, 2); assert.equal(result.usage?.metrics.input.knownTotal, 20);
  assert.equal(result.acceptance.eligibleForUpgrade, false); assert.equal(result.acceptance.automaticUpgrade, false);
  const plan = JSON.parse(readFileSync(join(base.runsRoot!, base.runGroup!, '_plan.json'), 'utf8'));
  assert.deepEqual(plan.details.reviewedPlan, preview.plan); assert.equal(plan.details.executorTimeoutSeconds, 19);
  assert.equal(f.calls(), 2);
});

test('trigger token stop lines retain the paid prefix and never dispatch the next task', async t => {
  const f = fixture(t), base = { ...f.base, spendingBudget: { ...f.limits, input: 5 } };
  const preview = await runEvalCli({ ...base, dryRun: true }), result = await runEvalCli(base, preview.plan.sha256);
  assert.ok('evaluationType' in result && result.evaluationType === 'trigger'); assert.equal(result.status, 'stopped');
  assert.equal(f.calls(), 1); assert.equal(result.usage?.runs, 1); assert.equal(result.usage?.metrics.input.knownTotal, 10);
  assert.equal(result.acceptance.eligibleForUpgrade, false); assert.match(result.session?.stopReason ?? '', /SPENDING_BUDGET_REACHED/);
  assert.equal(existsSync(join(base.runsRoot!, base.runGroup!, 'task-2', 'installed', 'trial-1')), false);
});

test('trigger missing final cache coverage stops rather than assuming a zero cache bill', async t => {
  const f = fixture(t); let calls = 0;
  const base = { ...f.base, spendingBudget: f.limits, executor: { describe: () => ({ kind: 'cli', model: 'offline-missing-cache' }), run: async () => {
    calls++; return { output: 'OK', skillTriggered: true, tokens: { input: 10, output: 2 } };
  } } };
  const preview = await runEvalCli({ ...base, dryRun: true }), result = await runEvalCli(base, preview.plan.sha256);
  assert.ok('evaluationType' in result); assert.equal(result.status, 'stopped'); assert.equal(calls, 1);
  assert.equal(result.usage?.metrics.cachedInput.coverage.unknown, 1); assert.equal(result.usage?.metrics.input.knownTotal, 10);
  assert.match(result.session?.stopReason ?? '', /FINAL_USAGE_MISSING/);
});

test('trigger plan confirmation pins binary Skill resources and spending settings before any dispatch', async t => {
  const f = fixture(t), preview = await runEvalCli({ ...f.base, dryRun: true });
  assert.ok(preview.plan.evaluation.installedFingerprint?.files.includes('resources/image.bin'));
  writeFileSync(join(f.skill, 'resources', 'image.bin'), Buffer.from([8, 9]));
  await assert.rejects(runEvalCli(f.base, preview.plan.sha256), /--plan-sha/);
  assert.equal(f.calls(), 0); assert.equal(existsSync(f.base.runsRoot!), false);
  const updated = await runEvalCli({ ...f.base, dryRun: true });
  await assert.rejects(runEvalCli({ ...f.base, spendingBudget: f.limits }, updated.plan.sha256), /--plan-sha/);
  assert.equal(f.calls(), 0);
});

test('public trigger JSON previews work without an installed agent and live missing-CLI failures remain structured', t => {
  const f = fixture(t), env = { ...process.env, HOME: f.home, USERPROFILE: f.home, CODEX_HOME: join(f.home, 'profile'), SKILLFIT_JUDGE: '0' };
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') delete env[key as keyof typeof env];
  const isolated = { ...env, PATH: '' };
  const args = ['eval', f.skill, '--bench', f.bench, '--mode', 'trigger', '--agent', 'codex', '--trials', '1', '--max-calls', '2', '--run-group', 'public-trigger', '--runs-root', join(f.root, 'runs'), '--json'];
  const preview = spawnSync(process.execPath, [CLI, ...args, '--dry-run'], { encoding: 'utf8', env: isolated });
  assert.equal(preview.status, 0, preview.stderr); const planned = JSON.parse(preview.stdout);
  assert.equal(planned.plan.evaluation.mode, 'trigger'); assert.equal(planned.plan.evaluation.agentPreflight.status, 'blocked');
  const live = spawnSync(process.execPath, [CLI, ...args, '--plan-sha', planned.plan.sha256], { encoding: 'utf8', env: isolated });
  assert.equal(live.status, 2, live.stderr); const error = JSON.parse(live.stdout);
  assert.equal(error.error.code, 'AGENT_PREFLIGHT_FAILED'); assert.equal(existsSync(join(f.root, 'runs')), false);
});

test('an explicitly enabled API judge without credentials blocks rather than silently running without judging', async t => {
  const f = fixture(t), names = ['SKILLFIT_JUDGE', 'SKILLFIT_JUDGE_API_KEY', 'SKILLFIT_API_KEY', 'OPENAI_API_KEY'];
  const previous = names.map(name => process.env[name]);
  try {
    for (const name of names) delete process.env[name]; process.env['SKILLFIT_JUDGE'] = '1';
    const base = { ...f.base, mode: 'inject' as const, maxCalls: 4 };
    const preview = await runEvalCli({ ...base, dryRun: true });
    assert.equal(preview.plan.evaluation.agentPreflight.status, 'blocked');
    assert.ok(preview.plan.evaluation.agentPreflight.checks.some(check => check.role === 'judge' && check.status === 'FAIL'));
    await assert.rejects(runEval(base), AgentPreflightFailed); assert.equal(f.calls(), 0); assert.equal(existsSync(base.runsRoot!), false);
  } finally { names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; }); }
});
