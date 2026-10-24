import type { Executor, ExecutorDescriptor, ExecutorResult, TokenUsage } from '../types.js';
import { ExecutorFailure } from '../types.js';
import { observedModelIdentity } from '../model-identity.js';
import { evaluationSignal } from '../interruption.js';

export interface ApiExecutorOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; prompt_tokens_details?: unknown };
}

function tokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function tokenUsage(usage: ChatCompletionResponse['usage']): TokenUsage | undefined {
  if (!usage || typeof usage !== 'object') return undefined;
  const input = tokenCount(usage.prompt_tokens);
  const output = tokenCount(usage.completion_tokens);
  const details = usage.prompt_tokens_details;
  const cached = details && typeof details === 'object' && !Array.isArray(details)
    ? tokenCount((details as { cached_tokens?: unknown }).cached_tokens) : undefined;
  const cachedInput = input !== undefined && Number.isSafeInteger(input) && cached !== undefined && Number.isSafeInteger(cached) && cached <= input
    ? cached : undefined;
  if (input === undefined && output === undefined) return undefined;
  return {
    ...(input !== undefined ? { input } : {}),
    ...(output !== undefined ? { output } : {}),
    ...(cachedInput !== undefined ? { cachedInput } : {}),
  };
}

export const DEFAULT_API_TIMEOUT_MS = 2 * 60 * 1000;

export class ApiExecutor implements Executor {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiExecutorOptions = {}) {
    if (!options.apiKey) {
      throw new Error(
        'ApiExecutor requires an API key. Set SKILLFIT_API_KEY (or OPENAI_API_KEY), or pass --agent to drive an agent CLI instead.',
      );
    }
    this.apiKey = options.apiKey;
    this.model = options.model ?? 'gpt-4o';
    this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env, options: Pick<ApiExecutorOptions, 'timeoutMs' | 'fetchImpl'> = {}): ApiExecutor {
    return new ApiExecutor({
      ...options,
      apiKey: env['SKILLFIT_API_KEY'] ?? env['OPENAI_API_KEY'],
      model: env['SKILLFIT_API_MODEL'],
      baseUrl: env['SKILLFIT_API_BASE_URL'],
    });
  }

  describe(): ExecutorDescriptor {
    return { kind: 'api', model: this.model, detail: this.baseUrl, sampling: null,
      modelIntent: { schemaVersion: 1, configured: this.model, requested: this.model } };
  }

  async run(prompt: string, _workdir?: string): Promise<ExecutorResult> {
    const interrupted = evaluationSignal();
    interrupted?.throwIfAborted();
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: interrupted ? AbortSignal.any([interrupted, AbortSignal.timeout(this.timeoutMs)]) : AbortSignal.timeout(this.timeoutMs),
    });
    let body = '';
    try {
      if (response.body) {
        const reader = response.body.getReader(), decoder = new TextDecoder();
        try {
          for (;;) { const chunk = await reader.read(); if (chunk.done) break; body += decoder.decode(chunk.value, { stream: true }); }
          body += decoder.decode();
        } finally { reader.releaseLock(); }
      } else body = await response.text();
    } catch (error) {
      let partial: ChatCompletionResponse | undefined;
      try { partial = JSON.parse(body) as ChatCompletionResponse; } catch { /* Partial JSON cannot identify a response model or establish counters. */ }
      throw new ExecutorFailure(`API response body could not be completed: ${(error as Error).message}`, {
        output: typeof partial?.choices?.[0]?.message?.content === 'string' ? partial.choices[0].message.content : '',
        rawOutput: body, modelIdentity: observedModelIdentity(body, this.describe().modelIntent, 'api'),
        tokens: tokenUsage(partial?.usage), usageStatus: 'partial',
      });
    }
    let data: ChatCompletionResponse | undefined, parsed = false;
    try {
      const value: unknown = JSON.parse(body); parsed = true;
      if (value && typeof value === 'object' && !Array.isArray(value)) data = value as ChatCompletionResponse;
    } catch { /* Retain the public body; malformed JSON cannot establish usage. */ }
    const content = data?.choices?.[0]?.message?.content;
    const tokens = tokenUsage(data?.usage);
    const failure = (message: string) => new ExecutorFailure(message, {
      modelIdentity: observedModelIdentity(body, this.describe().modelIntent, 'api'),
      output: typeof content === 'string' ? content : '', rawOutput: body,
      ...(tokens ? { tokens, usageStatus: 'final' as const } : {}),
    });
    if (!response.ok) throw failure(`API request failed with status ${response.status}: ${body.slice(0, 300)}`);
    if (!parsed) throw failure('API response was not valid JSON');
    if (typeof content !== 'string') {
      throw failure('API response did not contain choices[0].message.content');
    }
    return { output: content, rawOutput: body, modelIdentity: observedModelIdentity(body, this.describe().modelIntent, 'api'), ...(tokens ? { tokens } : {}) };
  }
}
