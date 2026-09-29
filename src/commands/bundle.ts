import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgent } from '../agents.js';
import { collectReceipts } from '../harness/receipts.js';
import { parseFrontmatter } from '../frontmatter.js';
import { loadProfile, MARKER_END, MARKER_START } from './install.js';
import { confirm as confirmPrompt } from './confirm.js';

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export interface BundleExportOptions {
  outputDir: string;
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
  skillNames?: string[];
  /** Default selection uses skills seen in at least two distinct Codex sessions. */
  minSessions?: number;
  dryRun?: boolean;
  yes?: boolean;
  log?: (line: string) => void;
  confirm?: (question: string) => Promise<boolean>;
  loadUsage?: () => Promise<{ name: string; sessionCount: number }[]>;
}

function expandHome(spec: string, homeDir: string): string {
  return spec.startsWith('~/') ? path.join(homeDir, spec.slice(2)) : path.resolve(spec);
}

function codexRulesFile(homeDir: string, env: NodeJS.ProcessEnv): string {
  const rules = getAgent('codex').rules;
  const override = rules.userHomeOverride;
  const envHome = override === undefined ? undefined : env[override.env];
  if (override !== undefined && envHome) return path.resolve(envHome, override.relativePath);
  const spec = rules.userFiles[0];
  if (!spec) throw new Error('Codex has no user-level rules path in the matrix');
  return expandHome(spec, homeDir);
}

function codexSkillsDir(homeDir: string): string {
  const spec = getAgent('codex').skills.userDirs[0];
  if (!spec) throw new Error('Codex has no user-level skills path in the matrix');
  return expandHome(spec, homeDir);
}

async function readOptional(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function stripManagedBlock(content: string): string {
  const start = content.indexOf(MARKER_START);
  const end = content.indexOf(MARKER_END);
  if (start === -1 && end === -1) return content.trimEnd();
  if (start === -1 || end < start || content.indexOf(MARKER_START, start + 1) !== -1 ||
      content.indexOf(MARKER_END, end + 1) !== -1) {
    throw new Error('Source global AGENTS.md has malformed skillfit markers');
  }
  return `${content.slice(0, start)}${content.slice(end + MARKER_END.length)}`.trimEnd();
}

function renderRules(source: string | null, selected: string[], explicitOnly: string[]): string {
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
  if (explicitOnly.length > 0) lines.push(`- User-invoked only: ${explicitOnly.map((name) => `\`${name}\``).join(', ')}.`);
  return `${lines.join('\n')}\n`;
}

async function walkFiles(dir: string, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`Symlink in skill cannot be exported safely: ${path.join(dir, entry.name)}`);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await walkFiles(path.join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out.sort();
}

async function sha256(file: string): Promise<string> {
  return createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

async function defaultUsage(homeDir: string): Promise<{ name: string; sessionCount: number }[]> {
  const receipt = (await collectReceipts({ agent: 'codex', homeDir }))[0];
  const installed = new Set(receipt?.installed ?? []);
  return receipt?.skills
    .filter(({ name }) => installed.has(name))
    .map(({ name, sessionCount }) => ({ name, sessionCount })) ?? [];
}

/** Create a self-contained profile from user-level Codex skills and active global guidance. */
export async function runBundleExport(opts: BundleExportOptions): Promise<void> {
  const log = opts.log ?? ((line: string) => console.log(line));
  const homeDir = opts.homeDir ?? os.homedir();
  const env = opts.env ?? process.env;
  const outputDir = path.resolve(opts.outputDir);
  const profileName = path.basename(outputDir);
  if (!NAME_PATTERN.test(profileName)) {
    throw new Error('Bundle directory name must use lowercase letters, digits and dashes');
  }
  const skillsDir = codexSkillsDir(homeDir);
  const usage = opts.skillNames === undefined
    ? await (opts.loadUsage ?? (() => defaultUsage(homeDir)))()
    : [];
  const minSessions = opts.minSessions ?? 2;
  if (!Number.isInteger(minSessions) || minSessions < 1) throw new Error('--min-sessions must be a positive integer');
  const candidates = [...new Set(opts.skillNames ?? usage.filter((item) => item.sessionCount >= minSessions).map((item) => item.name))].sort();
  const names: string[] = [];
  const explicitOnly: string[] = [];
  const skipped: string[] = [];
  const sourceFiles = new Map<string, string[]>();
  for (const name of candidates) {
    if (!NAME_PATTERN.test(name)) throw new Error(`Invalid skill name: ${name}`);
    const src = path.join(skillsDir, name);
    let files: string[];
    try {
      if ((await fs.lstat(src)).isSymbolicLink()) {
        throw new Error(`Symlinked skill cannot be exported safely: ${src}`);
      }
      files = await walkFiles(src);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      if (opts.skillNames === undefined) {
        skipped.push(name);
        continue;
      }
      throw new Error(`Skill "${name}" is not installed at ${src}`);
    }
    const manifest = await readOptional(path.join(src, 'SKILL.md'));
    const frontmatter = manifest === null ? null : parseFrontmatter(manifest);
    if (frontmatter?.name !== name || !frontmatter.description) {
      throw new Error(`Skill "${name}" has an invalid SKILL.md`);
    }
    names.push(name);
    if (frontmatter['disable-model-invocation'] === 'true') explicitOnly.push(name);
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
  if (explicitOnly.length > 0) log(`User-invoked-only skills (${explicitOnly.length}): ${explicitOnly.join(', ')}`);
  if (skipped.length > 0) log(`Skipped skills unavailable in the user skills directory: ${skipped.join(', ')}`);
  log('The profile contains copies of the selected Skills and global guidance; review it before sharing.');

  let destinationExists = false;
  try {
    await fs.stat(outputDir);
    destinationExists = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (destinationExists) {
    log(`CONFLICT: ${outputDir} already exists`);
    if (opts.dryRun) return;
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

  await fs.mkdir(path.dirname(outputDir), { recursive: true });
  const stageRoot = await fs.mkdtemp(path.join(path.dirname(outputDir), `.${profileName}-skillfit-`));
  const stage = path.join(stageRoot, profileName);
  try {
    await fs.mkdir(stage);
    await fs.mkdir(path.join(stage, 'rules'), { recursive: true });
    await fs.writeFile(path.join(stage, 'rules', 'global.md'), rules, 'utf8');
    const manifest = {
      name: profileName,
      version: '1.0.0',
      description: 'Portable Codex setup exported from a user environment.',
      agents: ['codex'],
      scope: 'user',
      rules: { template: 'rules/global.md' },
      skills: names.map((name) => ({ name, source: `skills/${name}` })),
    };
    await fs.writeFile(path.join(stage, 'profile.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    await fs.writeFile(path.join(stage, 'package.json'), '{"private":true,"type":"module"}\n');
    await fs.writeFile(path.join(stage, 'setup.mjs'), [
      "import { fileURLToPath } from 'node:url';",
      "const profileDir = fileURLToPath(new URL('.', import.meta.url));",
      "const cli = fileURLToPath(new URL('./runtime/cli.js', import.meta.url));",
      "process.argv = [process.argv[0], cli, 'install', '--profile-path', profileDir, '--agent', 'codex', ...process.argv.slice(2)];",
      "await import('./runtime/cli.js');",
      '',
    ].join('\n'));
    const runtimeDir = fileURLToPath(new URL('../', import.meta.url));
    for (const rel of (await walkFiles(runtimeDir)).filter((file) => !file.endsWith('.test.js'))) {
      const src = path.join(runtimeDir, rel);
      const dst = path.join(stage, 'runtime', rel);
      await fs.mkdir(path.dirname(dst), { recursive: true });
      await fs.copyFile(src, dst);
      if (await sha256(src) !== await sha256(dst)) throw new Error(`Runtime export verification failed for ${rel}`);
    }
    for (const [name, files] of sourceFiles) {
      for (const rel of files) {
        const src = path.join(skillsDir, name, rel);
        const dst = path.join(stage, 'skills', name, rel);
        await fs.mkdir(path.dirname(dst), { recursive: true });
        await fs.copyFile(src, dst);
        if (await sha256(src) !== await sha256(dst)) throw new Error(`Export verification failed for ${name}/${rel}`);
      }
    }
    await loadProfile(stageRoot, profileName);
    await fs.rename(stage, outputDir);
  } catch (error) {
    await fs.rm(stageRoot, { recursive: true, force: true });
    throw error;
  }
  await fs.rmdir(stageRoot);
  await loadProfile(path.dirname(outputDir), profileName);
  log(`Export verified: ${outputDir}`);
}
