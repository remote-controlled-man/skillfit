import { posix } from "node:path";
import {
  type Archive,
  type Fields,
  GATE,
  type Worktree,
  array,
  canonical,
  isDigest,
  object,
  sha256,
} from "./archive.js";

export const FINAL_POLICY = ".codex/review-policy.json";
export const PRIOR_EVIDENCE = [
  "seed.json",
  "seed.policy.json",
  `${GATE}/prepared.json`,
  `${GATE}/receipt.json`,
];

interface Policy {
  requirements: string;
  reviewer: "ocr";
  binarySha256: string;
  guidance: string[];
}

interface Identity {
  root: string;
  base: string;
  files: unknown[];
  requirements: string;
  reviewer: "ocr";
  rulesIdentity: string;
}

export interface PriorReview {
  originalProject: string | null;
  finalFingerprint: string | null;
  binarySha256: string | null;
  requirements: string | null;
  valid: boolean | null;
  detail: string;
}

function policy(value: Fields | undefined): Policy | undefined {
  if (
    !value ||
    typeof value.requirements !== "string" ||
    value.reviewer !== "ocr" ||
    !isDigest(value.rulesIdentity) ||
    !Array.isArray(value.guidance) ||
    !value.guidance.every((entry): entry is string => typeof entry === "string")
  )
    return;
  return {
    requirements: value.requirements,
    reviewer: value.reviewer,
    binarySha256: value.rulesIdentity,
    guidance: value.guidance,
  };
}

function identity(
  root: string,
  base: string,
  files: unknown[],
  policy: Policy,
  guidance: Record<string, string>,
): Identity {
  return {
    root,
    base,
    files,
    requirements: policy.requirements,
    reviewer: policy.reviewer,
    rulesIdentity: sha256(canonical({ declared: policy.binarySha256, guidance })),
  };
}

function guidanceDigests(rule: Policy, read: (path: string) => string | undefined) {
  return Object.fromEntries(
    rule.guidance.map((path) => {
      const digest = read(path);
      if (!digest) throw new Error(`Missing or inconsistent review guidance ${path}`);
      return [path, digest];
    }),
  );
}

function verifySeed(
  root: string,
  seed: Fields,
  previous: Policy,
  prepared: Fields,
  receipt: Fields,
): { fingerprint: string; rulesIdentity: string } {
  const saved = object(seed.snapshot);
  const guidance = array(prepared.guidance);
  const digests = guidanceDigests(previous, (path) => {
    const entry = guidance.map(object).find((item) => item?.path === path);
    if (typeof entry?.body === "string" && sha256(entry.body) === entry.sha256) return entry.sha256;
  });
  const files = array(saved?.files);
  if (
    !saved ||
    typeof saved.base !== "string" ||
    files.length === 0 ||
    files.some((entry) => {
      const file = object(entry);
      return (
        !file ||
        typeof file.path !== "string" ||
        !["added", "modified", "deleted"].includes(String(file.status)) ||
        (file.status === "deleted" ? file.sha256 !== null : !isDigest(file.sha256))
      );
    })
  )
    throw new Error("Missing original file hashes in seed.json");
  const bound = identity(root, saved.base, files, previous, digests);
  const fingerprint = sha256(canonical(bound));
  const paths = files.map((entry) => object(entry)?.path);
  const reviewed = array(receipt.files).map(object);
  const matches = (record: Fields) =>
    Object.entries(bound).every(([key, value]) => canonical(record[key]) === canonical(value));
  if (
    !matches(saved) ||
    !matches(prepared) ||
    prepared.status !== "prepared" ||
    seed.fingerprint !== fingerprint ||
    saved.fingerprint !== fingerprint ||
    prepared.fingerprint !== fingerprint ||
    receipt.fingerprint !== fingerprint ||
    receipt.status !== "reviewed" ||
    receipt.reviewer !== "ocr" ||
    receipt.preparationSha256 !== sha256(canonical(prepared)) ||
    canonical(seed.receipt) !== canonical(receipt) ||
    typeof receipt.requirementsAssessment !== "string" ||
    !receipt.requirementsAssessment.trim() ||
    canonical([...paths].sort()) !== canonical(reviewed.map((item) => item?.path).sort()) ||
    reviewed.some((item) => typeof item?.assessment !== "string" || !Array.isArray(item.findings))
  )
    throw new Error("seed.json, prepared.json and receipt.json do not bind the same prior review");
  return { fingerprint, rulesIdentity: bound.rulesIdentity };
}

export function priorReview(archive: Archive, final: Worktree | undefined): PriorReview {
  const [seed, previousRaw, prepared, receipt] = PRIOR_EVIDENCE.map((path) => archive.json(path));
  const policyNow = policy(archive.json(FINAL_POLICY));
  const recordedRoot = object(seed?.snapshot)?.root ?? prepared?.root;
  const root =
    typeof recordedRoot === "string" &&
    posix.isAbsolute(recordedRoot) &&
    posix.normalize(recordedRoot) === recordedRoot &&
    posix.basename(recordedRoot) === "project"
      ? recordedRoot
      : null;
  const result: PriorReview = {
    originalProject: root,
    binarySha256: policyNow?.binarySha256 ?? null,
    requirements: policyNow?.requirements ?? null,
    finalFingerprint: null,
    valid: null,
    detail: "",
  };
  try {
    if (!root) throw new Error("Missing original project identity in seed.json and prepared.json");
    if (!policyNow)
      throw new Error(`Missing OCR binary SHA-256, guidance or requirements in ${FINAL_POLICY}`);
    if (!final) throw new Error("Final project/ Git snapshot is unavailable");
    const originalRun = posix.dirname(root);
    const digests = guidanceDigests(policyNow, (path) => {
      if (!path.startsWith(`${originalRun}/.codex/skills/`)) return;
      try {
        return sha256(archive.bytes(path.slice(originalRun.length + 1)));
      } catch {
        return;
      }
    });
    const finalIdentity = identity(root, final.base, final.files, policyNow, digests);
    result.finalFingerprint = sha256(canonical(finalIdentity));
    const missing = PRIOR_EVIDENCE.filter((_, i) => ![seed, previousRaw, prepared, receipt][i]);
    if (missing.length) throw new Error(`Missing or unreadable ${missing.join(", ")}`);
    const previous = policy(previousRaw);
    if (!previous || !seed || !prepared || !receipt)
      throw new Error("Missing OCR binary SHA-256, guidance or requirements in seed.policy.json");
    const saved = verifySeed(root, seed, previous, prepared, receipt);
    result.valid = saved.fingerprint === result.finalFingerprint;
    if (result.valid) {
      result.detail =
        "Prior review matches final files, requirements, rules and recorded OCR binary SHA-256.";
    } else {
      const changed = [
        final.base !== prepared.base && "Git base",
        canonical(final.files) !== canonical(prepared.files) && "final files",
        policyNow.requirements !== previous.requirements && "requirements",
        finalIdentity.rulesIdentity !== saved.rulesIdentity && "rules or OCR binary SHA-256",
      ].filter(Boolean);
      result.detail = `Prior review expired; changed ${changed.join(", ")}.`;
    }
  } catch (error) {
    result.detail = error instanceof Error ? error.message : "Unavailable prior review evidence";
  }
  return result;
}
