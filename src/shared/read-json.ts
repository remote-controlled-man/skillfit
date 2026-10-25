import { statSync, readFileSync } from 'node:fs';
import { sha256Text } from "./hash.js";
export function readComponentJson(path: string): { value: unknown; sha256: string } {
  if (statSync(path).size > 16 * 1024 * 1024) throw new Error('Component JSON exceeds 16 MiB.');
  const bytes = readFileSync(path, 'utf8');
  return { value: JSON.parse(bytes) as unknown, sha256: sha256Text(bytes) };
}
