import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, resolve, win32 } from 'node:path';
import { parseFrontmatter } from "./frontmatter.js";
import { collectInstalledSkillFingerprint } from "./skill.js";
import type { EvaluationTarget } from "./contracts.js";
export function validateSkillInstallDir(installDir: string): string {
  const normalized = installDir.replaceAll('\\', '/');
  const parts = normalized.split('/');
  if (!normalized || isAbsolute(normalized) || win32.parse(installDir).root !== '' ||
      parts.some((part) => part === '..' || part === '.git') ||
      parts.every((part) => part === '' || part === '.') || normalized.includes('\0')) {
    throw new Error('Skill install directory must be a non-empty relative project path without parent traversal or .git.');
  }
  return normalized;
}

export function installedSkillDestination(root: string, installDir: string, name: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) {
    throw new Error('Installed Skill name must contain 1–64 lowercase letters, digits or hyphens.');
  }
  const base = resolve(root);
  const destination = join(base, validateSkillInstallDir(installDir), name);
  let current = base;
  for (const part of validateSkillInstallDir(installDir).split('/').concat(name)) {
    if (!part || part === '.') continue;
    current = join(current, part);
    try {
      if (lstatSync(current).isSymbolicLink()) {
        throw new Error('Skill install path must not contain symbolic links: ' + current);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return destination;
}

export function collectInstalledSkillTarget(skillDir: string): EvaluationTarget {
  const sourceDir = realpathSync(skillDir);
  const fingerprint = collectInstalledSkillFingerprint(sourceDir);
  if (!fingerprint.files.includes('SKILL.md')) {
    throw new Error('Installed mode requires a SKILL.md at the Skill directory root.');
  }
  const fields = parseFrontmatter(readFileSync(join(sourceDir, 'SKILL.md'), 'utf8'));
  if (!fields?.['name']?.trim() || !fields['description']?.trim()) {
    throw new Error('Installed mode requires SKILL.md frontmatter with name and description.');
  }
  const name = fields['name'].trim();
  // Validate the name without consulting a machine-global installation path.
  installedSkillDestination(sourceDir, '.skillfit-name-check', name);
  return { kind: 'skill', name, sourceDir, files: fingerprint.files, sha256: fingerprint.sha256,
    payload: null, overlays: {} };
}
