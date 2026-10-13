function isEmptyValue(value) {
  return value === null || value === undefined || value === '';
}

export function compactObject(obj) {
  const result = {};
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (!isEmptyValue(value)) {
      result[key] = value;
    }
  }
  return result;
}

export function countDropped(obj) {
  return Object.keys(obj).length - Object.keys(compactObject(obj)).length;
}
