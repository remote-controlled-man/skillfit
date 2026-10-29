import { existsSync, readFileSync, realpathSync, statSync, readdirSync, lstatSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReleaseDocuments } from './recipes/release-docs-smoke.mjs';
import { markdownAnchors, markdownFencedBlocks, markdownLinks, withoutFences } from './documentation-markdown.mjs';

export { markdownAnchors, markdownLinks } from './documentation-markdown.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PUBLIC_TREES = ['docs', 'benches', 'profiles', 'skills', 'tools'];
const IGNORED_TREES = new Set(['node_modules', '.git', 'dist', 'runs', 'workspace4skills', '.codex', '.agents', '.aws']);
/** Bench task inputs are fixture/vendor prose and reference answers, not maintained documentation. */
const BENCH_INPUT_DATA = /^benches\/(?:contrib\/)?[^/]+\/(?:tasks|prompts|fixtures|ground-truth)\//;
const SELF_TEST_INPUT = /^benches\/_self-test\/(?:target|example\/prompts)\//;

export function publicMarkdownPath(path) {
  return typeof path === 'string' && !isAbsolute(path) && !/[\\*?#\0]/.test(path) &&
    !path.split('/').some(p => !p || p === '.' || p === '..') && /\.md$/i.test(path) &&
    !path.split('/').some(p => IGNORED_TREES.has(p)) &&
    (!path.includes('/') || PUBLIC_TREES.includes(path.split('/')[0]));
}

const isBenchInputData = path => BENCH_INPUT_DATA.test(path) || SELF_TEST_INPUT.test(path);

/** Maintained public Markdown, discovered from the tree rather than declared in a registry. */
export function documentationFiles(root = ROOT) {
  root = realpathSync(root);
  const found = [];
  const walk = (dir, ancestors = new Set()) => {
    const actual = realpathSync(join(root, dir));
    if (ancestors.has(actual)) throw Error(`${dir}: directory alias cycle; use the real public documentation path.`);
    const visited = new Set([...ancestors, actual]);
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = dir ? `${dir}/${entry.name}` : entry.name;
      if (IGNORED_TREES.has(entry.name) || isBenchInputData(path + '/')) continue;
      if (!dir && !PUBLIC_TREES.includes(path) && !/\.md$/i.test(path)) continue;
      if (entry.isSymbolicLink()) throw Error(`${path}: alias is not admitted; use the real public document path.`);
      if (entry.isDirectory()) {
        if (dir || PUBLIC_TREES.includes(path)) walk(path, visited);
      } else if (/\.md$/i.test(path) && publicMarkdownPath(path)) found.push(path);
    }
  };
  walk('');
  return found.sort();
}

export function inspectDocumentation(root = ROOT, files = documentationFiles(root)) {
  root = realpathSync(root);
  const errors = [], cache = new Map();
  const outsideScope = destination => {
    const rel = relative(root, destination);
    return isAbsolute(rel) || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') ||
      /^(?:workspace4skills|runs)(?:[\\/]|$)/.test(rel);
  };
  for (const file of files) {
    const source = resolve(root, file);
    if (outsideScope(source) || outsideScope(realpathSync(source))) {
      errors.push(`${file}: source leaves the public documentation scope`); continue;
    }
    for (const { target, line } of markdownLinks(readFileSync(source, 'utf8'))) {
      // Source-sensitive references must not change version when main or a tag moves.
      // Keep this offline: immutable historical targets are not fetched or reinterpreted.
      const repository = /^(?:https?:)?\/\/github\.com\/remote-controlled-man\/skillfit\/(?:blob|tree)\/([^?#]+)/i.exec(target);
      if (repository) {
        let parts;
        try { parts = decodeURIComponent(repository[1]).split('/'); }
        catch { errors.push(`${file}:${line}: invalid URL encoding: ${target}`); continue; }
        const [revision, ...path] = parts;
        if (path.some(part => /^(?:docs|benches|src|tools|\.github)$/.test(part)) &&
            !/^[a-f0-9]{40}$/i.test(revision)) {
          errors.push(`${file}:${line}: version-sensitive repository link needs a full commit; use a relative link only when both files ship together: ${target}`);
        }
      }
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue;
      let decoded;
      try { decoded = decodeURIComponent(target); }
      catch { errors.push(`${file}:${line}: invalid URL encoding: ${target}`); continue; }
      const hash = decoded.indexOf('#'), path = (hash < 0 ? decoded : decoded.slice(0, hash)).split('?')[0];
      const fragment = hash < 0 ? '' : decoded.slice(hash + 1);
      let destination = resolve(dirname(join(root, file)), path || '.');
      if (!path) destination = join(root, file);
      if (outsideScope(destination)) {
        errors.push(`${file}:${line}: link leaves the public documentation scope: ${target}`); continue;
      }
      if (!existsSync(destination)) { errors.push(`${file}:${line}: missing target: ${target}`); continue; }
      destination = realpathSync(destination);
      if (outsideScope(destination)) {
        errors.push(`${file}:${line}: link leaves the public documentation scope: ${target}`); continue;
      }
      if (fragment && statSync(destination).isDirectory()) destination = join(destination, 'README.md');
      if (existsSync(destination)) destination = realpathSync(destination);
      if (outsideScope(destination)) {
        errors.push(`${file}:${line}: link leaves the public documentation scope: ${target}`); continue;
      }
      if (fragment && destination.endsWith('.md')) {
        if (!cache.has(destination)) cache.set(destination, existsSync(destination) ? markdownAnchors(readFileSync(destination, 'utf8')) : new Set());
        if (!cache.get(destination).has(fragment)) errors.push(`${file}:${line}: missing anchor: ${target}`);
      }
    }
  }
  return errors;
}

/** Only public contrib manifests define catalog membership; fixture Markdown is data. */
export function inspectBenchCatalog(root = ROOT) {
  const directory = join(root, 'benches/contrib');
  if (!existsSync(directory)) return [];
  if (lstatSync(join(root, 'benches')).isSymbolicLink() || lstatSync(directory).isSymbolicLink()) return ['benches/contrib: unsafe catalog directory alias'];
  const errors = [], actual = new Set();
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) { errors.push(`benches/contrib: unsafe catalog alias: ${entry.name}`); continue; }
    if (entry.isDirectory() && existsSync(join(directory, entry.name, 'bench.json'))) actual.add(entry.name);
  }
  const index = join(directory, 'README.md');
  if (!existsSync(index) || lstatSync(index).isSymbolicLink()) return [...errors, 'benches/contrib/README.md: missing or unsafe catalog'];
  const listed = new Set();
  for (const { target } of markdownLinks(readFileSync(index, 'utf8'))) {
    const match = /^([a-zA-Z0-9][a-zA-Z0-9_-]*)\/README\.md$/.exec(target);
    if (!match) continue;
    const name = match[1];
    if (!actual.has(name)) errors.push(`benches/contrib/README.md: unknown bench: ${name}`);
    if (listed.has(name)) errors.push(`benches/contrib/README.md: duplicate bench: ${name}`);
    listed.add(name);
  }
  for (const name of actual) if (!listed.has(name)) errors.push(`benches/contrib/README.md: missing bench: ${name}`);
  const entry = join(root, 'benches/README.md');
  if (actual.size && (!existsSync(entry) || lstatSync(entry).isSymbolicLink() || !markdownLinks(readFileSync(entry, 'utf8')).some(link => link.target === 'contrib/README.md'))) errors.push('benches/README.md: link the contrib catalog');
  return errors;
}

/** Inspect only owned public trees; never traverse runs, private labs or directory aliases. */
export function inspectRepositoryLayout(root = ROOT) {
  const errors = [];
  const walk = (dir, visit) => {
    if (!existsSync(join(root, dir))) return;
    if (lstatSync(join(root, dir)).isSymbolicLink()) { errors.push(`${dir}: directory alias is not admitted`); return; }
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const file = `${dir}/${entry.name}`;
      if (entry.name === '.DS_Store') continue;
      if (entry.isSymbolicLink()) { errors.push(`${file}: alias is not admitted`); continue; }
      if (entry.isDirectory()) walk(file, visit); else visit(file);
    }
  };
  walk('docs', file => {
    if (file === 'docs/.npmignore') return;
    if (/\.(?:m?js|cjs|ts|sh|py)$/.test(file)) errors.push(`${file}: executable recipes belong to tools`);
    else if (file.startsWith('docs/work/') && file !== 'docs/work/current.md') errors.push(`${file}: update the sole current plan in place`);
    else if (file.endsWith('.md') && file !== 'docs/README.md' && !/^docs\/(?:guides|reference|maintainers|work)\/[^/]+\.md$/.test(file)) errors.push(`${file}: flat or unowned documentation topic`);
    else if (!file.endsWith('.md') && !/^docs\/(?:schemas|examples|assets)\//.test(file)) errors.push(`${file}: generated records are not maintained documentation`);
  });
  walk('evidence', file => { errors.push(file + ': retired evidence tree; keep run outputs outside maintained source'); });
  walk('src', file => { if (!file.endsWith('.ts') && !/^src\/matrix\/[^/]+\.json$/.test(file)) errors.push(`${file}: generated output is not source`); });
  walk('tools', file => { if (/\.(?:log|tgz|zip|tar\.gz)$/.test(file) || /\/(?:receipts|records|runs)\//.test(file)) errors.push(`${file}: generated attempts belong outside tooling`); });
  return errors;
}

/** Shared developer/CI gate over discovered public Markdown. */
export function checkDocumentation(root = ROOT) {
  const result = { schemaVersion: 2, kind: 'skillfit.documentation-check', errors: [], files: [] };
  try {
    result.files = documentationFiles(root);
  } catch (error) {
    result.errors.push(error.message);
    return result;
  }
  result.errors.push(...inspectRepositoryLayout(root), ...inspectDocumentation(root, result.files), ...inspectBenchCatalog(root));
  try {
    const [english, chinese] = ['README.md', 'README.zh-CN.md'].map(file => readFileSync(join(root, file), 'utf8'));
    const levels = text => [...withoutFences(text).matchAll(/^(#{1,6}) /gm)].map(m => m[1].length);
    const badges = text => text.split(/\r?\n/).filter(line => line.includes('shields.io'));
    for (const [label, read] of [['section levels', levels], ['command/demo blocks', markdownFencedBlocks], ['badges', badges]]) {
      if (JSON.stringify(read(english)) !== JSON.stringify(read(chinese))) result.errors.push(`README.md / README.zh-CN.md: ${label} differ; restore bilingual parity.`);
    }
    validateReleaseDocuments(root);
  } catch (error) { result.errors.push(error.message); }
  return result;
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    let asJson = false;
    for (const arg of args) {
      if (arg === '--json' && !asJson) asJson = true;
      else throw Error('Use node tools/verify/check-docs.mjs [--json].');
    }
    const result = checkDocumentation(ROOT);
    if (asJson) console.log(JSON.stringify(result));
    else {
      for (const error of result.errors) console.error(error);
      console.log(`Documentation: ${result.files.length} files, ${result.errors.length} errors.`);
    }
    if (result.errors.length) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
