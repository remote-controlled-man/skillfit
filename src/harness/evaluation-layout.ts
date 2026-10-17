import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Resolve existing ancestors so an uncreated output cannot hide behind an alias. */
export function physicalPath(path: string): string {
  let parent = resolve(path);
  const parts: string[] = [];
  while (!existsSync(parent)) { parts.unshift(basename(parent)); parent = dirname(parent); }
  return join(realpathSync(parent), ...parts);
}

function contains(root: string, path: string): boolean {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
}

/** Preview and session setup share this read-only rule. */
export function assertEvaluationOutputLayout(output: string, inputs: { benchDir: string; targetDirs?: readonly string[] }): void {
  const actual = physicalPath(output);
  if ([resolve(output), actual].some(path => path.split(/[\\/]/).includes('.git'))) {
    throw new Error('Experiment output must be outside Git metadata; choose a separate --runs-root.');
  }
  const implementation = fileURLToPath(new URL('../', import.meta.url));
  for (const input of [inputs.benchDir, ...(inputs.targetDirs ?? []), implementation]) {
    if (contains(physicalPath(input), actual)) {
      throw new Error('Experiment output must be outside the bench, Skill/overlay and compiled runtime inputs; choose a sibling --runs-root before previewing or running.');
    }
  }
}
