import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { markdownAnchors } from './documentation-markdown.mjs';

const PUBLIC_TREES = ['docs', 'benches', 'profiles', 'skills', 'tools', 'evidence'];
const IGNORED_TREES = new Set(['node_modules', '.git', 'dist', 'runs', 'workspace4skills', '.codex', '.agents', '.aws']);
export const MAINTENANCE_ROLES = ['development', 'evaluation', 'bench-authoring', 'agent-integration', 'distribution', 'evidence'];
const automatic = (...files) => ({ kind: 'automatic', files });
const manual = { kind: 'manual', files: [] };
// Reviewed development-test locations, never commands supplied by registry text.
export const DOCUMENTATION_CHECKS = {
  'measurement-scope': automatic('src/evaluation/bench-claims.test.ts', 'src/cli/eval-measurement-scope.test.ts', 'src/cli/bench-claims-cli.test.ts', 'src/evaluation/eval-component.test.ts'),
  'documentation-review': manual, 'historical-review': manual, 'study-review': manual,
  'cli-reference': automatic('tools/verify/cli-reference.test.mjs'),
  'docs-links': automatic('tools/verify/check-docs.test.mjs', 'tools/verify/documentation-registry.test.mjs'),
  'readme-parity': automatic('tools/verify/check-docs.test.mjs'),
  'release-documents': automatic('tools/verify/check-release-docs.test.mjs'),
  'bench-contracts': automatic('src/bench/read.test.ts', 'src/docs.test.ts'),
  'bench-authoring': automatic('src/cli/bench.test.ts', 'src/commands/bench-source.test.ts', 'src/commands/bench-draft.test.ts', 'src/cli/bench-manage.test.ts'),
  'bench-preflight': automatic('src/cli/bench-check-json.test.ts', 'src/cli/eval-preflight.test.ts'),
  'verifier-contract': automatic('src/bench/gates/verifier.test.ts', 'src/harness/verifier-timeout.test.ts', 'src/shared/process.test.ts', 'src/evaluation/shared-execution.test.ts'),
  'eval-planning': automatic('src/evaluation/eval-application.test.ts', 'src/cli/eval-cli-usage.test.ts', 'src/evaluation/eval-component.test.ts', 'src/cli/calibration-cli.test.ts'),
  'executor-capabilities': automatic('src/agents/adapters/cli.test.ts', 'src/agents/adapters/api.test.ts', 'src/cli/eval-agent-preflight.test.ts'),
  'trigger-observations': automatic('src/agents/observation/trigger-detection.test.ts', 'src/evaluation/execution/activation.test.ts', 'src/evaluation/measurement/trigger-summary.test.ts'),
  'model-identity': automatic('src/agents/observation/model-identity.test.ts', 'src/cli/eval-model-identity.test.ts'),
  'bench-self-test': automatic('src/evaluation/application/self-test.test.ts', 'src/cli/bench-self-test-interruption.test.ts'),
  'metrics-contract': automatic('src/evaluation/measurement/statistics.test.ts', 'src/evaluation/measurement/report.test.ts', 'src/evaluation/measurement/efficiency.test.ts'),
  'eval-accounting': automatic('src/evaluation/measurement/costs.test.ts', 'src/evaluation/execution/budget.test.ts', 'src/evaluation/judge-accounting.test.ts', 'src/evaluation/records/session.test.ts', 'src/evaluation/measurement/judge-protocol.test.ts', 'src/evaluation/measurement/trial-summary.test.ts'),
  'execution-timing': automatic('src/shared/timing.test.ts'),
  'interruption': automatic('src/evaluation/interruption.test.ts', 'src/cli/eval-interruption.test.ts'),
  'input-snapshots': automatic('src/commands/eval-layout.test.ts', 'src/cli/eval-preflight.test.ts'),
  'eval-reports': automatic('src/cli/eval-report.test.ts', 'src/cli/evaluation-report.test.ts', 'src/evaluation/eval-component.test.ts'),
  'eval-replay': automatic('src/evaluation/application/export.test.ts', 'src/cli/eval-export-modes.test.ts', 'src/cli/replay-cancellation.test.ts'),
  'archive-integrity': automatic('tools/history/check-archives.test.mjs'),
  'archive-restoration': automatic('tools/verify/fetch-archives.test.mjs'),
  'package-contents': automatic('tools/verify/check-package.test.mjs'),
  'install-transactions': automatic('src/configuration/transaction.test.ts', 'src/configuration/install.test.ts', 'src/configuration/setup.test.ts', 'src/configuration/bundle.test.ts'),
  'profile-sources': automatic('src/configuration/upstream.test.ts', 'src/configuration/setup.test.ts'),
  'release-workflow': automatic('tools/release/release-workflow.test.mjs', 'tools/release/release-source.test.mjs', 'tools/release/release-acceptance.test.mjs'),
  'architecture-dependencies': automatic('tools/verify/check-architecture.test.mjs'),
};
const requireValue = (ok, at, message) => { if (!ok) throw Error(`${at}: ${message}`); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function fields(value, required, optional, at) {
  requireValue(object(value), at, 'an object is required; use the documented shape.');
  for (const key of required) requireValue(Object.hasOwn(value, key), at, `missing ${key}; supply the documented field.`);
  for (const key of Object.keys(value)) requireValue([...required, ...optional].includes(key), at, `unknown field ${key}; remove it.`);
}
function strings(value, at, nonempty = false) {
  requireValue(Array.isArray(value) && value.every(v => typeof v === 'string' && v.trim()), at, 'a string array is required.');
  requireValue(!nonempty || value.length > 0, at, 'a nonempty array is required.');
  requireValue(new Set(value).size === value.length, at, 'duplicate entries; keep each value once.');
  return value;
}
function enumValue(value, values, at) { requireValue(values.includes(value), at, `unknown value ${String(value)}; use ${values.join(', ')}.`); }
function checkIds(value, at, nonempty = false) {
  for (const id of strings(value, at, nonempty)) requireValue(Object.hasOwn(DOCUMENTATION_CHECKS, id), at, `unknown check ${id}; use the static check catalog.`);
}
function json(text, at) {
  let value;
  try { value = JSON.parse(text); } catch (error) { throw Error(`${at}: invalid JSON; ${error.message}`); }
  // JSON.parse loses duplicate keys. Scan the already valid JSON tokens first.
  const stack = [];
  for (const [token] of text.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]:,]/g)) {
    if (token === '{' || token === '[') stack.push(token === '{' ? { keys: new Set(), key: true } : null);
    else if (token === '}' || token === ']') stack.pop();
    else if (stack.at(-1)) {
      const frame = stack.at(-1);
      if (token === ':') frame.key = false;
      else if (token === ',') frame.key = true;
      else if (frame.key && token.startsWith('"')) {
        const key = JSON.parse(token);
        requireValue(!frame.keys.has(key), at, `duplicate JSON key ${key}; keep one definition.`);
        frame.keys.add(key);
      }
    }
  }
  return value;
}
export const documentationExcluded = (path, exclusions) => typeof path === 'string' && exclusions.some(e => e.path.endsWith('/') ? path.startsWith(e.path) : path === e.path);
export function publicMarkdownPath(path) {
  return typeof path === 'string' && !isAbsolute(path) && !/[\\*?#\0]/.test(path) && !path.split('/').some(p => !p || p === '.' || p === '..') &&
    /\.md$/i.test(path) && !path.split('/').some(p => IGNORED_TREES.has(p)) && (!path.includes('/') || PUBLIC_TREES.includes(path.split('/')[0]));
}
function reference(root, path, at, directory = false) {
  requireValue(typeof path === 'string' && path && !isAbsolute(path) && !/[\\*?#\0]/.test(path), at, 'use a literal repository-relative public path.');
  const parts = (path.endsWith('/') ? path.slice(0, -1) : path).split('/');
  requireValue(parts.every(p => p && p !== '.' && p !== '..' && !IGNORED_TREES.has(p)), at, 'path leaves public documentation scope; use the real public file.');
  let current = root;
  for (const part of parts) {
    requireValue(statSync(current).isDirectory() && readdirSync(current).includes(part), at, `missing or incorrectly cased path ${path}; fix the reference.`);
    current = join(current, part);
    const rel = relative(root, realpathSync(current));
    requireValue(rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel) && !rel.split(sep).some(p => IGNORED_TREES.has(p)), at, 'alias leaves public documentation scope; use the real public file.');
  }
  requireValue(directory === null ? statSync(current).isDirectory() || statSync(current).isFile() : directory ? statSync(current).isDirectory() : statSync(current).isFile(), at, `wrong path kind for ${path}; supply a ${directory ? 'directory' : 'file'}.`);
  return current;
}

function documentReference(root, path, at, exclusions) {
  const target = reference(root, path, at), actual = relative(root, realpathSync(target)).split(sep).join('/');
  requireValue(publicMarkdownPath(actual), at, 'alias leaves public document scope; use the real public Markdown path.');
  requireValue(!documentationExcluded(path, exclusions) && !documentationExcluded(actual, exclusions), at, 'alias enters excluded inputs; use the maintained public document path.');
  return target;
}

/** One real parser for registry checks and the delivered shape/reference examples. */
export function inspectDocumentationRegistry(root, { text, coverage = true } = {}) {
  const errors = [], discovered = [], manualExclusions = [];
  let policy = null;
  try {
    root = realpathSync(root);
    policy = json(text ?? readFileSync(reference(root, 'tools/verify/documentation-policy.json', 'policy'), 'utf8'), 'policy');
    fields(policy, ['schemaVersion', 'documents', 'topics', 'exclusions'], [], 'policy');
    requireValue(policy.schemaVersion === 1, 'policy.schemaVersion', 'use supported version 1.');
    requireValue(Array.isArray(policy.documents) && object(policy.topics) && Array.isArray(policy.exclusions), 'policy', 'documents/exclusions must be arrays and topics an object.');
    for (const [i, exclusion] of policy.exclusions.entries()) {
      const at = 'exclusion ' + String(exclusion?.path ?? i);
      fields(exclusion, ['path', 'reason', 'owner', 'verification'], [], at);
      requireValue(typeof exclusion.path === 'string' && publicMarkdownPath(exclusion.path.endsWith('/') ? exclusion.path + 'input.md' : exclusion.path), at, 'exclude one public Markdown file or a literal public data-directory prefix.');
      const directory = exclusion.path.endsWith('/');
      const target = reference(root, exclusion.path, at, directory);
      requireValue(!PUBLIC_TREES.some(p => exclusion.path === p + '/') && !['benches/contrib/', 'docs/plans/', 'docs/releases/'].includes(exclusion.path), at, 'broad exclusion hides guides; use an explicit data directory.');
      requireValue(!directory || readdirSync(target).length > 0, at, 'empty unused exclusion; remove it or declare the actual input directory.');
      requireValue(typeof exclusion.reason === 'string' && exclusion.reason.trim() && MAINTENANCE_ROLES.includes(exclusion.owner), at, 'supply a reason and known owner.');
      requireValue(typeof exclusion.verification === 'string' && (Object.hasOwn(DOCUMENTATION_CHECKS, exclusion.verification) || /^manual: \S/.test(exclusion.verification)), at, 'use a known check ID or manual: review responsibility.');
      requireValue(!policy.documents.some(d => object(d) && documentationExcluded(d.path, [exclusion])), at, 'registered document is also excluded; narrow the exclusion.');
      requireValue(!policy.exclusions.slice(0, i).some(e => documentationExcluded(exclusion.path, [e]) || documentationExcluded(e.path, [exclusion])), at, 'overlapping exclusions; keep one narrow owner.');
      if (exclusion.verification.startsWith('manual: ')) manualExclusions.push(exclusion);
    }
    const documents = new Map(), documentFiles = new Map();
    for (const doc of policy.documents) {
      const at = String(doc?.path ?? 'document');
      fields(doc, ['path', 'kind', 'lifecycle', 'audience', 'owner', 'scope', 'topics', 'checks'], ['supersededBy'], at);
      requireValue(publicMarkdownPath(doc.path), at, 'register a public Markdown file.');
      documentFiles.set(doc.path, documentReference(root, doc.path, at, policy.exclusions));
      requireValue(!documents.has(doc.path), at, `duplicate path ${doc.path}; register it once.`);
      documents.set(doc.path, doc);
      enumValue(doc.kind, ['tutorial', 'how-to', 'reference', 'explanation', 'plan', 'decision', 'record', 'index'], at + '.kind');
      enumValue(doc.lifecycle, ['maintained', 'historical', 'frozen'], at + '.lifecycle');
      requireValue(MAINTENANCE_ROLES.includes(doc.owner), at + '.owner', `${doc.owner} is an unknown maintenance role; use the governance role catalog.`);
      for (const audience of strings(doc.audience, at + '.audience', true)) enumValue(audience, ['user', 'maintainer', 'contributor'], at + '.audience');
      requireValue(Array.isArray(doc.scope) && doc.scope.length, at + '.scope', 'a nonempty scope array is required.');
      const scopes = new Set();
      for (const scope of doc.scope) {
        fields(scope, ['kind', 'ref'], [], at + '.scope');
        enumValue(scope.kind, ['source', 'released', 'protocol', 'historical'], at + '.scope.kind');
        requireValue(typeof scope.ref === 'string' && scope.ref.trim(), at + '.scope.ref', 'a nonempty applicability reference is required.');
        const key = JSON.stringify([scope.kind, scope.ref]);
        requireValue(!scopes.has(key), at + '.scope', 'duplicate applicability; keep each scope once.'); scopes.add(key);
      }
      for (const id of strings(doc.topics, at + '.topics')) requireValue(Object.hasOwn(policy.topics, id), at, `unknown topic ${id}; register its authority.`);
      checkIds(doc.checks, at + '.checks');
    }
    for (const [id, topic] of Object.entries(policy.topics)) {
      const at = 'topic ' + id;
      requireValue(/^[a-z][a-z0-9-]*$/.test(id), at, 'use a stable lowercase topic ID.');
      fields(topic, ['canonical', 'sources', 'schemas', 'dependents', 'checks'], [], at);
      requireValue(typeof topic.canonical === 'string', at + '.canonical', 'declare one canonical path/fragment.');
      const [path, fragment] = topic.canonical.split('#');
      requireValue(topic.canonical.split('#').length <= 2 && documents.has(path), at + '.canonical', 'use one registered Markdown path/fragment.');
      const doc = documents.get(path);
      requireValue(doc.lifecycle !== 'historical', at, 'a historical page cannot own a current topic; select its maintained authority.');
      if (fragment !== undefined) requireValue(fragment && markdownAnchors(readFileSync(documentFiles.get(path), 'utf8')).has(decodeURIComponent(fragment)), at, `missing anchor ${fragment}; restore an alias or correct canonical.`);
      checkIds(topic.checks, at + '.checks', true);
      requireValue(doc.topics.includes(id) && topic.checks.every(c => doc.checks.includes(c)), at, 'canonical document must include its topic and checks; update registration.');
      for (const path of strings(topic.sources, at + '.sources', true)) reference(root, path, at + '.sources');
      for (const path of strings(topic.schemas, at + '.schemas')) {
        requireValue(path.endsWith('.schema.json'), at + '.schemas', 'use a machine .schema.json file.');
        json(readFileSync(reference(root, path, at + '.schemas'), 'utf8'), at + '.schemas ' + path);
      }
      strings(topic.dependents, at + '.dependents');
      const expected = policy.documents.filter(d => d.lifecycle === 'maintained' && d.path !== path && d.topics.includes(id)).map(d => d.path).sort();
      requireValue(JSON.stringify([...topic.dependents].sort()) === JSON.stringify(expected), at + '.dependents', 'reverse mapping differs; list the maintained dependent documents once, omitting canonical.');
    }
    for (const doc of policy.documents) {
      let current = doc;
      const seen = new Set();
      while (current.supersededBy !== undefined) {
        requireValue(!seen.has(current.path), doc.path + '.supersededBy', 'replacement cycle; select an acyclic registered successor.'); seen.add(current.path);
        requireValue(documents.has(current.supersededBy), doc.path + '.supersededBy', 'successor must be a registered document.');
        current = documents.get(current.supersededBy);
      }
    }
    if (coverage) {
      const walk = (dir, ancestors = new Set()) => {
        const actual = realpathSync(join(root, dir));
        const realDirectory = relative(root, actual).split(sep).join('/');
        requireValue(!dir || !documentationExcluded(realDirectory + '/', policy.exclusions), dir, 'alias enters excluded inputs; use the real public document path.');
        requireValue(!ancestors.has(actual), dir, 'directory alias cycle; use the real public documentation path.');
        const visited = new Set([...ancestors, actual]);
        for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
          const path = dir ? `${dir}/${entry.name}` : entry.name;
          if (!dir && !PUBLIC_TREES.includes(path) && !/\.md$/i.test(path)) continue;
          if (documentationExcluded(path, policy.exclusions) || documentationExcluded(path + '/', policy.exclusions)) continue;
          if (IGNORED_TREES.has(entry.name)) continue;
          if (entry.isSymbolicLink()) {
            const target = reference(root, path, path, null), rel = relative(root, realpathSync(target)).split(sep).join('/');
            const directory = statSync(target).isDirectory();
            requireValue(directory ? PUBLIC_TREES.includes(rel.split('/')[0]) : publicMarkdownPath(rel), path, 'alias leaves public documentation scope; use the real document path.');
            requireValue(!documentationExcluded(directory ? rel + '/' : rel, policy.exclusions), path, 'alias enters excluded inputs; use the real public document path.');
            if (directory) walk(path, visited);
            else if (/\.md$/i.test(path)) { documentReference(root, path, path, policy.exclusions); discovered.push(path); }
            continue;
          }
          if (entry.isDirectory() && (dir || PUBLIC_TREES.includes(path))) walk(path, visited);
          else if (entry.isFile() && /\.md$/i.test(path)) { documentReference(root, path, path, policy.exclusions); discovered.push(path); }
        }
      };
      walk('');
      for (const path of discovered) if (!documents.has(path)) errors.push(`${path}: unregistered public Markdown; register the guide or a justified narrow exclusion.`);
    }
  } catch (error) { errors.push(error.message); policy = null; }
  return { policy, errors, files: policy ? policy.documents.filter(d => d.lifecycle === 'maintained').map(d => d.path).sort() : [], manualExclusions };
}
