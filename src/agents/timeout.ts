import { numeric } from '../shared/json.js';
import { DEFAULT_CLI_TIMEOUT_MS } from './constants.js';
export function parseExecutorTimeoutSeconds(value: unknown = DEFAULT_CLI_TIMEOUT_MS / 1000, label = 'executorTimeoutSeconds'): number | null {
  if (value === null) return null;
  return numeric(value, label, 1, 3600, true);
}

/** CLI spelling keeps JSON null distinct from omission and numeric zero. */
export function executorTimeoutArgument(value: string | undefined): number | null | undefined {
  return value === undefined ? undefined : value === 'none' ? null : parseExecutorTimeoutSeconds(Number(value));
}
export function executorTimeoutMs(value: number | null): number | null { return value === null ? null : value * 1000; }
export function executorDeadlineLabel(value: number | null | undefined): string { return value === null ? 'disabled' : `${value}s`; }
