import { join } from 'node:path';
import { CONCLUSIVE_TASKS, CONCLUSIVE_TRIALS, renderSummary, type RunManifest } from "../evaluation/measurement/report.js";
import { renderTriggerSummary, type TriggerManifest } from "../evaluation/execution/activation.js";
import { measurementScopeText } from "../evaluation/measurement/scope.js";
import { renderAgentEnvironment } from "../agents/preflight.js";
import type { Bench } from "../bench/contracts.js";
import type { EvaluationTarget, SkillBundle } from "../resources/contracts.js";
import type { Executor } from "../agents/contracts.js";
import type { InputMode } from "../evaluation/measurement/paired-contract.js";
import type { ResolvedEvalInputs } from "../evaluation/application/planning.js";
import type { EvalPresentation } from "../evaluation/application/evaluation.js";

function formatK(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
}

function renderPlan(
  bench: Bench,
  target: EvaluationTarget,
  executor: Executor | null,
  judge: Executor | null,
  trials: number,
  runsRoot: string,
  runGroup: string,
  inputMode: InputMode,
  baselineTarget: EvaluationTarget | undefined,
  estimate: { baseline: number; treatment: number },
): string {
  const lines: string[] = [];
  lines.push('Experiment plan (dry run)');
  lines.push(`Target   : ${target.name} (${target.kind}, ${target.files.length} files, bundle sha256 ${target.sha256.slice(0, 12)}…)`);
  if (baselineTarget) {
    lines.push(`Baseline : ${baselineTarget.name} (${baselineTarget.files.length} files, bundle sha256 ${baselineTarget.sha256.slice(0, 12)}…)`);
    lines.push('Compare  : previous Skill in baseline vs target Skill in treatment; measures revision effects, not benefit over no Skill');
  } else if (inputMode === 'workspace' && target.kind === 'skill') lines.push('Baseline : no Skill installed by the harness (inherited configuration still applies)');
  if (target.kind !== 'skill') {
    lines.push('           applied as project files; treatment material is never injected into the prompt');
  }
  lines.push(`Bench    : ${bench.name} @ ${bench.dir}`);
  lines.push(`           ${bench.tasks.length} task(s), content sha256 ${bench.contentSha256.slice(0, 12)}…`);
  lines.push(`Input    : ${inputMode === 'workspace' ? 'workspace files on disk (no inline repository snapshot)' : 'inline repository snapshot'}`);
  lines.push(
    `Est. cost: ~${formatK(estimate.baseline)} prompt-tokens/run baseline, ~${formatK(estimate.treatment)} treatment (estimate, before replies)`,
  );
  if (inputMode === 'workspace') lines.push('           initial prompt only; agent file reads and replies are not estimated');
  const descriptor = executor?.describe();
  lines.push(
    `Executor : ${descriptor ? `${descriptor.kind} (${descriptor.model})${descriptor.detail ? ` — ${descriptor.detail}` : ''}` : 'unresolved (pass --agent or set SKILLFIT_API_KEY)'}`,
  );
  const judgeDescriptor = judge?.describe();
  lines.push(`Judge    : ${judgeDescriptor ? `${judgeDescriptor.kind} (${judgeDescriptor.model})` : 'disabled'}`);
  const totalRuns = bench.tasks.length * 2 * trials;
  lines.push(`Trials   : ${trials} per condition (${bench.tasks.length} task(s) × 2 conditions × ${trials} = ${totalRuns} runs)`);
  if (bench.tasks.length < CONCLUSIVE_TASKS || trials < CONCLUSIVE_TRIALS) {
    lines.push(`Scale    : below ${CONCLUSIVE_TASKS} tasks × ${CONCLUSIVE_TRIALS} trials per condition; any result will be indicative for broader claims.`);
  }
  lines.push('Tasks    :');
  for (const task of bench.tasks) {
    lines.push(`- ${task.id}: fixture ${task.fixture}, verifier \`${task.verifier}\`${task.rubric ? `, rubric ${task.rubric}` : ''}`);
  }
  lines.push(`Output   : ${join(runsRoot, runGroup)} (not created)`);
  lines.push('Dry run — nothing was written.');
  return lines.join('\n');
}

function renderTriggerPlan(
  bench: Bench,
  skill: SkillBundle,
  executor: Executor | null,
  trials: number,
  runsRoot: string,
  runGroup: string,
  installDir: string | undefined,
  estimate: { baseline: number; treatment: number },
): string {
  const lines: string[] = [];
  lines.push('Trigger experiment plan (dry run)');
  lines.push(`Skill    : ${skill.name} (${skill.files.length} files, bundle sha256 ${skill.sha256.slice(0, 12)}…)`);
  lines.push(`           installed into ${installDir ?? 'unresolved'} of each run directory — never injected into the prompt`);
  lines.push(`Bench    : ${bench.name} @ ${bench.dir}`);
  lines.push(`           ${bench.tasks.length} task(s), content sha256 ${bench.contentSha256.slice(0, 12)}…`);
  const descriptor = executor?.describe();
  lines.push(
    `Executor : ${descriptor ? `${descriptor.kind} (${descriptor.model})${descriptor.detail ? ` — ${descriptor.detail}` : ''}` : 'unresolved (pass --agent with a streamJson-capable CLI)'}`,
  );
  {
    const bodyTokens = estimate.treatment;
    lines.push(
      `Est. cost: ~${formatK(estimate.baseline)} prompt-tokens/run; skill body ~${formatK(bodyTokens)} loads only if triggered (estimate, before replies)`,
    );
  }
  lines.push(`Trials   : ${trials} per task (single arm: skill installed)`);
  lines.push('Tasks    :');
  for (const task of bench.tasks) {
    const label =
      task.shouldTrigger === undefined
        ? 'unlabeled — skipped'
        : task.shouldTrigger
          ? 'should trigger'
          : 'should NOT trigger (negative control)';
    lines.push(`- ${task.id}: ${label}`);
  }
  lines.push(`Output   : ${join(runsRoot, runGroup)} (not created)`);
  lines.push('Dry run — nothing was written.');
  return lines.join('\n');
}

export function evaluationPlanLines(resolved: ResolvedEvalInputs): string[] {
  const { bench, target, baselineTarget, executor, judge, trials, runsRoot, runGroup, inputMode, skillInstallDir, promptEstimate, competitors } = resolved;
  const { agentPreflight, plannedCalls, maxCalls, spendingBudget, pairOrder, executorTimeoutSeconds } = resolved.preview;
  const scope = resolved.preview.measurementScope!;
  const result = [...resolved.notes], log = (line: string) => result.push(line);
  if (resolved.preview.mode === 'trigger') {
    log(measurementScopeText(scope));
    log(renderTriggerPlan(bench, target as SkillBundle, executor, trials, runsRoot, runGroup, skillInstallDir, promptEstimate));
    log(renderAgentEnvironment(agentPreflight));
    log('Case preflight: pending; required before execution. Dry run does not execute verifiers or oracles.');
    log(competitors.length ? `Compete  : ${competitors.map(entry => entry.name).join(', ')}` : 'Compete  : alone (recall is an upper bound)');
    log(`Calls    : ${plannedCalls} planned; ceiling ${maxCalls} (agent calls only)`);
    log(`Agent deadline: ${executorTimeoutSeconds}s per invocation`);
    if (spendingBudget) log(`Spending stop lines: ${JSON.stringify(spendingBudget)}; checked between calls, in-flight overshoot remains possible`);
  } else {
    log(measurementScopeText(scope));
    log(renderPlan(bench, target, executor, judge, trials, runsRoot, runGroup, inputMode, baselineTarget, promptEstimate));
    log(renderAgentEnvironment(agentPreflight));
    log('Case preflight: pending; required before execution. Dry run does not execute verifiers or oracles.');
    log(`Calls    : ${plannedCalls} planned; ceiling ${maxCalls} (includes both judge orders when enabled)`);
    log(`Pair order: ${pairOrder}; arms remain adjacent`);
    if (spendingBudget) log(`Spending stop lines: ${JSON.stringify(spendingBudget)}; checked between calls, in-flight overshoot remains possible`);
    log(`Agent deadline: ${executorTimeoutSeconds}s per invocation in both arms`);
    if (skillInstallDir) {
      log('Tool     : native untracked-file diff helper in both arms (version 1; environment correction)');
      log('Delivery : complete Skill resources installed ' + (baselineTarget ? 'in both conditions' : 'only in treatment') + ' at ' + skillInstallDir + '/' + target.name);
      log('           identical prompts; native discovery is not guaranteed; inherited configuration still applies');
    }
  }
  return result;
}

export function evaluationPresentation(log?: (line: string) => void): EvalPresentation {
  const output = log ?? (() => {});
  return {
    preview: (resolved, sha256) => { for (const line of evaluationPlanLines(resolved)) output(line); output(`Plan SHA : ${sha256}`); },
    resolved: resolved => { for (const note of resolved.notes) output(note); },
    dispatch: resolved => {
      const { bench, target, baselineTarget, executor, judge, trials, runsRoot, runGroup, inputMode, skillInstallDir, promptEstimate, competitors } = resolved;
      const { agentPreflight, plannedCalls, maxCalls } = resolved.preview;
      if (resolved.preview.mode === 'trigger') {
        output(renderTriggerPlan(bench, target as SkillBundle, executor, trials, runsRoot, runGroup, skillInstallDir, promptEstimate).replace(' (dry run)', '').replace(' (not created)', '').replace('Dry run — nothing was written.', `Calls    : ${plannedCalls} planned; ceiling ${maxCalls}`));
        output(competitors.length ? `Compete  : ${competitors.map(entry => entry.name).join(', ')}` : 'Compete  : alone (recall is an upper bound)');
      } else output(renderPlan(bench, target, executor, judge, trials, runsRoot, runGroup, inputMode, baselineTarget, promptEstimate).replace(' (dry run)', '').replace(' (not created)', '').replace('Dry run — nothing was written.', `Calls    : ${plannedCalls} planned; ceiling ${maxCalls}`));
      output(renderAgentEnvironment(agentPreflight));
    },
    completed: (manifest, resolved) => output('mode' in manifest
      ? renderTriggerSummary(manifest as TriggerManifest, join(resolved.runsRoot, resolved.runGroup, 'manifest.json'))
      : renderSummary(manifest as RunManifest, join(resolved.runsRoot, resolved.runGroup, 'manifest.json'))),
  };
}
