import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const GUIDE = 'docs/bench-authoring.md';
const READMES = ['README.md', 'README.zh-CN.md', 'README.ja.md', 'README.ko.md', 'README.es.md'];

function read(rel: string): string {
  return readFileSync(resolve(PACKAGE_ROOT, rel), 'utf8');
}

// AGENTS.md requires the five READMEs to mirror each other section by section. A link added to the
// English one and forgotten in four translations is the drift this pins: it already happened once, to
// the trigger-mode demo block.
test('the bench authoring guide is linked from every README and every entry point', () => {
  for (const readme of READMES) {
    assert.match(read(readme), /\(docs\/bench-authoring\.md\)/, `${readme} must link the guide`);
  }
  for (const doc of ['benches/README.md', 'benches/contrib/README.md', 'docs/metrics.md', 'CONTRIBUTING.md']) {
    assert.match(read(doc), /bench-authoring\.md\)/, `${doc} must link the guide`);
  }
});

test('bench-authoring.md carries all seven steps and both gates', () => {
  const guide = read(GUIDE);
  for (const step of [
    '### 1. Start from a real failure',
    '### 2. Freeze the scene, then shrink it',
    '### 3. Write the grader',
    '### 4. Or mine it from git history',
    '### 5. Write the trigger variant',
    '### 6. Label it, load it, and plant decoys',
    '### 7. Rehearse before you pay',
  ]) {
    assert.ok(guide.includes(step), `missing step heading: ${step}`);
  }
  assert.match(guide, /\*\*NOP\*\*/, 'the NOP gate must be named');
  assert.match(guide, /\*\*Oracle\*\*/, 'the oracle gate must be named');
});

// The guide describes gates that must actually exist, so each threshold it quotes is read back out of
// the source: changing a constant now breaks the doc's test instead of silently making the doc wrong.
test('bench-authoring.md quotes the thresholds the code enforces', () => {
  const guide = read(GUIDE);
  const benchSrc = read('src/commands/bench.ts');
  const reportSrc = read('src/harness/report.ts');
  const statsSrc = read('src/harness/stats.ts');

  const minFacets = /MIN_FACET_CHECKS = (\d+)/.exec(benchSrc)?.[1];
  const maxFacets = /MAX_FACET_CHECKS = (\d+)/.exec(benchSrc)?.[1];
  const controlTarget = /NEGATIVE_CONTROL_TARGET = ([\d.]+)/.exec(benchSrc)?.[1];
  const conclusiveTasks = /CONCLUSIVE_TASKS = (\d+)/.exec(reportSrc)?.[1];
  const conclusiveTrials = /CONCLUSIVE_TRIALS = (\d+)/.exec(reportSrc)?.[1];
  const minDiscordant = /MIN_DISCORDANT_FOR_SIGNIFICANCE = (\d+)/.exec(statsSrc)?.[1];
  const thresholds = { minFacets, maxFacets, controlTarget, conclusiveTasks, conclusiveTrials, minDiscordant };
  for (const [name, value] of Object.entries(thresholds)) {
    assert.ok(value !== undefined, `could not read ${name} out of the source`);
  }

  assert.ok(guide.includes(`${minFacets}–${maxFacets} checks`), 'facet-check range');
  assert.ok(guide.includes(`${Math.round(Number(controlTarget) * 100)}%`), 'negative-control target');
  assert.ok(guide.includes(`${conclusiveTasks} tasks × ${conclusiveTrials} trials`), 'conclusive bar');
  assert.ok(guide.includes(`${minDiscordant} discordant pairs`), 'significance floor');
});

test('every relative link in the guide resolves', () => {
  const guide = read(GUIDE);
  const base = dirname(resolve(PACKAGE_ROOT, GUIDE));
  const targets = [...guide.matchAll(/\]\(([^)#]+?)(?:#[^)]*)?\)/g)].map((match) => match[1] as string);
  assert.ok(targets.length >= 4, 'expected the guide to link the rest of the doc set');
  for (const target of targets) {
    if (/^https?:/.test(target)) continue;
    assert.ok(existsSync(resolve(base, target)), `broken link in ${GUIDE}: ${target}`);
  }
});
