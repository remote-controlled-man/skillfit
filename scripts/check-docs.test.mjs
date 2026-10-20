import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { documentationFiles, inspectDocumentation, markdownAnchors, markdownLinks } from './check-docs.mjs';

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

test('active documentation links and anchors resolve offline', () => {
  assert.deepEqual(inspectDocumentation(), []);
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
