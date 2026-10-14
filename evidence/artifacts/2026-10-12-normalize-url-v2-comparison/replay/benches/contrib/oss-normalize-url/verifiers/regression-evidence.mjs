import assert from 'node:assert/strict';
import { cpSync, existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const bench = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function files(root, rel = '') { return readdirSync(join(root, rel), { withFileTypes: true }).flatMap(entry => {
  if (entry.name === '.git' || entry.name.startsWith('_')) return [];
  const child = rel ? `${rel}/${entry.name}` : entry.name;
  if (entry.isSymbolicLink()) return [];
  return entry.isDirectory() ? files(root, child) : entry.isFile() ? [child] : [];
}); }
export function testRun(root, tests, pattern) {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const reporter = pathToFileURL(join(bench, 'verifiers/test-reporter.mjs')).href;
  const result = spawnSync(process.execPath, ['--test', `--test-reporter=${reporter}`,
    ...(pattern ? [`--test-name-pattern=${pattern}`] : []), ...tests], { cwd: root, encoding: 'utf8', timeout: 5000, env });
  let evidence;
  try { evidence = JSON.parse(result.stdout.trim()); } catch { evidence = null; }
  if (evidence?.schemaVersion !== 1 || evidence?.kind !== 'node-test-evidence' || !evidence?.summary || !Array.isArray(evidence?.records)) evidence = null;
  const counts = evidence?.summary?.counts;
  const records = evidence?.records ?? [];
  return { completed: !result.error && result.signal == null && typeof result.status === 'number',
    passed: result.status === 0 && evidence?.summary?.success === true,
    tests: counts?.tests > 0 && records.some(row => row.registered && row.leaf),
    noSkips: counts?.skipped === 0 && counts?.todo === 0 && counts?.cancelled === 0,
    records, counts };
}

function caseWitnesses(submitted, original, reference) {
  if (!submitted.completed || !original.completed || !reference.completed) return [];
  const groups = result => {
    const map = new Map();
    for (const row of result.records.filter(row => row.registered && row.leaf && !row.skip && !row.todo)) {
      const key = JSON.stringify([row.file, row.path]);
      map.set(key, [...(map.get(key) ?? []), row]);
    }
    return map;
  };
  const [final, before, upstream] = [submitted, original, reference].map(groups);
  const witnesses = [];
  for (const [key, rows] of final) {
    const old = before.get(key); const ref = upstream.get(key);
    if (rows.length === 1 && old?.length === 1 && ref?.length === 1 && rows[0].pass &&
        !old[0].pass && old[0].failureType === 'testCodeFailure' && ref[0].pass) {
      witnesses.push({ file: rows[0].file, path: rows[0].path });
    }
  }
  return witnesses;
}

export function regressionEvidence(run, canonical, reference, source) {
  const candidates = files(run).filter(p => /(?:^|\/)[^/]+\.(?:test|spec)\.mjs$/.test(p) && !existsSync(join(canonical, p)));
  return candidates.map(p => {
    const final = testRun(run, [p]); const restored = mkdtempSync(join(tmpdir(), 'skillfit-lru-regression-'));
    try {
      cpSync(run, restored, { recursive: true, filter: file => !relative(run, file).split(/[\\/]/).some(s => s === '.git' || s.startsWith('_')) && !lstatSync(file).isSymbolicLink() });
      cpSync(join(canonical, source), join(restored, source));
      const original = testRun(restored, [p]);
      cpSync(join(reference, source), join(restored, source));
      const upstream = testRun(restored, [p]);
      const witnesses = caseWitnesses(final, original, upstream);
      const targeted = [];
      // An unrelated test can exhaust the whole original/reference suite's guard. Never use that
      // timeout as evidence: replay a unique candidate alone on all three sides instead.
      if (final.completed && final.passed && final.tests && final.noSkips &&
          (!original.completed || !upstream.completed)) {
        const candidates = final.records.filter(row => row.registered && row.leaf && row.pass && !row.skip && !row.todo);
        // Two targeted candidates keep the whole verifier within its 60-second guard.
        for (const row of candidates.slice(0, 2)) {
          const flat = row.path.join(' ');
          if (candidates.filter(other => other.path.join(' ') === flat).length !== 1) continue;
          const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const prefixes = row.path.map((_, i) => escape(row.path.slice(0, i + 1).join(' ')));
          const pattern = `^(?:${prefixes.join('|')})$`;
          const submittedCase = testRun(run, [p], pattern);
          cpSync(join(canonical, source), join(restored, source));
          const originalCase = testRun(restored, [p], pattern);
          cpSync(join(reference, source), join(restored, source));
          const referenceCase = testRun(restored, [p], pattern);
          const matched = caseWitnesses(submittedCase, originalCase, referenceCase).filter(w =>
            w.file === row.file && JSON.stringify(w.path) === JSON.stringify(row.path));
          targeted.push({ file: row.file, path: row.path, completed: [submittedCase.completed, originalCase.completed, referenceCase.completed],
            witnesses: matched });
          if (submittedCase.passed && matched.length > 0) { witnesses.push(...matched); break; }
        }
      }
      return { path: p, finalPassed: final.completed && final.passed && final.tests && final.noSkips,
        originalFailed: original.completed && !original.passed && original.tests && original.noSkips,
        referencePassed: upstream.completed && upstream.passed && upstream.tests && upstream.noSkips,
        caseWitnesses: witnesses, targeted,
        counts: { submitted: final.counts, original: original.counts, reference: upstream.counts } };
    } finally { rmSync(restored, { recursive: true, force: true }); }
  });
}

