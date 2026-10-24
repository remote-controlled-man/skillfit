import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { checkDocumentation, documentationFiles, inspectDocumentation, inspectBenchCatalog, markdownAnchors, markdownLinks, readDocumentationBaseline } from './check-docs.mjs';
import { RELEASE_DOCUMENTS } from '../docs/releases/release-docs-smoke.mjs';

function governedFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-governed-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, text) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), text); };
  for (const path of RELEASE_DOCUMENTS) put(path, `# Entry\nRun npx skillfit@0.13.1.\n${path.startsWith('README') ? '[Release](docs/releases/0.13.1.md)' : ''}\n`);
  put('docs/releases/0.13.1.md', '# Release\n');
  put('package.json', '{"name":"skillfit","version":"0.13.1"}');
  put('docs/plans/current.md', '# Current\n');
  put('docs/plans/history.md', '# History\n[Historical broken link](missing.md)\n');
  const policy = { schemaVersion: 1, documents: [...RELEASE_DOCUMENTS, 'docs/releases/0.13.1.md', 'docs/plans/current.md', 'docs/plans/history.md'].map(path => ({
    path, kind: 'record', lifecycle: path.endsWith('history.md') ? 'historical' : path.includes('/releases/') ? 'frozen' : 'maintained',
    audience: ['maintainer'], owner: 'development', scope: [{ kind: 'source', ref: 'working-tree' }], topics: [], checks: ['docs-links'],
  })), topics: {}, exclusions: [] };
  put('scripts/documentation-policy.json', JSON.stringify(policy));
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
  assert.ok(documentationFiles().includes('docs/architecture.md'));
});

test('README languages preserve section levels and every command/demo block', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
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
  f.put('docs/plans/current.md', '# Current\n[Broken](missing.md)\n');
  assert.match(checkDocumentation(f.root).errors.join('\n'), /current.md.*missing target/);
  f.put('docs/plans/current.md', '# Current\n');
  assert.match(checkDocumentation(f.root, { changes: [{ path: 'docs/plans/history.md', status: 'M' }] }).errors.join('\n'), /history.md.*missing target/);
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
  const f = governedFixture(t), previousDocuments = new Map([['docs/plans/current.md', '# Current\n## Original\n']]);
  f.put('docs/plans/current.md', '# Current\n## Renamed\n');
  const failed = checkDocumentation(f.root, { previousDocuments });
  assert.match(failed.errors.join('\n'), /current.md#original.*restore.*alias/);
  assert.equal(failed.anchorMigrations.find(m => m.from.endsWith('#original')).status, 'missing');
  f.put('docs/plans/current.md', '# Current\n<a id="original"></a>\n## Renamed\n');
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

test('source changes identify affected authority, dependents and fixed checks without requiring a cosmetic doc edit', t => {
  const f = governedFixture(t), policy = JSON.parse(readFileSync(join(f.root, 'scripts/documentation-policy.json'), 'utf8'));
  f.put('src/engine.ts', 'export const version = 1;');
  policy.documents.find(d => d.path === 'docs/plans/current.md').topics = ['planning'];
  policy.documents.find(d => d.path === 'README.md').topics = ['planning'];
  policy.topics.planning = { canonical: 'docs/plans/current.md#current', sources: ['src/engine.ts'], schemas: [], dependents: ['README.md'], checks: ['docs-links'] };
  f.put('scripts/documentation-policy.json', JSON.stringify(policy));
  const result = checkDocumentation(f.root, { changes: [{ path: 'src/engine.ts', status: 'M' }, { path: 'src/new.ts', status: 'A' }] });
  assert.deepEqual(result.errors, []);
  assert.equal(result.impacts[0].topic, 'planning');
  assert.equal(result.impacts[0].canonical, 'docs/plans/current.md#current');
  assert.equal(result.impacts[0].owner, 'development');
  assert.deepEqual(result.impacts[0].dependents, ['README.md']);
  assert.deepEqual(result.impacts[0].changed, ['src/engine.ts']);
  assert.ok(result.impacts[0].checks.some(c => c.id === 'docs-links' && c.files.includes('scripts/check-docs.test.mjs')));
  assert.equal(result.impacts[0].status, 'review-required');
  assert.deepEqual(result.unmappedChanges, ['src/new.ts']);
});

test('Git baseline loading requests only public non-excluded Markdown and fails on unavailable requested evidence', t => {
  const f = governedFixture(t), base = 'a'.repeat(40), requested = [];
  const changes = [{ path: 'docs/plans/current.md', status: 'M' }, { path: 'src/engine.ts', status: 'M' }, { path: 'workspace4skills/private.md', status: 'M' }];
  const git = args => { requested.push(args.join(' ')); return args[0] === 'show' ? '# Current\n' : base; };
  const result = readDocumentationBaseline(f.root, base, changes, git);
  assert.deepEqual([...result.previousDocuments], [['docs/plans/current.md', '# Current\n']]);
  assert.ok(requested.every(command => !command.includes('workspace4skills') && !command.includes('src/engine')));
  assert.throws(() => readDocumentationBaseline(f.root, base, changes, () => { throw Error('missing baseline'); }), /baseline/);
  assert.throws(() => readDocumentationBaseline(f.root, 'HEAD', changes, git), /exact.*SHA/);
});

test('the standalone command emits one structured gate result through a directory alias', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-docs-command-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  symlinkSync(fileURLToPath(new URL('..', import.meta.url)), join(root, 'repo'), 'junction');
  const run = spawnSync(process.execPath, [join(root, 'repo/scripts/check-docs.mjs'), '--json'], { encoding: 'utf8', timeout: 30_000 });
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.kind, 'skillfit.documentation-check');
  assert.deepEqual(result.errors, []);
  assert.ok(result.files.includes('docs/plans/2026-10-22-documentation-governance-and-architecture.md'));
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
