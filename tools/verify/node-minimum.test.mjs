import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseCommand } from '../../dist/shared/command.js';

const repo = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const bench = join(repo, 'benches/contrib/oss-lru-cache');
const cases = ['fetch-size', 'fetch-abort', 'fetch-lifecycle'];
const definition = JSON.parse(readFileSync(join(bench, 'bench.json'), 'utf8'));
const taskFor = id => definition.tasks.find(task => task.id === id);
const reference = id => dirname(parseCommand(taskFor(id).oracle)[1]);
const loaders = ['runtime.mjs', ...cases.map(id => `${taskFor(id).fixture}/runtime.mjs`)];

test('Node minimum: built CLI help and saved synthetic report work without agent calls', () => {
  for (const [args, expected] of [
    [['--help'], /Usage:/],
    [['report', 'eval', 'docs/examples/eval-manifest.synthetic.json'], /Synthetic harness run/],
  ]) {
    const result = spawnSync(process.execPath, ['dist/cli.js', ...args], { cwd: repo, encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, expected);
  }
});

test('Node minimum: every active loader loads both CJS arms without the TS API', async t => {
  const work = mkdtempSync(join(tmpdir(), 'skillfit-node-cjs-'));
  t.after(() => rmSync(work, { recursive: true, force: true }));
  // Reference sources are applied to disposable fixture copies, as in the real oracle path.
  for (const arm of ['fixtures', 'ground-truth']) for (const id of cases.slice(0, 2)) {
    const root = join(work, arm, id);
    cpSync(join(bench, taskFor(id).fixture), root, { recursive: true });
    if (arm === 'ground-truth') cpSync(join(bench, reference(id), 'index.js'), join(root, 'index.js'));
  }
  for (const file of loaders) {
    const { loadCache } = await import(pathToFileURL(join(bench, file)).href);
    for (const arm of ['fixtures', 'ground-truth']) for (const id of cases.slice(0, 2)) {
      const { Cache, cleanup } = await loadCache(join(work, arm, id));
      try {
        const cache = new Cache({ max: 2 });
        cache.set('key', 'value');
        assert.equal(cache.get('key'), 'value', `${file}: ${arm}/${id}`);
      } finally { cleanup(); }
    }
  }
});

test('Node minimum: TS capability is explicitly refused when absent, both arms load when available', async () => {
  const supported = typeof nodeModule.stripTypeScriptTypes === 'function';
  for (const file of loaders) {
    const { loadCache } = await import(pathToFileURL(join(bench, file)).href);
    for (const arm of ['fixtures', 'ground-truth']) {
      const root = join(bench, arm === 'fixtures' ? taskFor('fetch-lifecycle').fixture : reference('fetch-lifecycle'));
      if (!supported) {
        await assert.rejects(loadCache(root, true), /This replay requires Node >=22\.13 for built-in TypeScript stripping\./);
      } else {
        const { Cache, cleanup } = await loadCache(root, true);
        try {
          const cache = new Cache({ max: 2 });
          cache.set('key', 'value');
          assert.equal(cache.get('key'), 'value', `${file}: ${arm}`);
        } finally { cleanup(); }
      }
    }
  }
  if (!supported) {
    const result = spawnSync(process.execPath, ['dist/cli.js', 'bench', 'check', bench, '--json'],
      { cwd: repo, encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 1, result.stderr);
    const gate = JSON.parse(result.stdout).checks.find(row => row.code === 'ORACLE' && row.taskId === 'fetch-lifecycle');
    assert.equal(gate.status, 'FAIL');
    assert.match(gate.evidence.output, /This replay requires Node >=22\.13/);
  }
  // A capability refusal is a successful negative assertion, never a successful TS replay.
  console.log(`TS replay capability: ${supported ? 'available; both arms loaded' : 'unavailable; explicit refusal verified'}`);
});
