import { readdirSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
export function inputDirectories(root: string, exclude?: string): string[] {
  const result: string[] = [];
  const walk = (prefix: string): void => {
    for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      const rel = exclude ? relative(exclude, join(root, path)) : '..';
      if (entry.name === '.git' || (exclude && !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`))) continue;
      if (entry.isSymbolicLink()) throw new Error(`Unpinned symbolic link in input snapshot: ${path}`);
      if (entry.isDirectory()) { result.push(path); walk(path); }
      else if (!entry.isFile()) throw new Error(`Unsupported input snapshot entry: ${path}`);
    }
  };
  walk(''); return result.sort();
}
