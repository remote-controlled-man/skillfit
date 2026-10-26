import { AsyncLocalStorage } from 'node:async_hooks';
const signals = new AsyncLocalStorage<AbortSignal>();
export function currentSignal(): AbortSignal | undefined { return signals.getStore(); }
export function withCancellation<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> { return signals.run(signal, operation); }
export function throwIfCancelled(): void { currentSignal()?.throwIfAborted(); }
