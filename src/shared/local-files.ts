import { statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
export function resolveHome(dirPattern: string, homeDir: string): string {
  return dirPattern.startsWith('~') ? join(homeDir, dirPattern.slice(1)) : dirPattern;
}
function matchSegment(name: string, pattern: string): boolean {
  if (pattern === '*') return true;
  const star = pattern.indexOf('*');
  if (star === -1) return name === pattern;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  return (
    name.startsWith(prefix) &&
    name.endsWith(suffix) &&
    name.length >= prefix.length + suffix.length
  );
}
export function walkGlob(rootDir: string, pattern: string): string[] {
  const segments = pattern.split('/');
  const out: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth === segments.length) {
      if (statSync(dir).isFile()) out.push(dir);
      return;
    }
    const segment = segments[depth];
    if (segment === undefined) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (segment === '**') {
      walk(dir, depth + 1);
      for (const entry of entries) {
        if (entry.isDirectory()) {
          walk(join(dir, entry.name), depth);
        }
      }
      return;
    }
    for (const entry of entries) {
      if (matchSegment(entry.name, segment)) {
        walk(join(dir, entry.name), depth + 1);
      }
    }
  };
  walk(rootDir, 0);
  return out.sort();
}
