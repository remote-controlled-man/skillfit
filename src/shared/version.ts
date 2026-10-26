import { packagePath } from './package-root.js';
import { readFileSync } from 'node:fs';

interface PackageJson {
  version: string;
}

const raw = JSON.parse(readFileSync(packagePath('package.json'), 'utf8')) as PackageJson;

export const VERSION: string = raw.version;
