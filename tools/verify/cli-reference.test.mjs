import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CLI_OPTIONS, USAGE } from '../../dist/cli/definition.js';
import { cliReference, withCliReference } from './cli-reference.mjs';

test('CLI reference derives real help descriptions without inferring semantic types', () => {
  const text = cliReference();
  assert.ok(text.includes('| `--trials <n>` | Repetitions per condition for eval (integer 1–20; default: 5) |'));
  assert.ok(text.includes('Also controls baseline calibration repetitions'));
  const { trials, ...missing } = CLI_OPTIONS;
  assert.throws(() => cliReference(USAGE, missing), /not declared/);
  assert.throws(() => cliReference(USAGE.replace('  --trials ', '  --unlisted ')), /exactly once/);
});

test('reference regeneration detects stale descriptions and refuses ambiguous markers', () => {
  const stale = '<!-- cli-reference:start -->\nstale\n<!-- cli-reference:end -->';
  const updated = withCliReference(stale);
  assert.notEqual(updated, stale); assert.equal(withCliReference(updated), updated);
  assert.throws(() => withCliReference(stale + stale), /exactly one/);
  assert.throws(() => withCliReference('no markers'), /exactly one/);
});

test('maintained CLI reference is current on the built inputs', () => {
  const text = readFileSync(new URL('../../docs/reference/eval-component.md', import.meta.url), 'utf8');
  assert.equal(text, withCliReference(text), 'Build, then run node tools/verify/cli-reference.mjs --write.');
});
