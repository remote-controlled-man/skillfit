/** Saved-format compatibility belongs to Records; no live execution or filesystem access. */
export type EvaluationType = 'paired' | 'calibration' | 'trigger';

export const SAVED_FORMATS = {
  versions: { plan: 1, session: 1, artifacts: 1, package: 1 },
  evaluations: {
    paired: { summaryVersion: 4, replayFiles: ['harness/interruption.js'] },
    calibration: { summaryVersion: 1, replayFiles: ['harness/interruption.js', 'commands/eval-single-arm-replay.js', 'harness/single-arm-audit.js'] },
    trigger: { summaryVersion: 1, replayFiles: ['harness/interruption.js', 'commands/eval-single-arm-replay.js', 'harness/single-arm-audit.js'] },
  },
} as const;

/** Legacy partial records can lack versions; an explicit unknown version is never legacy. */
export function assertRecordVersion(value: { schemaVersion?: unknown }, kind: keyof typeof SAVED_FORMATS.versions, required = true): void {
  if ((!required && value.schemaVersion === undefined) || value.schemaVersion === SAVED_FORMATS.versions[kind]) return;
  throw new Error(`Unsupported ${kind} schemaVersion: ${String(value.schemaVersion)}.`);
}

export function nativeEvaluationType(plan: { schemaVersion?: unknown; details?: unknown }): EvaluationType {
  assertRecordVersion(plan, 'plan', false);
  const details = plan.details;
  if (details !== undefined && (!details || typeof details !== 'object' || Array.isArray(details))) throw new Error('Invalid native plan details.');
  const mode = (details as { mode?: unknown } | undefined)?.mode;
  if (mode === 'calibration' || mode === 'trigger') return mode;
  if (mode === undefined || mode === 'inject' || mode === 'installed') return 'paired';
  throw new Error(`Unsupported native evaluation mode: ${String(mode)}.`);
}

/** Explicit adapter for old standalone summaries, before a native plan was always retained. */
export function summaryEvaluationType(value: Record<string, unknown>, filename: string): EvaluationType {
  if (value.mode !== undefined && (typeof value.mode !== 'string' || !['inject', 'installed', 'trigger'].includes(value.mode))) throw new Error(`Unsupported summary mode: ${String(value.mode)}.`);
  let type: EvaluationType = 'paired';
  if (value.mode === 'trigger') type = 'trigger';
  else if (value.schemaVersion === 1 && (filename === '_calibration.json' || value.inputMode !== undefined)) type = 'calibration';
  if (value.schemaVersion !== SAVED_FORMATS.evaluations[type].summaryVersion) throw new Error(`Unsupported ${type} summary schemaVersion: ${String(value.schemaVersion)}.`);
  return type;
}

export function assertPortableEvaluationType(value: unknown, plan: Parameters<typeof nativeEvaluationType>[0]): EvaluationType {
  const planned = nativeEvaluationType(plan);
  if (value !== undefined) {
    if (typeof value !== 'string' || !Object.hasOwn(SAVED_FORMATS.evaluations, value)) throw new Error('Invalid portable evaluation type.');
    if (value !== planned) throw new Error('Portable evaluation type differs from its native plan.');
  }
  return planned;
}

export function replayRuntimeFiles(type: EvaluationType): readonly string[] {
  return SAVED_FORMATS.evaluations[type].replayFiles;
}
