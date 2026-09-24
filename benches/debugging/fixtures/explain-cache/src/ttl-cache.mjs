export class TtlCache {
  constructor(now = Date.now) {
    this.now = now;
    this.entries = new Map();
  }

  set(key, value, ttlMs) {
    if (typeof ttlMs !== 'number' || !Number.isFinite(ttlMs) || ttlMs < 0) {
      throw new TypeError('ttlMs must be a finite non-negative number');
    }
    this.entries.set(key, {
      value,
      ttlMs,
      expiresAt: this.now() + ttlMs,
    });
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }
}
