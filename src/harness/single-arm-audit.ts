import { assertScopeMatches, requestedClaimFor } from './measurement-scope.js';
import { retainedModelIdentities } from './model-identity-evidence.js';
import { assertModelIdentity, modelIdentities, type ModelCall } from './model-identity.js';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { loadBench, selectBenchTasks } from './bench.js';
import { summarizeCosts, type CostObservation } from './costs.js';
import { readComponentJson, record } from './eval-contract.js';
import { hashFileSet, sha256File, sha256Text } from './hash.js';
import { packageFiles, packageMember } from './replay-package.js';
import { verifyInputSnapshot } from './input-snapshot.js';
import { assertRecordedAgentEnvironment } from './agent-preflight-contract.js';
import { runVerifier } from './verifier.js';
import { verdictFromOutput } from './verifier-summary.js';
import { triggerMetrics, type TriggerTaskSummary } from './trigger-summary.js';
import { collectInstalledSkillFingerprint } from './bundle.js';
import { assertSpendingCanContinue, parseSpendingBudget, spendingBudgetState } from './eval-budget.js';
import { parseTriggerDetection, parseTriggerEvidence } from './trigger-contract.js';

function integer(value: unknown, label: string): number {
  assert.ok(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0, `Invalid ${label}.`);
  return value;
}
function receipt(value: unknown, invoked: boolean): CostObservation & Record<string, unknown> {
  const row = record(value, 'single-arm receipt');
  assert.equal(typeof row.passed, 'boolean');
  assert.ok(row.error === null || typeof row.error === 'string');
  assert.ok(typeof row.durationSeconds === 'number' && Number.isFinite(row.durationSeconds) && row.durationSeconds >= 0);
  if (row.executorInvoked !== undefined) assert.equal(row.executorInvoked, invoked, 'Receipt invocation differs from its ledger.');
  const status = row.usageStatus ?? 'unknown';
  assert.ok(['final', 'partial', 'unknown'].includes(String(status)));
  assert.ok(row.error !== null || invoked, 'An uninvoked receipt cannot establish a graded task outcome.');
  if (row.score !== null && row.score !== undefined) assert.ok(typeof row.score === 'number' && Number.isFinite(row.score) && row.score >= 0 && row.score <= 1);
  if (row.checks !== null && row.checks !== undefined) {
    assert.ok(Array.isArray(row.checks)); const names = new Set<string>();
    for (const entry of row.checks) {
      const check = record(entry, 'named check'); assert.ok(typeof check.name === 'string' && check.name.length > 0); assert.equal(typeof check.pass, 'boolean');
      assert.ok(!names.has(check.name), 'Duplicate named check.'); names.add(check.name);
    }
  }
  if (row.tokens != null) {
    const tokens = record(row.tokens, 'receipt tokens');
    for (const key of ['input', 'cachedInput', 'output']) if (tokens[key] !== undefined) integer(tokens[key], `tokens.${key}`);
    if (typeof tokens.cachedInput === 'number' && typeof tokens.input === 'number') assert.ok(tokens.cachedInput <= tokens.input);
  }
  return { ...row, executorInvoked: invoked, usageStatus: status, tokens: row.tokens ?? null } as CostObservation & Record<string, unknown>;
}
function unknownReceipt(): CostObservation {
  return { executorInvoked: true, passed: false, error: 'Invocation receipt missing or invalid; raw evidence retained.', durationSeconds: NaN, tokens: null, usageStatus: 'unknown' };
}
function workdir(value: unknown, arm: 'baseline' | 'installed'): string {
  assert.equal(typeof value, 'string');
  const path = (value as string).split(/[\\/]/).slice(-3).join('/');
  assert.match(path, new RegExp(`^[a-zA-Z0-9][a-zA-Z0-9._-]*/${arm}/trial-[1-9][0-9]*$`));
  return path;
}

/** Broken evidence cannot erase known spending or turn a lost receipt into zero. */
function retainedUsage(root: string, mode: 'calibration' | 'trigger' | null) {
  const rows: CostObservation[] = [], invalidReceipts: { path: string; reason: string }[] = [];
  let missing = 0, ledgerComplete = true;
  const path = join(root, '_calls.jsonl');
  let lines: string[] = [];
  try { lines = readFileSync(path, 'utf8').trim().split('\n').filter(Boolean); }
  catch { ledgerComplete = false; }
  for (const line of lines) {
    let event: Record<string, unknown>;
    try { event = record(JSON.parse(line), 'ledger'); } catch { ledgerComplete = false; continue; }
    if (event.event !== 'started' || event.role !== 'agent') continue;
    let trial = '(invalid invocation workspace)';
    try {
      const recordedArm = typeof event.workdir === 'string' ? event.workdir.split(/[\\/]/).at(-2) : null;
      const expectedArm = mode === 'trigger' ? 'installed' : mode === 'calibration' ? 'baseline' : recordedArm;
      assert.ok(expectedArm === 'baseline' || expectedArm === 'installed'); trial = workdir(event.workdir, expectedArm);
      const file = `${trial}/_result.json`;
      if (!existsSync(join(root, file))) { missing++; rows.push(unknownReceipt()); continue; }
      const r = receipt(readComponentJson(packageMember(root, file)).value, true), [taskId, arm, trialName] = trial.split('/');
      assert.equal(r.taskId, taskId); assert.equal(r.trial, Number(trialName!.slice(6)));
      if (arm === 'baseline') assert.equal(r.condition, 'baseline');
      rows.push(r);
    } catch (error) {
      missing++; rows.push(unknownReceipt()); invalidReceipts.push({ path: trial, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return { population: summarizeCosts({ baseline: rows, treatment: [] }, { baseline: [], treatment: [] }).attempts.baseline,
    startedAgentDispatches: rows.length, invocationsWithUnknownReceipts: missing, ledgerComplete,
    ...(invalidReceipts.length ? { invalidReceipts } : {}) };
}

/** A native single-arm audit verifies retained observations, never paired efficacy or adoption. */
export async function auditSingleArmEvaluation(runDir: string, options: { replay?: boolean; benchDir?: string } = {}) {
  const root = resolve(runDir), reasons: string[] = [], observations: CostObservation[] = [];
  let indexedFiles = 0, receipts = 0, missingReceipts = 0, replayedDeliveries = 0, mode: 'calibration' | 'trigger' | null = null;
  let source: Record<string, unknown> | null = null, plan: Record<string, unknown> | null = null;
  try {
    plan = record(readComponentJson(join(root, '_plan.json')).value, 'native plan');
    assert.equal(plan.schemaVersion, 1);
    if (plan.modelIdentityProtocol !== undefined) assert.equal(plan.modelIdentityProtocol, 1, 'Unsupported model identity protocol.'); assert.equal(typeof plan.packageVersion, 'string');
    assert.ok(Array.isArray(plan.inputs), 'Native input fingerprints are missing.');
    const inputs: Record<string, unknown>[] = plan.inputs as Record<string, unknown>[];
    for (const label of ['bench', 'target', 'implementation']) {
      const matches: Record<string, unknown>[] = inputs.filter(input => input.label === label);
      assert.equal(matches.length, 1, `Missing or repeated pinned input: ${label}`);
      const input = matches[0]!; assert.equal(typeof input.root, 'string'); assert.match(String(input.sha256), /^[a-f0-9]{64}$/);
      assert.ok(Array.isArray(input.files) && input.files.every((path: unknown) => typeof path === 'string'));
      assert.deepEqual([...new Set(input.files)].sort(), input.files, 'Pinned input files must be sorted and unique.');
    }
    const details = record(plan.details, 'native details');
    assert.ok(details.mode === 'calibration' || details.mode === 'trigger', 'Not a single-arm native run.');
    mode = details.mode;
    const triggerDetection = mode === 'trigger' ? parseTriggerDetection(details.triggerDetection) : null;
    if (mode === 'trigger' && details.executor !== undefined) assert.deepEqual(parseTriggerDetection(record(details.executor, 'planned executor').triggerDetection), triggerDetection,
      'Executor trigger protocol differs from the native plan.');
    assert.ok(integer(details.trials, 'native trials') >= 1 && Number(details.trials) <= 20, 'Native trials must be between 1 and 20.');
    const arm = mode === 'calibration' ? 'baseline' : 'installed';
    const session = record(readComponentJson(join(root, '_session.json')).value, 'native session');
    const planSha256 = sha256File(join(root, '_plan.json'));
    assert.equal(session.schemaVersion, 1); assert.equal(session.planSha256, planSha256);
    assert.ok(['completed', 'stopped', 'incomplete'].includes(String(session.status)));
    assert.ok(session.stopReason === null || typeof session.stopReason === 'string');
    if (session.status === 'stopped') assert.ok(typeof session.stopReason === 'string' && session.stopReason.length > 0);
    const started = integer(session.callsStarted, 'callsStarted'), finished = integer(session.callsFinished, 'callsFinished');
    const planned = integer(session.plannedCalls, 'plannedCalls'), maximum = integer(session.maxCalls, 'maxCalls');
    assert.ok(planned > 0 && finished <= started && started <= planned && planned <= maximum);
    assert.equal(plan.plannedCalls, planned); assert.equal(plan.maxCalls, maximum);
    if (session.status === 'completed') { assert.equal(finished, planned); assert.equal(session.stopReason, null); }
    const index = record(readComponentJson(join(root, '_artifacts.json')).value, 'native artifact index');
    assert.equal(index.schemaVersion, 1); assert.equal(index.planSha256, planSha256);
    const files = record(index.files, 'native files'); assert.deepEqual(index.links, {}, 'Single-arm replay requires portable regular files.');
    assert.deepEqual(packageFiles(root).filter(path => path !== '_artifacts.json'), Object.keys(files).sort(), 'Native artifact file inventory changed.');
    for (const [path, hash] of Object.entries(files)) { assert.equal(sha256File(packageMember(root, path)), hash, `Native evidence hash mismatch: ${path}`); indexedFiles++; }
    assert.ok(files['_plan.json'] && files['_session.json'], 'Native plan and session must be sealed.');
    const snapshot = verifyInputSnapshot(root, plan);
    if (details.agentPreflight !== undefined) assertRecordedAgentEnvironment(details.agentPreflight);
    const summaryName = mode === 'calibration' ? '_calibration.json' : 'manifest.json';
    if (existsSync(join(root, summaryName))) {
      source = record(readComponentJson(join(root, summaryName)).value, 'single-arm summary');
      assert.deepEqual(source.experiment, session, 'Summary experiment differs from native session.');
      assert.equal(source.trials, details.trials); assert.ok(Array.isArray(source.tasks));
      if (mode === 'calibration') assert.equal(source.inputMode, details.inputMode);
      else {
        assert.deepEqual(source.executor, details.executor, 'Summary executor differs from native plan.');
        const skill = record(source.skill, 'trigger Skill'), target = (plan.inputs as Record<string, unknown>[]).find(input => input.label === 'target')!;
        if (skill.installedSha256 !== undefined) { assert.equal(skill.installedSha256, target.sha256); assert.deepEqual(skill.installedFiles, target.files); }
        if (details.skillInstallDir !== undefined) assert.equal(source.skillInstallDir, details.skillInstallDir);
        if (details.detection !== undefined) assert.equal(source.detection, details.detection);
        assert.deepEqual(parseTriggerDetection(source.triggerDetection), triggerDetection, 'Summary trigger protocol differs from the native plan.');
        if (details.competition !== undefined) {
          const competition = record(details.competition, 'planned competition');
          assert.deepEqual(source.competition, { mode: competition.mode, skills: (competition.skills as Record<string, unknown>[]).map(skill => ({ name: skill.name, sha256: skill.sha256 })) });
        }
      }
    } else assert.notEqual(session.status, 'completed', 'Completed run has no final summary.');
    const benchRoot = options.benchDir ?? snapshot?.roots.get('bench');
    const bench = benchRoot ? loadBench(benchRoot) : null;
    if (options.replay) assert.ok(bench, 'Replay needs the sealed bench or an explicit matching --bench.');
    if (source && mode === 'trigger' && bench) assert.equal(record(source.bench, 'trigger bench').contentSha256, bench.contentSha256, 'Replay bench differs from frozen trigger input.');
    if (bench && snapshot) assert.equal(bench.contentSha256, loadBench(snapshot.roots.get('bench')!).contentSha256, 'Replay bench differs from the sealed input.');
    if (bench && !snapshot) {
      const input = (plan.inputs as Record<string, unknown>[]).find(input => input.label === 'bench'); assert.ok(input && Array.isArray(input.files));
      assert.equal(hashFileSet(bench.dir, input.files as string[]), input.sha256, 'Replay bench differs from pinned native input.');
    }
    const selectedIds = details.taskIds === undefined ? bench?.tasks.map(task => task.id) : details.taskIds as string[];
    if (selectedIds) {
      assert.ok(Array.isArray(selectedIds) && selectedIds.length > 0 && selectedIds.every(id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(id)), 'Invalid native task IDs.');
      assert.equal(new Set(selectedIds).size, selectedIds.length, 'Repeated native task ID.');
      if (bench) assert.ok(selectedIds.every(id => bench.tasks.some(task => task.id === id)), 'Native task selection includes a task outside the pinned bench.');
    }
    if (source?.measurementScope !== undefined || details.measurementScope !== undefined) {
      assert.ok(snapshot && bench && selectedIds, 'measurementScope requires sealed bench inputs and task selection.');
      const frozen = loadBench(snapshot.roots.get('bench')!);
      assertScopeMatches(details.measurementScope, selectBenchTasks(frozen, selectedIds), requestedClaimFor(mode));
      if (source) assert.deepEqual(source.measurementScope, details.measurementScope, 'Summary measurementScope differs from native plan.');
      if (details.reviewedPlan !== undefined) {
        const r = record(details.reviewedPlan, 'reviewed plan');
        const s = mode === 'calibration' ? r.measurementScope : record(r.evaluation, 'reviewed evaluation').measurementScope;
        assert.deepEqual(s, details.measurementScope, 'Reviewed measurementScope differs from native plan.');
      }
    }
    const taskIds = mode === 'trigger' && bench ? bench.tasks.filter(task => selectedIds?.includes(task.id) && task.shouldTrigger !== undefined).map(task => task.id) : selectedIds;
    if (taskIds) assert.equal(taskIds.length * Number(details.trials), planned, 'Native task/trial count differs from planned calls.');
    if (source && taskIds) assert.deepEqual((source.tasks as Record<string, unknown>[]).map(task => task.id), taskIds, 'Summary task identities differ from the native plan.');
    if (source) assert.equal((source.tasks as unknown[]).length * integer(source.trials, 'trials'), planned);
    if (details.reviewedPlan !== undefined) {
      const saved = record(details.reviewedPlan, 'reviewed plan');
      const { sha256, planSha256: calibrationHash, ...reviewed } = saved;
      assert.equal(sha256Text(JSON.stringify(reviewed)), mode === 'calibration' ? calibrationHash : sha256, 'Reviewed plan hash changed.');
      assert.equal(reviewed.kind, mode === 'calibration' ? 'skillfit.calibration-plan' : 'skillfit.eval-plan');
      const implementation = (plan.inputs as Record<string, unknown>[]).find(input => input.label === 'implementation');
      assert.equal(implementation?.sha256, reviewed.implementationSha256, 'Reviewed implementation differs from native inputs.');
      const e = mode === 'calibration' ? reviewed : record(reviewed.evaluation, 'reviewed evaluation');
      if (mode === 'calibration') assert.equal(details.mode, mode);
      else assert.equal(e.mode, mode);
      assert.equal(e.plannedCalls, planned); assert.equal(e.maxCalls, maximum);
      assert.equal(e.trials, details.trials); assert.deepEqual(e.agentPreflight, details.agentPreflight);
      assert.deepEqual(e.spendingBudget, details.spendingBudget);
      assert.equal(e.executorTimeoutSeconds, details.executorTimeoutSeconds);
      assert.deepEqual(e.executor, details.executor);
      if (mode === 'calibration') assert.equal(e.inputMode, details.inputMode);
      else {
        assert.equal(e.installDir, details.skillInstallDir); assert.deepEqual(e.competition, details.competition); assert.equal(e.detection, details.detection);
        assert.deepEqual(parseTriggerDetection(e.triggerDetection), triggerDetection, 'Reviewed trigger protocol differs from the native plan.');
        const target = (plan.inputs as Record<string, unknown>[]).find(input => input.label === 'target')!;
        assert.deepEqual(e.installedFingerprint, { sha256: target.sha256, files: target.files });
        if (source) assert.equal(record(e.target, 'reviewed target').sha256, record(source.skill, 'trigger Skill').bundleSha256);
      }
      if (bench) { assert.equal(record(e.bench, 'reviewed bench').sha256, bench.contentSha256); if (selectedIds) assert.deepEqual(record(e.bench, 'reviewed bench').taskIds, selectedIds); }
    }
    const ledger = existsSync(join(root, '_calls.jsonl')) ? readFileSync(join(root, '_calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => record(JSON.parse(line), 'call ledger')) : [];
    const calls = new Map<number, { path: string; done: boolean }>();
    for (const event of ledger) {
      const call = integer(event.call, 'ledger call'); assert.ok(call > 0);
      if (event.event === 'started') {
        assert.equal(event.role, 'agent', 'Single-arm runs cannot contain judge calls.'); assert.equal(call, calls.size + 1); assert.ok(!calls.get(call - 1) || calls.get(call - 1)!.done);
        const path = workdir(event.workdir, arm); assert.ok(![...calls.values()].some(value => value.path === path), 'Duplicate invocation workspace.');
        assert.match(String(event.promptSha256), /^[a-f0-9]{64}$/); assert.equal(sha256File(packageMember(root, `${path}/_prompt.txt`)), event.promptSha256, 'Invocation prompt differs from ledger.');
        calls.set(call, { path, done: false });
      } else { assert.ok(event.event === 'finished' || event.event === 'failed'); const startedCall = calls.get(call); assert.ok(startedCall && !startedCall.done); startedCall.done = true; }
    }
    assert.equal(calls.size, started); assert.equal([...calls.values()].filter(call => call.done).length, finished);
    const rows = new Map<string, CostObservation & Record<string, unknown>>();
    const cohortIds = source ? (source.tasks as Record<string, unknown>[]).map(task => String(task.id)) : taskIds as string[] | undefined;
    const expectedPaths = cohortIds && details.trials !== undefined ? cohortIds.flatMap(id => Array.from({ length: Number(details.trials) }, (_, i) => `${id}/${arm}/trial-${i + 1}`)) : [...calls.values()].map(call => call.path);
    const invokedPaths = new Set([...calls.values()].map(call => call.path));
    for (const path of new Set([...expectedPaths, ...invokedPaths])) {
      assert.match(path, new RegExp(`^[a-zA-Z0-9][a-zA-Z0-9._-]*/${arm}/trial-[1-9][0-9]*$`));
      const [taskId, , trialName] = path.split('/'), trial = Number(trialName!.slice(6));
      if (taskIds) assert.ok((taskIds as unknown[]).includes(taskId), 'Invocation task is outside the native task set.');
      if (details.trials !== undefined) assert.ok(trial <= Number(details.trials), 'Invocation trial exceeds native plan.');
      const file = `${path}/_result.json`, invoked = invokedPaths.has(path);
      if (!files[file]) {
        if (session.status === 'completed' && source) reasons.push(`Summary receipt not sealed: ${file}`);
        if (invoked) { missingReceipts++; rows.set(path, unknownReceipt() as CostObservation & Record<string, unknown>); }
        continue;
      }
      let r: CostObservation & Record<string, unknown>;
      try { r = receipt(readComponentJson(packageMember(root, file)).value, invoked); }
      catch (error) {
        if (session.status === 'completed') reasons.push(`Invalid summary receipt ${file}: ${String(error)}`);
        if (invoked) { missingReceipts++; rows.set(path, unknownReceipt() as CostObservation & Record<string, unknown>); }
        continue;
      }
      if (plan.modelIdentityProtocol === 1 && r.executorInvoked) assert.ok(r.modelIdentity !== undefined, 'New model identity receipt is missing.');
      const transcriptName = `${path}/_transcript.jsonl`;
      const transcript = files[transcriptName] ? readFileSync(packageMember(root, transcriptName), 'utf8') : undefined;
      assertModelIdentity(r.modelIdentity, transcript, details.executor, typeof record(plan.configuredSettings ?? {}, 'settings').model === 'string' ? String(record(plan.configuredSettings, 'settings').model) : null);
      assert.equal(r.taskId, taskId); assert.equal(r.trial, trial); if (mode === 'calibration') assert.equal(r.condition, 'baseline');
      if (mode === 'trigger') {
        assert.ok(r.triggered === true || r.triggered === false || r.triggered === null);
        assert.deepEqual(parseTriggerDetection(r.triggerDetection), triggerDetection, 'Receipt trigger protocol differs from the native plan.');
        if (triggerDetection) {
          assert.deepEqual(parseTriggerDetection(record(r.executor, 'receipt executor').triggerDetection), triggerDetection,
            'Receipt executor trigger protocol differs from the native plan.');
          const e = parseTriggerEvidence(r.triggerEvidence, triggerDetection);
          assert.equal(r.triggered, e.status === 'unknown' ? null : e.status === 'observed', 'Receipt trigger boolean differs from its evidence.');
          if (e.eventLines.length) {
            const transcript = packageMember(root, `${path}/_transcript.jsonl`);
            assert.ok(files[`${path}/_transcript.jsonl`], 'Trigger evidence transcript is not sealed.');
            const lines = readFileSync(transcript, 'utf8').split('\n');
            assert.ok(e.eventLines.every(line => line <= lines.length && lines[line - 1]!.trim()), 'Trigger evidence line is outside the retained transcript.');
          }
        }
        if (source) {
          const skill = record(source.skill, 'trigger Skill');
          if (skill.installedSha256 !== undefined) {
            assert.equal(r.skillInstalledSha256, skill.installedSha256); assert.deepEqual(r.skillInstalledFiles, skill.installedFiles);
            const at = r.skillInstalledAt;
            assert.ok(typeof at === 'string' && !isAbsolute(at) && !/^[A-Za-z]:/.test(at) && !at.split(/[\\/]/).some(part => !part || part === '.' || part === '..'));
            assert.equal(at.replaceAll('\\', '/'), `${String(source.skillInstallDir).replaceAll('\\', '/')}/${skill.name}`);
            const installed = collectInstalledSkillFingerprint(join(root, path, at));
            assert.equal(installed.sha256, skill.installedSha256, 'Retained installed Skill differs from its invocation fingerprint.');
            assert.deepEqual(installed.files, skill.installedFiles);
          }
        }
      }
      receipts++; rows.set(path, r);
    }
    for (const call of calls.values()) observations.push(rows.get(call.path) ?? unknownReceipt());
    if (bench && options.replay) for (const [path, r] of rows) {
      if (r.error === null) {
        const task = bench.tasks.find(task => task.id === r.taskId); assert.ok(task);
        const scratch = mkdtempSync(join(tmpdir(), 'skillfit-single-replay-'));
        try {
          cpSync(join(root, path), scratch, { recursive: true, filter: file => basename(file) !== '.git' });
          const grade = await runVerifier(bench.dir, task.verifier, scratch, task.verifierTimeoutSeconds), verdict = verdictFromOutput(grade.output);
          assert.equal(grade.error, null, `Replay verifier failed: ${grade.error}`); assert.notEqual(grade.exitCode, null);
          assert.equal(grade.exitCode === 0, r.passed, 'Replay task verdict differs from retained delivery.');
          if (r.verifierExitCode !== undefined) assert.equal(grade.exitCode, r.verifierExitCode);
          assert.equal(verdict?.score ?? null, r.score); assert.deepEqual(verdict?.checks?.map(check => ({ name: check.name, pass: check.pass })) ?? null, r.checks);
          replayedDeliveries++;
        } finally { rmSync(scratch, { recursive: true, force: true }); }
      }
    }
    if (details.spendingBudget !== undefined) {
      const limits = parseSpendingBudget(details.spendingBudget), events = existsSync(join(root, '_budget.jsonl')) ? readFileSync(join(root, '_budget.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
      const observed: CostObservation[] = [], budgetInvocations: string[] = [];
      // Setup refusals also have before/after events, but do not spend an Agent call.
      for (let i = 0; i < events.length; i += 2) {
        const event = record(events[i], 'budget before-call'), path = `${event.taskId}/${arm}/trial-${event.trial}`;
        assert.equal(path, expectedPaths[i / 2], 'Budget event differs from the frozen task/trial order.');
        const identity = { taskId: event.taskId, condition: arm, trial: event.trial }, before = spendingBudgetState(limits, observed);
        assert.deepEqual(event, { phase: 'before-call', ...identity, state: before }, 'Budget before-call differs from receipts.');
        const after = events[i + 1], row = rows.get(path);
        if (after === undefined) {
          assert.notEqual(session.status, 'completed', 'Completed budget has no after-call event.');
          if (invokedPaths.has(path)) { assertSpendingCanContinue(before); budgetInvocations.push(path); }
          continue;
        }
        assertSpendingCanContinue(before); assert.ok(row, 'Budget attempt has no retained receipt.');
        observed.push(row);
        assert.deepEqual(after, { phase: 'after-call', ...identity, state: spendingBudgetState(limits, observed) }, 'Budget after-call differs from receipts.');
        if (row.executorInvoked) budgetInvocations.push(path);
      }
      assert.deepEqual(budgetInvocations, [...calls.values()].map(call => call.path), 'Budget invocation coverage differs from the native ledger.');
      if (session.status === 'completed') assert.equal(events.length, expectedPaths.length * 2, 'Completed budget does not cover the cohort.');
    }
    if (source) {
      const summaries = (source.tasks as Record<string, unknown>[]).map(task => {
        const records = expectedPaths.filter(path => path.startsWith(`${task.id}/`)).map(path => rows.get(path)).filter((row): row is CostObservation & Record<string, unknown> => row?.taskId !== undefined);
        const errors = records.filter(row => row.error !== null).length, completed = records.length - errors, passes = records.filter(row => row.error === null && row.passed).length;
        if (mode === 'calibration') { assert.deepEqual({ id: task.id, passes, completed, errors }, task, 'Calibration summary differs from receipts.'); return null; }
        const valid = records.filter(row => row.error === null), totals = records.filter(row => row.tokens).reduce((total, row) => ({ input: total.input + (row.tokens?.input ?? 0), output: total.output + (row.tokens?.output ?? 0) }), { input: 0, output: 0 });
        const result: TriggerTaskSummary = { id: String(task.id), shouldTrigger: Boolean(task.shouldTrigger), ...(task.triggerClass ? { triggerClass: task.triggerClass as TriggerTaskSummary['triggerClass'] } : {}),
          runs: valid.filter(row => row.triggered !== null).length, fired: valid.filter(row => row.triggered === true).length,
          unknown: valid.filter(row => row.triggered === null).length, errors, passes, tokens: records.some(row => row.tokens) ? totals : null };
        if (bench) { const definition = bench.tasks.find(row => row.id === task.id)!; assert.equal(result.shouldTrigger, definition.shouldTrigger); assert.equal(result.triggerClass, definition.triggerClass); }
        assert.deepEqual(result, task, 'Trigger summary differs from retained observations.'); return result;
      });
      if (mode === 'trigger') assert.deepEqual(JSON.parse(JSON.stringify(triggerMetrics(summaries as TriggerTaskSummary[]))), source.metrics, 'Trigger metrics differ from retained observations.');
      if (source.modelIdentities !== undefined) {
        const calls: ModelCall[] = [...rows.entries()].filter(([, row]) => row.executorInvoked).map(([path, row]) => ({ receipt: `${path}/_result.json`, identity: row.modelIdentity as import('./model-identity.js').ModelIdentity ?? null }));
        assert.deepEqual(source.modelIdentities, modelIdentities(calls), 'Single-arm model identity summary differs from receipts.');
      } else assert.ok(plan.modelIdentityProtocol !== 1 || [...rows.values()].every(row => !row.executorInvoked), 'New model identity summary is missing.');
      if (source.costs !== undefined) assert.deepEqual(source.costs,
        summarizeCosts({ baseline: [...rows.values()], treatment: [] }, { baseline: [], treatment: [] }), 'Single-arm cost summary differs from its invocation receipts.');
    }
  } catch (error) { reasons.push(error instanceof Error ? error.message : String(error)); }
  const costs = summarizeCosts({ baseline: observations, treatment: [] }, { baseline: [], treatment: [] });
  const retained = reasons.length ? retainedUsage(root, mode) : null;
  return { modelIdentities: retainedModelIdentities(root), evidence: { verified: reasons.length === 0, runDir: root, scope: 'single-arm-native', reasons, indexedFiles, receipts, replayedDeliveries,
      replayRequested: options.replay ?? false, observationsReused: true, modelCalls: 0,
      limitation: 'Single-arm observations and local delivery grading only; no new trigger detection, paired comparison, billing claim or upgrade authorization.' },
    usage: { ...(retained?.population ?? costs.attempts.baseline), startedAgentDispatches: retained?.startedAgentDispatches ?? observations.length,
      invocationsWithUnknownReceipts: retained?.invocationsWithUnknownReceipts ?? missingReceipts,
      ...(retained ? { ledgerComplete: retained.ledgerComplete, ...(retained.invalidReceipts ? { invalidReceipts: retained.invalidReceipts } : {}) } : {}),
      scope: reasons.length ? 'Unaudited retained invocation receipts only; invalid/missing receipts remain unknown. A broken ledger may leave additional dispatches uncounted. No verified total, paired cost change or exact bill.'
        : 'Retained single-arm invocation receipts only; absent usage and cache partitions remain unknown. No paired cost change or exact bill.' },
    inputSnapshot: plan?.inputSnapshot ?? null, casePreflight: plan?.details ? record(plan.details, 'native details').casePreflight ?? null : null };
}
