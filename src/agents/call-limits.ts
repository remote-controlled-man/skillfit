import { execFileSync } from 'node:child_process';
export function validateCallBudget(planned: number, ceiling?: number): number {
  if (!Number.isSafeInteger(planned) || planned < 1 ||
      (ceiling !== undefined && (!Number.isSafeInteger(ceiling) || ceiling < 1))) {
    throw new Error('Call budget must be a positive safe integer.');
  }
  const max = ceiling ?? planned;
  if (planned > max) throw new Error(`Experiment needs ${planned} model calls, exceeding --max-calls ${max}. Reduce the declared tasks/trials before running.`);
  return max;
}
export function probeVersion(argv: string[]): string | null {
  try {
    const output = execFileSync(argv[0]!, argv.slice(1), {
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: 65536,
      stdio: ['ignore', 'pipe', 'ignore'],
      // npm CLI shims are .cmd on Windows and cannot be execFile'd directly.
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    return output.split(/\r?\n/).find(line => /\d+\.\d+/.test(line))?.slice(0, 256) ?? null;
  } catch { return null; }
}
