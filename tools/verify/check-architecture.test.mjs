import assert from 'node:assert/strict';
import { test } from 'node:test';
import { posix } from 'node:path';
import { architectureErrors, compiledModules, runtimeImports, sourceModules, readArchitecturePolicy } from './check-architecture.mjs';

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
  assert.ok(files.has('evaluation/records/manifest.js'));
  assert.ok([...files.keys()].every(file => !file.endsWith('.test.js')));
  assert.deepEqual(architectureErrors(files, { sources: sourceModules(), policy: readArchitecturePolicy() }), []);
});

test('installation transactions cannot depend on command adapters', () => {
  assert.deepEqual(architectureErrors(new Map([
    ['install/transaction.js', "export { runInstall } from '../commands/install.js'"],
    ['commands/install.js', 'export const runInstall = () => {}'],
  ])), ['install/transaction.js imports command adapter commands/install.js']);
});

test('shared mechanisms, controls and saved audits do not load experiment orchestration', () => {
  const files = compiledModules();
  const forbidden = new Set(['evaluation/execution/paired.js', 'evaluation/execution/judge.js', 'evaluation/execution/activation.js']);
  for (const entry of ['shared/process.js', 'bench/gates/verifier.js', 'evaluation/targets/workspace.js',
    'evaluation/measurement/trial-summary.js', 'evaluation/measurement/judge-protocol.js', 'evaluation/measurement/trigger-summary.js',
    'evaluation/execution/control-executor.js', 'bench/gates/check.js', 'evaluation/records/audit.js',
    'evaluation/records/judge-audit.js', 'evaluation/records/single-arm-audit.js', 'evaluation/application/read.js',
    'evaluation/records/single-arm-read.js', 'evaluation/application/planning.js', 'cli/eval-single-arm-report.js', 'cli/eval-display.js']) {
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

test('declared dependency roles reject executor-to-runner and source-only command types', () => {
  const policy = { schemaVersion: 1,
    roles: { integration: { runtime: ['integration'], type: ['integration'] },
      execution: { runtime: ['integration', 'execution'], type: ['integration', 'execution'] },
      entry: { runtime: ['integration', 'execution', 'entry'], type: ['integration', 'execution', 'entry'] } },
    modules: [{ files: ['harness/executors/cli.js'], role: 'integration' },
      { files: ['harness/runner.js'], role: 'execution' }, { prefix: 'commands/', role: 'entry' }],
    exceptions: [], dynamicImports: [] };
  const files = new Map([['harness/executors/cli.js', "import '../runner.js'"], ['harness/runner.js', ''], ['commands/types.js', '']]);
  const sources = new Map([['harness/executors/cli.ts', "import type { Options } from '../../commands/types.js'"],
    ['harness/runner.ts', ''], ['commands/types.ts', '']]);
  const errors = architectureErrors(files, { policy, sources });
  assert.ok(errors.some(error => /integration.*execution|executor.*runner/.test(error)), errors.join('\n'));
  assert.ok(errors.some(error => /type.*commands\/types/.test(error)), errors.join('\n'));
});

test('effect rules follow immutable aliases and destructuring while respecting lexical shadows', () => {
  const policy = { schemaVersion: 1,
    roles: { calculation: { runtime: ['calculation'], type: ['calculation'], effects: 'pure' },
      application: { runtime: ['calculation'], type: ['calculation'], effects: 'application' } },
    modules: [{ prefix: 'calc/', role: 'calculation' }, { prefix: 'app/', role: 'application' }], exceptions: [], dynamicImports: [] };
  const files = new Map([
    ['calc/env.js', 'const { env: settings } = process; export const mode = settings.MODE;'],
    ['calc/time.js', 'const { now: clock } = Date; export const value = clock();'],
    ['calc/io.js', "import { readFileSync as read } from 'node:fs'; read('x');"],
    ['app/exit.js', 'const p = globalThis.process; const stop = p["exit"]; stop(1);'],
    ['app/console.js', "import { log as print } from 'node:console'; print('hidden');"],
  ]);
  const errors = architectureErrors(files, { policy });
  for (const name of files.keys()) assert.ok(errors.some(e => e.includes(name) && /effect|I\/O/.test(e)), `${name}: ${errors}`);
  assert.deepEqual(architectureErrors(new Map([
    ['calc/legal.js', 'export function parse(process, Date) { return process.env + Date.now(); } const text = "process.env console.log Math.random()";'],
    ['app/legal.js', 'export function view(console) { console.log("user supplied renderer"); }'],
  ]), { policy }), []);
});

test('computed imports need a declared, statically finite set which still obeys roles', () => {
  const policy = { schemaVersion: 1, roles: { core: { runtime: ['core'], type: ['core'] } },
    modules: [{ prefix: 'core/', role: 'core' }], exceptions: [], dynamicImports: [] };
  const files = new Map([['core/a.js', "const target = choose ? './b.js' : './c.js'; await import(target);"], ['core/b.js', ''], ['core/c.js', '']]);
  assert.ok(architectureErrors(files, { policy }).some(e => /dynamic import.*declar/i.test(e)));
  const declared = { ...policy, dynamicImports: [{ from: 'core/a.js', expression: 'target', targets: ['./b.js', './c.js'] }] };
  assert.deepEqual(architectureErrors(files, { policy: declared }), []);
  files.set('core/a.js', 'export async function load(target) { return import(target); }');
  assert.ok(architectureErrors(files, { policy: declared }).some(e => /finite/i.test(e)));
});

test('narrow legacy exceptions expire and cannot cover a migrated module', () => {
  const files = new Map([['legacy/a.js', "import '../app/b.js'"], ['app/b.js', '']]);
  const policy = { schemaVersion: 1, roles: { low: { runtime: ['low'], type: ['low'] }, high: { runtime: ['low', 'high'], type: ['low', 'high'] } },
    modules: [{ prefix: 'legacy/', role: 'low' }, { prefix: 'app/', role: 'high' }], dynamicImports: [],
    exceptions: [{ from: 'legacy/a.js', to: 'app/b.js', kind: 'runtime', reason: 'Existing mixed parser; split before removing', owner: 'development', removalTask: 'split-legacy-parser' }] };
  assert.deepEqual(architectureErrors(files, { policy }), []);
  files.set('legacy/a.js', '');
  assert.ok(architectureErrors(files, { policy }).some(e => /stale exception/i.test(e)));
  files.set('legacy/a.js', "import '../app/b.js'");
  assert.ok(architectureErrors(files, { policy: { ...policy, migratedFiles: ['legacy/a.js'] } }).some(e => /migrated.*exception|exception.*migrated/i.test(e)));
  assert.ok(architectureErrors(files, { policy: { ...policy, exceptions: [{ ...policy.exceptions[0], from: 'legacy/' }] } }).some(e => /invalid exception/i.test(e)));
});

test('identically named dynamic import expressions keep their own lexical scopes', () => {
  const policy = { schemaVersion: 1, roles: { core: { runtime: ['core'], type: ['core'] } },
    modules: [{ prefix: 'core/', role: 'core' }], exceptions: [],
    dynamicImports: [{ from: 'core/a.js', expression: 'target', targets: ['./b.js'] }] };
  const files = new Map([['core/a.js', "async function unsafe(target) { await import(target); } const target = './b.js'; await import(target);"], ['core/b.js', '']]);
  assert.ok(architectureErrors(files, { policy }).some(e => /verified finite/.test(e)));
});

test('registration is complete and unambiguous; type-only cycles are not runtime cycles', () => {
  const policy = { schemaVersion: 1, roles: { core: { runtime: ['core'], type: ['core'] } },
    modules: [{ files: ['core/a.js', 'core/b.js'], role: 'core' }], exceptions: [], dynamicImports: [] };
  const files = new Map([['core/a.js', 'export const a = 1;'], ['core/b.js', 'export const b = 2;']]);
  const sources = new Map([['core/a.ts', "import type { B } from './b.js'"], ['core/b.ts', "type A = import('./a.js').A"]]);
  assert.deepEqual(architectureErrors(files, { policy, sources }), []);
  files.set('core/new.js', '');
  assert.ok(architectureErrors(files, { policy, sources }).some(e => /core\/new.js.*one known/.test(e)));
  files.delete('core/new.js');
  assert.ok(architectureErrors(files, { policy: { ...policy, modules: [...policy.modules, { prefix: 'core/', role: 'core' }] }, sources }).some(e => /found 2/.test(e)));
});

test('re-exports and literal/template dynamic imports cannot bypass lower-role boundaries', () => {
  const policy = { schemaVersion: 1, roles: { low: { runtime: ['low'], type: ['low'] }, high: { runtime: ['low', 'high'], type: ['low', 'high'] } },
    modules: [{ prefix: 'evidence/', role: 'low' }, { prefix: 'execution/', role: 'high' }], exceptions: [], dynamicImports: [] };
  for (const expression of ["export { run } from '../execution/runner.js'", "await import('../execution/runner.js')", 'await import(`../execution/runner.js`)']) {
    assert.ok(architectureErrors(new Map([['evidence/read.js', expression], ['execution/runner.js', '']]), { policy }).some(e => /forbidden runtime.*execution\/runner/.test(e)));
  }
});

test('pure effect checks allow explicit dates and verifier template text, rejecting clock/random aliases', () => {
  const policy = { schemaVersion: 1, roles: { pure: { runtime: ['pure'], type: ['pure'], effects: 'pure' } },
    modules: [{ prefix: 'pure/', role: 'pure' }], exceptions: [], dynamicImports: [] };
  assert.deepEqual(architectureErrors(new Map([['pure/legal.js', 'export const source = `import fs from "node:fs"; console.log(process.env);`; export const date = new Date("2026-01-01");']]), { policy }), []);
  for (const source of ['Date(0);', 'const random = Math.random; random();', 'const clock = globalThis.Date; new clock();', 'const { env: vars } = globalThis.process; vars.KEY;', "import { randomUUID as id } from 'node:crypto'; id();"]) {
    assert.ok(architectureErrors(new Map([['pure/bad.js', source]]), { policy }).some(e => /effect/.test(e)), source);
  }
});

test('malformed policy rows fail with actionable errors rather than throwing', () => {
  const files = new Map([['a.js', '']]);
  const valid = { schemaVersion: 1, roles: { core: { runtime: ['core'], type: ['core'] } }, modules: [{ files: ['a.js'], role: 'core' }], exceptions: [], dynamicImports: [] };
  for (const policy of [{ ...valid, roles: { core: null } }, { ...valid, modules: [null] }, { ...valid, exceptions: [null] }, { ...valid, dynamicImports: [null] }]) {
    assert.ok(architectureErrors(files, { policy }).length > 0);
  }
});

test('measurement execution and application cannot reach the user-configuration transaction', () => {
  const policy = readArchitecturePolicy();
  for (const entry of ['evaluation/execution/paired.js', 'bench/authoring.js']) {
    const files = compiledModules(); files.set(entry, files.get(entry) + `\nimport '${posix.relative(posix.dirname(entry), "configuration/transaction.js")}';\n`);
    assert.ok(architectureErrors(files, { policy }).some(e => e.includes(entry) && /forbidden runtime.*configuration\/transaction/.test(e)));
  }
});

test('business ownership blocks Bench orchestration, private adapters and shared host policy', () => {
  const policy = readArchitecturePolicy();
  for (const [entry, injected, expected] of [
    ['bench/authoring.js', "import '../evaluation/application/evaluation.js';", /forbidden business dependency/],
    ['resources/experiment.js', "import { writeFileSync } from 'node:fs'; writeFileSync('generated', 'bytes');", /read-only Resource/],
    ['shared/process.js', "import { on as listen } from 'node:process'; listen('SIGINT', () => {});", /hostless effect/],
    ['evaluation/application/planning.js', "const value = agent.headless.streamJson.wireShape;", /vendor observation/],
    ['usage/receipts.js', "import '../agents/adapters/cli.js';", /private module/],
  ]) {
    const files = compiledModules(); files.set(entry, files.get(entry) + '\n' + injected);
    assert.ok(architectureErrors(files, { policy }).some(error => error.includes(entry) && expected.test(error)), `${entry}: ${expected}`);
  }
});
