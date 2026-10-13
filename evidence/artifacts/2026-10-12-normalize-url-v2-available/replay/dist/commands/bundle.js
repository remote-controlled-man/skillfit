import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgent, skillUserDirSpecs } from '../agents.js';
import { collectReceipts } from '../harness/receipts.js';
import { parseFrontmatter } from '../frontmatter.js';
import { isImplicitInvocationDisabled } from '../invocation.js';
import { BACKUP_SUFFIX, loadProfile, MARKER_END, MARKER_START } from './install.js';
import { confirm as confirmPrompt } from './confirm.js';
import { readUpstreamLock } from './upstream.js';
const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
function expandHome(spec, homeDir) {
    return spec.startsWith('~/') ? path.join(homeDir, spec.slice(2)) : path.resolve(spec);
}
function codexRulesFile(homeDir, env) {
    const rules = getAgent('codex').rules;
    const override = rules.userHomeOverride;
    const envHome = override === undefined ? undefined : env[override.env];
    if (override !== undefined && envHome)
        return path.resolve(envHome, override.relativePath);
    const spec = rules.userFiles[0];
    if (!spec)
        throw new Error('Codex has no user-level rules path in the matrix');
    return expandHome(spec, homeDir);
}
function codexSkillDirs(homeDir, env) {
    const specs = skillUserDirSpecs(getAgent('codex'), env);
    if (specs.length === 0)
        throw new Error('Codex has no user-level skills path in the matrix');
    return specs.map((spec) => expandHome(spec, homeDir));
}
async function readOptional(file) {
    try {
        return await fs.readFile(file, 'utf8');
    }
    catch (error) {
        if (error.code === 'ENOENT')
            return null;
        throw error;
    }
}
function stripManagedBlock(content) {
    const start = content.indexOf(MARKER_START);
    const end = content.indexOf(MARKER_END);
    if (start === -1 && end === -1)
        return content.trimEnd();
    if (start === -1 || end < start || content.indexOf(MARKER_START, start + 1) !== -1 ||
        content.indexOf(MARKER_END, end + 1) !== -1) {
        throw new Error('Source global AGENTS.md has malformed skillfit markers');
    }
    return `${content.slice(0, start)}${content.slice(end + MARKER_END.length)}`.trimEnd();
}
function renderRules(source, selected, explicitOnly) {
    const base = stripManagedBlock(source ?? '# Global Codex guidance');
    const implicit = selected.filter((name) => !explicitOnly.includes(name));
    const lines = [
        base,
        '',
        '## Skill routing',
        '',
        '- Match the task to installed Skills using their descriptions. Read the full SKILL.md only for relevant Skills.',
        '- If the user names a Skill, use it. For implicit use, choose the smallest relevant set and avoid overlapping workflows. Respect each Skill\'s invocation metadata.',
        `- Available for implicit routing in this portable profile: ${implicit.length > 0 ? implicit.map((name) => `\`${name}\``).join(', ') : 'none'}.`,
    ];
    if (explicitOnly.length > 0)
        lines.push(`- User-invoked only: ${explicitOnly.map((name) => `\`${name}\``).join(', ')}.`);
    if (selected.includes('vibe-coding')) {
        lines.push('- For ordinary coding changes, use `vibe-coding` as the workflow router and load only the specialist Skill the task needs.');
    }
    if (selected.includes('autonomous-iteration')) {
        lines.push('- Use `autonomous-iteration` for substantial work spanning multiple implementation steps; it uses `vibe-coding` for each coding slice when available.');
    }
    if (selected.includes('api-and-interface-design') && selected.includes('codebase-design')) {
        lines.push('- Use `api-and-interface-design` for public contracts and `codebase-design` for internal module boundaries.');
    }
    if (selected.includes('diagnosing-bugs') && selected.includes('tdd')) {
        lines.push('- Use `diagnosing-bugs` for uncertain failure causes and `tdd` for explicit test-first work or difficult test seams.');
    }
    return `${lines.join('\n')}\n`;
}
function isInstallerArtifact(file) {
    return [BACKUP_SUFFIX, '.skillfit-staged', '.skillfit-restore'].some((suffix) => file.endsWith(suffix));
}
async function walkFiles(dir, prefix = '') {
    const out = [];
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (entry.isSymbolicLink())
            throw new Error(`Symlink in skill cannot be exported safely: ${path.join(dir, entry.name)}`);
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory())
            out.push(...await walkFiles(path.join(dir, entry.name), rel));
        else if (entry.isFile())
            out.push(rel);
    }
    return out.sort();
}
async function sha256(file) {
    return createHash('sha256').update(await fs.readFile(file)).digest('hex');
}
async function locateSkill(dirs, name) {
    for (const dir of dirs) {
        const src = path.join(dir, name);
        try {
            if ((await fs.lstat(src)).isSymbolicLink()) {
                throw new Error(`Symlinked skill cannot be exported safely: ${src}`);
            }
            return src;
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
    }
    return null;
}
async function verifyUpstreamExport(dir, manifest, lock, rules, sourceFiles, skillSources) {
    const actualManifest = JSON.parse(await fs.readFile(path.join(dir, 'profile.json'), 'utf8'));
    const actualLock = await readUpstreamLock(path.join(dir, 'upstream.lock.json'));
    if (JSON.stringify(actualManifest) !== JSON.stringify(manifest) || JSON.stringify(actualLock) !== JSON.stringify(lock)) {
        throw new Error('Portable export verification failed: manifest or source lock differs');
    }
    if (await fs.readFile(path.join(dir, 'rules', 'global.md'), 'utf8') !== rules) {
        throw new Error('Portable export verification failed: global rules differ');
    }
    if (!(await fs.readFile(path.join(dir, 'setup.mjs'), 'utf8')).includes('prepareUpstreamProfile')) {
        throw new Error('Portable export verification failed: setup script is missing');
    }
    for (const [name, files] of sourceFiles) {
        for (const rel of files) {
            const source = skillSources.get(name);
            if (!source || await sha256(path.join(dir, 'skills', name, rel)) !== await sha256(path.join(source, rel))) {
                throw new Error(`Portable export verification failed for ${name}/${rel}`);
            }
        }
    }
}
async function defaultUsage(homeDir, env) {
    const receipt = (await collectReceipts({ agent: 'codex', homeDir, env }))[0];
    const installed = new Set(receipt?.installed ?? []);
    return receipt?.skills
        .filter(({ name }) => installed.has(name))
        .map(({ name, sessionCount }) => ({ name, sessionCount })) ?? [];
}
/** Create a self-contained profile from user-level Codex skills and active global guidance. */
export async function runBundleExport(opts) {
    const log = opts.log ?? ((line) => console.log(line));
    const homeDir = opts.homeDir ?? os.homedir();
    const env = opts.env ?? (opts.homeDir === undefined ? process.env : {});
    const outputDir = path.resolve(opts.outputDir);
    const profileName = path.basename(outputDir);
    if (!NAME_PATTERN.test(profileName)) {
        throw new Error('Bundle directory name must use lowercase letters, digits and dashes');
    }
    const skillDirs = codexSkillDirs(homeDir, env);
    const upstreamLock = opts.upstreamLockPath ? await readUpstreamLock(path.resolve(opts.upstreamLockPath)) : null;
    const usage = opts.skillNames === undefined && !upstreamLock
        ? await (opts.loadUsage ?? (() => defaultUsage(homeDir, env)))()
        : [];
    const minSessions = opts.minSessions ?? 2;
    if (!Number.isInteger(minSessions) || minSessions < 1)
        throw new Error('--min-sessions must be a positive integer');
    const candidates = [...new Set(upstreamLock
            ? [...upstreamLock.skills.map((skill) => skill.name), ...(upstreamLock.localSkills ?? []), ...(opts.skillNames ?? [])]
            : opts.skillNames ?? usage.filter((item) => item.sessionCount >= minSessions).map((item) => item.name))].sort();
    const names = [];
    const explicitOnly = [];
    const skipped = [];
    const sourceFiles = new Map();
    const skillSources = new Map();
    const upstreamByName = new Map((upstreamLock?.skills ?? []).map((skill) => [skill.name, skill]));
    const selectedUpstream = [];
    for (const name of candidates) {
        if (!NAME_PATTERN.test(name))
            throw new Error(`Invalid skill name: ${name}`);
        const remote = upstreamByName.get(name);
        if (remote) {
            names.push(name);
            selectedUpstream.push(remote);
            if (remote.explicitOnly)
                explicitOnly.push(name);
            continue;
        }
        const src = await locateSkill(skillDirs, name);
        if (src === null) {
            if (opts.skillNames === undefined && !upstreamLock) {
                skipped.push(name);
                continue;
            }
            throw new Error(`Skill "${name}" is not installed in ${skillDirs.join(', ')}`);
        }
        const files = (await walkFiles(src)).filter((file) => !isInstallerArtifact(file));
        const manifest = await readOptional(path.join(src, 'SKILL.md'));
        const frontmatter = manifest === null ? null : parseFrontmatter(manifest);
        if (frontmatter?.name !== name || !frontmatter.description) {
            throw new Error(`Skill "${name}" has an invalid SKILL.md`);
        }
        names.push(name);
        skillSources.set(name, src);
        const codexMetadata = await readOptional(path.join(src, 'agents', 'openai.yaml'));
        if (isImplicitInvocationDisabled(codexMetadata))
            explicitOnly.push(name);
        sourceFiles.set(name, files);
    }
    const rulesFile = codexRulesFile(homeDir, env);
    const overrideName = getAgent('codex').rules.userHomeOverride?.overrideRelativePath;
    const activeOverride = overrideName ? path.join(path.dirname(rulesFile), overrideName) : null;
    const overrideRules = activeOverride ? await readOptional(activeOverride) : null;
    const useOverride = overrideRules !== null && overrideRules.trim().length > 0;
    const sourceRules = useOverride ? overrideRules : await readOptional(rulesFile);
    const rules = renderRules(sourceRules, names, explicitOnly);
    log(`Portable Codex profile: ${outputDir}`);
    log(`Global rules source: ${sourceRules === null ? 'generated defaults' : useOverride ? activeOverride : rulesFile}`);
    log(`Skills (${names.length}): ${names.join(', ') || '(none)'}`);
    if (explicitOnly.length > 0)
        log(`User-invoked-only skills (${explicitOnly.length}): ${explicitOnly.join(', ')}`);
    if (skipped.length > 0)
        log(`Skipped skills unavailable in the user skills directory: ${skipped.join(', ')}`);
    if (upstreamLock)
        log(`GitHub Skills pinned to reviewed commits (${selectedUpstream.length}); other Skills copied locally (${sourceFiles.size}).`);
    log('The profile contains personal global guidance; review it before sharing.');
    let destinationExists = false;
    try {
        await fs.stat(outputDir);
        destinationExists = true;
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
    }
    if (destinationExists) {
        log(`CONFLICT: ${outputDir} already exists`);
        if (opts.dryRun)
            return;
        throw new Error(`Bundle destination already exists: ${outputDir}`);
    }
    if (opts.dryRun) {
        log('Dry run: nothing was written.');
        return;
    }
    if (!opts.yes) {
        const confirm = opts.confirm ?? confirmPrompt;
        if (!await confirm(`Export ${names.length} skill(s) to ${outputDir}? [y/N] `)) {
            log('Aborted; nothing was written.');
            return;
        }
    }
    const manifest = {
        name: profileName,
        version: '1.0.0',
        description: 'Portable Codex setup exported from a user environment.',
        agents: ['codex'],
        scope: 'user',
        rules: { template: 'rules/global.md' },
        skills: names.map((name) => ({ name, source: `skills/${name}` })),
    };
    const exportedLock = { version: 1, skills: selectedUpstream, localSkills: [...sourceFiles.keys()] };
    await fs.mkdir(path.dirname(outputDir), { recursive: true });
    const stageRoot = await fs.mkdtemp(path.join(path.dirname(outputDir), `.${profileName}-skillfit-`));
    const stage = path.join(stageRoot, profileName);
    try {
        await fs.mkdir(stage);
        await fs.mkdir(path.join(stage, 'rules'), { recursive: true });
        await fs.writeFile(path.join(stage, 'rules', 'global.md'), rules, 'utf8');
        await fs.writeFile(path.join(stage, 'profile.json'), `${JSON.stringify(manifest, null, 2)}\n`);
        await fs.writeFile(path.join(stage, 'package.json'), '{"private":true,"type":"module"}\n');
        if (upstreamLock) {
            await fs.writeFile(path.join(stage, 'upstream.lock.json'), `${JSON.stringify(exportedLock, null, 2)}\n`);
            await fs.writeFile(path.join(stage, 'setup.mjs'), [
                "import { parseArgs } from 'node:util';",
                "import { fileURLToPath } from 'node:url';",
                "import { prepareUpstreamProfile } from './runtime/commands/upstream.js';",
                "import { runInstall } from './runtime/commands/install.js';",
                "const profileDir = fileURLToPath(new URL('.', import.meta.url));",
                "const { values } = parseArgs({ args: process.argv.slice(2), options: { 'dry-run': { type: 'boolean' }, yes: { type: 'boolean' }, strict: { type: 'boolean' } } });",
                "const prepared = await prepareUpstreamProfile(profileDir, { log: console.log });",
                "try {",
                "  await runInstall({ profile: 'portable', profilePath: prepared.profileDir, agent: 'codex', dryRun: values['dry-run'] ?? false, yes: values.yes ?? false, strict: values.strict ?? false });",
                "} finally { await prepared.cleanup(); }",
                '',
            ].join('\n'));
        }
        else {
            await fs.writeFile(path.join(stage, 'setup.mjs'), [
                "import { fileURLToPath } from 'node:url';",
                "const profileDir = fileURLToPath(new URL('.', import.meta.url));",
                "const cli = fileURLToPath(new URL('./runtime/cli.js', import.meta.url));",
                "process.argv = [process.argv[0], cli, 'install', '--profile-path', profileDir, '--agent', 'codex', ...process.argv.slice(2)];",
                "await import('./runtime/cli.js');",
                '',
            ].join('\n'));
        }
        const runtimeDir = fileURLToPath(new URL('../', import.meta.url));
        for (const rel of (await walkFiles(runtimeDir)).filter((file) => !file.endsWith('.test.js'))) {
            const src = path.join(runtimeDir, rel);
            const dst = path.join(stage, 'runtime', rel);
            await fs.mkdir(path.dirname(dst), { recursive: true });
            await fs.copyFile(src, dst);
            if (await sha256(src) !== await sha256(dst))
                throw new Error(`Runtime export verification failed for ${rel}`);
        }
        for (const [name, files] of sourceFiles) {
            for (const rel of files) {
                const root = skillSources.get(name);
                if (!root)
                    throw new Error(`Export is missing the source directory for ${name}`);
                const src = path.join(root, rel);
                const dst = path.join(stage, 'skills', name, rel);
                await fs.mkdir(path.dirname(dst), { recursive: true });
                await fs.copyFile(src, dst);
                if (await sha256(src) !== await sha256(dst))
                    throw new Error(`Export verification failed for ${name}/${rel}`);
            }
        }
        if (upstreamLock)
            await verifyUpstreamExport(stage, manifest, exportedLock, rules, sourceFiles, skillSources);
        else
            await loadProfile(stageRoot, profileName);
        await fs.rename(stage, outputDir);
    }
    catch (error) {
        await fs.rm(stageRoot, { recursive: true, force: true });
        throw error;
    }
    await fs.rmdir(stageRoot);
    if (upstreamLock)
        await verifyUpstreamExport(outputDir, manifest, exportedLock, rules, sourceFiles, skillSources);
    else
        await loadProfile(path.dirname(outputDir), profileName);
    log(upstreamLock
        ? `Export written: ${outputDir} (GitHub files are verified when setup runs)`
        : `Export verified: ${outputDir}`);
}
