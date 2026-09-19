export class FrameDecoder {
  constructor() {
    this.leftover = '';
    this.frames = [];
    this.flushed = false;
  }

  push(chunk) {
    if (this.flushed) throw new Error('push after flush');
    const text = new TextDecoder().decode(chunk);
    const data = this.leftover + text;
    let offset = 0;
    for (;;) {
      const newline = text.indexOf('\n', offset);
      if (newline === -1) break;
      const length = Number(data.slice(offset, newline));
      const start = newline + 1;
      if (!(length >= 0)) {
        offset = start;
        continue;
      }
      if (data.length < start + length) break;
      this.frames.push(data.slice(start, start + length));
      offset = start + length;
    }
    this.leftover = data.slice(offset);
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
