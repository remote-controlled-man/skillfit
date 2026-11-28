import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  fixedTranscript,
  repairFixture,
} from "../../benches/contrib/ocr-workflow/verifiers/controls.mjs";

test("OCR workflow example renders run evidence for passing, failing, and unknown review checks", (t) => {
  const root = mkdtempSync(join(tmpdir(), "skillfit-ocr-workflow-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, ["benches/contrib/ocr-workflow/demo.mjs", root], {
    encoding: "utf8",
    timeout: 25_000,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = readFileSync(join(root, "report.md"), "utf8");
  assert.match(report, /Synthetic harness run/);
  assert.match(
    report,
    /\| refresh-review \/ baseline 1 \| Passed \| Observed \| Failed \|.*expected 1.*observed 0/i,
  );
  assert.match(
    report,
    /\| refresh-review \/ treatment 1 \| Passed \| Observed \| Passed \|.*2\/2.*0 duplicate/i,
  );
  assert.match(
    report,
    /\| reuse-review \/ baseline 1 \| Passed \| Unknown \| Passed \|.*prior review matches.*0 new rounds/i,
  );
  assert.match(
    report,
    /\| refresh-review \/ baseline 2 \| Passed \| Unknown \| Unknown \|.*Missing command transcript/i,
  );
  assert.match(
    report,
    /\| refresh-review \/ treatment 2 \| Passed \| Observed \| Failed \|.*coverage.*tests\/inventory\.test\.mjs/i,
  );
  assert.match(
    report,
    /\| refresh-review \/ treatment 3 \| Passed \| Observed \| Failed \|.*1 duplicate/i,
  );
  assert.match(
    report,
    /\| refresh-review \/ baseline 3 \| Passed \| Unknown \| Unknown \|.*incomplete/i,
  );
  const preview = readFileSync(join(root, "dry-run.txt"), "utf8");
  assert.match(preview, /4 planned; ceiling 4/);
  assert.match(preview, /ocr 1\.14\.4/);
  assert.match(preview, /final workspace/);
  for (const [, path] of report.matchAll(/\]\(((?:refresh-review|reuse-review)\/[^)]+)\)/g)) {
    assert.ok(existsSync(join(root, "runs", "ocr-example", decodeURIComponent(path))), path);
  }
  const trigger = spawnSync(
    process.execPath,
    [
      "dist/cli.js",
      "eval",
      join(root, "skill-new"),
      "--bench",
      "benches/contrib/ocr-workflow",
      "--mode",
      "trigger",
      "--agent",
      "codex",
      "--trials",
      "1",
      "--max-calls",
      "2",
      "--runs-root",
      join(root, "trigger-runs"),
      "--dry-run",
    ],
    { encoding: "utf8" },
  );
  assert.equal(trigger.status, 0, trigger.stderr);
  assert.match(trigger.stdout, /trigger mode observes Skill reads only/);
  assert.ok(!existsSync(join(root, "trigger-runs")));
});

test("a successful OCR round with no final fingerprints reports unknown coverage", (t) => {
  const root = mkdtempSync(join(tmpdir(), "skillfit-ocr-coverage-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bench = "benches/contrib/ocr-workflow";
  cpSync(join(bench, "tasks/refresh-review/fixture"), root, { recursive: true });
  repairFixture(root);
  writeFileSync(join(root, "_output.md"), "Checked the reservation behavior.\n");
  writeFileSync(join(root, "_transcript.jsonl"), fixedTranscript(root, "missing-digests"));
  const result = spawnSync(
    process.execPath,
    [join(bench, "verifiers/verify.mjs"), "refresh-review", root],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  const output = result.stdout.trimEnd().split("\n").map(JSON.parse);
  assert.equal(output[0]?.kind, "skillfit.verifier-error");
  assert.equal(output[1]?.workflow.functional, "passed");
  assert.equal(
    output[1]?.workflow.checks.find((check) => check.name === "execution")?.status,
    "passed",
  );
  assert.equal(
    output[1]?.workflow.checks.find((check) => check.name === "coverage")?.status,
    "unknown",
  );
});
