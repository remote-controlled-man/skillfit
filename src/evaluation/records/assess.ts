import { parseEvalReport } from "./manifest.js";
import { assessReport, type EvidenceAudit } from "../measurement/acceptance.js";
import type { AcceptancePolicy } from "../measurement/policy.js";
export { costChanges, type EvidenceAudit, type AcceptanceReason } from "../measurement/acceptance.js";
export function assessEvaluation(value: unknown, audit: EvidenceAudit, override?: AcceptancePolicy) { return assessReport(parseEvalReport(value), value, audit, override); }
