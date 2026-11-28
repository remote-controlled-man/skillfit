import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fixedTranscript, repairFixture } from "./controls.mjs";

const [scenario, root] = process.argv.slice(2);
if (scenario === "refresh-review") repairFixture(root);
writeFileSync(join(root, "_output.md"), "Reference delivery.\n");
writeFileSync(join(root, "_transcript.jsonl"), fixedTranscript(root, scenario === "refresh-review" ? "fresh" : "reuse"));
