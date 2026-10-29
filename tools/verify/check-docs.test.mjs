import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { checkDocumentation, inspectRepositoryLayout, documentationFiles, inspectDocumentation, inspectBenchCatalog, markdownAnchors, markdownLinks } from './check-docs.mjs';
import { RELEASE_DOCUMENTS } from './recipes/release-docs-smoke.mjs';

function documentedFixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-docs-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, text) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), text); };
  for (const path of RELEASE_DOCUMENTS) put(path, `# Entry\nRun npx skillfit@0.13.1.\n${path.startsWith('README') ? '[Changelog](CHANGELOG.md)' : ''}\n`);
  put('CHANGELOG.md', '# Changelog\n');
  put('docs/maintainers/releases.md', '# Release\n');
  put('package.json', '{"name":"skillfit","version":"0.13.1"}');
  put('docs/work/current.md', '# Current\n');
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

test('discovery treats bench task inputs as data and refuses directory aliases', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-doc-discovery-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, text) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), text); };
  put('benches/contrib/example/README.md', '# Case\n');
  for (const kind of ['tasks', 'prompts', 'fixtures', 'ground-truth']) put(`benches/contrib/example/${kind}/case.md`, '# Frozen input\n');
  put('benches/debugging/ground-truth/answer.md', '# Answer\n');
  put('benches/_self-test/target/SKILL.md', '# Synthetic target\n');
  put('benches/_self-test/example/prompts/control.md', '# Control\n');
  put('docs/guides/task.md', '# Guide\n');
  assert.deepEqual(documentationFiles(root), ['benches/contrib/example/README.md', 'docs/guides/task.md']);
  mkdirSync(join(root, 'private'), { recursive: true });
  put('private/secret.md', '# Secret\n');
  symlinkSync(join(root, 'private'), join(root, 'docs/alias'), 'junction');
  assert.throws(() => documentationFiles(root), /docs\/alias: alias is not admitted/);
});

test('current maintained documentation passes the link, layout, catalog and parity gate offline', () => {
  const result = checkDocumentation();
  assert.deepEqual(result.errors, []);
  assert.equal(result.kind, 'skillfit.documentation-check');
  assert.ok(result.files.includes('docs/README.md'));
  assert.ok(result.files.includes('docs/maintainers/architecture.md'));
  assert.ok(result.files.includes('docs/work/current.md'));
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

test('standalone gating rejects bilingual structure, command and badge drift and stale released commands', t => {
  const f = documentedFixture(t), english = readFileSync(join(f.root, 'README.md'), 'utf8');
  assert.deepEqual(checkDocumentation(f.root).errors, []);
  for (const [extra, diagnostic] of [['\n## Extra\n', /README.*section/], ['\n```bash\nnode changed.js\n```\n', /README.*command\/demo/], ['\n![badge](https://img.shields.io/example)\n', /README.*badge/]]) {
    f.put('README.zh-CN.md', english + extra);
    assert.match(checkDocumentation(f.root).errors.join('\n'), diagnostic);
  }
  f.put('README.zh-CN.md', english);
  f.put('skills/skillfit/SKILL.md', 'npx skillfit@0.12.0 --help\n');
  assert.match(checkDocumentation(f.root).errors.join('\n'), /Stale package command.*skills\/skillfit/);
});

test('a broken link in a discovered page fails the gate with its path and line', t => {
  const f = documentedFixture(t);
  f.put('docs/work/current.md', '# Current\n[Broken](missing.md)\n');
  assert.match(checkDocumentation(f.root).errors.join('\n'), /docs\/work\/current\.md:2: missing target: missing\.md/);
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
  assert.deepEqual(Object.keys(result).sort(), ['errors', 'files', 'kind', 'schemaVersion']);
  assert.equal(spawnSync(process.execPath, [join(root, 'repo/tools/verify/check-docs.mjs'), '--base', 'x'], { encoding: 'utf8' }).status, 2);
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
  writeFileSync(index, '[Real](real-case/README.md)\n[Dup](real-case/README.md)\n');
  assert.match(inspectBenchCatalog(root).join('\n'), /duplicate.*real-case/i);
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
