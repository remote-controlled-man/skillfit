import { performance } from 'node:perf_hooks';
export const executionClock = {
    wallNow: () => Date.now(),
    monotonicNow: () => performance.now(),
};
/** A timer cannot execute while its host is asleep or its event loop is blocked. */
export class ExecutionDeadline {
    timeoutMs;
    clock;
    heartbeatMs = 1000;
    anomalyThresholdMs = 5000;
    startWall;
    startMono;
    lastWall;
    lastMono;
    elapsedMs = 0;
    wallElapsedMs = 0;
    maxObservationGapMs = 0;
    maxClockSkewMs = 0;
    anomaly = null;
    timeoutFiredAfterMs = null;
    terminatedAtMs = null;
    constructor(timeoutMs, clock = executionClock) {
        this.timeoutMs = timeoutMs;
        this.clock = clock;
        if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) {
            throw new Error('CLI timeoutMs must be an integer between 1 and 2147483647.');
        }
        this.startWall = this.lastWall = clock.wallNow();
        this.startMono = this.lastMono = clock.monotonicNow();
    }
    observe() {
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
    get exceeded() { return this.elapsedMs >= this.timeoutMs; }
    get timingError() { return this.anomaly; }
    markTermination(timeout) {
        this.terminatedAtMs ??= this.elapsedMs;
        if (timeout)
            this.timeoutFiredAfterMs ??= this.elapsedMs;
    }
    snapshot() {
        const round = (value) => Math.round(value * 1000) / 1000;
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
