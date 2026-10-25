import { EvaluationInterrupted } from "../evaluation/execution/interrupted.js";
import { currentSignal, withCancellation } from "../shared/cancellation.js";

// The cancellation belongs to this asynchronous evaluation, including its git,
// verifier and judge work. Imports, previews and unrelated commands install no handlers.


export function evaluationSignal(): AbortSignal | undefined {
  return currentSignal();
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
    return await withCancellation(controller.signal, async () => {
      const result = await operation();
      throwIfEvaluationInterrupted();
      return result;
    });
  } finally {
    process.removeListener('SIGINT', onInt); process.removeListener('SIGTERM', onTerm);
  }
}
