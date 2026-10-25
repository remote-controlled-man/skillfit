
export function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

export function keys(value: Record<string, unknown>, allowed: string[], label: string): void {
  const unknown = Object.keys(value).filter(k => !allowed.includes(k));
  if (unknown.length) throw new Error(`${label} has unknown fields: ${unknown.join(', ')}.`);
}

export function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0')) throw new Error(`${label} must be a non-empty string.`);
  return value;
}

export function numeric(value: unknown, label: string, min: number, max = Number.MAX_SAFE_INTEGER, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isSafeInteger(value))) {
    throw new Error(`${label} must be ${integer ? 'an integer' : 'a finite number'} between ${min} and ${max}.`);
  }
  return value;
}
