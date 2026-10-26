import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import * as legacy from "./execution/paired.js";
import { runVerifier, verifierFailure, verifierLogFor } from "../bench/gates/verifier.js";
import { applyOverlay, createTrialWorkspace, engagementError, gitInit } from "./targets/workspace.js";
import { MOCK_MARKER_FILE } from '../bench/constants.js';

test('shared verifier and legacy runner exports are the same implementation and preserve failure classes', async t => {
  assert.equal(legacy.runVerifier, runVerifier);
  assert.equal(legacy.verifierFailure, verifierFailure);
  assert.equal(legacy.verifierLogFor, verifierLogFor);
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-shared-verifier-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, 'grade.mjs'), 'console.log(JSON.stringify({passed:false}));process.exit(7);');
  const failure = await runVerifier(dir, 'node grade.mjs', dir);
  assert.deepEqual(failure, { exitCode: 7, output: '{"passed":false}\n', error: null });
  const missing = await runVerifier(dir, 'skillfit-nonexistent-executable grade.mjs', dir);
  assert.equal(missing.exitCode, null); assert.match(missing.error!, /ENOENT/);
  assert.match(verifierFailure('oracle', 'missing', missing.error), /could not be started/);
  assert.match(verifierLogFor(missing), /ENOENT/);
});

test('workspace isolation preserves explicit marker policy, overlays, collisions and engagement rules', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'skillfit-shared-workspace-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const fixture = join(dir, 'fixture'), overlay = join(dir, 'overlay'), run = join(dir, 'run'), mock = join(dir, 'mock');
  mkdirSync(fixture); mkdirSync(overlay);
  writeFileSync(join(fixture, MOCK_MARKER_FILE), 'mock'); writeFileSync(join(fixture, 'answer.txt'), 'original');
  writeFileSync(join(overlay, 'answer.txt'), 'overlaid');
  createTrialWorkspace(fixture, run, { removeMockMarker: true });
  createTrialWorkspace(fixture, mock, { removeMockMarker: false });
  assert.equal(existsSync(join(run, MOCK_MARKER_FILE)), false);
  assert.equal(readFileSync(join(mock, MOCK_MARKER_FILE), 'utf8'), 'mock');
  applyOverlay(overlay, run);
  assert.equal(readFileSync(join(run, 'answer.txt'), 'utf8'), 'overlaid');
  assert.equal(readFileSync(join(fixture, 'answer.txt'), 'utf8'), 'original');
  assert.throws(() => createTrialWorkspace(fixture, run, { removeMockMarker: true }), /Run directory already exists/);
  assert.equal(legacy.gitInit, gitInit); assert.equal(legacy.engagementError, engagementError);
  assert.equal(await gitInit(run), true);
  writeFileSync(join(run, '_prompt.txt'), 'harness prompt');
  assert.match((await engagementError('', 'command', run, true))!, /engagement error/);
  writeFileSync(join(run, 'answer.txt'), 'agent edit');
  assert.equal(await engagementError('', 'command', run, true), null);
  assert.match((await engagementError('', 'output', run, true))!, /engagement error/);
});
