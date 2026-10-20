import { readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));

/** Parse emitted JS with the existing development compiler, not text/regex. */
export function runtimeImports(source) {
  const imports = [], file = ts.createSourceFile('runtime.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const visit = node => {
    let value;
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) value = node.moduleSpecifier;
    if (ts.isExportDeclaration(node) && !node.isTypeOnly) value = node.moduleSpecifier;
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) value = node.arguments[0];
    if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) && value.text.startsWith('.')) imports.push(value.text);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return imports;
}

export function architectureErrors(files) {
  const graph = new Map(), errors = [];
  for (const [file, source] of files) {
    const edges = runtimeImports(source).map(target => posix.normalize(posix.join(posix.dirname(file), target)))
      .filter(target => files.has(target));
    graph.set(file, edges);
    for (const target of edges) if ((file.startsWith('harness/') || file.startsWith('install/')) && target.startsWith('commands/')) {
      errors.push(`${file} imports command adapter ${target}`);
    }
  }
  const seen = new Set(), active = new Set(), path = [];
  const visit = file => {
    if (active.has(file)) { errors.push(`Runtime cycle: ${[...path.slice(path.indexOf(file)), file].join(' -> ')}`); return; }
    if (seen.has(file)) return;
    seen.add(file); active.add(file); path.push(file);
    for (const target of graph.get(file)) visit(target);
    path.pop(); active.delete(file);
  };
  for (const file of graph.keys()) visit(file);
  return errors;
}

/** Only active compiled modules; pinned evidence and tests are not runtime edges. */
export function compiledModules(root = DIST) {
  const files = new Map();
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
        files.set(relative(root, path).split(sep).join('/'), readFileSync(path, 'utf8'));
      }
    }
  };
  walk(root);
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const modules = compiledModules(), errors = architectureErrors(modules);
  for (const error of errors) console.error(error);
  console.log(`Architecture: ${modules.size} active modules, ${errors.length} dependency violations.`);
  if (errors.length) process.exitCode = 1;
}
