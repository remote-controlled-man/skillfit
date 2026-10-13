import * as readline from 'node:readline';

/**
 * Ask a yes/no question on the terminal.
 *
 * The `'close'` handler is the reason this exists as a shared helper rather than being inlined at
 * each call site. Without one, the promise never settles when stdin closes without delivering a
 * line, and both observable outcomes are bad: an open-but-silent stdin (a CI pipe) hangs forever,
 * while a closed one lets the event loop drain so the process exits 0 having written nothing — which
 * reads as success. `install` and `bench` each had their own copy of this logic.
 *
 * Closed stdin means "no" on a terminal, where a human pressed Ctrl-D, and an error otherwise, where
 * nothing could ever have answered.
 */
export function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    const finish = (): void => {
      settled = true;
      rl.close();
    };
    rl.question(question, (answer) => {
      if (settled) return;
      finish();
      resolvePromise(/^(y|yes)$/i.test(answer.trim()));
    });
    rl.on('close', () => {
      if (settled) return;
      finish();
      if (process.stdin.isTTY) {
        resolvePromise(false);
        return;
      }
      rejectPromise(
        new Error('No answer on stdin and it is not a terminal — pass --yes to run non-interactively.'),
      );
    });
  });
}
