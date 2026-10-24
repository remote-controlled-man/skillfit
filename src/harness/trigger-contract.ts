export type StreamWireShape = 'flat-tool-call' | 'content-blocks' | 'codex-items';
export interface TriggerDetection {
  schemaVersion: 2;
  wireShape: StreamWireShape;
  method: 'skill-tool-argument' | 'skill-file-read-command';
  identityMatch: 'exact-registered-identity';
  identities: string[];
  skillPaths: string[];
}
export interface TriggerEvidence {
  status: 'observed' | 'not-observed' | 'unknown';
  complete: boolean;
  matchedIdentity: string | null;
  /** One-based transcript lines containing positive observations. */
  eventLines: number[];
}

export function triggerDetection(wireShape: StreamWireShape, identities: readonly string[], skillPaths: readonly string[] = []): TriggerDetection {
  return { schemaVersion: 2, wireShape, method: wireShape === 'codex-items' ? 'skill-file-read-command' : 'skill-tool-argument',
    identityMatch: 'exact-registered-identity', identities: [...new Set(identities)].sort(), skillPaths: [...new Set(skillPaths)].sort() };
}

export function parseTriggerDetection(value: unknown): TriggerDetection | null {
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid triggerDetection.');
  const row = value as Record<string, unknown>;
  if (row.schemaVersion !== 2) throw new Error(`Unsupported triggerDetection schemaVersion: ${String(row.schemaVersion)}.`);
  if (!['flat-tool-call', 'content-blocks', 'codex-items'].includes(String(row.wireShape))) throw new Error('Invalid triggerDetection.wireShape.');
  for (const key of ['identities', 'skillPaths']) {
    const list = row[key];
    if (!Array.isArray(list) || list.some(v => typeof v !== 'string' || !v.trim()) || new Set(list).size !== list.length ||
        (key === 'identities' && !list.length)) throw new Error(`Invalid triggerDetection.${key}.`);
  }
  const expected = triggerDetection(row.wireShape as StreamWireShape, row.identities as string[], row.skillPaths as string[]);
  if (row.method !== expected.method || row.identityMatch !== expected.identityMatch) throw new Error('Invalid triggerDetection method or identityMatch.');
  return expected;
}

export function parseTriggerEvidence(value: unknown, detection: TriggerDetection): TriggerEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Missing or invalid triggerEvidence.');
  const e = value as TriggerEvidence;
  if (!['observed', 'not-observed', 'unknown'].includes(e.status) || typeof e.complete !== 'boolean' ||
      !Array.isArray(e.eventLines) || e.eventLines.some(n => !Number.isSafeInteger(n) || n < 1) ||
      e.eventLines.some((n, i) => i > 0 && n <= e.eventLines[i - 1]!)) throw new Error('Invalid triggerEvidence fields.');
  if (e.status === 'observed' ? !detection.identities.includes(e.matchedIdentity ?? '') || !e.eventLines.length
    : e.matchedIdentity !== null || e.eventLines.length !== 0 || e.complete !== (e.status === 'not-observed')) {
    throw new Error('Trigger evidence status contradicts its identity, completeness or event lines.');
  }
  return { status: e.status, complete: e.complete, matchedIdentity: e.matchedIdentity, eventLines: [...e.eventLines] };
}

