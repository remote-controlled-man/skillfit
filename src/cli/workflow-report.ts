import { type WorkflowSummary, workflowStatus } from "../bench/gates/summary.js";

export function escapeMarkdown(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "\\`")
    .replaceAll("*", "\\*")
    .replaceAll("_", "\\_")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ")
    .replaceAll("\r", " ");
}

export function workflowCells(workflow: WorkflowSummary) {
  const labels = { passed: "Passed", failed: "Failed", unknown: "Unknown" };
  return {
    functional: labels[workflow.functional],
    status: labels[workflowStatus(workflow)],
    checks: workflow.checks
      .map(
        (check) =>
          `**${escapeMarkdown(check.name)} (${labels[check.status]})** ${escapeMarkdown(check.detail)}`,
      )
      .join("<br>"),
  };
}
