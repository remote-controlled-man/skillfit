# Ground truth — chunked-decoder

Fixture layout: `src/frame-decoder.mjs` holds the buggy decoder; `test/basic.test.mjs` holds the two visible tests (they pass even against the buggy code — the real grading is the verifier's behavioral checks).

## Bug list (3, all in `src/frame-decoder.mjs`)

1. **The `\n` separator is searched only in the newest chunk**: `push()` decodes the chunk, concatenates `leftover + text`, but then runs `text.indexOf('\n', offset)` — the index comes from the new chunk while the slice comes from the concatenated buffer, and a header whose digits arrived in an earlier chunk is never completed. The search must run over the whole unparsed buffer.
2. **Multi-byte UTF-8 is decoded per chunk**: `new TextDecoder().decode(chunk)` (non-streaming) replaces any sequence split across two chunks with U+FFFD on both sides. Bytes must be accumulated raw and decoded only once a complete payload is available (or via a single streaming `TextDecoder` with `{ stream: true }`).
3. **No length-prefix validation**: `Number(...)` output is checked only with `!(length >= 0)`, which silently skips NaN and negatives, and absurd values (e.g. `99999999999999999999`) are treated as "wait for more input" forever. A header that is not all digits, or is not a safe integer, must throw `TypeError` with a clear message.

## Verified fixed implementation

```js
const HEADER_PATTERN = /^\d+$/;
const NEWLINE = 0x0a;

export class FrameDecoder {
  constructor() {
    this.buffer = new Uint8Array(0);
    this.frames = [];
    this.flushed = false;
  }

  push(chunk) {
    if (this.flushed) throw new Error('push after flush');
    if (!(chunk instanceof Uint8Array)) throw new TypeError('chunk must be a Uint8Array');
    const merged = new Uint8Array(this.buffer.length + chunk.length);
    merged.set(this.buffer, 0);
    merged.set(chunk, this.buffer.length);
    this.buffer = merged;
    this._parse();
  }

  _parse() {
    for (;;) {
      const newline = this.buffer.indexOf(NEWLINE);
      if (newline === -1) return;
      const header = new TextDecoder().decode(this.buffer.subarray(0, newline));
      if (!HEADER_PATTERN.test(header)) {
        throw new TypeError(`invalid frame length prefix: ${JSON.stringify(header)}`);
      }
      const length = Number(header);
      if (!Number.isSafeInteger(length)) {
        throw new TypeError(`invalid frame length prefix: ${header}`);
      }
      const start = newline + 1;
      if (this.buffer.length < start + length) return;
      this.frames.push(new TextDecoder().decode(this.buffer.subarray(start, start + length)));
      this.buffer = this.buffer.slice(start + length);
    }
  }

  drain() {
    const frames = this.frames;
    this.frames = [];
    return frames;
  }

  flush() {
    this.flushed = true;
    return this.drain();
  }
}
```

(Decoding each complete payload slice is equivalent to one streaming `TextDecoder`; either shape passes, since the wire format never splits a multi-byte sequence across frames.)

Verified 2026-09-25 against the rebalanced verifier: this exact source scores 8/8 (exit 0); the pristine
fixture scores 4/8 (exit 1 — see below).

## What the grader checks

Eight behavioural checks, imported directly from the run directory's `src/frame-decoder.mjs`, pure
computation (no I/O, no timers):

1. Chunk-aligned frames decode, 2. `drain()` empties the backlog — pass on the buggy code.
3. Header split across chunks — bug 1.
4. Whole stream fed one byte at a time — bugs 1+2.
5. Multibyte sequences split across chunks — bug 2. Covers both shapes in one check: a 2-byte sequence
   (`héllo`, split between the two bytes of `é`) and a 3-byte one (`日本語` plus a second frame, split
   inside the sequence). They fail for the same reason and fix together, so scoring them separately
   inflated the facet count without adding a distinction an author would act on.
6. Empty payload frame (`0\n`) — passes on the buggy code.
7. Invalid length prefix throws `TypeError` mentioning "length" — bug 3. One contract, two malformed
   inputs: a prefix that is not all digits (`-3\nabc`) and one that is digits but not a safe integer
   (`99999999999999999999\n…`).
8. `flush()` returns frames not yet drained — passes on the buggy code.

Pristine fixture scores 4/8 (exit 1): checks 3, 4, 5 and 7 fail; checks 1, 2, 6 and 8 pass.

The JSON summary also carries an `evidence.testAssets` collector (informational only, does not affect the score): any test file the agent added is re-run against the final code and against the pristine fixture implementation to show whether it is a real red→green regression test.
