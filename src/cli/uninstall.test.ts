import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("./main.js", import.meta.url));

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "skillfit-cli-uninstall-"));
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

function run(f: ReturnType<typeof fixture>, args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: f.cwd,
    env: f.env,
    encoding: "utf8",
    timeout: 10_000,
  });
}

test("uninstall removes only a selected managed Skill and retains a usable recovery copy", (t) => {
  const f = fixture(t);
  const install = run(f, ["install", "--agent", "kimi-code", "--yes"]);
  assert.equal(install.status, 0, install.stderr);
  const skillDir = join(f.home, ".agents", "skills", "commit-message");
  const original = readFileSync(join(skillDir, "SKILL.md"), "utf8");
  const lockPath = join(f.home, "skillfit.lock.json");
  const rulesPath = join(f.home, ".kimi-code", "AGENTS.md");
  const rulesBefore = readFileSync(rulesPath, "utf8");
  const preview = run(f, [
    "uninstall",
    "--agent",
    "kimi-code",
    "--skill",
    "commit-message",
    "--dry-run",
  ]);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /commit-message/);
  assert.equal(readFileSync(join(skillDir, "SKILL.md"), "utf8"), original);
  assert.ok(JSON.parse(readFileSync(lockPath, "utf8")).entries["kimi-code:skill:commit-message"]);

  const applied = run(f, [
    "uninstall",
    "--agent",
    "kimi-code",
    "--skill",
    "commit-message",
    "--yes",
  ]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(existsSync(skillDir), false);
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  assert.equal(lock.entries["kimi-code:skill:commit-message"], undefined);
  assert.ok(lock.entries["kimi-code:rules"]);
  assert.equal(readFileSync(rulesPath, "utf8"), rulesBefore);
  const recovery = readdirSync(join(f.home, ".agents", "skills")).find(
    (name) => name.startsWith(".commit-message.") && name.endsWith(".skillfit-removed"),
  );
  assert.ok(recovery);
  assert.equal(
    readFileSync(join(f.home, ".agents", "skills", recovery, "SKILL.md"), "utf8"),
    original,
  );
  renameSync(join(f.home, ".agents", "skills", recovery), skillDir);
  assert.equal(readFileSync(join(skillDir, "SKILL.md"), "utf8"), original);
});

test("uninstall rules removes only the managed block and preserves outside user content", (t) => {
  const f = fixture(t);
  assert.equal(run(f, ["install", "--agent", "kimi-code", "--yes"]).status, 0);
  const rulesPath = join(f.home, ".kimi-code", "AGENTS.md");
  const lockPath = join(f.home, "skillfit.lock.json");
  const original = readFileSync(rulesPath, "utf8");
  writeFileSync(rulesPath, `${original}\nUser-owned tail\n`);
  const before = readFileSync(rulesPath, "utf8");
  const preview = run(f, ["uninstall", "--agent", "kimi-code", "--rules", "--dry-run"]);
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(readFileSync(rulesPath, "utf8"), before);
  const applied = run(f, ["uninstall", "--agent", "kimi-code", "--rules", "--yes"]);
  assert.equal(applied.status, 0, applied.stderr);
  const after = readFileSync(rulesPath, "utf8");
  assert.doesNotMatch(after, /SKILLFIT_START|SKILLFIT_END/);
  assert.match(after, /User-owned tail/);
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  assert.equal(lock.entries["kimi-code:rules"], undefined);
  assert.ok(lock.entries["kimi-code:skill:commit-message"]);
  assert.ok(existsSync(join(f.home, ".agents", "skills", "commit-message", "SKILL.md")));
});

test("uninstall refuses local Skill drift without changing content or the lock", (t) => {
  const f = fixture(t);
  assert.equal(run(f, ["install", "--agent", "kimi-code", "--yes"]).status, 0);
  const skillPath = join(f.home, ".agents", "skills", "commit-message", "SKILL.md");
  const lockPath = join(f.home, "skillfit.lock.json");
  writeFileSync(skillPath, "local edit\n");
  const lockBefore = readFileSync(lockPath, "utf8");
  const preview = run(f, [
    "uninstall",
    "--agent",
    "kimi-code",
    "--skill",
    "commit-message",
    "--dry-run",
  ]);
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /conflict/);
  assert.equal(readFileSync(skillPath, "utf8"), "local edit\n");
  assert.equal(readFileSync(lockPath, "utf8"), lockBefore);
  const applied = run(f, [
    "uninstall",
    "--agent",
    "kimi-code",
    "--skill",
    "commit-message",
    "--yes",
  ]);
  assert.equal(applied.status, 1);
  assert.match(applied.stderr, /conflict/i);
  assert.equal(readFileSync(skillPath, "utf8"), "local edit\n");
  assert.equal(readFileSync(lockPath, "utf8"), lockBefore);
  const recovery = readdirSync(join(f.home, ".agents", "skills")).filter((name) =>
    name.endsWith(".skillfit-removed"),
  );
  assert.deepEqual(recovery, []);
});
