import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { controlFile, type ControlAction, type ControlSuite } from "../../bench/controls.js";
import { throwIfCancelled as throwIfEvaluationInterrupted } from "../../shared/cancellation.js";
import { collectInstalledSkillFingerprint } from "../../resources/skill.js";
import { runVerifier, verifierFailure } from "../../bench/gates/verifier.js";
import { ExecutorFailure, type Executor, type ExecutorDescriptor, type ExecutorResult } from "../../agents/contracts.js";
import { type Bench } from "../../bench/contracts.js";
import { type Condition } from "../../resources/contracts.js";

/** Fixed dispatch table; no prompt inspection and no live-executor fallback. */
export class ControlExecutor implements Executor {
  invocations = 0;
  private readonly calls = new Map<string, { taskId: string; condition: Condition; action: ControlAction }>();
  constructor(private readonly bench: Bench, suite: ControlSuite, runDir: string,
    private readonly installation?: { dir: string; name: string; sha256: string }) {
    for (const id of suite.taskIds) for (const condition of ['baseline', 'treatment'] as const) for (let trial = 1; trial <= suite.trials; trial++) {
      this.calls.set(resolve(runDir, id, condition, `trial-${trial}`), { taskId: id, condition, action: suite.arms[id]![condition] });
    }
  }
  describe(): ExecutorDescriptor { return { kind: 'mock', model: 'synthetic-control', detail: 'bench-self-test:fixed-workdir-map-v1', sampling: null }; }
  async run(_prompt: string, workdir: string): Promise<ExecutorResult> {
    throwIfEvaluationInterrupted();
    const call = this.calls.get(resolve(workdir));
    if (!call) throw new ExecutorFailure('Unexpected self-test workspace.', { output: '' }, false);
    this.calls.delete(resolve(workdir));
    this.invocations++;
    if (this.installation) {
      const { dir, name, sha256 } = this.installation, destination = join(workdir, dir, name);
      if (call.condition === 'baseline' ? existsSync(destination) : !existsSync(destination) || collectInstalledSkillFingerprint(destination).sha256 !== sha256) {
        throw new ExecutorFailure('Synthetic installed arm does not match the frozen delivery.', { output: '' });
      }
    }
    const action = call.action;
    if (action.kind === 'error') throw new ExecutorFailure(action.code, { output: '', usageStatus: 'partial' });
    if (action.kind === 'output-file') return { output: readFileSync(controlFile(this.bench.dir, action.path), 'utf8') };
    if (action.kind === 'oracle') {
      const task = this.bench.tasks.find(t => t.id === call.taskId)!;
      const result = await runVerifier(this.bench.dir, task.oracle!, workdir, task.verifierTimeoutSeconds);
      throwIfEvaluationInterrupted();
      if (result.error !== null || result.exitCode !== 0) throw new ExecutorFailure(
        result.error ? verifierFailure('control oracle', task.oracle!, result.error) : `Control oracle exited ${result.exitCode}.`,
        { output: result.output, rawOutput: result.output, usageStatus: 'partial' });
    }
    return { output: `Synthetic ${action.kind} control; no model invoked.` };
  }
}
