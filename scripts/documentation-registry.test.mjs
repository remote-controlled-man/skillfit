import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { DOCUMENTATION_CHECKS, MAINTENANCE_ROLES, inspectDocumentationRegistry } from './documentation-registry.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-doc-registry-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  put('docs/guide.md', '# Guide\n');
  put('src/engine.ts', 'export const enabled = true;\n');
  const policy = { schemaVersion: 1, documents: [{ path: 'docs/guide.md', kind: 'reference', lifecycle: 'maintained',
    audience: ['maintainer'], owner: 'development', scope: [{ kind: 'source', ref: 'working-tree' }],
    topics: ['guide'], checks: ['documentation-review'] }], topics: { guide: { canonical: 'docs/guide.md#guide',
    sources: ['src/engine.ts'], schemas: [], dependents: [], checks: ['documentation-review'] } }, exclusions: [] };
  const save = () => put('scripts/documentation-policy.json', JSON.stringify(policy));
  save();
  return { root, put, policy, save };
}

test('registry discovers an untracked guide and requires registration without consulting Git', t => {
  const f = fixture(t);
  assert.deepEqual(inspectDocumentationRegistry(f.root).errors, []);
  assert.deepEqual(inspectDocumentationRegistry(f.root).files, ['docs/guide.md']);
  f.put('docs/new/guide.MD', '# New\n');
  assert.match(inspectDocumentationRegistry(f.root).errors.join('\n'), /docs\/new\/guide.MD.*unregistered.*register/i);
});

test('the production parser accepts the delivered minimal example and rejects its unknown owner', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const read = name => readFileSync(join(root, `docs/examples/documentation-policy.${name}.json`), 'utf8');
  assert.deepEqual(inspectDocumentationRegistry(root, { text: read('valid'), coverage: false }).errors, []);
  assert.match(inspectDocumentationRegistry(root, { text: read('invalid'), coverage: false }).errors.join('\n'), /owner.*unassigned.*unknown.*role/i);
});

test('invalid policy contracts fail with a location and a repair direction', t => {
  const f = fixture(t), original = structuredClone(f.policy);
  const cases = [
    [p => { p.schemaVersion = 2; }, /schemaVersion.*1/],
    [p => { p.extra = true; }, /policy.*unknown.*extra/],
    [p => { p.documents[0].kind = 'misc'; }, /guide.md.*kind.*misc/],
    [p => { p.documents[0].lifecycle = 'old'; }, /guide.md.*lifecycle.*old/],
    [p => { p.documents[0].audience = []; }, /guide.md.*audience.*nonempty/],
    [p => { p.documents[0].scope = [{ kind: 'source' }]; }, /scope.*ref/],
    [p => { p.documents.push(structuredClone(p.documents[0])); }, /duplicate.*docs\/guide.md/],
    [p => { p.documents[0].checks = ['execute arbitrary text']; }, /unknown check.*execute arbitrary text/],
    [p => { p.topics.guide.canonical = ['docs/guide.md', 'docs/guide.md#guide']; }, /guide.*canonical.*one/],
    [p => { p.topics.guide.canonical = 'docs/guide.md#missing'; }, /guide.*missing anchor.*missing/],
    [p => { p.topics.guide.sources = []; }, /guide.*sources.*nonempty/],
    [p => { p.topics.guide.dependents = ['docs/guide.md']; }, /guide.*dependents/],
    [p => { p.documents[0].supersededBy = 'docs/missing.md'; }, /supersededBy.*registered/],
  ];
  for (const [change, expected] of cases) {
    const policy = structuredClone(original); change(policy);
    const result = inspectDocumentationRegistry(f.root, { text: JSON.stringify(policy) });
    assert.match(result.errors.join('\n'), expected);
  }
  const duplicate = JSON.stringify(original).replace('"canonical":', '"canonical":"docs/guide.md#guide","canonical":');
  assert.match(inspectDocumentationRegistry(f.root, { text: duplicate }).errors.join('\n'), /duplicate JSON key.*canonical/);
  assert.match(inspectDocumentationRegistry(f.root, { text: '{' }).errors.join('\n'), /JSON/);
  const shared = structuredClone(original);
  shared.topics.second = structuredClone(shared.topics.guide); shared.documents[0].topics.push('second');
  assert.deepEqual(inspectDocumentationRegistry(f.root, { text: JSON.stringify(shared) }).errors, [], 'distinct topics may share the canonical page/fragment');
});

test('discovery rejects unsafe aliases but never follows ignored private or dependency trees', t => {
  const f = fixture(t), outside = mkdtempSync(join(tmpdir(), 'skillfit-doc-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(join(outside, 'secret.md'), '[do not read](missing.md)');
  symlinkSync(outside, join(f.root, 'workspace4skills'), 'junction');
  symlinkSync(outside, join(f.root, 'node_modules'), 'junction');
  symlinkSync(outside, join(f.root, 'docs/node_modules'), 'junction');
  assert.deepEqual(inspectDocumentationRegistry(f.root).errors, [], 'ignored aliases are never traversed');
  symlinkSync(outside, join(f.root, 'docs/outside'), 'junction');
  assert.match(inspectDocumentationRegistry(f.root).errors.join('\n'), /docs\/outside.*public documentation scope/);
  rmSync(join(f.root, 'docs/outside'));
  f.put('runs/private.md', '# Private\n');
  symlinkSync(join(f.root, 'runs'), join(f.root, 'docs/private'), 'junction');
  assert.match(inspectDocumentationRegistry(f.root).errors.join('\n'), /docs\/private.*public documentation scope/);
});

test('replacement cycles, overlapping exclusions and unsafe source references fail closed', t => {
  const f = fixture(t);
  for (const path of ['../outside', '/tmp/outside', 'workspace4skills/private.md', 'src/../engine.ts', 'src\\engine.ts']) {
    const policy = structuredClone(f.policy); policy.topics.guide.sources = [path];
    assert.ok(inspectDocumentationRegistry(f.root, { text: JSON.stringify(policy) }).errors.length, path);
  }
  f.put('docs/old.md', '# Old\n');
  f.policy.documents.push({ ...structuredClone(f.policy.documents[0]), path: 'docs/old.md', topics: [], supersededBy: 'docs/guide.md' });
  f.policy.documents[0].supersededBy = 'docs/old.md'; f.save();
  assert.match(inspectDocumentationRegistry(f.root).errors.join('\n'), /replacement cycle/);
  delete f.policy.documents[0].supersededBy; f.save();
  assert.deepEqual(inspectDocumentationRegistry(f.root).errors, []);
  f.put('docs/data/a.md', '# Input');
  f.policy.exclusions = ['docs/data/', 'docs/data/a.md'].map(path => ({ path, reason: 'data', owner: 'evidence', verification: 'archive-integrity' })); f.save();
  assert.match(inspectDocumentationRegistry(f.root).errors.join('\n'), /overlapping exclusion/);
});

test('a registered public alias cannot expose a skipped dependency directory', t => {
  const f = fixture(t);
  f.put('docs/node_modules/private.md', '# Private\n');
  symlinkSync(join(f.root, 'docs/node_modules'), join(f.root, 'docs/alias'), 'junction');
  f.policy.documents[0].path = 'docs/alias/private.md';
  f.policy.topics.guide.canonical = 'docs/alias/private.md#private'; f.save();
  assert.match(inspectDocumentationRegistry(f.root).errors.join('\n'), /alias.*public documentation scope/);
});

test('aliases cannot expose excluded frozen inputs or a non-document source root', t => {
  for (const target of ['docs/data', 'evidence/artifacts', 'src']) for (const registered of [false, true]) {
    const f = fixture(t);
    f.put(target + '/README.md', '# Private\n');
    if (target !== 'src') f.policy.exclusions.push({ path: target + '/', reason: 'Frozen input', owner: 'evidence', verification: 'archive-integrity' });
    symlinkSync(join(f.root, target), join(f.root, 'docs/alias'), 'junction');
    if (registered) {
      const alias = { ...structuredClone(f.policy.documents[0]), path: 'docs/alias/README.md' };
      f.policy.documents[0].topics = []; f.policy.documents.push(alias);
      f.policy.topics.guide.canonical = 'docs/alias/README.md#private';
    }
    f.save();
    assert.match(inspectDocumentationRegistry(f.root).errors.join('\n'), /alias.*(?:excluded|public document)/, `${target}, registered=${registered}`);
  }
});

test('the current registry and governance catalogs agree with the static offline check locations', () => {
  const root = fileURLToPath(new URL('..', import.meta.url)), guide = readFileSync(join(root, 'docs/documentation-governance.md'), 'utf8');
  assert.deepEqual(inspectDocumentationRegistry(root).errors, []);
  const checkSection = guide.split('## Check catalog\n')[1].split('\n## ')[0];
  const ids = [...checkSection.matchAll(/^\| `([^`]+)` \| (?:Manual|Automatic) \|/gm)].map(m => m[1]);
  assert.deepEqual(ids.sort(), Object.keys(DOCUMENTATION_CHECKS).sort());
  const roleSection = guide.split('## Maintenance roles\n')[1].split('\n## ')[0];
  assert.deepEqual([...roleSection.matchAll(/^\| `([^`]+)` \|/gm)].map(m => m[1]).sort(), [...MAINTENANCE_ROLES].sort());
  for (const check of Object.values(DOCUMENTATION_CHECKS)) for (const file of check.files) assert.ok(readFileSync(join(root, file)).length, file);
});

test('narrow data exclusions preserve frozen bytes and report manual verification without hiding guides', t => {
  const f = fixture(t);
  f.put('docs/data/input.md', '[frozen](missing.md)');
  f.policy.exclusions.push({ path: 'docs/data/', reason: 'Frozen task input', owner: 'evidence', verification: 'manual: review original input bytes' }); f.save();
  const result = inspectDocumentationRegistry(f.root);
  assert.deepEqual(result.errors, []);
  assert.equal(result.manualExclusions[0].verification, 'manual: review original input bytes');
  assert.equal(readFileSync(join(f.root, 'docs/data/input.md'), 'utf8'), '[frozen](missing.md)');
  f.policy.exclusions[0].path = 'docs/'; f.save();
  assert.match(inspectDocumentationRegistry(f.root).errors.join('\n'), /broad exclusion/);
  f.policy.exclusions[0].path = 'docs/guide.md'; f.save();
  assert.match(inspectDocumentationRegistry(f.root).errors.join('\n'), /registered document.*excluded/);
  mkdirSync(join(f.root, 'docs/empty')); f.policy.exclusions[0].path = 'docs/empty/'; f.save();
  assert.match(inspectDocumentationRegistry(f.root).errors.join('\n'), /unused.*exclusion|empty.*exclusion/);
});
