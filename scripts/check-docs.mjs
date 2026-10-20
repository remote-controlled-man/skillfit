import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Preserve line numbers while excluding examples from link/heading checks. */
function withoutFences(markdown) {
  let fence = null;
  return markdown.split('\n').map(line => {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (match && match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) fence = null;
      return '';
    }
    if (match) { fence = match[1]; return ''; }
    return line;
  }).join('\n');
}

export function markdownAnchors(markdown) {
  const text = withoutFences(markdown), used = new Set(), anchors = new Set();
  for (const tag of text.matchAll(/<(?:a|h[1-6])\b[^>]*>/gi)) {
    for (const match of tag[0].matchAll(/\b(?:id|name)=["']([^"']+)["']/gi)) anchors.add(match[1]);
  }
  for (const match of text.matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*$/gm)) {
    const base = match[1].replace(/<[^>]*>/g, '').replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-');
    let slug = base, suffix = 0;
    while (used.has(slug)) slug = `${base}-${++suffix}`;
    used.add(slug); anchors.add(slug);
  }
  return anchors;
}

export function markdownLinks(markdown) {
  const text = withoutFences(markdown).replace(/(`+)([^\n]*?)\1/g, match => ' '.repeat(match.length));
  const links = [];
  const patterns = [/\]\(\s*(?:<([^>\n]+)>|([^\s)]+))/g, /^ {0,3}\[[^\]]+\]:\s*(?:<([^>\n]+)>|(\S+))/gm];
  for (const pattern of patterns) for (const match of text.matchAll(pattern)) {
    links.push({ target: match[1] ?? match[2], line: text.slice(0, match.index).split('\n').length });
  }
  return links;
}

/** Only mutable entry points/guides; never recurse into labs or pinned copies. */
export function documentationFiles(root = ROOT) {
  return [
    'README.md', 'README.zh-CN.md', 'AGENTS.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md',
    'benches/README.md', 'benches/contrib/README.md', 'scripts/README.md', 'skills/skillfit/SKILL.md', 'evidence/README.md',
    ...readdirSync(join(root, 'docs'), { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('audit-'))
      .map(entry => `docs/${entry.name}`),
  ];
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = documentationFiles(), errors = inspectDocumentation(ROOT, files);
  for (const error of errors) console.error(error);
  console.log(`Documentation: ${files.length} files, ${errors.length} broken local links/anchors.`);
  if (errors.length) process.exitCode = 1;
}
