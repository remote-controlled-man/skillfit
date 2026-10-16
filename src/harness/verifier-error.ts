import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { verdictFromOutput } from './verifier-summary.js';

function normalized(text: string): string {
  try { text = decodeURI(text); } catch { /* Plain diagnostic text need not be URI encoded. */ }
  text = text.replaceAll('\\', '/');
  return process.platform === 'win32' ? text.toLowerCase() : text;
}

function roots(path: string): string[] {
  const paths = [resolve(path)];
  try { paths.push(realpathSync(path)); } catch { /* Retain the declared path if it disappeared. */ }
  return [...new Set(paths.map(path => normalized(path).replace(/\/$/, '') + '/'))];
}

/** Explicit errors work for every runtime. Automatic detection is limited to
 * direct Node exceptions attributable to bench code, never arbitrary nonzero exits. */
export function verifierRuntimeError(output: string, exitCode: number | null, benchDir: string, runDir: string): string | null {
  for (const line of output.split('\n').reverse()) {
    let value;
    try { value = JSON.parse(line); } catch { continue; }
    if (!value || value.kind !== 'skillfit.verifier-error') continue;
    if (value.schemaVersion !== 1 || typeof value.message !== 'string' || !value.message.trim()) {
      return 'VERIFIER_PROTOCOL_ERROR: malformed skillfit.verifier-error message.';
    }
    return `VERIFIER_REPORTED_ERROR: ${value.message.slice(0, 4096)}`;
  }
  if (exitCode === null || exitCode === 0 || !/^Node\.js v\d+\.\d+/m.test(output)) return null;
  const errors = [...output.matchAll(/^(?:(?:Syntax|Reference|Type|Range|URI|Eval|Aggregate)?Error)(?: \[[^\]\n]+\])?:[^\n]*/gm)];
  const error = errors.at(-1);
  if (!error) return null; // AssertionError/test-runner failures keep their legacy verdict.
  const tail = output.slice(error.index!);
  if (verdictFromOutput(tail)) return null; // A wrapper deliberately graded its child's failure.
  const benchRoots = roots(benchDir), trialRoots = roots(runDir);
  // Syntax diagnostics put their source location before the error; other Node
  // exceptions put stack frames/requireStack/import origins after it.
  const before = output.slice(0, error.index).split('\n').slice(-8)
    .filter(line => /^(?:file:\/\/|[A-Za-z]:[\\/]|\/).*:\d+(?::\d+)?\s*$/.test(line));
  const diagnostic = tail.split('\n');
  // A grader may mention the trial directory in its own exception message.
  // Treat that message as a location only for a Node load/filesystem diagnostic.
  if (!/Cannot find |imported from |ENOENT|EACCES|ENOTDIR|EISDIR|Invalid package config/.test(diagnostic[0]!)) diagnostic.shift();
  for (const line of [...before.slice(-1), ...diagnostic]) {
    const text = normalized(line);
    if (trialRoots.some(root => text.includes(root))) return null;
    if (benchRoots.some(root => text.includes(root))) return `VERIFIER_RUNTIME_ERROR: ${error[0]}`;
  }
  return null; // An unattributed exit is not enough to invent an infrastructure error.
}
