import assert from 'node:assert/strict';
import { test } from 'node:test';
import { posix } from 'node:path';
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

test('shared mechanisms, controls and saved audits do not load experiment orchestration', () => {
  const files = compiledModules();
  const forbidden = new Set(['harness/runner.js', 'harness/judge.js', 'harness/trigger.js']);
  for (const entry of ['harness/process.js', 'harness/verifier.js', 'harness/trial-workspace.js',
    'harness/trial-summary.js', 'harness/judge-protocol.js', 'harness/trigger-summary.js',
    'harness/executors/control.js', 'harness/bench-check.js', 'harness/eval-audit.js',
    'harness/judge-audit.js', 'harness/single-arm-audit.js', 'harness/eval-read-service.js',
    'harness/single-arm-read.js', 'harness/eval-planning.js', 'commands/eval-single-arm-report.js']) {
    assert.ok(files.has(entry), `Missing shared entry: ${entry}`);
    const seen = new Set();
    const visit = (file, chain) => {
      assert.ok(!forbidden.has(file), `Lower-level dependency reaches execution: ${[...chain, file].join(' -> ')}`);
      if (seen.has(file)) return;
      seen.add(file);
      for (const specifier of runtimeImports(files.get(file))) {
        const target = posix.normalize(posix.join(posix.dirname(file), specifier));
        if (files.has(target)) visit(target, [...chain, file]);
      }
    };
    visit(entry, []);
  }
});
