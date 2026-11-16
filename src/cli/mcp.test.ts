import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("./main.js", import.meta.url));

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "skillfit-cli-mcp-config-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, "home");
  const cwd = join(root, "project");
  mkdirSync(home, { recursive: true });
  mkdirSync(cwd, { recursive: true });
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, USERPROFILE: home, PATH: "" };
  delete env.CODEX_HOME;
  delete env.KIMI_CODE_HOME;
  return { root, home, cwd, env };
}

function run(f: ReturnType<typeof fixture>, server = "docs", extra: string[] = []) {
  return spawnSync(
    process.execPath,
    [CLI, "mcp", "check", "--agent", "kimi-code", "--server", server, "--dry-run", ...extra],
    { cwd: f.cwd, env: f.env, encoding: "utf8", timeout: 10_000 },
  );
}

test("mcp check selects a redacted user or project JSON entry without starting it", (t) => {
  const f = fixture(t);
  const userPath = join(f.home, ".kimi-code", "mcp.json");
  const projectPath = join(f.cwd, ".kimi-code", "mcp.json");
  mkdirSync(join(userPath, ".."), { recursive: true });
  mkdirSync(join(projectPath, ".."), { recursive: true });
  const userBytes = `${JSON.stringify({
    mcpServers: {
      docs: {
        command: "user-server-must-not-start",
        args: ["--token", "user-secret"],
        env: { MCP_TOKEN: "user-secret" },
      },
    },
  })}\n`;
  const projectBytes = `${JSON.stringify({
    mcpServers: { docs: { command: "project-server-must-not-start", args: ["project-secret"] } },
  })}\n`;
  writeFileSync(userPath, userBytes);
  writeFileSync(projectPath, projectBytes);
  const user = run(f);
  const project = run(f, "docs", ["--project"]);
  assert.equal(user.status, 0, user.stderr);
  assert.equal(project.status, 0, project.stderr);
  assert.match(user.stdout, /Scope\s+: user/);
  assert.match(project.stdout, /Scope\s+: project/);
  assert.match(user.stdout, /user-server-must-not-start/);
  assert.match(project.stdout, /project-server-must-not-start/);
  assert.match(user.stdout, /2 argument\(s\); values withheld/);
  assert.doesNotMatch(user.stdout, /user-secret/);
  assert.doesNotMatch(project.stdout, /project-secret/);
  assert.equal(readFileSync(userPath, "utf8"), userBytes);
  assert.equal(readFileSync(projectPath, "utf8"), projectBytes);
  assert.equal(existsSync(join(f.cwd, "runs")), false);
});

test("mcp check redacts HTTP query and header values in a real-config dry run", (t) => {
  const f = fixture(t);
  const configPath = join(f.home, ".kimi-code", "mcp.json");
  mkdirSync(join(configPath, ".."), { recursive: true });
  const bytes = `${JSON.stringify({
    mcpServers: {
      search: {
        type: "streamable-http",
        url: "https://example.test/mcp?token=url-secret",
        headers: { Authorization: "Bearer header-secret" },
      },
    },
  })}\n`;
  writeFileSync(configPath, bytes);
  const result = run(f, "search");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /https:\/\/example\.test\/mcp \(query withheld\)/);
  assert.doesNotMatch(result.stdout, /url-secret|header-secret/);
  assert.equal(readFileSync(configPath, "utf8"), bytes);
  assert.equal(existsSync(join(f.cwd, "runs")), false);
});

test("mcp check rejects native Codex TOML conversion before any server effect", (t) => {
  const f = fixture(t);
  const configPath = join(f.home, ".codex", "config.toml");
  mkdirSync(join(configPath, ".."), { recursive: true });
  writeFileSync(configPath, '[mcp_servers.docs]\ncommand = "must-not-start"\n');
  const marker = join(f.root, "started");
  const result = spawnSync(
    process.execPath,
    [CLI, "mcp", "check", "--agent", "codex", "--server", "docs", "--dry-run"],
    { cwd: f.cwd, env: f.env, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /toml-mcp_servers.*explicit probe spec/);
  assert.match(result.stderr, /No server was started or contacted/);
  assert.equal(existsSync(marker), false);
});

test("mcp check rejects disabled and unknown servers before any process starts", (t) => {
  const f = fixture(t);
  const configPath = join(f.home, ".kimi-code", "mcp.json");
  mkdirSync(join(configPath, ".."), { recursive: true });
  const bytes = `${JSON.stringify({
    mcpServers: { docs: { enabled: false, command: "disabled-must-not-start" } },
  })}\n`;
  writeFileSync(configPath, bytes);
  const disabled = run(f);
  const missing = run(f, "missing");
  assert.equal(disabled.status, 1);
  assert.match(disabled.stderr, /disabled; no server was started or contacted/);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /not found.*no server was started or contacted/);
  assert.equal(readFileSync(configPath, "utf8"), bytes);
  assert.equal(existsSync(join(f.cwd, "runs")), false);
});

test("mcp check redacts a selected stdio server's configured secret from failures", (t) => {
  const f = fixture(t);
  const configDir = join(f.home, ".kimi-code");
  mkdirSync(configDir, { recursive: true });
  const secret = "test-only-stdio-secret";
  writeFileSync(
    join(configDir, "fail.mjs"),
    `import { writeFileSync } from "node:fs";\nwriteFileSync("server-proof.txt", process.env.MCP_TEST_SECRET ?? "");\nprocess.stderr.write(\`failed with \${process.env.MCP_TEST_SECRET}\\n\`);\nprocess.exit(7);\n`,
  );
  const configPath = join(configDir, "mcp.json");
  const bytes = `${JSON.stringify({
    mcpServers: {
      docs: {
        command: process.execPath,
        args: ["fail.mjs"],
        cwd: ".",
        env: { MCP_TEST_SECRET: secret },
      },
    },
  })}\n`;
  writeFileSync(configPath, bytes);
  const result = spawnSync(
    process.execPath,
    [CLI, "mcp", "check", "--agent", "kimi-code", "--server", "docs"],
    { cwd: f.cwd, env: f.env, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /code 7/);
  assert.match(result.stderr, /<REDACTED>/);
  assert.doesNotMatch(result.stderr, /test-only-stdio-secret/);
  assert.equal(readFileSync(join(configDir, "server-proof.txt"), "utf8"), secret);
  assert.equal(readFileSync(configPath, "utf8"), bytes);
  assert.equal(existsSync(join(f.cwd, "runs")), false);
});

test("mcp check preserves the explicit spec-file dry-run with an unrelated project flag", (t) => {
  const f = fixture(t);
  const specPath = join(f.root, "probe.json");
  writeFileSync(
    specPath,
    JSON.stringify({
      schemaVersion: 1,
      name: "legacy-spec",
      transport: "stdio",
      command: "must-not-start",
      args: [],
    }),
  );
  const result = spawnSync(
    process.execPath,
    [CLI, "mcp", "check", specPath, "--project", "--dry-run"],
    { cwd: f.cwd, env: f.env, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Server\s+: legacy-spec/);
  assert.match(result.stdout, /Dry run — the server was not contacted/);
  assert.equal(existsSync(join(f.cwd, "runs")), false);
});
