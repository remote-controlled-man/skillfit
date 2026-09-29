import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInstall, type ProfileManifest } from './install.js';
import { prepareUpstreamProfile, readUpstreamLock } from './upstream.js';

export interface CodexSetupOptions {
  all?: boolean;
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

/** Public, selectable Codex configuration. No personal home files are read. */
export async function runCodexSetup(opts: CodexSetupOptions): Promise<void> {
  const log = opts.log ?? console.log;
  const profileDir = opts.profileDir ?? fileURLToPath(new URL('../../profiles/codex-curated/', import.meta.url));
  const lockPath = opts.lockPath ?? fileURLToPath(new URL('../../profiles/codex-upstream-sources.json', import.meta.url));
  const lock = await readUpstreamLock(lockPath);
  const local = lock.localSkills ?? [];
  const names = [...lock.skills.map((skill) => skill.name), ...local];
  const manifest = JSON.parse(await fs.readFile(path.join(profileDir, 'profile.json'), 'utf8')) as ProfileManifest;
  const manifestNames = (manifest.skills ?? []).map((skill) => skill.name);
  if (manifest.name !== path.basename(profileDir) || manifestNames.length !== names.length ||
      new Set(manifestNames).size !== names.length || names.some((name) => !manifestNames.includes(name))) {
    throw new Error('Codex setup catalog and profile.json disagree');
  }
  for (const name of local) await fs.access(path.join(profileDir, 'skills', name, 'SKILL.md'));
  if (opts.all && (opts.skills?.length ?? 0) > 0) throw new Error('Choose --all or repeat --skill, not both');
  if (opts.list || (!opts.all && (opts.skills?.length ?? 0) === 0)) {
    log('Available Codex Skills (select with --skill <name>, or use --all):');
    for (const skill of lock.skills) {
      const source = `${skill.repo}@${skill.commit.slice(0, 12)}`;
      log(`  ${skill.name.padEnd(27)} ${source}${skill.explicitOnly ? ' (explicit only)' : ''}`);
    }
    for (const name of local) log(`  ${name.padEnd(27)} skillfit (local source)`);
    if (!opts.list) log('Nothing was installed. Re-run with --skill <name> or --all.');
    return;
  }
  const selected = opts.all ? names : opts.skills ?? [];
  if (new Set(selected).size !== selected.length) throw new Error('Duplicate --skill selection');
  for (const name of selected) if (!names.includes(name)) throw new Error(`Unknown Skill: ${name}`);
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
