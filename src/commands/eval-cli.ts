import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { prepareEvalPlan, confirmEvalPlan, plannedEvalResult } from './eval-plan.js';
import { reportEvalComponent } from './eval-component.js';
import { runEval, type EvalOptions } from './eval.js';

/** Preserve human CLI behavior while using the same reviewed plan as Agent requests. */
export async function runEvalCli(options: EvalOptions, expectedPlanSha256?: string) {
  const prepared = await prepareEvalPlan(options, {}), { plan } = prepared;
  if (options.dryRun) {
    for (const line of prepared.lines) options.log?.(line);
    options.log?.(`Plan SHA : ${plan.sha256}`);
    return plannedEvalResult(plan);
  }
  if (expectedPlanSha256 !== undefined) confirmEvalPlan(expectedPlanSha256, plan.sha256);
  const runDir = plan.evaluation.outputDir;
  try {
    await runEval({ ...prepared.options, dryRun: false, reviewedPlan: plan,
      onPlan: preview => { prepared.assertCurrent(preview); options.onPlan?.(preview); } });
  } catch (error) {
    if (!existsSync(join(runDir, '_plan.json'))) throw error;
    const result = await reportEvalComponent(runDir);
    return { ...result, status: 'stopped', plan, executionError: error instanceof Error ? error.message : String(error),
      acceptance: { ...result.acceptance, decision: result.acceptance.decision === 'reject' ? 'reject' : 'inconclusive', eligibleForUpgrade: false,
        reasons: [...result.acceptance.reasons, { code: 'EXECUTION_STOPPED', message: 'Execution stopped; retained receipts do not authorize an upgrade.' }] } };
  }
  return { ...await reportEvalComponent(runDir), plan };
}
