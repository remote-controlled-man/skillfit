import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { agentIds, getAgent, skillUserDirSpecs } from '../agents.js';
export function resolveHome(dirPattern, homeDir) {
    return dirPattern.startsWith('~') ? join(homeDir, dirPattern.slice(1)) : dirPattern;
}
function matchSegment(name, pattern) {
    if (pattern === '*')
        return true;
    const star = pattern.indexOf('*');
    if (star === -1)
        return name === pattern;
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    return (name.startsWith(prefix) &&
        name.endsWith(suffix) &&
        name.length >= prefix.length + suffix.length);
}
export function walkGlob(rootDir, pattern) {
    const segments = pattern.split('/');
    const out = [];
    const walk = (dir, depth) => {
        if (depth === segments.length) {
            if (statSync(dir).isFile())
                out.push(dir);
            return;
        }
        const segment = segments[depth];
        if (segment === undefined)
            return;
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        if (segment === '**') {
            walk(dir, depth + 1);
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    walk(join(dir, entry.name), depth);
                }
            }
            return;
        }
        for (const entry of entries) {
            if (matchSegment(entry.name, segment)) {
                walk(join(dir, entry.name), depth + 1);
            }
        }
    };
    walk(rootDir, 0);
    return out.sort();
}
function extractSkillNames(event, cfg) {
    const names = [];
    const skillKey = cfg.skillKey ?? 'skill';
    if (cfg.wireShape === 'flat-tool-call') {
        let target = event;
        if (event['type'] === 'context.append_loop_event') {
            const nested = event['event'];
            if (typeof nested === 'object' && nested !== null) {
                target = nested;
            }
        }
        if (target['type'] === 'tool.call' && target['name'] === cfg.skillToolName) {
            const args = target['args'];
            if (typeof args === 'object' && args !== null) {
                const skill = args[skillKey];
                if (typeof skill === 'string' && skill !== '')
                    names.push(skill);
            }
        }
        return names;
    }
    if (cfg.wireShape === 'codex-rollout') {
        if (event['type'] !== 'response_item')
            return names;
        const payload = event['payload'];
        if (typeof payload !== 'object' || payload === null)
            return names;
        const record = payload;
        if (record['type'] !== 'custom_tool_call')
            return names;
        const input = record['input'];
        if (typeof input !== 'string')
            return names;
        const normalized = input.replace(/\\+/g, '/');
        for (const match of normalized.matchAll(/skills\/([\w.-]+)\/SKILL\.md/gi)) {
            const name = match[1];
            if (name)
                names.push(name);
        }
        return names;
    }
    if (event['type'] !== 'assistant')
        return names;
    const message = event['message'];
    const content = typeof message === 'object' && message !== null
        ? message['content']
        : undefined;
    if (!Array.isArray(content))
        return names;
    for (const block of content) {
        if (typeof block !== 'object' || block === null)
            continue;
        const record = block;
        if (record['type'] === 'tool_use' && record['name'] === cfg.skillToolName) {
            const input = record['input'];
            if (typeof input === 'object' && input !== null) {
                const skill = input[skillKey];
                if (typeof skill === 'string' && skill !== '')
                    names.push(skill);
            }
        }
    }
    return names;
}
function sessionKey(relPath, wireShape) {
    const parts = relPath.split('/');
    if (wireShape === 'flat-tool-call') {
        return parts[1] ?? relPath;
    }
    const last = parts[parts.length - 1] ?? relPath;
    return last.replace(/\.jsonl$/, '');
}
async function scanTranscript(file, cfg) {
    const fires = new Map();
    const stream = createReadStream(file, { encoding: 'utf8' });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    try {
        for await (const line of rl) {
            const trimmed = line.trim();
            if (trimmed === '' || !trimmed.startsWith('{'))
                continue;
            let event;
            try {
                event = JSON.parse(trimmed);
            }
            catch {
                continue;
            }
            if (typeof event !== 'object' || event === null)
                continue;
            for (const name of extractSkillNames(event, cfg)) {
                fires.set(name, (fires.get(name) ?? 0) + 1);
            }
        }
    }
    finally {
        rl.close();
        stream.destroy();
    }
    return fires;
}
export function installedUserSkills(agent, homeDir, env = {}) {
    const skills = new Map();
    for (const dirPattern of skillUserDirSpecs(agent, env)) {
        const dir = resolveHome(dirPattern, homeDir);
        if (!existsSync(dir))
            continue;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.isDirectory() && existsSync(join(dir, entry.name, 'SKILL.md'))) {
                if (!skills.has(entry.name))
                    skills.set(entry.name, join(dir, entry.name));
            }
        }
    }
    return [...skills.entries()].map(([name, dir]) => ({ name, dir })).sort((a, b) => a.name.localeCompare(b.name));
}
function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
export function measureSkillTax(skillDir) {
    const file = join(skillDir, 'SKILL.md');
    const empty = { descTokens: 0, bodyTokens: 0 };
    if (!existsSync(file))
        return empty;
    const text = readFileSync(file, 'utf8');
    let description = '';
    if (text.startsWith('---')) {
        const end = text.indexOf('\n---', 3);
        if (end !== -1) {
            const frontmatter = text.slice(3, end);
            const match = /^description:\s*(.+)$/m.exec(frontmatter);
            description = match?.[1]?.trim() ?? '';
        }
    }
    return { descTokens: estimateTokens(description), bodyTokens: estimateTokens(text) };
}
function median(values) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
        : (sorted[mid] ?? 0);
}
export async function collectAgentReceipt(agent, homeDir, env = {}) {
    const emptyTax = { descTokensTotal: 0, bodyTokensMedian: 0, heaviest: [] };
    const cfg = agent.sessions;
    if (!cfg) {
        return {
            agentId: agent.id,
            sessionsDir: '',
            present: false,
            sessionsFound: 0,
            transcriptsRead: 0,
            skills: [],
            installed: [],
            installedCount: 0,
            neverFired: [],
            tax: emptyTax,
        };
    }
    const homeOverride = cfg.homeOverride;
    const overrideRoot = homeOverride === undefined ? undefined : env[homeOverride.env];
    const sessionsDir = overrideRoot
        ? resolve(overrideRoot, homeOverride.relativePath)
        : resolveHome(cfg.dir, homeDir);
    const installed = installedUserSkills(agent, homeDir, env);
    const taxes = installed.map((skill) => ({ name: skill.name, ...measureSkillTax(skill.dir) }));
    const tax = {
        descTokensTotal: taxes.reduce((sum, entry) => sum + entry.descTokens, 0),
        bodyTokensMedian: median(taxes.map((entry) => entry.bodyTokens)),
        heaviest: [...taxes]
            .sort((a, b) => b.descTokens - a.descTokens)
            .filter((entry) => entry.descTokens > 0)
            .slice(0, 3)
            .map((entry) => ({ name: entry.name, descTokens: entry.descTokens })),
    };
    if (!existsSync(sessionsDir)) {
        return {
            agentId: agent.id,
            sessionsDir,
            present: false,
            sessionsFound: 0,
            transcriptsRead: 0,
            skills: [],
            installed: installed.map((skill) => skill.name),
            installedCount: installed.length,
            neverFired: installed.map((skill) => skill.name),
            tax,
        };
    }
    const transcripts = walkGlob(sessionsDir, cfg.transcriptGlob);
    const perSkill = new Map();
    const allSessions = new Set();
    for (const file of transcripts) {
        const rel = relative(sessionsDir, file).split('\\').join('/');
        const session = sessionKey(rel, cfg.wireShape);
        allSessions.add(session);
        const mtime = statSync(file).mtimeMs;
        const fires = await scanTranscript(file, cfg);
        for (const [name, count] of fires) {
            const entry = perSkill.get(name) ?? { fires: 0, sessions: new Set(), lastSeen: 0 };
            entry.fires += count;
            entry.sessions.add(session);
            entry.lastSeen = Math.max(entry.lastSeen, mtime);
            perSkill.set(name, entry);
        }
    }
    const skills = [...perSkill.entries()]
        .map(([name, entry]) => ({
        name,
        fires: entry.fires,
        sessionCount: entry.sessions.size,
        lastSeen: entry.lastSeen,
    }))
        .sort((a, b) => b.fires - a.fires || a.name.localeCompare(b.name));
    return {
        agentId: agent.id,
        sessionsDir,
        present: true,
        sessionsFound: allSessions.size,
        transcriptsRead: transcripts.length,
        skills,
        installed: installed.map((skill) => skill.name),
        installedCount: installed.length,
        neverFired: installed.filter((skill) => !perSkill.has(skill.name)).map((skill) => skill.name),
        tax,
    };
}
export async function collectReceipts(options = {}) {
    const homeDir = options.homeDir ?? homedir();
    const env = options.env ?? (options.homeDir === undefined ? process.env : {});
    const ids = options.agent ? [options.agent] : agentIds();
    const receipts = [];
    for (const id of ids) {
        receipts.push(await collectAgentReceipt(getAgent(id), homeDir, env));
    }
    return receipts;
}
