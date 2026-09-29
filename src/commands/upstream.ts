import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { isImplicitInvocationDisabled } from '../invocation.js';
import { loadProfile, type ProfileManifest } from './install.js';

const NAME = /^[a-z0-9][a-z0-9-]*$/;
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const MAX_FILE_BYTES = 1024 * 1024;

export interface UpstreamFile { path: string; sha256: string }
export interface UpstreamSkill {
  name: string;
  repo: string;
  commit: string;
  path: string;
  files: UpstreamFile[];
  explicitOnly?: boolean;
}
export interface UpstreamLock { version: 1; skills: UpstreamSkill[]; localSkills?: string[] }

function safeSegments(value: string): boolean {
  return value.length > 0 && value.split('/').every((segment) =>
    segment !== '.' && segment !== '..' && /^[A-Za-z0-9._-]+$/.test(segment));
}

export function validateUpstreamLock(value: unknown): UpstreamLock {
  if (!value || typeof value !== 'object') throw new Error('upstream.lock.json must be an object');
  const lock = value as Partial<UpstreamLock>;
  if (lock.version !== 1 || !Array.isArray(lock.skills)) throw new Error('Unsupported upstream lock version');
  const names = new Set<string>();
  for (const skill of lock.skills) {
    if (!skill || typeof skill !== 'object' || typeof skill.name !== 'string' || !NAME.test(skill.name)) {
      throw new Error('Invalid upstream skill name');
    }
    if (names.has(skill.name)) throw new Error(`Duplicate upstream skill ${skill.name}`);
    names.add(skill.name);
    if (typeof skill.repo !== 'string' || skill.repo.split('/').length !== 2 || !safeSegments(skill.repo)) {
      throw new Error(`Invalid GitHub repository for ${skill.name}`);
    }
    if (typeof skill.commit !== 'string' || !COMMIT.test(skill.commit)) {
      throw new Error(`GitHub source for ${skill.name} must use a 40-character commit`);
    }
    if (typeof skill.path !== 'string' || !safeSegments(skill.path)) {
      throw new Error(`Invalid GitHub path for ${skill.name}`);
    }
    if (!Array.isArray(skill.files) || skill.files.length === 0 || skill.files.length > 128) {
      throw new Error(`Invalid file list for ${skill.name}`);
    }
    const files = new Set<string>();
    for (const file of skill.files) {
      if (!file || typeof file.path !== 'string' || !safeSegments(file.path) ||
          typeof file.sha256 !== 'string' || !SHA256.test(file.sha256)) {
        throw new Error(`Invalid file record for ${skill.name}`);
      }
      if (['.skillfit-bak', '.skillfit-staged', '.skillfit-restore'].some((suffix) => file.path.endsWith(suffix))) {
        throw new Error(`Installer artifact is not a Skill file: ${file.path}`);
      }
      if (files.has(file.path)) throw new Error(`Duplicate file ${file.path} for ${skill.name}`);
      files.add(file.path);
    }
    if (!files.has('SKILL.md')) throw new Error(`Missing SKILL.md record for ${skill.name}`);
    if (skill.explicitOnly !== undefined && typeof skill.explicitOnly !== 'boolean') {
      throw new Error(`Invalid invocation policy for ${skill.name}`);
    }
  }
  if (lock.localSkills !== undefined) {
    if (!Array.isArray(lock.localSkills)) throw new Error('localSkills must be an array');
    for (const name of lock.localSkills) {
      if (typeof name !== 'string' || !NAME.test(name)) throw new Error('Invalid local skill name');
      if (names.has(name)) throw new Error(`Duplicate skill ${name} in upstream lock`);
      names.add(name);
    }
  }
  return lock as UpstreamLock;
}

export async function readUpstreamLock(file: string): Promise<UpstreamLock> {
  return validateUpstreamLock(JSON.parse(await fs.readFile(file, 'utf8')) as unknown);
}

function sourceUrl(skill: UpstreamSkill, file: UpstreamFile): string {
  const segments = [...skill.repo.split('/'), skill.commit, ...skill.path.split('/'), ...file.path.split('/')];
  return `https://raw.githubusercontent.com/${segments.map(encodeURIComponent).join('/')}`;
}

async function fetchVerified(url: string, expected: string, fetcher: typeof fetch): Promise<Buffer> {
  let response: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetcher(url, { redirect: 'error', signal: AbortSignal.timeout(60_000) });
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) break;
      await response.body?.cancel();
    } catch (error) {
      if (attempt === 2) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  if (!response) throw new Error(`Upstream download failed: ${url}`);
  if (!response.ok) throw new Error(`Upstream download failed (${response.status}): ${url}`);
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > MAX_FILE_BYTES) throw new Error(`Upstream file exceeds size limit: ${url}`);
  if (!response.body) throw new Error(`Upstream response is empty: ${url}`);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > MAX_FILE_BYTES) throw new Error(`Upstream file exceeds size limit: ${url}`);
    chunks.push(chunk);
  }
  const content = Buffer.concat(chunks);
  if (createHash('sha256').update(content).digest('hex') !== expected) {
    throw new Error(`Upstream SHA-256 mismatch: ${url}`);
  }
  return content;
}

async function copyRegularTree(source: string, destination: string): Promise<void> {
  if ((await fs.lstat(source)).isSymbolicLink()) throw new Error(`Symlink in portable profile: ${source}`);
  await fs.mkdir(destination, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink in portable profile: ${from}`);
    if (entry.isDirectory()) await copyRegularTree(from, to);
    else if (entry.isFile()) await fs.copyFile(from, to);
    else throw new Error(`Unsupported file in portable profile: ${from}`);
  }
}

/** Download pinned GitHub Skills into an isolated local profile before the normal install plan runs. */
export async function prepareUpstreamProfile(
  bundleDir: string,
  options: {
    fetcher?: typeof fetch;
    log?: (line: string) => void;
    tempRoot?: string;
    lockPath?: string;
    selectedSkills?: string[];
    /** null omits rules; a string replaces the profile's rules template. */
    rulesContent?: string | null;
  } = {},
): Promise<{ profileDir: string; cleanup: () => Promise<void> }> {
  const source = path.resolve(bundleDir);
  const lock = await readUpstreamLock(options.lockPath ?? path.join(source, 'upstream.lock.json'));
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'profile.json'), 'utf8')) as ProfileManifest;
  const available = new Map((manifest.skills ?? []).map((skill) => [skill.name, skill]));
  for (const skill of lock.skills) {
    const entry = available.get(skill.name);
    if (!entry || entry.source !== `skills/${skill.name}`) {
      throw new Error(`Upstream skill ${skill.name} does not match profile.json`);
    }
  }
  const requested = options.selectedSkills ?? [...available.keys()];
  if (new Set(requested).size !== requested.length) throw new Error('Duplicate selected Skill');
  for (const name of requested) if (!available.has(name)) throw new Error(`Unknown selected Skill: ${name}`);
  const chosen = new Set(requested);
  const selectedManifest: ProfileManifest = {
    ...manifest,
    skills: (manifest.skills ?? []).filter((skill) => chosen.has(skill.name)),
    rules: options.rulesContent === null ? undefined : manifest.rules,
  };
  const remoteSkills = lock.skills.filter((skill) => chosen.has(skill.name));
  const profileName = path.basename(source);
  if (!NAME.test(profileName) || manifest.name !== profileName) throw new Error('Portable profile name mismatch');
  options.log?.(`Upstream source plan: ${remoteSkills.length} selected GitHub Skills at pinned commits; verify all files before the install plan.`);
  const root = await fs.mkdtemp(path.join(options.tempRoot ?? os.tmpdir(), 'skillfit-upstream-'));
  const destination = path.join(root, profileName);
  const cleanup = async (): Promise<void> => { await fs.rm(root, { recursive: true, force: true }); };
  try {
    await fs.mkdir(destination);
    await fs.writeFile(path.join(destination, 'profile.json'), `${JSON.stringify(selectedManifest, null, 2)}\n`);
    if (selectedManifest.rules) {
      if (selectedManifest.rules.template !== 'rules/global.md') throw new Error('Unsupported rules path in portable profile');
      await copyRegularTree(path.join(source, 'rules'), path.join(destination, 'rules'));
      if (options.rulesContent !== undefined && options.rulesContent !== null) {
        await fs.writeFile(path.join(destination, 'rules', 'global.md'), options.rulesContent);
      }
    }
    for (const skill of selectedManifest.skills ?? []) {
      if (skill.source !== `skills/${skill.name}` || !NAME.test(skill.name)) throw new Error(`Invalid portable source for ${skill.name}`);
      if (!lock.skills.some((remote) => remote.name === skill.name)) {
        await copyRegularTree(path.join(source, 'skills', skill.name), path.join(destination, 'skills', skill.name));
      }
    }
    for (const skill of remoteSkills) {
      for (const file of skill.files) {
        const url = sourceUrl(skill, file);
        const content = await fetchVerified(url, file.sha256, options.fetcher ?? fetch);
        const target = path.join(destination, 'skills', skill.name, ...file.path.split('/'));
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, content);
      }
      options.log?.(`Verified ${skill.name} from ${skill.repo}@${skill.commit.slice(0, 12)}`);
      const metadataPath = path.join(destination, 'skills', skill.name, 'agents', 'openai.yaml');
      const metadata = await fs.readFile(metadataPath, 'utf8').catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      });
      if (isImplicitInvocationDisabled(metadata) !== (skill.explicitOnly ?? false)) {
        throw new Error(`Invocation policy mismatch for ${skill.name} in upstream lock`);
      }
    }
    await loadProfile(root, profileName);
    return { profileDir: destination, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
