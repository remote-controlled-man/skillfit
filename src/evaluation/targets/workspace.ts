import { currentSignal } from '../../shared/cancellation.js';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runProcess } from "../../shared/process.js";
import { listFilesRecursive } from "../../shared/hash.js";
import { MOCK_MARKER_FILE } from '../../bench/constants.js';

/** Copy only the explicit fixture; the caller owns mode, installation and prompt policy. */
export function createTrialWorkspace(fixtureDir: string, runDir: string, options: { removeMockMarker: boolean }): void {
  if (existsSync(runDir)) throw new Error(`Run directory already exists: ${runDir}`);
  mkdirSync(runDir, { recursive: true });
  cpSync(fixtureDir, runDir, { recursive: true });
  if (options.removeMockMarker) rmSync(join(runDir, MOCK_MARKER_FILE), { force: true });
}

export function applyOverlay(overlayDir: string, runDir: string): void {
  for (const rel of listFilesRecursive(overlayDir)) {
    const destination = join(runDir, rel);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(overlayDir, rel), destination);
  }
}

export async function gitInit(dir: string): Promise<boolean> {
  const steps: string[][] = [
    ['init', '--quiet'],
    ['config', 'user.email', 'skillfit@example.invalid'],
    ['config', 'user.name', 'skillfit harness'],
    ['config', 'core.logAllRefUpdates', 'true'],
    ['add', '-A'],
    ['commit', '--quiet', '-m', 'Initial benchmark fixture'],
  ];
  for (const args of steps) {
    const result = await runProcess('git', args, dir, 30_000, currentSignal());
    if (result.exitCode !== 0) return false;
  }
  const reflog = await runProcess('git', ['reflog', 'show', '--format=%H', 'HEAD'], dir, 30_000, currentSignal());
  return reflog.exitCode === 0 && reflog.output.trim().length > 0;
}

const ENGAGEMENT_ERROR =
  'Agent produced no output and left the fixture unchanged; excluded as an engagement error, not a graded failure.';

async function worktreeChanged(dir: string): Promise<boolean> {
  const status = await runProcess('git', ['status', '--porcelain'], dir, 30_000, currentSignal());
  if (status.exitCode !== 0) return true;
  // The harness writes _prompt.txt after the fixture commit. That file is not an agent edit.
  return status.output.split('\n').some((line) => {
    const path = line.slice(3).replaceAll('"', '').trim();
    return path.length > 0 && path !== '_prompt.txt';
  });
}

/**
 * Empty final text is not a graded miss. Output tasks deliver that text, so silence is
 * non-engagement. Command tasks deliver file edits, so silence still counts when the disposable
 * worktree differs from the fixture commit. docs/reference/metrics.md L0.
 */
export async function engagementError(
  output: string,
  verifierKind: 'output' | 'command' | undefined,
  runDir: string,
  gitInitialized: boolean,
): Promise<string | null> {
  if (output.trim() !== '') return null;
  if ((verifierKind ?? 'output') === 'command' && gitInitialized && (await worktreeChanged(runDir))) return null;
  return ENGAGEMENT_ERROR;
}
