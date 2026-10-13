import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { renderReceipts, runReport, type ReportOptions } from './report.js';
import type { AgentReceipt } from '../harness/receipts.js';

function fixtureReceipts(): AgentReceipt[] {
  return [
    {
      agentId: 'kimi-code',
      sessionsDir: '/home/x/.kimi-code/sessions',
      present: true,
      sessionsFound: 5,
      transcriptsRead: 5,
      skills: [
        { name: 'diagnosing-bugs', fires: 4, sessionCount: 3, lastSeen: Date.parse('2026-09-19T00:00:00Z') },
        { name: 'tdd', fires: 1, sessionCount: 1, lastSeen: Date.parse('2026-09-10T00:00:00Z') },
      ],
      installed: ['alpha', 'beta', 'diagnosing-bugs', 'tdd'],
      installedCount: 4,
      neverFired: ['alpha', 'beta'],
      tax: {
        descTokensTotal: 420,
        bodyTokensMedian: 1600,
        heaviest: [{ name: 'diagnosing-bugs', descTokens: 90 }],
      },
    },
    {
      agentId: 'codex',
      sessionsDir: '',
      present: false,
      sessionsFound: 0,
      transcriptsRead: 0,
      skills: [],
      installed: [],
      installedCount: 0,
      neverFired: [],
      tax: { descTokensTotal: 0, bodyTokensMedian: 0, heaviest: [] },
    },
  ];
}

test('renderReceipts renders the table, counts, and never-fired list', () => {
  const output = renderReceipts(fixtureReceipts());
  assert.match(output, /skillfit report — skill usage receipts/);
  assert.match(output, /kimi-code — 5 session\(s\), 5 transcript\(s\)/);
  assert.match(output, /diagnosing-bugs\s+4\s+3\s+2026-09-19/);
  assert.match(output, /installed: 4, observed firing: 2, no observed fire: 2/);
  assert.match(output, /no observed fire in retained history: alpha, beta/);
  assert.match(output, /codex: skipped — no verified skill-invocation signal/);
  assert.match(output, /Overall: 4 installed skill\(s\), 2 observed firing, 2 with no observed fire in retained history/);
  assert.match(output, /catalog size \(raw estimate\): ~420 description tokens before agent-side limits, truncation, or omission; median skill body ~1,600 tokens when fired; heaviest: diagnosing-bugs \(90 tok\)/);
  assert.match(output, /prioritization signal, not proof of uselessness/);
});

test('renderReceipts counts each skill once across agents in the Overall line', () => {
  const receipts = fixtureReceipts();
  // The same four skills installed for a second agent. `installed` was already deduped across
  // agents while `fired` and `never` summed per agent, so the three figures stopped describing one
  // population and no longer added up.
  receipts.push({
    agentId: 'claude-code',
    sessionsDir: '/home/x/.claude/projects',
    present: true,
    sessionsFound: 2,
    transcriptsRead: 2,
    skills: [
      { name: 'diagnosing-bugs', fires: 3, sessionCount: 2, lastSeen: Date.parse('2026-09-20T00:00:00Z') },
    ],
    installed: ['alpha', 'beta', 'diagnosing-bugs', 'tdd'],
    installedCount: 4,
    neverFired: ['alpha', 'beta', 'tdd'],
    tax: { descTokensTotal: 420, bodyTokensMedian: 1600, heaviest: [] },
  });
  const output = renderReceipts(receipts);
  // Four distinct skills; two fired in at least one agent; two have no observed fire. The per-agent
  // lines still report per-agent counts — only the Overall line is a single deduped population.
  assert.match(output, /Overall: 4 installed skill\(s\), 2 observed firing, 2 with no observed fire in retained history/);
  assert.match(output, /installed: 4, observed firing: 2, no observed fire: 2/);
});

test('renderReceipts handles agents without history and without sessions config', () => {
  const output = renderReceipts([
    {
      agentId: 'claude-code',
      sessionsDir: '/nope',
      present: false,
      sessionsFound: 0,
      transcriptsRead: 0,
      skills: [],
      installed: ['x', 'y'],
      installedCount: 2,
      neverFired: ['x', 'y'],
      tax: { descTokensTotal: 0, bodyTokensMedian: 0, heaviest: [] },
    },
  ]);
  assert.match(output, /no session history found/);
  assert.match(output, /2 skill\(s\) installed; nothing measured/);
});

test('runReport prints JSON when asked', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-report-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const lines: string[] = [];
  const options: ReportOptions = {
    agent: 'kimi-code',
    json: true,
    homeDir: dir,
    log: (msg) => lines.push(msg),
  };
  const receipts = await runReport(options);
  assert.equal(receipts.length, 1);
  assert.doesNotThrow(() => JSON.parse(lines.join('\n')));
});
