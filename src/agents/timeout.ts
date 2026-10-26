import { numeric } from '../shared/json.js';
import { DEFAULT_CLI_TIMEOUT_MS } from './constants.js';
export function parseExecutorTimeoutSeconds(value: unknown = DEFAULT_CLI_TIMEOUT_MS / 1000, label = 'executorTimeoutSeconds'): number {
  return numeric(value, label, 1, 3600, true);
}
