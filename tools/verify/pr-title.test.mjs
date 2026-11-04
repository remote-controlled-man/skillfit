import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { titleProblems } from "./pr-title.mjs";

const SCRIPT = fileURLToPath(new URL("./pr-title.mjs", import.meta.url));

test("accepts Conventional Commits titles, Dependabot bumps and GitHub reverts", () => {
  for (const title of [
    "docs: move the working plan out of the repository",
    "fix(cli): count symlinked skills",
    "feat(report)!: drop the legacy column",
    "chore(deps-dev): bump @types/node from 22.20.3 to 22.20.5",
    'Revert "fix(cli): count symlinked skills"',
  ])
    assert.deepEqual(titleProblems(title), [], title);
});

test("rejects a missing or unknown type, a malformed separator and an empty subject", () => {
  for (const title of [
    "Update stuff",
    "package: omit contributed benches",
    "Docs: capitalized type",
    "docs:missing space",
    "docs: ",
    "fix(CLI): uppercase scope",
  ])
    assert.match(titleProblems(title).join("\n"), /type\(scope\): subject/, title);
});

test("rejects a trailing period and a title longer than 100 characters", () => {
  assert.match(titleProblems("docs: end with a period.").join("\n"), /period/);
  assert.match(titleProblems(`docs: ${"x".repeat(95)}`).join("\n"), /100 characters/);
});

test("the command reads PR_TITLE and exits non-zero with the reason", () => {
  const run = (title) =>
    spawnSync(process.execPath, [SCRIPT], {
      encoding: "utf8",
      env: { ...process.env, PR_TITLE: title },
    });
  assert.equal(run("docs: a good title").status, 0);
  const bad = run("Update stuff");
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /CONTRIBUTING\.md/);
});
