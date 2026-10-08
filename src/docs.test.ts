import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const GUIDE = 'docs/bench-authoring.md';
const READMES = ['README.md', 'README.zh-CN.md'];

function read(rel: string): string {
  return readFileSync(resolve(PACKAGE_ROOT, rel), 'utf8');
}

// AGENTS.md requires the English and Simplified Chinese READMEs to mirror each other section by
// section. A link added to one and forgotten in the other is the drift these checks prevent.
test('the bench authoring guide is linked from every README and every entry point', () => {
  for (const readme of READMES) {
    assert.match(read(readme), /\(docs\/bench-authoring\.md\)/, `${readme} must link the guide`);
  }
  for (const doc of ['benches/README.md', 'benches/contrib/README.md', 'docs/metrics.md', 'CONTRIBUTING.md']) {
    assert.match(read(doc), /bench-authoring\.md\)/, `${doc} must link the guide`);
  }
});

test('portable Codex setup is linked and its command block matches across README languages', () => {
  const normalized = (file: string) => read(file).replace(/\r\n/g, '\n');
  const english = normalized('README.md');
  const commandBlock = /```bash\nnode dist\/cli\.js bundle export \.\/personal-codex --dry-run[\s\S]*?node \.\/personal-codex\/setup\.mjs --yes\n```/.exec(english)?.[0];
  assert.ok(commandBlock);
  for (const readme of READMES) {
    const content = normalized(readme);
    assert.match(content, /\(docs\/portable-codex\.md\)/, `${readme} must link the portable setup guide`);
    assert.ok(content.includes(commandBlock), `${readme} must use the same setup commands`);
  }
});

test('selectable Codex setup commands match across README languages', () => {
  const normalized = (file: string) => read(file).replace(/\r\n/g, '\n');
  const english = normalized('README.md');
  const commandBlock = /```bash\nnode dist\/cli\.js setup codex --list[\s\S]*?node dist\/cli\.js setup codex --skill vibe-coding --skill diagnosing-bugs --yes\n```/.exec(english)?.[0];
  assert.ok(commandBlock);
  for (const readme of READMES) {
    const content = normalized(readme);
    assert.match(content, /\(docs\/selectable-codex\.md\)/, `${readme} must link the selectable setup guide`);
    assert.ok(content.includes(commandBlock), `${readme} must use the same selectable setup commands`);
  }
});

test('the first-run commands work in Bash and PowerShell and match across README languages', () => {
  const normalized = (file: string) => read(file).replace(/\r\n/g, '\n');
  const english = normalized('README.md');
  const commandBlock = /```bash\ngit clone https:\/\/github\.com\/remote-controlled-man\/skillfit\.git\ncd skillfit[\s\S]*?node dist\/cli\.js install --agent codex --dry-run\n```/.exec(english)?.[0];
  assert.ok(commandBlock);
  const commands = commandBlock.split('\n').slice(1, -1).join('\n');
  assert.doesNotMatch(commands, /\b(?:bash|cp)\s|~\/|some-skill|my-server\.probe\.json/);
  for (const readme of READMES) {
    const content = normalized(readme);
    assert.ok(content.includes(commandBlock), `${readme} must use the same first-run commands`);
    assert.match(content, /\(docs\/growth-roadmap-2026-10\.md\)/, `${readme} must link the delivery plan`);
  }
});

test('a read-only synthetic report is discoverable in every README language', () => {
  const normalized = (file: string) => read(file).replace(/\r\n/g, '\n');
  const commandBlock = '```bash\nnode dist/cli.js report eval docs/examples/eval-manifest.synthetic.json\n```';
  for (const readme of READMES) {
    const content = normalized(readme);
    assert.ok(content.includes(commandBlock), `${readme} must show the same runnable report example`);
    assert.match(content, /\(docs\/sharing-results\.md\)/, `${readme} must link the sharing guide`);
  }
  assert.ok(existsSync(resolve(PACKAGE_ROOT, 'docs/examples/eval-manifest.synthetic.json')));
  assert.ok(existsSync(resolve(PACKAGE_ROOT, 'docs/examples/bench-check.yml')));
});

test('the first real evaluation guide and its five-trial default are visible in every README language', () => {
  for (const readme of READMES) {
    const content = read(readme);
    assert.match(content, /\(docs\/first-real-eval\.md\)/, `${readme} must link the guide`);
    assert.match(content, /\*\*5\s*(?:trials|次|回|회|intentos)/, `${readme} must explain the default`);
  }
  const guide = read('docs/first-real-eval.md');
  assert.match(guide, /8 distinct tasks × 5 trials per condition/);
  assert.match(guide, /80 agent executions/);
  assert.match(guide, /already available globally/);
});

test('the evidence index links only to files present in a clean checkout', () => {
  const base = resolve(PACKAGE_ROOT, 'evidence');
  for (const [, target] of read('evidence/README.md').matchAll(/\]\(([^)#]+?)(?:#[^)]*)?\)/g)) {
    if (!target || /^https?:/.test(target)) continue;
    assert.ok(existsSync(resolve(base, target)), `broken evidence index link: ${target}`);
  }
});

test('rules and MCP evaluation tour stays present across README languages', () => {
  for (const [readme, figure, language, label] of [
    ['README.md', 'docs/assets/skillfit-flow.en.svg', 'en', 'Baseline'],
    ['README.zh-CN.md', 'docs/assets/skillfit-flow.zh-CN.svg', 'zh-CN', '基线组'],
  ] as const) {
    const content = read(readme).replace(/\r\n/g, '\n');
    assert.ok(content.includes('docs/assets/skillfit-mark.svg'), `${readme} must show the logo`);
    assert.ok(content.includes(figure), `${readme} must show its localized evidence loop`);
    const svg = read(figure);
    assert.ok(svg.includes(`lang="${language}"`), `${figure} must declare its language`);
    assert.ok(svg.includes(label), `${figure} must contain localized copy`);
    assert.ok(!/9\/20|16\/20/.test(svg), `${figure} must not imply unpublished evaluation results`);
    assert.match(content, /skillfit mcp check/, `${readme} must mention MCP preflight`);
    assert.match(content, /node dist\/cli\.js eval \.\/context7-experiment --bench \.\/my-context7-bench --agent codex --trials 5/, `${readme} must show config A\/B`);
    assert.match(content, /\(docs\/config-experiments\.md\)/, `${readme} must link the config experiment guide`);
    assert.match(content, /\| `mcp check <spec>` \|/, `${readme} must list the MCP command`);
    assert.match(content, /npm ci\nnpm run build\nnode dist\/cli\.js --help\nnode dist\/cli\.js bench check benches\/code-review/, `${readme} must provide an offline first run`);
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
