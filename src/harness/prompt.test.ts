import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildTaskPrompt, snapshotRepoFiles } from './prompt.js';

function makeRepo(t: import('node:test').TestContext): string {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-prompt-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.git'), { recursive: true });
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'src', 'a.js'), 'export const a = 1;\n');
  writeFileSync(join(dir, '.git', 'config'), '[core]\n');
  writeFileSync(join(dir, '_prompt.txt'), 'hidden\n');
  writeFileSync(join(dir, '.skillfit-mock.json'), '{}\n');
  return dir;
}

test('snapshotRepoFiles hides .git, underscore files and the mock marker', (t) => {
  const dir = makeRepo(t);
  const snapshot = snapshotRepoFiles(dir);
  assert.match(snapshot, /--- repository file: src\/a\.js ---/);
  assert.match(snapshot, /export const a = 1;/);
  assert.ok(!snapshot.includes('.git'));
  assert.ok(!snapshot.includes('hidden'));
  assert.ok(!snapshot.includes('skillfit-mock'));
});

test('buildTaskPrompt omits the skill block for baseline', () => {
  const prompt = buildTaskPrompt('Do the task.\n', '--- repository file: a ---\n1', null);
  assert.match(prompt, /^Do the task\./);
  assert.match(prompt, /Experiment isolation rules:/);
  assert.match(prompt, /Repository snapshot:/);
  assert.match(prompt, /Output contract:/);
  assert.ok(!prompt.includes('<skill name='));
});

test('buildTaskPrompt embeds the skill payload for treatment', () => {
  const prompt = buildTaskPrompt('Do the task.', 'snapshot', 'Treatment material:\n<skill name="s">X</skill>');
  assert.match(prompt, /<skill name="s">X<\/skill>/);
  assert.ok(prompt.indexOf('<skill name=') > prompt.indexOf('Repository snapshot:'));
  assert.ok(prompt.indexOf('Output contract:') > prompt.indexOf('<skill name='));
});
