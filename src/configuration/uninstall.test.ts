import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInstall } from "./install.js";
import { runUninstall } from "./uninstall.js";

const PROFILES_DIR = fileURLToPath(new URL("../../profiles/", import.meta.url));

async function fixture(t: test.TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skillfit-uninstall-transaction-"));
  const home = path.join(root, "home");
  const project = path.join(root, "project");
  await fs.mkdir(home, { recursive: true });
  await fs.mkdir(project, { recursive: true });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const common = {
    homeDir: home,
    projectDir: project,
    profilesDir: PROFILES_DIR,
    env: { PATH: "" },
    log: () => {},
  };
  await runInstall({ ...common, profile: "recommended", agent: "kimi-code", yes: true });
  return { root, home, project, common };
}

test("uninstall restores a moved Skill when the lock write fails", async (t) => {
  const { home, common } = await fixture(t);
  const skillPath = path.join(home, ".agents", "skills", "commit-message", "SKILL.md");
  const rulesPath = path.join(home, ".kimi-code", "AGENTS.md");
  const lockPath = path.join(home, "skillfit.lock.json");
  const skillBefore = await fs.readFile(skillPath, "utf8");
  const rulesBefore = await fs.readFile(rulesPath, "utf8");
  const lockBefore = await fs.readFile(lockPath, "utf8");
  const originalRename = fs.rename;
  let injected = false;
  fs.rename = async (from, to) => {
    if (to === lockPath && String(from).includes(".skillfit-staged")) {
      injected = true;
      throw new Error("injected lock rename failure");
    }
    await originalRename(from, to);
  };
  t.after(() => {
    fs.rename = originalRename;
  });
  await assert.rejects(
    runUninstall({ ...common, agent: "kimi-code", skills: ["commit-message"], yes: true }),
    /injected lock rename failure/,
  );
  assert.equal(injected, true);
  assert.equal(await fs.readFile(skillPath, "utf8"), skillBefore);
  assert.equal(await fs.readFile(rulesPath, "utf8"), rulesBefore);
  assert.equal(await fs.readFile(lockPath, "utf8"), lockBefore);
  const siblings = await fs.readdir(path.dirname(skillPath));
  assert.deepEqual(
    siblings.filter((name) => name.endsWith(".skillfit-removed")),
    [],
  );
});

test("uninstall cancellation preserves the Skill, rules and lock before effects", async (t) => {
  const { home, common } = await fixture(t);
  const skillPath = path.join(home, ".agents", "skills", "commit-message", "SKILL.md");
  const lockPath = path.join(home, "skillfit.lock.json");
  const skillBefore = await fs.readFile(skillPath, "utf8");
  const lockBefore = await fs.readFile(lockPath, "utf8");
  const result = await runUninstall({
    ...common,
    agent: "kimi-code",
    skills: ["commit-message"],
    confirm: async () => false,
  });
  assert.equal(result.status, "cancelled");
  assert.equal(await fs.readFile(skillPath, "utf8"), skillBefore);
  assert.equal(await fs.readFile(lockPath, "utf8"), lockBefore);
  const siblings = await fs.readdir(path.dirname(skillPath));
  assert.deepEqual(
    siblings.filter((name) => name.endsWith(".skillfit-removed")),
    [],
  );
});
