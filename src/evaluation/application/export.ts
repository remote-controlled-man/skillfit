import { assertEvaluationOutputLayout } from '../targets/output-layout.js';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { loadBench } from "../../bench/read.js";
import { hashFileSet, sha256File } from "../../shared/hash.js";
import { packageFiles, packageMember, portableReproducer, verifyReplayPackage } from "../records/replay-package.js";
import { readEvaluation } from "./read.js";
import { verifyInputSnapshot } from "../records/input-snapshot.js";

function overlaps(root: string, path: string): boolean {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
}

function physical(path: string): string {
  let parent = resolve(path); const parts: string[] = [];
  while (!existsSync(parent)) {
    const next = dirname(parent);
    if (next === parent) return resolve(path); // An original Windows drive can be absent after moving a run.
    parts.unshift(basename(parent)); parent = next;
  }
  return join(realpathSync(parent), ...parts);
}

export async function exportEvaluation(input: string, output: string, options: { yes?: boolean; dryRun?: boolean; benchDir?: string; inputRoots?: string[]; log?: (line: string) => void } = {}) {
  const overrides = new Map<string, string>();
  for (const entry of options.inputRoots ?? []) {
    const at = entry.indexOf('='), label = entry.slice(0, at), path = entry.slice(at + 1);
    if (at < 1 || !path || !['bench', 'target', 'baseline-skill', 'implementation', 'request'].includes(label) || overrides.has(label)) throw new Error(`Invalid or repeated --input-root: ${entry}`);
    overrides.set(label, resolve(path));
  }
  if (options.benchDir && overrides.has('bench')) throw new Error('Use either --bench or --input-root bench=path, not both.');
  const source = resolve(input), run = lstatSync(source).isDirectory() ? source : dirname(source), destination = resolve(output);
  assertEvaluationOutputLayout(destination, { benchDir: run });
  try { lstatSync(destination); throw new Error(`Export destination already exists: ${destination}`); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const planBytes = readFileSync(join(run, '_plan.json'));
  const plan = JSON.parse(planBytes.toString('utf8'));
  const session = JSON.parse(readFileSync(join(run, '_session.json'), 'utf8'));
  const index = JSON.parse(readFileSync(join(run, '_artifacts.json'), 'utf8'));
  const planSha256 = sha256File(join(run, '_plan.json'));
  if (session.planSha256 !== planSha256 || index.planSha256 !== planSha256 || !index.files || !index.links || Object.keys(index.links).length) throw new Error('Native evidence is unsealed, changed, or contains nonportable links.');
  const files = packageFiles(run).filter(path => path !== '_artifacts.json');
  if (JSON.stringify(files) !== JSON.stringify(Object.keys(index.files).sort())) throw new Error('Native evidence inventory changed.');
  for (const path of files) if (sha256File(packageMember(run, path)) !== index.files[path]) throw new Error(`Native evidence hash mismatch: ${path}`);
  const report = await readEvaluation(run);
  const hasManifest = existsSync(join(run, 'manifest.json'));
  const singleArm = plan.details?.mode === 'calibration' || plan.details?.mode === 'trigger';
  if ((hasManifest || singleArm) && (!('evidence' in report) || !report.evidence.verified)) throw new Error(`Native evidence audit failed; cannot export a complete replay package: ${'evidence' in report ? JSON.stringify(report.evidence) : 'missing audit'}`);
  if (!Array.isArray(plan.inputs) || typeof plan.packageVersion !== 'string') throw new Error('Native input fingerprints or version are missing.');
  const pinnedImplementation = plan.inputs.find((entry: { label: string }) => entry.label === 'implementation');
  if (!pinnedImplementation?.files?.includes('harness/interruption.js')) throw new Error('The original pinned runtime lacks replay cancellation support. Keep the native record; exporting must not silently replace its implementation.');
  if (singleArm) {
    for (const path of ['commands/eval-single-arm-replay.js', 'harness/single-arm-audit.js']) {
      if (!pinnedImplementation?.files?.includes(path)) throw new Error('The original pinned runtime lacks single-arm replay support. Keep the native record; exporting must not silently replace its implementation.');
    }
  }
  const snapshot = verifyInputSnapshot(run, plan);
  const copies: { source: string; target: string; sha256: string }[] = [];
  const directories = new Set<string>();
  for (const entry of snapshot?.entries ?? []) if (entry.label !== 'request') {
    directories.add(`run/${entry.path}`);
    for (const dir of entry.directories) directories.add(`run/${entry.path}/${dir}`);
  }
  for (const path of [...files, '_artifacts.json']) copies.push({ source: packageMember(run, path), target: `run/${path}`, sha256: sha256File(join(run, path)) });
  const required = ['bench', 'target', 'implementation'];
  if (plan.details?.baselineTarget) required.push('baseline Skill');
  const roots = [run];
  // Even when copies come from the archive, preserve the existing boundary
  // against writing an export into any original input directory.
  const protectedRoots: string[] = [run];
  for (const label of required) {
    const fingerprint = plan.inputs.find((entry: { label: string }) => entry.label === label);
    if (!fingerprint || !Array.isArray(fingerprint.files) || typeof fingerprint.root !== 'string') throw new Error(`Missing pinned input: ${label}`);
    const alias = label === 'baseline Skill' ? 'baseline-skill' : label;
    protectedRoots.push(fingerprint.root);
    const root = overrides.get(alias) ?? (label === 'bench' && options.benchDir ? resolve(options.benchDir) : snapshot?.roots.get(alias) ?? fingerprint.root);
    roots.push(root);
    protectedRoots.push(root);
    const prefix = label === 'implementation' ? 'runtime/dist' : `inputs/${label === 'baseline Skill' ? 'baseline-skill' : label}`;
    const paths = fingerprint.files as string[];
    // Every path must be safe before it is read; no configuration or global Skill roots are copied.
    for (const path of paths) packageMember(root, path);
    if (hashFileSet(root, paths) !== fingerprint.sha256) throw new Error(`Pinned ${label} input changed or is unavailable; recover the original files before exporting.`);
    const archived = snapshot?.entries.find(entry => entry.label === alias);
    if (archived) {
      directories.add(prefix);
      for (const dir of archived.directories) directories.add(`${prefix}/${dir}`);
    }
    for (const path of paths) copies.push({ source: packageMember(root, path), target: `${prefix}/${path}`, sha256: sha256File(join(root, path)) });
  }
  const request = plan.guardFiles?.find((file: { label: string }) => file.label === 'component request');
  for (const [label] of overrides) if (!(label === 'request' && request) && !required.includes(label === 'baseline-skill' ? 'baseline Skill' : label)) throw new Error(`Input root is not part of this run: ${label}`);
  if (request) {
    const path = overrides.get('request') ?? snapshot?.roots.get('request') ?? request.path;
    if (!lstatSync(path).isFile() || sha256File(path) !== request.sha256) throw new Error('Frozen request changed; recover the original request before exporting.');
    copies.push({ source: path, target: 'inputs/request.json', sha256: request.sha256 });
  }
  if (protectedRoots.some(root => overlaps(physical(root), physical(destination)))) throw new Error('Export destination must be outside the native run and pinned input roots.');
  const log = options.log ?? (() => {});
  const apply = options.yes === true && !options.dryRun;
  const preview = { schemaVersion: 1, kind: 'skillfit.eval-export', status: apply ? 'exported' : 'planned',
    source: run, destination, sourcePlanSha256: planSha256, nativeStatus: session.status, hasManifest,
    files: copies.length + 3, bytes: copies.reduce((sum, file) => sum + lstatSync(file.source).size, 0),
    inputs: roots, inputSource: snapshot ? 'sealed-snapshot' : 'original-or-recovered', modelCalls: 0, sharingReviewRequired: true };
  log(`Portable export: ${run} -> ${destination}`);
  for (const root of roots) log(`  source: ${root}`);
  log(`${preview.files} payload files; ${preview.bytes} source bytes. Review paths, prompts and outputs before sharing.`);
  if (!apply) { log('Plan only — re-run with --yes to export.'); return preview; }
  mkdirSync(dirname(destination), { recursive: true });
  const stage = mkdtempSync(join(dirname(destination), '.skillfit-export-'));
  try {
    for (const dir of directories) mkdirSync(join(stage, dir), { recursive: true });
    for (const file of copies) {
      const bytes = readFileSync(file.source);
      if (sha256File(file.source) !== file.sha256) throw new Error(`Source changed during export: ${file.source}`);
      const target = join(stage, file.target); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes, { flag: 'wx' });
      chmodSync(target, lstatSync(file.source).mode & 0o777);
      if (sha256File(target) !== file.sha256) throw new Error(`Export copy verification failed: ${file.target}`);
    }
    const bench = loadBench(join(stage, 'inputs/bench'));
    if (hasManifest) {
      const manifest = JSON.parse(readFileSync(join(stage, 'run/manifest.json'), 'utf8'));
      if (bench.contentSha256 !== manifest.bench.contentSha256) throw new Error('Exported bench does not match the frozen manifest.');
    }
    writeFileSync(join(stage, 'runtime/package.json'), JSON.stringify({ private: true, type: 'module', version: plan.packageVersion }) + '\n');
    writeFileSync(join(stage, 'reproduce.mjs'), portableReproducer());
    writeFileSync(join(stage, 'README.md'), '# Offline evaluation replay\n\nRun `node reproduce.mjs --verify-only` to check files, or `node reproduce.mjs` to regrade saved deliveries with the pinned implementation. No agent or model is started. Local verifiers are executable code; use trusted packages. Node.js 22+ and any external verifier toolchains are required.\n\nNative receipts are unchanged. Unknown/partial costs stay unknown/partial; a stopped run remains stopped. Checksums detect changes, not publisher identity. Review project data and paths before sharing. Runtime package metadata is reconstructed from the frozen native package version; compiled implementation bytes are copied unchanged.\n');
    const payload = packageFiles(stage);
    writeFileSync(join(stage, 'replay-package.json'), JSON.stringify({ schemaVersion: 1, kind: 'skillfit.replay-package',
      sourcePlanSha256: planSha256, hasManifest, nativeStatus: session.status, evaluationType: singleArm ? plan.details.mode : 'paired',
      files: Object.fromEntries(payload.map(path => [path, sha256File(join(stage, path))])) }, null, 2) + '\n');
    verifyReplayPackage(stage);
    // Exclusive mkdir protects even empty directories and dangling symlinks that
    // appeared after preview. Transfer only into the directory this call owns.
    mkdirSync(destination);
    for (const file of readdirSync(stage).filter(file => file !== 'replay-package.json')) renameSync(join(stage, file), join(destination, file));
    renameSync(join(stage, 'replay-package.json'), join(destination, 'replay-package.json'));
    verifyReplayPackage(destination);
    rmSync(stage, { recursive: true, force: true });
  } catch (error) { rmSync(stage, { recursive: true, force: true }); throw error; }
  log(`Exported and verified. Replay: node ${join(destination, 'reproduce.mjs')}`);
  return preview;
}
