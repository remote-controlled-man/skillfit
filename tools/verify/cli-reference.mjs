import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CLI_OPTIONS, helpCorpus } from "../../dist/cli/definition.js";

const START = "<!-- cli-reference:start -->",
  END = "<!-- cli-reference:end -->";
// Documentation selects useful rows; facts come only from help + parser declarations.
const SELECTED = [
  "agent",
  "mode",
  "baseline-skill",
  "request",
  "plan-sha",
  "json",
  "bench",
  "task",
  "trials",
  "max-calls",
  "pair-order",
  "executor-timeout-seconds",
  "spending-budget",
  "runs-root",
  "run-group",
  "input",
  "replay",
  "export",
];

function optionLines(usage) {
  const lines = usage.split("\n"),
    kept = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== "Options:") continue;
    for (i += 1; i < lines.length; i++) {
      if (lines[i] === "") {
        if (!/^ {4,}\S/.test(lines[i + 1] ?? "")) break;
        continue;
      }
      if (!lines[i].startsWith(" ")) break;
      kept.push(lines[i]);
    }
  }
  return kept;
}

export function cliReference(usage = helpCorpus(), options = CLI_OPTIONS) {
  const lines = optionLines(usage);
  const rows = [];
  for (const name of SELECTED) {
    if (!Object.hasOwn(options, name)) throw Error(`Documented option is not declared: --${name}`);
    const found = [];
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith(`  --${name} `)) continue;
      const match = /^\s+(--\S+(?: <[^>]+>)?)\s{2,}(.+)$/.exec(lines[i]);
      if (!match) throw Error(`Cannot derive help row for --${name}.`);
      let description = match[2];
      while (/^ {4,}\S/.test(lines[i + 1] ?? "")) description += ` ${lines[++i].trim()}`;
      found.push({ flag: match[1], description });
    }
    if (
      found.length === 0 ||
      new Set(found.map((entry) => `${entry.flag}\0${entry.description}`)).size !== 1
    ) {
      throw Error(`Help must describe --${name} exactly once.`);
    }
    const escape = (value) => value.replaceAll("|", "\\|");
    rows.push(`| \`${escape(found[0].flag)}\` | ${escape(found[0].description)} |`);
  }
  return `${START}\n| CLI option | Help description |\n| --- | --- |\n${rows.join("\n")}\n${END}`;
}

export function withCliReference(text) {
  const start = text.indexOf(START),
    end = text.indexOf(END);
  if (
    start < 0 ||
    end < start ||
    start !== text.lastIndexOf(START) ||
    end !== text.lastIndexOf(END)
  )
    throw Error("Keep exactly one ordered CLI reference marker pair.");
  return text.slice(0, start) + cliReference() + text.slice(end + END.length);
}

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--write" && args[0] !== "--check"))
    throw Error("Use node tools/verify/cli-reference.mjs [--check|--write] after building.");
  const path = new URL("../../docs/reference/eval-component.md", import.meta.url),
    text = readFileSync(path, "utf8"),
    expected = withCliReference(text);
  if (args[0] === "--write") writeFileSync(path, expected);
  else if (text !== expected)
    throw Error(
      "CLI reference drift: build, then run node tools/verify/cli-reference.mjs --write.",
    );
  console.log("CLI reference: help/parser declarations match the generated documentation.");
}
