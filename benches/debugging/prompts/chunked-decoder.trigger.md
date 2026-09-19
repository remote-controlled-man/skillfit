# Task: diagnose and fix the streaming frame decoder

The repository in your current working directory contains `src/frame-decoder.mjs`. Users report three intermittent problems:

- a frame whose `\n` header separator is split across two chunks parses into garbage;
- multi-byte UTF-8 characters split across chunk boundaries come out mangled;
- a negative or absurd length prefix is accepted silently instead of rejected.

Wire format: `<byteLength>\n<payload bytes>` — the decimal byte count of the payload, a newline, then exactly that many payload bytes (UTF-8 text). Frames may be split across arbitrary chunk boundaries. `push(chunk: Uint8Array)` feeds bytes; `drain()` returns the frames decoded so far and empties the backlog; `flush()` signals end of input and returns any remaining frames. A length prefix that is not a non-negative safe integer must throw `TypeError` with a clear message.

Find the causes and fix them without changing the public class API.

Run the visible tests with `node --test test/*.test.mjs`. After you finish, a hidden grading suite runs additional behavioral checks against this code.
