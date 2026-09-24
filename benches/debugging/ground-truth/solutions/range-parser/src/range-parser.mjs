const SEGMENT_PATTERN = /^-?\d+$/;
const RANGE_PATTERN = /^(-?\d+)-(-?\d+)$/;

export function parseRange(input, options = {}) {
  if (typeof input !== 'string') {
    throw new TypeError('input must be a string');
  }
  const maxItems = options.maxItems ?? 1000;
  const values = new Set();
  for (const rawSegment of input.split(',')) {
    const segment = rawSegment.trim();
    const rangeMatch = RANGE_PATTERN.exec(segment);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      const step = start <= end ? 1 : -1;
      for (let value = start; ; value += step) {
        values.add(value);
        if (values.size > maxItems) {
          throw new RangeError(`range expands beyond maxItems (${maxItems})`);
        }
        if (value === end) break;
      }
    } else if (SEGMENT_PATTERN.test(segment)) {
      values.add(Number(segment));
      if (values.size > maxItems) {
        throw new RangeError(`input yields more than maxItems (${maxItems})`);
      }
    } else {
      throw new TypeError(`invalid segment: ${JSON.stringify(segment)}`);
    }
  }
  return [...values].sort((left, right) => left - right);
}
