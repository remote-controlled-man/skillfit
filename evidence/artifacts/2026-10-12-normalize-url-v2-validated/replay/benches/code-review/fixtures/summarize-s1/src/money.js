export function roundCents(value) {
  return Math.round(value * 100) / 100;
}

export function formatCents(value) {
  return (value / 100).toFixed(2);
}
