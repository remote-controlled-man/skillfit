import test from 'node:test';
import assert from 'node:assert/strict';
import pMap,{pMapIterable,pMapSkip} from './index.js';
test('ordinary map and iterable keep input order',async()=>{assert.deepEqual(await pMap([1,2,3],value=>value*2),[2,4,6]);const values=[];for await(const value of pMapIterable([1,2,3],value=>value*2)) values.push(value);assert.deepEqual(values,[2,4,6]);});
test('skip remains distinct from an ordinary value',async()=>{assert.deepEqual(await pMap([0,1,2],value=>value===1?pMapSkip:value),[0,2]);});
