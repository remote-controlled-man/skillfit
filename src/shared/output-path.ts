import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

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

export function assertOutputPaths(output: string, protectedRoots: readonly string[], metadataMessage: string, overlapMessage: string): void {
 const actual = physicalPath(output);
 if ([resolve(output), actual].some(path => path.split(/[\\/]/).includes('.git'))) throw new Error(metadataMessage);
 for (const input of protectedRoots) if (contains(physicalPath(input), actual)) throw new Error(overlapMessage);
}
