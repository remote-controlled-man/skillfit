import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { hashFileSet, listFilesRecursive } from './hash.js';
import type { SkillBundle } from './types.js';

const SKILL_FILE_EXTENSIONS = new Set(['.md', '.yaml', '.yml', '.json']);

export interface InstalledSkillFingerprint {
  sha256: string;
  files: string[];
}

/** Fingerprint every installed resource by relative path and bytes, without decoding binary files. */
export function collectInstalledSkillFingerprint(skillDir: string): InstalledSkillFingerprint {
  const root = realpathSync(skillDir);
  const files: string[] = [];
  const walk = (rel: string): void => {
    for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) {
        throw new Error(`Symbolic links are not supported inside trigger Skill inputs: ${child}. Copy the resource into the Skill directory.`);
      }
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) files.push(child);
      else throw new Error(`Unsupported entry inside trigger Skill input: ${child}; use regular files and directories.`);
    }
  };
  walk('');
  files.sort();
  return { sha256: hashFileSet(root, files), files };
}

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
  return { kind: 'skill', name: skillName, sourceDir, files, sha256, payload, overlays: {} };
}
