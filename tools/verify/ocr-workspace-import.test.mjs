import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("historical OCR report preserves the saved function result when review evidence is absent", (t) => {
  const archive = mkdtempSync(join(tmpdir(), "skillfit-ocr-archive-"));
  t.after(() => rmSync(archive, { recursive: true, force: true }));
  writeFileSync(join(archive, "verifier.txt"), '{"passed":true,"failures":[]}\n');

  const result = spawnSync(
    process.execPath,
    ["dist/cli.js", "report", "ocr-workspace", archive, "--json"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.kind, "skillfit.ocr-workspace-report");
  assert.equal(report.modelCalls, 0);
  const [row] = report.cases;
  assert.equal(row.archive, archive);
  assert.equal(row.workflow.functional, "passed");
  assert.equal(row.status, "unknown");
  assert.equal(row.observedRounds, null);
  assert.match(row.workflow.checks.find(({ name }) => name === "execution").detail, /raw\.jsonl/);
});

function historicalCase(root, scenario) {
  const project = join(root, "project");
  // Imported identities and commands use the source archive's POSIX paths.
  const originalRun = `/archive/ocr-workspace/${scenario}`;
  const originalProject = `${originalRun}/project`;
  const gate = "project/.scratch/ocr-gate";
  const events = `${gate}/delegate-events`;
  mkdirSync(join(root, events), { recursive: true });
  mkdirSync(join(project, "tests"), { recursive: true });
  mkdirSync(join(root, ".codex"), { recursive: true });
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: project,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    }).trim();
  git("init", "-q");
  writeFileSync(join(project, "inventory.py"), "x = 0\n");
  git("add", "inventory.py");
  git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "base");
  const emptyAndDeleted = scenario === "empty-and-deleted";
  const contents = {
    "inventory.py": emptyAndDeleted ? null : "x = 1\n",
    "tests/test_retry.py": emptyAndDeleted ? "" : "assert True\n",
  };
  const files = Object.entries(contents).map(([path, content]) => {
    if (content === null) {
      rmSync(join(project, path));
      return { path, sha256: null, status: "deleted" };
    }
    writeFileSync(join(project, path), content);
    return {
      path,
      sha256: digest(readFileSync(join(project, path))),
      status: path === "inventory.py" ? "modified" : "added",
    };
  });
  const seedPolicy = {
    reviewer: "ocr",
    rulesIdentity: "a".repeat(64),
    guidance: [],
    requirements: "Original request",
  };
  const finalPolicy = {
    ...seedPolicy,
    requirements:
      scenario === "reuse" || scenario === "missing-receipt"
        ? seedPolicy.requirements
        : "Updated request",
  };
  function snapshot(policy) {
    const identity = {
      root: originalProject,
      base: git("rev-parse", "HEAD"),
      files,
      requirements: policy.requirements,
      reviewer: "ocr",
      rulesIdentity: digest(canonical({ declared: policy.rulesIdentity, guidance: {} })),
    };
    return { ...identity, required: true, fingerprint: digest(canonical(identity)) };
  }
  const initial = snapshot(seedPolicy);
  const final = snapshot(finalPolicy);
  const prepared = { ...initial, status: "prepared", guidance: [] };
  const receipt = {
    status: "reviewed",
    fingerprint: initial.fingerprint,
    reviewer: "ocr",
    preparationSha256: digest(canonical(prepared)),
    requirementsAssessment: "Checked original request",
    files: files.map(({ path }) => ({ path, assessment: "Checked", findings: [] })),
  };
  const json = (path, data) => writeFileSync(join(root, path), JSON.stringify(data));
  json("seed.json", { snapshot: initial, fingerprint: initial.fingerprint, receipt });
  json("seed.policy.json", seedPolicy);
  json(".codex/review-policy.json", finalPolicy);
  if (scenario !== "missing-receipt") json(`${gate}/receipt.json`, receipt);
  json(`${gate}/prepared.json`, prepared);
  json("verifier.txt", { passed: true });
  // An old computed result has no authority over the imported evidence.
  json("result.json", { passed: false, rounds: 99 });
  const transcript = [{ type: "thread.started" }, { type: "turn.started" }];
  let count = 0;
  function runRound(phase, snap) {
    const selected = scenario === "uncovered" && phase === "model" ? files.slice(0, 1) : files;
    const selection =
      scenario === "missing-hash" && phase === "model"
        ? selected.map(({ path }, i) => (i === 0 ? { path } : { path, sha256: null }))
        : selected;
    const preview = {
      reviewable_files: selection,
      workspace_collection: {
        fingerprint: snap.fingerprint,
        requirements: snap.requirements,
        inputs: selected.map((file) => {
          const content = contents[file.path];
          const input = { ...file, content, contentStatus: content === null ? "deleted" : "text" };
          if (phase !== "model" || file.path !== "tests/test_retry.py") return input;
          if (scenario === "wrong-content") return { ...input, content: "" };
          if (scenario === "missing-content") delete input.content;
          return input;
        }),
      },
    };
    const rules = { groups: [{ files: selected.map(({ path }) => path) }] };
    for (const [action, payload] of [
      ["preview", preview],
      ["rule", rules],
    ]) {
      const argv = ["delegate", action, "--format", "json"];
      const stdout = JSON.stringify(payload);
      const id = String(++count);
      json(`${events}/000${id}.json`, {
        phase,
        argv,
        cwd: originalProject,
        exitCode: 0,
        nativeExitCode: 0,
        stdout,
        before: snap,
        after: snap,
      });
      if (phase === "model") {
        const item = {
          id,
          type: "command_execution",
          command: `${originalRun}/bin/ocr ${argv.join(" ")}`,
        };
        transcript.push(
          { type: "item.started", item },
          { type: "item.completed", item: { ...item, exit_code: 0, aggregated_output: stdout } },
        );
      }
    }
  }
  runRound("setup", initial);
  if (!["reuse", "missed", "missing-receipt"].includes(scenario)) runRound("model", final);
  if (scenario === "duplicate") runRound("model", final);
  if (scenario !== "truncated") transcript.push({ type: "turn.completed" });
  writeFileSync(
    join(root, "raw.jsonl"),
    `${transcript.map((line) => JSON.stringify(line)).join("\n")}\n`,
  );
  return { originalProject, files, fingerprint: final.fingerprint };
}

const digest = (data) => createHash("sha256").update(data).digest("hex");
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

test("OCR history imports tied evidence after relocation and distinguishes failures from evidence gaps", (t) => {
  const root = mkdtempSync(join(tmpdir(), "skillfit-ocr-historical-cases-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const scenarios = [
    "missed",
    "reuse",
    "reviewed",
    "uncovered",
    "duplicate",
    "truncated",
    "missing-hash",
    "missing-receipt",
    "wrong-content",
    "missing-content",
    "empty-and-deleted",
  ];
  const archives = [];
  const identities = [];
  for (const scenario of scenarios) {
    const original = join(root, "original", scenario);
    identities.push(historicalCase(original, scenario));
    const moved = join(root, "relocated", scenario);
    mkdirSync(join(root, "relocated"), { recursive: true });
    renameSync(original, moved);
    archives.push(moved);
  }
  const result = spawnSync(
    process.execPath,
    ["dist/cli.js", "report", "ocr-workspace", ...archives, "--json"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.source, "historical-ocr-workspace");
  assert.equal(report.modelCalls, 0);
  for (const [i, row] of report.cases.entries()) {
    assert.equal(row.workflow.functional, "passed");
    assert.equal(row.originalProject, identities[i].originalProject);
    assert.equal(row.finalFingerprint, identities[i].fingerprint);
    assert.deepEqual(row.finalFiles, identities[i].files);
    assert.equal(row.artifacts.setupCalls.length, 2);
  }
  const [
    missed,
    reuse,
    reviewed,
    uncovered,
    duplicate,
    truncated,
    missingHash,
    missingReceipt,
    wrongContent,
    missingContent,
    emptyAndDeleted,
  ] = report.cases;
  const check = ({ workflow }, name) => workflow.checks.find((item) => item.name === name);
  assert.deepEqual([missed.status, missed.expectedRounds, missed.observedRounds], ["failed", 1, 0]);
  assert.deepEqual(
    [reuse.status, reuse.priorReviewValid, reuse.observedRounds, reuse.duplicateRounds],
    ["passed", true, 0, 0],
  );
  assert.deepEqual(
    [reviewed.status, reviewed.observedRounds, reviewed.duplicateRounds],
    ["passed", 1, 0],
  );
  assert.deepEqual(reviewed.coveredPaths, ["inventory.py", "tests/test_retry.py"]);
  assert.equal(reviewed.artifacts.reviews[0].evidence[0], join(archives[2], "raw.jsonl#L4"));
  assert.equal(check(uncovered, "coverage").status, "failed");
  assert.match(check(uncovered, "coverage").detail, /tests\/test_retry\.py/);
  assert.equal(duplicate.duplicateRounds, 1);
  assert.equal(check(duplicate, "duplicate review").status, "failed");
  assert.equal(truncated.observedRounds, null);
  assert.match(check(truncated, "execution").detail, /Incomplete.*raw\.jsonl/);
  assert.equal(check(missingHash, "coverage").status, "unknown");
  assert.match(check(missingHash, "coverage").detail, /Missing preview SHA-256/);
  assert.match(check(missingHash, "coverage").detail, /tests\/test_retry\.py/);
  assert.equal(missingReceipt.expectedRounds, null);
  assert.match(check(missingReceipt, "prior review").detail, /receipt\.json/);
  assert.equal(check(wrongContent, "coverage").status, "failed");
  assert.match(check(wrongContent, "coverage").detail, /text SHA-256.*tests\/test_retry\.py/i);
  assert.deepEqual(wrongContent.coveredPaths, ["inventory.py"]);
  assert.equal(check(missingContent, "coverage").status, "unknown");
  assert.match(check(missingContent, "coverage").detail, /Missing.*text.*tests\/test_retry\.py/i);
  assert.equal(check(emptyAndDeleted, "coverage").status, "passed");
  assert.deepEqual(emptyAndDeleted.coveredPaths, ["inventory.py", "tests/test_retry.py"]);
});
