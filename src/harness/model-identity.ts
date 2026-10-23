import assert from 'node:assert/strict';

export interface ModelIntent { schemaVersion: 1; configured: string | null; requested: string | null }
export interface ReportedModel { id: string; source: 'api-response-model' | 'cli-public-event'; location: string }
export interface ModelIdentity extends ModelIntent { status: 'reported' | 'unrecorded'; reportedModels: ReportedModel[] }
export interface ModelCall { receipt: string; identity: ModelIdentity | null }
export interface ModelPopulation { invoked: number; reported: number; unrecorded: number; models: string[]; calls: ModelCall[] }
export interface ModelIdentities { schemaVersion: 1; primary: ModelPopulation | null; judge: ModelPopulation | null; drafter: ModelPopulation | null }

function object(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'Invalid model identity object.');
  return value as Record<string, unknown>;
}
function model(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value === value.trim() && !/[\r\n\x00-\x1f]/.test(value); }
function keys(value: Record<string, unknown>, expected: string[]): void {
  assert.deepEqual(Object.keys(value).sort(), expected.sort(), 'Unknown or missing model identity fields.');
}
export function parseModelIntent(value: unknown): ModelIntent {
  const r = object(value); keys(r, ['schemaVersion', 'configured', 'requested']);
  assert.equal(r.schemaVersion, 1, 'Unsupported model intent version.');
  assert.ok(r.configured === null || model(r.configured)); assert.ok(r.requested === null || model(r.requested));
  return r as unknown as ModelIntent;
}
export function parseModelIdentity(value: unknown): ModelIdentity {
  const r = object(value); keys(r, ['schemaVersion', 'configured', 'requested', 'status', 'reportedModels']);
  parseModelIntent({ schemaVersion: r.schemaVersion, configured: r.configured, requested: r.requested });
  assert.ok(r.status === 'reported' || r.status === 'unrecorded'); assert.ok(Array.isArray(r.reportedModels));
  const seen = new Set<string>();
  for (const value of r.reportedModels) {
    const entry = object(value); keys(entry, ['id', 'source', 'location']); assert.ok(model(entry.id));
    assert.ok(entry.source === 'api-response-model' || entry.source === 'cli-public-event');
    assert.ok(entry.source === 'api-response-model' ? entry.location === '/model' : /^jsonl:[1-9][0-9]*:\/message\/model$/.test(String(entry.location)));
    const key = JSON.stringify([entry.id, entry.source, entry.location]); assert.ok(!seen.has(key), 'Duplicate reported model source.'); seen.add(key);
  }
  assert.equal(r.status, r.reportedModels.length ? 'reported' : 'unrecorded', 'Model status contradicts public observations.');
  return r as unknown as ModelIdentity;
}
export function unknownModelIdentity(intent?: ModelIntent): ModelIdentity {
  return { ...(intent ?? { schemaVersion: 1 as const, configured: null, requested: null }), status: 'unrecorded', reportedModels: [] };
}

/** No text self-reports, startup configuration, or private session model fields. */
export function observedModelIdentity(raw: string | undefined, intent: ModelIntent | undefined, surface?: 'api' | 'claude-assistant'): ModelIdentity {
  const result = unknownModelIdentity(intent);
  const add = (id: unknown, source: ReportedModel['source'], location: string) => {
    if (model(id)) result.reportedModels.push({ id, source, location });
  };
  if (raw !== undefined && surface === 'api') {
    try { const data = JSON.parse(raw); if (data && !Array.isArray(data)) add(data.model, 'api-response-model', '/model'); } catch { /* Broken response remains unrecorded. */ }
  } else if (raw !== undefined && surface === 'claude-assistant') {
    for (const [index, line] of raw.split('\n').entries()) {
      try {
        const event = JSON.parse(line);
        if (event?.type === 'assistant' && event.message && typeof event.message === 'object' && !Array.isArray(event.message)) {
          add(event.message.model, 'cli-public-event', `jsonl:${index + 1}:/message/model`);
        }
      } catch { /* Complete earlier public events survive partial trailing output. */ }
    }
  }
  result.status = result.reportedModels.length ? 'reported' : 'unrecorded';
  return result;
}

/** Validate both declarations and their retained public response; absence is legacy unknown. */
export function assertModelIdentity(value: unknown, raw: string | undefined, descriptor: unknown, configured?: string | null): void {
  if (value === undefined) return;
  const identity = parseModelIdentity(value), executor = object(descriptor);
  if (executor.modelIdentitySurface !== undefined) assert.ok(executor.kind === 'cli' && executor.modelIdentitySurface === 'claude-assistant', 'Unsupported model observation surface.');
  const intent = executor.modelIntent === undefined ? undefined : parseModelIntent(executor.modelIntent);
  const expected = observedModelIdentity(raw, intent, executor.kind === 'api' ? 'api' : executor.modelIdentitySurface === 'claude-assistant' ? 'claude-assistant' : undefined);
  if (configured !== undefined && executor.kind === 'cli') expected.configured = configured;
  assert.deepEqual(identity, expected, 'Model identity differs from frozen intent or retained public response.');
}

export function identityForResult(result: { modelIdentity?: ModelIdentity; rawOutput?: string }, descriptor: { kind: string; modelIntent?: ModelIntent; modelIdentitySurface?: 'claude-assistant' }): ModelIdentity {
  return result.modelIdentity ?? observedModelIdentity(result.rawOutput, descriptor.modelIntent, descriptor.kind === 'api' ? 'api' : descriptor.modelIdentitySurface);
}

export function modelPopulation(calls: ModelCall[]): ModelPopulation {
  const reported = calls.filter(call => call.identity?.status === 'reported').length;
  return { invoked: calls.length, reported, unrecorded: calls.length - reported,
    models: [...new Set(calls.flatMap(call => call.identity?.reportedModels.map(entry => entry.id) ?? []))].sort(), calls };
}
export function modelIdentities(primary: ModelCall[] | null = null, judge: ModelCall[] | null = null, drafter: ModelCall[] | null = null): ModelIdentities {
  return { schemaVersion: 1, primary: primary === null ? null : modelPopulation(primary),
    judge: judge === null ? null : modelPopulation(judge), drafter: drafter === null ? null : modelPopulation(drafter) };
}
export function parseModelIdentities(value: unknown): ModelIdentities {
  const r = object(value); keys(r, ['schemaVersion', 'primary', 'judge', 'drafter']); assert.equal(r.schemaVersion, 1);
  for (const role of ['primary', 'judge', 'drafter']) {
    if (r[role] === null) continue;
    const p = object(r[role]); keys(p, ['invoked', 'reported', 'unrecorded', 'models', 'calls']); assert.ok(Array.isArray(p.calls));
    const seen = new Set<string>();
    const calls = p.calls.map(value => {
      const c = object(value); keys(c, ['receipt', 'identity']);
      assert.ok(typeof c.receipt === 'string' && /^[a-zA-Z0-9_.\/-]+$/.test(c.receipt) && !c.receipt.split('/').some(s => s === '..' || s === '.' || !s), 'Invalid model receipt path.');
      assert.ok(!seen.has(c.receipt), 'Duplicate model invocation.'); seen.add(c.receipt);
      return { receipt: c.receipt, identity: c.identity === null ? null : parseModelIdentity(c.identity) };
    });
    assert.deepEqual(p, modelPopulation(calls), 'Model coverage differs from its invocation records.');
  }
  return r as unknown as ModelIdentities;
}
export function renderModelIdentityLines(value?: ModelIdentities): string[] {
  if (!value) return ['Model identity: unrecorded in legacy/incomplete evidence; configured/requested names do not establish a reported model.'];
  const display = (value: unknown) => JSON.stringify(value).replace(/[\\`*_{}[\]()<>|!#]/g, '\\$&');
  const lines = ['Public model identity (response declarations, not backend attestation):'];
  for (const role of ['primary', 'judge', 'drafter'] as const) {
    const p = value[role]; if (!p) { lines.push(`- ${role}: invocation coverage not recorded.`); continue; }
    lines.push(`- ${role}: ${p.invoked} invoked; ${p.reported} reported; ${p.unrecorded} unrecorded. Models: ${p.models.map(id => display(id)).join(', ') || 'unrecorded'}.`);
    for (const call of p.calls) if (call.identity) lines.push(`  ${call.receipt}: configured=${display(call.identity.configured)}, requested=${display(call.identity.requested)}; ` +
      (call.identity.reportedModels.map(entry => `${display(entry.id)} [${entry.source} ${entry.location}]`).join('; ') || 'unrecorded'));
  }
  return lines;
}
