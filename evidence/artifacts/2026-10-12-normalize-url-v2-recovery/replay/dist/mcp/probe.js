import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { killTree, treeSpawnOptions } from '../harness/kill-tree.js';
import { VERSION } from '../version.js';
const PROTOCOL_VERSION = '2025-11-25';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_BUFFER_BYTES = 4 * 1024 * 1024;
function stringArray(value, label) {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw new Error(`${label} must be an array of strings`);
    }
    return value;
}
function stringRecord(value, label) {
    if (value === undefined)
        return {};
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        throw new Error(`${label} must be an object`);
    const record = value;
    if (Object.values(record).some((item) => typeof item !== 'string'))
        throw new Error(`${label} values must be strings`);
    return record;
}
export function loadMcpProbeSpec(path) {
    const absolute = resolve(path);
    if (!existsSync(absolute))
        throw new Error(`MCP probe spec not found: ${absolute}`);
    let value;
    try {
        value = JSON.parse(readFileSync(absolute, 'utf8'));
    }
    catch (error) {
        throw new Error(`Invalid MCP probe spec JSON: ${error.message}`);
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('MCP probe spec must contain a JSON object');
    }
    const record = value;
    if (record['schemaVersion'] !== 1)
        throw new Error('MCP probe spec schemaVersion must be 1');
    if (typeof record['name'] !== 'string' || record['name'].trim() === '') {
        throw new Error('MCP probe spec name must be a non-empty string');
    }
    const timeoutMs = record['timeoutMs'] === undefined ? DEFAULT_TIMEOUT_MS : record['timeoutMs'];
    if (typeof timeoutMs !== 'number' || !Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60_000) {
        throw new Error('MCP probe spec timeoutMs must be an integer between 1000 and 60000');
    }
    const name = record['name'].trim();
    if (record['transport'] === 'http') {
        if (typeof record['url'] !== 'string' || record['url'].trim() === '') {
            throw new Error('MCP HTTP probe spec url must be a non-empty string');
        }
        let url;
        try {
            url = new URL(record['url']);
        }
        catch {
            throw new Error('MCP HTTP probe spec url must be an absolute http(s) URL');
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new Error('MCP HTTP probe spec url must use http or https');
        }
        return {
            schemaVersion: 1,
            name,
            transport: 'http',
            url: url.toString(),
            headers: stringRecord(record['headers'], 'MCP probe spec headers'),
            timeoutMs,
        };
    }
    if (record['transport'] !== 'stdio')
        throw new Error('MCP probe transport must be "stdio" or "http"');
    if (typeof record['command'] !== 'string' || record['command'].trim() === '') {
        throw new Error('MCP probe spec command must be a non-empty string');
    }
    const cwdValue = record['cwd'];
    if (cwdValue !== undefined && typeof cwdValue !== 'string')
        throw new Error('MCP probe spec cwd must be a string');
    const base = dirname(absolute);
    const cwd = cwdValue === undefined ? base : isAbsolute(cwdValue) ? cwdValue : resolve(base, cwdValue);
    return {
        schemaVersion: 1,
        name,
        transport: 'stdio',
        command: record['command'],
        args: stringArray(record['args'] ?? [], 'MCP probe spec args'),
        env: stringRecord(record['env'], 'MCP probe spec env'),
        cwd,
        timeoutMs,
    };
}
function windowsSpawn(command, args) {
    if (process.platform !== 'win32')
        return { command, args, shell: false };
    const matches = isAbsolute(command)
        ? [command]
        : (spawnSync('where.exe', [command], { encoding: 'utf8', windowsHide: true }).stdout ?? '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
    // npm installs an extensionless POSIX shim before the .cmd shim on Windows. Node cannot spawn the
    // former and cannot execute the latter without cmd.exe, so prefer a native Windows executable.
    const resolved = matches.find((item) => /\.(?:exe|com|cmd|bat)$/i.test(item)) ?? matches[0] ?? command;
    if (!/\.(?:cmd|bat)$/i.test(resolved))
        return { command: resolved, args, shell: false };
    const quote = (value) => {
        if (/[;&|<>^%"`$\r\n]/.test(value)) {
            throw new Error(`Refusing a shell-unsafe Windows batch argument: ${JSON.stringify(value)}`);
        }
        return /\s/.test(value) ? `"${value}"` : value;
    };
    const commandLine = [resolved, ...args].map(quote).join(' ');
    return { command: commandLine, args: [], shell: true };
}
function asRecord(value, label) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`${label} must be an object`);
    }
    return value;
}
function auditTools(value) {
    if (!Array.isArray(value))
        throw new Error('tools/list result.tools must be an array');
    const names = new Set();
    const tools = [];
    const warnings = [];
    for (const [index, raw] of value.entries()) {
        const tool = asRecord(raw, `tools[${index}]`);
        if (typeof tool['name'] !== 'string' || tool['name'].trim() === '') {
            throw new Error(`tools[${index}].name must be a non-empty string`);
        }
        const name = tool['name'];
        if (names.has(name))
            throw new Error(`Duplicate MCP tool name: ${name}`);
        names.add(name);
        const schema = tool['inputSchema'];
        const inputSchema = typeof schema === 'object' && schema !== null && !Array.isArray(schema);
        if (!inputSchema)
            throw new Error(`Tool "${name}" is missing an object inputSchema`);
        const description = typeof tool['description'] === 'string' && tool['description'].trim() !== '';
        const annotations = typeof tool['annotations'] === 'object' && tool['annotations'] !== null;
        if (!description)
            warnings.push(`Tool "${name}" has no description; model routing will be unreliable.`);
        if (!annotations)
            warnings.push(`Tool "${name}" has no annotations; clients cannot infer read/write risk hints.`);
        tools.push({ name, description, inputSchema, annotations });
    }
    return { tools, warnings };
}
function assembleProbeResult(name, initializeResult, listedTools, stderr) {
    const audited = auditTools(listedTools);
    const serverInfo = asRecord(initializeResult['serverInfo'], 'initialize result.serverInfo');
    const capabilities = asRecord(initializeResult['capabilities'], 'initialize result.capabilities');
    const protocolVersion = initializeResult['protocolVersion'];
    if (typeof protocolVersion !== 'string')
        throw new Error('initialize result.protocolVersion must be a string');
    if (typeof serverInfo['name'] !== 'string' || typeof serverInfo['version'] !== 'string') {
        throw new Error('initialize result.serverInfo must include string name and version');
    }
    return {
        name,
        protocolVersion,
        serverInfo: { name: serverInfo['name'], version: serverInfo['version'] },
        capabilities: Object.keys(capabilities).sort(),
        tools: audited.tools,
        warnings: audited.warnings,
        stderr,
    };
}
function messagesFromHttpBody(contentType, body) {
    if (body.trim() === '')
        return [];
    if (contentType.includes('text/event-stream')) {
        const messages = [];
        for (const block of body.split(/\r?\n\r?\n/)) {
            const data = block.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
            if (data === '' || data === '[DONE]')
                continue;
            messages.push(JSON.parse(data));
        }
        return messages;
    }
    return [JSON.parse(body)];
}
async function postMcp(spec, body, sessionId) {
    const headers = {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': PROTOCOL_VERSION,
        ...spec.headers,
    };
    if (sessionId)
        headers['mcp-session-id'] = sessionId;
    const response = await fetch(spec.url, {
        method: 'POST',
        redirect: 'error',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(spec.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_BUFFER_BYTES) {
        throw new Error(`MCP HTTP response exceeded ${MAX_BUFFER_BYTES} bytes`);
    }
    return {
        status: response.status,
        contentType: response.headers.get('content-type') ?? '',
        body: text,
        sessionId: response.headers.get('mcp-session-id') ?? sessionId,
    };
}
function jsonRpcResult(messages, id) {
    for (const raw of messages) {
        const message = asRecord(raw, 'MCP HTTP message');
        if (message['id'] !== id)
            continue;
        if (message['error'] !== undefined)
            throw new Error(`MCP request ${id} failed: ${JSON.stringify(message['error'])}`);
        return asRecord(message['result'], `MCP request ${id} result`);
    }
    throw new Error(`MCP HTTP response did not include a result for request ${id}`);
}
export async function probeMcpHttp(spec) {
    const timeoutMs = spec.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const started = Date.now();
    const remaining = () => {
        const left = timeoutMs - (Date.now() - started);
        if (left <= 0)
            throw new Error(`MCP probe timed out after ${timeoutMs}ms`);
        return left;
    };
    const initialize = await postMcp({ ...spec, timeoutMs: remaining() }, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'skillfit', version: VERSION } },
    }, undefined);
    if (initialize.status < 200 || initialize.status >= 300) {
        throw new Error(`MCP HTTP initialize failed with status ${initialize.status}`);
    }
    const initializeResult = jsonRpcResult(messagesFromHttpBody(initialize.contentType, initialize.body), 1);
    if (initializeResult['protocolVersion'] !== PROTOCOL_VERSION) {
        throw new Error(`MCP server negotiated unsupported protocol version: ${String(initializeResult['protocolVersion'])}`);
    }
    const capabilities = asRecord(initializeResult['capabilities'], 'initialize result.capabilities');
    if (!Object.hasOwn(capabilities, 'tools'))
        throw new Error('MCP server did not declare tools capability');
    const noted = await postMcp({ ...spec, timeoutMs: remaining() }, { jsonrpc: '2.0', method: 'notifications/initialized' }, initialize.sessionId);
    if (noted.status !== 202 && (noted.status < 200 || noted.status >= 300)) {
        throw new Error(`MCP HTTP initialized notification failed with status ${noted.status}`);
    }
    const listedTools = [];
    const seenCursors = new Set();
    let cursor;
    for (let page = 0; page < 100; page += 1) {
        const listed = await postMcp({ ...spec, timeoutMs: remaining() }, {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: cursor === undefined ? {} : { cursor },
        }, noted.sessionId);
        if (listed.status < 200 || listed.status >= 300)
            throw new Error(`MCP HTTP tools/list failed with status ${listed.status}`);
        const listResult = jsonRpcResult(messagesFromHttpBody(listed.contentType, listed.body), 2);
        if (!Array.isArray(listResult['tools']))
            throw new Error('tools/list result.tools must be an array');
        listedTools.push(...listResult['tools']);
        const nextCursor = listResult['nextCursor'];
        if (nextCursor === undefined)
            return assembleProbeResult(spec.name, initializeResult, listedTools, '');
        if (typeof nextCursor !== 'string' || nextCursor === '' || seenCursors.has(nextCursor)) {
            throw new Error('MCP tools/list pagination did not terminate');
        }
        seenCursors.add(nextCursor);
        cursor = nextCursor;
    }
    throw new Error('MCP tools/list pagination did not terminate');
}
export async function probeMcp(spec) {
    return spec.transport === 'http' ? probeMcpHttp(spec) : probeMcpStdio(spec);
}
export async function probeMcpStdio(spec) {
    if (spec.transport !== 'stdio')
        throw new Error('probeMcpStdio requires transport "stdio"');
    return new Promise((resolvePromise, rejectPromise) => {
        let invocation;
        try {
            invocation = windowsSpawn(spec.command, spec.args);
        }
        catch (error) {
            rejectPromise(error);
            return;
        }
        const child = spawn(invocation.command, invocation.args, {
            cwd: spec.cwd,
            shell: invocation.shell,
            env: { ...process.env, ...spec.env },
            ...treeSpawnOptions(),
        });
        let settled = false;
        let buffer = '';
        let stderr = '';
        const cleanup = () => {
            child.stdin.end();
            killTree(child);
            try {
                child.kill();
            }
            catch {
                // already exited
            }
            child.stdin.destroy();
            child.stdout.destroy();
            child.stderr.destroy();
            child.unref();
        };
        const finishError = (error) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            cleanup();
            rejectPromise(error);
        };
        const timer = setTimeout(() => finishError(new Error(`MCP probe timed out after ${spec.timeoutMs}ms`)), spec.timeoutMs);
        const send = (message) => {
            child.stdin.write(`${JSON.stringify(message)}\n`, 'utf8');
        };
        child.on('error', (error) => finishError(new Error(`Failed to start MCP server: ${error.message}`)));
        child.stdin.on('error', (error) => {
            if (!settled)
                finishError(new Error(`Failed to write to MCP server: ${error.message}`));
        });
        child.stderr.on('data', (chunk) => {
            stderr = `${stderr}${chunk.toString('utf8')}`.slice(-4096);
        });
        child.on('close', (code) => {
            if (settled)
                return;
            clearTimeout(timer);
            settled = true;
            rejectPromise(new Error(`MCP server exited before tools/list completed (code ${code ?? 'null'})${stderr.trim() ? `: ${stderr.trim()}` : ''}`));
        });
        let initializeResult = null;
        const listedTools = [];
        const seenCursors = new Set();
        let listPages = 0;
        const handle = (raw) => {
            try {
                let parsed;
                try {
                    parsed = JSON.parse(raw);
                }
                catch {
                    throw new Error('MCP server wrote non-JSON data to stdout');
                }
                const message = asRecord(parsed, 'MCP message');
                if (message['method'] === 'ping' && message['id'] !== undefined) {
                    send({ jsonrpc: '2.0', id: message['id'], result: {} });
                    return;
                }
                if (message['id'] === 1) {
                    if (message['error'] !== undefined)
                        throw new Error(`MCP initialize failed: ${JSON.stringify(message['error'])}`);
                    initializeResult = asRecord(message['result'], 'initialize result');
                    if (initializeResult['protocolVersion'] !== PROTOCOL_VERSION) {
                        throw new Error(`MCP server negotiated unsupported protocol version: ${String(initializeResult['protocolVersion'])}`);
                    }
                    const capabilities = asRecord(initializeResult['capabilities'], 'initialize result.capabilities');
                    if (!Object.hasOwn(capabilities, 'tools'))
                        throw new Error('MCP server did not declare tools capability');
                    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
                    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
                    return;
                }
                if (message['id'] !== 2)
                    return;
                if (!initializeResult)
                    throw new Error('MCP server returned tools/list before initialize completed');
                if (message['error'] !== undefined)
                    throw new Error(`MCP tools/list failed: ${JSON.stringify(message['error'])}`);
                const listResult = asRecord(message['result'], 'tools/list result');
                if (!Array.isArray(listResult['tools']))
                    throw new Error('tools/list result.tools must be an array');
                listedTools.push(...listResult['tools']);
                listPages += 1;
                const nextCursor = listResult['nextCursor'];
                if (nextCursor !== undefined) {
                    if (typeof nextCursor !== 'string' || nextCursor === '')
                        throw new Error('tools/list nextCursor must be a non-empty string');
                    if (seenCursors.has(nextCursor) || listPages >= 100)
                        throw new Error('MCP tools/list pagination did not terminate');
                    seenCursors.add(nextCursor);
                    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: { cursor: nextCursor } });
                    return;
                }
                const result = assembleProbeResult(spec.name, initializeResult, listedTools, stderr.trim());
                settled = true;
                clearTimeout(timer);
                // Servers should stop when the client closes stdio, but a keepalive or background handle can
                // otherwise leave the CLI waiting forever after a successful tools/list response.
                cleanup();
                resolvePromise(result);
            }
            catch (error) {
                finishError(error);
            }
        };
        child.stdout.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
            if (Buffer.byteLength(buffer, 'utf8') > MAX_BUFFER_BYTES) {
                finishError(new Error(`MCP stdout exceeded ${MAX_BUFFER_BYTES} bytes without a complete response`));
                return;
            }
            for (;;) {
                const newline = buffer.indexOf('\n');
                if (newline < 0)
                    break;
                const line = buffer.slice(0, newline).trim();
                buffer = buffer.slice(newline + 1);
                if (line !== '')
                    handle(line);
                if (settled)
                    break;
            }
        });
        send({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: PROTOCOL_VERSION,
                capabilities: {},
                clientInfo: { name: 'skillfit', version: VERSION },
            },
        });
    });
}
export function renderMcpProbe(result) {
    const lines = [
        `MCP check: ${result.name}`,
        `PASS handshake — ${result.serverInfo.name} ${result.serverInfo.version}, protocol ${result.protocolVersion}`,
        `PASS tools/list — ${result.tools.length} tool(s)${result.capabilities.length ? `; capabilities: ${result.capabilities.join(', ')}` : ''}`,
    ];
    for (const tool of result.tools) {
        lines.push(`- ${tool.name}: description ${tool.description ? 'yes' : 'no'}, input schema yes, annotations ${tool.annotations ? 'yes' : 'no'}`);
    }
    lines.push('Warnings:');
    if (result.warnings.length === 0)
        lines.push('- none');
    else
        for (const warning of result.warnings)
            lines.push(`- ${warning}`);
    lines.push('No tools were called. Use `skillfit eval <mcp-experiment> --bench <bench> --agent <id>` to measure model behavior and task lift.');
    return lines.join('\n');
}
