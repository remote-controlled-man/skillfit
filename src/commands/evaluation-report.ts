import { reportEvalComponent, type EvalReportOptions } from './eval-component.js';

/** One read-only dispatcher for the public Markdown and JSON report entry points. */
export async function readEvaluationReport(path: string, options: EvalReportOptions = {}) {
  return reportEvalComponent(path, options);
}
