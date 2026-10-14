/** Retain public output/usage from a failed invocation; guards can refuse before invoking. */
export class ExecutorFailure extends Error {
    result;
    executorInvoked;
    constructor(message, result = { output: '' }, executorInvoked = true) {
        super(message);
        this.result = result;
        this.executorInvoked = executorInvoked;
        this.name = 'ExecutorFailure';
    }
}
export const CONDITIONS = ['baseline', 'treatment'];
