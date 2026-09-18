import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function listFilesRecursive(rootDir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    for (const entry of readdirSync(join(rootDir, rel), { withFileTypes: true })) {
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
