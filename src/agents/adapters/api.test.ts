import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiExecutor } from "./api.js";
import { summarizeCosts } from "../../evaluation/measurement/costs.js";
import { spendingBudgetState } from "../../evaluation/execution/budget.js";
import { ExecutorFailure } from "../contracts.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('ApiExecutor posts a chat completion and parses content and usage', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return jsonResponse({
      choices: [{ message: { content: 'the answer' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });
  }) as typeof fetch;
  const executor = new ApiExecutor({ apiKey: 'k', model: 'm', baseUrl: 'https://x.test/v1/', fetchImpl });
  const result = await executor.run('hello', '/tmp');
  assert.equal(result.output, 'the answer');
  assert.deepEqual(result.tokens, { input: 10, output: 5 });
  const call = calls[0];
  assert.ok(call);
  assert.equal(call.url, 'https://x.test/v1/chat/completions');
  const body = JSON.parse(String(call.init?.body)) as { model: string; messages: Array<{ role: string; content: string }> };
  assert.equal(body.model, 'm');
  assert.equal(body.messages[0]?.content, 'hello');
  const headers = call.init?.headers as Record<string, string>;
  assert.equal(headers['authorization'], 'Bearer k');
});

test('ApiExecutor throws on non-2xx responses', async () => {
  const fetchImpl: typeof fetch = (async () => jsonResponse({ error: 'bad' }, 500)) as typeof fetch;
  const executor = new ApiExecutor({ apiKey: 'k', fetchImpl });
  await assert.rejects(() => executor.run('hi', '/tmp'), /status 500/);
});

test('API cache counts reach cost partitions and budget stop lines without double counting', async () => {
  for (const cached of [0, 80, 100]) {
    const fetchImpl: typeof fetch = async () => jsonResponse({ choices: [{ message: { content: 'offline' } }],
      usage: { prompt_tokens: 100, completion_tokens: 10, prompt_tokens_details: { cached_tokens: cached } } });
    const result = await new ApiExecutor({ apiKey: 'offline-only', fetchImpl }).run('offline');
    assert.deepEqual(result.tokens, { input: 100, output: 10, cachedInput: cached });
    const record = { executorInvoked: true, passed: true, error: null, durationSeconds: 1, tokens: result.tokens!, usageStatus: 'final' as const };
    const costs = summarizeCosts({ baseline: [record], treatment: [] }, { baseline: [record], treatment: [] });
    const metrics = costs.attempts.baseline.metrics;
    assert.equal(metrics.input.knownTotal, 100); assert.equal(metrics.cachedInput.knownTotal, cached);
    assert.equal(metrics.uncachedInput.knownTotal, 100 - cached); assert.equal(metrics.cachedInput.coverage.final, 1);
    const state = spendingBudgetState({ input: 100, cachedInput: 1000, uncachedInput: 1000, output: 1000, durationSeconds: 1000 }, [record]);
    assert.equal(state.incomplete.length, 0); assert.ok(state.reached.includes('input'));
  }
});

test('missing, malformed and incompatible API cache counts stay unknown rather than becoming zero', async () => {
  const cases = [undefined, null, false, 'cache', [], {}, { cached_tokens: null }, { cached_tokens: '0' },
    { cached_tokens: -1 }, { cached_tokens: 101 }, { cached_tokens: 0.5 }, { cached_tokens: Number.MAX_SAFE_INTEGER + 1 }];
  for (const details of cases) {
    const fetchImpl: typeof fetch = async () => jsonResponse({ choices: [{ message: { content: 'offline' } }],
      usage: { prompt_tokens: 100, completion_tokens: 10, prompt_tokens_details: details } });
    const tokens = (await new ApiExecutor({ apiKey: 'offline-only', fetchImpl }).run('offline')).tokens!;
    assert.deepEqual(tokens, { input: 100, output: 10 });
    const state = spendingBudgetState({ input: 1000, cachedInput: 1000, uncachedInput: 1000, output: 1000, durationSeconds: 1000 },
      [{ executorInvoked: true, passed: true, error: null, durationSeconds: 1, tokens, usageStatus: 'final' }]);
    assert.equal(state.reason, 'FINAL_USAGE_MISSING'); assert.ok(state.incomplete.includes('cachedInput'));
    assert.equal(state.metrics.uncachedInput.coverage.unknown, 1);
  }
});

test('cache counts without a valid input total cannot establish an API input partition', async () => {
  for (const input of [undefined, null, '100', -1, 0.5]) {
    const fetchImpl: typeof fetch = async () => jsonResponse({ choices: [{ message: { content: 'offline' } }],
      usage: { prompt_tokens: input, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 0 } } });
    const tokens = (await new ApiExecutor({ apiKey: 'offline-only', fetchImpl }).run('offline')).tokens!;
    assert.equal(tokens.cachedInput, undefined); assert.equal(tokens.output, 10);
  }
});

test('ApiExecutor ignores usage objects that do not contain finite token counts', async () => {
  const fetchImpl: typeof fetch = (async () => jsonResponse({
    choices: [{ message: { content: 'answer' } }],
    usage: { prompt_tokens: '10', completion_tokens: null },
  })) as typeof fetch;
  const executor = new ApiExecutor({ apiKey: 'k', fetchImpl });
  const result = await executor.run('hi', '/tmp');
  assert.equal(result.output, 'answer');
  assert.equal(result.tokens, undefined);
});

test('ApiExecutor keeps a token field that is present and drops one that is not', async () => {
  const fetchImpl: typeof fetch = (async () => jsonResponse({
    choices: [{ message: { content: 'answer' } }],
    usage: { prompt_tokens: 12 },
  })) as typeof fetch;
  const executor = new ApiExecutor({ apiKey: 'k', fetchImpl });
  assert.deepEqual((await executor.run('hi', '/tmp')).tokens, { input: 12 });
});

test('ApiExecutor throws when the payload has no message content', async () => {
  const fetchImpl: typeof fetch = (async () => jsonResponse({ choices: [] })) as typeof fetch;
  const executor = new ApiExecutor({ apiKey: 'k', fetchImpl });
  await assert.rejects(() => executor.run('hi', '/tmp'), /choices\[0\]/);
});

test('API invalid content and HTTP errors retain reported final counters and public response', async () => {
  for (const [content, status] of [[null, 200], [undefined, 200], [{ text: 'unsupported' }, 200], ['retained failed output', 500]] as const) {
    let calls = 0;
    const payload = { choices: [{ message: { content, refusal: 'synthetic refusal' } }],
      usage: { prompt_tokens: 123, completion_tokens: 17, prompt_tokens_details: { cached_tokens: 23 } } };
    const executor = new ApiExecutor({ apiKey: 'synthetic-key-not-in-evidence', fetchImpl: async () => { calls++; return jsonResponse(payload, status); } });
    await assert.rejects(executor.run('offline'), error => {
      assert.ok(error instanceof ExecutorFailure); assert.equal(error.executorInvoked, true);
      assert.deepEqual(error.result.tokens, { input: 123, cachedInput: 23, output: 17 });
      assert.equal(error.result.usageStatus, 'final'); assert.equal(error.result.rawOutput, JSON.stringify(payload));
      assert.equal(error.result.output, typeof content === 'string' ? content : '');
      assert.equal(JSON.stringify(error.result).includes('synthetic-key-not-in-evidence'), false); return true;
    });
    assert.equal(calls, 1);
  }
});

test('malformed API payloads retain raw evidence without guessing missing usage', async () => {
  for (const body of ['{broken JSON', 'null', '[]', '{"choices":[]}']) {
    const executor = new ApiExecutor({ apiKey: 'offline-only', fetchImpl: async () => new Response(body) });
    await assert.rejects(executor.run('offline'), error => {
      assert.ok(error instanceof ExecutorFailure); assert.equal(error.result.rawOutput, body);
      assert.equal(error.result.tokens, undefined); assert.equal(error.result.usageStatus, undefined); return true;
    });
  }
  const executor = new ApiExecutor({ apiKey: 'offline-only', fetchImpl: async () => jsonResponse({ choices: [], usage: { prompt_tokens: 12 } }) });
  await assert.rejects(executor.run('offline'), error => {
    assert.ok(error instanceof ExecutorFailure); assert.deepEqual(error.result.tokens, { input: 12 });
    assert.equal(error.result.usageStatus, 'final'); return true;
  });
});

test('ApiExecutor requires an API key', () => {
  assert.throws(() => new ApiExecutor(), /API key/);
});

test('ApiExecutor.fromEnv reads SKILLFIT_API_KEY first', () => {
  const executor = ApiExecutor.fromEnv({
    SKILLFIT_API_KEY: 'skillfit-key',
    OPENAI_API_KEY: 'openai-key',
    SKILLFIT_API_MODEL: 'model-x',
  } as NodeJS.ProcessEnv);
  const descriptor = executor.describe();
  assert.equal(descriptor.kind, 'api');
  assert.equal(descriptor.model, 'model-x');
});

test('ApiExecutor.fromEnv throws without any key', () => {
  assert.throws(() => ApiExecutor.fromEnv({} as NodeJS.ProcessEnv), /API key/);
});

test('API environment construction applies an explicit deadline to fake fetch without any network call', async () => {
  let observed = false;
  const executor = ApiExecutor.fromEnv({ SKILLFIT_API_KEY: 'offline-only' }, { timeoutMs: 10,
    fetchImpl: async (_url, init) => new Promise((_resolve, reject) => {
      observed = true; const signal = init!.signal!;
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }) });
  // AbortSignal.timeout uses an unreferenced timer; keep only this offline test alive.
  const timer = setTimeout(() => {}, 1000);
  try { await assert.rejects(() => executor.run('offline'), error => error instanceof Error && error.name === 'TimeoutError'); }
  finally { clearTimeout(timer); }
  assert.equal(observed, true);
});
