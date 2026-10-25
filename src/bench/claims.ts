import type { BenchClaim } from "./contracts.js";
export const BENCH_CLAIMS: readonly BenchClaim[] = ['quality', 'efficiency', 'activation'];

export function parseBenchClaims(value: unknown, label = 'claims'): BenchClaim[] {
  if (!Array.isArray(value) || value.length === 0 || value.some(c => !BENCH_CLAIMS.includes(c)) || new Set(value).size !== value.length) {
    throw new Error(`${label} must be a nonempty, duplicate-free array of quality, efficiency or activation.`);
  }
  return [...value] as BenchClaim[];
}
