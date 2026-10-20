import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Supplement the versioned feature recipe. Source archives are explicit local
// inputs; installed code/support files must work without a source checkout.
assert.equal(process.argv.length, 5, 'Provide installed package, local archive root and fresh output parent.');
const installed = await fs.realpath(process.argv[2]), source = await fs.realpath(process.argv[3]);
const requested = path.resolve(process.argv[4]);
const parent = path.join(await fs.realpath(path.dirname(requested)), path.basename(requested));
for (const input of [installed, source]) {
  assert.ok(!parent.startsWith(input + path.sep) && parent !== input, 'Keep outputs outside the installed package and archive source.');
}
await fs.mkdir(parent); // Exclusive: previous receipts are never overwritten.
const { readCatalog, restoreArchives } = await import(pathToFileURL(path.join(installed, 'evidence/fetch-archives.mjs')));
const catalog = await readCatalog(installed), output = path.join(parent, 'restored');
for (const row of catalog.archives) await assert.rejects(fs.lstat(path.join(installed, row.path)), { code: 'ENOENT' });
let networkAttempts = 0;
const fetchImpl = () => { networkAttempts++; throw new Error('Network forbidden in installed archive smoke'); };
assert.equal((await restoreArchives({ all: true, output, fetchImpl, log: () => {} })).status, 'planned');
await assert.rejects(fs.lstat(output), { code: 'ENOENT' });
await restoreArchives({ all: true, output, from: source, offline: true, yes: true, fetchImpl, log: () => {} });
for (const row of [...catalog.archives, ...catalog.supportFiles]) {
  const bytes = await fs.readFile(path.join(output, row.path));
  assert.equal(bytes.length, row.bytes, row.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256, row.path);
}
await assert.rejects(restoreArchives({ all: true, output, from: source, offline: true, yes: true, fetchImpl, log: () => {} }), /already exists/);
assert.equal(networkAttempts, 0);
const receipt = { kind: 'skillfit.archive-delivery-smoke', version: JSON.parse(await fs.readFile(path.join(installed, 'package.json'), 'utf8')).version,
  nodeVersion: process.version, sourceCommit: catalog.source.commit, archivesRestored: catalog.archives.length,
  supportFilesRestored: catalog.supportFiles.length, inlineSupportFiles: catalog.supportFiles.filter(row => row.inlineBase64 !== undefined).length,
  previewWrites: 0, networkAttempts, modelCalls: 0, collisionPreserved: true };
await fs.writeFile(path.join(parent, 'archive-delivery-smoke.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(receipt));
