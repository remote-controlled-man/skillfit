#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { constants, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const CATALOG_PATH = 'evidence/archive-catalog.v1.json';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (root, target) => target === root || target.startsWith(root + path.sep);
const message = error => error instanceof Error ? error.message : String(error);

function safePath(value) {
  return typeof value === 'string' && value.startsWith('evidence/') && !value.includes('\\') &&
    value.split('/').every(part => part && part !== '.' && part !== '..');
}

export function validateCatalog(catalog) {
  if (catalog?.version !== 1 || catalog.source?.repository !== 'remote-controlled-man/skillfit' ||
      !/^[a-f0-9]{40}$/.test(catalog.source?.commit ?? '')) throw new Error('Unsupported archive catalog/source');
  if (!Array.isArray(catalog.archives) || !catalog.archives.length || !Array.isArray(catalog.supportFiles)) {
    throw new Error('Invalid archive catalog inventory');
  }
  const paths = new Set(), ids = new Set();
  for (const [archive, rows] of [[true, catalog.archives], [false, catalog.supportFiles]]) {
    for (const row of rows) {
      if (!safePath(row.path) || paths.has(row.path) || !Number.isSafeInteger(row.bytes) || row.bytes < 0 ||
          row.bytes > 16 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(row.sha256 ?? '')) {
        throw new Error(`Invalid catalog file: ${row.path}`);
      }
      if (archive && (!row.path.startsWith('evidence/artifacts/') || !row.path.endsWith('.tar.gz') ||
          !/^[a-z0-9][a-z0-9-]*$/.test(row.id ?? '') || ids.has(row.id))) throw new Error(`Invalid archive ID/path: ${row.id}`);
      if (!archive && /\.(?:tar\.gz|tgz|zip)$/.test(row.path)) throw new Error(`Archive in support inventory: ${row.path}`);
      if (row.inlineBase64 !== undefined) {
        if (archive || typeof row.inlineBase64 !== 'string' || row.inlineBase64.length > Math.ceil(row.bytes / 3) * 4 ||
            Buffer.from(row.inlineBase64, 'base64').toString('base64') !== row.inlineBase64) throw new Error(`Invalid inline support: ${row.path}`);
        verify(row, Buffer.from(row.inlineBase64, 'base64'));
      }
      paths.add(row.path);
      if (archive) ids.add(row.id);
    }
  }
  return catalog;
}

export async function readCatalog(packageRoot = PACKAGE_ROOT) {
  return validateCatalog(JSON.parse(await fs.readFile(path.join(packageRoot, CATALOG_PATH), 'utf8')));
}

function verify(row, bytes) {
  if (bytes.length !== row.bytes || digest(bytes) !== row.sha256) throw new Error(`Integrity mismatch: ${row.path}`);
  return bytes;
}

async function localBytes(root, row) {
  const target = path.join(root, row.path), real = await fs.realpath(target);
  if (!inside(root, real) || !(await fs.lstat(target)).isFile()) throw new Error(`Unsafe source file: ${row.path}`);
  const stat = await fs.stat(target);
  if (stat.size !== row.bytes) throw new Error(`Integrity mismatch: ${row.path}`);
  return verify(row, await fs.readFile(target));
}

// Only genuine absence permits remote fallback. An existing corrupt file or
// directory alias is an error, including a dangling symlink with no realpath.
async function optionalSupportBytes(root, row) {
  const parts = row.path.split('/'); let target = root;
  for (let i = 0; i < parts.length; i++) {
    target = path.join(target, parts[i]); let stat;
    try { stat = await fs.lstat(target); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (stat.isSymbolicLink() || (i < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())) throw new Error(`Unsafe source file: ${row.path}`);
  }
  return localBytes(root, row);
}

async function restoreSupport(rows, read, staging) {
  let next = 0, failure;
  // Drain every worker before removing staging on any error.
  await Promise.all(Array.from({ length: Math.min(6, rows.length) }, async () => {
    while (!failure && next < rows.length) {
      const row = rows[next++];
      try {
        const bytes = verify(row, await read(row)), target = path.join(staging, row.path);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, bytes, { flag: 'wx' });
      } catch (error) { failure ??= new Error(`Could not restore ${row.path}: ${message(error)}`, { cause: error }); }
    }
  }));
  if (failure) throw failure;
}

export function archiveUrl(catalog, row) {
  return `https://raw.githubusercontent.com/${catalog.source.repository}/${catalog.source.commit}/${row.path}`;
}

async function remoteBytes(catalog, row, fetchImpl, timeoutMs) {
  const response = await fetchImpl(archiveUrl(catalog, row), { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`Evidence download failed: ${row.id ?? row.path} (HTTP ${response.status})`);
  // fetch decodes HTTP content-encoding but retains the encoded length header.
  const encoding = response.headers.get('content-encoding')?.trim().toLowerCase();
  if ((!encoding || encoding === 'identity') && response.headers.has('content-length') && Number(response.headers.get('content-length')) !== row.bytes) {
    await response.body?.cancel();
    throw new Error(`Integrity mismatch: ${row.path} (download size)`);
  }
  if (!response.body) throw new Error(`Empty evidence response: ${row.id ?? row.path}`);
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > row.bytes) throw new Error(`Archive exceeds catalog size: ${row.id ?? row.path}`);
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  return verify(row, Buffer.concat(chunks, size));
}

async function requireAbsent(target) {
  try { await fs.lstat(target); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new Error(`Output already exists: ${target}`);
}

// Claim a fresh directory exclusively. Copy files exclusively too: portable directory rename
// can replace an empty competing directory on POSIX, and cannot replace it on Windows.
// Rollback removes only our files/directories; it never recursively removes the destination.
async function publish(staging, output, rows) {
  await fs.mkdir(output);
  const files = [], directories = [output];
  try {
    for (const row of rows) {
      let dir = output;
      for (const part of row.path.split('/').slice(0, -1)) {
        dir = path.join(dir, part);
        try { await fs.mkdir(dir); directories.push(dir); } catch (error) {
          if (error.code !== 'EEXIST' || !(await fs.lstat(dir)).isDirectory()) throw error;
        }
      }
      const target = path.join(output, row.path);
      await fs.copyFile(path.join(staging, row.path), target, constants.COPYFILE_EXCL);
      files.push({ path: target, stat: await fs.lstat(target) });
    }
  } catch (error) {
    const failures = [];
    for (const file of files.reverse()) {
      try {
        const stat = await fs.lstat(file.path);
        if (stat.ino !== file.stat.ino || stat.dev !== file.stat.dev) throw new Error('file changed during publication');
        await fs.unlink(file.path);
      } catch (cleanupError) { failures.push(`${file.path}: ${message(cleanupError)}`); }
    }
    for (const dir of directories.reverse()) {
      try { await fs.rmdir(dir); } catch (cleanupError) { failures.push(`${dir}: ${message(cleanupError)}`); }
    }
    if (failures.length) throw new Error(`${message(error)}; output cleanup incomplete: ${failures.join('; ')}`, { cause: error });
    throw error;
  }
}

/** Only explicit yes applies. Injected roots/transport keep tests offline and detached. */
export async function restoreArchives({ all = false, ids = [], output, yes = false, from, offline = false,
  list = false, packageRoot = PACKAGE_ROOT, catalog, fetchImpl = globalThis.fetch, timeoutMs = 30_000, log = console.log } = {}) {
  catalog = validateCatalog(catalog ?? await readCatalog(packageRoot));
  if (list) {
    if (all || ids.length || output || yes || from || offline) throw new Error('--list cannot be combined with restore options');
    for (const row of catalog.archives) log(`${row.id}\t${row.bytes}\t${row.path}`);
    return { status: 'listed', archives: catalog.archives.length };
  }
  if (all === (ids.length > 0) || new Set(ids).size !== ids.length) throw new Error('Choose --all or one or more unique --id values');
  const selected = all ? catalog.archives : ids.map(id => {
    const row = catalog.archives.find(row => row.id === id);
    if (!row) throw new Error(`Unknown archive ID: ${id}`);
    return row;
  });
  if (!output) throw new Error('A fresh --output directory is required');
  if (offline && !from) throw new Error('--offline requires --from <archive-root>');
  const packagePath = await fs.realpath(packageRoot), sourcePath = from ? await fs.realpath(from) : null;
  const requested = path.resolve(output), parent = await fs.realpath(path.dirname(requested));
  output = path.join(parent, path.basename(requested));
  if (inside(packagePath, output) || (sourcePath && inside(sourcePath, output))) throw new Error('Output must be outside package and archive source directories');
  await requireAbsent(output);
  log(`Archive restore plan: ${selected.length} archive(s), ${catalog.supportFiles.length} shared support file(s)`);
  log(`Source: ${sourcePath ?? `${catalog.source.repository}@${catalog.source.commit} (HTTPS)`}`);
  log(`Output: ${output}`);
  if (!yes) { log('Preview only. Add --yes to restore; no files were written or downloaded.'); return { status: 'planned', archives: selected.length }; }
  const staging = await fs.mkdtemp(path.join(parent, '.skillfit-archives-'));
  let failure;
  try {
    const downloads = new Map();
    await restoreSupport(catalog.supportFiles, async row => {
      if (row.inlineBase64 !== undefined) return Buffer.from(row.inlineBase64, 'base64');
      // The live index may evolve after its historical copy is archived. Its
      // original bytes must come from the pinned source, never today's index.
      const local = row.path === 'evidence/README.md' ? null : await optionalSupportBytes(packagePath, row);
      if (local !== null) return local;
      if (sourcePath) return localBytes(sourcePath, row);
      const key = `${row.bytes}:${row.sha256}`;
      if (!downloads.has(key)) downloads.set(key, remoteBytes(catalog, row, fetchImpl, timeoutMs));
      return downloads.get(key);
    }, staging);
    for (const row of selected) {
      let bytes;
      try { bytes = sourcePath ? await localBytes(sourcePath, row) : await remoteBytes(catalog, row, fetchImpl, timeoutMs); }
      catch (error) { throw new Error(`Could not restore ${row.path}: ${message(error)}`, { cause: error }); }
      const target = path.join(staging, row.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, bytes, { flag: 'wx' });
    }
    // A competing output created during download is rejected by the exclusive mkdir.
    await publish(staging, output, [...catalog.supportFiles, ...selected]);
  } catch (error) { failure = error; }
  try { await fs.rm(staging, { recursive: true, force: true }); } catch (error) {
    failure = new Error(`${failure ? message(failure) + '; ' : ''}Staging cleanup failed: ${staging}: ${message(error)}`, { cause: failure ?? error });
  }
  if (failure) throw failure;
  log(`Restored and verified ${selected.length} archive(s). Follow the historical README for manual offline replay.`);
  return { status: 'restored', archives: selected.length, output };
}

export async function main(args = process.argv.slice(2)) {
  const opts = { ids: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help') {
      console.log('Usage: node evidence/fetch-archives.mjs --list | (--all | --id <id>...) --output <new-directory> [--yes] [--from <archive-root>] [--offline]');
      return;
    }
    if (['--all', '--yes', '--offline', '--list'].includes(arg)) {
      const key = arg.slice(2);
      if (opts[key]) throw new Error(`Duplicate option: ${arg}`);
      opts[key] = true;
    } else if (['--id', '--output', '--from'].includes(arg)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (arg === '--id') opts.ids.push(value);
      else { const key = arg.slice(2); if (opts[key]) throw new Error(`Duplicate option: ${arg}`); opts[key] = value; }
    } else throw new Error(`Unknown option: ${arg}`);
  }
  return restoreArchives(opts);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Archive restore failed: ${message(error)}`); process.exitCode = 1; });
}
