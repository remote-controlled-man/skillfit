import { basename, dirname, join, resolve } from "node:path";
import {
  type CheckStatus,
  type WorkflowSummary,
  parseVerifierSummary,
  workflowStatus,
} from "../../../bench/gates/summary.js";
import {
  Archive,
  EVENTS,
  type FileEvidence,
  type Worktree,
  array,
  isDigest,
  object,
  sha256,
  snapshot,
} from "./archive.js";
import { type Round, readDelegation } from "./delegation.js";
import { FINAL_POLICY, PRIOR_EVIDENCE, priorReview } from "./prior-review.js";

type Check = WorkflowSummary["checks"][number];

function coverage(
  rounds: Round[],
  files: FileEvidence[],
  requirements: string | null,
): { coveredPaths: string[]; check: Check } {
  const name = "coverage";
  const coveredPaths: string[] = [];
  const hashesMissing = new Set<string>();
  const pathsMissing = new Set<string>();
  const mismatches = new Set<string>();
  const textMissing = new Set<string>();
  const textMismatches = new Set<string>();
  const filesMatch = (candidate: unknown, file: FileEvidence) => {
    const observed = object(candidate);
    if (
      !observed ||
      !Object.hasOwn(observed, "sha256") ||
      (!isDigest(observed.sha256) && !(file.status === "deleted" && observed.sha256 === null))
    ) {
      hashesMissing.add(file.path);
      return false;
    }
    if (observed.sha256 !== file.sha256) {
      mismatches.add(file.path);
      return false;
    }
    return true;
  };
  const contentMatches = (input: Record<string, unknown>, file: FileEvidence) => {
    const { content, contentStatus } = input;
    if (file.status === "deleted") {
      if (content === null || content === undefined) return true;
    } else if (contentStatus !== "text" || typeof content !== "string") {
      textMissing.add(file.path);
      return false;
    } else if (sha256(content) === file.sha256) {
      return true;
    }
    textMismatches.add(file.path);
    return false;
  };
  const matchesEveryRound = new Set(files.map((file) => file.path));
  for (const round of rounds) {
    const collected = object(round.preview.workspace_collection);
    if (collected?.fingerprint !== round.fingerprint || collected.requirements !== requirements)
      return {
        coveredPaths,
        check: {
          name,
          status: "unknown",
          detail: "Preview does not bind the recorded final input and requirements.",
        },
      };
    if (
      !Array.isArray(round.preview.reviewable_files) ||
      !Array.isArray(collected.inputs) ||
      !Array.isArray(round.rule.groups)
    )
      return {
        coveredPaths,
        check: {
          name,
          status: "unknown",
          detail: "Missing OCR preview file list, workspace inputs or rule groups.",
        },
      };
    const previewed = array(round.preview.reviewable_files).map(object);
    const inputs = array(collected.inputs).map(object);
    const rulePaths = new Set(
      array(round.rule.groups).flatMap((group) => array(object(group)?.files)),
    );
    for (const file of files) {
      const selection = previewed.find((entry) => entry?.path === file.path);
      const input = inputs.find((entry) => entry?.path === file.path);
      if (!selection || !input || !rulePaths.has(file.path)) {
        pathsMissing.add(file.path);
        matchesEveryRound.delete(file.path);
        continue;
      }
      const selectionMatches = filesMatch(selection, file);
      const inputMatches = filesMatch(input, file);
      const textMatches = contentMatches(input, file);
      if (!selectionMatches || !inputMatches || !textMatches) matchesEveryRound.delete(file.path);
    }
  }
  coveredPaths.push(...matchesEveryRound);
  const detail = [
    `${coveredPaths.length}/${files.length} final files match preview evidence and rule coverage.`,
    pathsMissing.size && `Missing review coverage for ${[...pathsMissing].join(", ")}.`,
    mismatches.size && `Wrong final SHA-256 for ${[...mismatches].join(", ")}.`,
    textMismatches.size &&
      `Preview text SHA-256 does not match final file state for ${[...textMismatches].join(", ")}.`,
    hashesMissing.size && `Missing preview SHA-256 for ${[...hashesMissing].join(", ")}.`,
    textMissing.size && `Missing complete preview text for ${[...textMissing].join(", ")}.`,
  ]
    .filter(Boolean)
    .join(" ");
  if (pathsMissing.size || mismatches.size || textMismatches.size)
    return { coveredPaths, check: { name, status: "failed", detail } };
  if (hashesMissing.size || textMissing.size)
    return { coveredPaths, check: { name, status: "unknown", detail } };
  return { coveredPaths, check: { name, status: "passed", detail } };
}

function inspect(path: string) {
  const archive = new Archive(resolve(path));
  let worktree: Worktree | undefined;
  let workspaceProblem: string | undefined;
  try {
    worktree = snapshot(archive);
  } catch (error) {
    workspaceProblem =
      (error as NodeJS.ErrnoException).code === "ENOENT"
        ? "Missing project/ or its Git metadata."
        : "Cannot reconstruct final file SHA-256 from project/ and its Git metadata.";
  }
  const binding = priorReview(archive, worktree);
  const calls = readDelegation(archive, binding.originalProject);
  const actual = calls.rounds?.length ?? null;
  const required = worktree?.required;
  const expected =
    binding.valid === true
      ? 0
      : binding.valid === false && required != null
        ? Number(required)
        : null;
  const roundsOnFinal =
    calls.rounds?.filter((round) => round.fingerprint === binding.finalFingerprint) ?? [];
  const duplicateRounds =
    actual === null || !binding.finalFingerprint
      ? null
      : roundsOnFinal.length === 0
        ? 0
        : binding.valid === null
          ? null
          : Math.max(0, roundsOnFinal.length - (binding.valid ? 0 : 1));
  const executionNote =
    actual !== null && expected !== null
      ? `Expected ${expected}, observed ${actual} new round(s).${actual < expected ? " Required review was missed." : ""}${calls.unpaired ? ` ${calls.unpaired} successful call(s) did not form a round.` : ""}`
      : "";
  const absent = calls.problem ?? "Missing complete delegate command records.";
  const execution: Check = {
    name: "execution",
    status:
      actual === null || expected === null
        ? "unknown"
        : actual === expected && calls.unpaired === 0
          ? "passed"
          : "failed",
    detail:
      actual === null
        ? absent
        : expected === null
          ? `Observed ${actual} new round(s). Expected count is unknown. ${binding.valid === null ? binding.detail : "No decisive semantic change in the recorded final scope."}`
          : executionNote,
  };
  let reviewed: ReturnType<typeof coverage>;
  if (worktree && roundsOnFinal.length)
    reviewed = coverage(roundsOnFinal, worktree.files, binding.requirements);
  else if (actual === 0 && binding.valid === true)
    reviewed = {
      coveredPaths: worktree?.files.map((file) => file.path) ?? [],
      check: {
        name: "coverage",
        status: "passed",
        detail: "Valid prior review covers the final files.",
      },
    };
  else {
    const known = actual !== null && !!binding.finalFingerprint;
    const status: CheckStatus =
      known && expected !== null
        ? expected === 0 && actual === 0
          ? "passed"
          : "failed"
        : "unknown";
    reviewed = {
      coveredPaths: [],
      check: {
        name: "coverage",
        status,
        detail: !known
          ? (workspaceProblem ?? (actual === null ? absent : binding.detail))
          : actual === 0 && expected === 0
            ? "No final review required."
            : "No completed review covers the final input.",
      },
    };
  }
  const functional = parseVerifierSummary(archive.text("verifier.txt") ?? "")?.passed;
  const workflow: WorkflowSummary = {
    functional: functional == null ? "unknown" : functional ? "passed" : "failed",
    checks: [
      {
        name: "prior review",
        status: binding.valid === null ? "unknown" : "passed",
        detail: binding.detail,
      },
      execution,
      reviewed.check,
      {
        name: "duplicate review",
        status: duplicateRounds === null ? "unknown" : duplicateRounds > 0 ? "failed" : "passed",
        detail:
          duplicateRounds === null
            ? (calls.problem ?? binding.detail)
            : `${duplicateRounds} duplicate round(s) on final inputs.`,
      },
    ],
  };
  const artifacts = {
    functional: join(archive.root, "verifier.txt"),
    transcript: join(archive.root, "raw.jsonl"),
    delegateEvents: join(archive.root, EVENTS),
    finalProject: join(archive.root, "project"),
    finalPolicy: join(archive.root, FINAL_POLICY),
    priorReview: PRIOR_EVIDENCE.map((file) => join(archive.root, file)),
    setupCalls: calls.setup.map((file) => join(archive.root, file)),
    modelDelegateCalls: calls.model.map((file) => join(archive.root, file)),
    reviews:
      calls.rounds?.map((round) => ({
        fingerprint: round.fingerprint,
        evidence: round.evidence.map((file) => join(archive.root, file)),
      })) ?? [],
  };
  const parent = dirname(archive.root);
  return {
    scenario:
      basename(parent) === "runs"
        ? `${basename(dirname(parent))} / ${basename(archive.root)}`
        : basename(archive.root),
    archive: archive.root,
    originalProject: binding.originalProject,
    binarySha256: binding.binarySha256,
    finalFingerprint: binding.finalFingerprint,
    priorReviewValid: binding.valid,
    expectedRounds: expected,
    observedRounds: actual,
    duplicateRounds,
    finalFiles: worktree?.files ?? null,
    coveredPaths: reviewed.coveredPaths,
    status: workflowStatus(workflow),
    workflow,
    artifacts,
  };
}

export function readOcrWorkspaceReport(archives: string[]) {
  return {
    kind: "skillfit.ocr-workspace-report",
    schemaVersion: 1,
    source: "historical-ocr-workspace",
    modelCalls: 0,
    cases: archives.map(inspect),
  };
}
