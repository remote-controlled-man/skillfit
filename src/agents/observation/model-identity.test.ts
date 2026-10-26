import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observedModelIdentity, assertModelIdentity, modelIdentities, parseModelIdentities, parseModelIdentity } from "./model-identity.js";
import { ApiExecutor } from "../adapters/api.js";
import { CliExecutor } from "../adapters/cli.js";
import { ExecutorFailure } from "../contracts.js";

const intent = { schemaVersion: 1 as const, configured: 'configured-alias', requested: 'requested-alias' };
test('response identity remains distinct from request intent and cannot be inferred from text', () => {
  const raw = JSON.stringify({ model: 'served-snapshot', choices: [{ message: { content: '{"model":"self-report"}' } }] });
  const identity = observedModelIdentity(raw, intent, 'api');
  assert.equal(identity.configured, 'configured-alias'); assert.equal(identity.requested, 'requested-alias');
  assert.deepEqual(identity.reportedModels, [{ id: 'served-snapshot', source: 'api-response-model', location: '/model' }]);
  assertModelIdentity(identity, raw, { kind: 'api', modelIntent: intent });
  for (const body of ['{"model":', '{"model":null}', '{"model":42}', '{"model":" padded "}', '{"choices":[{"message":{"content":"model: guessed"}}]}']) {
    assert.equal(observedModelIdentity(body, intent, 'api').status, 'unrecorded');
  }
  assert.throws(() => assertModelIdentity({ ...identity, reportedModels: [{ ...identity.reportedModels[0], id: 'forged' }] }, raw, { kind: 'api', modelIntent: intent }));
});
test('CLI model sources use original lines, retain multiple models and survive incomplete trailing JSON', () => {
  const raw = '{"type":"system","subtype":"init","model":"intent-only"}\n\n' +
    '{"type":"assistant","message":{"model":"first","content":[{"text":"model: self-report"}]}}\n' +
    '{"type":"assistant","message":{"model":"second","content":[]}}\n{"type":';
  const identity = observedModelIdentity(raw, intent, 'claude-assistant');
  assert.deepEqual(identity.reportedModels.map(m => [m.id, m.location]), [['first', 'jsonl:3:/message/model'], ['second', 'jsonl:4:/message/model']]);
  assertModelIdentity(identity, raw, { kind: 'cli', modelIntent: intent, modelIdentitySurface: 'claude-assistant' });
  assert.equal(observedModelIdentity(raw, intent).status, 'unrecorded', 'undeclared CLI surfaces cannot guess a response field');
  assert.throws(() => assertModelIdentity(identity, raw.replace('"first"', '"changed"'), { kind: 'cli', modelIntent: intent, modelIdentitySurface: 'claude-assistant' }));
});
test('model coverage validates roles, invocation paths, sources and unknown legacy identities', () => {
  const identity = observedModelIdentity('{"model":"served"}', intent, 'api');
  const summary = modelIdentities([{ receipt: 'task/baseline/trial-1/_result.json', identity }, { receipt: 'task/treatment/trial-1/_result.json', identity: null }], []);
  assert.deepEqual(parseModelIdentities(summary), summary);
  assert.equal(summary.primary!.invoked, 2); assert.equal(summary.primary!.reported, 1); assert.equal(summary.primary!.unrecorded, 1);
  for (const mutate of [
    (r: any) => { r.schemaVersion = 2; }, (r: any) => { r.primary.invoked = 1; },
    (r: any) => { r.primary.calls[0].receipt = '../escape'; }, (r: any) => { r.primary.calls[1].receipt = r.primary.calls[0].receipt; },
    (r: any) => { r.primary.calls[0].identity.status = 'unrecorded'; }, (r: any) => { r.primary.calls[0].identity.reportedModels[0].location = '/choices/0/message/content'; },
  ]) { const value = structuredClone(summary); mutate(value); assert.throws(() => parseModelIdentities(value)); }
  assert.throws(() => parseModelIdentity({ ...identity, extra: true }));
});
test('API adapter retains response model and body on success and charged failure without recording headers', async () => {
  for (const status of [200, 500]) {
    const raw = JSON.stringify({ model: 'actual-response', choices: [{ message: { content: 'answer' } }], usage: { prompt_tokens: 9, completion_tokens: 2 } });
    const executor = new ApiExecutor({ apiKey: 'PRIVATE_CREDENTIAL', model: 'requested', fetchImpl: async () => new Response(raw, { status }) });
    const before = JSON.stringify(executor.describe());
    let result;
    try { result = await executor.run('offline'); assert.equal(status, 200); }
    catch (error) { assert.ok(error instanceof ExecutorFailure); result = error.result; assert.equal(status, 500); }
    assert.equal(result.rawOutput, raw); assert.equal(result.modelIdentity?.requested, 'requested');
    assert.equal(result.modelIdentity?.reportedModels[0]?.id, 'actual-response');
    assert.deepEqual(result.tokens, { input: 9, output: 2 }); assert.equal(JSON.stringify(executor.describe()), before);
    assert.equal(JSON.stringify(result).includes('PRIVATE_CREDENTIAL'), false);
  }
});
test('CLI adapter keeps public model evidence on terminal failure and timeout', async () => {
  for (const timeout of [false, true]) {
    const script = `process.stdout.write(JSON.stringify({type:'assistant',message:{model:'public-model',content:[{type:'text',text:'answer'}]}})+'\\n');` +
      (timeout ? 'setInterval(()=>{},1000)' : `process.stdout.write('{"type":');process.exitCode=1;`);
    const executor = new CliExecutor({ argv: [process.execPath, '-e', script], shell: false, streamJson: true, wireShape: 'content-blocks',
      modelIdentitySurface: 'claude-assistant', timeoutMs: timeout ? 2000 : 5000 });
    const descriptor = JSON.stringify(executor.describe());
    await assert.rejects(executor.run('offline', process.cwd()), error => {
      assert.ok(error instanceof ExecutorFailure); assert.equal(error.result.modelIdentity?.reportedModels[0]?.id, 'public-model');
      assert.ok(error.result.rawOutput?.includes('public-model')); assert.equal(JSON.stringify(executor.describe()), descriptor); return true;
    });
  }
});

test('API body interruption retains public bytes without guessing a model from incomplete JSON', async () => {
  const prefix = '{"model":"not-yet-a-complete-response",';
  let pulled = false;
  const body = new ReadableStream<Uint8Array>({ pull(controller) {
    if (!pulled) { pulled = true; controller.enqueue(new TextEncoder().encode(prefix)); }
    else controller.error(new Error('synthetic response interruption'));
  } });
  const executor = new ApiExecutor({ apiKey: 'offline', model: 'requested', fetchImpl: async () => new Response(body) });
  await assert.rejects(executor.run('offline'), error => {
    assert.ok(error instanceof ExecutorFailure); assert.equal(error.result.rawOutput, prefix);
    assert.equal(error.result.modelIdentity?.status, 'unrecorded'); assert.equal(error.result.modelIdentity?.requested, 'requested');
    assert.equal(error.result.tokens, undefined); return true;
  });
});
