import { reportEvalComponent, type EvalReportOptions } from './eval-component.js';
import { readSingleArmReport } from './eval-single-arm-report.js';

/** One read-only dispatcher for the public Markdown and JSON report entry points. */
export async function readEvaluationReport(path: string, options: EvalReportOptions = {}) {
  return readSingleArmReport(path, options) ?? await reportEvalComponent(path, options);
}
