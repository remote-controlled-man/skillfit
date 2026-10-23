import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runBenchInit } from '../commands/bench.js';
import { buildEvalPlan, resolveEvalInputs } from './eval-planning.js';
import type { EvalPreview } from './eval-options.js';

// Captured before A3 from the public planner, with paths and implementation fixed.
// The digest is an independent Python SHA-256 reference of the recorded wire bytes.
const frozenWire = "{\"schemaVersion\":1,\"kind\":\"skillfit.eval-plan\",\"note\":{\"array\":[true,null,1],\"tag\":\"legacy-context\"},\"implementationSha256\":\"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff\",\"evaluation\":{\"measurementScope\":{\"schemaVersion\":1,\"benchSchemaVersion\":2,\"taskClaims\":[{\"taskId\":\"example-task\",\"claims\":[\"quality\",\"efficiency\",\"activation\"]}],\"requestedClaim\":\"quality\",\"assessment\":\"supported\"},\"mode\":\"inject\",\"agentPreflight\":{\"schemaVersion\":1,\"kind\":\"skillfit.agent-preflight\",\"scope\":\"offline-agent-environment\",\"status\":\"ready\",\"matrix\":{\"schemaVersion\":1,\"verifiedAt\":\"2026-10-22T02:31:00Z\"},\"checks\":[{\"code\":\"EXECUTOR_INJECTED\",\"status\":\"UNKNOWN\",\"message\":\"Injected executor: installed CLI availability and runtime capabilities are not attested.\",\"remediation\":null,\"paths\":[],\"role\":\"agent\",\"agent\":\"codex\"},{\"code\":\"MATRIX_CAPABILITY\",\"status\":\"PASS\",\"message\":\"Declared matrix capabilities match this evaluation; installed CLI flag compatibility was not probed.\",\"remediation\":null,\"paths\":[],\"role\":\"agent\",\"agent\":\"codex\"},{\"code\":\"USAGE_CAPABILITY\",\"status\":\"UNKNOWN\",\"message\":\"Final token/cache coverage cannot be confirmed offline for this API or injected executor; runtime spending guards still require complete final counters.\",\"remediation\":null,\"paths\":[],\"role\":\"agent\",\"agent\":\"codex\"},{\"code\":\"AUTHENTICATION\",\"status\":\"UNKNOWN\",\"message\":\"Login and credential validity cannot be confirmed offline; no authentication command, credential file or network probe was used.\",\"remediation\":\"Confirm authentication separately before authorizing a live run.\",\"paths\":[],\"role\":\"agent\",\"agent\":\"codex\"},{\"code\":\"GLOBAL_SKILL_CONFLICT\",\"status\":\"PASS\",\"message\":\"No matching Skill was found among readable direct entries of matrix-listed user/global Skill roots.\",\"remediation\":null,\"paths\":[],\"role\":\"agent\",\"agent\":\"codex\"},{\"code\":\"GLOBAL_SKILL_SCAN\",\"status\":\"INFO\",\"message\":\"Only matrix-listed user/global roots were inspected. Inherited project, plugin and unlisted Skill scopes remain uncontrolled.\",\"remediation\":null,\"paths\":[\"/frozen/.agents/skills\",\"/frozen/.codex/skills\"],\"role\":\"agent\",\"agent\":\"codex\"}],\"summary\":{\"failures\":0,\"passed\":2,\"unknown\":3,\"info\":1},\"cost\":{\"modelCalls\":0,\"cliInvocations\":0}},\"casePreflight\":{\"schemaVersion\":1,\"scope\":\"offline-case-integrity\",\"required\":true,\"status\":\"pending\"},\"inputSnapshot\":{\"schemaVersion\":1,\"required\":true,\"status\":\"pending\"},\"target\":{\"kind\":\"skill\",\"name\":\"target\",\"sourceDir\":\"/frozen/target\",\"sha256\":\"38a272fbd55d1d9a97dd62cbc1b2580e78a6770a130ea7d3c3f6fd55354a1ca5\",\"files\":[\"SKILL.md\"]},\"baseline\":null,\"bench\":{\"name\":\"bench\",\"dir\":\"/frozen/bench\",\"sha256\":\"3e737f0b9111149f1f37e294e13aa304ea7e94a54394aff6cfde4a752b216c11\",\"taskIds\":[\"example-task\"]},\"executor\":{\"kind\":\"cli\",\"model\":\"offline-parity\",\"sampling\":null},\"judge\":null,\"inputMode\":\"snapshot\",\"installDir\":null,\"trials\":2,\"plannedCalls\":4,\"maxCalls\":8,\"pairOrder\":\"baseline-first\",\"executorTimeoutSeconds\":600,\"outputDir\":\"/frozen/runs/inject\"}}";
const expectedSha256 = "1567af4bf0eaf77f586d172de208c5bbee14c31f97e310efc8f1fbf66724104a";

test('pure plan construction preserves pre-A3 wire bytes, legacy context and digest', () => {
  const { evaluation, note, implementationSha256 } = JSON.parse(frozenWire);
  const plan = buildEvalPlan({ preview: evaluation as EvalPreview }, implementationSha256,
    { kind: 'legacy', fields: { note } });
  const { sha256, ...data } = plan;
  assert.equal(JSON.stringify(data), frozenWire);
  assert.equal(sha256, expectedSha256);
  const changed = buildEvalPlan({ preview: evaluation }, implementationSha256,
    { kind: 'legacy', fields: { note: { ...note, extra: true } } });
  assert.notEqual(changed.sha256, sha256);
});

test('resolution is read-only, injects environment/clock and leaves pure construction independent of source files', async t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-application-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench'), target = join(root, 'target');
  await runBenchInit({ dir: bench, schemaVersion: 2, yes: true, log: () => {} });
  mkdirSync(target); writeFileSync(join(target, 'SKILL.md'), '# Offline target');
  let calls = 0;
  const resolved = resolveEvalInputs({ skillPath: target, bench, dryRun: true, yes: true,
    trials: 1, maxCalls: 2, runsRoot: join(root, 'runs'), sessionOptions: { homeDir: root, env: {} },
    executor: { describe: () => ({ kind: 'mock', model: 'offline' }), run: async () => { calls++; return { output: 'skillfit-ok' }; } },
    judgeExecutor: null, onPlan: () => { throw Error('resolution must not call an entry callback'); },
    log: () => { throw Error('resolution must not display'); } }, { env: {}, now: () => new Date(2026, 9, 22, 1, 2, 3) });
  assert.equal(resolved.preview.outputDir, join(root, 'runs/eval-20261022-010203'));
  assert.equal(resolved.preview.measurementScope?.assessment, 'supported');
  assert.equal(resolved.preview.plannedCalls, 2); assert.equal(calls, 0);
  assert.equal(existsSync(join(root, 'runs')), false);
  const before = buildEvalPlan(resolved, 'f'.repeat(64), { kind: 'ordinary', fields: {} });
  rmSync(bench, { recursive: true }); rmSync(target, { recursive: true });
  assert.deepEqual(buildEvalPlan(resolved, 'f'.repeat(64), { kind: 'ordinary', fields: {} }), before);
});

test('execution rejects changed source and context before case checks, output creation or executor dispatch', async t => {
  const { prepareEvaluation } = await import('./eval-planning.js');
  const { executeEvalPlan } = await import('./eval-service.js');
  const root = mkdtempSync(join(tmpdir(), 'skillfit-plan-drift-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench'), target = join(root, 'target'), runsRoot = join(root, 'runs');
  await runBenchInit({ dir: bench, schemaVersion: 2, yes: true, log: () => {} });
  mkdirSync(target); writeFileSync(join(target, 'SKILL.md'), '# Offline target');
  let calls = 0, dispatches = 0;
  const executor = { describe: () => ({ kind: 'mock' as const, model: 'offline' }),
    run: async () => { calls++; return { output: 'skillfit-ok' }; } };
  const context = { kind: 'legacy' as const, fields: { note: { revision: 1 } } };
  const prepared = prepareEvaluation({ skillPath: target, bench, dryRun: true, yes: true, runGroup: 'drift', runsRoot,
    executor, judgeExecutor: null, trials: 1, maxCalls: 2, sessionOptions: { homeDir: root, env: {} } }, context);
  writeFileSync(join(target, 'SKILL.md'), '# Changed target');
  await assert.rejects(() => executeEvalPlan(prepared.resolved, prepared.assertCurrent,
    { dispatch: () => { dispatches++; } }), /Plan changed before execution/);
  writeFileSync(join(target, 'SKILL.md'), '# Offline target');
  context.fields.note.revision = 2;
  await assert.rejects(() => executeEvalPlan(prepared.resolved, prepared.assertCurrent), /Plan changed before execution/);
  assert.equal(calls, 0); assert.equal(dispatches, 0); assert.equal(existsSync(runsRoot), false);
});

test('legacy reader, preflight and helper exports retain the same implementation and class identity', async () => {
  const [oldPreflight, preflight, oldError, error, oldComponent, oldReport, read, oldSingle, single, oldReplay, runner, types] = await Promise.all([
    import('../commands/eval-preflight.js'), import('./eval-preflight.js'), import('../commands/eval-preflight-error.js'),
    import('./eval-preflight-error.js'), import('../commands/eval-component.js'), import('../commands/evaluation-report.js'),
    import('./eval-read-service.js'), import('../commands/eval-single-arm-report.js'), import('./single-arm-read.js'),
    import('../commands/eval-single-arm-replay.js'), import('./runner.js'), import('./types.js'),
  ]);
  assert.equal(oldPreflight.checkEvalCases, preflight.checkEvalCases);
  assert.equal(oldError.CasePreflightFailed, error.CasePreflightFailed);
  assert.equal(oldComponent.reportEvalComponent, read.readEvaluation);
  assert.equal(oldReport.readEvaluationReport, read.readEvaluation);
  assert.equal(oldSingle.readSingleArmReport, single.readSingleArmReport);
  assert.equal(oldReplay.reportSingleArmEvaluation, single.reportSingleArmEvaluation);
  assert.equal(runner.withSampling, types.withSampling);
});

test('calibration resolves without execution and builds its separate plan after inputs disappear', async t => {
  const { resolveCalibrationInputs, buildCalibrationPlan } = await import('./calibration-service.js');
  const root = mkdtempSync(join(tmpdir(), 'skillfit-calibration-plan-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench');
  await runBenchInit({ dir: bench, yes: true, log: () => {} });
  const resolved = resolveCalibrationInputs({ dir: bench, calibrate: {
    trials: 1, maxCalls: 1, runsRoot: join(root, 'runs'), sessionOptions: { homeDir: root, env: {} },
    executor: { describe: () => ({ kind: 'mock', model: 'offline' }), run: async () => { throw Error('No calls during planning'); } },
  } }, { env: {}, now: () => new Date('2026-10-22T01:02:03.004Z') });
  const plan = buildCalibrationPlan(resolved, 'f'.repeat(64));
  assert.equal(plan.runGroup, 'calibrate-20261022010203004');
  assert.equal(plan.kind, 'skillfit.calibration-plan'); assert.equal(plan.measurementScope?.requestedClaim, null);
  assert.equal('sha256' in plan, false); assert.match(plan.planSha256, /^[a-f0-9]{64}$/);
  rmSync(bench, { recursive: true });
  assert.deepEqual(buildCalibrationPlan(resolved, 'f'.repeat(64)), plan);
  assert.notEqual(buildCalibrationPlan(resolved, 'e'.repeat(64)).planSha256, plan.planSha256);
  assert.equal(existsSync(join(root, 'runs')), false);
});

test('legacy live entries retain default console progress while application planning stays silent', async t => {
  const { runEval } = await import('../commands/eval.js');
  const { runEvalCli } = await import('../commands/eval-cli.js');
  const root = mkdtempSync(join(tmpdir(), 'skillfit-default-display-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = join(root, 'bench'), target = join(root, 'target');
  await runBenchInit({ dir: bench, yes: true, log: () => {} });
  mkdirSync(target); writeFileSync(join(target, 'SKILL.md'), '# Offline target');
  const lines: unknown[][] = [];
  t.mock.method(console, 'log', (...args: unknown[]) => lines.push(args));
  const options = { skillPath: target, bench, dryRun: false, yes: true, trials: 1, maxCalls: 2,
    runsRoot: join(root, 'runs'), sessionOptions: { homeDir: root, env: {} }, judgeExecutor: null,
    executor: { describe: () => ({ kind: 'mock' as const, model: 'offline' }), run: async () => ({ output: 'skillfit-ok' }) } };
  for (const [runGroup, run] of [['raw', runEval], ['cli', runEvalCli]] as const) {
    lines.length = 0;
    await run({ ...options, runGroup });
    assert.ok(lines.some(args => String(args[0]).startsWith('Case preflight: ready')), `${runGroup}: default case progress`);
    assert.ok(lines.some(args => String(args[0]).includes('Experiment plan')), `${runGroup}: default presentation`);
  }
});
