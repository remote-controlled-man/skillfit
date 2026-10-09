import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';

/** Runtime adaptation only: source stays byte-identical to the pinned upstream TS/CJS. */
export async function loadCache(root, typescript = false) {
  if (!typescript) return { Cache: createRequire(import.meta.url)(join(root, 'index.js')), cleanup() {} };
  if (typeof stripTypeScriptTypes !== 'function') throw new Error('This replay requires Node >=22.13 for built-in TypeScript stripping.');
  const compiled = mkdtempSync(join(tmpdir(), 'skillfit-lru-runtime-'));
  try {
    mkdirSync(join(compiled, 'src'));
    for (const name of ['index', 'perf', 'diagnostics-channel']) {
      const bytes = readFileSync(join(root, 'src', `${name}.ts`), 'utf8');
      const js = stripTypeScriptTypes(bytes, { mode: 'strip' }).replaceAll("'./diagnostics-channel.js'", "'./diagnostics-channel.mjs'").replaceAll("'./perf.js'", "'./perf.mjs'");
      writeFileSync(join(compiled, 'src', `${name}.mjs`), js);
    }
    const { LRUCache: Cache } = await import(pathToFileURL(join(compiled, 'src', 'index.mjs')));
    return { Cache, cleanup: () => rmSync(compiled, { recursive: true, force: true }) };
  } catch (error) { rmSync(compiled, { recursive: true, force: true }); throw error; }
}
