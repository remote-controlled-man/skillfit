import { basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { hashFileSet, listFilesRecursive, sha256Text } from '../harness/hash.js';
import { runEval, type EvalOptions, type EvalPreview } from './eval.js';

export interface ReviewedEvalPlan {
  schemaVersion: 1;
  kind: 'skillfit.eval-plan';
  implementationSha256: string;
  evaluation: EvalPreview;
  sha256: string;
}

/** Shared read-only planning and confirmation for command-line and file requests. */
export async function prepareEvalPlan<T extends object>(options: EvalOptions, context: T) {
  if (options.mode === 'trigger') throw new Error('JSON/reviewed plans require a paired evaluation; trigger mode retains its existing dry-run path.');
  const implementationDir = fileURLToPath(new URL('../../dist', import.meta.url));
  const implementationSha256 = hashFileSet(implementationDir, listFilesRecursive(implementationDir));
  const lines: string[] = [];
  let evaluation: EvalPreview | undefined;
  await runEval({ ...options, dryRun: true, log: line => lines.push(line), onPlan: preview => { evaluation = preview; } });
  if (!evaluation) throw new Error('No paired evaluation plan is available.');
  if (existsSync(evaluation.outputDir)) throw new Error('Run group already exists; declare a fresh group without overwriting evidence.');
  const describe = (preview: EvalPreview) => ({ schemaVersion: 1 as const, kind: 'skillfit.eval-plan' as const,
    ...context, implementationSha256, evaluation: preview });
  const data = describe(evaluation), sha256 = sha256Text(JSON.stringify(data));
  const plan = { ...data, sha256 };
  const resolved: EvalOptions = { ...options, runsRoot: dirname(evaluation.outputDir), runGroup: basename(evaluation.outputDir) };
  return { plan, lines, options: resolved,
    assertCurrent: (preview: EvalPreview) => {
      if (sha256Text(JSON.stringify(describe(preview))) !== sha256) throw new Error('Plan changed before execution; no calls allowed.');
    } };
}

export function confirmEvalPlan(expected: string | undefined, actual: string): void {
  if (!expected || !/^[0-9a-f]{64}$/i.test(expected) || expected.toLowerCase() !== actual) {
    throw new Error('Execution requires --plan-sha matching the current dry-run plan; inputs, policy, executor or implementation changed.');
  }
}

export function plannedEvalResult<T extends ReviewedEvalPlan>(plan: T) {
  return { schemaVersion: 1 as const, kind: 'skillfit.eval-result' as const, status: 'planned' as const, plan,
    acceptance: { decision: 'inconclusive' as const, eligibleForUpgrade: false, automaticUpgrade: false as const,
      reasons: [{ code: 'PLAN_ONLY', message: 'No agent call or outcome is available.' }] } };
}
