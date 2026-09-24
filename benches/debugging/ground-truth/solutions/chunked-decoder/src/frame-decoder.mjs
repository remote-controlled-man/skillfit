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
