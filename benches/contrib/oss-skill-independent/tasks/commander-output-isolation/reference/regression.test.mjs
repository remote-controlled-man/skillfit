#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import commander from './index.js';
test('child output configuration does not mutate parent', () => {const parent = new commander.Command().configureOutput({getOutHelpWidth: () => 80}); const child = parent.createCommand('child').copyInheritedSettings(parent); child.configureOutput({getOutHelpWidth: () => 40}); assert.equal(child.configureOutput().getOutHelpWidth(), 40); assert.equal(parent.configureOutput().getOutHelpWidth(), 80);});
