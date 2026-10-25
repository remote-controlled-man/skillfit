import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readAgentEnvironment, resolveAgentRulePath } from './environment.js';
import { getAgent } from './matrix.js';

test('Agent environment describes overridden Codex settings and missing configuration without leaking secrets', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-environment-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const homeDir = join(root, 'home'), profile = join(root, 'profile');
  mkdirSync(profile);
  writeFileSync(join(profile, 'config.toml'), 'model = "offline"\nmodel_reasoning_effort = "high"\napi_key = "PRIVATE_SECRET"\n[projects."/other"]\nmodel = "ignored"\n');
  const agent = getAgent('codex'), context = { homeDir, cwd: root, env: { CODEX_HOME: profile } };
  const result = readAgentEnvironment(agent, context);
  assert.deepEqual(result.settings.fields, { model: 'offline', model_reasoning_effort: 'high' });
  assert.equal(result.settings.path, join(profile, 'config.toml'));
  assert.ok(result.configFiles.some(file => file.path === join(profile, 'AGENTS.override.md')));
  assert.equal(resolveAgentRulePath(agent, agent.rules.userFiles[0]!, context), join(profile, 'AGENTS.md'));
  assert.ok(result.skillRoots.includes(join(homeDir, '.agents', 'skills')));
  assert.equal(JSON.stringify(result).includes('PRIVATE_SECRET'), false);
  assert.deepEqual(result.configFiles.find(file => file.path === result.settings.path)?.trust,
    { table: 'projects', field: 'trust_level', value: 'trusted' });
  rmSync(join(profile, 'config.toml'));
  const missing = readAgentEnvironment(agent, context);
  assert.deepEqual(missing.settings, { path: join(profile, 'config.toml'), fields: {} });
  assert.ok(missing.configFiles.some(file => file.path === join(profile, 'config.toml')));
});

test('Agent settings decode declared JSON fields only and keep invalid JSON explicit', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-environment-json-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const base = getAgent('codex');
  const agent = { ...base, headless: { ...base.headless, runtime: { settings: {
    file: 'settings.json', format: 'json' as const, keys: ['model'], docs: 'fixture',
  } } } };
  const context = { homeDir: join(root, 'home'), cwd: root, env: {} };
  writeFileSync(join(root, 'settings.json'), '{"model":"offline-json","api_key":"PRIVATE_SECRET","extra":12}');
  assert.deepEqual(readAgentEnvironment(agent, context).settings, { path: join(root, 'settings.json'), fields: { model: 'offline-json' } });
  writeFileSync(join(root, 'settings.json'), '{');
  assert.throws(() => readAgentEnvironment(agent, context), SyntaxError);
});
