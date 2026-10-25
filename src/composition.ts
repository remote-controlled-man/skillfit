import { exportEvaluation as exportSaved } from './evaluation/application/export.js';
/** Concrete host wiring. Business operations also remain callable without a terminal. */
import { withEvaluationInterrupts } from './cli/evaluation-host.js';
import { confirm } from './cli/confirm.js';
import { evaluationPresentation } from './cli/eval-display.js';
import { EvaluationInterrupted } from './evaluation/execution/interrupted.js';
import * as evaluation from './evaluation/application/evaluation.js';
import { readEvaluation as read } from './evaluation/application/read.js';
import { runBenchSelfTest as selfTest, type BenchSelfTestOptions } from './evaluation/application/self-test.js';
import { runInstall as install } from './configuration/install.js';
import { runBundleExport as bundle } from './configuration/bundle.js';
import { runCodexSetup as setup } from './configuration/setup.js';

export function executeEvalPlan(...args: Parameters<typeof evaluation.executeEvalPlan>) {
  return withEvaluationInterrupts(() => evaluation.executeEvalPlan(...args));
}
export const runEvaluation: typeof evaluation.runEvaluation = (...args) => args[0].dryRun ? evaluation.runEvaluation(...args) : retainStoppedResult(() => evaluation.runEvaluation(...args));
export const runComponentEvaluation: typeof evaluation.runComponentEvaluation = (...args) => args[1].dryRun ? evaluation.runComponentEvaluation(...args) : retainStoppedResult(() => evaluation.runComponentEvaluation(...args));
export function readEvaluation(...args: Parameters<typeof read>) {
  return args[1]?.replay ? withEvaluationInterrupts(() => read(...args)) : read(...args);
}
export function runBenchSelfTest(options: BenchSelfTestOptions) {
  const run = () => selfTest({ ...options, confirm: options.confirm ?? confirm,
    presentation: options.presentation ?? evaluationPresentation(options.log) });
  return options.dryRun ? run() : retainStoppedResult(run);
}
export function runInstall(options: Parameters<typeof install>[0]) {
  return install({ ...options, confirm: options.confirm ?? confirm, log: options.log ?? console.log });
}
export function runBundleExport(options: Parameters<typeof bundle>[0]) {
  return bundle({ ...options, confirm: options.confirm ?? confirm, log: options.log ?? console.log });
}
export function runCodexSetup(options: Parameters<typeof setup>[0]) {
  return setup({ ...options, log: options.log ?? console.log });
}

/** Interrupted operations may already have sealed and returned their stopped machine result. */
async function retainStoppedResult<T>(operation: () => Promise<T>): Promise<T> {
  let settled: T | undefined;
  try { return await withEvaluationInterrupts(async () => { settled = await operation(); return settled; }); }
  catch (error) {
    if (error instanceof EvaluationInterrupted && settled && typeof settled === 'object' && 'status' in settled &&
        (settled.status === 'stopped' || settled.status === 'interrupted')) return settled;
    throw error;
  }
}

export function exportEvaluation(input: string, output: string, options: Parameters<typeof exportSaved>[2] = {}) {
  return exportSaved(input, output, { ...options, log: options.log ?? console.log });
}
