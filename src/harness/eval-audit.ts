import assert from 'node:assert/strict';
import { cpSync, existsSync, lstatSync, mkdtempSync, readFileSync, readlinkSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { loadBench } from './bench.js';
import { summarizeCosts, type CostObservation } from './costs.js';
import { policyHash, parseAcceptancePolicy, readComponentJson, record } from './eval-contract.js';
import { costChanges, type EvidenceAudit } from './eval-acceptance.js';
import { sha256File } from './hash.js';
import { collectInstalledSkillTarget } from './installed-skill.js';
import { runVerifier } from './runner.js';
import { verdictFromOutput } from './verifier-summary.js';
import { parseEvalReport } from '../commands/eval-report.js';

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
}

function member(root: string, path: string): string {
  if (!path || isAbsolute(path) || path.split(/[\\/]/).some(p => p === '..' || p === '.')) throw new Error('Invalid native evidence path.');
  const file = resolve(root, path);
  if (!inside(root, file) || !inside(realpathSync(root), realpathSync(file))) throw new Error('Evidence file escapes its run directory.');
  return file;
}

function receipt(value: unknown): CostObservation & Record<string, unknown> {
  const r = record(value, 'receipt');
  assert.equal(typeof r.executorInvoked, 'boolean'); assert.equal(typeof r.passed, 'boolean');
  assert.ok(r.error === null || typeof r.error === 'string');
  assert.ok(typeof r.durationSeconds === 'number' && Number.isFinite(r.durationSeconds) && r.durationSeconds >= 0);
  assert.ok(['final', 'partial', 'unknown'].includes(String(r.usageStatus)));
  if (r.tokens != null) {
    const tokens = record(r.tokens, 'tokens');
    for (const key of ['input', 'cachedInput', 'output']) if (tokens[key] !== undefined) assert.ok(typeof tokens[key] === 'number' && Number.isFinite(tokens[key]) && tokens[key] >= 0);
    if (typeof tokens.cachedInput === 'number' && typeof tokens.input === 'number') assert.ok(tokens.cachedInput <= tokens.input);
  }
  if (r.checks != null) {
    assert.ok(Array.isArray(r.checks));
    const names = new Set<string>();
    for (const check of r.checks) {
      const c = record(check, 'named check'); assert.ok(typeof c.name === 'string'); assert.equal(typeof c.pass, 'boolean');
      assert.ok(!names.has(c.name)); names.add(c.name);
    }
  }
  return r as unknown as CostObservation & Record<string, unknown>;
}

/** Audit native hashes and recompute all-invocation accounting; replay clones deliveries. */
export async function auditEvaluation(value: unknown, runDir: string, options: { replay?: boolean; benchDir?: string } = {}): Promise<EvidenceAudit> {
  const audit: EvidenceAudit = { verified: false, reasons: [], indexedFiles: 0, receipts: 0, replayedDeliveries: 0, replayRequested: options.replay ?? false, policyBound: false, pairs: [] };
  try {
    const report = parseEvalReport(value), raw = record(value, 'manifest'), root = resolve(runDir);
    if (!report.experiment) throw new Error('Native session metadata is missing.');
    const index = record(readComponentJson(join(root, '_artifacts.json')).value, 'artifact index');
    const files = record(index.files, 'indexed files');
    const links = record(index.links, 'indexed links');
    const actualFiles: string[] = [], actualLinks: string[] = [];
    const walk = (dir: string, prefix = '') => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '.git') continue;
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) actualLinks.push(path);
        else if (entry.isDirectory()) walk(join(dir, entry.name), path);
        else if (entry.isFile() && path !== '_artifacts.json') actualFiles.push(path);
        else if (!entry.isFile()) throw new Error('Unsupported native artifact entry.');
      }
    };
    walk(root);
    assert.deepEqual(actualFiles.sort(), Object.keys(files).sort(), 'Native artifact file inventory changed.');
    assert.deepEqual(actualLinks.sort(), Object.keys(links).sort(), 'Native artifact link inventory changed.');
    for (const [path, sha] of Object.entries(files)) {
      assert.equal(sha256File(member(root, path)), sha, `Native evidence hash mismatch: ${path}`);
      audit.indexedFiles++;
    }
    for (const [path, target] of Object.entries(links)) {
      const link = resolve(root, path);
      assert.ok(inside(root, link) && !path.split(/[\\/]/).includes('..') && !isAbsolute(path));
      assert.ok(lstatSync(link).isSymbolicLink()); assert.equal(readlinkSync(link), target);
    }
    assert.ok(typeof files['manifest.json'] === 'string' && typeof files['_plan.json'] === 'string' && typeof files['_session.json'] === 'string' && typeof files['_calls.jsonl'] === 'string');
    assert.deepEqual(readComponentJson(join(root, 'manifest.json')).value, value, 'Selected manifest differs from native saved manifest.');
    assert.equal(sha256File(join(root, '_plan.json')), report.experiment.planSha256);
    assert.equal(index.planSha256, report.experiment.planSha256);
    assert.deepEqual(readComponentJson(join(root, '_session.json')).value, report.experiment);
    const plan = record(readComponentJson(join(root, '_plan.json')).value, 'native plan');
    const details = record(plan.details, 'native plan details');
    if (raw.component !== undefined) {
      assert.deepEqual(details.component, raw.component, 'Policy metadata differs from the predeclared native plan.');
      const c = record(raw.component, 'component');
      assert.equal(c.schemaVersion, 1);
      assert.equal(c.policySha256, policyHash(parseAcceptancePolicy(c.policy)));
      assert.ok(typeof c.requestSha256 === 'string' && /^[0-9a-f]{64}$/.test(c.requestSha256));
      assert.ok(typeof c.previewSha256 === 'string' && /^[0-9a-f]{64}$/.test(c.previewSha256));
      assert.ok(Array.isArray(plan.inputs));
      const implementation = plan.inputs.find(input => record(input, 'input').label === 'implementation');
      assert.ok(implementation);
      assert.equal(record(implementation, 'implementation').sha256, c.implementationSha256, 'Implementation differs from its approved preview.');
      assert.equal(typeof c.synthetic, 'boolean');
      if (c.synthetic === false) assert.equal(plan.injectedExecutor, false, 'Injected executor cannot claim real component evidence.');
      assert.ok(Array.isArray(plan.guardFiles) && plan.guardFiles.some(file => {
        const guard = record(file, 'request guard');
        return guard.label === 'component request' && guard.sha256 === c.requestSha256;
      }), 'Component request was not frozen by the native session.');
      audit.policyBound = true;
    }
    const all = { baseline: [] as CostObservation[], treatment: [] as CostObservation[] }, paired = { baseline: [] as CostObservation[], treatment: [] as CostObservation[] };
    const bench = options.replay ? loadBench(options.benchDir ?? String(record(raw.bench, 'bench').dir)) : null;
    if (bench) assert.equal(bench.contentSha256, report.bench.sha256, 'Replay bench differs from the frozen task set.');
    let invoked = 0;
    const rawTasks = raw.tasks as Record<string, unknown>[];
    for (const task of report.tasks) {
      assert.ok(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(task.id), 'Unsafe task id.');
      const taskAll = { baseline: [] as CostObservation[], treatment: [] as CostObservation[] }, taskPaired = { baseline: [] as CostObservation[], treatment: [] as CostObservation[] };
      for (let trial = 1; trial <= report.trials; trial++) {
        const pair: Record<string, CostObservation> = {};
        for (const arm of ['baseline', 'treatment'] as const) {
          const rel = `${task.id}/${arm}/trial-${trial}/_result.json`;
          assert.ok(typeof files[rel] === 'string', `Receipt not sealed: ${rel}`);
          const r = receipt(readComponentJson(member(root, rel)).value);
          assert.equal(r.condition, arm); assert.equal(r.taskId, task.id); assert.equal(r.trial, trial);
          audit.receipts++; if (r.executorInvoked) invoked++;
          if (raw.component !== undefined && record(raw.component, 'component').synthetic === false && r.error === null) {
            const timing = record(r.timing, 'CLI timing');
            assert.equal(timing.clock, 'performance.now');
            const execution = record(timing.execution, 'CLI execution timing');
            assert.equal(execution.anomaly, null); assert.equal(execution.timeoutFiredAfterMs, null);
            assert.ok(typeof execution.elapsedMs === 'number' && Number.isFinite(execution.elapsedMs) && execution.elapsedMs >= 0);
            assert.ok(r.durationSeconds >= execution.elapsedMs / 1000 - 0.002, 'CLI elapsed interval exceeds trial duration.');
          }
          all[arm].push(r); taskAll[arm].push(r); pair[arm] = r;
          if (report.skillDelivery && (arm === 'treatment' || report.baselineTarget)) {
            const expected = arm === 'baseline' ? report.baselineTarget!.sha256 : report.target.sha256;
            assert.equal(collectInstalledSkillTarget(join(root, task.id, arm, `trial-${trial}`, report.skillDelivery.installDir, report.target.name)).sha256, expected);
          }
          if (bench && r.error === null) {
            const definition = bench.tasks.find(t => t.id === task.id); assert.ok(definition);
            const scratch = mkdtempSync(join(tmpdir(), 'skillfit-eval-replay-'));
            try {
              cpSync(join(root, task.id, arm, `trial-${trial}`), scratch, { recursive: true, filter: path => basename(path) !== '.git' });
              const grade = await runVerifier(bench.dir, definition.verifier, scratch), summary = verdictFromOutput(grade.output);
              assert.notEqual(grade.exitCode, null); assert.equal(grade.exitCode, r.verifierExitCode); assert.equal(grade.exitCode === 0, r.passed);
              assert.equal(summary?.score ?? null, r.score);
              assert.deepEqual(summary?.checks?.map(c => ({ name: c.name, pass: c.pass })) ?? null,
                Array.isArray(r.checks) ? r.checks.map(c => ({ name: c.name, pass: c.pass })) : null);
              audit.replayedDeliveries++;
            } finally { rmSync(scratch, { recursive: true, force: true }); }
          }
        }
        if (pair.baseline!.error === null && pair.treatment!.error === null) for (const arm of ['baseline', 'treatment'] as const) {
          paired[arm].push(pair[arm]!); taskPaired[arm].push(pair[arm]!);
        }
        const b = pair.baseline! as CostObservation & Record<string, unknown>, t = pair.treatment! as CostObservation & Record<string, unknown>;
        const graded = b.error === null && t.error === null;
        const changes: { name: string; change: 'improved' | 'regressed' }[] = [];
        if (graded && Array.isArray(b.checks) && Array.isArray(t.checks)) {
          assert.deepEqual(b.checks.map(c => c.name).sort(), t.checks.map(c => c.name).sort(), 'Paired named-check identities differ.');
          for (const c of b.checks) {
            const other = t.checks.find(x => x.name === c.name)!;
            if (c.pass !== other.pass) changes.push({ name: c.name, change: other.pass ? 'improved' : 'regressed' });
          }
        }
        const view = (r: CostObservation & Record<string, unknown>) => ({ executorInvoked: r.executorInvoked, passed: r.passed, error: r.error,
          durationSeconds: r.durationSeconds, tokens: r.tokens, usageStatus: r.usageStatus, score: typeof r.score === 'number' ? r.score : null });
        audit.pairs!.push({ taskId: task.id, trial, graded, baseline: view(b), treatment: view(t),
          scoreDelta: graded && typeof b.score === 'number' && typeof t.score === 'number' ? t.score - b.score : null,
          changedChecks: changes, costs: costChanges(summarizeCosts({ baseline: [b], treatment: [t] }, { baseline: graded ? [b] : [], treatment: graded ? [t] : [] })) });
      }
      const source = rawTasks.find(t => t.id === task.id)!;
      assert.deepEqual(summarizeCosts(taskAll, taskPaired), source.costs, `Task ${task.id} cost accounting differs from its receipts.`);
      const outcomes = record(source.outcomes, 'paired outcomes');
      for (const arm of ['baseline', 'treatment'] as const) assert.deepEqual(taskPaired[arm].map(r => r.passed), outcomes[arm]);
    }
    assert.deepEqual(summarizeCosts(all, paired), report.overall.costs, 'Overall cost accounting differs from receipts.');
    const ledger = readFileSync(join(root, '_calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => record(JSON.parse(line), 'ledger'));
    assert.equal(ledger.filter(e => e.event === 'started' && e.role === 'agent').length, invoked);
    assert.equal(ledger.filter(e => e.event === 'started').length, report.experiment.callsStarted);
    // This component does not run a judge whose separate usage would be absent from agent costs.
    assert.ok(raw.judge == null, 'Judge usage is not covered by component accounting.');
    audit.verified = true;
  } catch (error) { audit.reasons.push(error instanceof Error ? error.message : String(error)); audit.policyBound = false; }
  return audit;
}

/** Stopped runs may have no manifest; missing invocation receipts retain unknown spending. */
export function stoppedAccounting(runDir: string) {
  const root = resolve(runDir), all = { baseline: [] as CostObservation[], treatment: [] as CostObservation[] };
  const paired = { baseline: [] as CostObservation[], treatment: [] as CostObservation[] };
  const ledger = existsSync(join(root, '_calls.jsonl')) ? readFileSync(join(root, '_calls.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(line => record(JSON.parse(line), 'ledger')) : [];
  let missingReceipts = 0;
  for (const event of ledger.filter(e => e.event === 'started' && e.role === 'agent')) {
    const parts = String(event.workdir).split(/[\\/]/), trialDir = parts.slice(-3).join('/');
    assert.ok(/^[a-zA-Z0-9][a-zA-Z0-9._-]*\/(baseline|treatment)\/trial-[0-9]+$/.test(trialDir));
    const arm = parts.at(-2) as 'baseline' | 'treatment', file = join(root, trialDir, '_result.json');
    if (existsSync(file)) all[arm].push(receipt(readComponentJson(file).value));
    else { missingReceipts++; all[arm].push({ executorInvoked: true, passed: false, error: 'Invocation receipt missing', durationSeconds: NaN, tokens: null, usageStatus: 'unknown' }); }
  }
  const populations = summarizeCosts(all, paired);
  return { populations, startedAgentDispatches: all.baseline.length + all.treatment.length,
    recordedExecutorInvocations: populations.attempts.baseline.runs + populations.attempts.treatment.runs - missingReceipts,
    invocationsWithUnknownReceipts: missingReceipts,
    scope: 'Known agent invocation spending from stopped-run receipts; missing fields remain unknown. No paired efficacy comparison or exact bill.' };
}
