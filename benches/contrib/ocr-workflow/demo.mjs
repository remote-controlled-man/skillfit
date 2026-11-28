import { mkdirSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { runEval } from "../../../dist/cli/eval.js";
import { runEvalReport } from "../../../dist/cli/eval-report.js";
import { fixedTranscript, repairFixture } from "./verifiers/controls.mjs";

if (process.argv.length !== 3) throw new Error("Pass an empty directory outside the source checkout.");
const output = realpathSync(process.argv[2]);
const source = realpathSync(fileURLToPath(new URL("../../../", import.meta.url)));
const location = relative(source, output);
if (!isAbsolute(location) && location !== ".." && !location.startsWith(`..${sep}`)) {
  throw new Error("Use an example directory outside the source checkout.");
}
if (readdirSync(output).length) throw new Error("Use an empty example directory.");
const bench = dirname(fileURLToPath(import.meta.url));
const version = (label) => {
  const dir = join(output, label);
  mkdirSync(dir);
  writeFileSync(join(dir, "SKILL.md"), `---\nname: local-review\ndescription: Local review examples.\n---\nOffline fixture ${label}.\n`);
  return dir;
};
const cases = {
  baseline: ["no-review", "missing", "truncated"],
  treatment: ["fresh", "missed-test", "duplicate"],
};
const executor = {
  describe: () => ({ kind: "mock", model: "fixed Codex command records" }),
  async run(_prompt, workdir) {
    const arm = basename(dirname(workdir));
    const scenario = basename(dirname(dirname(workdir)));
    const trial = Number(basename(workdir).split("-").at(-1));
    const refresh = scenario === "refresh-review";
    if (refresh) repairFixture(workdir);
    const type = refresh ? cases[arm][trial - 1] : "reuse";
    return {
      output: "Tested the reservation behavior.",
      rawOutput: fixedTranscript(workdir, type),
      ...(refresh && !["missing", "truncated"].includes(type) ? { skillTriggered: true } : {}),
    };
  },
};
const options = {
  bench,
  agent: "codex",
  baselineSkillPath: version("skill-old"),
  skillPath: version("skill-new"),
  runsRoot: join(output, "runs"),
  runGroup: "ocr-example",
  mode: "installed",
  executor,
  log: () => {},
  yes: true,
};
const preview = [];
await runEval({ ...options, dryRun: true, trials: 1, maxCalls: 4, log: (line) => preview.push(line) });
writeFileSync(join(output, "dry-run.txt"), preview.join("\n") + "\n", { flag: "wx" });
await runEval({ ...options, dryRun: false, trials: 3, maxCalls: 12 });
await runEvalReport(join(options.runsRoot, options.runGroup), (report) => {
  writeFileSync(join(output, "report.md"), report, { flag: "wx" });
});
