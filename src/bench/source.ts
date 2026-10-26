import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { physicalPath } from '../shared/output-path.js';

const MAX_FILES = 200;
const MAX_BYTES = 1024 * 1024;
const excluded = (rel: string) => rel.split(/[\\/]/).some(part => part === '.git' || part === 'node_modules');
const inside = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
};

/** Never dereference a selected link, including links in a path's parent directories. */
function ordinaryPath(root: string, rel: string): void {
  let current = root;
  for (const part of rel.split(/[\\/]/)) {
    current = join(current, part);
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) throw new Error(`Refusing a symbolic link in frozen source: ${current}. Select ordinary files with --include.`);
    if (!stat.isFile() && !stat.isDirectory()) throw new Error(`Unsupported frozen source entry: ${current}`);
  }
}

export function captureSourceFiles(sourceDir: string, include?: readonly string[]): string[] {
  const root = resolve(sourceDir);
  if (!lstatSync(root).isDirectory()) throw new Error(`--source-dir must be an ordinary directory: ${root}`);
  const selected = include?.map(value => {
    const rel = value.replace(/\\/g, '/').replace(/\/$/, '');
    if (!rel || rel === '.' || isAbsolute(rel) || /^[A-Za-z]:/.test(rel) || rel.split('/').some(part => part === '..' || part === '.' || part === '')) {
      throw new Error(`--include must name a file or subdirectory inside --source-dir: ${value}`);
    }
    if (excluded(rel)) throw new Error(`--include cannot select Git metadata or node_modules: ${value}`);
    return rel;
  });
  const git = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  let files: string[];
  if (git.status === 0) {
    files = git.stdout.split('\0').filter(Boolean);
    if (!files.length) throw new Error('No git-tracked files in --source-dir. Stage the intended fixture files first; ignored/untracked files are never a fallback.');
  } else {
    // A broken repository or failed Git executable must not silently widen capture.
    let parent = root;
    while (true) {
      if (existsSync(join(parent, '.git'))) throw new Error('Cannot read the Git index for --source-dir; fix Git before freezing files.');
      if (dirname(parent) === parent) break;
      parent = dirname(parent);
    }
    if (git.error || git.status !== 128) throw new Error('Cannot determine Git tracking for --source-dir; fix Git before freezing files.');
    if (!selected?.length) throw new Error('Non-Git --source-dir requires --include <file-or-dir> (repeatable); select the fixture explicitly.');
    files = [];
    const walk = (rel: string): void => {
      if (excluded(rel)) return;
      ordinaryPath(root, rel);
      const stat = lstatSync(join(root, rel));
      if (stat.isFile()) files.push(rel);
      else for (const name of readdirSync(join(root, rel))) walk(`${rel}/${name}`);
    };
    for (const rel of selected) walk(rel);
  }
  files = [...new Set(files)].filter(rel => !excluded(rel) && (!selected?.length || selected.some(prefix => rel === prefix || rel.startsWith(`${prefix}/`)))).sort();
  for (const prefix of selected ?? []) if (!files.some(rel => rel === prefix || rel.startsWith(`${prefix}/`))) {
    throw new Error(`--include matches no capturable files: ${prefix}`);
  }
  for (const rel of files) {
    if (isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) throw new Error(`Frozen source path escapes --source-dir: ${rel}`);
    ordinaryPath(root, rel);
    if (!lstatSync(join(root, rel)).isFile()) throw new Error(`Frozen source is not an ordinary file (submodules are unsupported): ${rel}`);
  }
  return files;
}

export function freezeSourceFiles(sourceDir: string, benchDir: string, include?: readonly string[]) {
  const root = resolve(sourceDir), bench = physicalPath(benchDir);
  const files = captureSourceFiles(root, include);
  if (files.length > MAX_FILES) throw new Error(`Frozen source has ${files.length} files; limit is ${MAX_FILES}. Narrow it with --include.`);
  let bytes = 0;
  return files.map(rel => {
    if (inside(bench, physicalPath(join(root, rel)))) throw new Error(`Frozen source includes the destination bench: ${rel}. Narrow it with --include.`);
    bytes += lstatSync(join(root, rel)).size;
    if (bytes > MAX_BYTES) throw new Error(`Frozen source exceeds ${MAX_BYTES} bytes. Narrow it with --include.`);
    return { rel, content: readFileSync(join(root, rel)) };
  });
}
