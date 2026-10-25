import { packagePath } from '../shared/package-root.js';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

/** Paths win over bundled names. Explicit/existing local paths never fall back. */
export function resolveBenchDir(bench?: string, options: { cwd?: string; bundledRoot?: string } = {}): string {
  const root = options.bundledRoot ?? packagePath('benches');
  const cwd = options.cwd ?? process.cwd();
  if (bench !== undefined) {
    const dir = resolve(cwd, bench);
    if (existsSync(join(dir, 'bench.json'))) return dir;
    if (existsSync(dir) || isAbsolute(bench) || /[\\/]/.test(bench) || bench === '.' || bench === '..') {
      throw new Error(`Not a bench directory (missing bench.json): ${dir}`);
    }
  }
  const candidates = existsSync(root) ? readdirSync(root).sort().map(name => ({ name, dir: join(root, name) }))
    .filter(entry => statSync(entry.dir).isDirectory() && existsSync(join(entry.dir, 'bench.json'))) : [];
  if (bench !== undefined) {
    const match = candidates.find(entry => entry.name === bench);
    if (match) return match.dir;
    throw new Error(`Not a bench directory (missing bench.json): ${resolve(cwd, bench)}`);
  }
  if (candidates.length === 1) return candidates[0]!.dir;
  if (!candidates.length) throw new Error(`No bundled benches found under ${root}; pass --bench <path>`);
  throw new Error(`More than one bundled bench is available; pick one explicitly:\n${candidates.map(entry => `  --bench ${entry.name}`).join('\n')}`);
}
