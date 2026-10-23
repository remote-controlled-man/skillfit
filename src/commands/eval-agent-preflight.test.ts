import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { getAgent } from '../agents.js';
import { findExecutable, globalSkillRoots, inspectAgentEnvironment, AgentPreflightFailed,
  assertRecordedAgentEnvironment, type EnvironmentRole } from '../harness/agent-preflight.js';
import { collectEvaluationTarget } from '../harness/target.js';
import { runEval, type EvalOptions } from './eval.js';
import { runEvalCli } from './eval-cli.js';
import { runEvalComponent, reportEvalComponent, componentError } from './eval-component.js';
import { exportEvaluation } from './eval-export.js';
import { runEvalReport } from './eval-report.js';

const CLI = fileURLToPath(new URL('../cli.js', import.meta.url));
function setup(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-agent-env-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, 'home'), profile = join(root, 'profile'), bin = join(root, 'bin'), skill = join(root, 'candidate'), bench = join(root, 'bench');
  for (const dir of [home, profile, bin, skill, join(bench, 'fixture')]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: actual-skill-name\ndescription: Test a local answer.\n---\nReturn OK.\n');
  writeFileSync(join(bench, 'fixture/input.txt'), 'input'); writeFileSync(join(bench, 'prompt.md'), 'Return OK.');
  const verifier = join(bench, 'verify.mjs');
  writeFileSync(verifier, "import{existsSync,readFileSync}from'node:fs';import{join}from'node:path';const file=join(process.argv[2],'_output.md');const passed=existsSync(file)&&readFileSync(file,'utf8').trim()==='OK';console.log(JSON.stringify({passed}));process.exit(passed?0:1);");
  writeFileSync(join(bench, 'bench.json'), JSON.stringify({ schemaVersion: 1, name: 'agent-preflight', tasks: [{ id: 't', fixture: 'fixture', prompt: 'prompt.md', verifier: 'node verify.mjs', shouldTrigger: true }] }));
  const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: profile, PATH: bin, SKILLFIT_JUDGE: '0' };
  // Native OS home resolution is not used by direct tests; child CLI tests use both home overrides.
  const binary = join(bin, process.platform === 'win32' ? 'codex.CMD' : 'codex');
  writeFileSync(binary, 'synthetic executable; must never be run'); chmodSync(binary, 0o755);
  const target = collectEvaluationTarget(skill), definition = getAgent('codex');
  const role: EnvironmentRole = { role: 'agent', definition, executor: { kind: 'cli', model: 'cli-configured' }, injected: false };
  const inspect = (roles: EnvironmentRole[] = [role]) => inspectAgentEnvironment({ roles, target, mode: 'inject', homeDir: home, env });
  const conflict = (folder = 'alias-folder', name = 'actual-skill-name') => {
    const dir = join(globalSkillRoots(definition, home, env).at(-1)!, folder); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: A synthetic global Skill.\n---\nPrivate body must not appear in the report.\n`); return dir;
  };
  let calls = 0;
  const base: EvalOptions = { skillPath: skill, bench, agent: 'codex', trials: 1, maxCalls: 2, dryRun: false, yes: true,
    runsRoot: join(root, 'runs'), runGroup: 'env', judgeExecutor: null, sessionOptions: { homeDir: home, env, versionProbe: () => null },
    executor: { describe: () => ({ kind: 'mock', model: 'offline-agent-env' }), run: async () => {
      calls++; return { output: 'OK', tokens: { input: 10, cachedInput: 4, output: 2 } };
    } }, log: () => {} };
  return { root, home, profile, bin, binary, env, target, role, inspect, conflict, base, bench, skill, verifier, calls: () => calls };
}

test('PATH lookup inspects executable files without running a CLI or accepting config directories as installation', t => {
  const f = setup(t); assert.equal(findExecutable('codex', f.env), findExecutable(f.binary, f.env));
  assert.equal(findExecutable('missing-agent', f.env), null);
  assert.equal(findExecutable('codex', { ...f.env, PATH: '' }), null);
  mkdirSync(join(f.bin, 'directory-agent')); assert.equal(findExecutable('directory-agent', f.env), null);
  if (process.platform !== 'win32') {
    chmodSync(f.binary, 0o644); assert.equal(findExecutable('codex', f.env), null);
  }
  const report = inspectAgentEnvironment({ roles: [f.role], target: f.target, mode: 'inject', homeDir: f.home, env: { ...f.env, PATH: '' } });
  assert.equal(report.status, 'blocked'); assert.equal(report.checks.find(c => c.code === 'CLI_AVAILABLE')!.status, 'FAIL');
  assert.deepEqual(report.cost, { modelCalls: 0, cliInvocations: 0 });
});

test('Windows PATH/PATHEXT lookup accepts command shims and case-insensitive environment keys', t => {
  const f = setup(t), file = join(f.bin, 'offline.CMD'); writeFileSync(file, 'must never execute');
  const path = findExecutable('offline', { Path: `"${f.bin}"`, PathExt: '.CMD;.EXE' }, 'win32');
  assert.ok(path?.endsWith('offline.CMD')); assert.equal(findExecutable('absent', { Path: f.bin, PATHEXT: '.CMD' }, 'win32'), null);
  assert.equal(findExecutable('offline', { Path: 'missing', PATH: f.bin, PATHEXT: '.CMD' }, 'win32'), path);
});

test('local readiness never claims login even with credentials/config files present, and emits no secret values', t => {
  const f = setup(t), secret = 'synthetic-secret-never-report';
  writeFileSync(join(f.profile, 'auth.json'), JSON.stringify({ access_token: secret }));
  const report = inspectAgentEnvironment({ roles: [f.role], target: f.target, mode: 'installed', homeDir: f.home,
    env: { ...f.env, OPENAI_API_KEY: secret } });
  assert.equal(report.status, 'ready'); assert.equal(report.checks.find(c => c.code === 'AUTHENTICATION')!.status, 'UNKNOWN');
  assertRecordedAgentEnvironment(report); assert.equal(JSON.stringify(report).includes(secret), false);
  assert.deepEqual(f.inspect(), f.inspect()); assert.equal(f.calls(), 0);
});

test('capability checks use matrix declarations and cover trigger support, installation paths and the judge CLI', t => {
  const f = setup(t), claude = structuredClone(getAgent('claude-code'));
  delete claude.headless.streamJson;
  const trigger = inspectAgentEnvironment({ roles: [{ ...f.role, definition: claude }], target: f.target, mode: 'trigger', homeDir: f.home, env: f.env });
  assert.equal(trigger.status, 'blocked'); assert.match(trigger.checks.find(c => c.code === 'MATRIX_CAPABILITY')!.message, /streamJson/);
  const supported = inspectAgentEnvironment({ roles: [{ ...f.role, definition: getAgent('claude-code') }], target: f.target, mode: 'trigger', homeDir: f.home, env: f.env });
  assert.equal(supported.checks.find(c => c.code === 'MATRIX_CAPABILITY')!.status, 'PASS');
  assert.equal(supported.checks.find(c => c.code === 'CLI_AVAILABLE')!.status, 'FAIL', 'offline tests must not claim a real Claude installation');
  assert.equal(supported.checks.find(c => c.code === 'AUTHENTICATION')!.status, 'UNKNOWN');
  const missingDirs = structuredClone(f.role.definition!); missingDirs.skills.projectDirs = [];
  const installed = inspectAgentEnvironment({ roles: [{ ...f.role, definition: missingDirs }], target: f.target, mode: 'installed', homeDir: f.home, env: f.env });
  assert.match(installed.checks.find(c => c.code === 'MATRIX_CAPABILITY')!.message, /project Skill directory/);
  const judge = structuredClone(f.role.definition!); judge.headless.argv = ['missing-offline-judge'];
  if (judge.headless.streamJson) judge.headless.streamJson.argv = ['missing-offline-judge'];
  const judged = f.inspect([f.role, { ...f.role, role: 'judge', definition: judge }]);
  assert.equal(judged.status, 'blocked'); assert.equal(judged.checks.find(c => c.role === 'judge' && c.code === 'CLI_AVAILABLE')!.status, 'FAIL');
  assert.equal(judged.checks.filter(c => c.code === 'AUTHENTICATION').length, 2);
});

test('budget preflight distinguishes supported, unavailable and unknown token counters for every role', t => {
  const f = setup(t);
  for (const [id, status] of [['codex', 'PASS'], ['kimi-code', 'FAIL'], ['claude-code', 'FAIL']] as const) {
    const checked = inspectAgentEnvironment({ roles: [{ ...f.role, definition: getAgent(id) }], target: f.target,
      mode: 'inject', spendingBudget: true, homeDir: f.home, env: f.env });
    const check = checked.checks.find(c => c.code === 'USAGE_CAPABILITY')!;
    assert.equal(check.status, status, id);
    if (status === 'FAIL') { assert.match(check.message, /unavailable counters/); assert.ok(check.remediation); }
  }
  const checked = inspectAgentEnvironment({ roles: [f.role, { ...f.role, role: 'judge', definition: getAgent('claude-code') }],
    target: f.target, mode: 'inject', spendingBudget: true, homeDir: f.home, env: f.env });
  assert.equal(checked.checks.find(c => c.code === 'USAGE_CAPABILITY' && c.role === 'judge')!.status, 'FAIL');
  for (const role of [{ ...f.role, injected: true }, { role: 'agent' as const, injected: false, executor: { kind: 'api', model: 'not-called' } }]) {
    const unknown = inspectAgentEnvironment({ roles: [role], target: f.target, mode: 'inject', spendingBudget: true, homeDir: f.home, env: f.env });
    assert.equal(unknown.checks.find(c => c.code === 'USAGE_CAPABILITY')!.status, 'UNKNOWN');
    assert.equal(unknown.status, 'ready'); assert.deepEqual(unknown.cost, { modelCalls: 0, cliInvocations: 0 });
  }
});

test('global conflicts include frontmatter aliases and configured home overrides without exposing Skill bodies', t => {
  const f = setup(t), dir = f.conflict();
  const report = f.inspect(), conflict = report.checks.find(c => c.code === 'GLOBAL_SKILL_CONFLICT')!;
  assert.equal(report.status, 'blocked'); assert.equal(conflict.status, 'FAIL'); assert.deepEqual(conflict.paths, [dir]);
  assert.match(conflict.message, /Baseline contamination risk/); assert.equal(JSON.stringify(report).includes('Private body'), false);
  rmSync(dir, { recursive: true }); f.conflict(f.target.name, 'different-frontmatter-name');
  assert.equal(f.inspect().status, 'blocked', 'directory-name conflicts remain blocked too');
});

test('global alias directories are inspected, and unreadable roots remain explicitly unknown', t => {
  const f = setup(t), real = join(f.root, 'external-skill'); mkdirSync(real);
  writeFileSync(join(real, 'SKILL.md'), '---\nname: actual-skill-name\ndescription: Alias test.\n---\n');
  const root = globalSkillRoots(f.role.definition!, f.home, f.env)[0]!; mkdirSync(root, { recursive: true });
  symlinkSync(real, join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(f.inspect().status, 'blocked'); rmSync(join(root, 'linked'));
  rmSync(root, { recursive: true }); writeFileSync(root, 'not a directory');
  const unknown = f.inspect().checks.find(c => c.code === 'GLOBAL_SKILL_SCAN')!;
  assert.equal(unknown.status, 'UNKNOWN'); assert.ok(unknown.paths.includes(root));
});

test('injected executors cannot attest real CLI readiness and API execution does not require a CLI', t => {
  const f = setup(t), injected = f.inspect([{ ...f.role, injected: true }]);
  assert.equal(injected.checks.find(c => c.code === 'EXECUTOR_INJECTED')!.status, 'UNKNOWN');
  const api = f.inspect([{ role: 'agent', injected: false, executor: { kind: 'api', model: 'offline-not-called' } }]);
  assert.equal(api.status, 'ready'); assert.equal(api.checks.find(c => c.code === 'CLI_AVAILABLE')!.status, 'INFO');
  const invalid = structuredClone(api); invalid.checks.find(c => c.code === 'AUTHENTICATION')!.status = 'PASS';
  assert.throws(() => assertRecordedAgentEnvironment(invalid), /environment check/);
});

test('capability mismatch is structured and blocks both preview and live execution without invoking API/agent', async t => {
  const f = setup(t);
  for (const dryRun of [true, false]) await assert.rejects(runEval({ ...f.base, dryRun, inputMode: 'workspace',
    executor: { describe: () => ({ kind: 'api', model: 'offline-api' }), run: async () => { throw new Error('must never run'); } } }), error => {
    assert.ok(error instanceof AgentPreflightFailed); assert.equal(componentError(error).error.code, 'AGENT_PREFLIGHT_FAILED');
    assert.equal(error.agentPreflight.checks.find(c => c.code === 'MATRIX_CAPABILITY')!.status, 'FAIL'); return true;
  });
  assert.equal(f.calls(), 0); assert.equal(existsSync(f.base.runsRoot!), false);
});

test('global conflict blocks before any case verifier, executor, version probe or native directory is created', async t => {
  const f = setup(t), sentinel = join(f.root, 'verifier-started'), conflict = f.conflict();
  writeFileSync(f.verifier, `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(sentinel)},'called');process.exit(1);`);
  await assert.rejects(runEval({ ...f.base, sessionOptions: { ...f.base.sessionOptions,
    versionProbe: () => { throw new Error('must not probe the CLI'); } } }), error => {
    assert.ok(error instanceof AgentPreflightFailed); assert.equal(error.agentPreflight.status, 'blocked'); assert.ok(error.message.includes(conflict)); return true;
  });
  assert.equal(existsSync(sentinel), false); assert.equal(f.calls(), 0); assert.equal(existsSync(f.base.runsRoot!), false);
});

test('case probes cannot silently change Agent readiness before first dispatch', async t => {
  const f = setup(t), globalDir = join(globalSkillRoots(f.role.definition!, f.home, f.env)[0]!, 'new-global');
  writeFileSync(f.verifier, `import{mkdirSync,writeFileSync}from'node:fs';import{join}from'node:path';mkdirSync(${JSON.stringify(globalDir)},{recursive:true});writeFileSync(join(${JSON.stringify(globalDir)},'SKILL.md'),${JSON.stringify('---\nname: actual-skill-name\ndescription: Changed during probe.\n---\n')});console.log(JSON.stringify({passed:false}));process.exit(1);`);
  await assert.rejects(runEval(f.base), AgentPreflightFailed);
  assert.equal(f.calls(), 0); assert.equal(existsSync(f.base.runsRoot!), false);
});

test('ordinary and request plans bind the same checks and stale global-readiness plans cannot execute', async t => {
  const f = setup(t), request = join(f.root, 'request.json');
  const body = { schemaVersion: 1, baselineSkill: null, candidateSkill: f.skill, bench: f.bench, agent: 'codex', purpose: 'development',
    trials: 1, maxCalls: 2, runsRoot: f.base.runsRoot, runGroup: f.base.runGroup };
  writeFileSync(request, JSON.stringify(body));
  const ordinary = { ...f.base, mode: 'installed' as const, inputMode: 'workspace' as const, skillInstallDir: 'project-skills' };
  const a = await runEvalCli({ ...ordinary, dryRun: true });
  const b = await runEvalComponent(request, { ...f.base, dryRun: true, skillInstallDir: 'project-skills' });
  assert.deepEqual(a.plan.evaluation.agentPreflight, b.plan.evaluation.agentPreflight);
  f.conflict(); await assert.rejects(runEvalCli(ordinary, a.plan.sha256), /--plan-sha/);
  assert.equal(f.calls(), 0); assert.equal(existsSync(f.base.runsRoot!), false);
});

test('public CLI previews expose blocked readiness and both human/confirmed JSON execution refuse a missing CLI', t => {
  const f = setup(t), env = { ...f.env, PATH: '' }, args = ['eval', f.skill, '--bench', f.bench, '--agent', 'codex', '--trials', '1',
    '--runs-root', f.base.runsRoot!, '--run-group', f.base.runGroup!, '--json'];
  const preview = spawnSync(process.execPath, [CLI, ...args, '--dry-run'], { env, encoding: 'utf8', timeout: 30_000 });
  assert.equal(preview.status, 0, preview.stderr); const plan = JSON.parse(preview.stdout).plan;
  assert.equal(plan.evaluation.agentPreflight.status, 'blocked');
  const live = spawnSync(process.execPath, [CLI, ...args, '--plan-sha', plan.sha256], { env, encoding: 'utf8', timeout: 30_000 });
  assert.equal(live.status, 2); assert.equal(JSON.parse(live.stdout).error.code, 'AGENT_PREFLIGHT_FAILED');
  const human = spawnSync(process.execPath, [CLI, ...args.slice(0, -1)], { env, encoding: 'utf8', timeout: 30_000 });
  assert.equal(human.status, 1); assert.match(human.stderr, /CLI executable is missing/); assert.equal(existsSync(f.base.runsRoot!), false);
  const trigger = spawnSync(process.execPath, [CLI, ...args.slice(0, -1), '--mode', 'trigger'], { env, encoding: 'utf8', timeout: 30_000 });
  assert.equal(trigger.status, 1); assert.match(trigger.stderr, /CLI executable is missing/); assert.equal(existsSync(f.base.runsRoot!), false);
});

test('a missing judge CLI blocks before spending on the primary injected executor', async t => {
  const f = setup(t);
  await assert.rejects(runEval({ ...f.base, judgeExecutor: undefined, judgeAgent: 'claude-code', maxCalls: 4 }), error => {
    assert.ok(error instanceof AgentPreflightFailed);
    assert.equal(error.agentPreflight.checks.find(c => c.role === 'judge' && c.code === 'CLI_AVAILABLE')!.status, 'FAIL'); return true;
  });
  assert.equal(f.calls(), 0); assert.equal(existsSync(f.base.runsRoot!), false);
});

test('saved preflight survives changed machine inputs and portable replay without new readiness/auth probes', async t => {
  const f = setup(t), preview = await runEvalCli({ ...f.base, dryRun: true });
  const result = await runEvalCli(f.base, preview.plan.sha256); assert.ok('agentPreflight' in result);
  assert.ok('costs' in result);
  assert.equal(result.status, 'completed'); assert.equal(result.evidence.verified, true);
  assert.deepEqual(result.agentPreflight, preview.plan.evaluation.agentPreflight);
  f.conflict(); rmSync(f.binary); rmSync(f.skill, { recursive: true }); rmSync(f.bench, { recursive: true });
  const run = join(f.base.runsRoot!, f.base.runGroup!), replay = await reportEvalComponent(run, { replay: true });
  assert.equal(replay.evidence.verified, true); assert.deepEqual(replay.agentPreflight, result.agentPreflight);
  const lines: string[] = []; await runEvalReport(run, line => lines.push(line));
  assert.match(lines.join('\n'), /authentication remains unknown offline/); assert.equal(lines.join('\n').includes(f.profile), false);
  const output = join(f.root, 'portable'); await exportEvaluation(run, output, { yes: true, log: () => {} }); rmSync(run, { recursive: true });
  const child = spawnSync(process.execPath, [join(output, 'reproduce.mjs')], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(child.status, 0, child.stderr); assert.deepEqual(JSON.parse(child.stdout).agentPreflight, result.agentPreflight);
  assert.deepEqual(JSON.parse(child.stdout).costs, result.costs); assert.equal(f.calls(), 2);
});
