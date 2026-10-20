import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCatalog } from '../evidence/fetch-archives.mjs';

export async function checkArchiveSources(root = fileURLToPath(new URL('..', import.meta.url))) {
  const catalog = await readCatalog(root);
  const policy = JSON.parse(await fs.readFile(path.join(root, 'scripts/package-policy.json'), 'utf8'));
  assert.deepEqual(catalog.archives.map(row => row.path).sort(), [...(policy.externalArchives ?? policy.archives)].sort());
  for (const row of [...catalog.archives, ...catalog.supportFiles]) {
    const file = path.join(root, row.path), stat = await fs.lstat(file);
    assert.ok(stat.isFile(), `Expected regular public source file: ${row.path}`);
    assert.equal(stat.size, row.bytes, row.path);
    assert.equal(createHash('sha256').update(await fs.readFile(file)).digest('hex'), row.sha256, row.path);
  }
  return { archives: catalog.archives.length, supportFiles: catalog.supportFiles.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkArchiveSources().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
}
