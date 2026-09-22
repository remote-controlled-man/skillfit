import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { collectReceipts, walkGlob } from './receipts.js';

function makeHome(t: import('node:test').TestContext): string {
  const home = mkdtempSync(join(tmpdir(), 'skillfit-receipts-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));

  const kimiWire1 = join(home, '.kimi-code', 'sessions', 'wd_demo', 's1', 'agents', 'main');
  const kimiWire2 = join(home, '.kimi-code', 'sessions', 'wd_demo', 's2', 'agents', 'main');
  mkdirSync(kimiWire1, { recursive: true });
  mkdirSync(kimiWire2, { recursive: true });
  writeFileSync(
    join(kimiWire1, 'wire.jsonl'),
    [
      '{"type":"metadata"}',
      '{"type":"context.append_loop_event","event":{"type":"tool.call","name":"Skill","args":{"skill":"alpha"}},"time":1}',
      '{"type":"context.append_loop_event","event":{"type":"tool.call","name":"Skill","args":{"skill":"alpha"}},"time":2}',
      '{"type":"context.append_loop_event","event":{"type":"tool.call","name":"Read","args":{"path":"x"}},"time":3}',
      'not json at all',
      '{"type":"context.append_loop_event","event":{"type":"tool.call","name":"Skill","args":{"skill":"beta"}},"time":4}',
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(kimiWire2, 'wire.jsonl'),
    '{"type":"context.append_loop_event","event":{"type":"tool.call","name":"Skill","args":{"skill":"alpha"}},"time":5}\n',
  );

  const claudeDir = join(home, '.claude', 'projects', 'proj-x');
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(
    join(claudeDir, 'sess-1.jsonl'),
    [
      '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":"gamma"}}]}}',
      '{"type":"user","message":{"content":"hi"}}',
      '{"type":"assistant","message":{"content":[{"type":"text","text":"ok"},{"type":"tool_use","name":"Bash","input":{}}]}}',
    ].join('\n'),
  );

  for (const [base, name] of [
    ['.kimi-code/skills', 'alpha'],
    ['.agents/skills', 'beta'],
    ['.agents/skills', 'never-skill'],
    ['.claude/skills', 'gamma'],
    ['.claude/skills', 'delta'],
  ] as const) {
    mkdirSync(join(home, base, name), { recursive: true });
    writeFileSync(join(home, base, name, 'SKILL.md'), `# ${name}\n`);
  }
  return home;
}

test('walkGlob matches single-star segments and suffix patterns', (t) => {
  const home = makeHome(t);
  const kimiFiles = walkGlob(join(home, '.kimi-code', 'sessions'), '*/*/agents/*/wire.jsonl');
  assert.equal(kimiFiles.length, 2);
  const claudeFiles = walkGlob(join(home, '.claude', 'projects'), '*/*.jsonl');
  assert.equal(claudeFiles.length, 1);
});

test('collectReceipts aggregates skill fires per agent and computes never-fired', async (t) => {
  const home = makeHome(t);
  const receipts = await collectReceipts({ homeDir: home });
  const kimi = receipts.find((r) => r.agentId === 'kimi-code');
  const claude = receipts.find((r) => r.agentId === 'claude-code');
  const codex = receipts.find((r) => r.agentId === 'codex');

  assert.ok(kimi?.present);
  assert.equal(kimi.sessionsFound, 2);
  assert.equal(kimi.transcriptsRead, 2);
  const alpha = kimi.skills.find((s) => s.name === 'alpha');
  const beta = kimi.skills.find((s) => s.name === 'beta');
  assert.deepEqual(
    { fires: alpha?.fires, sessions: alpha?.sessionCount },
    { fires: 3, sessions: 2 },
  );
  assert.deepEqual({ fires: beta?.fires, sessions: beta?.sessionCount }, { fires: 1, sessions: 1 });
  assert.deepEqual(kimi.neverFired, ['never-skill']);

  assert.ok(claude?.present);
  const gamma = claude.skills.find((s) => s.name === 'gamma');
  assert.equal(gamma?.fires, 1);
  assert.deepEqual(claude.neverFired, ['delta']);

  assert.ok(codex);
  assert.equal(codex.present, false);
  assert.equal(codex.skills.length, 0);
});

test('collectReceipts handles a home with no session stores at all', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'skillfit-receipts-empty-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const receipts = await collectReceipts({ homeDir: home });
  for (const receipt of receipts) {
    assert.equal(receipt.present, false);
    assert.equal(receipt.skills.length, 0);
  }
});

test('collectReceipts filters to a single agent when asked', async (t) => {
  const home = makeHome(t);
  const receipts = await collectReceipts({ homeDir: home, agent: 'kimi-code' });
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0]?.agentId, 'kimi-code');
});


test('walkGlob supports ** for any depth', (t) => {
  const home = makeHome(t);
  const deep = join(home, '.codex', 'sessions', '2026', '09', '22');
  mkdirSync(deep, { recursive: true });
  writeFileSync(join(deep, 'rollout-x.jsonl'), '');
  const files = walkGlob(join(home, '.codex', 'sessions'), '**/rollout-*.jsonl');
  assert.equal(files.length, 1);
});

test('collectReceipts reads codex rollouts (custom_tool_call skill-path evidence)', async (t) => {
  const home = makeHome(t);
  const deep = join(home, '.codex', 'sessions', '2026', '09', '22');
  mkdirSync(deep, { recursive: true });
  writeFileSync(
    join(deep, 'rollout-2026-09-22T00-00-00-aaaa.jsonl'),
    [
      '{"type":"response_item","payload":{"type":"message","role":"user"}}',
      '{"type":"response_item","payload":{"type":"custom_tool_call","status":"completed","name":"exec","input":"Get-Content -Raw C:\\\\repo\\\\.agents\\\\skills\\\\alpha\\\\SKILL.md"}}',
      '{"type":"response_item","payload":{"type":"custom_tool_call","status":"completed","name":"exec","input":"type src\\\\main.js"}}',
    ].join('\n'),
  );
  mkdirSync(join(home, '.agents', 'skills', 'codex-only-skill'), { recursive: true });
  writeFileSync(join(home, '.agents', 'skills', 'codex-only-skill', 'SKILL.md'), '# x\n');
  const receipts = await collectReceipts({ homeDir: home, agent: 'codex' });
  const codex = receipts[0];
  assert.ok(codex);
  assert.equal(codex.present, true);
  const alpha = codex.skills.find((s) => s.name === 'alpha');
  assert.equal(alpha?.fires, 1);
  assert.deepEqual(codex.neverFired, ['beta', 'codex-only-skill', 'never-skill']);
});
