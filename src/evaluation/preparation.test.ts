import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { prepareSkillRevision } from "./application/preparation.js";
import { runComponentEvaluation } from "./application/evaluation.js";
import { loadEvalRequest } from "./application/request.js";

function setup(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), "skillfit-preparation-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const sourceDir = join(root, "repo");
  mkdirSync(sourceDir);
  const git = (...args: string[]) => {
    const r = spawnSync("git", args, { cwd: sourceDir, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  git("init");
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@example.invalid");
  writeFileSync(join(sourceDir, "index.cjs"), "module.exports = (a,b) => a-b;\n");
  writeFileSync(
    join(sourceDir, "index.test.cjs"),
    "require('node:assert/strict').equal(require('./index.cjs')(2,1),1);\n",
  );
  git("add", ".");
  git("commit", "-m", "initial");
  writeFileSync(join(sourceDir, "index.cjs"), "module.exports = (a,b) => a+b;\n");
  writeFileSync(
    join(sourceDir, "index.test.cjs"),
    "require('node:assert/strict').equal(require('./index.cjs')(2,1),3);\n",
  );
  git("add", ".");
  git("commit", "-m", "fix: secret solution must not enter the task prompt");
  const fromCommit = git("rev-parse", "HEAD");
  for (const name of ["old", "new"]) {
    mkdirSync(join(root, name, "scripts"), { recursive: true });
    writeFileSync(
      join(root, name, "SKILL.md"),
      `---\nname: sample\ndescription: Diagnose arithmetic bugs.\n---\n${name}\n`,
    );
    writeFileSync(join(root, name, "scripts", "asset.bin"), Buffer.from([0, 255, 8]));
  }
  const promptFile = join(root, "issue.md");
  writeFileSync(
    promptFile,
    "The addition function returns the wrong result. Fix it without changing its public API.",
  );
  const options = {
    candidateSkill: join(root, "new"),
    baselineSkill: join(root, "old"),
    workspace: join(root, "comparison"),
    sourceDir,
    fromCommit,
    promptFile,
    agent: "codex",
    yes: true,
  };
  return { root, options };
}

test("preparation previews without writes, then creates a gate-checked request and complete Skill copies", async (t) => {
  const { options } = setup(t);
  const preview = await prepareSkillRevision({ ...options, dryRun: true });
  assert.equal(preview.status, "preview");
  assert.equal(preview.modelCalls, 0);
  assert.equal(preview.maxCalls, 2);
  assert.equal(existsSync(options.workspace), false);
  const result = await prepareSkillRevision(options);
  assert.equal(result.status, "ready", JSON.stringify(result));
  const { request } = loadEvalRequest(result.requestPath);
  assert.equal(request.purpose, "development");
  assert.equal(request.trials, 1);
  assert.equal(request.maxCalls, 2);
  assert.equal(request.pairOrder, "balanced");
  assert.deepEqual(
    readFileSync(join(request.candidateSkill, "scripts/asset.bin")),
    Buffer.from([0, 255, 8]),
  );
  assert.ok(result.nextCommands.some((c) => c.includes("--request") && c.includes("--dry-run")));
  const manifest = JSON.parse(readFileSync(join(request.bench, "bench.json"), "utf8"));
  assert.equal(manifest.tasks.length, 1);
  assert.ok(
    !readFileSync(join(request.bench, manifest.tasks[0].prompt), "utf8").includes(
      "secret solution",
    ),
  );
  const plan = await runComponentEvaluation(result.requestPath, {
    dryRun: true,
    skillInstallDir: "project-skills",
    executor: {
      describe: () => ({ kind: "mock", model: "offline-preparation" }),
      run: async () => {
        throw new Error("preview must not call an executor");
      },
    },
  });
  assert.ok("plan" in plan);
  assert.equal(existsSync(join(request.runsRoot, request.runGroup)), false);
});

test("preparation refuses existing destinations, identical revisions and changed input after confirmation", async (t) => {
  const { root, options } = setup(t);
  mkdirSync(options.workspace);
  await assert.rejects(prepareSkillRevision(options), /already exists/);
  rmSync(options.workspace, { recursive: true });
  await assert.rejects(
    prepareSkillRevision({ ...options, candidateSkill: options.baselineSkill }),
    /identical/,
  );
  await assert.rejects(
    prepareSkillRevision({
      ...options,
      yes: false,
      confirm: async () => {
        const file = join(root, "new/SKILL.md");
        writeFileSync(file, readFileSync(file, "utf8") + "changed");
        return true;
      },
    }),
    /changed/,
  );
  assert.equal(existsSync(options.workspace), false);
});

test("preparation never writes inside an input Skill and requires a budget for a disabled deadline", async (t) => {
  const { options } = setup(t);
  await assert.rejects(
    prepareSkillRevision({ ...options, workspace: join(options.baselineSkill, "comparison") }),
    /inside.*Skill/,
  );
  assert.equal(existsSync(join(options.baselineSkill, "comparison")), false);
  await assert.rejects(
    prepareSkillRevision({ ...options, executorTimeoutSeconds: null }),
    /budget|Token/,
  );
  assert.equal(existsSync(options.workspace), false);
});

test("failed bench gates stay blocked and retain reviewable inputs", async (t) => {
  const { options } = setup(t);
  const result = await prepareSkillRevision({
    ...options,
    verifierCmd: 'node -e "process.exit(0)"',
  });
  assert.equal(result.status, "blocked");
  assert.ok(existsSync(result.requestPath));
  assert.ok(result.checks && result.checks.failures > 0);
});

test("CLI preparation validates options and creates a request without hand editing", (t) => {
  const { options } = setup(t);
  const cli = fileURLToPath(new URL("../cli/main.js", import.meta.url));
  const args = [
    cli,
    "eval",
    options.candidateSkill,
    "--prepare",
    options.workspace,
    "--baseline-skill",
    options.baselineSkill,
    "--from-commit",
    options.fromCommit,
    "--source-dir",
    options.sourceDir,
    "--prompt-file",
    options.promptFile,
    "--agent",
    "codex",
    "--json",
    "--yes",
  ];
  const invalid = spawnSync(process.execPath, [...args, "--request", "ignored.json"], {
    encoding: "utf8",
  });
  assert.notEqual(invalid.status, 0);
  assert.equal(existsSync(options.workspace), false);
  const unconfirmed = spawnSync(
    process.execPath,
    args.filter((arg) => arg !== "--yes"),
    { encoding: "utf8", input: "" },
  );
  assert.notEqual(unconfirmed.status, 0);
  assert.equal(existsSync(options.workspace), false);
  assert.equal(JSON.parse(unconfirmed.stdout).kind, "skillfit.eval-error");
  const preview = spawnSync(process.execPath, [...args, "--dry-run"], { encoding: "utf8" });
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(JSON.parse(preview.stdout).status, "preview");
  assert.equal(existsSync(options.workspace), false);
  const created = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(created.status, 0, created.stderr);
  assert.equal(JSON.parse(created.stdout).status, "ready");
});

test("preparation cancellation and failed writes leave no partial workspace", async (t) => {
  const { options } = setup(t);
  assert.equal(
    (await prepareSkillRevision({ ...options, yes: false, confirm: async () => false })).status,
    "cancelled",
  );
  assert.equal(existsSync(options.workspace), false);
  await assert.rejects(
    prepareSkillRevision(options, {
      writeFile: () => {
        throw new Error("disk failure");
      },
    }),
    /disk failure/,
  );
  assert.equal(existsSync(options.workspace), false);
});

test("preparation rejects symlink destinations and Skill resources", {
  skip: process.platform === "win32",
}, async (t) => {
  const { root, options } = setup(t);
  symlinkSync(join(root, "missing"), options.workspace);
  await assert.rejects(prepareSkillRevision(options), /already exists|symlink/i);
  rmSync(options.workspace);
  symlinkSync(join(root, "issue.md"), join(root, "new/link.md"));
  await assert.rejects(prepareSkillRevision(options), /Symbolic links/);
});
