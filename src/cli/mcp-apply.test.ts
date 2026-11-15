import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("./main.js", import.meta.url));

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "skillfit-cli-mcp-apply-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, "home");
  const cwd = join(root, "project");
  mkdirSync(home, { recursive: true });
  mkdirSync(cwd, { recursive: true });
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, PATH: "" };
  delete env.CODEX_HOME;
  delete env.KIMI_CODE_HOME;
  return { root, home, cwd, env };
}

function run(f: ReturnType<typeof fixture>, args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: f.cwd,
    env: f.env,
    encoding: "utf8",
    timeout: 10_000,
  });
}

function probe(root: string, command: string, args: string[] = ["--token", "dummy-secret"]) {
  const path = join(root, "probe.json");
  writeFileSync(
    path,
    `${JSON.stringify({
      schemaVersion: 1,
      name: "docs",
      transport: "stdio",
      command,
      args,
      env: { MCP_TOKEN: "dummy-secret" },
    })}\n`,
  );
  return path;
}

test("mcp apply creates, updates and removes one JSON entry without server or secret leakage", (t) => {
  const f = fixture(t);
  const configPath = join(f.home, ".kimi-code", "mcp.json");
  mkdirSync(join(configPath, ".."), { recursive: true });
  const originalConfig = '{"mcpServers":{},"other":{"keep":true}}\n';
  writeFileSync(configPath, originalConfig);
  const specPath = probe(f.root, "must-not-contact-server");
  const dryRun = run(f, [
    "mcp",
    "apply",
    "--agent",
    "kimi-code",
    "--server",
    "docs",
    "--from",
    specPath,
    "--dry-run",
  ]);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /create/i);
  assert.doesNotMatch(dryRun.stdout, /dummy-secret/);
  assert.equal(readFileSync(configPath, "utf8"), originalConfig);

  const created = run(f, [
    "mcp",
    "apply",
    "--agent",
    "kimi-code",
    "--server",
    "docs",
    "--from",
    specPath,
    "--yes",
  ]);
  assert.equal(created.status, 0, created.stderr);
  assert.doesNotMatch(created.stdout, /dummy-secret/);
  let config = JSON.parse(readFileSync(configPath, "utf8"));
  assert.equal(config.mcpServers.docs.command, "must-not-contact-server");
  assert.deepEqual(config.other, { keep: true });
  const lockPath = join(f.home, "skillfit.lock.json");
  let lock = JSON.parse(readFileSync(lockPath, "utf8"));
  assert.equal(lock.entries["kimi-code:mcp:docs"].kind, "mcp");

  writeFileSync(
    specPath,
    `${JSON.stringify({
      schemaVersion: 1,
      name: "docs",
      transport: "stdio",
      command: "must-not-contact-server",
      args: ["--changed"],
      env: { MCP_TOKEN: "dummy-secret" },
    })}\n`,
  );
  const updated = run(f, [
    "mcp",
    "apply",
    "--agent",
    "kimi-code",
    "--server",
    "docs",
    "--from",
    specPath,
    "--yes",
  ]);
  assert.equal(updated.status, 0, updated.stderr);
  config = JSON.parse(readFileSync(configPath, "utf8"));
  assert.deepEqual(config.mcpServers.docs.args, ["--changed"]);
  const backup = JSON.parse(readFileSync(`${configPath}.skillfit-bak`, "utf8"));
  assert.deepEqual(backup, JSON.parse(originalConfig));

  const removed = run(f, [
    "mcp",
    "apply",
    "--agent",
    "kimi-code",
    "--server",
    "docs",
    "--remove",
    "--yes",
  ]);
  assert.equal(removed.status, 0, removed.stderr);
  config = JSON.parse(readFileSync(configPath, "utf8"));
  assert.equal(config.mcpServers.docs, undefined);
  assert.deepEqual(config.other, { keep: true });
  lock = JSON.parse(readFileSync(lockPath, "utf8"));
  assert.equal(lock.entries["kimi-code:mcp:docs"], undefined);
  assert.equal(existsSync(join(f.cwd, "runs")), false);
});

test("mcp apply refuses an unmanaged same-name entry without changing bytes", (t) => {
  const f = fixture(t);
  const configPath = join(f.home, ".kimi-code", "mcp.json");
  mkdirSync(join(configPath, ".."), { recursive: true });
  const bytes = '{"mcpServers":{"docs":{"command":"user-owned"}}}\n';
  writeFileSync(configPath, bytes);
  const specPath = probe(f.root, "new-managed-command", []);
  const dryRun = run(f, [
    "mcp",
    "apply",
    "--agent",
    "kimi-code",
    "--server",
    "docs",
    "--from",
    specPath,
    "--dry-run",
  ]);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /conflict/i);
  assert.equal(readFileSync(configPath, "utf8"), bytes);
  const applied = run(f, [
    "mcp",
    "apply",
    "--agent",
    "kimi-code",
    "--server",
    "docs",
    "--from",
    specPath,
    "--yes",
  ]);
  assert.equal(applied.status, 1);
  assert.match(applied.stderr, /conflict/i);
  assert.equal(readFileSync(configPath, "utf8"), bytes);
  assert.equal(existsSync(join(f.home, "skillfit.lock.json")), false);
  assert.equal(existsSync(`${configPath}.skillfit-bak`), false);
});

test("mcp apply writes a project HTTP entry without contacting it and stays idempotent", (t) => {
  const f = fixture(t);
  const specPath = join(f.root, "http-probe.json");
  writeFileSync(
    specPath,
    `${JSON.stringify({
      schemaVersion: 1,
      name: "search",
      transport: "http",
      url: "https://example.test/mcp?token=dummy-secret",
      headers: { Authorization: "Bearer dummy-secret" },
    })}\n`,
  );
  const configPath = join(f.cwd, ".kimi-code", "mcp.json");
  const args = [
    "mcp",
    "apply",
    "--agent",
    "kimi-code",
    "--server",
    "search",
    "--from",
    specPath,
    "--project",
  ];
  const dryRun = run(f, [...args, "--dry-run"]);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.doesNotMatch(dryRun.stdout, /dummy-secret/);
  assert.equal(existsSync(configPath), false);
  const applied = run(f, [...args, "--yes"]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.doesNotMatch(applied.stdout, /dummy-secret/);
  const bytes = readFileSync(configPath, "utf8");
  const config = JSON.parse(bytes);
  assert.equal(config.mcpServers.search.type, "http");
  assert.equal(config.mcpServers.search.url, "https://example.test/mcp?token=dummy-secret");
  const lockPath = join(f.cwd, "skillfit.lock.json");
  assert.equal(
    JSON.parse(readFileSync(lockPath, "utf8")).entries["kimi-code:mcp:search"].kind,
    "mcp",
  );
  assert.equal(existsSync(join(f.home, "skillfit.lock.json")), false);
  const repeated = run(f, [...args, "--yes"]);
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.equal(readFileSync(configPath, "utf8"), bytes);
  assert.equal(existsSync(join(f.cwd, "runs")), false);
});

test("mcp apply refuses native Codex TOML without writing or contacting a server", (t) => {
  const f = fixture(t);
  const configPath = join(f.home, ".codex", "config.toml");
  mkdirSync(join(configPath, ".."), { recursive: true });
  const bytes = '[mcp_servers.docs]\ncommand = "must-not-start"\n';
  writeFileSync(configPath, bytes);
  const specPath = probe(f.root, "must-not-start", []);
  const result = run(f, [
    "mcp",
    "apply",
    "--agent",
    "codex",
    "--server",
    "docs",
    "--from",
    specPath,
    "--dry-run",
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /toml-mcp_servers.*no configuration was written/);
  assert.equal(readFileSync(configPath, "utf8"), bytes);
  assert.equal(existsSync(join(f.home, "skillfit.lock.json")), false);
});
