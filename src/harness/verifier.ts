import { runProcess, type ProcessResult } from './process.js';
import { parseCommand } from './command.js';
import { verifierRuntimeError } from './verifier-error.js';
import { parseVerifierTimeoutSeconds } from './verifier-timeout.js';
export type { ProcessResult } from './process.js';

export async function runVerifier(benchDir: string, command: string, runDir: string, timeoutSeconds?: number): Promise<ProcessResult> {
  const timeoutMs = parseVerifierTimeoutSeconds(timeoutSeconds) * 1000;
  let tokens: string[];
  try { tokens = parseCommand(command); }
  catch (error) { return { exitCode: null, output: '', error: `VERIFIER_COMMAND_ERROR: ${(error as Error).message}` }; }
  const result = await runProcess(tokens[0]!, [...tokens.slice(1), runDir], benchDir, timeoutMs);
  return { ...result, error: result.error ?? verifierRuntimeError(result.output, result.exitCode, benchDir, runDir) };
}

export function verifierLogFor(result: ProcessResult): string {
  return result.error ? `${result.output}\n[${result.error}]` : result.output;
}

const SPAWN_FAILURE = /ENOENT|EINVAL|EACCES|EPERM/i;

/**
 * A verifier that produced no exit code gave no verdict, so the trial says nothing about the agent.
 * Reporting it as a failure would blame the model for a broken bench — and against a command-kind
 * NOP gate it would look like the failure the gate exists to require.
 */
export function verifierFailure(label: string, command: string, reason: string | null): string {
  const why = reason ?? 'no exit code';
  if (why.startsWith('VERIFIER_')) return `${label} failed (${why}): ${command}`;
  if (SPAWN_FAILURE.test(why)) {
    return `${label} could not be started (${why}): ${command} — it is spawned without a shell, so the first token must be an executable the OS can start directly ("node verifiers/x.mjs"); to grade with a shell command, wrap it via "bench add --freeze --verifier-cmd"`;
  }
  return `${label} produced no exit code (${why}): ${command}`;
}
