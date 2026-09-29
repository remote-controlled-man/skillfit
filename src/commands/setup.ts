import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInstall, type ProfileManifest } from './install.js';
import { prepareUpstreamProfile, readUpstreamLock } from './upstream.js';

export interface CodexSetupOptions {
  all?: boolean;
  starter?: boolean;
  skills?: string[];
  list?: boolean;
  noRules?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  strict?: boolean;
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
  profileDir?: string;
  lockPath?: string;
  fetcher?: typeof fetch;
  log?: (line: string) => void;
}

interface CodexCatalog {
  version: 1;
  starter: string[];
  historical: string[];
  retired: { name: string; reason: string }[];
}

/** Public, selectable Codex configuration. No personal home files are read. */
export async function runCodexSetup(opts: CodexSetupOptions): Promise<void> {
  const log = opts.log ?? console.log;
  const profileDir = opts.profileDir ?? fileURLToPath(new URL('../../profiles/codex-curated/', import.meta.url));
  const lockPath = opts.lockPath ?? fileURLToPath(new URL('../../profiles/codex-upstream-sources.json', import.meta.url));
  const lock = await readUpstreamLock(lockPath);
  const local = lock.localSkills ?? [];
  const names = [...lock.skills.map((skill) => skill.name), ...local];
  const catalog = JSON.parse(await fs.readFile(path.join(profileDir, 'catalog.json'), 'utf8')) as CodexCatalog;
  if (catalog.version !== 1 || !Array.isArray(catalog.starter) || !Array.isArray(catalog.historical) ||
      !Array.isArray(catalog.retired) || catalog.starter.some((name) => !names.includes(name)) ||
      catalog.historical.some((name) => !names.includes(name)) ||
      new Set(catalog.starter).size !== catalog.starter.length ||
      new Set(catalog.historical).size !== catalog.historical.length ||
      catalog.retired.some((item) => !item || typeof item.name !== 'string' ||
        typeof item.reason !== 'string' || names.includes(item.name)) ||
      new Set(catalog.retired.map((item) => item.name)).size !== catalog.retired.length) {
    throw new Error('Invalid Codex setup catalog.json');
  }
  const manifest = JSON.parse(await fs.readFile(path.join(profileDir, 'profile.json'), 'utf8')) as ProfileManifest;
  const manifestNames = (manifest.skills ?? []).map((skill) => skill.name);
  if (manifest.name !== path.basename(profileDir) || manifestNames.length !== names.length ||
      new Set(manifestNames).size !== names.length || names.some((name) => !manifestNames.includes(name))) {
    throw new Error('Codex setup catalog and profile.json disagree');
  }
  for (const name of local) await fs.access(path.join(profileDir, 'skills', name, 'SKILL.md'));
  if ([opts.all, opts.starter, (opts.skills?.length ?? 0) > 0].filter(Boolean).length > 1) {
    throw new Error('Choose --all, --starter, or repeat --skill; do not combine them');
  }
  if (opts.list || (!opts.all && !opts.starter && (opts.skills?.length ?? 0) === 0)) {
    log(`Available Codex Skills: ${names.length} installable, ${catalog.retired.length} retired (choose with --skill, --starter, or --all):`);
    for (const skill of lock.skills) {
      const source = `${skill.repo}@${skill.commit.slice(0, 12)}`;
      const flags = [
        catalog.starter.includes(skill.name) ? 'starter' : '',
        catalog.historical.includes(skill.name) ? 'historical source' : '',
        skill.name.startsWith('lark-') ? 'requires lark-cli' : '',
        skill.explicitOnly ? 'explicit only' : '',
      ].filter(Boolean);
      log(`  ${skill.name.padEnd(31)} ${source}${flags.length ? ` (${flags.join('; ')})` : ''}`);
    }
    for (const name of local) log(`  ${name.padEnd(31)} skillfit repository${catalog.starter.includes(name) ? ' (starter)' : ''}`);
    log('Retired local Skills (not installable from this catalog):');
    for (const item of catalog.retired) log(`  ${item.name.padEnd(31)} ${item.reason}`);
    if (!opts.list) log('Nothing was installed. Re-run with --skill <name>, --starter, or --all.');
    return;
  }
  const selected = opts.all ? [...names] : opts.starter ? [...catalog.starter] : [...opts.skills ?? []];
  if (new Set(selected).size !== selected.length) throw new Error('Duplicate --skill selection');
  for (const name of selected) {
    const retired = catalog.retired.find((item) => item.name === name);
    if (retired) throw new Error(`Retired Skill ${name}: ${retired.reason}`);
    if (!names.includes(name)) throw new Error(`Unknown Skill: ${name}`);
  }
  if (selected.some((name) => name.startsWith('lark-'))) {
    if (!selected.includes('lark-shared')) {
      selected.push('lark-shared');
      log('Added lark-shared dependency for the selected Lark Skills.');
    }
    log('Lark Skills require @larksuite/cli and separate Lark authentication to work.');
  }
  const baseRules = opts.noRules ? null : await fs.readFile(path.join(profileDir, 'rules', 'global.md'), 'utf8');
  const rulesContent = baseRules;
  const prepared = await prepareUpstreamProfile(profileDir, {
    lockPath, selectedSkills: selected, rulesContent, fetcher: opts.fetcher, log,
  });
  try {
    await runInstall({
      profile: path.basename(profileDir), profilePath: prepared.profileDir, agent: 'codex',
      homeDir: opts.homeDir ?? os.homedir(), env: opts.env ?? process.env,
      dryRun: opts.dryRun || !opts.yes, yes: opts.yes, strict: opts.strict, log,
    });
  } finally {
    await prepared.cleanup();
  }
}
