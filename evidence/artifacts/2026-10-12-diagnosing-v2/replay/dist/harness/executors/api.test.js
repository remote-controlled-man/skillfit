import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiExecutor } from './api.js';
function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}
test('ApiExecutor posts a chat completion and parses content and usage', async () => {
    const calls = [];
    const fetchImpl = (async (url, init) => {
        calls.push({ url: String(url), init });
        return jsonResponse({
            choices: [{ message: { content: 'the answer' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
        });
    });
    const executor = new ApiExecutor({ apiKey: 'k', model: 'm', baseUrl: 'https://x.test/v1/', fetchImpl });
    const result = await executor.run('hello', '/tmp');
    assert.equal(result.output, 'the answer');
    assert.deepEqual(result.tokens, { input: 10, output: 5 });
    const call = calls[0];
    assert.ok(call);
    assert.equal(call.url, 'https://x.test/v1/chat/completions');
    const body = JSON.parse(String(call.init?.body));
    assert.equal(body.model, 'm');
    assert.equal(body.messages[0]?.content, 'hello');
    const headers = call.init?.headers;
    assert.equal(headers['authorization'], 'Bearer k');
});
test('ApiExecutor throws on non-2xx responses', async () => {
    const fetchImpl = (async () => jsonResponse({ error: 'bad' }, 500));
    const executor = new ApiExecutor({ apiKey: 'k', fetchImpl });
    await assert.rejects(() => executor.run('hi', '/tmp'), /status 500/);
});
test('ApiExecutor ignores usage objects that do not contain finite token counts', async () => {
    const fetchImpl = (async () => jsonResponse({
        choices: [{ message: { content: 'answer' } }],
        usage: { prompt_tokens: '10', completion_tokens: null },
    }));
    const executor = new ApiExecutor({ apiKey: 'k', fetchImpl });
    const result = await executor.run('hi', '/tmp');
    assert.equal(result.output, 'answer');
    assert.equal(result.tokens, undefined);
});
test('ApiExecutor keeps a token field that is present and drops one that is not', async () => {
    const fetchImpl = (async () => jsonResponse({
        choices: [{ message: { content: 'answer' } }],
        usage: { prompt_tokens: 12 },
    }));
    const executor = new ApiExecutor({ apiKey: 'k', fetchImpl });
    assert.deepEqual((await executor.run('hi', '/tmp')).tokens, { input: 12 });
});
test('ApiExecutor throws when the payload has no message content', async () => {
    const fetchImpl = (async () => jsonResponse({ choices: [] }));
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
    });
    const descriptor = executor.describe();
    assert.equal(descriptor.kind, 'api');
    assert.equal(descriptor.model, 'model-x');
});
test('ApiExecutor.fromEnv throws without any key', () => {
    assert.throws(() => ApiExecutor.fromEnv({}), /API key/);
});
