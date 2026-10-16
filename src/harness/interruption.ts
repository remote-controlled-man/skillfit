import { AsyncLocalStorage } from 'node:async_hooks';

export class EvaluationInterrupted extends Error {
  readonly receivedAt = new Date().toISOString();
  readonly exitCode: number;

  constructor(readonly signalName: 'SIGINT' | 'SIGTERM') {
    super(`Evaluation interrupted by ${signalName}; no further calls. Retained receipts must not be retried or replaced automatically.`);
    this.name = 'EvaluationInterrupted';
    this.exitCode = signalName === 'SIGINT' ? 130 : 143;
  }
}

// The cancellation belongs to this asynchronous evaluation, including its git,
// verifier and judge work. Imports, previews and unrelated commands install no handlers.
const evaluations = new AsyncLocalStorage<AbortSignal>();

export function evaluationSignal(): AbortSignal | undefined {
  return evaluations.getStore();
}

export function throwIfEvaluationInterrupted(): void {
  evaluationSignal()?.throwIfAborted();
}

export async function withEvaluationInterrupts<T>(operation: () => Promise<T>): Promise<T> {
  if (evaluationSignal()) return operation();
  const controller = new AbortController();
  const interrupt = (signal: 'SIGINT' | 'SIGTERM'): void => {
    if (controller.signal.aborted) return;
    const reason = new EvaluationInterrupted(signal);
    process.exitCode = reason.exitCode;
    process.stderr.write(`${signal}: stopping evaluation processes and sealing retained records…\n`);
    controller.abort(reason);
  };
  const onInt = () => interrupt('SIGINT'), onTerm = () => interrupt('SIGTERM');
  process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
  try {
    return await evaluations.run(controller.signal, async () => {
      const result = await operation();
      throwIfEvaluationInterrupted();
      return result;
    });
  } finally {
    process.removeListener('SIGINT', onInt); process.removeListener('SIGTERM', onTerm);
  }
}
