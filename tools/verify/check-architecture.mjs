import { readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const DIST = fileURLToPath(new URL('../../dist', import.meta.url));
const SOURCE = fileURLToPath(new URL('../../src', import.meta.url));
export function readArchitecturePolicy() { return JSON.parse(readFileSync(new URL('./architecture-policy.json', import.meta.url), 'utf8')); }

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

/** Preserve type-only edges without adding them to the emitted runtime graph. */
export function dependencyEdges(source, filename = 'module.ts') {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const edges = [], add = (specifier, kind) => edges.push({ specifier, kind });
  const visit = node => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const value = node.moduleSpecifier;
      if (value && ts.isStringLiteral(value)) {
        const clause = ts.isImportDeclaration(node) ? node.importClause : node;
        const named = ts.isImportDeclaration(node) ? clause?.namedBindings : node.exportClause;
        const elements = named && 'elements' in named ? named.elements : [];
        const onlyTypes = clause?.isTypeOnly || (!clause?.name && elements.length > 0 && elements.every(e => e.isTypeOnly));
        add(value.text, onlyTypes ? 'type' : 'runtime');
        if (!onlyTypes && elements.some(e => e.isTypeOnly)) add(value.text, 'type');
      }
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) add(node.argument.literal.text, 'type');
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const value = node.arguments[0];
      if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) add(value.text, 'runtime');
    }
    ts.forEachChild(node, visit);
  };
  visit(file); return edges;
}

function sourceContext(source) {
  const name = '/architecture-input.ts';
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true);
  const host = { getSourceFile: path => path === name ? file : undefined, getDefaultLibFileName: () => '',
    writeFile() {}, getCurrentDirectory: () => '/', getDirectories: () => [], fileExists: path => path === name,
    readFile: path => path === name ? source : undefined, getCanonicalFileName: path => path,
    useCaseSensitiveFileNames: () => true, getNewLine: () => '\n' };
  const checker = ts.createProgram([name], { noLib: true, noResolve: true }, host).getTypeChecker();
  const declaration = node => checker.getSymbolAtLocation(node)?.declarations?.[0];
  const moduleName = node => { while (node && !ts.isImportDeclaration(node)) node = node.parent; return node?.moduleSpecifier?.text; };
  const member = (root, name) => root && name ? `${root}.${name}` : null;
  const nameOf = node => node && (ts.isIdentifier(node) || ts.isStringLiteral(node)) ? node.text : null;
  const canonical = value => value?.replace(/^(?:globalThis|global)\./, '').replace(/^node:(process|console)(?:\.default)?(?=\.|$)/, '$1');
  const binding = (node, seen) => {
    const pattern = node.parent, owner = pattern.parent;
    const root = ts.isVariableDeclaration(owner) ? capability(owner.initializer, seen)
      : ts.isBindingElement(owner) ? binding(owner, seen) : null;
    return member(root, nameOf(node.propertyName ?? node.name));
  };
  const capability = (node, seen = new Set()) => {
    if (!node) return null;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isTypeAssertionExpression(node)) return capability(node.expression, seen);
    if (ts.isPropertyAccessExpression(node)) return canonical(member(capability(node.expression, seen), node.name.text));
    if (ts.isElementAccessExpression(node)) return canonical(member(capability(node.expression, seen), nameOf(node.argumentExpression)));
    if (!ts.isIdentifier(node)) return null;
    const decl = declaration(node);
    if (!decl) return ['process', 'console', 'Math', 'Date', 'performance', 'globalThis', 'global', 'crypto'].includes(node.text) ? node.text : null;
    if (seen.has(decl)) return null;
    seen = new Set(seen).add(decl);
    if (ts.isImportSpecifier(decl)) return canonical(member(moduleName(decl), (decl.propertyName ?? decl.name).text));
    if (ts.isNamespaceImport(decl) || ts.isImportClause(decl)) return canonical(moduleName(decl));
    if (ts.isBindingElement(decl)) return canonical(binding(decl, seen));
    if (ts.isVariableDeclaration(decl) && (decl.parent.flags & ts.NodeFlags.Const)) return canonical(capability(decl.initializer, seen));
    return null;
  };
  const finite = (node, seen = new Set()) => {
    if (!node) return null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return finite(node.expression, seen);
    if (ts.isConditionalExpression(node)) {
      const left = finite(node.whenTrue, seen), right = finite(node.whenFalse, seen);
      return left && right ? [...new Set([...left, ...right])] : null;
    }
    if (ts.isIdentifier(node)) {
      const decl = declaration(node);
      if (!decl || seen.has(decl) || !ts.isVariableDeclaration(decl) || !(decl.parent.flags & ts.NodeFlags.Const)) return null;
      return finite(decl.initializer, new Set(seen).add(decl));
    }
    return null;
  };
  return { file, capability, finite };
}

const IO_MODULES = /^(?:fs(?:\/promises)?|child_process|cluster|worker_threads|net|http|https|http2|tls|dns(?:\/promises)?|dgram|readline(?:\/promises)?|tty|os|process|console|perf_hooks)$/;
function effectErrors(source, filename, mode) {
  const errors = new Set(), { file, capability } = sourceContext(source);
  const reject = label => errors.add(`${filename}: forbidden ${mode} effect ${label}.`);
  for (const edge of dependencyEdges(source, filename)) if (edge.kind === 'runtime') {
    const name = edge.specifier.replace(/^node:/, '');
    if (mode === 'pure' && IO_MODULES.test(name)) reject(`Node I/O import ${edge.specifier}`);
    if (mode === 'application' && /^(?:readline(?:\/promises)?|tty)$/.test(name)) reject(`interactive import ${edge.specifier}`);
  }
  const visit = node => {
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node) || ts.isIdentifier(node)) {
      const value = capability(node);
      if (mode === 'pure' && /^process\.(?:env|argv|platform|arch|version|versions)(?:\.|$)/.test(value ?? '')) reject(value);
      if (['application', 'hostless'].includes(mode) && value === 'process.exitCode') reject(value);
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const value = capability(node.expression) ?? '';
      if (mode === 'hostless' && /^process\.(?:on|once|addListener|prependListener|prependOnceListener|removeListener|off|removeAllListeners)$/.test(value)) reject(value);
      if (/^console\./.test(value) || /^process\.(?:exit|stdout\.write|stderr\.write)$/.test(value)) reject(value);
      if (mode === 'pure' && (/^(?:Date\.now|Math\.random|performance\.now|process\.(?:hrtime(?:\.bigint)?|cwd|uptime|memoryUsage|cpuUsage))$/.test(value) ||
        /^(?:node:crypto\.(?:randomUUID|randomBytes|randomFill|randomFillSync|randomInt)|crypto\.(?:getRandomValues|randomUUID))$/.test(value) ||
        (value === 'Date' && (ts.isCallExpression(node) || !node.arguments?.length)))) reject(value);
    }
    ts.forEachChild(node, visit);
  };
  visit(file); return [...errors];
}

function declaredDynamicEdges(source, filename, policy) {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const edges = [], errors = [], used = new Set(); let context;
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const value = node.arguments[0];
      if (!value || !(ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) {
        const expression = value?.getText(file) ?? '';
        const declarations = (policy?.dynamicImports ?? []).filter(row => row.from === filename && row.expression === expression);
        if (declarations.length !== 1) errors.push(`${filename}: computed dynamic import ${expression} requires one finite-target declaration.`);
        else {
          const declaration = declarations[0]; used.add(declaration);
          context ??= sourceContext(source);
          // Use the context's own nodes so local symbols and lexical shadows resolve correctly.
          let candidate;
          const find = current => {
            if (ts.isCallExpression(current) && current.expression.kind === ts.SyntaxKind.ImportKeyword &&
              current.arguments[0]?.pos === value?.pos) candidate = current.arguments[0];
            ts.forEachChild(current, find);
          };
          find(context.file);
          const finite = context.finite(candidate), targets = declaration.targets;
          if (!finite || !Array.isArray(targets) || !targets.length || targets.some(t => typeof t !== 'string' || !t.startsWith('.')) ||
            new Set(targets).size !== targets.length || JSON.stringify([...finite].sort()) !== JSON.stringify([...targets].sort())) {
            errors.push(`${filename}: dynamic import ${expression} must have a verified finite target set matching its declaration.`);
          } else for (const specifier of targets) edges.push({ specifier, kind: 'runtime' });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return { edges, errors, used };
}

function policyErrors(policy, files) {
  const errors = [], clean = value => typeof value === 'string' && value.length > 0;
  const path = value => clean(value) && value.endsWith('.js') && !value.startsWith('/') && !value.includes('\\') &&
    !value.split('/').some(part => !part || part === '.' || part === '..' || /[*?]/.test(part));
  if (policy?.schemaVersion !== 1 || !policy.roles || typeof policy.roles !== 'object' || Array.isArray(policy.roles) || !Array.isArray(policy.modules) ||
    !Array.isArray(policy.exceptions) || !Array.isArray(policy.dynamicImports)) return ['Invalid architecture policy schema.'];
  for (const [role, value] of Object.entries(policy.roles)) {
    if (!value || typeof value !== 'object') { errors.push(`${role}: invalid role definition.`); continue; }
    for (const kind of ['runtime', 'type']) if (!Array.isArray(value[kind]) || value[kind].some(target => !policy.roles[target])) errors.push(`${role}: invalid ${kind} dependency roles.`);
    if (value.effects !== undefined && !['none', 'pure', 'application'].includes(value.effects)) errors.push(`${role}: invalid effect rule.`);
  }
  for (const row of policy.modules) {
    if (!row || !policy.roles[row.role] || (row.files !== undefined) === (row.prefix !== undefined) ||
      (row.files !== undefined && (!Array.isArray(row.files) || !row.files.length || row.files.some(file => !path(file) || !files.has(file)))) ||
      (row.prefix !== undefined && (!clean(row.prefix) || !row.prefix.endsWith('/') || row.prefix.includes('..') || /[\\*?]/.test(row.prefix)))) errors.push(`Invalid module registration: ${JSON.stringify(row)}.`);
  }
  const keys = new Set();
  for (const row of policy.exceptions) {
    if (!row || typeof row !== 'object') { errors.push('Invalid exception row.'); continue; }
    const key = `${row.from}:${row.to}:${row.kind}`;
    if (!path(row.from) || !path(row.to) || !files.has(row.from) || !files.has(row.to) || !['runtime', 'type'].includes(row.kind) ||
      !['reason', 'owner', 'removalTask'].every(name => clean(row[name])) || keys.has(key)) errors.push(`Invalid exception: ${key}; use exact existing files, kind, reason, owner and removalTask.`);
    if (policy.migratedFiles?.includes(row.from)) errors.push(`${row.from}: migrated modules cannot retain an exception.`);
    keys.add(key);
  }
  for (const row of policy.dynamicImports) if (!row || !path(row.from) || !files.has(row.from) || !clean(row.expression) || !Array.isArray(row.targets) || !row.targets.length) errors.push('Invalid finite dynamic import declaration.');
  for (const file of policy.migratedFiles ?? []) if (!path(file) || !files.has(file)) errors.push(`Invalid migrated module: ${file}.`);
  return errors;
}

function roleErrors(files, { policy, sources = new Map() }) {
  const errors = [], roles = new Map();
  const usedExceptions = new Set();
  for (const file of files.keys()) {
    const matches = policy.modules.filter(row => row.files?.includes(file) || (typeof row.prefix === 'string' && file.startsWith(row.prefix)));
    if (matches.length !== 1 || !policy.roles[matches[0]?.role]) errors.push(`${file}: expected one known architecture role, found ${matches.length}.`);
    else roles.set(file, matches[0].role);
  }
  for (const [file, source] of files) {
    const mode = policy.roles[roles.get(file)]?.effects;
    if (mode && mode !== 'none') errors.push(...effectErrors(sources.get(file.replace(/\.js$/, '.ts')) ?? source, file, mode));
  }
  const check = (file, edge) => {
    if (!edge.specifier.startsWith('.')) return;
    const target = posix.normalize(posix.join(posix.dirname(file), edge.specifier));
    if (!files.has(target)) { errors.push(`${file}: unresolved ${edge.kind} dependency ${target}.`); return; }
    const fromRole = roles.get(file), toRole = roles.get(target);
    if (fromRole && toRole && !policy.roles[fromRole][edge.kind]?.includes(toRole)) {
      const exception = policy.exceptions.find(row => row.from === file && row.to === target && row.kind === edge.kind);
      if (exception) usedExceptions.add(exception);
      else errors.push(`${file}: forbidden ${edge.kind} dependency ${target} (${fromRole} -> ${toRole}).`);
    }
  };
  const dynamicUsed = new Set();
  for (const [file, source] of files) {
    const dynamic = declaredDynamicEdges(source, file, policy);
    errors.push(...dynamic.errors); for (const row of dynamic.used) dynamicUsed.add(row);
    for (const edge of [...dependencyEdges(source, file), ...dynamic.edges]) check(file, edge);
  }
  for (const declaration of policy.dynamicImports ?? []) if (!dynamicUsed.has(declaration)) errors.push(`${declaration.from}: stale dynamic import declaration ${declaration.expression}.`);
  if (sources.size) for (const file of files.keys()) if (!sources.has(file.replace(/\.js$/, '.ts'))) errors.push(`${file}: compiled module has no active source; rebuild and remove stale output explicitly.`);
  for (const [file, source] of sources) {
    const runtime = file.replace(/\.tsx?$/, '.js');
    if (!files.has(runtime)) errors.push(`${file}: source has no compiled module; build before checking architecture.`);
    for (const edge of dependencyEdges(source, file).filter(e => e.kind === 'type')) check(runtime, edge);
  }
  for (const exception of policy.exceptions) if (!usedExceptions.has(exception)) errors.push(`${exception.from}: stale exception for ${exception.kind} ${exception.to}.`);
  return errors;
}

/** Business ownership complements technical roles; a newly public interface is an explicit choice. */
function businessErrors(files, { policy, sources = new Map() }) {
  const modules = policy.businessModules;
  if (!modules) return []; // Small role-check fixtures intentionally exercise only technical roles.
  const errors = [], owners = new Map();
  for (const [name, rule] of Object.entries(modules)) {
    if (!Array.isArray(rule.dependencies) || rule.dependencies.some(dep => !modules[dep]) ||
        !Array.isArray(rule.publicFiles) || rule.publicFiles.some(file => !files.has(file))) {
      errors.push(`${name}: invalid business interface registration.`);
    }
  }
  for (const file of files.keys()) {
    const matches = Object.entries(modules).filter(([, rule]) => rule.files?.includes(file) || rule.prefixes?.some(prefix => file.startsWith(prefix)));
    if (matches.length !== 1) errors.push(`${file}: expected one business owner, found ${matches.length}.`);
    else owners.set(file, matches[0][0]);
  }
  for (const [file, emitted] of files) {
    const owner = owners.get(file), rule = modules[owner];
    if (!rule) continue;
    const source = sources.get(file.replace(/\.js$/, '.ts')) ?? emitted;
    for (const edge of dependencyEdges(source, file)) {
      if (!edge.specifier.startsWith('.')) continue;
      const target = posix.normalize(posix.join(posix.dirname(file), edge.specifier)), targetOwner = owners.get(target);
      if (!targetOwner || targetOwner === owner) continue;
      if (!rule.dependencies.includes(targetOwner)) errors.push(`${file}: forbidden business dependency ${target} (${owner} -> ${targetOwner}).`);
      else if (owner !== 'compatibility' && !modules[targetOwner].publicFiles.includes(target)) errors.push(`${file}: private module ${target}; use ${targetOwner}'s caller interface.`);
    }
    if (owner === 'shared') errors.push(...effectErrors(source, file, 'hostless'));
    if (['resources', 'evaluation', 'usage'].includes(owner)) {
      const { file: ast, capability } = sourceContext(source);
      const visit = node => {
        if (owner === 'resources' && ts.isCallExpression(node) && /^node:fs(?:\/promises)?\.(?:write|append|mkdir|mkdtemp|cp|copyFile|rename|rm|rmdir|unlink|chmod|chown|truncate|symlink|link|open)/.test(capability(node.expression) ?? '')) {
          errors.push(`${file}: read-only Resource cannot mutate files.`);
        }
        if (['evaluation', 'usage'].includes(owner) && (ts.isPropertyAccessExpression(node) && node.name.text === 'wireShape' || ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression) && node.argumentExpression.text === 'wireShape')) {
          errors.push(`${file}: vendor observation wireShape belongs to Agents.`);
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
    if (owner === 'compatibility') {
      const ast = ts.createSourceFile(file, emitted, ts.ScriptTarget.Latest, true);
      if (ast.statements.some(node => !ts.isExportDeclaration(node))) errors.push(`${file}: compatibility entry must only delegate exports.`);
    }
  }
  return errors;
}

export function architectureErrors(files, options) {
  if (options) { const invalid = policyErrors(options.policy, files); if (invalid.length) return invalid; }
  const graph = new Map(), errors = [];
  for (const [file, source] of files) {
    const imports = [...runtimeImports(source), ...(options ? declaredDynamicEdges(source, file, options.policy).edges.map(edge => edge.specifier) : [])];
    const edges = imports.map(target => posix.normalize(posix.join(posix.dirname(file), target)))
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
  return options ? errors.concat(roleErrors(files, options), businessErrors(files, options)) : errors;
}

/** Test modules are not runtime edges; they are scanned only by the interface rule below. */
export function testModules(root = DIST) {
  const files = new Map();
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.endsWith('.test.js')) {
        files.set(relative(root, path).split(sep).join('/'), readFileSync(path, 'utf8'));
      }
    }
  };
  walk(root); return files;
}

/**
 * A test may reach into the module it belongs to, but must cross every other module
 * through that module's declared interface. Dependency direction is deliberately not
 * enforced here: a test legitimately exercises a module from outside its production
 * dependency graph, and forcing the direction would push integration tests into
 * whichever module happens to sit lowest. A test with no subject module inherits no
 * owner, so every module it touches must be public; registering it records the scope
 * gap without exempting its imports. Recorded debt is reported rather than silently
 * skipped, and a row that stops matching a live violation fails the build, so the
 * list can only shrink.
 */
export function testInterfaceErrors(tests, prodFiles, policy) {
  const modules = policy.businessModules;
  if (!modules) return { errors: [], debts: 0, unowned: 0 }; // Role-check fixtures carry no business owners.
  const ownerOf = file => {
    const matches = Object.entries(modules).filter(([, rule]) => rule.files?.includes(file) || rule.prefixes?.some(prefix => file.startsWith(prefix)));
    return matches.length === 1 ? matches[0][0] : null;
  };
  const hits = [];
  for (const [file, source] of tests) {
    // Ownership comes from the module under test, not from the test's own path, so a
    // test filed beside the wrong module is still judged against the right interface.
    const own = ownerOf(file.replace(/\.test\.js$/, '.js'));
    if (!own) hits.push({ from: file, to: null });
    for (const edge of dependencyEdges(source, file)) {
      if (!edge.specifier.startsWith('.')) continue;
      const target = posix.normalize(posix.join(posix.dirname(file), edge.specifier));
      if (!prodFiles.has(target)) continue;
      const targetOwner = ownerOf(target);
      // Compatibility entries are re-export shims with no public files of their own;
      // importing one is importing the real interface by its stable replay path.
      if (!targetOwner || targetOwner === own || targetOwner === 'compatibility') continue;
      if (!modules[targetOwner].publicFiles.includes(target)) hits.push({ from: file, to: target });
    }
  }
  const debts = new Map((policy.testInterface?.debts ?? []).map(row => [`${row.from}->${row.to}`, row]));
  const unowned = new Map((policy.testInterface?.unowned ?? []).map(row => [row.file, row]));
  const errors = [];
  let liveDebts = 0, liveUnowned = 0;
  for (const hit of hits) {
    if (hit.to === null) {
      liveUnowned++;
      if (!unowned.has(hit.from)) errors.push(`${hit.from}: test has no subject module to inherit an owner from; register it under testInterface.unowned with a reason, owner and removalTask.`);
      else unowned.delete(hit.from);
      continue;
    }
    const key = `${hit.from}->${hit.to}`;
    if (!debts.has(key)) errors.push(`${hit.from}: crosses into private ${hit.to}; use that module's public interface, or record the debt with reason, owner and removalTask.`);
    else { liveDebts++; debts.delete(key); }
  }
  for (const [key, row] of debts) errors.push(`${row.from}: stale test-interface debt for ${row.to}; the violation is gone, remove the row.`);
  for (const [file, row] of unowned) errors.push(`${file}: stale unowned-test entry (${row.reason}); the test now has a subject module, remove the row.`);
  return { errors, debts: liveDebts, unowned: liveUnowned };
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

/** Read active source only; frozen replay copies and private workspaces never enter this graph. */
export function sourceModules(root = SOURCE) {
  const files = new Map();
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        files.set(relative(root, path).split(sep).join('/'), readFileSync(path, 'utf8'));
      }
    }
  };
  walk(root); return files;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const modules = compiledModules(), sources = sourceModules(), policy = readArchitecturePolicy();
  const errors = architectureErrors(modules, { policy, sources });
  const tests = testModules(), interfaces = testInterfaceErrors(tests, modules, policy);
  errors.push(...interfaces.errors);
  for (const error of errors) console.error(error);
  console.log(`Architecture: ${modules.size} active modules, ${sources.size} source modules, ${tests.size} test modules, ${errors.length} violations; ${policy.exceptions.length} owned legacy exception(s), ${interfaces.debts} test-interface debt(s), ${interfaces.unowned} unowned test(s).`);
  for (const row of policy.exceptions) console.log(`DEBT ${row.from} -> ${row.to} (${row.kind}): ${row.reason} Owner: ${row.owner}; remove by: ${row.removalTask}.`);
  for (const row of policy.testInterface?.debts ?? []) console.log(`DEBT(test) ${row.from} -> ${row.to}: ${row.reason} Owner: ${row.owner}; remove by: ${row.removalTask}.`);
  for (const row of policy.testInterface?.unowned ?? []) console.log(`DEBT(test-scope) ${row.file}: ${row.reason} Owner: ${row.owner}; remove by: ${row.removalTask}.`);
  if (errors.length) process.exitCode = 1;
}
