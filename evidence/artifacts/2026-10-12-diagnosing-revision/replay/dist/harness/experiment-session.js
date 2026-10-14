import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAgent, skillUserDirSpecs } from '../agents.js';
import { parseFrontmatter } from '../frontmatter.js';
import { hashFileSet, sha256File, sha256Text } from './hash.js';
function skillInventory(root) {
    if (!existsSync(root))
        return { root, entries: ['missing'] };
    return { root, entries: [realpathSync(root), ...readdirSync(root).sort().map(entry => {
                const path = join(root, entry);
                return `${entry}:${lstatSync(path).isSymbolicLink() ? readlinkSync(path) : 'entry'}:${realpathSync(path)}`;
            })] };
}
export function validateCallBudget(planned, ceiling) {
    if (!Number.isSafeInteger(planned) || planned < 1 ||
        (ceiling !== undefined && (!Number.isSafeInteger(ceiling) || ceiling < 1))) {
        throw new Error('Call budget must be a positive safe integer.');
    }
    const max = ceiling ?? planned;
    if (planned > max)
        throw new Error(`Experiment needs ${planned} model calls, exceeding --max-calls ${max}. Reduce the declared tasks/trials before running.`);
    return max;
}
function inside(root, path) {
    const rel = relative(resolve(root), resolve(path));
    if (rel === '')
        return true;
    // path.relative returns an absolute path when two Windows paths are on different drives.
    if (isAbsolute(rel))
        return false;
    return !rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith(sep);
}
function physicalPath(path) {
    let parent = resolve(path);
    const parts = [];
    while (!existsSync(parent)) {
        parts.unshift(basename(parent));
        parent = dirname(parent);
    }
    return join(realpathSync(parent), ...parts);
}
function filesUnder(root, exclude) {
    const out = [];
    const walk = (rel) => {
        for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
            const child = rel ? `${rel}/${entry.name}` : entry.name;
            if (entry.name === '.git' || (exclude && inside(exclude, join(root, child))))
                continue;
            if (entry.isSymbolicLink())
                throw new Error(`Unpinned symbolic link in experiment input: ${join(root, child)}`);
            if (entry.isDirectory())
                walk(child);
            else if (entry.isFile())
                out.push(child);
            else
                throw new Error(`Unsupported experiment input: ${join(root, child)}`);
        }
    };
    walk('');
    return out.sort();
}
function pin(label, root, exclude) {
    const files = filesUnder(root, exclude);
    return { label, root, files, sha256: hashFileSet(root, files), ...(exclude ? { exclude } : {}) };
}
function expand(spec, home) {
    return spec === '~' ? home : spec.startsWith('~/') ? join(home, spec.slice(2)) : resolve(spec);
}
/** Only pure trust registrations for the declared workspaces are excluded from the byte contract. */
export function normalizeProjectTrust(text, trust, workspaces) {
    const allowed = new Set(workspaces.map(path => resolve(path)));
    const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const header = new RegExp(`^\\[${escape(trust.table)}\\.("(?:[^"\\\\\\n]|\\\\.)*"|'[^'\\n]*')\\]\\r?\\n([^[]*)`, 'gm');
    const stripped = text.replace(header, (block, quoted, body) => {
        let path;
        try {
            path = quoted.startsWith('"') ? JSON.parse(quoted) : quoted.slice(1, -1);
        }
        catch {
            return block;
        }
        const value = body.trim();
        return allowed.has(resolve(path)) &&
            (value === `${trust.field} = "${trust.value}"` || value === `${trust.field} = '${trust.value}'`) ? '' : block;
    });
    // Codex appends blank separator lines when registering projects. Preserve all other bytes.
    return stripped.replace(/\n+$/, '\n');
}
function configState(path, trust, workspaces) {
    try {
        const raw = readFileSync(path, 'utf8');
        return { path, state: 'file', sha256: sha256Text(trust ? normalizeProjectTrust(raw, trust, workspaces) : raw), ...(trust ? { trust } : {}) };
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw new Error(`Cannot fingerprint agent configuration: ${path}`);
        return { path, state: 'missing', sha256: null, ...(trust ? { trust } : {}) };
    }
}
function probeVersion(argv) {
    try {
        const output = execFileSync(argv[0], argv.slice(1), {
            encoding: 'utf8',
            timeout: 5000,
            maxBuffer: 65536,
            stdio: ['ignore', 'pipe', 'ignore'],
            // npm CLI shims are .cmd on Windows and cannot be execFile'd directly.
            shell: process.platform === 'win32',
            windowsHide: true,
        });
        return output.split(/\r?\n/).find(line => /\d+\.\d+/.test(line))?.slice(0, 256) ?? null;
    }
    catch {
        return null;
    }
}
function selectedSettings(agent, home, env) {
    const settings = agent.headless.runtime?.settings;
    if (!settings)
        return { path: null, fields: {} };
    const path = settings.homeOverride && env[settings.homeOverride.env]
        ? join(env[settings.homeOverride.env], settings.homeOverride.relativePath) : expand(settings.file, home);
    const fields = {};
    if (!existsSync(path))
        return { path, fields };
    const text = readFileSync(path, 'utf8');
    if (settings.format === 'json') {
        const data = JSON.parse(text);
        for (const key of settings.keys)
            if (typeof data[key] === 'string')
                fields[key] = data[key];
    }
    else {
        const top = text.split(/^\s*\[/m)[0] ?? '';
        for (const key of settings.keys) {
            const line = top.split(/\r?\n/).find(line => line.trimStart().startsWith(`${key} `) || line.startsWith(`${key}=`));
            const match = line?.match(/=\s*("(?:[^"\\]|\\.)*"|'[^']*')\s*(?:#.*)?$/);
            if (match)
                fields[key] = match[1].startsWith('"') ? JSON.parse(match[1]) : match[1].slice(1, -1);
        }
    }
    return { path, fields };
}
export class ExperimentSession {
    groupDir;
    planSha256;
    plannedCalls;
    maxCalls;
    inputs;
    configs;
    workspaces;
    inventories = [];
    callsStarted = 0;
    callsFinished = 0;
    stopReason = null;
    finished = false;
    constructor(options) {
        this.plannedCalls = options.plannedCalls;
        this.maxCalls = validateCallBudget(options.plannedCalls, options.maxCalls);
        this.groupDir = resolve(options.groupDir);
        this.workspaces = options.workspaces.map(path => resolve(path));
        if (existsSync(this.groupDir))
            throw new Error(`Run group directory already exists: ${this.groupDir}`);
        for (const input of [options.target.sourceDir, ...(options.baselineTarget ? [options.baselineTarget.sourceDir] : []), ...options.bench.tasks.map(task => join(options.bench.dir, task.fixture))]) {
            if (inside(physicalPath(input), physicalPath(this.groupDir)))
                throw new Error('Experiment output must be outside the Skill/overlay and fixture inputs; run the CLI from their parent directory.');
        }
        const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
        this.inputs = [pin('bench', options.bench.dir, this.groupDir), pin('target', options.target.sourceDir), pin('implementation', join(packageRoot, 'dist'))];
        if (options.baselineTarget)
            this.inputs.push(pin('baseline Skill', options.baselineTarget.sourceDir));
        this.configs = [];
        const env = options.env ?? process.env;
        let configured = {};
        let cliVersion = null;
        const warnings = ['Inherited agent configuration is not isolated; only recorded matrix paths and runtime files are checked. Toolchains, server-side models and unlisted Skills/plugins may remain unrecorded.'];
        if (options.agent && (!options.injected || options.homeDir !== undefined)) {
            const agent = getAgent(options.agent);
            const home = options.homeDir ?? homedir();
            const settings = selectedSettings(agent, home, env);
            configured = settings.fields;
            const override = agent.rules.userHomeOverride;
            const paths = new Set([...agent.rules.userFiles, ...agent.mcp.userFiles, ...agent.hooks.userFiles, ...agent.detect.userFiles].map(spec => {
                if (spec === agent.headless.runtime?.settings?.file && settings.path)
                    return settings.path;
                if (override && env[override.env] && spec === agent.rules.userFiles[0])
                    return join(env[override.env], override.relativePath);
                return expand(spec, home);
            }));
            if (override?.overrideRelativePath && agent.rules.userFiles[0]) {
                const root = env[override.env] ?? dirname(expand(agent.rules.userFiles[0], home));
                paths.add(join(root, override.overrideRelativePath));
            }
            if (settings.path)
                paths.add(settings.path);
            const match = agent.headless.projectTrustConfigArg?.match(/^([^.]+)\.'\{workdir\}'\.([^=]+)='([^']+)'$/);
            const trust = match ? { table: match[1], field: match[2], value: match[3] } : undefined;
            for (const path of paths)
                this.configs.push(configState(path, path === settings.path ? trust : undefined, this.workspaces));
            for (const spec of new Set([...skillUserDirSpecs(agent, env), ...agent.skills.sharedDirs.filter(path => path.startsWith('~/'))])) {
                const root = expand(spec, home);
                this.inventories.push(skillInventory(root));
                if (!existsSync(root))
                    continue;
                for (const entry of readdirSync(root)) {
                    const skillDir = join(root, entry);
                    const manifest = join(skillDir, 'SKILL.md');
                    if (existsSync(manifest) && (entry === options.target.name || parseFrontmatter(readFileSync(manifest, 'utf8'))?.['name'] === options.target.name) && options.target.kind === 'skill') {
                        throw new Error(`Baseline contamination: evaluated Skill is already available globally at ${skillDir}. Use a controlled agent profile.`);
                    }
                }
                // Installed directory aliases are normal; pin their resolved contents and their inventory.
                for (const entry of readdirSync(root)) {
                    const path = realpathSync(join(root, entry));
                    if (lstatSync(path).isDirectory())
                        this.inputs.push(pin('global Skill', path));
                    else
                        this.configs.push(configState(path, undefined, this.workspaces));
                }
            }
            if (agent.headless.runtime?.versionArgv && !options.injected)
                cliVersion = (options.versionProbe ?? probeVersion)(agent.headless.runtime.versionArgv);
            else if (options.versionProbe && agent.headless.runtime?.versionArgv)
                cliVersion = options.versionProbe(agent.headless.runtime.versionArgv);
        }
        else
            warnings.push('Injected executor: user configuration and CLI version were not automatically probed.');
        const plan = { schemaVersion: 1, createdAt: new Date().toISOString(), nodeVersion: process.version,
            packageVersion: JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')).version,
            agent: options.agent ?? null, cliVersion, configuredSettings: configured, servedModel: 'unrecorded',
            plannedCalls: this.plannedCalls, maxCalls: this.maxCalls, workspaces: this.workspaces,
            inputs: this.inputs, configurations: this.configs, skillInventories: this.inventories, warnings, details: options.details };
        const bytes = JSON.stringify(plan, null, 2) + '\n';
        this.planSha256 = sha256Text(bytes);
        mkdirSync(this.groupDir, { recursive: true });
        writeFileSync(join(this.groupDir, '_plan.json'), bytes, { flag: 'wx' });
        if (sha256File(join(this.groupDir, '_plan.json')) !== this.planSha256)
            throw new Error('Frozen plan write verification failed.');
    }
    check() {
        if (this.stopReason)
            throw new Error(this.stopReason);
        try {
            for (const input of this.inputs)
                if (pin(input.label, input.root, input.exclude).sha256 !== input.sha256)
                    throw new Error(`Frozen ${input.label} input changed; no further calls.`);
            for (const config of this.configs) {
                const current = configState(config.path, config.trust, this.workspaces);
                if (current.state !== config.state || current.sha256 !== config.sha256)
                    throw new Error(`Agent configuration changed: ${config.path}; no further calls.`);
            }
            for (const inventory of this.inventories)
                if (JSON.stringify(skillInventory(inventory.root)) !== JSON.stringify(inventory)) {
                    throw new Error(`Global Skill inventory changed: ${inventory.root}; no further calls.`);
                }
        }
        catch (error) {
            this.stopReason = error.message;
            throw error;
        }
    }
    wrap(executor, role) {
        return { describe: () => executor.describe(), run: async (prompt, workdir) => {
                this.check();
                if (this.callsStarted >= Math.min(this.plannedCalls, this.maxCalls)) {
                    this.stopReason = 'Declared call ceiling reached; no further calls.';
                    throw new Error(this.stopReason);
                }
                const call = ++this.callsStarted;
                const ledger = join(this.groupDir, '_calls.jsonl');
                appendFileSync(ledger, JSON.stringify({ event: 'started', call, role, workdir, at: new Date().toISOString(), promptSha256: sha256Text(prompt) }) + '\n');
                try {
                    const result = await executor.run(prompt, workdir);
                    this.callsFinished++;
                    appendFileSync(ledger, JSON.stringify({ event: 'finished', call, at: new Date().toISOString() }) + '\n');
                    try {
                        this.check();
                    }
                    catch {
                        if (role === 'judge')
                            throw new Error(this.stopReason);
                        return { ...result, guardError: this.stopReason };
                    }
                    return result;
                }
                catch (error) {
                    if (!this.stopReason)
                        this.stopReason = `${role} executor failed; inspect the per-trial error receipt. No further calls.`;
                    if (this.callsFinished < call) {
                        this.callsFinished++;
                        appendFileSync(ledger, JSON.stringify({ event: 'failed', call, at: new Date().toISOString() }) + '\n');
                    }
                    throw error;
                }
            } };
    }
    summary() {
        return { schemaVersion: 1, status: this.stopReason ? 'stopped' : this.callsFinished === this.plannedCalls ? 'completed' : 'incomplete',
            plannedCalls: this.plannedCalls, maxCalls: this.maxCalls, callsStarted: this.callsStarted, callsFinished: this.callsFinished,
            stopReason: this.stopReason, planSha256: this.planSha256 };
    }
    settle() {
        try {
            this.check();
        }
        catch { /* Preserve the first stop reason in the manifest. */ }
    }
    finish(error, result, resultName = 'manifest.json') {
        if (this.finished)
            return;
        this.finished = true;
        if (error && !this.stopReason)
            this.stopReason = 'Experiment setup or execution stopped; inspect the command error and retained receipts.';
        this.settle();
        if (result && JSON.stringify(result.experiment) !== JSON.stringify(this.summary())) {
            const path = join(this.groupDir, resultName);
            writeFileSync(join(this.groupDir, `_before-finalize-${resultName}`), readFileSync(path), { flag: 'wx' });
            result.experiment = this.summary();
            if (result.warnings)
                result.warnings.push('Experiment stopped during final verification; no installation recommendation. Inspect _session.json.');
            writeFileSync(path, JSON.stringify(result, null, 2) + '\n');
        }
        writeFileSync(join(this.groupDir, '_session.json'), JSON.stringify(this.summary(), null, 2) + '\n', { flag: 'wx' });
        const files = {};
        const links = {};
        const walk = (rel) => {
            for (const entry of readdirSync(join(this.groupDir, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
                if (entry.name === '.git')
                    continue;
                const child = rel ? `${rel}/${entry.name}` : entry.name;
                const path = join(this.groupDir, child);
                if (entry.isSymbolicLink())
                    links[child] = readlinkSync(path);
                else if (entry.isDirectory())
                    walk(child);
                else if (entry.isFile())
                    files[child] = sha256File(path);
            }
        };
        walk('');
        const index = { schemaVersion: 1, planSha256: this.planSha256, files, links };
        writeFileSync(join(this.groupDir, '_artifacts.json'), JSON.stringify(index, null, 2) + '\n', { flag: 'wx' });
    }
}
