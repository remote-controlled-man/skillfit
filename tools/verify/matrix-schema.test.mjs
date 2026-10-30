import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = relative => JSON.parse(readFileSync(join(ROOT, relative), 'utf8'));

const SCHEMA = 'src/matrix/agents.schema.json', MATRIX = 'src/matrix/agents.json';

/** Keys whose value is one subschema, a named map of them, or a list of them. */
const SUBSCHEMA = new Set(['items', 'not', 'if', 'then', 'else', 'contains', 'propertyNames']);
const SUBSCHEMA_MAP = new Set(['properties', 'patternProperties', '$defs', 'definitions']);
const SUBSCHEMA_LIST = new Set(['anyOf', 'oneOf', 'allOf', 'prefixItems']);
const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', 'default', 'examples', 'deprecated', '$comment']);
const ASSERTIONS = new Set(['type', 'required', 'enum', 'const', 'minItems', 'maxItems', 'minLength', 'maxLength', 'format']);
const IMPLEMENTED = new Set(['$ref', 'additionalProperties', ...SUBSCHEMA, ...SUBSCHEMA_MAP, ...SUBSCHEMA_LIST, ...ANNOTATIONS, ...ASSERTIONS]);

/**
 * Every key the schema uses in a subschema position. Property names are excluded by
 * descending into `properties` values rather than its entries, so this enumerates
 * vocabulary, not data.
 */
export function schemaKeywords(schema) {
  const found = new Set();
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      found.add(key);
      if (SUBSCHEMA_MAP.has(key)) visit(Object.values(value));
      else if (SUBSCHEMA_LIST.has(key)) visit(value);
      else if (key === 'additionalProperties' && value && typeof value === 'object') visit(value);
      else if (SUBSCHEMA.has(key)) visit(value);
    }
  };
  visit(schema);
  return found;
}

const actualType = value => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
const typeMatches = (value, type) => {
  switch (type) {
    case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array': return Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'integer': return Number.isInteger(value);
    case 'boolean': return typeof value === 'boolean';
    case 'null': return value === null;
    default: throw new Error(`unsupported type keyword "${type}"`);
  }
};
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/**
 * Validate against the draft 2020-12 subset `agents.schema.json` actually uses, and
 * refuse any keyword outside it. A validator that silently ignored an unknown keyword
 * would be worse than no validator, because the matrix would look enforced; the throw
 * below and the keyword-coverage test are two independent guards against that.
 */
export function validate(data, schema) {
  const definition = ref => {
    const local = /^#\/\$defs\/([^/]+)$/.exec(ref);
    if (!local) throw new Error(`only local #/$defs pointers are supported; found "${ref}"`);
    const target = schema.$defs?.[local[1]];
    if (!target) throw new Error(`$ref "${ref}" has no definition`);
    return target;
  };
  const check = (value, node, path) => {
    for (const key of Object.keys(node)) if (!IMPLEMENTED.has(key)) throw new Error(`unsupported keyword "${key}" at ${path}`);
    if (node.$ref !== undefined) return check(value, definition(node.$ref), path);
    if (node.anyOf !== undefined) {
      const branches = node.anyOf.map(branch => check(value, branch, path));
      return branches.some(branch => !branch.length) ? []
        : [`${path}: matches none of ${branches.length} allowed shapes (${branches.map(branch => branch[0]).join(' | ')})`];
    }
    const errors = [];
    if (node.type !== undefined) {
      const types = Array.isArray(node.type) ? node.type : [node.type];
      if (!types.some(type => typeMatches(value, type))) return [`${path}: expected type ${types.join(' or ')}, found ${actualType(value)}`];
    }
    if (node.const !== undefined && !same(value, node.const)) errors.push(`${path}: expected the constant ${JSON.stringify(node.const)}, found ${JSON.stringify(value)}`);
    if (node.enum !== undefined && !node.enum.some(option => same(option, value))) errors.push(`${path}: expected one of ${node.enum.map(option => JSON.stringify(option)).join(', ')}; found ${JSON.stringify(value)}`);
    if (node.format !== undefined && node.format !== 'date-time') throw new Error(`unsupported format "${node.format}" at ${path}`);
    if (typeof value === 'string') {
      if (node.minLength !== undefined && value.length < node.minLength) errors.push(`${path}: shorter than minLength ${node.minLength}`);
      if (node.maxLength !== undefined && value.length > node.maxLength) errors.push(`${path}: longer than maxLength ${node.maxLength}`);
      if (node.format === 'date-time' && !Number.isFinite(Date.parse(value))) errors.push(`${path}: "${value}" is not a date-time`);
    }
    if (Array.isArray(value)) {
      if (node.minItems !== undefined && value.length < node.minItems) errors.push(`${path}: fewer than minItems ${node.minItems} item(s)`);
      if (node.maxItems !== undefined && value.length > node.maxItems) errors.push(`${path}: more than maxItems ${node.maxItems} item(s)`);
      if (node.items !== undefined) for (const [index, item] of value.entries()) errors.push(...check(item, node.items, `${path}[${index}]`));
    }
    if (actualType(value) === 'object') {
      for (const name of node.required ?? []) if (!(name in value)) errors.push(`${path}: missing required property "${name}"`);
      for (const [name, property] of Object.entries(value)) {
        const at = `${path}.${name}`;
        if (node.properties?.[name] !== undefined) errors.push(...check(property, node.properties[name], at));
        else if (node.additionalProperties === false) errors.push(`${at}: not an allowed property of ${path}`);
        else if (node.additionalProperties && typeof node.additionalProperties === 'object') errors.push(...check(property, node.additionalProperties, at));
      }
    }
    return errors;
  };
  return check(data, schema, '$');
}

test('the agent capability matrix satisfies its own published schema', () => {
  const errors = validate(read(MATRIX), read(SCHEMA));
  assert.deepEqual(errors, []);
  assert.ok(read(MATRIX).agents.length > 0);
});

test('the compiled matrix the runtime loads is the matrix the schema was checked against', () => {
  // tsc re-indents the JSON it copies for resolveJsonModule, so compare parsed values.
  assert.deepEqual(read('dist/matrix/agents.json'), read(MATRIX));
  assert.deepEqual(read('dist/matrix/agents.schema.json'), read(SCHEMA));
});

test('the validator implements every keyword the schema uses and every definition is reachable', () => {
  const schema = read(SCHEMA), keywords = schemaKeywords(schema);
  assert.deepEqual([...keywords].filter(key => !IMPLEMENTED.has(key)).sort(), [],
    'extend the validator before using a new keyword; an ignored keyword would pass silently');
  for (const expected of ['type', 'required', 'additionalProperties', '$ref', 'enum', 'anyOf', 'const', 'format', 'minItems', 'minLength']) {
    assert.ok(keywords.has(expected), `the schema uses ${expected}, so the keyword walk must see it`);
  }
  assert.ok(!keywords.has('displayName'), 'the walk must enumerate vocabulary, not property names');
  const referenced = new Set([...JSON.stringify(schema).matchAll(/"\$ref":"#\/\$defs\/([^"]+)"/g)].map(match => match[1]));
  assert.deepEqual(Object.keys(schema.$defs).filter(name => !referenced.has(name)), [],
    'a definition nothing references describes a shape the matrix is never checked against');
});

test('each schema rule rejects a matrix that breaks it', () => {
  const schema = read(SCHEMA);
  const breakMatrix = apply => { const copy = structuredClone(read(MATRIX)); apply(copy); return validate(copy, schema); };
  for (const [name, apply, expected] of [
    ['an unknown field on an agent', copy => { copy.agents[0].skillz = {}; }, /not an allowed property/],
    ['a missing required block', copy => { delete copy.agents[0].headless; }, /missing required property "headless"/],
    ['a wrong schemaVersion', copy => { copy.schemaVersion = 2; }, /expected the constant 1/],
    ['an out-of-vocabulary wireShape', copy => { copy.agents[0].sessions.wireShape = 'invented'; }, /expected one of/],
    ['an empty agent list', copy => { copy.agents = []; }, /fewer than minItems 1/],
    ['an empty agent id', copy => { copy.agents[0].id = ''; }, /shorter than minLength 1/],
    ['a non-date verifiedAt', copy => { copy.verifiedAt = 'yesterday'; }, /is not a date-time/],
    ['a non-string docs value', copy => { copy.agents[0].docs = { home: 42 }; }, /expected type string/],
    ['a bridge that is neither an object nor null', copy => { copy.agents[0].rules.agentsMdBridge = 'not-null'; }, /matches none of 2 allowed shapes/],
    ['a mistyped detect.binaries entry', copy => { copy.agents[0].detect.binaries = [7]; }, /\$\.agents\[0\]\.detect\.binaries\[0\]: expected type string/],
    ['an extra property inside detect', copy => { copy.agents[0].detect.containerFiles = []; }, /detect\.containerFiles: not an allowed property/],
    ['a session docs value that is neither string nor null', copy => { copy.agents[0].sessions.docs = 42; }, /expected type string or null, found number/],
  ]) {
    const errors = breakMatrix(apply);
    assert.ok(errors.some(error => expected.test(error)), `${name}: expected ${expected}, got ${JSON.stringify(errors)}`);
  }
});

test('a dangling pointer, a remote pointer or an unimplemented keyword fails loudly', () => {
  const schema = read(SCHEMA), matrix = read(MATRIX);
  const mutate = apply => { const copy = structuredClone(schema); apply(copy); return () => validate(matrix, copy); };
  assert.throws(mutate(copy => { copy.$defs.agent.properties.detect.$ref = '#/$defs/detective'; }), /has no definition/);
  assert.throws(mutate(copy => { copy.$defs.agent.properties.detect.$ref = 'https://example.com/detect.json'; }), /only local #\/\$defs pointers/);
  assert.throws(mutate(copy => { copy.$defs.agent.properties.id.pattern = '^[a-z-]+$'; }), /unsupported keyword "pattern"/);
  assert.throws(mutate(copy => { copy.$defs.agent.properties.id.format = 'hostname'; }), /unsupported format "hostname"/);
});
