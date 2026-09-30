import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { collectEvaluationTarget, EXPERIMENT_FILE } from './target.js';

function tmp(t: import('node:test').TestContext): string {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-target-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('collectEvaluationTarget keeps ordinary directories as skill targets', (t) => {
  const dir = tmp(t);
  writeFileSync(join(dir, 'SKILL.md'), '# demo\n');
  const target = collectEvaluationTarget(dir);
  assert.equal(target.kind, 'skill');
  assert.match(target.payload ?? '', /<skill/);
  assert.deepEqual(target.overlays, {});
});

test('collectEvaluationTarget loads a rules or MCP workspace experiment', (t) => {
  const dir = tmp(t);
  mkdirSync(join(dir, 'baseline', '.codex'), { recursive: true });
  mkdirSync(join(dir, 'treatment', '.codex'), { recursive: true });
  writeFileSync(join(dir, 'baseline', '.codex', 'config.toml'), '# no server\n');
  writeFileSync(join(dir, 'treatment', '.codex', 'config.toml'), '[mcp_servers.context7]\n');
  writeFileSync(
    join(dir, EXPERIMENT_FILE),
    JSON.stringify({ schemaVersion: 1, name: 'context7', kind: 'mcp', baseline: 'baseline', treatment: 'treatment' }),
  );

  const target = collectEvaluationTarget(dir);
  assert.equal(target.kind, 'mcp');
  assert.equal(target.name, 'context7');
  assert.equal(target.payload, null);
  assert.ok(target.overlays.baseline?.endsWith('baseline'));
  assert.ok(target.overlays.treatment?.endsWith('treatment'));
  assert.deepEqual(target.files, [
    'baseline/.codex/config.toml',
    'skillfit-experiment.json',
    'treatment/.codex/config.toml',
  ]);
  assert.equal(target.sha256.length, 64);
});

test('collectEvaluationTarget rejects traversal and empty treatment overlays', (t) => {
  const dir = tmp(t);
  writeFileSync(
    join(dir, EXPERIMENT_FILE),
    JSON.stringify({ schemaVersion: 1, kind: 'mcp', treatment: '..' }),
  );
  assert.throws(() => collectEvaluationTarget(dir), /escapes the experiment directory/);

  mkdirSync(join(dir, 'empty'));
  writeFileSync(
    join(dir, EXPERIMENT_FILE),
    JSON.stringify({ schemaVersion: 1, kind: 'rules', treatment: 'empty' }),
  );
  assert.throws(() => collectEvaluationTarget(dir), /must contain at least one file/);
});

test('collectEvaluationTarget rejects overlays that leave the experiment through a symlink', (t) => {
  const dir = tmp(t);
  const outside = tmp(t);
  writeFileSync(join(outside, 'AGENTS.md'), '# outside\n');
  symlinkSync(outside, join(dir, 'treatment'));
  writeFileSync(join(dir, EXPERIMENT_FILE), JSON.stringify({ schemaVersion: 1, kind: 'rules', treatment: 'treatment' }));
  assert.throws(() => collectEvaluationTarget(dir), /escapes or aliases the experiment directory/);
});

test('collectEvaluationTarget rejects an overlay that aliases the experiment root', (t) => {
  const dir = tmp(t);
  writeFileSync(join(dir, EXPERIMENT_FILE), JSON.stringify({ schemaVersion: 1, kind: 'rules', treatment: '.' }));
  assert.throws(() => collectEvaluationTarget(dir), /escapes or aliases the experiment directory/);
});
