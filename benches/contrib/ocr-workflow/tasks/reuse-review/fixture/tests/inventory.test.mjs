import assert from "node:assert/strict";
import { test } from "node:test";
import { createInventory } from "../inventory.mjs";

test("cancel releases the reservation once and allows the same ID again", () => {
  const inventory = createInventory();
  assert.equal(inventory.cancel("a"), false);
  assert.equal(inventory.reserve("a"), true);
  assert.equal(inventory.cancel("a"), true);
  assert.equal(inventory.cancel("a"), false);
  assert.equal(inventory.reserve("a"), true);
});
