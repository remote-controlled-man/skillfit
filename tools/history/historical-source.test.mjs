import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readHistoricalFiles } from './historical-source.mjs';

test('frozen bytes remain readable offline after the working tree removes them', t => {
  const root = mkdtempSync(join(tmpdir(), 'skillfit-history-object-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  git(['init', '-q']); mkdirSync(join(root, 'evidence/artifacts/saved'), { recursive: true });
  const files = new Map([['evidence/artifacts/saved/records.tar.gz', Buffer.from('frozen archive')], ['evidence/README.md', Buffer.from('original index')]]);
  for (const [path, bytes] of files) writeFileSync(join(root, path), bytes);
  git(['add', 'evidence']); git(['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=' + join(root, 'no-hooks'), '-c', 'user.name=Offline fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'frozen']);
  const commit = git(['rev-parse', 'HEAD']).trim();
  const row = ([path, bytes]) => ({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  const catalog = { version: 1, source: { repository: 'remote-controlled-man/skillfit', commit }, archives: [{ id: 'saved', ...row([...files][0]) }], supportFiles: [row([...files][1])] };
  rmSync(join(root, 'evidence'), { recursive: true });
  assert.deepEqual(readHistoricalFiles(root, catalog), files);
  const corrupt = structuredClone(catalog); corrupt.supportFiles[0].sha256 = '0'.repeat(64);
  assert.throws(() => readHistoricalFiles(root, corrupt), /Integrity mismatch/);
  assert.throws(() => readHistoricalFiles(root, { ...catalog, source: { ...catalog.source, commit: 'a'.repeat(40) } }), /Pinned|unavailable|missing/);
});
