import test from 'node:test';
import * as api from './index.js';
import assert from 'node:assert/strict';
const turns=async()=>{for(let i=0;i<24;i++) await new Promise(setImmediate);};
const deferred=()=>Promise.withResolvers();
const collect=async iterable=>{const values=[];for await(const value of iterable) values.push(value);return values;};
const observe=promise=>{const state={settled:false};promise.then(value=>Object.assign(state,{settled:true,value}),error=>Object.assign(state,{settled:true,error}));return state;};
async function indexed(api, order, options={}) {
  const waits=order.map(deferred);
  const state=observe(collect(api.pMapIterable(waits.map(row=>row.promise),(value,index)=>[value,index],{concurrency:order.length,...options})));
  await turns();
  for(const index of order) {waits[index].resolve(String(index));await turns();}
  assert.ok(state.settled && !state.error,'mapping did not complete');return state.value;
}
async function concurrency(api, limit, backpressure) {
  const waits=Array.from({length:5},deferred);let active=0,peak=0;
  async function* source(){for(let i=0;i<5;i++) yield i;}
  const state=observe(collect(api.pMapIterable(source(),async value=>{active++;peak=Math.max(peak,active);await waits[value].promise;active--;return value;},{concurrency:limit,backpressure})));
  await turns();const initialPeak=peak;for(const wait of waits) {wait.resolve();await turns();}
  assert.ok(state.settled && !state.error);assert.deepEqual(state.value,[0,1,2,3,4]);assert.ok(initialPeak<=limit && peak<=limit,`peak ${peak} exceeds ${limit}`);
}
async function consumerStop(api, mode) {
  const gate=deferred();let pulls=0,mapped=0;
  const source={[Symbol.iterator](){return{next(){const value=pulls++;return{value,done:value>=12};}};}};
  const mapper=async value=>{mapped++;if(value===0) return value;await gate.promise;return api.pMapSkip;};
  const output=api.pMapIterable(source,mapper,{concurrency:3,backpressure:6});
  if(mode==='return') {const iterator=output[Symbol.asyncIterator]();assert.deepEqual(await iterator.next(),{done:false,value:0});await iterator.return();}
  else {try {for await(const value of output) {assert.equal(value,0);if(mode==='throw') throw new Error('consumer stopped');break;}} catch(error){assert.equal(error.message,'consumer stopped');}}
  const stoppedPulls=pulls,stoppedMapped=mapped;gate.resolve();await turns();
  assert.equal(pulls,stoppedPulls,'new source pull after consumer stopped');assert.equal(mapped,stoppedMapped,'new mapper after consumer stopped');
}
function infiniteSource({returnError}={}) {
  let index=0;const state={returns:0,pulls:0};
  state.source={[Symbol.asyncIterator](){return{async next(){state.pulls++;return{done:false,value:index++};},async return(){state.returns++;if(returnError) throw returnError;return{done:true};}};}};return state;
}
async function sourceRejection(api, options={}) {
  const failure=new Error('original mapper failure'), state=infiniteSource(options);
  const observed=observe(api.default(state.source,async()=>{throw failure;},{concurrency:1}));await turns();
  assert.ok(observed.settled);assert.equal(observed.error,failure);assert.equal(state.returns,1);
}
async function sourceError(api, asyncInput=false) {
  const error=new Error('source failed'), waits=Array.from({length:3},deferred);let index=0;const mapped=[];
  const iterator={next(){const value=index++;if(value===3) throw error;return{value,done:value>=6};}};
  const source=asyncInput?{[Symbol.asyncIterator](){return{async next(){return iterator.next();}};}}:{[Symbol.iterator](){return iterator;}};
  const result=observe(api.default(source,async value=>{mapped.push(value);await waits[value]?.promise;return value;},{concurrency:2,stopOnError:false}));
  await turns();waits[0].resolve();await turns();waits[1].resolve();await turns();
  const stoppedIndex=index;for(const wait of waits) wait.resolve();await turns();
  assert.ok(result.settled);assert.equal(result.error,error);assert.equal(stoppedIndex,4);assert.equal(index,4);assert.deepEqual(mapped,[0,1,2]);
}
function coldSource(error) {
  let value=0,done=false;const state={nextCalls:0,thenCalls:0,afterDone:0};
  state.source={[Symbol.asyncIterator](){return{next(){state.nextCalls++;if(done) state.afterDone++;return{then(resolve,reject){state.thenCalls++;if(value<3){resolve({done:false,value:++value});return;}done=true;if(error)reject(error);else resolve({done:true,value:undefined});}};}};}};return state;
}
async function coldMap(api,kind,options={}) {
  const state=coldSource();let result;
  if(kind==='default') result=await api.default(state.source,value=>value,{concurrency:1,...options});
  else if(kind==='settled') result=(await api.pMapSettled(state.source,value=>value,{concurrency:1,...options})).map(row=>row.value);
  else result=await collect(api.pMapIterable(state.source,value=>value,{concurrency:1,...options}));
  assert.deepEqual(kind==='unordered'?[...result].sort():result,[1,2,3]);assert.equal(state.thenCalls,state.nextCalls);if(options.concurrency===undefined){assert.equal(state.nextCalls,4);assert.equal(state.afterDone,0);}
}
function clock(fn) {const real=Date.now;let now=10000;Date.now=()=>now;try{return fn(value=>{now=value;});}finally{Date.now=real;}}

export function casesFor(api,task) {
  if(task==='mapper-index') return [
    ['out-of-order values retain input-position mapper indices',async()=>assert.deepEqual(await indexed(api,[2,0,1]),[['0',0],['1',1],['2',2]])],
    ['reverse promise settlement does not change output order or index',async()=>assert.deepEqual(await indexed(api,[3,2,1,0]),[['0',0],['1',1],['2',2],['3',3]])],
    ['indexing also works with bounded concurrency',async()=>assert.deepEqual(await indexed(api,[1,0],{concurrency:1}),[['0',0],['1',1]])],
    ['ordinary synchronous input keeps mapper index and skip semantics',async()=>assert.deepEqual(await collect(api.pMapIterable(['a','b','c'],(value,index)=>index===1?api.pMapSkip:[value,index])),[['a',0],['c',2]])],
  ];
  if(task==='async-concurrency') return [
    ['async source cannot exceed one active mapper with larger backpressure',()=>concurrency(api,1,3)],
    ['async source respects a concurrency limit of two',()=>concurrency(api,2,5)],
    ['equal backpressure and concurrency remain supported',()=>concurrency(api,2,2)],
    ['empty async source completes without invoking a mapper',async()=>{let calls=0;async function* empty(){}assert.deepEqual(await collect(api.pMapIterable(empty(),()=>{calls++;})),[]);assert.equal(calls,0);}],
  ];
  if(task==='consumer-stop') return [
    ['explicit return prevents new pulls after pending skips settle',()=>consumerStop(api,'return')],
    ['breaking the consumer loop stops further mapping',()=>consumerStop(api,'break')],
    ['consumer throw stops further source pulls',()=>consumerStop(api,'throw')],
    ['normal completion and skips still produce all remaining values',async()=>assert.deepEqual(await collect(api.pMapIterable([0,1,2,3],value=>value===1?api.pMapSkip:value,{concurrency:2})),[0,2,3])],
  ];
  if(task==='source-close') return [
    ['mapper rejection closes its source once and preserves error identity',()=>sourceRejection(api)],
    ['abort closes its source once and preserves abort reason',async()=>{const state=infiniteSource(), controller=new AbortController(), reason=new Error('abort requested');const result=observe(api.default(state.source,()=>{controller.abort(reason);return new Promise(()=>{});},{concurrency:1,signal:controller.signal}));await turns();assert.ok(result.settled);assert.equal(result.error,reason);assert.equal(state.returns,1);}],
    ['source return rejection does not replace the mapper failure',()=>sourceRejection(api,{returnError:new Error('cleanup failed')})],
    ['normal exhaustion does not call source return',async()=>{let i=0,returns=0;const source={[Symbol.iterator](){return{next(){return{done:i===3,value:i++};},return(){returns++;return{done:true};}};}};assert.deepEqual(await api.default(source,value=>value,{concurrency:2}),[0,1,2]);assert.equal(returns,0);}],
  ];
  if(task==='source-error') return [
    ['sync iterator failure after mapper resolution rejects with source error',()=>sourceError(api)],
    ['async iterator failure stops pulls and retains the source error',()=>sourceError(api,true)],
    ['mapper failures still aggregate after all mapping settles',async()=>{const failures=[new Error('a'),new Error('b')];await assert.rejects(api.default([0,1,2],value=>{if(value!==1)throw failures[value===0?0:1];return value;},{concurrency:2,stopOnError:false}),error=>error instanceof AggregateError && error.errors.length===2 && failures.every(f=>error.errors.includes(f)));}],
    ['rejected input promises remain aggregated while valid inputs are mapped',async()=>{const failure=new Error('input rejected'), mapped=[];await assert.rejects(api.default([Promise.reject(failure),1,2],value=>{mapped.push(value);return value;},{concurrency:2,stopOnError:false}),error=>error instanceof AggregateError && error.errors.length===1 && error.errors[0]===failure);assert.deepEqual(mapped,[1,2]);}],
  ];
  if(task==='cold-thenable') return [
    ['pMap subscribes once per cold pull and preserves every item',()=>coldMap(api,'default')],
    ['settled mapping preserves all cold-source values',()=>coldMap(api,'settled')],
    ['ordered and unordered iterable mapping consume each thenable once',async()=>{await coldMap(api,'iterable');await coldMap(api,'unordered',{concurrency:3,backpressure:6,preserveOrder:false});}],
    ['cold-source rejection remains the original error for all mapping forms',async()=>{const error=new Error('cold source failure');for(const kind of ['default','settled','iterable']) {const state=coldSource(error);const promise=kind==='default'?api.default(state.source,v=>v,{concurrency:1}):kind==='settled'?api.pMapSettled(state.source,v=>v,{concurrency:1}):collect(api.pMapIterable(state.source,v=>v,{concurrency:1}));await assert.rejects(promise,e=>e===error);assert.equal(state.nextCalls,state.thenCalls);}}],
  ];
  if(task==='ttl-refresh') return [
    ['replacement value expires at its renewed global lifetime',()=>clock(set=>{const c=new api.default({maxSize:10,maxAge:150});c.set('a','old');set(10100);c.set('a','new');set(10200);assert.equal(c.get('a'),'new');set(10251);assert.equal(c.has('a'),false);})],
    ['expiration callback receives the replaced application value once',()=>clock(set=>{const calls=[],c=new api.default({maxSize:10,maxAge:20,onEviction:(...args)=>calls.push(args)});c.set('a','old');set(10010);c.set('a','new');set(10031);assert.equal(c.get('a'),undefined);assert.equal(c.get('a'),undefined);assert.deepEqual(calls,[['a','new']]);})],
    ['refreshing one key does not renew another key',()=>clock(set=>{const c=new api.default({maxSize:10,maxAge:30});c.set('a','a');c.set('b','b');set(10020);c.set('a','updated');set(10031);assert.equal(c.has('b'),false);assert.equal(c.get('a'),'updated');set(10051);assert.equal(c.has('a'),false);})],
    ['non-expiring replacements and manual removals retain existing semantics',()=>clock(set=>{const calls=[],c=new api.default({maxSize:10,onEviction:(...args)=>calls.push(args)});c.set('a',1);c.set('a',2);set(999999);assert.equal(c.get('a'),2);c.delete('a');assert.deepEqual(calls,[]);})],
  ];
  if(task==='ttl-duration') return [
    ['per-item maxAge is a duration relative to insertion',()=>clock(set=>{const c=new api.default({maxSize:10});c.set('a','value',{maxAge:30});set(10020);assert.equal(c.get('a'),'value');set(10031);assert.equal(c.has('a'),false);})],
    ['per-item maxAge also applies relative to replacement writes',()=>clock(set=>{const c=new api.default({maxSize:10,maxAge:100});c.set('a','old');set(10050);c.set('a','new',{maxAge:20});set(10060);assert.equal(c.get('a'),'new');set(10071);assert.equal(c.has('a'),false);})],
    ['per-item duration overrides the global duration without changing other keys',()=>clock(set=>{const c=new api.default({maxSize:10,maxAge:100});c.set('a','short',{maxAge:20});c.set('b','global');set(10021);assert.equal(c.has('a'),false);assert.equal(c.get('b'),'global');set(10101);assert.equal(c.has('b'),false);})],
    ['explicit infinite lifetime remains non-expiring with a finite default',()=>clock(set=>{const c=new api.default({maxSize:10,maxAge:20});c.set('a','long',{maxAge:Infinity});set(999999);assert.equal(c.get('a'),'long');})],
  ];
  throw new Error('Unknown task '+task);
}

for(const [name,run] of casesFor(api,'mapper-index')) test(name,run);
