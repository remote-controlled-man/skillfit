import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, win32 } from 'node:path';
import { parseFrontmatter } from '../frontmatter.js';
import { collectInstalledSkillFingerprint } from './bundle.js';
export function validateSkillInstallDir(installDir) {
    const normalized = installDir.replaceAll('\\', '/');
    const parts = normalized.split('/');
    if (!normalized || isAbsolute(normalized) || win32.parse(installDir).root !== '' ||
        parts.some((part) => part === '..' || part === '.git') ||
        parts.every((part) => part === '' || part === '.') || normalized.includes('\0')) {
        throw new Error('Skill install directory must be a non-empty relative project path without parent traversal or .git.');
    }
    return normalized;
}
export function installedSkillDestination(root, installDir, name) {
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) {
        throw new Error('Installed Skill name must contain 1–64 lowercase letters, digits or hyphens.');
    }
    const base = resolve(root);
    const destination = join(base, validateSkillInstallDir(installDir), name);
    let current = base;
    for (const part of validateSkillInstallDir(installDir).split('/').concat(name)) {
        if (!part || part === '.')
            continue;
        current = join(current, part);
        try {
            if (lstatSync(current).isSymbolicLink()) {
                throw new Error('Skill install path must not contain symbolic links: ' + current);
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
    }
    return destination;
}
export function collectInstalledSkillTarget(skillDir) {
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
export function assertSkillRevisionTargets(target, baseline) {
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
export function assertInstalledSkillFixtures(bench, target, installDir, searchDirs = []) {
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
export function installSkillResources(target, runDir, installDir) {
    const destination = installedSkillDestination(runDir, installDir, target.name);
    if (existsSync(destination))
        throw new Error('Skill installation would overwrite fixture content: ' + destination);
    if (collectInstalledSkillFingerprint(target.sourceDir).sha256 !== target.sha256) {
        throw new Error('Skill resources changed after planning; freeze the input again before running.');
    }
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(target.sourceDir, destination, { recursive: true, force: false, errorOnExist: true });
    if (collectInstalledSkillFingerprint(destination).sha256 !== target.sha256) {
        throw new Error('Installed Skill resources do not match the planned complete-resource fingerprint.');
    }
}
