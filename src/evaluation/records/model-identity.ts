import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { assertModelIdentity, modelIdentities, type ModelCall, type ModelIdentity } from "../../agents/observation/model-identity.js";
import { packageMember } from "./replay-package.js";
import { readComponentJson } from '../../shared/read-json.js';
import { record } from '../../shared/json.js';

/** Stopped/invalid native evidence still exposes valid identities; lost claims stay unknown. */
export function retainedModelIdentities(root: string) {
  try { return collectModelIdentities(root); }
  catch { return undefined; } // A broken ledger cannot establish complete model coverage.
}

function collectModelIdentities(root: string) {
  if (!existsSync(join(root, '_plan.json')) || !existsSync(join(root, '_calls.jsonl'))) return undefined;
  const plan = record(readComponentJson(packageMember(root, '_plan.json')).value, 'native plan');
  if (plan.modelIdentityProtocol !== 1) return undefined; // Never reinterpret historical transcripts.
  const details = record(plan.details, 'native details');
  const primary: ModelCall[] = [], judge: ModelCall[] = [];
  const judgeByPrompt = new Map<string, { path: string; receipt: Record<string, unknown> }>();
  for (const task of readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory() && !e.name.startsWith('_') && e.name !== '.git')) {
    const dir = join(root, task.name);
    for (const trial of readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory() && /^judge-trial-[1-9][0-9]*$/.test(e.name))) {
      for (const name of ['call-1.json', 'call-2.json']) {
        const path = `${task.name}/${trial.name}/${name}`;
        try {
          const receipt = record(readComponentJson(packageMember(root, path)).value, 'judge receipt');
          if (typeof receipt.promptSha256 === 'string') judgeByPrompt.set(receipt.promptSha256, { path, receipt });
        } catch { /* The ledger preserves the unknown dispatch below. */ }
      }
    }
  }
  for (const line of readFileSync(packageMember(root, '_calls.jsonl'), 'utf8').split('\n').filter(Boolean)) {
    const event = record(JSON.parse(line), 'call ledger');
    if (event.event !== 'started' || !['agent', 'judge'].includes(String(event.role))) continue;
    let identity: ModelIdentity | null = null;
    if (event.role === 'agent') {
      const path = String(event.workdir).split(/[\\/]/).slice(-3).join('/') + '/_result.json';
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\/(baseline|treatment|installed)\/trial-[1-9][0-9]*\/_result.json$/.test(path)) throw new Error('Invalid model identity workspace.');
      try {
        const receipt = record(readComponentJson(packageMember(root, path)).value, 'receipt');
        if (receipt.executorInvoked === false) continue;
        const transcript = path.replace('/_result.json', '/_transcript.jsonl');
        const raw = existsSync(join(root, transcript)) ? readFileSync(packageMember(root, transcript), 'utf8') : undefined;
        const configured = record(plan.configuredSettings ?? {}, 'settings').model;
        assertModelIdentity(receipt.modelIdentity, raw, details.executor, typeof configured === 'string' ? configured : null);
        identity = receipt.modelIdentity as ModelIdentity ?? null;
      } catch { /* Invalid identity evidence must not become a positive model observation. */ }
      primary.push({ receipt: path, identity });
    } else {
      const retained = judgeByPrompt.get(String(event.promptSha256));
      if (retained) try {
        const r = retained.receipt;
        if (r.executorInvoked === false) continue;
        assertModelIdentity(r.modelIdentity, typeof r.rawOutput === 'string' ? r.rawOutput : undefined, r.executor);
        identity = r.modelIdentity as ModelIdentity ?? null;
      } catch { /* Preserve the dispatch as unknown. */ }
      judge.push({ receipt: retained?.path ?? `missing-judge-${judge.length + 1}.json`, identity });
    }
  }
  return modelIdentities(primary, details.mode === 'trigger' || details.mode === 'calibration' ? null : judge);
}
