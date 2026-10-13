import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFrontmatter } from './frontmatter.js';

test('parses name and description', () => {
  const fields = parseFrontmatter('---\nname: demo\ndescription: does things\n---\nbody');
  assert.deepEqual(fields, { name: 'demo', description: 'does things' });
});

test('returns null without a closing fence or any frontmatter', () => {
  assert.equal(parseFrontmatter('---\nname: demo\n'), null);
  assert.equal(parseFrontmatter('no frontmatter here'), null);
});

test('handles CRLF line endings', () => {
  assert.equal(parseFrontmatter('---\r\nname: x\r\n---\r\n')?.name, 'x');
});

// The four cases below are the reason this module exists. doctor and install each had their own
// parser and disagreed on all four, so the same SKILL.md could pass `doctor` and be rejected by
// `install` — or validate with the two characters ">-" as its description.

test('tolerates a byte-order mark', () => {
  const fields = parseFrontmatter('\uFEFF---\nname: demo\ndescription: does things\n---\n');
  assert.deepEqual(fields, { name: 'demo', description: 'does things' });
});

test('tolerates trailing spaces after the opening fence', () => {
  const fields = parseFrontmatter('---   \nname: demo\ndescription: does things\n---\n');
  assert.deepEqual(fields, { name: 'demo', description: 'does things' });
});

test('unquotes single- and double-quoted scalars', () => {
  const fields = parseFrontmatter('---\nname: "demo skill"\ndescription: \'does things\'\n---\n');
  assert.equal(fields?.name, 'demo skill');
  assert.equal(fields?.description, 'does things');
});

test('joins a folded block scalar with spaces', () => {
  const fields = parseFrontmatter('---\nname: demo\ndescription: >\n  first line\n  second line\n---\n');
  assert.equal(fields?.description, 'first line second line');
});

test('keeps line breaks in a literal block scalar', () => {
  const fields = parseFrontmatter('---\nname: demo\ndescription: |\n  first line\n  second line\n---\n');
  assert.equal(fields?.description, 'first line\nsecond line');
});

test('handles chomping indicators, which both old parsers stored literally', () => {
  for (const indicator of ['>-', '|-', '>+', '|+']) {
    const fields = parseFrontmatter(`---\nname: demo\ndescription: ${indicator}\n  does things\n  across lines\n---\n`);
    assert.ok(
      fields?.description?.includes('does things'),
      `description: ${indicator} should be read as a block scalar, got ${JSON.stringify(fields?.description)}`,
    );
    assert.ok(
      !fields?.description?.includes(indicator),
      `the indicator itself must not end up in the value, got ${JSON.stringify(fields?.description)}`,
    );
  }
});

test('a key with no value is empty rather than absent', () => {
  const fields = parseFrontmatter('---\nname: demo\ndescription:\n---\n');
  assert.deepEqual(fields, { name: 'demo', description: '' });
});
