import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { readSingleArmReport } from './eval-single-arm-report.js';
import { auditSingleArmEvaluation } from '../harness/single-arm-audit.js';
import type { EvalReportOptions } from './eval-component.js';

/** Shared async single-arm report reader; only native evidence can be replayed. */
export async function reportSingleArmEvaluation(path: string, options: EvalReportOptions = {}) {
  const report = readSingleArmReport(path);
  if (!report) return null;
  if (options.policyPath || options.recordsPath) throw new Error('Single-arm reports do not support paired --policy or external --records overrides.');
  if (options.benchDir && !options.replay) throw new Error('--bench is only used with --replay for a single-arm report.');
  const input = resolve(path), root = statSync(input).isDirectory() ? input : dirname(input);
  if (!existsSync(join(root, '_plan.json')) || !existsSync(join(root, '_session.json')) || !existsSync(join(root, '_artifacts.json'))) {
    if (options.replay) throw new Error('Offline single-arm replay requires a sealed native run, not a standalone historical summary.');
    return report;
  }
  return { ...report, ...await auditSingleArmEvaluation(root, options) };
}
