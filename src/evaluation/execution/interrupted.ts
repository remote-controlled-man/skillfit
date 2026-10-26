export class EvaluationInterrupted extends Error {
  readonly receivedAt = new Date().toISOString();
  readonly exitCode: number;

  constructor(readonly signalName: 'SIGINT' | 'SIGTERM') {
    super(`Evaluation interrupted by ${signalName}; no further calls. Retained receipts must not be retried or replaced automatically.`);
    this.name = 'EvaluationInterrupted';
    this.exitCode = signalName === 'SIGINT' ? 130 : 143;
  }
}
