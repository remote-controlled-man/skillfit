import assert from "node:assert/strict";
import { lstatSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.argv[2];
const implementation = resolve(root, "inventory.mjs");
assert.ok(lstatSync(implementation).isFile());
const { createInventory } = await import(pathToFileURL(implementation).href);
const inventory = createInventory();
assert.equal(inventory.cancel("before-reservation"), false);
assert.equal(inventory.reserve("a"), true);
assert.equal(inventory.reserve("b"), true);
assert.equal(inventory.reserve("a"), false);
assert.equal(inventory.cancel("a"), true);
assert.equal(inventory.cancel("a"), false);
assert.equal(inventory.reserve("a"), true);
assert.equal(inventory.reserve("b"), false);
