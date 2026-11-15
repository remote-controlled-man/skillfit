import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { runInstall } from "./install.js";
import { runBundleExport } from "./bundle.js";

async function fixture(
  t: test.TestContext,
): Promise<{ root: string; home: string; targetHome: string }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skillfit-bundle-"));
  t.after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });
  const home = path.join(root, "source-home");
  const targetHome = path.join(root, "target-home");
  await fs.mkdir(path.join(home, ".codex"), { recursive: true });
  await fs.mkdir(targetHome, { recursive: true });
  return { root, home, targetHome };
}

test("exports a portable Codex profile and installs it into a fresh home", async (t) => {
  const { root, home, targetHome } = await fixture(t);
  const skill = path.join(home, ".agents", "skills", "example");
  await fs.mkdir(skill, { recursive: true });
  await fs.writeFile(
    path.join(skill, "SKILL.md"),
    "---\nname: example\ndescription: Handle example tasks.\n---\nDo the example.\n",
  );
  const icon = Buffer.from([0, 0xff, 0x89, 0x50]);
  await fs.writeFile(path.join(skill, "icon.png"), icon);
  for (const artifact of [
    "SKILL.md.skillfit-bak",
    "SKILL.md.123.skillfit-staged",
    "SKILL.md.123.skillfit-restore",
  ]) {
    await fs.writeFile(path.join(skill, artifact), "Old private instructions");
  }
  await fs.writeFile(
    path.join(home, ".codex", "AGENTS.md"),
    "# My global rules\n\nUse concise answers.\n",
  );
  const outputDir = path.join(root, "personal-codex");

  await runBundleExport({
    outputDir,
    homeDir: home,
    skillNames: ["example"],
    yes: true,
    log: () => {},
  });

  const manifest = JSON.parse(await fs.readFile(path.join(outputDir, "profile.json"), "utf8")) as {
    agents: string[];
    skills: { name: string; source: string }[];
  };
  assert.deepEqual(manifest.agents, ["codex"]);
  assert.deepEqual(manifest.skills, [{ name: "example", source: "skills/example" }]);
  assert.deepEqual(await fs.readFile(path.join(outputDir, "skills", "example", "icon.png")), icon);
  for (const artifact of [
    "SKILL.md.skillfit-bak",
    "SKILL.md.123.skillfit-staged",
    "SKILL.md.123.skillfit-restore",
  ]) {
    await assert.rejects(fs.stat(path.join(outputDir, "skills", "example", artifact)), {
      code: "ENOENT",
    });
  }
  const rules = await fs.readFile(path.join(outputDir, "rules", "global.md"), "utf8");
  assert.match(rules, /My global rules/);
  assert.match(rules, /example/);

  await runInstall({
    profile: "ignored",
    profilePath: outputDir,
    agent: "codex",
    homeDir: targetHome,
    projectDir: root,
    env: { PATH: "" },
    yes: true,
    log: () => {},
  });
  assert.deepEqual(
    await fs.readFile(path.join(targetHome, ".agents", "skills", "example", "icon.png")),
    icon,
  );
  assert.match(
    await fs.readFile(path.join(targetHome, ".codex", "AGENTS.md"), "utf8"),
    /My global rules/,
  );
  const moved = path.join(root, "relocated", "personal-codex");
  await fs.mkdir(path.dirname(moved));
  await fs.rename(outputDir, moved);
  await fs.stat(path.join(moved, "runtime", "configuration", "transaction.js"));
  const standaloneHome = path.join(root, "standalone-home");
  await fs.mkdir(standaloneHome);
  const preview = spawnSync(process.execPath, [path.join(moved, "setup.mjs"), "--dry-run"], {
    cwd: path.dirname(moved),
    env: {
      ...process.env,
      HOME: standaloneHome,
      USERPROFILE: standaloneHome,
      CODEX_HOME: path.join(standaloneHome, "codex-home"),
    },
    encoding: "utf8",
  });
  assert.equal(preview.status, 0, preview.stderr);
  assert.deepEqual(await fs.readdir(standaloneHome), []);
  const result = spawnSync(process.execPath, [path.join(moved, "setup.mjs"), "--yes"], {
    cwd: root,
    env: {
      ...process.env,
      HOME: standaloneHome,
      USERPROFILE: standaloneHome,
      CODEX_HOME: path.join(standaloneHome, "codex-home"),
    },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    await fs.readFile(path.join(standaloneHome, ".agents", "skills", "example", "icon.png")),
    icon,
  );
  assert.match(
    await fs.readFile(path.join(standaloneHome, "codex-home", "AGENTS.md"), "utf8"),
    /My global rules/,
  );
  const lockPath = path.join(standaloneHome, "skillfit.lock.json");
  const priorLock = await fs.readFile(lockPath);
  const reinstall = spawnSync(process.execPath, [path.join(moved, "setup.mjs"), "--yes"], {
    cwd: path.dirname(moved),
    env: {
      ...process.env,
      HOME: standaloneHome,
      USERPROFILE: standaloneHome,
      CODEX_HOME: path.join(standaloneHome, "codex-home"),
    },
    encoding: "utf8",
  });
  assert.equal(reinstall.status, 0, reinstall.stderr);
  assert.match(reinstall.stdout, /Everything is up to date/);
  assert.deepEqual(await fs.readFile(lockPath), priorLock);
  await assert.rejects(
    runInstall({
      profile: "ignored",
      profilePath: moved,
      agent: "codex",
      homeDir: targetHome,
      projectDir: root,
      env: { PATH: "" },
      project: true,
      yes: true,
      log: () => {},
    }),
    /user scope/,
  );
});

test("exports and installs Kimi rules, Skills and safe MCP through public installers", async (t) => {
  const { root, home, targetHome } = await fixture(t);
  const skill = path.join(home, ".kimi-code", "skills", "example");
  await fs.mkdir(skill, { recursive: true });
  await fs.writeFile(
    path.join(skill, "SKILL.md"),
    "---\nname: example\ndescription: Handle Kimi examples.\n---\nDo the example.\n",
  );
  await fs.writeFile(path.join(skill, "LICENSE"), "Fixture license\n");
  await fs.mkdir(path.join(home, ".kimi-code"), { recursive: true });
  await fs.writeFile(path.join(home, ".kimi-code", "AGENTS.md"), "# Kimi personal rules\n");
  await fs.writeFile(
    path.join(home, ".kimi-code", "mcp.json"),
    `${JSON.stringify({
      mcpServers: {
        docs: { type: "stdio", command: "must-not-start" },
        web: { type: "http", url: "https://example.test/mcp" },
      },
    })}\n`,
  );
  const upstreamLock = path.join(root, "sources.json");
  await fs.writeFile(
    upstreamLock,
    JSON.stringify({ version: 1, skills: [], localSkills: ["example"] }),
  );
  const outputDir = path.join(root, "personal-kimi");
  const exported = spawnSync(
    process.execPath,
    [
      path.join(process.cwd(), "dist/cli/main.js"),
      "bundle",
      "export",
      outputDir,
      "--agent",
      "kimi-code",
      "--skill",
      "example",
      "--upstream-lock",
      upstreamLock,
      "--mcp",
      "docs",
      "--mcp",
      "web",
      "--yes",
    ],
    { cwd: root, env: { HOME: home, USERPROFILE: home, PATH: "" }, encoding: "utf8" },
  );
  assert.equal(exported.status, 0, exported.stderr);
  const manifest = JSON.parse(await fs.readFile(path.join(outputDir, "profile.json"), "utf8"));
  assert.deepEqual(manifest.agents, ["kimi-code"]);
  assert.deepEqual(
    manifest.mcp.map((entry: { name: string }) => entry.name),
    ["docs", "web"],
  );
  assert.equal(
    await fs.readFile(path.join(outputDir, "skills", "example", "LICENSE"), "utf8"),
    "Fixture license\n",
  );
  const preview = spawnSync(process.execPath, [path.join(outputDir, "setup.mjs"), "--dry-run"], {
    cwd: root,
    env: { HOME: targetHome, USERPROFILE: targetHome, PATH: "" },
    encoding: "utf8",
  });
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /MCP "docs"/);
  assert.match(preview.stdout, /MCP "web"/);
  assert.deepEqual(await fs.readdir(targetHome), []);
  const targetConfig = path.join(targetHome, ".kimi-code", "mcp.json");
  await fs.mkdir(path.dirname(targetConfig), { recursive: true });
  await fs.writeFile(
    targetConfig,
    '{"mcpServers":{"keep":{"command":"user-owned"}},"other":{"keep":true}}\n',
  );
  const targetEnv = { HOME: targetHome, USERPROFILE: targetHome, PATH: "" };
  const installed = spawnSync(process.execPath, [path.join(outputDir, "setup.mjs"), "--yes"], {
    cwd: root,
    env: targetEnv,
    encoding: "utf8",
  });
  assert.equal(installed.status, 0, installed.stderr);
  assert.match(
    await fs.readFile(path.join(targetHome, ".kimi-code", "AGENTS.md"), "utf8"),
    /Kimi personal rules/,
  );
  assert.equal(
    await fs.readFile(path.join(targetHome, ".agents", "skills", "example", "LICENSE"), "utf8"),
    "Fixture license\n",
  );
  const targetMcp = JSON.parse(await fs.readFile(targetConfig, "utf8"));
  assert.equal(targetMcp.mcpServers.docs.command, "must-not-start");
  assert.equal(targetMcp.mcpServers.docs.cwd, undefined);
  assert.equal(targetMcp.mcpServers.web.url, "https://example.test/mcp");
  assert.deepEqual(targetMcp.mcpServers.keep, { command: "user-owned" });
  assert.deepEqual(targetMcp.other, { keep: true });
  const lockPath = path.join(targetHome, "skillfit.lock.json");
  const originalLock = await fs.readFile(lockPath, "utf8");
  assert.equal(JSON.parse(originalLock).entries["kimi-code:mcp:docs"].kind, "mcp");
  const repeated = spawnSync(process.execPath, [path.join(outputDir, "setup.mjs"), "--yes"], {
    cwd: root,
    env: targetEnv,
    encoding: "utf8",
  });
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.match(repeated.stdout, /Everything is up to date/);
  assert.equal(await fs.readFile(lockPath, "utf8"), originalLock);
});

test("Kimi export uses shared rules and refuses ambiguous user-level sources", async (t) => {
  const { root, home } = await fixture(t);
  await fs.mkdir(path.join(home, ".agents"), { recursive: true });
  await fs.writeFile(path.join(home, ".agents", "AGENTS.md"), "# Shared personal rules\n");
  const outputDir = path.join(root, "shared-kimi");
  await runBundleExport({
    outputDir,
    agent: "kimi-code",
    homeDir: home,
    env: { PATH: "" },
    skillNames: [],
    yes: true,
    log: () => {},
  });
  assert.match(
    await fs.readFile(path.join(outputDir, "rules", "global.md"), "utf8"),
    /Shared personal rules/,
  );
  await fs.mkdir(path.join(home, ".kimi-code"), { recursive: true });
  await fs.writeFile(path.join(home, ".kimi-code", "AGENTS.md"), "# Other rules\n");
  const ambiguousOutput = path.join(root, "ambiguous-kimi");
  await assert.rejects(
    runBundleExport({
      outputDir: ambiguousOutput,
      agent: "kimi-code",
      homeDir: home,
      env: { PATH: "" },
      skillNames: [],
      dryRun: true,
      log: () => {},
    }),
    /Multiple user-level rules files/,
  );
  await assert.rejects(fs.stat(ambiguousOutput), { code: "ENOENT" });
});

test("export refuses credential-bearing and machine-local MCP fields before creating output", async (t) => {
  const { root, home } = await fixture(t);
  const configPath = path.join(home, ".kimi-code", "mcp.json");
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  const cases: Record<string, unknown>[] = [
    { command: "server", args: ["--token", "dummy-secret"] },
    { command: "server", env: { TOKEN: "dummy-secret" } },
    { command: "server", cwd: home },
    { command: "server", timeoutMs: 5000 },
    { url: "https://example.test/mcp", headers: { Authorization: "Bearer dummy-secret" } },
    { url: "https://example.test/mcp?token=dummy-secret" },
    { url: "https://user:dummy-secret@example.test/mcp" },
    { url: "https://example.test/mcp#dummy-secret" },
  ];
  for (const [index, entry] of cases.entries()) {
    const bytes = `${JSON.stringify({ mcpServers: { docs: entry } })}\n`;
    await fs.writeFile(configPath, bytes);
    const outputDir = path.join(root, `sensitive-${index}`);
    const lines: string[] = [];
    await assert.rejects(
      runBundleExport({
        outputDir,
        agent: "kimi-code",
        homeDir: home,
        env: { PATH: "" },
        skillNames: [],
        mcpServerNames: ["docs"],
        yes: true,
        log: (line) => lines.push(line),
      }),
      /portable export/,
    );
    await assert.rejects(fs.stat(outputDir), { code: "ENOENT" });
    assert.equal(await fs.readFile(configPath, "utf8"), bytes);
    assert.doesNotMatch(lines.join("\n"), /dummy-secret/);
  }
});

test("export refuses selected native Codex TOML MCP without creating output", async (t) => {
  const { root, home } = await fixture(t);
  const configPath = path.join(home, ".codex", "config.toml");
  const bytes = '[mcp_servers.docs]\ncommand = "must-not-start"\n';
  await fs.writeFile(configPath, bytes);
  const outputDir = path.join(root, "codex-with-mcp");
  await assert.rejects(
    runBundleExport({
      outputDir,
      homeDir: home,
      env: { PATH: "" },
      skillNames: [],
      mcpServerNames: ["docs"],
      dryRun: true,
      log: () => {},
    }),
    /toml-mcp_servers/,
  );
  await assert.rejects(fs.stat(outputDir), { code: "ENOENT" });
  assert.equal(await fs.readFile(configPath, "utf8"), bytes);
});

test("an unmanaged target MCP conflict blocks every profile write", async (t) => {
  const { root, home, targetHome } = await fixture(t);
  await fs.mkdir(path.join(home, ".kimi-code"), { recursive: true });
  await fs.writeFile(
    path.join(home, ".kimi-code", "mcp.json"),
    '{"mcpServers":{"docs":{"command":"portable-server"}}}\n',
  );
  const outputDir = path.join(root, "portable-kimi");
  await runBundleExport({
    outputDir,
    agent: "kimi-code",
    homeDir: home,
    env: { PATH: "" },
    skillNames: [],
    mcpServerNames: ["docs"],
    yes: true,
    log: () => {},
  });
  const targetConfig = path.join(targetHome, ".kimi-code", "mcp.json");
  await fs.mkdir(path.dirname(targetConfig), { recursive: true });
  const original = '{"mcpServers":{"docs":{"command":"user-owned"}},"keep":true}\n';
  await fs.writeFile(targetConfig, original);
  const options = {
    profile: "portable",
    profilePath: outputDir,
    agent: "kimi-code",
    homeDir: targetHome,
    projectDir: root,
    env: { PATH: "" },
    log: () => {},
  };
  await runInstall({ ...options, dryRun: true });
  assert.equal(await fs.readFile(targetConfig, "utf8"), original);
  await assert.rejects(fs.stat(path.join(targetHome, ".kimi-code", "AGENTS.md")), {
    code: "ENOENT",
  });
  await assert.rejects(runInstall({ ...options, yes: true }), /conflict/);
  assert.equal(await fs.readFile(targetConfig, "utf8"), original);
  await assert.rejects(fs.stat(path.join(targetHome, "skillfit.lock.json")), { code: "ENOENT" });
});

test("portable install rejects tampered credentials and an unsupported target before writes", async (t) => {
  const { root, home, targetHome } = await fixture(t);
  await fs.mkdir(path.join(home, ".kimi-code"), { recursive: true });
  await fs.writeFile(
    path.join(home, ".kimi-code", "mcp.json"),
    '{"mcpServers":{"docs":{"command":"portable-server"}}}\n',
  );
  const outputDir = path.join(root, "portable-kimi");
  await runBundleExport({
    outputDir,
    agent: "kimi-code",
    homeDir: home,
    env: { PATH: "" },
    skillNames: [],
    mcpServerNames: ["docs"],
    yes: true,
    log: () => {},
  });
  const options = {
    profile: "portable",
    profilePath: outputDir,
    homeDir: targetHome,
    projectDir: root,
    env: { PATH: "" },
    dryRun: true,
    log: () => {},
  };
  const specPath = path.join(outputDir, "mcp", "docs.json");
  const specBytes = await fs.readFile(specPath, "utf8");
  const tampered = JSON.parse(specBytes);
  tampered.env = { TOKEN: "dummy-secret" };
  await fs.writeFile(specPath, JSON.stringify(tampered));
  await assert.rejects(runInstall({ ...options, agent: "kimi-code" }), /env/);
  assert.deepEqual(await fs.readdir(targetHome), []);
  await fs.writeFile(specPath, specBytes);
  const manifestPath = path.join(outputDir, "profile.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  manifest.agents = ["codex"];
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(runInstall({ ...options, agent: "codex" }), /toml-mcp_servers/);
  assert.deepEqual(await fs.readdir(targetHome), []);
});

test("export selects locally installed skills used in multiple sessions by default", async (t) => {
  const { root, home } = await fixture(t);
  for (const name of ["often", "once"]) {
    const dir = path.join(home, ".agents", "skills", name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "SKILL.md"),
      `---\nname: ${name}\ndescription: ${name} tasks.\n---\nDo it.\n`,
    );
  }
  const outputDir = path.join(root, "personal-codex");
  await runBundleExport({
    outputDir,
    homeDir: home,
    yes: true,
    log: () => {},
    loadUsage: async () => [
      { name: "often", sessionCount: 3 },
      { name: "once", sessionCount: 1 },
      { name: "plugin-owned", sessionCount: 20 },
    ],
  });
  const manifest = JSON.parse(await fs.readFile(path.join(outputDir, "profile.json"), "utf8")) as {
    skills: { name: string }[];
  };
  assert.deepEqual(
    manifest.skills.map((skill) => skill.name),
    ["often"],
  );
});

test("exported global guidance preserves user-invoked-only skill routing", async (t) => {
  const { root, home } = await fixture(t);
  const skillDir = path.join(home, ".agents", "skills", "explicit-skill");
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(
    path.join(skillDir, "SKILL.md"),
    "---\nname: explicit-skill\ndescription: Explicit writing help.\n---\nUse when named.\n",
  );
  await fs.mkdir(path.join(skillDir, "agents"));
  await fs.writeFile(
    path.join(skillDir, "agents", "openai.yaml"),
    "interface:\n  display_name: Explicit Skill\npolicy:\n  allow_implicit_invocation: false\n",
  );
  const outputDir = path.join(root, "portable-codex");
  await runBundleExport({
    outputDir,
    homeDir: home,
    skillNames: ["explicit-skill"],
    yes: true,
    log: () => {},
  });
  const rules = await fs.readFile(path.join(outputDir, "rules", "global.md"), "utf8");
  assert.match(rules, /Available for implicit routing in this portable profile: none/);
  assert.match(rules, /User-invoked only: `explicit-skill`/);
});

test("export recognizes flow-style and quoted invocation policies", async (t) => {
  const { root, home } = await fixture(t);
  const skillDir = path.join(home, ".agents", "skills", "explicit-skill");
  await fs.mkdir(path.join(skillDir, "agents"), { recursive: true });
  await fs.writeFile(
    path.join(skillDir, "SKILL.md"),
    "---\nname: explicit-skill\ndescription: Explicit writing help.\n---\nUse when named.\n",
  );
  for (const [index, metadata] of [
    "policy: { allow_implicit_invocation: false }\n",
    'policy:\n  allow_implicit_invocation: "false"\n',
  ].entries()) {
    await fs.writeFile(path.join(skillDir, "agents", "openai.yaml"), metadata);
    const outputDir = path.join(root, `portable-codex-${index}`);
    await runBundleExport({
      outputDir,
      homeDir: home,
      skillNames: ["explicit-skill"],
      yes: true,
      log: () => {},
    });
    const rules = await fs.readFile(path.join(outputDir, "rules", "global.md"), "utf8");
    assert.match(rules, /User-invoked only: `explicit-skill`/);
  }
});

test("export dry-run writes nothing and refuses an existing destination", async (t) => {
  const { root, home } = await fixture(t);
  const outputDir = path.join(root, "personal-codex");
  await runBundleExport({ outputDir, homeDir: home, skillNames: [], dryRun: true, log: () => {} });
  await assert.rejects(fs.stat(outputDir), { code: "ENOENT" });
  await fs.mkdir(outputDir);
  await fs.writeFile(path.join(outputDir, "keep.txt"), "keep");
  await assert.rejects(
    runBundleExport({ outputDir, homeDir: home, skillNames: [], yes: true, log: () => {} }),
    /already exists/,
  );
  assert.equal(await fs.readFile(path.join(outputDir, "keep.txt"), "utf8"), "keep");
});

test("upstream export pins a GitHub skill and keeps a self-written skill local", async (t) => {
  const { root, home } = await fixture(t);
  for (const name of ["local-skill"]) {
    const dir = path.join(home, ".agents", "skills", name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "SKILL.md"),
      `---\nname: ${name}\ndescription: ${name} tasks.\n---\nUse it.\n`,
    );
  }
  const lockPath = path.join(root, "sources.json");
  await fs.writeFile(
    lockPath,
    JSON.stringify({
      version: 1,
      skills: [
        {
          name: "remote-skill",
          repo: "owner/repo",
          commit: "a".repeat(40),
          path: "skills/remote-skill",
          files: [{ path: "SKILL.md", sha256: "b".repeat(64) }],
          explicitOnly: true,
        },
      ],
      localSkills: ["local-skill"],
    }),
  );
  const outputDir = path.join(root, "portable-codex");
  await runBundleExport({
    outputDir,
    homeDir: home,
    upstreamLockPath: lockPath,
    yes: true,
    log: () => {},
    loadUsage: async () => {
      throw new Error("usage selection should not run");
    },
  });
  await assert.rejects(fs.stat(path.join(outputDir, "skills", "remote-skill")), { code: "ENOENT" });
  assert.match(
    await fs.readFile(path.join(outputDir, "skills", "local-skill", "SKILL.md"), "utf8"),
    /Use it/,
  );
  const lock = JSON.parse(
    await fs.readFile(path.join(outputDir, "upstream.lock.json"), "utf8"),
  ) as { skills: { name: string }[]; localSkills: string[] };
  assert.deepEqual(
    lock.skills.map((skill) => skill.name),
    ["remote-skill"],
  );
  assert.deepEqual(lock.localSkills, ["local-skill"]);
  assert.match(
    await fs.readFile(path.join(outputDir, "setup.mjs"), "utf8"),
    /prepareUpstreamProfile/,
  );
  const rules = await fs.readFile(path.join(outputDir, "rules", "global.md"), "utf8");
  assert.match(rules, /User-invoked only: `remote-skill`/);
});

test("relocated upstream installer runs offline with only pinned local Skills", async (t) => {
  const { root, home, targetHome } = await fixture(t);
  const skill = path.join(home, ".agents/skills/local-skill");
  await fs.mkdir(skill, { recursive: true });
  await fs.writeFile(
    path.join(skill, "SKILL.md"),
    "---\nname: local-skill\ndescription: Offline local fixture.\n---\nUse it.\n",
  );
  const lock = path.join(root, "local-sources.json");
  await fs.writeFile(
    lock,
    JSON.stringify({ version: 1, skills: [], localSkills: ["local-skill"] }),
  );
  const output = path.join(root, "upstream-portable"),
    moved = path.join(root, "relocated-upstream", "upstream-portable");
  await runBundleExport({
    outputDir: output,
    homeDir: home,
    upstreamLockPath: lock,
    yes: true,
    log: () => {},
  });
  await fs.mkdir(path.dirname(moved));
  await fs.rename(output, moved);
  await fs.rm(home, { recursive: true });
  for (const flags of [["--dry-run"], ["--yes"]]) {
    const result = spawnSync(process.execPath, [path.join(moved, "setup.mjs"), ...flags], {
      cwd: root,
      encoding: "utf8",
      env: {
        HOME: targetHome,
        USERPROFILE: targetHome,
        PATH: "",
        CODEX_HOME: path.join(targetHome, "codex"),
      },
      timeout: 10_000,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    if (flags[0] === "--dry-run") assert.deepEqual(await fs.readdir(targetHome), []);
  }
  assert.match(
    await fs.readFile(path.join(targetHome, ".agents/skills/local-skill/SKILL.md"), "utf8"),
    /Offline local fixture/,
  );
});
