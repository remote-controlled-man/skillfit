import assert from 'node:assert/strict';
import { test } from 'node:test';
import { architectureErrors, compiledModules, runtimeImports } from './check-architecture.mjs';

test('runtime edges include static, re-export and literal dynamic imports, excluding text and types', () => {
  assert.deepEqual(runtimeImports(`
    import { value } from './static.js';
    export { other } from './export.js';
    await import('./dynamic.js');
    import type { OnlyType } from './type.js';
    // import './comment.js';
    const text = "import './text.js'";
  `), ['./static.js', './export.js', './dynamic.js']);
});

test('constant template imports participate in core boundaries and cycle detection', () => {
  const files = new Map([
    ['harness/a.js', 'await import(`../commands/b.js`)'],
    ['commands/b.js', "import '../harness/a.js'"],
  ]);
  assert.deepEqual(runtimeImports(files.get('harness/a.js')), ['../commands/b.js']);
  assert.equal(architectureErrors(files).length, 2);
});

test('core to command dependencies and runtime cycles are rejected', () => {
  const errors = architectureErrors(new Map([
    ['harness/a.js', "import '../commands/b.js'"],
    ['commands/b.js', "export { x } from '../harness/c.js'"],
    ['harness/c.js', "await import('./a.js')"],
  ]));
  assert.equal(errors.length, 2);
  assert.match(errors[0], /harness\/a.js imports command adapter/);
  assert.match(errors[1], /Runtime cycle: harness\/a.js -> commands\/b.js -> harness\/c.js -> harness\/a.js/);
});

test('active compiled runtime is acyclic and its core does not depend on command adapters', () => {
  const files = compiledModules();
  assert.ok(files.has('harness/eval-manifest.js'));
  assert.ok([...files.keys()].every(file => !file.endsWith('.test.js')));
  assert.deepEqual(architectureErrors(files), []);
});

test('installation transactions cannot depend on command adapters', () => {
  assert.deepEqual(architectureErrors(new Map([
    ['install/transaction.js', "export { runInstall } from '../commands/install.js'"],
    ['commands/install.js', 'export const runInstall = () => {}'],
  ])), ['install/transaction.js imports command adapter commands/install.js']);
});
