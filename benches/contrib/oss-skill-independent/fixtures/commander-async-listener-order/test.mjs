import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from './index.js';
test('ordinary public API remains usable', async () => {const Command = api.Command ?? api.default.Command; const program = new Command(); program.option('--value <value>'); program.parse(['--value', 'yes'], {from: 'user'}); assert.equal(program.opts().value, 'yes');});
