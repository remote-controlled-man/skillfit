export function createInventory() {
  const active = new Set();
  return {
    reserve(id) {
      if (active.has(id)) return false;
      active.add(id);
      return true;
    },
    cancel(id) {
      return active.delete(id);
    },
  };
}
