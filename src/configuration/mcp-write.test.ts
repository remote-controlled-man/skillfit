import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runMcpApply } from "./mcp-write.js";

async function fixture(t: test.TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skillfit-mcp-write-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const home = path.join(root, "home");
  const project = path.join(root, "project");
  await fs.mkdir(home, { recursive: true });
  await fs.mkdir(project, { recursive: true });
  const configPath = path.join(home, ".kimi-code", "mcp.json");
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  const original = '{"mcpServers":{},"other":{"keep":true}}\n';
  await fs.writeFile(configPath, original);
  const specPath = path.join(root, "probe.json");
  await fs.writeFile(
    specPath,
    `${JSON.stringify({
      schemaVersion: 1,
      name: "docs",
      transport: "stdio",
      command: "must-not-contact-server",
      args: [],
      env: {},
    })}\n`,
  );
  return { root, home, project, configPath, original, specPath };
}

test("MCP apply restores target and lock after an injected target write failure", async (t) => {
  const { home, project, configPath, original, specPath } = await fixture(t);
  const lockPath = path.join(home, "skillfit.lock.json");
  const originalRename = fs.rename;
  let injected = false;
  fs.rename = async (from, to) => {
    if (to === configPath && String(from).includes(".skillfit-staged")) {
      injected = true;
      throw new Error("injected MCP target rename failure");
    }
    await originalRename(from, to);
  };
  t.after(() => {
    fs.rename = originalRename;
  });
  await assert.rejects(
    runMcpApply({
      agent: "kimi-code",
      server: "docs",
      from: specPath,
      homeDir: home,
      projectDir: project,
      env: { PATH: "" },
      yes: true,
      log: () => {},
    }),
    /injected MCP target rename failure/,
  );
  assert.equal(injected, true);
  assert.equal(await fs.readFile(configPath, "utf8"), original);
  assert.equal(await fs.stat(lockPath).catch(() => null), null);
});

test("MCP apply cancellation preserves target bytes and creates no lock", async (t) => {
  const { home, project, configPath, original, specPath } = await fixture(t);
  const result = await runMcpApply({
    agent: "kimi-code",
    server: "docs",
    from: specPath,
    homeDir: home,
    projectDir: project,
    env: { PATH: "" },
    confirm: async () => false,
    log: () => {},
  });
  assert.equal(result.status, "cancelled");
  assert.equal(await fs.readFile(configPath, "utf8"), original);
  assert.equal(await fs.stat(path.join(home, "skillfit.lock.json")).catch(() => null), null);
});

test("MCP removal does not clear a lock record for a different missing target", async (t) => {
  const { home, project } = await fixture(t);
  await fs.rm(path.join(home, ".kimi-code", "mcp.json"));
  const lockPath = path.join(home, "skillfit.lock.json");
  const originalLock = `${JSON.stringify(
    {
      version: 1,
      entries: {
        "kimi-code:mcp:docs": {
          agent: "kimi-code",
          kind: "mcp",
          path: path.join(home, "elsewhere.json"),
          sha256: "a".repeat(64),
          profile: "mcp-apply",
          profileVersion: "1",
          installedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    },
    null,
    2,
  )}\n`;
  await fs.writeFile(lockPath, originalLock);
  await assert.rejects(
    runMcpApply({
      agent: "kimi-code",
      server: "docs",
      remove: true,
      homeDir: home,
      projectDir: project,
      env: { PATH: "" },
      yes: true,
      log: () => {},
    }),
    /conflict/,
  );
  assert.equal(await fs.readFile(lockPath, "utf8"), originalLock);
});

test("MCP apply refuses an unchanged entry whose lock belongs to another Agent", async (t) => {
  const { home, project, configPath, specPath } = await fixture(t);
  const options = {
    agent: "kimi-code",
    server: "docs",
    from: specPath,
    homeDir: home,
    projectDir: project,
    env: { PATH: "" },
    yes: true,
    log: () => {},
  };
  await runMcpApply(options);
  const configBytes = await fs.readFile(configPath, "utf8");
  const lockPath = path.join(home, "skillfit.lock.json");
  const lock = JSON.parse(await fs.readFile(lockPath, "utf8"));
  lock.entries["kimi-code:mcp:docs"].agent = "codex";
  const changedLock = `${JSON.stringify(lock, null, 2)}\n`;
  await fs.writeFile(lockPath, changedLock);
  await assert.rejects(runMcpApply(options), /conflict/);
  assert.equal(await fs.readFile(configPath, "utf8"), configBytes);
  assert.equal(await fs.readFile(lockPath, "utf8"), changedLock);
});

test("MCP apply refuses a symlinked configuration target", async (t) => {
  const { root, home, project, configPath, specPath } = await fixture(t);
  const outside = path.join(root, "outside.json");
  const bytes = '{"mcpServers":{},"keep":true}\n';
  await fs.writeFile(outside, bytes);
  await fs.rm(configPath);
  await fs.symlink(outside, configPath);
  await assert.rejects(
    runMcpApply({
      agent: "kimi-code",
      server: "docs",
      from: specPath,
      homeDir: home,
      projectDir: project,
      env: { PATH: "" },
      dryRun: true,
      log: () => {},
    }),
    /symlink/,
  );
  assert.equal(await fs.readFile(outside, "utf8"), bytes);
  assert.equal((await fs.lstat(configPath)).isSymbolicLink(), true);
  assert.equal(await fs.stat(path.join(home, "skillfit.lock.json")).catch(() => null), null);
});

test("MCP apply restores both files after an injected lockfile write failure", async (t) => {
  const { home, project, configPath, specPath } = await fixture(t);
  const base = {
    agent: "kimi-code",
    server: "docs",
    homeDir: home,
    projectDir: project,
    env: { PATH: "" },
    yes: true,
    log: () => {},
  };
  await runMcpApply({ ...base, from: specPath });
  const originalConfig = await fs.readFile(configPath, "utf8");
  const lockPath = path.join(home, "skillfit.lock.json");
  const originalLock = await fs.readFile(lockPath, "utf8");
  const spec = JSON.parse(await fs.readFile(specPath, "utf8"));
  spec.args = ["--changed"];
  await fs.writeFile(specPath, JSON.stringify(spec));
  const originalRename = fs.rename;
  let injected = false;
  fs.rename = async (from, to) => {
    if (to === lockPath && String(from).includes(".skillfit-staged")) {
      injected = true;
      throw new Error("injected MCP lockfile rename failure");
    }
    await originalRename(from, to);
  };
  t.after(() => {
    fs.rename = originalRename;
  });
  await assert.rejects(runMcpApply({ ...base, from: specPath }), /lockfile rename failure/);
  assert.equal(injected, true);
  assert.equal(await fs.readFile(configPath, "utf8"), originalConfig);
  assert.equal(await fs.readFile(lockPath, "utf8"), originalLock);
});
