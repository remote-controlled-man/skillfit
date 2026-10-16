import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { runBenchInit } from './bench.js';
import { componentError, reportEvalComponent } from './eval-component.js';
import { runEval } from './eval.js';
import { CasePreflightFailed } from './eval-preflight.js';
import { MockExecutor } from '../harness/executors/mock.js';
import type { Executor } from '../harness/types.js';

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
async function setup(t: TestContext, kind: 'command' | 'output' = 'command') {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-preflight-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench'), skill = join(root, 'new'), old = join(root, 'old');
  await runBenchInit({ dir: bench, kind, yes: true, log: () => {} });
  for (const [dir, version] of [[skill, 'new'], [old, 'old']]) {
    mkdirSync(dir!); writeFileSync(join(dir!, 'SKILL.md'), `---\nname: preflight-test\ndescription: Offline test.\n---\n${version}\n`);
  }
  let calls = 0, judges = 0;
  const mock = new MockExecutor();
  const executor: Executor = { describe: () => mock.describe(), run: async (...args) => { calls++; return mock.run(...args); } };
  const judge: Executor = { describe: () => mock.describe(), run: async () => { judges++; throw new Error('judge must not run'); } };
  const raw = read(join(bench, 'bench.json'));
  const save = () => writeFileSync(join(bench, 'bench.json'), JSON.stringify(raw));
  const base = { bench, skillPath: skill, trials: 1, maxCalls: 2, executor, judgeExecutor: null,
    runsRoot: join(root, 'runs'), runGroup: 'checked', yes: true, dryRun: false, log: () => {} };
  return { root, bench, skill, old, raw, save, base, judge, calls: () => calls, judges: () => judges,
    verifier: join(bench, 'verifiers/example-task.mjs'), oracle: join(bench, 'ground-truth/oracle-example-task.mjs') };
}

for (const mode of ['inject', 'installed', 'trigger'] as const) test(`${mode}: a broken NOP gate blocks all agent/judge calls before run creation`, async t => {
  const f = await setup(t); f.raw.tasks[0].shouldTrigger = true; f.save();
  writeFileSync(f.verifier, 'process.exit(0);');
  await assert.rejects(runEval({ ...f.base, mode, skillInstallDir: 'project-skills',
    ...(mode === 'installed' ? { baselineSkillPath: f.old } : {}),
    ...(mode !== 'trigger' ? { judgeExecutor: f.judge, maxCalls: 4 } : {}) }), error => {
    assert.ok(error instanceof CasePreflightFailed);
    assert.equal(error.preflight.status, 'blocked');
    assert.ok(error.preflight.checks.some(c => c.code === 'UNTOUCHED_FIXTURE' && c.status === 'FAIL' && c.evidence?.exitCode === 0));
    assert.match(error.message, /already passes/); assert.match(error.message, /Remedy:/);
    return true;
  });
  assert.equal(f.calls(), 0); assert.equal(f.judges(), 0); assert.ok(!existsSync(f.base.runsRoot));
});

test('missing/empty output, unspawnable verifiers and failed oracles are hard gates with process evidence', async t => {
  for (const issue of ['missing', 'empty', 'spawn', 'oracle-process', 'oracle-verifier'] as const) await t.test(issue, async t => {
    const f = await setup(t, issue === 'missing' || issue === 'empty' ? 'output' : 'command');
    let code: string;
    if (issue === 'missing' || issue === 'empty') {
      delete f.raw.tasks[0].oracle;
      writeFileSync(f.verifier, issue === 'missing' ? 'process.exit(0);' :
        "import{existsSync}from'node:fs';import{join}from'node:path';process.exit(existsSync(join(process.argv[2],'_output.md'))?0:1);");
      code = issue === 'missing' ? 'MISSING_OUTPUT' : 'EMPTY_OUTPUT';
    } else if (issue === 'spawn') { f.raw.tasks[0].verifier = 'skillfit-no-such-verifier'; code = 'UNTOUCHED_FIXTURE'; }
    else { writeFileSync(f.oracle, issue === 'oracle-process' ? "console.error('reference failed');process.exit(7);" : 'process.exit(0);'); code = 'ORACLE'; }
    f.save();
    await assert.rejects(runEval(f.base), error => {
      assert.ok(error instanceof CasePreflightFailed);
      const check = error.preflight.checks.find(c => c.code === code && c.status === 'FAIL');
      assert.ok(check?.evidence); assert.ok(check.remediation); assert.equal(check.taskId, 'example-task');
      if (issue === 'spawn') { assert.equal(check.evidence.exitCode, null); assert.ok(check.evidence.error); }
      if (issue === 'oracle-process') { assert.equal(check.evidence.exitCode, 7); assert.match(check.evidence.output, /reference failed/); }
      assert.equal(componentError(error).error.code, 'CASE_PREFLIGHT_FAILED');
      return true;
    });
    assert.equal(f.calls(), 0); assert.ok(!existsSync(f.base.runsRoot));
  });
});

test('warnings and unknown coverage are distinct, nonblocking and frozen for offline reporting', async t => {
  const f = await setup(t); delete f.raw.tasks[0].oracle; f.raw.tasks[0].shouldTrigger = true; f.save();
  writeFileSync(join(f.bench, 'fixtures/example-task/large.txt'), 'x'.repeat(66 * 1024));
  const lines: string[] = [];
  await runEval({ ...f.base, log: line => lines.push(line) });
  assert.equal(f.calls(), 2);
  const run = join(f.base.runsRoot, f.base.runGroup), report = read(join(run, '_plan.json')).details.casePreflight;
  assert.equal(report.status, 'ready'); assert.equal(report.summary.failures, 0);
  assert.ok(report.summary.warnings >= 2); assert.ok(report.summary.unknown >= 2);
  for (const [code, status] of [['ORACLE', 'UNKNOWN'], ['LIVE_DIFFICULTY', 'UNKNOWN'], ['FIXTURE_SIZE', 'WARN'], ['NEGATIVE_CONTROLS', 'WARN'], ['MOCK_COVERAGE', 'INFO']]) {
    assert.equal(report.checks.find((c: { code: string }) => c.code === code).status, status);
  }
  assert.equal(report.cost.modelCalls, 0); assert.ok(report.cost.durationMs >= 0);
  assert.match(lines.join('\n'), /\[UNKNOWN\] ORACLE/); assert.match(lines.join('\n'), /\[WARN\] FIXTURE_SIZE/);
  const saved = await reportEvalComponent(run, { replay: true });
  assert.ok('casePreflight' in saved); assert.deepEqual(saved.casePreflight, report);
  assert.equal(saved.acceptance.eligibleForUpgrade, false); assert.equal(f.calls(), 2);
});

test('only selected tasks are probed; trigger mode also skips unlabelled tasks', async t => {
  for (const trigger of [false, true]) await t.test(String(trigger), async t => {
    const f = await setup(t);
    writeFileSync(join(f.bench, 'verifiers/unselected.mjs'), "console.log('must not be probed');process.exit(0);");
    f.raw.tasks.push({ ...f.raw.tasks[0], id: 'unselected', verifier: 'node verifiers/unselected.mjs' });
    if (trigger) f.raw.tasks[0].shouldTrigger = true;
    f.save();
    await runEval({ ...f.base, ...(trigger ? { mode: 'trigger', skillInstallDir: 'skills', maxCalls: 1,
      executor: { describe: () => ({ kind: 'cli' as const, model: 'offline-trigger' }),
        run: async (...args: Parameters<Executor['run']>) => ({ ...await f.base.executor.run(...args), skillTriggered: true }) } } as const : { taskIds: ['example-task'] }) });
    const report = read(join(f.base.runsRoot, f.base.runGroup, '_plan.json')).details.casePreflight;
    assert.deepEqual(report.bench.taskIds, ['example-task']);
    assert.ok(!report.checks.some((c: { taskId: string }) => c.taskId === 'unselected'));
    assert.equal(f.calls(), trigger ? 1 : 2);
  });
});

test('dry-run stays side-effect-free and declares pending preflight rather than claiming checks passed', async t => {
  const f = await setup(t), sentinel = join(f.root, 'probe-started');
  writeFileSync(f.verifier, `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(sentinel)},'unexpected');process.exit(0);`);
  await runEval({ ...f.base, dryRun: true, onPlan: plan => {
    assert.deepEqual(plan.casePreflight, { schemaVersion: 1, scope: 'offline-case-integrity', required: true, status: 'pending' });
  } });
  assert.equal(f.calls(), 0); assert.ok(!existsSync(sentinel)); assert.ok(!existsSync(f.base.runsRoot));
});

test('missing mock coverage is unknown; malformed markers and overflowing mock probes block evaluation', async t => {
  for (const issue of ['absent', 'omitted-arm', 'malformed', 'overflow-probe'] as const) await t.test(issue, async t => {
    const f = await setup(t, 'output'), marker = join(f.bench, 'fixtures/example-task/.skillfit-mock.json');
    if (issue === 'absent') rmSync(marker);
    else if (issue === 'omitted-arm') writeFileSync(marker, '{}');
    else if (issue === 'malformed') writeFileSync(marker, '{');
    else {
      const source = readFileSync(f.verifier, 'utf8');
      writeFileSync(f.verifier, "import{readFileSync as readProbe}from'node:fs';import{join as probePath}from'node:path';let overflow=false;try{overflow=readProbe(probePath(process.argv[2],'_output.md'),'utf8')==='overflow';}catch{}if(overflow){process.stdout.write('x'.repeat(9*1024*1024));setInterval(()=>{},1000);await new Promise(()=>{});}\n" + source);
      writeFileSync(marker, JSON.stringify({ baseline: { output: 'overflow' } }));
    }
    if (issue === 'malformed' || issue === 'overflow-probe') {
      await assert.rejects(runEval(f.base), error => {
        assert.ok(error instanceof CasePreflightFailed);
        assert.ok(error.preflight.checks.some(c => c.code === (issue === 'malformed' ? 'MOCK_MARKER' : 'MOCK_BASELINE') && c.status === 'FAIL'));
        return true;
      });
      assert.equal(f.calls(), 0); assert.ok(!existsSync(f.base.runsRoot));
    } else {
      await runEval(f.base);
      const report = read(join(f.base.runsRoot, f.base.runGroup, '_plan.json')).details.casePreflight;
      assert.equal(report.checks.find((c: { code: string }) => c.code === (issue === 'absent' ? 'MOCK_COVERAGE' : 'MOCK_BASELINE')).status, 'UNKNOWN');
      assert.equal(f.calls(), 2);
    }
  });
});

test('existing run groups are rejected before executing any offline probe or overwriting evidence', async t => {
  const f = await setup(t), run = join(f.base.runsRoot, f.base.runGroup), sentinel = join(f.root, 'probe-started');
  mkdirSync(run, { recursive: true }); writeFileSync(join(run, 'kept'), 'original');
  writeFileSync(f.verifier, `import{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(sentinel)},'unexpected');process.exit(0);`);
  await assert.rejects(runEval(f.base), /already exists/);
  assert.equal(readFileSync(join(run, 'kept'), 'utf8'), 'original'); assert.ok(!existsSync(sentinel)); assert.equal(f.calls(), 0);
});

test('probe mutations of bench or either Skill cannot silently change the approved inputs', async t => {
  for (const which of ['bench', 'candidate', 'baseline']) await t.test(which, async t => {
    const f = await setup(t);
    const target = which === 'bench' ? join(f.bench, 'prompts/example-task.md') : join(which === 'candidate' ? f.skill : f.old, 'SKILL.md');
    writeFileSync(f.verifier, `import{appendFileSync}from'node:fs';appendFileSync(${JSON.stringify(target)},'changed');process.exit(1);`);
    delete f.raw.tasks[0].oracle; f.save();
    await assert.rejects(runEval({ ...f.base, mode: 'installed', baselineSkillPath: f.old, skillInstallDir: 'skills' }), error => {
      assert.ok(error instanceof CasePreflightFailed);
      assert.ok(error.preflight.checks.some(c => c.code === 'INPUT_CHANGED' && c.status === 'FAIL')); return true;
    });
    assert.equal(f.calls(), 0); assert.ok(!existsSync(f.base.runsRoot));
  });
});

test('request preflight failures produce JSON-only per-case diagnostics without starting an agent CLI', async t => {
  const f = await setup(t); writeFileSync(f.verifier, 'process.exit(0);');
  const cli = fileURLToPath(new URL('../cli.js', import.meta.url)), request = join(f.root, 'request.json');
  writeFileSync(request, JSON.stringify({ schemaVersion: 1, baselineSkill: f.old, candidateSkill: f.skill,
    bench: f.bench, agent: 'codex', purpose: 'development', trials: 1, maxCalls: 2, runsRoot: f.base.runsRoot, runGroup: f.base.runGroup }));
  // Shadow the real agent even if the gate regresses; this test cannot reach it.
  const bin = join(f.root, 'bin'), sentinel = join(f.root, 'fake-agent-started'); mkdirSync(bin);
  const fake = join(bin, process.platform === 'win32' ? 'codex.cmd' : 'codex');
  writeFileSync(fake, process.platform === 'win32' ? `@echo offline>"${sentinel}"\r\n@exit /b 1\r\n` :
    `#!${process.execPath}\nimport{writeFileSync}from'node:fs';writeFileSync(${JSON.stringify(sentinel)},'unexpected');process.exit(1);\n`);
  chmodSync(fake, 0o755);
  const invoke = (args: string[]) => spawnSync(process.execPath, [cli, 'eval', '--request', request, ...args], {
    encoding: 'utf8', timeout: 20_000, env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH ?? ''}` } });
  const preview = invoke(['--dry-run']); assert.equal(preview.status, 0, preview.stderr);
  const plan = JSON.parse(preview.stdout).plan;
  const executed = invoke(['--yes', '--plan-sha', plan.sha256]);
  assert.equal(executed.status, 2, executed.stderr); assert.match(executed.stderr, /Case preflight: blocked/);
  const result = JSON.parse(executed.stdout);
  assert.equal(result.error.code, 'CASE_PREFLIGHT_FAILED'); assert.equal(result.casePreflight.status, 'blocked');
  assert.ok(result.casePreflight.checks.some((c: { code: string; status: string }) => c.code === 'UNTOUCHED_FIXTURE' && c.status === 'FAIL'));
  assert.equal(result.acceptance.eligibleForUpgrade, false); assert.equal(result.acceptance.automaticUpgrade, false);
  assert.ok(!existsSync(f.base.runsRoot));
  assert.ok(!existsSync(sentinel));
});
