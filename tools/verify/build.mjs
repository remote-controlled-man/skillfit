import { existsSync, lstatSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const compiler = createRequire(import.meta.url).resolve('typescript/bin/tsc');

/** A failed compiler never replaces the last usable build. Only our staging tree is removed. */
export function build(root) {
  const dist = join(root, 'dist');
  let previous = false;
  try {
    const entry = lstatSync(dist);
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Build output must be an ordinary directory.');
    previous = true;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const staging = mkdtempSync(join(root, '.skillfit-build-'));
  let removeStaging = true;
  try {
    const output = join(staging, 'dist');
    const result = spawnSync(process.execPath, [compiler, '-p', join(root, 'tsconfig.json'), '--outDir', output], { cwd: root, encoding: 'utf8' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`TypeScript compilation failed.\n${result.stdout}${result.stderr}`);
    if (!existsSync(output)) throw new Error('TypeScript compilation produced no output.');
    const backup = join(staging, 'previous');
    if (previous) renameSync(dist, backup);
    try { renameSync(output, dist); }
    catch (error) {
      if (previous) {
        try { renameSync(backup, dist); }
        catch (rollbackError) {
          removeStaging = false;
          throw new AggregateError([error, rollbackError], `Build swap failed; previous output retained at ${backup}`);
        }
      }
      throw error;
    }
  } finally { if (removeStaging) rmSync(staging, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { build(fileURLToPath(new URL('../../', import.meta.url))); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
