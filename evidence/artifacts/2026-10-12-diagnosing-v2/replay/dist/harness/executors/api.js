function tokenCount(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function tokenUsage(usage) {
    if (!usage || typeof usage !== 'object')
        return undefined;
    const input = tokenCount(usage.prompt_tokens);
    const output = tokenCount(usage.completion_tokens);
    if (input === undefined && output === undefined)
        return undefined;
    return {
        ...(input !== undefined ? { input } : {}),
        ...(output !== undefined ? { output } : {}),
    };
}
const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;
export class ApiExecutor {
    apiKey;
    model;
    baseUrl;
    timeoutMs;
    fetchImpl;
    constructor(options = {}) {
        if (!options.apiKey) {
            throw new Error('ApiExecutor requires an API key. Set SKILLFIT_API_KEY (or OPENAI_API_KEY), or pass --agent to drive an agent CLI instead.');
        }
        this.apiKey = options.apiKey;
        this.model = options.model ?? 'gpt-4o';
        this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.fetchImpl = options.fetchImpl ?? fetch;
    }
    static fromEnv(env = process.env) {
        return new ApiExecutor({
            apiKey: env['SKILLFIT_API_KEY'] ?? env['OPENAI_API_KEY'],
            model: env['SKILLFIT_API_MODEL'],
            baseUrl: env['SKILLFIT_API_BASE_URL'],
        });
    }
    describe() {
        return { kind: 'api', model: this.model, detail: this.baseUrl, sampling: null };
    }
    async run(prompt, _workdir) {
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
            signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (!response.ok) {
            const body = (await response.text()).slice(0, 300);
            throw new Error(`API request failed with status ${response.status}: ${body}`);
        }
        const data = (await response.json());
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== 'string') {
            throw new Error('API response did not contain choices[0].message.content');
        }
        const tokens = tokenUsage(data.usage);
        return tokens ? { output: content, tokens } : { output: content };
    }
}
