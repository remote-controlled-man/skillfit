import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, lstatSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { getAgent } from '../agents.js';
import { VERSION } from '../version.js';
import { agentTokenCounters, findExecutable } from '../harness/agent-preflight.js';
import { summarizeCosts, type CostObservation } from '../harness/costs.js';
import { createSpendingBudgetRecorder, parseSpendingBudget, spendingBudgetState, type SpendingBudget } from '../harness/eval-budget.js';
import { parseExecutorTimeoutSeconds } from '../harness/eval-contract.js';
import { assertEvaluationOutputLayout } from '../harness/evaluation-layout.js';
import { executionClock, type ExecutionClock } from '../harness/execution-timing.js';
import { validateCallBudget } from '../harness/experiment-session.js';
import { CliExecutor } from '../harness/executors/cli.js';
import { hashFileSet, sha256Text } from '../harness/hash.js';
import { EvaluationInterrupted, evaluationSignal, throwIfEvaluationInterrupted } from '../harness/interruption.js';
import { RUN_GROUP_PATTERN } from '../harness/constants.js';
import { ExecutorFailure, type Executor, type ExecutorResult } from '../harness/types.js';
import type { ProcessResult } from '../harness/runner.js';
import { parseVerifierTimeoutSeconds } from '../harness/verifier-timeout.js';

export interface BenchDraftOptions {
  agent?: string;
  executor?: Executor;
  maxCalls?: number;
  spendingBudget?: SpendingBudget;
  executorTimeoutSeconds?: number;
  verifierTimeoutSeconds?: number;
  runsRoot?: string;
  runGroup?: string;
  clock?: ExecutionClock;
}

/** A single drafting call is authoring evidence, never an evaluation or upgrade verdict. */
export class BenchDraftSession {
  readonly dir: string;
  readonly workspace: string;
  readonly plan;
  private readonly executor: Executor;
  private readonly clock: ExecutionClock;
  private readonly budget;
  private readonly observations: CostObservation[] = [];
  private started = false;
  private callsStarted = 0;
  private callsFinished = 0;
  private finished = false;

  constructor(options: BenchDraftOptions, readonly taskId: string, benchDir: string, cwd: string,
    private readonly files: readonly { rel: string; content: Buffer }[], readonly prompt: string) {
    const timeout = parseExecutorTimeoutSeconds(options.executorTimeoutSeconds);
    const budget = options.spendingBudget === undefined ? undefined : parseSpendingBudget(options.spendingBudget);
    const maxCalls = validateCallBudget(1, options.maxCalls);
    if (!options.executor && !options.agent) throw new Error('bench add --decompose needs an agent to draft with: --agent <id>.');
    if (options.agent && !options.executor) {
      const agent = getAgent(options.agent), argv = agent.headless.streamJson?.argv ?? agent.headless.argv;
      if (!findExecutable(argv[0]!)) throw new Error(`Drafting CLI is missing or not executable on PATH: ${argv[0]}. No calls started.`);
      const missing = ['input', 'cachedInput', 'output'].filter(metric => !agentTokenCounters(agent).includes(metric));
      if (budget && missing.length) throw new Error(`Draft spending limits require unavailable CLI counters: ${missing.join(', ')}. No calls started.`);
    }
    this.executor = options.executor ?? CliExecutor.forAgent(options.agent!, { timeoutMs: timeout * 1000 });
    this.clock = options.clock ?? executionClock;
    const group = options.runGroup ?? `draft-${Date.now()}-${randomUUID().slice(0, 8)}`;
    if (!RUN_GROUP_PATTERN.test(group)) throw new Error('Invalid draft --run-group.');
    this.dir = resolve(cwd, options.runsRoot ?? 'runs', group);
    assertEvaluationOutputLayout(this.dir, { benchDir });
    if (existsSync(this.dir)) throw new Error(`Draft record directory already exists: ${this.dir}`);
    this.workspace = join(this.dir, 'workspace');
    this.plan = { schemaVersion: 1, kind: 'skillfit.bench-draft-plan', taskId, benchDir,
      plannedCalls: 1, maxCalls, executorTimeoutSeconds: timeout, spendingBudget: budget ?? null,
      verifierTimeoutSeconds: parseVerifierTimeoutSeconds(options.verifierTimeoutSeconds),
      executor: this.executor.describe(), nodeVersion: process.version, packageVersion: VERSION,
      authentication: 'unknown', outputDir: this.dir, promptSha256: sha256Text(prompt),
      fixtureFiles: files.map(file => ({ path: file.rel, bytes: file.content.length, sha256: createHash('sha256').update(file.content).digest('hex') })),
      automaticRetry: false, automaticUpgrade: false };
    this.budget = createSpendingBudgetRecorder({ budget, groupDir: this.dir });
  }

  private write(path: string, content: string | Buffer): void {
    const target = join(this.dir, path); mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, { flag: 'wx' });
  }

  async run(): Promise<void> {
    if (this.started) throw new Error('A drafting session cannot be retried. Choose a fresh record group.');
    throwIfEvaluationInterrupted();
    mkdirSync(dirname(this.dir), { recursive: true });
    mkdirSync(this.dir); // Exclusive claim; never replace an earlier draft, including a failed one.
    this.started = true;
    this.write('_plan.json', JSON.stringify(this.plan, null, 2) + '\n');
    this.write('prompt.md', this.prompt);
    for (const file of this.files) {
      this.write(join('_inputs/fixture', file.rel), file.content);
      this.write(join('workspace/fixture', file.rel), file.content);
    }
    const expectedFixture = hashFileSet(join(this.dir, '_inputs/fixture'), this.files.map(file => file.rel));
    const identity = { taskId: this.taskId, trial: 1, role: 'drafter' as const };
    this.budget.before(identity);
    throwIfEvaluationInterrupted();
    this.callsStarted++;
    const startedAt = this.clock.wallNow(), start = this.clock.monotonicNow();
    appendFileSync(join(this.dir, '_calls.jsonl'), JSON.stringify({ event: 'started', at: new Date(startedAt).toISOString(), ...identity }) + '\n');
    let result: ExecutorResult = { output: '' }, failure: unknown;
    try { result = await this.executor.run(this.prompt, this.workspace); }
    catch (error) { failure = error; if (error instanceof ExecutorFailure) result = error.result; }
    const durationSeconds = Math.max(0, (this.clock.monotonicNow() - start) / 1000);
    const invoked = !(failure instanceof ExecutorFailure && !failure.executorInvoked);
    const observation: CostObservation = { executorInvoked: invoked, passed: false,
      error: failure || result.guardError ? 'Draft executor failed.' : evaluationSignal()?.aborted ? 'Draft interrupted.' : null,
      durationSeconds, tokens: result.tokens ?? null, usageStatus: result.usageStatus ?? (result.tokens ? 'final' : 'unknown') };
    this.observations.push(observation);
    this.write('_result.json', JSON.stringify({ schemaVersion: 1, ...identity, ...observation,
      startedAt: new Date(startedAt).toISOString(), executionTiming: result.executionTiming ?? null, usageEvidence: result.usageEvidence ?? null }, null, 2) + '\n');
    this.write('_output.md', result.output);
    if (result.rawOutput !== undefined) this.write('_transcript.jsonl', result.rawOutput);
    this.callsFinished++;
    appendFileSync(join(this.dir, '_calls.jsonl'), JSON.stringify({ event: 'finished', ...identity, executorInvoked: invoked }) + '\n');
    this.budget.after(identity, observation);
    throwIfEvaluationInterrupted();
    if (failure || result.guardError) throw new Error('Draft executor failed; retained records include every reported cost. No retry.', { cause: failure });
    const tree = (root: string): string[] => {
      if (!lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) throw new Error('Draft replaced a fixture directory; rejected without retry.');
      const paths: string[] = [];
      const walk = (rel: string): void => {
        for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
          const path = rel ? `${rel}/${entry.name}` : entry.name;
          if (entry.isDirectory()) walk(path);
          else if (entry.isFile()) paths.push(path);
          else throw new Error('Draft inserted an unsupported fixture entry; rejected without retry.');
        }
      };
      walk(''); return paths.sort();
    };
    const files = tree(join(this.workspace, 'fixture'));
    if (JSON.stringify(files) !== JSON.stringify(this.files.map(file => file.rel).sort()) ||
        hashFileSet(join(this.workspace, 'fixture'), files) !== expectedFixture ||
        JSON.stringify(tree(join(this.dir, '_inputs/fixture'))) !== JSON.stringify(files) ||
        hashFileSet(join(this.dir, '_inputs/fixture'), files) !== expectedFixture) throw new Error('Draft modified the pristine fixture; rejected without retry.');
  }

  gate(name: string, result: ProcessResult): void {
    appendFileSync(join(this.dir, '_gates.jsonl'), JSON.stringify({ name, ...result }) + '\n');
    throwIfEvaluationInterrupted();
  }

  finish(error?: unknown): void {
    if (!this.started || this.finished) return;
    this.finished = true;
    const interrupted = evaluationSignal()?.aborted;
    const interrupt = evaluationSignal()?.reason;
    const population = summarizeCosts({ baseline: this.observations, treatment: [] }, { baseline: [], treatment: [] }).attempts.baseline;
    this.write('_summary.json', JSON.stringify({ schemaVersion: 1, kind: 'skillfit.bench-draft-result',
      status: error || interrupted ? 'stopped' : 'completed', taskId: this.taskId,
      plannedCalls: 1, maxCalls: this.plan.maxCalls, callsStarted: this.callsStarted, callsFinished: this.callsFinished,
      reason: interrupted ? 'Interrupted; no automatic retry.' : error instanceof Error ? error.message : error ? 'Draft stopped.' : null,
      interruption: interrupt instanceof EvaluationInterrupted ? { signal: interrupt.signalName, receivedAt: interrupt.receivedAt } : null,
      costs: { invocations: population.runs, metrics: population.metrics },
      spendingBudget: this.plan.spendingBudget ? spendingBudgetState(this.plan.spendingBudget, this.observations) : null,
      automaticRetry: false, automaticUpgrade: false }, null, 2) + '\n');
  }
}
