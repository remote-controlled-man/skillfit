export function parseRange(input, options = {}) {
  const maxItems = options.maxItems ?? 1000;
  return input
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isInteger(value))
    .slice(0, maxItems);
}

