import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { hashFileSet, listFilesRecursive } from './hash.js';
import type { SkillBundle } from './types.js';

const SKILL_FILE_EXTENSIONS = new Set(['.md', '.yaml', '.yml', '.json']);

export function collectSkillBundle(skillDir: string, name?: string): SkillBundle {
  const sourceDir = resolve(skillDir);
  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    throw new Error(`Skill path is not a directory: ${sourceDir}`);
  }
  const files = listFilesRecursive(sourceDir).filter((rel) =>
    SKILL_FILE_EXTENSIONS.has(extname(rel).toLowerCase()),
  );
  if (files.length === 0) {
    throw new Error(`No injectable skill files (.md/.yaml/.yml/.json) found in ${sourceDir}`);
  }
  const sha256 = hashFileSet(sourceDir, files);
  const skillName = name ?? basename(sourceDir);
  const parts = files.map(
    (rel) => `--- skill file: ${rel} ---\n${readFileSync(join(sourceDir, rel), 'utf8')}`,
  );
  const payload = [
    'Treatment material. Apply it only when relevant:',
    `<skill name="${skillName}">`,
    parts.join('\n'),
    '</skill>',
  ].join('\n');
  return { name: skillName, sourceDir, files, sha256, payload };
}
