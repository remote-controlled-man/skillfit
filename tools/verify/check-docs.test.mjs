import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { checkDocumentation, inspectRepositoryLayout, documentationFiles, inspectDocumentation, inspectBenchCatalog, markdownAnchors, markdownLinks, readDocumentationBaseline } from './check-docs.mjs';
import { RELEASE_DOCUMENTS } from './recipes/release-docs-smoke.mjs';

function governedFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-governed-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, text) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), text); };
  for (const path of RELEASE_DOCUMENTS) put(path, `# Entry\nRun npx skillfit@0.13.1.\n${path.startsWith('README') ? '[Changelog](CHANGELOG.md)' : ''}\n`);
  put('CHANGELOG.md', '# Changelog\n');
  put('docs/maintainers/releases.md', '# Release\n');
  put('package.json', '{"name":"skillfit","version":"0.13.1"}');
  put('docs/work/current.md', '# Current\n');
  put('docs/maintainers/history.md', '# History\n[Historical broken link](missing.md)\n');
  const policy = { schemaVersion: 1, documents: [...RELEASE_DOCUMENTS, 'CHANGELOG.md', 'docs/maintainers/releases.md', 'docs/work/current.md', 'docs/maintainers/history.md'].map(path => ({
    path, kind: 'record', lifecycle: path.endsWith('history.md') ? 'historical' : path.endsWith('/releases.md') ? 'frozen' : 'maintained',
    audience: ['maintainer'], owner: 'development', scope: [{ kind: 'source', ref: 'working-tree' }], topics: [], checks: ['docs-links'],
  })), topics: {}, exclusions: [] };
  put('tools/verify/documentation-policy.json', JSON.stringify(policy));
  return { root, put };
}

test('anchors support Chinese, repeated headings, inline formatting and explicit aliases', () => {
  const anchors = markdownAnchors('# 用 npm 开始\n## `A` & B\n## A\n## A\n<a id="old" name="alias"></a>\n```md\n# Hidden\n```\n');
  assert.ok(anchors.has('用-npm-开始'));
  assert.ok(anchors.has('a--b'));
  assert.ok(anchors.has('a-1'));
  assert.ok(anchors.has('old'));
  assert.ok(anchors.has('alias'));
  assert.ok(!anchors.has('hidden'));
});

test('link discovery skips fenced and inline examples and preserves source lines', () => {
  const links = markdownLinks('```md\n[x](missing.md)\n```\n`[x](inline.md)`\n[x](real.md#ok)\n[ref]: target.md\n');
  assert.deepEqual(links, [{ target: 'real.md#ok', line: 5 }, { target: 'target.md', line: 6 }]);
});

test('documentation check rejects missing files/anchors without reading outside public roots', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-doc-links-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'README.md'), '[ok](docs/guide.md#valid)\n[bad](docs/guide.md#absent)\n[missing](missing.md)\n[private](workspace4skills/private.md)\n[web](https://example.com)\n');
  writeFileSync(join(root, 'docs/guide.md'), '# Valid\n');
  const errors = inspectDocumentation(root, ['README.md']);
  assert.equal(errors.length, 3);
  assert.match(errors[0], /README.md:2: missing anchor/);
  assert.match(errors[1], /README.md:3: missing target/);
  assert.match(errors[2], /public documentation scope/);
});

test('version-sensitive repository links reject moving refs while snapshots and live channels stay offline', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-doc-versions-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const base = 'https://github.com/remote-controlled-man/skillfit';
  const snapshot = 'ed5eaff7d222de1c73874ce022785fbe89291017';
  writeFileSync(join(root, 'README.md'), [
    `[wrong source](VERSION_BASE/blob/main/docs/guides/experiment-workflow.md)`,
    `[moving tag](VERSION_BASE/tree/v0.13.1/docs)`,
    `[feature branch](VERSION_BASE/blob/codex/docs-framework-architecture/benches/README.md)`,
    `[moving tooling](VERSION_BASE/blob/main/tools/verify/architecture-policy.json)`,
    `[moving matrix](VERSION_BASE/blob/main/src/matrix/agents.json)`,
    `[moving definition](VERSION_BASE/blob/main/.github/workflows/npm-release.yml)`,
    `[snapshot](VERSION_BASE/blob/VERSION_SHA/docs/guides/experiment-workflow.md#executor-capabilities)`,
    `[published docs](VERSION_BASE/tree/VERSION_SHA/docs)`,
    `[live security](VERSION_BASE/blob/main/SECURITY.md)`,
    `[live contribution](VERSION_BASE/blob/main/CONTRIBUTING.md)`,
    `[workflow](VERSION_BASE/actions/workflows/npm-release.yml)`,
    '[external](https://github.com/another/project/blob/main/docs/guide.md)',
  ].join('\n').replaceAll('VERSION_BASE', base).replaceAll('VERSION_SHA', snapshot));
  const errors = inspectDocumentation(root, ['README.md']);
  assert.equal(errors.length, 6);
  for (const [index, error] of errors.entries()) {
    assert.match(error, new RegExp(`README.md:${index + 1}: .*full commit`));
  }
});

test('documentation links cannot follow directory aliases into private or external roots', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-doc-alias-'));
  const outside = mkdtempSync(join(tmpdir(), 'skillfit-doc-outside-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs'));
  mkdirSync(join(root, 'workspace4skills'));
  writeFileSync(join(root, 'workspace4skills/private.md'), '# Private\n');
  writeFileSync(join(outside, 'outside.md'), '# Outside\n');
  symlinkSync(join(root, 'workspace4skills'), join(root, 'docs/private-alias'), 'junction');
  symlinkSync(outside, join(root, 'docs/outside-alias'), 'junction');
  writeFileSync(join(root, 'README.md'), '[private](docs/private-alias/private.md#private)\n[external](docs/outside-alias/outside.md#outside)\n');
  const errors = inspectDocumentation(root, ['README.md']);
  assert.equal(errors.length, 2);
  assert.ok(errors.every(error => error.includes('public documentation scope')));
  assert.match(inspectDocumentation(root, ['docs/private-alias/private.md'])[0], /source leaves the public documentation scope/);
});

test('current maintained documentation passes the shared registry, link and entry-contract gate offline', () => {
  assert.deepEqual(checkDocumentation().errors, []);
  assert.ok(documentationFiles().includes('docs/README.md'));
  assert.ok(documentationFiles().includes('docs/maintainers/architecture.md'));
});

test('README languages preserve section levels and every command/demo block', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const [english, chinese] = ['README.md', 'README.zh-CN.md'].map(file => readFileSync(join(root, file), 'utf8').replace(/\r\n/g, '\n'));
  const blocks = text => [...text.matchAll(/```[^\n]*\n[\s\S]*?```/g)].map(match => match[0]);
  const levels = text => [...text.matchAll(/^(#{2,6}) /gm)].map(match => match[1].length);
  assert.deepEqual(blocks(chinese), blocks(english));
  assert.deepEqual(levels(chinese), levels(english));
  assert.ok(blocks(english).length >= 15, 'retain the existing runnable examples and captured demo');
  for (const text of [english, chinese]) assert.match(text, /\(docs\/README\.md\)/);
});

test('the shared gate checks active plans by default and historical bodies only when explicitly changed', t => {
  const f = governedFixture(t);
  assert.deepEqual(checkDocumentation(f.root).errors, []);
  f.put('docs/work/current.md', '# Current\n[Broken](missing.md)\n');
  assert.match(checkDocumentation(f.root).errors.join('\n'), /current.md.*missing target/);
  f.put('docs/work/current.md', '# Current\n');
  assert.match(checkDocumentation(f.root, { changes: [{ path: 'docs/maintainers/history.md', status: 'M' }] }).errors.join('\n'), /history.md.*missing target/);
});

test('standalone gating rejects bilingual structure, command and badge drift and stale released commands', t => {
  const f = governedFixture(t), english = readFileSync(join(f.root, 'README.md'), 'utf8');
  for (const [extra, diagnostic] of [['\n## Extra\n', /README.*section/], ['\n```bash\nnode changed.js\n```\n', /README.*command\/demo/], ['\n![badge](https://img.shields.io/example)\n', /README.*badge/]]) {
    f.put('README.zh-CN.md', english + extra);
    assert.match(checkDocumentation(f.root).errors.join('\n'), diagnostic);
  }
  f.put('README.zh-CN.md', english);
  const path = 'skills/skillfit/SKILL.md';
  f.put(path, 'npx skillfit@0.12.0 --help\n');
  assert.match(checkDocumentation(f.root).errors.join('\n'), /Stale package command.*skills\/skillfit/);
});

test('old paths and fragments require retained headings or explicit compatibility aliases', t => {
  const f = governedFixture(t), previousDocuments = new Map([['docs/work/current.md', '# Current\n## Original\n']]);
  f.put('docs/work/current.md', '# Current\n## Renamed\n');
  const failed = checkDocumentation(f.root, { previousDocuments });
  assert.match(failed.errors.join('\n'), /current.md#original.*restore.*alias/);
  assert.equal(failed.anchorMigrations.find(m => m.from.endsWith('#original')).status, 'missing');
  f.put('docs/work/current.md', '# Current\n<a id="original"></a>\n## Renamed\n');
  const passed = checkDocumentation(f.root, { previousDocuments });
  assert.deepEqual(passed.errors, []);
  assert.equal(passed.anchorBaseline, 'compared');
  assert.equal(passed.anchorMigrations.length, 2);
  assert.equal(checkDocumentation(f.root).anchorBaseline, 'not-provided');
  const removed = checkDocumentation(f.root, { previousDocuments: new Map([['docs/removed.md', '# Removed\n'], ['docs/empty.md', 'No heading\n']]) });
  assert.match(removed.errors.join('\n'), /removed.md.*restore.*compatibility/);
  assert.deepEqual(removed.anchorMigrations, [
    { from: 'docs/removed.md#removed', to: null, status: 'missing' },
    { from: 'docs/empty.md', to: null, status: 'missing' },
  ]);
});

test('cumulative main integration preserves publication-era paths and index headings offline', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const result = checkDocumentation(root, {
    baseline: '3a3ff415ccef1a3a45d1e2d2cc00d903ab7db850',
    changes: [
      { path: 'docs/architecture.md', status: 'D' },
      { path: 'evidence/README.md', status: 'D' },
    ],
    // Recorded public names, not Git lookups: shallow checkouts need no old objects.
    previousDocuments: new Map([
      ['docs/README.md', '# skillfit documentation\n## Start here\n'],
      ['benches/README.md', '# skillfit benches\n## What the harness records\n'],
      ['docs/architecture.md', '# Architecture\n'],
      ['evidence/README.md', '# Evidence\n'],
    ]),
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.anchorMigrations.length >= 6);
  assert.ok(result.anchorMigrations.every(row => row.status !== 'missing'));
});

test('source changes identify affected authority, dependents and fixed checks without requiring a cosmetic doc edit', t => {
  const f = governedFixture(t), policy = JSON.parse(readFileSync(join(f.root, 'tools/verify/documentation-policy.json'), 'utf8'));
  f.put('src/engine.ts', 'export const version = 1;');
  policy.documents.find(d => d.path === 'docs/work/current.md').topics = ['planning'];
  policy.documents.find(d => d.path === 'README.md').topics = ['planning'];
  policy.topics.planning = { canonical: 'docs/work/current.md#current', sources: ['src/engine.ts'], schemas: [], dependents: ['README.md'], checks: ['docs-links'] };
  f.put('tools/verify/documentation-policy.json', JSON.stringify(policy));
  const result = checkDocumentation(f.root, { changes: [{ path: 'src/engine.ts', status: 'M' }, { path: 'src/new.ts', status: 'A' }] });
  assert.deepEqual(result.errors, []);
  assert.equal(result.impacts[0].topic, 'planning');
  assert.equal(result.impacts[0].canonical, 'docs/work/current.md#current');
  assert.equal(result.impacts[0].owner, 'development');
  assert.deepEqual(result.impacts[0].dependents, ['README.md']);
  assert.deepEqual(result.impacts[0].changed, ['src/engine.ts']);
  assert.ok(result.impacts[0].checks.some(c => c.id === 'docs-links' && c.files.includes('tools/verify/check-docs.test.mjs')));
  assert.equal(result.impacts[0].status, 'review-required');
  assert.deepEqual(result.unmappedChanges, ['src/new.ts']);
});

test('Git baseline loading requests only public non-excluded Markdown and fails on unavailable requested evidence', t => {
  const f = governedFixture(t), base = 'a'.repeat(40), requested = [];
  const changes = [{ path: 'docs/work/current.md', status: 'M' }, { path: 'src/engine.ts', status: 'M' }, { path: 'workspace4skills/private.md', status: 'M' }];
  const git = args => { requested.push(args.join(' ')); return args[0] === 'show' ? '# Current\n' : base; };
  const result = readDocumentationBaseline(f.root, base, changes, git);
  assert.deepEqual([...result.previousDocuments], [['docs/work/current.md', '# Current\n']]);
  assert.ok(requested.every(command => !command.includes('workspace4skills') && !command.includes('src/engine')));
  assert.throws(() => readDocumentationBaseline(f.root, base, changes, () => { throw Error('missing baseline'); }), /baseline/);
  assert.throws(() => readDocumentationBaseline(f.root, 'HEAD', changes, git), /exact.*SHA/);
});

test('the standalone command emits one structured gate result through a directory alias', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-docs-command-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  symlinkSync(fileURLToPath(new URL('../..', import.meta.url)), join(root, 'repo'), 'junction');
  const run = spawnSync(process.execPath, [join(root, 'repo/tools/verify/check-docs.mjs'), '--json'], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.kind, 'skillfit.documentation-check');
  assert.deepEqual(result.errors, []);
  assert.ok(result.files.includes('docs/work/current.md'));
  assert.equal(result.anchorBaseline, 'not-provided');
});


test('bench catalog covers actual contrib manifests and rejects missing or invented entries', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-bench-catalog-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'benches/contrib/real-case'), { recursive: true });
  writeFileSync(join(root, 'benches/README.md'), '[Cases](contrib/README.md)\n');
  writeFileSync(join(root, 'benches/contrib/real-case/bench.json'), '{}');
  writeFileSync(join(root, 'benches/contrib/real-case/README.md'), '# Case\n');
  const index = join(root, 'benches/contrib/README.md');
  writeFileSync(index, '# Cases\n');
  assert.match(inspectBenchCatalog(root).join('\n'), /missing.*real-case/i);
  writeFileSync(index, '[Real](real-case/README.md)\n[Invented](gone/README.md)\n');
  assert.match(inspectBenchCatalog(root).join('\n'), /unknown.*gone/i);
  writeFileSync(index, '[Real](real-case/README.md)\n');
  assert.deepEqual(inspectBenchCatalog(root), []);
  writeFileSync(index, '[Real](real-case/README.md)\n[Duplicate](real-case/README.md)\n');
  assert.match(inspectBenchCatalog(root).join('\n'), /duplicate.*real-case/i);
});

test('rewritten sections can point to their exact fixed source snapshot', t => {
  const f = governedFixture(t), baseline = 'a'.repeat(40), path = 'docs/work/current.md';
  f.put(path, `# Current\n## New\n[Previous source](https://github.com/remote-controlled-man/skillfit/blob/${baseline}/${path}).\n`);
  const result = checkDocumentation(f.root, { baseline, previousDocuments: new Map([[path, '# Current\n## Original\n']]) });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.anchorMigrations.find(row => row.from.endsWith('#original')), {
    from: path + '#original', to: `https://github.com/remote-controlled-man/skillfit/blob/${baseline}/${path}#original`, status: 'archived',
  });
});

test('deleted pages require an exact archived tree and migrated live links', t => {
  const f = governedFixture(t), baseline = 'b'.repeat(40), path = 'docs/maintainers/history.md';
  const policyFile = join(f.root, 'tools/verify/documentation-policy.json');
  const policy = JSON.parse(readFileSync(policyFile, 'utf8')); policy.documents = policy.documents.filter(row => row.path !== path);
  writeFileSync(policyFile, JSON.stringify(policy)); rmSync(join(f.root, path));
  const options = { baseline, changes: [{ path, status: 'D' }], previousDocuments: new Map([[path, '# History\n']]) };
  assert.match(checkDocumentation(f.root, options).errors.join('\n'), /old path removed/);
  const archive = join(f.root, 'docs/README.md');
  writeFileSync(archive, readFileSync(archive, 'utf8') + `\n[History](https://github.com/remote-controlled-man/skillfit/tree/${baseline}/docs).\n`);
  const passed = checkDocumentation(f.root, options); assert.deepEqual(passed.errors, []);
  assert.equal(passed.anchorMigrations[0].status, 'archived');
  f.put('docs/work/current.md', '# Current\n[Broken](history.md)\n');
  assert.ok(checkDocumentation(f.root, options).errors.some(error => error.includes('history.md')));
});


test('repository admission rejects flat pages, extra plans, executable docs and unpacked evidence', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-layout-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const file of ['docs/extra.md', 'docs/work/old.md', 'docs/guides/run.mjs', 'evidence/study/receipt.json']) {
    mkdirSync(join(root, file, '..'), { recursive: true }); writeFileSync(join(root, file), 'generated');
  }
  const errors = inspectRepositoryLayout(root);
  assert.equal(errors.length, 4);
  for (const fragment of ['flat', 'sole current plan', 'executable', 'retired evidence tree']) assert.ok(errors.some(error => error.includes(fragment)), fragment);
});

test('admission accepts owned topics and schema inputs without following aliases', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-layout-valid-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const file of ['docs/README.md', 'docs/work/current.md', 'docs/guides/task.md', 'docs/schemas/example.json']) {
    mkdirSync(join(root, file, '..'), { recursive: true }); writeFileSync(join(root, file), 'owned');
  }
  assert.deepEqual(inspectRepositoryLayout(root), []);
  mkdirSync(join(root, 'evidence'));
  symlinkSync(join(root, 'docs'), join(root, 'evidence/alias'), 'dir');
  assert.ok(inspectRepositoryLayout(root).some(error => /alias/.test(error)));
});
