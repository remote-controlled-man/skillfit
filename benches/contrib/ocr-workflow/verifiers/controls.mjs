// Fixed event shapes for offline tests and the example. No delegate command is dispatched.
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fixture, reviewInputs, toolVersion } from "./review.mjs";

export function repairFixture(root) {
  const repaired = fixture("reuse-review");
  mkdirSync(join(root, "tests"), { recursive: true });
  for (const path of ["inventory.mjs", "tests/inventory.test.mjs"])
    copyFileSync(join(repaired, path), join(root, path));
}

export function fixedTranscript(root, type) {
  if (type === "missing") return undefined;
  const input = reviewInputs(root);
  const trace = [{ type: "thread.started", thread_id: "offline-control" }, { type: "turn.started" }];
  let number = 0;
  const command = (command, output) => {
    const item = { id: `item_${++number}`, type: "command_execution", command };
    trace.push({ type: "item.started", item: { ...item, status: "in_progress" } });
    trace.push({ type: "item.completed", item: { ...item, status: "completed", exit_code: 0, aggregated_output: output } });
  };
  command("ocr --version", `OpenCodeReview ${toolVersion}`);
  const files = type === "missed-test" ? input.files.filter(({ path }) => !path.startsWith("tests/"))
    : type === "missing-digests" ? input.files.map(({ path }) => ({ path })) : input.files;
  const rounds = type === "duplicate" ? 2 : ["fresh", "missed-test", "missing-digests"].includes(type) ? 1 : 0;
  for (let i = 0; i < rounds; i++) {
    command("ocr delegate preview --format json --background-file requirements.txt", JSON.stringify({
      schema_version: "1", mode: "workspace", background: input.requirements.toString("utf8").trim(),
      reviewable_files: files,
    }, null, 2));
    command(`ocr delegate rule --format json ${files.map(({ path }) => path).join(" ")}`, JSON.stringify({
      schema_version: "1", groups: [{ files: files.map(({ path }) => path) }],
    }, null, 2));
  }
  if (type === "no-review") trace.push({ type: "item.completed", item: { id: "assistant", type: "agent_message", text: "The OCR review is complete." } });
  if (type !== "truncated") trace.push({ type: "turn.completed" });
  return trace.map((row) => JSON.stringify(row)).join("\n") + "\n";
}
