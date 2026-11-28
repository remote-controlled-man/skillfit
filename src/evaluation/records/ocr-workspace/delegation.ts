import { readdirSync } from "node:fs";
import { posix } from "node:path";
import {
  type Archive,
  EVENTS,
  type Fields,
  array,
  canonical,
  isDigest,
  object,
  readJson,
  sha256,
} from "./archive.js";

type Action = "preview" | "rule";
type Phase = "setup" | "model";

interface Call {
  phase: Phase;
  action: Action;
  exitCode: number;
  stdout: string;
  fingerprint: string | null;
  location: string;
}

export interface Round {
  fingerprint: string;
  preview: Fields;
  rule: Fields;
  evidence: string[];
}

export interface Delegation {
  setup: string[];
  model: string[];
  rounds: Round[] | null;
  unpaired: number;
  problem?: string;
}

const TRANSCRIPT = "raw.jsonl";

function fingerprint(value: unknown, project: string | null): string | null {
  const snapshot = object(value);
  if (!snapshot || (project && snapshot.root !== project) || !isDigest(snapshot.fingerprint))
    return null;
  const { root, base, requirements, files, reviewer, rulesIdentity } = snapshot;
  return sha256(canonical({ root, base, requirements, files, reviewer, rulesIdentity })) ===
    snapshot.fingerprint
    ? snapshot.fingerprint
    : null;
}

function readCalls(archive: Archive, project: string | null): Call[] {
  let names: string[];
  try {
    names = readdirSync(archive.path(EVENTS))
      .filter((name) => name.endsWith(".json"))
      .sort();
  } catch {
    throw new Error(`Missing or unreadable ${EVENTS}/`);
  }
  return names.map((name) => {
    const location = `${EVENTS}/${name}`;
    const event = archive.json(location);
    const [domain, action] = array(event?.argv);
    if (
      !event ||
      (event.phase !== "setup" && event.phase !== "model") ||
      domain !== "delegate" ||
      (action !== "preview" && action !== "rule") ||
      typeof event.exitCode !== "number" ||
      !Number.isInteger(event.exitCode) ||
      typeof event.stdout !== "string" ||
      (project && event.cwd !== project) ||
      (event.exitCode === 0 && event.nativeExitCode !== 0)
    )
      throw new Error(`Incomplete OCR delegate event ${location}`);
    const before = fingerprint(event.before, project);
    const after = fingerprint(event.after, project);
    return {
      phase: event.phase,
      action,
      exitCode: event.exitCode,
      stdout: event.stdout,
      fingerprint: before === after ? before : null,
      location,
    };
  });
}

function rawCommands(archive: Archive, project: string | null) {
  const raw = archive.text(TRANSCRIPT);
  if (!raw) throw new Error(`Missing or unreadable ${TRANSCRIPT}`);
  const lines = raw.trimEnd().split("\n").map(readJson);
  if (
    lines[0]?.type !== "thread.started" ||
    lines[1]?.type !== "turn.started" ||
    lines.at(-1)?.type !== "turn.completed" ||
    lines.some(
      (line, index) =>
        !line ||
        (line.type === "turn.completed" && index !== lines.length - 1) ||
        line.type === "turn.failed",
    )
  )
    throw new Error(`Incomplete Codex turn in ${TRANSCRIPT}`);

  // Match the archived wrapper command, never content printed by another tool.
  const wrapper = project ? `${posix.dirname(project)}/bin/ocr` : null;
  const started = new Map<string, string>();
  const result: { action: Action; exitCode: number; stdout: string; location: string }[] = [];
  for (const [i, entry] of lines.entries()) {
    const item = object(entry?.item);
    if (item?.type !== "command_execution") continue;
    const { command, id, exit_code, aggregated_output } = item;
    const location = `${TRANSCRIPT}#L${i + 1}`;
    if (typeof command !== "string" || typeof id !== "string")
      throw new Error(`Incomplete command record at ${location}`);
    if (entry?.type === "item.started") started.set(id, command);
    if (entry?.type !== "item.completed") continue;
    if (started.get(id) !== command)
      throw new Error(`Missing matching command start for ${location}`);
    started.delete(id);
    const action = /(?:^|[\s'"])(?:[^\s'"]*\/)?ocr\s+delegate\s+(preview|rule)(?=[\s'"]|$)/.exec(
      command,
    )?.[1];
    if (action !== "preview" && action !== "rule") continue;
    if (
      (wrapper && !command.includes(wrapper)) ||
      typeof exit_code !== "number" ||
      typeof aggregated_output !== "string"
    )
      throw new Error(`Unverifiable OCR command at ${location}`);
    result.push({ action, exitCode: exit_code, stdout: aggregated_output, location });
  }
  if (started.size) throw new Error(`Unfinished command in ${TRANSCRIPT}`);
  return result;
}

export function readDelegation(archive: Archive, project: string | null): Delegation {
  const result: Delegation = { setup: [], model: [], rounds: null, unpaired: 0 };
  try {
    const calls = readCalls(archive, project);
    result.setup = calls
      .filter((call) => call.phase === "setup" && call.exitCode === 0)
      .map((call) => call.location);
    const model = calls.filter((call) => call.phase === "model");
    result.model = model.map((call) => call.location);
    const commands = rawCommands(archive, project);
    if (commands.length !== model.length)
      throw new Error(`OCR command count differs between ${TRANSCRIPT} and ${EVENTS}/`);
    const rounds: Round[] = [];
    let successful = 0;
    let preview: { fingerprint: string; payload: Fields; evidence: string[] } | undefined;
    for (const [i, call] of model.entries()) {
      const command = commands[i]!;
      const evidence = [command.location, call.location];
      if (
        call.action !== command.action ||
        call.exitCode !== command.exitCode ||
        (call.exitCode === 0 &&
          (!call.stdout.trim() || !command.stdout.includes(call.stdout.trim())))
      )
        throw new Error(`OCR command and event disagree at ${evidence.join(" and ")}`);
      if (call.exitCode !== 0) continue;
      successful++;
      const payload = readJson(call.stdout);
      if (!call.fingerprint || !payload)
        throw new Error(`Missing stable input fingerprint or OCR response in ${call.location}`);
      if (call.action === "preview") {
        preview = { fingerprint: call.fingerprint, payload, evidence };
      } else if (preview?.fingerprint === call.fingerprint) {
        rounds.push({
          fingerprint: call.fingerprint,
          preview: preview.payload,
          rule: payload,
          evidence: [...preview.evidence, ...evidence],
        });
        preview = undefined;
      }
    }
    result.rounds = rounds;
    result.unpaired = successful - 2 * rounds.length;
  } catch (error) {
    result.problem = error instanceof Error ? error.message : "Unavailable OCR execution evidence";
    if (archive.text(TRANSCRIPT) === undefined && !result.problem.includes(TRANSCRIPT))
      result.problem += `; missing or unreadable ${TRANSCRIPT}`;
  }
  return result;
}
