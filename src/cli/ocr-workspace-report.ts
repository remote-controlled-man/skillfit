import { pathToFileURL } from "node:url";
import { readOcrWorkspaceReport } from "../evaluation/records/ocr-workspace/index.js";
import { escapeMarkdown, workflowCells } from "./workflow-report.js";

export function runOcrWorkspaceReport(paths: string[], json: boolean): void {
  const report = readOcrWorkspaceReport(paths);
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const link = (label: string, path: string) => {
    const [file, line] = /^(.*)#(L\d+)$/.exec(path)?.slice(1) ?? [path];
    const url = pathToFileURL(file!).href.replaceAll("(", "%28").replaceAll(")", "%29");
    return `[${label}](${url}${line ? `#${line}` : ""})`;
  };
  console.log(
    [
      "# Historical OCR workspace workflow acceptance",
      "",
      "Source: archived Codex and OCR workspace evidence. Model calls: 0.",
      "",
      "| Scenario | Function | Workflow | Checks | Evidence |",
      "| --- | --- | --- | --- | --- |",
      ...report.cases.map((item) => {
        const { functional, status, checks } = workflowCells(item.workflow);
        const evidence = [
          link("function", item.artifacts.functional),
          link("transcript", item.artifacts.transcript),
          link("delegate events", item.artifacts.delegateEvents),
          link("final project", item.artifacts.finalProject),
          link("final policy", item.artifacts.finalPolicy),
          ...item.artifacts.priorReview.map((path) =>
            link(escapeMarkdown(path.split("/").at(-1)!), path),
          ),
          ...item.artifacts.reviews.flatMap((round, i) =>
            round.evidence.map((path, j) =>
              link(
                `round ${i + 1} ${["preview transcript", "preview event", "rule transcript", "rule event"][j]}`,
                path,
              ),
            ),
          ),
        ];
        const setup = item.artifacts.setupCalls
          .map((path, i) => link(`setup ${i + 1}`, path))
          .join(" · ");
        return `| ${escapeMarkdown(item.scenario)} | ${functional} | ${status} | ${checks} | ${evidence.join(" · ")}${setup ? `<br>Setup (separate): ${setup}` : ""} |`;
      }),
      "",
    ].join("\n"),
  );
}
