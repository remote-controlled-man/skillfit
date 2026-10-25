import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { validateCatalog } from '../../evidence/fetch-archives.mjs';

/** Development/release verification only. Reads pinned Git objects; never fetches. */
export function readHistoricalFiles(root, catalog) {
  validateCatalog(catalog);
  const rows = [...catalog.archives, ...catalog.supportFiles];
  assert.ok(rows.every(row => !/[\0\r\n]/.test(row.path)), 'Unsafe historical path');
  let buffer;
  try {
    buffer = execFileSync('git', ['cat-file', '--batch'], { cwd: root,
      input: rows.map(row => `${catalog.source.commit}:${row.path}\n`).join(''), maxBuffer: 64 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (error) { throw new Error(`Pinned historical source ${catalog.source.commit} is unavailable locally; fetch that exact commit explicitly.`, { cause: error }); }
  let offset = 0;
  const files = new Map();
  for (const row of rows) {
    const end = buffer.indexOf(10, offset), header = buffer.subarray(offset, end).toString();
    const match = /^[a-f0-9]{40,64} blob (\d+)$/.exec(header);
    assert.ok(match, `Pinned historical source unavailable: ${row.path}`);
    const size = Number(match[1]), bytes = buffer.subarray(end + 1, end + 1 + size);
    assert.ok(size === row.bytes && bytes.length === size && buffer[end + 1 + size] === 10 &&
      createHash('sha256').update(bytes).digest('hex') === row.sha256, `Integrity mismatch: ${row.path}`);
    files.set(row.path, Buffer.from(bytes)); offset = end + size + 2;
  }
  assert.equal(offset, buffer.length, 'Unexpected historical object output');
  return files;
}

export function materializeHistoricalSource(root) {
  const catalog = JSON.parse(readFileSync(join(root, 'evidence/archive-catalog.v1.json'), 'utf8'));
  const files = readHistoricalFiles(root, catalog), directory = mkdtempSync(join(tmpdir(), 'skillfit-history-source-'));
  try {
    for (const [path, bytes] of files) { const target = join(directory, path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes, { flag: 'wx' }); }
    return { directory, dispose: () => rmSync(directory, { recursive: true, force: true }) };
  } catch (error) { rmSync(directory, { recursive: true, force: true }); throw error; }
}
