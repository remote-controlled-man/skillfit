#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import commander from './index.js';
test('legacy event follows asynchronous hooks and action', async () => {const events=[], parent=new commander.Command(); parent.hook('preAction',async()=>{events.push('pre-start');await Promise.resolve();events.push('pre-end');}); parent.command('child').action(async()=>{events.push('action-start');await Promise.resolve();events.push('action-end');}).hook('postAction',()=>events.push('post')); parent.on('command:child',()=>events.push('legacy')); await parent.parseAsync(['child'],{from:'user'}); assert.deepEqual(events,['pre-start','pre-end','action-start','action-end','legacy','post']);});
