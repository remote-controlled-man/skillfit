import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiExecutor } from './api.js';

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

test('ApiExecutor throws when the payload has no message content', async () => {
  const fetchImpl: typeof fetch = (async () => jsonResponse({ choices: [] })) as typeof fetch;
  const executor = new ApiExecutor({ apiKey: 'k', fetchImpl });
  await assert.rejects(() => executor.run('hi', '/tmp'), /choices\[0\]/);
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
