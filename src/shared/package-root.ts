import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Fixed distribution layout; no cwd, home-directory search or mutable global state.
export const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const RUNTIME_ROOT = fileURLToPath(new URL('../', import.meta.url));
export function packagePath(...parts: string[]): string { return join(PACKAGE_ROOT, ...parts); }
