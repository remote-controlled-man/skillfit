import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { loadMcpProbeSpec, probeMcpStdio, renderMcpProbe } from './probe.js';

function fixture(t: import('node:test').TestContext, tools: unknown[], keepAlive = false): string {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-mcp-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(
    join(dir, 'server.mjs'),
    `import readline from 'node:readline';
const rl = readline.createInterface({ input: process.stdin });
if (${keepAlive}) setInterval(() => {}, 1000);
rl.on('line', line => {
  const msg = JSON.parse(line);
  if (msg.id === 1) console.log(JSON.stringify({jsonrpc:'2.0',id:1,result:{protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1.0.0'}}}));
  if (msg.id === 2) console.log(JSON.stringify({jsonrpc:'2.0',id:2,result:{tools:${JSON.stringify(tools)}}}));
});\n`,
  );
  const specPath = join(dir, 'probe.json');
  writeFileSync(specPath, JSON.stringify({
    schemaVersion: 1,
    name: 'fixture-server',
    transport: 'stdio',
    command: process.execPath,
    args: [join(dir, 'server.mjs')],
    cwd: process.cwd(),
    timeoutMs: 5000,
  }));
  return specPath;
}

test('probeMcpStdio negotiates, lists tools, and audits model-facing metadata', async (t) => {
  const spec = loadMcpProbeSpec(fixture(t, [{
    name: 'search',
    description: 'Search fixture records',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
    annotations: { readOnlyHint: true },
  }]));
  const result = await probeMcpStdio(spec);
  assert.equal(result.protocolVersion, '2025-11-25');
  assert.deepEqual(result.capabilities, ['tools']);
  assert.deepEqual(result.tools, [{ name: 'search', description: true, inputSchema: true, annotations: true }]);
  assert.deepEqual(result.warnings, []);
  assert.match(renderMcpProbe(result), /No tools were called/);
});

test('probeMcpStdio warns about missing descriptions and annotations', async (t) => {
  const result = await probeMcpStdio(loadMcpProbeSpec(fixture(t, [{ name: 'lookup', inputSchema: { type: 'object' } }])));
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings.join('\n'), /routing will be unreliable/);
  assert.match(result.warnings.join('\n'), /read\/write risk hints/);
});

test('probeMcpStdio rejects invalid tool schemas', async (t) => {
  await assert.rejects(
    probeMcpStdio(loadMcpProbeSpec(fixture(t, [{ name: 'broken' }]))),
    /missing an object inputSchema/,
  );
});

test('probeMcpStdio terminates a server that keeps running after tools/list', { timeout: 3000 }, async (t) => {
  const result = await probeMcpStdio(loadMcpProbeSpec(fixture(t, [], true)));
  assert.equal(result.tools.length, 0);
});
