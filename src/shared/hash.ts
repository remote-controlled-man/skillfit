import { sha256Text } from './digest.js';
export { sha256Text } from './digest.js';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';



export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function listFilesRecursive(rootDir: string, options: { excludeGitMetadata?: boolean } = {}): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const entry of readdirSync(join(rootDir, rel), { withFileTypes: true })) {
      if (options.excludeGitMetadata && entry.name === '.git') continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(childRel);
      } else if (entry.isFile()) {
        out.push(childRel);
      }
    }
  };
  walk('');
  return out.sort();
}

export function hashFileSet(rootDir: string, relativePaths: string[]): string {
  const lines = relativePaths.map((rel) => `${sha256File(join(rootDir, rel))}  ${rel}`);
  return sha256Text(lines.join('\n'));
}
