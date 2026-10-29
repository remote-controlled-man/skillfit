import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { documentationFiles } from './check-docs.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * One owner per fact. A deduplicated fact is listed here so restating it elsewhere
 * fails the build instead of silently drifting back. Add a row when a fact gains a
 * single owner; `allow` is for pages that legitimately carry their own copy.
 */
const OWNED_FACTS = [
  {
    fact: 'the npm/source version boundary',
    owner: 'docs/README.md#choose-your-build',
    // Restatements were removed from metrics, evaluation-reports and architecture;
    // the entry READMEs and the standalone Skill keep their own wording on purpose.
    banned: [/beyond npm 0\.13\.1/],
    allow: [],
  },
  {
    fact: 'a superseded copy of the same page',
    owner: 'Git history',
    // The removed --base anchor-migration gate required these footers; nothing does now.
    banned: [/^(?:Previous|Earlier) source documentation:/m],
    allow: [],
  },
  {
    fact: 'missing usage never becomes zero',
    owner: 'docs/reference/metrics.md#non-goals-and-known-limitations',
    // The owner must keep stating it, so pages that link there stay honest.
    required: [/never becomes zero or final/],
    allow: [],
  },
];

const maintained = () => documentationFiles().filter(file => file !== 'docs/work/current.md' && file !== 'CHANGELOG.md');

test('each owned fact appears in prose only where it is allowed', () => {
  const pages = maintained();
  assert.ok(pages.includes('docs/README.md'), 'the entry page must stay discoverable');
  for (const entry of OWNED_FACTS) {
    for (const file of pages) {
      const text = readFileSync(join(ROOT, file), 'utf8');
      for (const pattern of entry.banned ?? []) {
        if (entry.allow.includes(file)) continue;
        assert.ok(!pattern.test(text),
          `${file} restates ${entry.fact}; link ${entry.owner} instead`);
      }
      for (const pattern of entry.required ?? []) {
        const ownerFile = entry.owner.split('#')[0];
        if (file !== ownerFile) continue;
        assert.match(text, pattern, `${ownerFile} must keep stating ${entry.fact}`);
      }
    }
  }
});

test('the limitation owner keeps the anchor other pages link to', () => {
  const metrics = readFileSync(join(ROOT, 'docs/reference/metrics.md'), 'utf8');
  assert.match(metrics, /^## Non-goals and known limitations$/m);
  for (const limit of [/Sampling remains unpinned/, /declarations do not prove validity/,
    /distinct from live/, /never becomes zero or final/]) {
    assert.match(metrics, limit, 'the five repeated limits must stay owned in one section');
  }
});

/**
 * The rows above only cover facts someone remembered to list, while copying is the
 * common contributor move, so this derives the check from the tree instead: a
 * sentence long enough to carry a claim must live in one page. Verbatim only -- a
 * paraphrased restatement still depends on review, which is why the version-neutral
 * wording rule exists separately.
 */
const CLAIM_LENGTH = 70;

const claims = file => readFileSync(join(ROOT, file), 'utf8')
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/^#{1,6} .*$/gm, ' ')
  .split(/(?<=[.!?。])\s+/)
  .map(raw => raw.replace(/\s+/g, ' ').replace(/[*_`]/g, '').trim())
  // A sentence carrying a link points at the owner, which is the compliant form;
  // many pages may point at one owner alike. Appending a link to dodge this is a
  // review matter, not a mechanical one.
  .filter(text => text.length >= CLAIM_LENGTH && !text.includes(']('));

test('no maintained page restates another page sentence for sentence', () => {
  const stated = new Map();
  for (const file of maintained()) {
    for (const claim of claims(file)) {
      if (!stated.has(claim)) stated.set(claim, new Set());
      stated.get(claim).add(file);
    }
  }
  const restated = [...stated]
    .filter(([, files]) => files.size > 1)
    .map(([claim, files]) => `${[...files].sort().join(' and ')} both state: "${claim.slice(0, 90)}"`);
  assert.deepEqual(restated, [],
    'one page owns each fact; link the owner instead of restating it');
});
