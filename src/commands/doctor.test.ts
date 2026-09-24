import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import {
  collectDoctorReport,
  formatDoctorReport,
  parseFrontmatter,
  runDoctor,
  type Check,
  type DoctorOptions,
  type DoctorReport,
} from './doctor.js';

const VALID_SKILL_MD = '---\nname: demo\ndescription: does things\n---\n\n# Demo\n';

const tempDirs: string[] = [];

after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'skillfit-doctor-'));
  tempDirs.push(dir);
  return dir;
}

function makeOptions(homeDir: string, cwd: string, extra: Partial<DoctorOptions> = {}): DoctorOptions {
  return { homeDir, cwd, which: () => null, ...extra };
}

function writeFile(root: string, rel: string, content: string): void {
  const target = path.join(root, ...rel.split('/'));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function writeSkill(homeDir: string, skillsDir: string, name: string, skillMd: string | null): void {
  const dir = path.join(homeDir, ...skillsDir.split('/'), name);
  mkdirSync(dir, { recursive: true });
  if (skillMd !== null) writeFileSync(path.join(dir, 'SKILL.md'), skillMd);
}

function healthChecks(report: DoctorReport, agentId: string, section: string): Check[] {
  const agent = report.health.find((h) => h.id === agentId);
  assert.ok(agent, `expected health report for ${agentId}`);
  const found = agent.sections.find((s) => s.title === section);
  assert.ok(found, `expected section ${section}`);
  return found.checks;
}

function hasCheck(checks: Check[], status: Check['status'], pattern: RegExp): boolean {
  return checks.some((c) => c.status === status && pattern.test(c.message));
}

test('parseFrontmatter parses name and description', () => {
  const fields = parseFrontmatter('---\nname: demo\ndescription: does things\n---\nbody');
  assert.equal(fields?.name, 'demo');
  assert.equal(fields?.description, 'does things');
});

test('parseFrontmatter handles CRLF and quoted values', () => {
  const fields = parseFrontmatter('---\r\nname: "demo skill"\r\ndescription: \'x\'\r\n---\r\n');
  assert.equal(fields?.name, 'demo skill');
  assert.equal(fields?.description, 'x');
});

test('parseFrontmatter joins folded block scalars', () => {
  const fields = parseFrontmatter('---\nname: demo\ndescription: >\n  first line\n  second line\n---\n');
  assert.equal(fields?.description, 'first line second line');
});

test('parseFrontmatter returns null without a closing fence', () => {
  assert.equal(parseFrontmatter('---\nname: demo\n'), null);
  assert.equal(parseFrontmatter('no frontmatter here'), null);
});

test('parseFrontmatter tolerates a BOM', () => {
  const fields = parseFrontmatter('\uFEFF---\nname: demo\n---\n');
  assert.equal(fields?.name, 'demo');
});

test('detects nothing on a clean machine', () => {
  const report = collectDoctorReport(makeOptions(tempDir(), tempDir()));
  assert.equal(report.detection.length, 3);
  assert.ok(report.detection.every((d) => !d.detected && d.evidence.length === 0));
  assert.equal(report.health.length, 0);
});

test('detects agents through user dirs and files with evidence', () => {
  const home = tempDir();
  mkdirSync(path.join(home, '.claude'));
  writeFile(home, '.claude.json', '{}');
  const report = collectDoctorReport(makeOptions(home, tempDir()));
  const claude = report.detection.find((d) => d.id === 'claude-code');
  assert.ok(claude?.detected);
  assert.ok(claude.evidence.some((e) => e.includes('directory ~/.claude')));
  assert.ok(claude.evidence.some((e) => e.includes('file ~/.claude.json')));
  assert.equal(report.health.length, 1);
  assert.equal(report.health[0]?.id, 'claude-code');
});

test('detects agents through binaries via injected which', () => {
  const which = (binary: string): string | null => (binary === 'codex' ? '/usr/local/bin/codex' : null);
  const report = collectDoctorReport(makeOptions(tempDir(), tempDir(), { which }));
  const codex = report.detection.find((d) => d.id === 'codex');
  assert.ok(codex?.detected);
  assert.ok(codex.evidence.some((e) => e.includes('binary "codex"') && e.includes('/usr/local/bin/codex')));
});

test('--agent forces inspection of an undetected agent', () => {
  const report = collectDoctorReport(makeOptions(tempDir(), tempDir(), { agent: 'kimi-code' }));
  assert.equal(report.health.length, 1);
  assert.equal(report.health[0]?.id, 'kimi-code');
  assert.equal(report.health[0]?.detected, false);
});

test('unknown agent id throws from the pure function', () => {
  assert.throws(() => collectDoctorReport(makeOptions(tempDir(), tempDir(), { agent: 'nope' })), /Unknown agent/);
});

test('small CLAUDE.md passes with line and byte stats', () => {
  const home = tempDir();
  writeFile(home, '.claude/CLAUDE.md', '# Rules\n\nBe brief.\n');
  const checks = healthChecks(collectDoctorReport(makeOptions(home, tempDir(), { agent: 'claude-code' })), 'claude-code', 'Rules');
  assert.ok(hasCheck(checks, 'PASS', /~\/\.claude\/CLAUDE\.md — 3 lines, \d+ B/));
});

test('CLAUDE.md over 200 lines warns about bloat', () => {
  const home = tempDir();
  writeFile(home, '.claude/CLAUDE.md', Array.from({ length: 250 }, (_, i) => `line ${i}`).join('\n'));
  const checks = healthChecks(collectDoctorReport(makeOptions(home, tempDir(), { agent: 'claude-code' })), 'claude-code', 'Rules');
  assert.ok(hasCheck(checks, 'WARN', /250 lines.*exceeds 200 lines/));
});

test('AGENTS.md over 32 KiB warns about the budget', () => {
  const home = tempDir();
  writeFile(home, '.codex/AGENTS.md', 'x'.repeat(40 * 1024));
  const checks = healthChecks(collectDoctorReport(makeOptions(home, tempDir(), { agent: 'codex' })), 'codex', 'Rules');
  assert.ok(hasCheck(checks, 'WARN', /exceeds the 32 KiB/));
});

test('rules notes from the matrix are surfaced', () => {
  const checks = healthChecks(
    collectDoctorReport(makeOptions(tempDir(), tempDir(), { agent: 'claude-code' })),
    'claude-code',
    'Rules',
  );
  assert.ok(hasCheck(checks, 'INFO', /notes: .*AGENTS\.md requires an @import bridge/));
});

test('claude-code warns when project AGENTS.md lacks a bridge', () => {
  const cwd = tempDir();
  writeFile(cwd, 'AGENTS.md', '# project rules\n');
  const checks = healthChecks(collectDoctorReport(makeOptions(tempDir(), cwd, { agent: 'claude-code' })), 'claude-code', 'Rules');
  assert.ok(hasCheck(checks, 'WARN', /does not read it/));
  assert.ok(checks.some((c) => c.message.includes('@AGENTS.md')));
});

test('claude-code warns when CLAUDE.md exists without the import', () => {
  const cwd = tempDir();
  writeFile(cwd, 'AGENTS.md', '# project rules\n');
  writeFile(cwd, 'CLAUDE.md', '# Claude rules\n');
  const checks = healthChecks(collectDoctorReport(makeOptions(tempDir(), cwd, { agent: 'claude-code' })), 'claude-code', 'Rules');
  assert.ok(hasCheck(checks, 'WARN', /does not read it/));
});

test('claude-code passes when CLAUDE.md imports AGENTS.md', () => {
  const cwd = tempDir();
  writeFile(cwd, 'AGENTS.md', '# project rules\n');
  writeFile(cwd, 'CLAUDE.md', '# Claude rules\n\n@AGENTS.md\n');
  const checks = healthChecks(collectDoctorReport(makeOptions(tempDir(), cwd, { agent: 'claude-code' })), 'claude-code', 'Rules');
  assert.ok(hasCheck(checks, 'PASS', /bridged into CLAUDE\.md/));
});

test('agents that read AGENTS.md natively get no bridge warning', () => {
  const cwd = tempDir();
  writeFile(cwd, 'AGENTS.md', '# project rules\n');
  const checks = healthChecks(collectDoctorReport(makeOptions(tempDir(), cwd, { agent: 'codex' })), 'codex', 'Rules');
  assert.ok(!checks.some((c) => c.message.includes('does not read it')));
});

test('skills scan validates SKILL.md frontmatter', () => {
  const home = tempDir();
  writeSkill(home, '.claude/skills', 'good', VALID_SKILL_MD);
  writeSkill(home, '.claude/skills', 'no-file', null);
  writeSkill(home, '.claude/skills', 'broken', 'no frontmatter at all');
  writeSkill(home, '.claude/skills', 'missing-fields', '---\nname: only\n---\n');
  const checks = healthChecks(collectDoctorReport(makeOptions(home, tempDir(), { agent: 'claude-code' })), 'claude-code', 'Skills');
  assert.ok(hasCheck(checks, 'PASS', /1 valid skill/));
  assert.ok(hasCheck(checks, 'WARN', /no-file — no SKILL\.md/));
  assert.ok(hasCheck(checks, 'WARN', /broken\/SKILL\.md — missing or malformed YAML frontmatter/));
  assert.ok(hasCheck(checks, 'WARN', /missing-fields\/SKILL\.md — frontmatter missing required field\(s\): description/));
});

test('more than 10 skills triggers an overload warning', () => {
  const home = tempDir();
  for (let i = 0; i < 11; i++) writeSkill(home, '.claude/skills', `skill-${i}`, VALID_SKILL_MD);
  const checks = healthChecks(collectDoctorReport(makeOptions(home, tempDir(), { agent: 'claude-code' })), 'claude-code', 'Skills');
  assert.ok(hasCheck(checks, 'PASS', /11 valid skill/));
  assert.ok(hasCheck(checks, 'WARN', /11 skills installed \(> 10\)/));
});

test('no skills directories is informational', () => {
  const checks = healthChecks(collectDoctorReport(makeOptions(tempDir(), tempDir(), { agent: 'claude-code' })), 'claude-code', 'Skills');
  assert.ok(hasCheck(checks, 'INFO', /no skills directories present/));
});

test('skill name conflicts between shared and private dirs are flagged', () => {
  const home = tempDir();
  writeSkill(home, '.kimi-code/skills', 'dup', VALID_SKILL_MD);
  writeSkill(home, '.agents/skills', 'dup', VALID_SKILL_MD);
  writeSkill(home, '.agents/skills', 'shared-only', VALID_SKILL_MD);
  const checks = healthChecks(collectDoctorReport(makeOptions(home, tempDir(), { agent: 'kimi-code' })), 'kimi-code', 'Skills');
  assert.ok(hasCheck(checks, 'PASS', /3 valid skill/));
  assert.ok(hasCheck(checks, 'WARN', /skill "dup" exists in both shared \(~\/\.agents\/skills\) and private \(~\/\.kimi-code\/skills\)/));
  assert.ok(!checks.some((c) => c.message.includes('"shared-only" exists in both')));
});

test('invalid JSON MCP config is a FAIL', () => {
  const home = tempDir();
  writeFile(home, '.claude.json', '{ not json');
  const checks = healthChecks(collectDoctorReport(makeOptions(home, tempDir(), { agent: 'claude-code' })), 'claude-code', 'MCP');
  assert.ok(hasCheck(checks, 'FAIL', /invalid JSON/));
});

test('valid MCP config lists servers by name', () => {
  const home = tempDir();
  writeFile(home, '.claude.json', JSON.stringify({ mcpServers: { github: {}, filesystem: {} } }));
  const checks = healthChecks(collectDoctorReport(makeOptions(home, tempDir(), { agent: 'claude-code' })), 'claude-code', 'MCP');
  assert.ok(hasCheck(checks, 'PASS', /2 MCP server\(s\): github, filesystem/));
});

test('MCP config without mcpServers key is informational', () => {
  const home = tempDir();
  writeFile(home, '.claude.json', '{}');
  const checks = healthChecks(collectDoctorReport(makeOptions(home, tempDir(), { agent: 'claude-code' })), 'claude-code', 'MCP');
  assert.ok(hasCheck(checks, 'INFO', /no "mcpServers" key/));
});

test('more than 10 MCP servers warns about tool overload', () => {
  const home = tempDir();
  const mcpServers = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`server-${i}`, {}]));
  writeFile(home, '.kimi-code/mcp.json', JSON.stringify({ mcpServers }));
  const checks = healthChecks(collectDoctorReport(makeOptions(home, tempDir(), { agent: 'kimi-code' })), 'kimi-code', 'MCP');
  assert.ok(hasCheck(checks, 'WARN', /11 MCP servers configured \(> 10\)/));
});

test('TOML MCP configs are scanned without JSON parsing', () => {
  const home = tempDir();
  writeFile(home, '.codex/config.toml', 'model = "gpt-5"\n\n[mcp_servers.docs]\ncommand = "x"\n\n[mcp_servers.docs.env]\nFOO = "1"\n\n[mcp_servers.fs]\ncommand = "y"\n');
  const checks = healthChecks(collectDoctorReport(makeOptions(home, tempDir(), { agent: 'codex' })), 'codex', 'MCP');
  assert.ok(hasCheck(checks, 'PASS', /2 MCP server\(s\): docs, fs/));
  assert.ok(!checks.some((c) => c.status === 'FAIL'));
});

test('formatDoctorReport renders sections, prefixes and summary', () => {
  const home = tempDir();
  mkdirSync(path.join(home, '.claude'));
  writeFile(home, '.claude/CLAUDE.md', '# hi\n');
  const text = formatDoctorReport(collectDoctorReport(makeOptions(home, tempDir())));
  assert.match(text, /skillfit doctor — read-only configuration health report/);
  assert.match(text, /Agent detection/);
  assert.match(text, /Claude Code \(claude-code\)/);
  assert.match(text, /\[PASS\]/);
  assert.match(text, /Summary/);
  assert.match(text, /1\/3 agents detected/);
  assert.match(text, /always exits 0/);
});

test('runDoctor prints the report and never sets an exit code', async () => {
  const logged: string[] = [];
  const original = console.log;
  console.log = (message?: unknown) => {
    logged.push(String(message));
  };
  try {
    await runDoctor({ agent: 'claude-code', dryRun: true, yes: true });
  } finally {
    console.log = original;
  }
  const output = logged.join('\n');
  assert.match(output, /skillfit doctor/);
  assert.match(output, /Summary/);
  assert.equal(process.exitCode, undefined);
});

test('runDoctor exits non-zero on an unknown agent', async (t) => {
  const errors: string[] = [];
  const original = console.error;
  const priorExitCode = process.exitCode;
  t.after(() => {
    process.exitCode = priorExitCode;
  });
  console.error = (message?: unknown) => {
    errors.push(String(message));
  };
  try {
    await runDoctor({ agent: 'nope' });
  } finally {
    console.error = original;
  }
  assert.match(errors.join('\n'), /Unknown agent "nope"\. Known agents: claude-code, codex, kimi-code/);
  // Findings stay advisory at exit 0; a typo in --agent is a usage error that never ran the check,
  // and exiting 0 there lets CI read it as a clean bill of health.
  assert.equal(process.exitCode, 2);
});

test('runDoctor still exits 0 when the report contains FAIL findings', async (t) => {
  const priorExitCode = process.exitCode;
  t.after(() => {
    process.exitCode = priorExitCode;
  });
  const original = console.log;
  console.log = () => {};
  try {
    await runDoctor({ agent: 'claude-code' });
  } finally {
    console.log = original;
  }
  assert.equal(process.exitCode, undefined, 'doctor is read-only and advisory: findings never set an exit code');
});
