import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { collectInstalledSkillFingerprint } from "../../resources/skill.js";
import type { Bench } from "../../bench/contracts.js";
import type { EvaluationTarget } from "../../resources/contracts.js";

import { installedSkillDestination, validateSkillInstallDir } from "../../resources/installed-skill.js";
export { installedSkillDestination, validateSkillInstallDir, collectInstalledSkillTarget } from "../../resources/installed-skill.js";
export function assertSkillRevisionTargets(target: EvaluationTarget, baseline: EvaluationTarget): void {
  if ([target, baseline].some(skill => skill.kind !== 'skill' || skill.payload !== null || !skill.files.includes('SKILL.md'))) {
    throw new Error('Skill revision comparison requires two complete installed Skill targets.');
  }
  if (target.name !== baseline.name) {
    throw new Error('Skill revisions must have the same SKILL.md frontmatter name; compare versions of one Skill.');
  }
  if (target.sha256 === baseline.sha256) {
    throw new Error('Skill revisions have identical complete-resource fingerprints; there is no version change to evaluate.');
  }
}

export function assertInstalledSkillFixtures(bench: Bench, target: EvaluationTarget, installDir: string, searchDirs: readonly string[] = []): void {
  const dirs = [...new Set([installDir, ...searchDirs].map(validateSkillInstallDir))];
  for (const task of bench.tasks) {
    for (const dir of dirs) {
      const destination = installedSkillDestination(join(bench.dir, task.fixture), dir, target.name);
      if (existsSync(destination)) {
        throw new Error('Fixture already contains the evaluated Skill for ' + task.id + ': ' + destination +
          '. Remove baseline contamination instead of merging Skill copies.');
      }
    }
  }
}

export function installSkillResources(target: EvaluationTarget, runDir: string, installDir: string): void {
  const destination = installedSkillDestination(runDir, installDir, target.name);
  if (existsSync(destination)) throw new Error('Skill installation would overwrite fixture content: ' + destination);
  if (collectInstalledSkillFingerprint(target.sourceDir).sha256 !== target.sha256) {
    throw new Error('Skill resources changed after planning; freeze the input again before running.');
  }
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(target.sourceDir, destination, { recursive: true, force: false, errorOnExist: true });
  if (collectInstalledSkillFingerprint(destination).sha256 !== target.sha256) {
    throw new Error('Installed Skill resources do not match the planned complete-resource fingerprint.');
  }
}
