import { performance } from 'node:perf_hooks';

export interface ExecutionClock {
  wallNow(): number;
  monotonicNow(): number;
}

export const executionClock: ExecutionClock = {
  wallNow: () => Date.now(),
  monotonicNow: () => performance.now(),
};

export interface ExecutionTiming {
  clock: 'performance.now';
  timeoutMs: number;
  heartbeatMs: number;
  anomalyThresholdMs: number;
  elapsedMs: number;
  wallElapsedMs: number;
  maxObservationGapMs: number;
  maxClockSkewMs: number;
  timeoutFiredAfterMs: number | null;
  terminationDelayMs: number | null;
  anomaly: string | null;
}

/** A timer cannot execute while its host is asleep or its event loop is blocked. */
export class ExecutionDeadline {
  readonly heartbeatMs = 1000;
  readonly anomalyThresholdMs = 5000;
  private readonly startWall: number;
  private readonly startMono: number;
  private lastWall: number;
  private lastMono: number;
  private elapsedMs = 0;
  private wallElapsedMs = 0;
  private maxObservationGapMs = 0;
  private maxClockSkewMs = 0;
  private anomaly: string | null = null;
  private timeoutFiredAfterMs: number | null = null;
  private terminatedAtMs: number | null = null;

  constructor(readonly timeoutMs: number, private readonly clock: ExecutionClock = executionClock) {
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
      throw new Error('CLI timeoutMs must be an integer between 1 and 2147483647.');
    }
    this.startWall = this.lastWall = clock.wallNow();
    this.startMono = this.lastMono = clock.monotonicNow();
  }

  observe(): void {
    const wall = this.clock.wallNow();
    const mono = this.clock.monotonicNow();
    this.elapsedMs = mono - this.startMono;
    this.wallElapsedMs = wall - this.startWall;
    this.maxObservationGapMs = Math.max(this.maxObservationGapMs, wall - this.lastWall, mono - this.lastMono);
    this.maxClockSkewMs = Math.max(this.maxClockSkewMs, Math.abs(this.wallElapsedMs - this.elapsedMs));
    this.lastWall = wall;
    this.lastMono = mono;
    if (this.maxClockSkewMs > this.anomalyThresholdMs) {
      this.anomaly ??= 'Wall/monotonic clock discontinuity; sleep or clock adjustment is possible.';
    }
    if (this.maxObservationGapMs > this.heartbeatMs + this.anomalyThresholdMs) {
      this.anomaly ??= 'Execution observation gap exceeded tolerance; sleep or event-loop delay is possible.';
    }
  }

  get exceeded(): boolean { return this.elapsedMs >= this.timeoutMs; }
  get timingError(): string | null { return this.anomaly; }

  markTermination(timeout: boolean): void {
    this.terminatedAtMs ??= this.elapsedMs;
    if (timeout) this.timeoutFiredAfterMs ??= this.elapsedMs;
  }

  snapshot(): ExecutionTiming {
    const round = (value: number): number => Math.round(value * 1000) / 1000;
    return {
      clock: 'performance.now', timeoutMs: this.timeoutMs, heartbeatMs: this.heartbeatMs,
      anomalyThresholdMs: this.anomalyThresholdMs, elapsedMs: round(this.elapsedMs),
      wallElapsedMs: round(this.wallElapsedMs), maxObservationGapMs: round(this.maxObservationGapMs),
      maxClockSkewMs: round(this.maxClockSkewMs), timeoutFiredAfterMs: this.timeoutFiredAfterMs === null ? null : round(this.timeoutFiredAfterMs),
      terminationDelayMs: this.terminatedAtMs === null ? null : round(this.elapsedMs - this.terminatedAtMs),
      anomaly: this.anomaly,
    };
  }
}
