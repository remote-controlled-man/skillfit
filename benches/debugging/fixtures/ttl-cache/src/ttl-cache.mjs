export class TtlCache {
  constructor(now = Date.now) {
    this.now = now;
    this.entries = new Map();
  }

  set(key, value, ttlMs) {
    this.entries.set(key, {
      value,
      ttlMs,
      expiresAt: this.now() + ttlMs,
    });
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry || !entry.value) return undefined;
    if (entry.expiresAt < this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    entry.expiresAt = this.now() + entry.ttlMs;
    return entry.value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }
}

