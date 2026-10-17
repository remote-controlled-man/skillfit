export const DEFAULT_VERIFIER_TIMEOUT_SECONDS = 120;

/** Kept separate from the model deadline: case checks and oracle commands use this limit. */
export function parseVerifierTimeoutSeconds(value: unknown = DEFAULT_VERIFIER_TIMEOUT_SECONDS): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 3600) {
    throw new Error('verifierTimeoutSeconds must be an integer between 1 and 3600.');
  }
  return value;
}
