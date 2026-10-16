import { COST_METRICS, summarizeCosts, type CostObservation, type CostPopulation } from './costs.js';
import assert from 'node:assert/strict';
import { record } from './eval-contract.js';

/** Orthogonal to the primary Agent's frozen paired statistical/cost populations. */
export interface InvocationCosts {
  schemaVersion: 1;
  agent: CostPopulation;
  judge: CostPopulation | null;
  total: CostPopulation | null;
  judgeUsage: 'recorded' | 'unknown' | 'not-requested';
}

export function invocationPopulation(rows: readonly CostObservation[]): CostPopulation {
  return summarizeCosts({ baseline: rows, treatment: [] }, { baseline: [], treatment: [] }).attempts.baseline;
}

export function summarizeInvocationCosts(agent: readonly CostObservation[], judge: readonly CostObservation[], requested: boolean): InvocationCosts {
  return { schemaVersion: 1, agent: invocationPopulation(agent), judge: invocationPopulation(judge),
    total: invocationPopulation([...agent, ...judge]), judgeUsage: requested ? 'recorded' : 'not-requested' };
}

/** Historical absence never establishes a free judge or a complete invocation total. */
export function historicalInvocationCosts(agent: CostPopulation, requested: boolean): InvocationCosts {
  return { schemaVersion: 1, agent, judge: requested ? null : invocationPopulation([]),
    total: requested ? null : agent, judgeUsage: requested ? 'unknown' : 'not-requested' };
}

export function parseInvocationCosts(value: unknown): InvocationCosts {
  const r = record(value, 'invocationCosts'); assert.equal(r.schemaVersion, 1, 'Unsupported invocationCosts schema.');
  assert.ok(['recorded', 'unknown', 'not-requested'].includes(String(r.judgeUsage)), 'Invalid judge usage state.');
  const population = (value: unknown, label: string): CostPopulation => {
    const p = record(value, label);
    for (const field of ['runs', 'passes']) assert.ok(Number.isSafeInteger(p[field]) && Number(p[field]) >= 0, `${label}.${field} must be a non-negative safe integer.`);
    assert.ok(Number(p.passes) <= Number(p.runs), `${label} successes exceed invocations.`);
    const metrics = record(p.metrics, `${label}.metrics`);
    for (const metric of COST_METRICS) {
      const m = record(metrics[metric], `${label}.${metric}`), c = record(m.coverage, `${label}.${metric}.coverage`);
      assert.ok(typeof m.knownTotal === 'number' && Number.isFinite(m.knownTotal) && m.knownTotal >= 0 &&
        (metric === 'durationSeconds' || Number.isSafeInteger(m.knownTotal)), `${label}.${metric} has invalid known spending.`);
      for (const status of ['final', 'partial', 'unknown']) assert.ok(Number.isSafeInteger(c[status]) && Number(c[status]) >= 0, `${label}.${metric} has invalid coverage.`);
      assert.equal(Number(c.final) + Number(c.partial) + Number(c.unknown), p.runs, `${label}.${metric} coverage differs from invocations.`);
      if (Number(c.final) + Number(c.partial) === 0) assert.equal(m.knownTotal, 0, `${label}.${metric} unknown spending must not invent a known total.`);
    }
    return p as unknown as CostPopulation;
  };
  const agent = population(r.agent, 'invocationCosts.agent'), judge = r.judge === null ? null : population(r.judge, 'invocationCosts.judge');
  const total = r.total === null ? null : population(r.total, 'invocationCosts.total');
  assert.equal(judge === null, total === null, 'Unknown judge usage must keep its invocation total unknown too.');
  if (r.judgeUsage !== 'unknown') assert.ok(judge && total, 'Recorded judge usage requires cost populations.');
  if (judge && total) {
    for (const field of ['runs', 'passes'] as const) assert.equal(total[field], agent[field] + judge[field], `Invocation ${field} total differs from roles.`);
    for (const metric of COST_METRICS) {
      assert.ok(Math.abs(total.metrics[metric].knownTotal - agent.metrics[metric].knownTotal - judge.metrics[metric].knownTotal) < 1e-6, `Invocation ${metric} total differs from roles.`);
      for (const status of ['final', 'partial', 'unknown'] as const) assert.equal(total.metrics[metric].coverage[status],
        agent.metrics[metric].coverage[status] + judge.metrics[metric].coverage[status], `Invocation ${metric} coverage total differs from roles.`);
    }
  }
  if (r.judgeUsage === 'not-requested') assert.equal(judge!.runs, 0, 'Disabled judge cannot have invocations.');
  return { schemaVersion: 1, agent, judge, total, judgeUsage: r.judgeUsage as InvocationCosts['judgeUsage'] };
}

export function renderInvocationCostLines(costs: InvocationCosts): string[] {
  const lines = ['All executor invocation costs (primary Agent and optional judge):'];
  for (const role of ['agent', 'judge', 'total'] as const) {
    const population = costs[role];
    if (!population) { lines.push(`- ${role}: unknown; historical judge receipts were not recorded.`); continue; }
    lines.push(`- ${role}: ${population.runs} invocations.`);
    for (const metric of COST_METRICS) {
      const m = population.metrics[metric], c = m.coverage;
      lines.push(`  ${metric}: known total ${m.knownTotal}; final/partial/unknown ${c.final}/${c.partial}/${c.unknown}.`);
    }
  }
  lines.push('- Usage and monotonic elapsed intervals only; no exact bill. Judge spending does not alter the primary Agent comparison or adoption policy.');
  return lines;
}
