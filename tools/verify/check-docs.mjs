import { existsSync, readFileSync, realpathSync, statSync, readdirSync, lstatSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { DOCUMENTATION_CHECKS, documentationExcluded, inspectDocumentationRegistry, publicMarkdownPath } from './documentation-registry.mjs';
import { validateReleaseDocuments } from './recipes/release-docs-smoke.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

import { markdownAnchors, markdownFencedBlocks, markdownLinks, withoutFences } from './documentation-markdown.mjs';
export { markdownAnchors, markdownLinks } from './documentation-markdown.mjs';

/** Registered maintained pages, including nested guides and active plans. */
export function documentationFiles(root = ROOT) {
  const result = inspectDocumentationRegistry(root);
  if (result.errors.length) throw Error(result.errors.join('\n'));
  return result.files;
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

/** Shared developer/CI gate; registration is checked before reading prose. */
export function checkDocumentation(root = ROOT, { changes = [], previousDocuments = new Map(), baseline = null } = {}) {
  const registry = inspectDocumentationRegistry(root), files = new Set(registry.files);
  const result = { schemaVersion: 1, kind: 'skillfit.documentation-check', errors: [...registry.errors], files: [],
    registeredDocuments: registry.policy?.documents.length ?? 0, topics: Object.keys(registry.policy?.topics ?? {}).length,
    manualReviews: registry.manualExclusions.map(e => ({ path: e.path, responsibility: e.verification, status: 'not-machine-verified' })),
    baseline, anchorBaseline: 'not-compared', anchorMigrations: [], impacts: [], unmappedChanges: [] };
  if (result.errors.length) return result;
  result.anchorBaseline = baseline || previousDocuments.size ? 'compared' : 'not-provided';
  if (!Array.isArray(changes) || changes.some(row => typeof row?.path !== 'string' || isAbsolute(row.path) || /[\\\0]/.test(row.path) || row.path.split('/').some(p => !p || p === '.' || p === '..'))) {
    result.errors.push('changes: use repository-relative file paths from the diff; do not pass aliases or traversal.'); return result;
  }
  for (const { path } of changes) if (registry.policy.documents.some(d => d.path === path)) files.add(path);
  result.files = [...files].sort();
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
  for (const [path, previous] of previousDocuments) {
    if (!publicMarkdownPath(path)) { result.errors.push(`${path}: baseline leaves public documentation scope; use a public Markdown path.`); continue; }
    if (documentationExcluded(path, registry.policy.exclusions)) continue;
    const exists = existsSync(join(root, path));
    if (!exists) {
      const oldAnchors = [...markdownAnchors(previous)];
      const documentationIndex = join(root, 'docs/README.md');
      const snapshot = /^[a-f0-9]{40}$/.test(baseline ?? '') && !/^0+$/.test(baseline)
        ? `https://github.com/remote-controlled-man/skillfit/tree/${baseline}/${path.split('/')[0]}` : null;
      const archived = snapshot && changes.some(row => row.path === path && row.status === 'D') && existsSync(documentationIndex) &&
        markdownLinks(readFileSync(documentationIndex, 'utf8')).some(link => link.target === snapshot);
      for (const from of oldAnchors.length ? oldAnchors.map(fragment => `${path}#${fragment}`) : [path]) result.anchorMigrations.push({ from,
        to: archived ? `https://github.com/remote-controlled-man/skillfit/blob/${baseline}/${from}` : null, status: archived ? 'archived' : 'missing' });
      if (!archived) result.errors.push(`${path}: old path removed; restore a compatibility page.`);
      continue;
    }
    // Discovery/registration above validated public realpaths before any body read.
    const body = readFileSync(join(root, path), 'utf8'), current = markdownAnchors(body);
    const snapshot = /^[a-f0-9]{40}$/.test(baseline ?? '') && !/^0+$/.test(baseline)
      ? `https://github.com/remote-controlled-man/skillfit/blob/${baseline}/${path}` : null;
    for (const fragment of markdownAnchors(previous)) {
      const from = `${path}#${fragment}`, retained = current.has(fragment);
      const archived = !retained && snapshot && markdownLinks(body).some(link => link.target === snapshot);
      result.anchorMigrations.push({ from, to: retained ? from : archived ? `${snapshot}#${fragment}` : null, status: retained ? 'retained' : archived ? 'archived' : 'missing' });
      if (!retained && !archived) result.errors.push(`${from}: old fragment removed; restore the heading or an explicit alias.`);
    }
  }
  const matched = new Set(), changedPaths = [...new Set(changes.map(row => row.path))].sort();
  for (const [id, topic] of Object.entries(registry.policy.topics).sort(([a], [b]) => a.localeCompare(b))) {
    const related = [topic.canonical.split('#')[0], ...topic.sources, ...topic.schemas, ...topic.dependents,
      ...topic.checks.flatMap(check => DOCUMENTATION_CHECKS[check].files)];
    const changed = changedPaths.filter(path => related.includes(path));
    if (!changed.length) continue;
    changed.forEach(path => matched.add(path));
    result.impacts.push({ topic: id, canonical: topic.canonical,
      owner: registry.policy.documents.find(d => d.path === topic.canonical.split('#')[0]).owner,
      changed, dependents: topic.dependents, checks: topic.checks.map(id => ({ id, ...DOCUMENTATION_CHECKS[id] })), status: 'review-required' });
  }
  result.unmappedChanges = changedPaths.filter(path => !matched.has(path));
  return result;
}

/** Read-only Git adapter. Never request task inputs, private paths or model output. */
export function readDocumentationBaseline(root, base, changes, git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 })) {
  if (!/^[a-f0-9]{40}$/.test(base) || /^0+$/.test(base)) throw Error('Documentation baseline requires an exact nonzero commit SHA.');
  const registry = inspectDocumentationRegistry(root);
  if (registry.errors.length) throw Error(registry.errors.join('\n'));
  git(['cat-file', '-e', `${base}^{commit}`]);
  if (changes === undefined) {
    const parts = git(['diff', '--name-status', '--no-renames', '-z', base, '--']).split('\0');
    changes = [];
    while (parts[0]) {
      const status = parts.shift(), path = parts.shift();
      if (!/^[AMDT]$/.test(status) || !path) throw Error('Unsupported documentation diff; inspect the exact file changes.');
      changes.push({ status, path });
    }
    for (const path of git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)) changes.push({ path, status: 'A' });
  }
  const previousDocuments = new Map();
  for (const { path, status } of changes) {
    if (status === 'A' || !publicMarkdownPath(path) || documentationExcluded(path, registry.policy.exclusions)) continue;
    previousDocuments.set(path, git(['show', `${base}:${path}`]));
  }
  return { changes, previousDocuments, baseline: base };
}

if (process.argv[1] && existsSync(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    let base, asJson = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--json' && !asJson) asJson = true;
      else if (args[i] === '--base' && base === undefined && args[i + 1]) base = args[++i];
      else throw Error('Use node tools/verify/check-docs.mjs [--base <exact commit SHA>] [--json].');
    }
    const result = checkDocumentation(ROOT, base ? readDocumentationBaseline(ROOT, base) : {});
    if (asJson) console.log(JSON.stringify(result));
    else {
      for (const error of result.errors) console.error(error);
      console.log(`Documentation: ${result.files.length} files, ${result.registeredDocuments} registered, ${result.errors.length} errors; anchors ${result.anchorBaseline}.`);
      for (const impact of result.impacts) console.log(`REVIEW ${impact.topic} (${impact.owner}): ${impact.canonical}; dependents: ${impact.dependents.join(', ') || 'none'}; checks: ${impact.checks.map(c => c.id).join(', ')}. Not automatically verified.`);
      for (const item of result.manualReviews) console.log(`MANUAL ${item.path}: ${item.responsibility}; ${item.status}.`);
      if (result.unmappedChanges.length) console.log(`REVIEW unmapped changes: ${result.unmappedChanges.join(', ')}; inspect topic coverage.`);
    }
    if (result.errors.length) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
