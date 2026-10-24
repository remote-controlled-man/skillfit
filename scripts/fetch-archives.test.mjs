import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { archiveUrl, restoreArchives, validateCatalog } from '../evidence/fetch-archives.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'skillfit-archive-test-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const packageRoot = path.join(root, 'package'), from = path.join(root, 'source'), output = path.join(root, 'restored');
  const bytes = Buffer.from('saved archive bytes'), support = Buffer.from('frozen offline instructions');
  const archive = { id: 'saved-records', path: 'evidence/artifacts/saved/records.tar.gz', bytes: bytes.length, sha256: sha(bytes) };
  const file = { path: 'evidence/artifacts/saved/README.md', bytes: support.length, sha256: sha(support) };
  const catalog = { version: 1, source: { repository: 'remote-controlled-man/skillfit', commit: 'a'.repeat(40) }, archives: [archive], supportFiles: [file] };
  for (const [base, row, content] of [[packageRoot, file, support], [from, archive, bytes]]) {
    await fs.mkdir(path.dirname(path.join(base, row.path)), { recursive: true });
    await fs.writeFile(path.join(base, row.path), content);
  }
  const opts = { packageRoot, from, output, catalog, all: true, log: () => {}, fetchImpl: () => { throw new Error('network forbidden'); } };
  return { root, packageRoot, from, output, bytes, support, archive, file, catalog, opts };
}
async function noOutputOrStage(f) {
  await assert.rejects(fs.lstat(f.output), { code: 'ENOENT' });
  assert.ok(!(await fs.readdir(f.root)).some(name => name.startsWith('.skillfit-archives-')));
}

test('catalog rejects unsafe, duplicate, malformed and unsupported entries', async t => {
  const f = await fixture(t);
  assert.equal(validateCatalog(f.catalog), f.catalog);
  for (const change of [
    c => c.version = 2, c => c.source.commit = 'main', c => c.source.repository = 'other/repo',
    c => c.archives[0].path = 'evidence/../secret.tar.gz', c => c.archives[0].path = 'evidence\\secret.tar.gz',
    c => c.archives[0].sha256 = 'broken', c => c.archives[0].bytes = 17 * 1024 * 1024,
    c => c.archives.push(c.archives[0]), c => c.supportFiles.push(c.archives[0]),
  ]) { const catalog = structuredClone(f.catalog); change(catalog); assert.throws(() => validateCatalog(catalog)); }
});

test('list and preview make no network calls or filesystem writes', async t => {
  const f = await fixture(t), before = await fs.readdir(f.root);
  assert.equal((await restoreArchives({ ...f.opts, from: undefined, all: false, output: undefined, list: true })).status, 'listed');
  assert.equal((await restoreArchives({ ...f.opts, from: undefined })).status, 'planned');
  assert.deepEqual(await fs.readdir(f.root), before);
  await noOutputOrStage(f);
});

test('offline restore copies exact archives and frozen support at original paths', async t => {
  const f = await fixture(t);
  assert.equal((await restoreArchives({ ...f.opts, offline: true, yes: true, all: false, ids: ['saved-records'] })).status, 'restored');
  assert.deepEqual(await fs.readFile(path.join(f.output, f.archive.path)), f.bytes);
  assert.deepEqual(await fs.readFile(path.join(f.output, f.file.path)), f.support);
  assert.ok(!(await fs.readdir(f.root)).some(name => name.startsWith('.skillfit-archives-')));
});

test('remote restore uses the fixed HTTPS source, redirect refusal and deadline', async t => {
  const f = await fixture(t); let calls = 0;
  await restoreArchives({ ...f.opts, from: undefined, yes: true, fetchImpl: async (url, init) => {
    calls++; assert.equal(url, archiveUrl(f.catalog, f.archive));
    assert.match(url, /https:\/\/raw\.githubusercontent\.com\/remote-controlled-man\/skillfit\/a{40}\//);
    assert.equal(init.redirect, 'error'); assert.ok(init.signal instanceof AbortSignal);
    return new Response(f.bytes);
  } });
  assert.equal(calls, 1);
  assert.deepEqual(await fs.readFile(path.join(f.output, f.archive.path)), f.bytes);
});

for (const [name, transport, error] of [
  ['HTTP failure', async () => new Response('missing', { status: 404 }), /HTTP 404/],
  ['wrong digest', async f => new Response(Buffer.alloc(f.bytes.length)), /Integrity mismatch/],
  ['oversized stream', async f => new Response(Buffer.alloc(f.bytes.length + 1)), /exceeds catalog size/],
  ['wrong length header', async f => new Response(f.bytes, { headers: { 'content-length': '1' } }), /Integrity mismatch/],
  ['truncated response', async f => new Response(f.bytes.subarray(1)), /Integrity mismatch/],
  ['network failure', async () => { throw new Error('connection failed'); }, /connection failed/],
]) test(`${name} leaves no output or staging directory`, async t => {
  const f = await fixture(t);
  await assert.rejects(restoreArchives({ ...f.opts, from: undefined, yes: true, fetchImpl: () => transport(f) }), error);
  await noOutputOrStage(f);
});

test('download deadline aborts without publishing', async t => {
  const f = await fixture(t);
  await assert.rejects(restoreArchives({ ...f.opts, from: undefined, yes: true, timeoutMs: 5,
    fetchImpl: async (_url, { signal }) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('deadline was ignored')), 1000);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('deadline aborted')); }, { once: true });
    }) }), /deadline aborted/);
  await noOutputOrStage(f);
});

test('local missing/corrupt archives and corrupt support never fall back to the network', async t => {
  for (const failure of ['missing', 'archive', 'support']) await t.test(failure, async t => {
    const f = await fixture(t);
    const target = failure === 'support' ? path.join(f.packageRoot, f.file.path) : path.join(f.from, f.archive.path);
    if (failure === 'missing') await fs.unlink(target); else await fs.writeFile(target, 'bad');
    await assert.rejects(restoreArchives({ ...f.opts, yes: true, offline: true }), /ENOENT|Integrity mismatch/);
    await noOutputOrStage(f);
  });
});

test('existing destinations, including empty directories, are preserved', async t => {
  const f = await fixture(t); await fs.mkdir(f.output);
  await assert.rejects(restoreArchives({ ...f.opts, yes: true }), /already exists/);
  await fs.writeFile(path.join(f.output, 'keep'), 'owned');
  await assert.rejects(restoreArchives({ ...f.opts, yes: true }), /already exists/);
  assert.equal(await fs.readFile(path.join(f.output, 'keep'), 'utf8'), 'owned');
});

test('a destination created during download survives the commit collision', async t => {
  const f = await fixture(t);
  await assert.rejects(restoreArchives({ ...f.opts, from: undefined, yes: true, fetchImpl: async () => {
    await fs.mkdir(f.output); await fs.writeFile(path.join(f.output, 'keep'), 'concurrent');
    return new Response(f.bytes);
  } }), /EEXIST/);
  assert.deepEqual(await fs.readdir(f.output), ['keep']);
  assert.equal(await fs.readFile(path.join(f.output, 'keep'), 'utf8'), 'concurrent');
  assert.ok(!(await fs.readdir(f.root)).some(name => name.startsWith('.skillfit-archives-')));
});

test('publication failure removes our partial files and fresh destination', async t => {
  const f = await fixture(t), copy = fs.copyFile.bind(fs);
  t.mock.method(fs, 'copyFile', async (source, target, flags) => {
    if (target === path.join(f.output, f.archive.path)) throw new Error('publish denied');
    return copy(source, target, flags);
  });
  await assert.rejects(restoreArchives({ ...f.opts, yes: true }), /publish denied/);
  await noOutputOrStage(f);
});

test('invalid selections and output inside either source are rejected without writes', async t => {
  const f = await fixture(t);
  for (const extra of [{ all: false }, { ids: ['saved-records'] }, { all: false, ids: ['unknown'] },
    { all: false, ids: ['saved-records', 'saved-records'] }, { offline: true, from: undefined },
    { output: path.join(f.packageRoot, 'output') }, { output: path.join(f.from, 'output') }]) {
    await assert.rejects(restoreArchives({ ...f.opts, ...extra }));
  }
  await noOutputOrStage(f);
});

test('symlinked local sources cannot escape the selected archive root', async t => {
  const f = await fixture(t), dir = path.join(f.from, 'evidence/artifacts');
  await fs.rm(dir, { recursive: true });
  const outside = path.join(f.root, 'outside');
  await fs.mkdir(path.join(outside, 'saved'), { recursive: true });
  await fs.writeFile(path.join(outside, 'saved/records.tar.gz'), f.bytes);
  await fs.symlink(outside, dir, 'junction');
  await assert.rejects(restoreArchives({ ...f.opts, yes: true, offline: true }), /Unsafe source/);
  await noOutputOrStage(f);
});

test('inline public support restores bytes excluded by npm without network access', async t => {
  const f = await fixture(t);
  f.file.inlineBase64 = f.support.toString('base64');
  await fs.unlink(path.join(f.packageRoot, f.file.path));
  await restoreArchives({ ...f.opts, yes: true, offline: true });
  assert.deepEqual(await fs.readFile(path.join(f.output, f.file.path)), f.support);
  const corrupt = structuredClone(f.catalog);
  corrupt.supportFiles[0].inlineBase64 = Buffer.from('wrong').toString('base64');
  assert.throws(() => validateCatalog(corrupt), /Integrity mismatch|Invalid inline/);
});


test('lean packages restore absent frozen support from an explicit offline source', async t => {
  const f = await fixture(t);
  await fs.copyFile(path.join(f.packageRoot, f.file.path), path.join(f.from, f.file.path));
  await fs.unlink(path.join(f.packageRoot, f.file.path));
  await restoreArchives({ ...f.opts, offline: true, yes: true });
  assert.deepEqual(await fs.readFile(path.join(f.output, f.file.path)), f.support);
});

test('lean HTTPS restore reuses verified support content across original paths', async t => {
  const f = await fixture(t); await fs.unlink(path.join(f.packageRoot, f.file.path));
  const duplicate = { ...f.file, path: 'evidence/artifacts/other/README.md' };
  f.catalog.supportFiles.push(duplicate);
  const requests = [];
  await restoreArchives({ ...f.opts, from: undefined, yes: true, fetchImpl: async url => {
    requests.push(url);
    return new Response(url.endsWith('.tar.gz') ? f.bytes : f.support);
  } });
  assert.equal(requests.length, 2, 'one support download and one archive download');
  for (const row of f.catalog.supportFiles) assert.deepEqual(await fs.readFile(path.join(f.output, row.path)), f.support);
});


test('missing or corrupt explicit offline support never falls back to HTTPS', async t => {
  for (const content of [null, 'corrupt']) await t.test(String(content), async t => {
    const f = await fixture(t); await fs.unlink(path.join(f.packageRoot, f.file.path));
    if (content !== null) await fs.writeFile(path.join(f.from, f.file.path), content);
    await assert.rejects(restoreArchives({ ...f.opts, offline: true, yes: true }), /ENOENT|Integrity mismatch/);
    await noOutputOrStage(f);
  });
});

test('installed support directory aliases are rejected without remote fallback', async t => {
  const f = await fixture(t), directory = path.dirname(path.join(f.packageRoot, f.file.path));
  const moved = path.join(f.root, 'moved-support'); await fs.rename(directory, moved); await fs.symlink(moved, directory, 'junction');
  await assert.rejects(restoreArchives({ ...f.opts, from: undefined, yes: true }), /Unsafe source/);
  await noOutputOrStage(f);
});

test('failed concurrent support downloads drain before cleanup and never publish', async t => {
  const f = await fixture(t); await fs.unlink(path.join(f.packageRoot, f.file.path));
  for (let i = 0; i < 12; i++) {
    const bytes = Buffer.from('different support ' + i);
    f.catalog.supportFiles.push({ path: `evidence/artifacts/more/${i}.txt`, bytes: bytes.length, sha256: sha(bytes) });
  }
  let active = 0, peak = 0, calls = 0;
  await assert.rejects(restoreArchives({ ...f.opts, from: undefined, yes: true, fetchImpl: async () => {
    const first = calls++ === 0; peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, first ? 1 : 15)); active--;
    return first ? new Response('missing', { status: 404 }) : new Response('invalid bytes');
  } }), /HTTP 404/);
  assert.equal(active, 0); assert.ok(peak > 1 && peak <= 6); assert.ok(calls <= 6);
  await noOutputOrStage(f);
});

test('HTTP-compressed support verifies decoded bytes rather than encoded content-length', async t => {
  const f = await fixture(t); await fs.unlink(path.join(f.packageRoot, f.file.path));
  await restoreArchives({ ...f.opts, from: undefined, yes: true, fetchImpl: async url => new Response(
    url.endsWith('.tar.gz') ? f.bytes : f.support,
    url.endsWith('.tar.gz') ? {} : { headers: { 'content-encoding': 'gzip', 'content-length': '7' } },
  ) });
  assert.deepEqual(await fs.readFile(path.join(f.output, f.file.path)), f.support);
});
