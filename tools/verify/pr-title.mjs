import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const TITLE_TYPES = [
  "feat",
  "fix",
  "docs",
  "test",
  "refactor",
  "perf",
  "build",
  "ci",
  "chore",
  "revert",
];
const MAX_LENGTH = 100;
const FORMAT = new RegExp(`^(?:${TITLE_TYPES.join("|")})(?:\\([a-z0-9][a-z0-9-]*\\))?!?: \\S`);
const GITHUB_REVERT = /^Revert ".+"$/;

/** Issue titles, and PR titles that become squash commit subjects, share this format. */
export function titleProblems(title) {
  const problems = [];
  if (!GITHUB_REVERT.test(title) && !FORMAT.test(title))
    problems.push(`use "type(scope): subject" with a type from: ${TITLE_TYPES.join(", ")}`);
  if (/\.\s*$/.test(title)) problems.push("drop the trailing period");
  if (title.length > MAX_LENGTH)
    problems.push(`keep the title within ${MAX_LENGTH} characters (now ${title.length})`);
  return problems;
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const title = process.env.PR_TITLE ?? process.env.ISSUE_TITLE ?? "";
  const problems = titleProblems(title);
  if (problems.length) {
    console.error(`Title "${title}" does not follow CONTRIBUTING.md:`);
    for (const problem of problems) console.error(`- ${problem}`);
    process.exitCode = 1;
  } else console.log(`Title follows CONTRIBUTING.md: ${title}`);
}
