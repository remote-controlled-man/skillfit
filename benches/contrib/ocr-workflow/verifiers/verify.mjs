import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyReview } from "./review.mjs";

const [scenario, root] = process.argv.slice(2);
if (!root || !["refresh-review", "reuse-review"].includes(scenario)) throw new Error("Expected a scenario and trial directory.");
const test = spawnSync(process.execPath, [fileURLToPath(new URL("./functional.mjs", import.meta.url)), root], {
  encoding: "utf8",
  timeout: 10_000,
});
const functional = test.status === null ? "unknown" : test.status === 0 ? "passed" : "failed";
const output = join(root, "_output.md");
const delivered = existsSync(output) && lstatSync(output).isFile() && Boolean(readFileSync(output, "utf8").trim());
const regression = join(root, "tests", "inventory.test.mjs");
const regressionTest = existsSync(regression) && lstatSync(regression).isFile();
const checks = [
  { name: "functional behavior", pass: functional === "passed" },
  { name: "regression test present", pass: regressionTest },
  { name: "delivery", pass: delivered },
];
if (process.env.SKILLFIT_VERIFIER_MODE === "trigger") {
  const passed = checks.every((check) => check.pass);
  console.log(JSON.stringify({ passed, checks }));
  process.exit(passed ? 0 : 1);
}
const workflow = delivered ? verifyReview(root, scenario) : [
  { name: "delivery", status: "unknown", detail: "No completed delivery to review." },
];
const workflowFailed = workflow.some((check) => check.status === "failed");
const workflowUnknown = workflow.some((check) => check.status === "unknown");
checks.push({ name: "workflow acceptance", pass: !workflowFailed && !workflowUnknown });
const passed = checks.every((check) => check.pass);
if (functional === "unknown" || (delivered && functional === "passed" &&
  !workflowFailed && workflowUnknown)) {
  console.log(JSON.stringify({ schemaVersion: 1, kind: "skillfit.verifier-error", message: "Required workflow evidence is incomplete; see the named checks." }));
}
console.log(JSON.stringify({ passed, checks, workflow: { functional, checks: workflow } }));
process.exitCode = passed ? 0 : 1;
