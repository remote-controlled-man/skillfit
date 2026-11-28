import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const toolVersion = "1.14.4";
export const priorPath = ".review/previous.json";
export const fixture = (scenario) => fileURLToPath(new URL(`../tasks/${scenario}/fixture/`, import.meta.url));
export const digest = (data) => createHash("sha256").update(data).digest("hex");

function regularBytes(root, path) {
  let current = root;
  for (const part of path.split("/")) {
    current = join(current, part);
    if (lstatSync(current).isSymbolicLink()) throw new Error(`Unexpected link at ${path}`);
  }
  if (!lstatSync(current).isFile()) throw new Error(`Expected a file at ${path}`);
  return readFileSync(current);
}

export function reviewInputs(root) {
  const paths = ["inventory.mjs"];
  const walk = (folder) => {
    if (!existsSync(join(root, folder))) return;
    if (!lstatSync(join(root, folder)).isDirectory()) throw new Error(`Invalid ${folder} directory`);
    for (const entry of readdirSync(join(root, folder), { withFileTypes: true })) {
      const path = `${folder}/${entry.name}`;
      if (entry.isDirectory()) walk(path);
      else if (path.endsWith(".mjs")) paths.push(path);
    }
  };
  walk("tests");
  return {
    files: paths.sort().map((path) => ({ path, sha256: digest(regularBytes(root, path)) })),
    requirements: regularBytes(root, "requirements.txt"),
    rules: regularBytes(root, "AGENTS.md"),
  };
}

// Only direct OCR commands and the usual Codex shell prefix are recognized.
// Figure out whether the log can support zero before drawing conclusions from it.
const directOcr = /^(?:"[^"\n]*[\\/]ocr(?:\.cmd)?"|'[^'\n]*[\\/]ocr(?:\.cmd)?'|(?:[^\s"']*[\\/])?ocr(?:\.cmd)?)\s+(?:delegate\s+(preview|rule)|(--version))(?=\s|$|['"])/;

function commandEvents(root) {
  if (!existsSync(join(root, "_transcript.jsonl"))) return { error: "Missing command transcript." };
  const incomplete = { error: "Command transcript is incomplete or has an unsupported OCR command." };
  const started = new Map();
  const events = [];
  try {
    const lines = regularBytes(root, "_transcript.jsonl").toString("utf8").trimEnd().split(/\r?\n/);
    const rows = lines.map((line) => JSON.parse(line));
    if (rows[0]?.type !== "thread.started" || rows.at(-1)?.type !== "turn.completed" ||
      rows.filter((row) => row.type === "turn.started").length !== 1 ||
      rows.filter((row) => row.type === "turn.completed").length !== 1 ||
      rows.some((row) => row.type === "turn.failed" || row.type === "error" || typeof row.type !== "string")) return incomplete;
    for (const [index, row] of rows.entries()) {
      const item = row.item;
      if (item?.type !== "command_execution") continue;
      if (typeof item.id !== "string" || typeof item.command !== "string") return incomplete;
      if (row.type === "item.started") {
        if (started.has(item.id)) return incomplete;
        started.set(item.id, item.command);
        continue;
      }
      if (row.type !== "item.completed") continue;
      if (started.get(item.id) !== item.command) return incomplete;
      started.delete(item.id);
      const shell = item.command.replace(/^(?:\S*[\\/])?(?:zsh|bash|sh) -l?c ['"]/, "");
      const match = directOcr.exec(shell);
      const mentions = item.command.match(/\bocr(?:\.cmd)?['"]?\s+(?:delegate\s+(?:preview|rule)|--version)\b/g) ?? [];
      if (mentions.length > 1 || (mentions.length > 0 && !match)) return incomplete;
      if (match) {
        if (typeof item.exit_code !== "number" || typeof item.aggregated_output !== "string") return incomplete;
        events.push({ kind: match[1] ?? "version", ok: item.exit_code === 0 && item.status === "completed", output: item.aggregated_output, line: index + 1 });
      }
    }
    return started.size ? incomplete : { events };
  } catch {
    return incomplete;
  }
}

// A Codex command may print other lines after the structured OCR response.
function jsonOutput(output) {
  const text = output.trim();
  try { return JSON.parse(text); } catch { /* Try a leading pretty-printed object. */ }
  const end = text.search(/^}\s*$/m);
  if (end < 0) return null;
  try { return JSON.parse(text.slice(0, end + 1)); } catch { return null; }
}

function newReviews(events) {
  const rounds = [];
  let preview;
  let unpaired = 0;
  for (const event of events) {
    if (event.kind === "version") continue;
    if (event.kind === "preview") {
      if (preview) unpaired++;
      preview = event.ok ? event : null;
      if (!event.ok) unpaired++;
    } else {
      if (preview && event.ok) {
        const selection = jsonOutput(preview.output), rules = jsonOutput(event.output);
        const files = selection?.schema_version === "1" && selection.mode === "workspace" &&
          Array.isArray(selection.reviewable_files) &&
          selection.reviewable_files.every((file) => typeof file?.path === "string")
          ? selection.reviewable_files : null;
        const rulePaths = rules?.schema_version === "1" && Array.isArray(rules.groups) &&
          rules.groups.every((group) => Array.isArray(group?.files) && group.files.every((file) => typeof file === "string"))
          ? new Set(rules.groups.flatMap((group) => group.files)) : null;
        rounds.push({
          files,
          background: typeof selection?.background === "string" ? selection.background : null,
          rules: rulePaths,
          lines: `${preview.line} and ${event.line}`,
        });
      } else unpaired++;
      preview = null;
    }
  }
  return { rounds, unpaired: unpaired + Number(Boolean(preview)) };
}

function covered(round, inputs) {
  const where = `at transcript lines ${round.lines}`;
  if (!round.files || !round.rules) return { matches: null, detail: `Missing structured preview or rule paths ${where}.` };
  const missing = [], unknown = [];
  for (const { path, sha256 } of inputs.files) {
    const selected = round.files.find((file) => file.path === path);
    if (!selected || !round.rules.has(path)) missing.push(path);
    else if (!/^[a-f0-9]{64}$/.test(selected.sha256)) unknown.push(path);
    else if (selected.sha256 !== sha256) missing.push(path);
  }
  const count = `${inputs.files.length - missing.length - unknown.length}/${inputs.files.length} final files ${where}`;
  if (missing.length) return { matches: false, detail: `${count} (missing or stale: ${missing.join(", ")}).` };
  if (round.files.length !== inputs.files.length || round.rules.size !== inputs.files.length ||
    (round.background !== null && round.background !== inputs.requirements.toString("utf8").trim())) {
    return { matches: false, detail: `${count} (extra paths or different requirements).` };
  }
  if (unknown.length || round.background === null) {
    return { matches: null, detail: `${count} (missing file fingerprints or requirements).` };
  }
  return { matches: true, detail: `${count}.` };
}

const check = (name, pass, detail) => ({ name, status: pass === null ? "unknown" : pass ? "passed" : "failed", detail });

export function verifyReview(root, scenario) {
  const trace = commandEvents(root);
  if (trace.error) return [check("execution", null, trace.error)];
  const observed = newReviews(trace.events);
  const { rounds, unpaired } = observed;
  const reuse = scenario === "reuse-review";
  const expected = reuse ? 0 : 1;
  const checks = [check("execution", rounds.length === expected && unpaired === 0,
    `Expected ${expected} review round${expected === 1 ? "" : "s"}, observed ${rounds.length}. ${unpaired} unpaired or unsuccessful delegate calls.`)];
  if (!reuse && rounds.length === 0) return checks;

  const versions = trace.events.filter((event) => event.kind === "version" && event.ok);
  const observedVersions = new Set(versions.map((event) => event.output.match(/(?:^|\s)v?(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)(?:\s|$)/)?.[1]));
  const actualVersion = observedVersions.size === 1 ? [...observedVersions][0] : undefined;
  checks.push(check("OCR version", actualVersion ? actualVersion === toolVersion : null,
    actualVersion ? `Required ${toolVersion}, observed ${actualVersion} in the command transcript.` : "No unambiguous successful ocr --version result."));
  let inputs, priorBytes;
  try {
    inputs = reviewInputs(root);
    priorBytes = regularBytes(root, priorPath);
  } catch {
    return [...checks, check("final inputs", null, "Final files, requirements, rules or prior receipt could not be read.")];
  }
  const trustedPrior = regularBytes(fixture(scenario), priorPath);
  const previous = JSON.parse(trustedPrior);
  const sameContext = previous.requirementsSha256 === digest(inputs.requirements) &&
    previous.rulesSha256 === digest(inputs.rules);
  checks.push(check("review context", sameContext, sameContext
    ? "Final requirements and project rules match the seeded review inputs."
    : "The requirements or project rules changed."));
  const previousMatches = previous.schemaVersion === 1 && previous.toolVersion === toolVersion &&
    sameContext &&
    JSON.stringify(previous.files) === JSON.stringify(inputs.files);
  const priorValid = priorBytes.equals(trustedPrior) && (reuse ? previousMatches : !previousMatches);
  checks.push(check("prior review", priorValid,
    !priorBytes.equals(trustedPrior) ? "The seeded prior receipt changed." : reuse
      ? previousMatches ? `Prior review matches final files, requirements, rules and the pinned version. ${rounds.length} new rounds.`
        : "Prior review differs from the final files, requirements or rules."
      : previousMatches ? "The scenario expected the prior review to become stale." : "Prior review is stale for the final inputs."));

  const coverage = rounds.map((round) => covered(round, inputs));
  const exactRounds = coverage.filter((result) => result.matches === true).length;
  const unknownRounds = coverage.filter((result) => result.matches === null).length;
  if (rounds.length) {
    const verdict = coverage.some((result) => result.matches === false) ? false : unknownRounds ? null : true;
    checks.push(check("coverage", verdict, coverage.map((result) => result.detail).join(" ")));
  }
  const duplicates = Math.max(0, exactRounds - expected);
  const duplicateVerdict = duplicates > 0 ? false : exactRounds + unknownRounds > expected ? null : true;
  checks.push(check("duplicate reviews", duplicateVerdict, duplicateVerdict === null
    ? "Incomplete coverage records cannot establish whether the final inputs were reviewed more than once."
    : `${duplicates} duplicate rounds for the final inputs.`));
  return checks;
}
