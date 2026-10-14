import assert from 'node:assert/strict';

const turns = async () => { for (let i = 0; i < 24; i++) await new Promise(setImmediate); };
async function pipeEnd(M, options, values = []) {
  const source = new M({async: true, encoding: 'utf8'});
  const destination = new M({encoding: 'utf8'});
  let ends = 0; let data = '';
  destination.on('data', chunk => { data += chunk; });
  const original = destination.end;
  destination.end = function (...args) { ends++; return original.apply(this, args); };
  source.pipe(destination, options);
  for (const value of values) source.write(value);
  source.end(); source.end(); source.end();
  await turns();
  return {ends, data};
}
async function pipeline(M, chunks) {
  const source = new M({encoding: 'utf8'});
  const mid = new M({encoding: 'utf8'});
  const proxy = new M({encoding: 'utf8'});
  mid.write = function (chunk, encoding, cb) {
    M.prototype.write.call(this, chunk, encoding, cb);
    return proxy.write(chunk, encoding, cb);
  };
  proxy.on('drain', () => mid.emit('drain'));
  proxy.on('readable', () => setImmediate(() => proxy.read()));
  const destination = new M({encoding: 'utf8'});
  for (const chunk of chunks.slice(0, 2)) source.write(chunk);
  const output = new (class extends M {
    constructor() {
      super({encoding: 'utf8'});
      destination.on('data', chunk => super.write(chunk));
      destination.on('end', () => super.end());
    }
    emit(event, ...args) {
      if (event === 'resume') destination.resume();
      return super.emit(event, ...args);
    }
  })();
  mid.pipe(destination); source.pipe(mid);
  let result; let error; let settled = false;
  output.concat().then(value => {result = value; settled = true;}, value => {error = value; settled = true;});
  for (const chunk of chunks.slice(2)) source.write(chunk);
  source.end();
  await turns();
  assert.equal(settled, true, 'pipeline did not finish after deterministic event-loop drainage');
  if (error) throw error;
  return result;
}
function completedEvents(M) {
  const source = new M({encoding: 'utf8'});
  const events = [];
  for (const event of ['end', 'prefinish', 'finish']) source.on(event, () => events.push(event));
  source.resume(); source.end();
  return {source, events};
}

export function casesFor(M, task) {
  if (task === 'async-end') return [
    ['repeated async end closes one destination once', async () => assert.equal((await pipeEnd(M)).ends, 1)],
    ['async buffered data is preserved before completion', async () => assert.deepEqual(await pipeEnd(M, undefined, ['alpha', 'β']), {ends: 1, data: 'alphaβ'})],
    ['pipe end:false keeps destination open', async () => assert.deepEqual(await pipeEnd(M, {end: false}, ['value']), {ends: 0, data: 'value'})],
    ['independent destinations each finish once', async () => {
      const source = new M({async: true}); const counts = [0, 0];
      for (let i = 0; i < 2; i++) { const destination = new M(); const end = destination.end; destination.end = function (...args) {counts[i]++; return end.apply(this, args);}; source.pipe(destination); }
      source.end(); source.end(); await turns(); assert.deepEqual(counts, [1, 1]);
    }],
  ];
  if (task === 'buffered-readable') return [
    ['listener added after buffering observes existing data immediately', () => {const s = new M({encoding:'utf8'}); s.write('hello'); let seen = false; s.on('readable', () => {seen = true;}); assert.equal(seen, true);}],
    ['readable listener can start flow without losing buffered data', () => {const s = new M({encoding:'utf8'}); s.write('α'); s.write('β'); const values = []; s.on('readable', () => s.on('data', value => values.push(value))); assert.equal(values.join(''), 'αβ'); assert.equal(s.flowing, true);}],
    ['empty and flowing streams do not gain false readable notifications', () => {for (const flowing of [false,true]) {const s = new M(); if (flowing) s.resume(); let calls = 0; s.on('readable', () => calls++); assert.equal(calls, 0);}}],
    ['object-mode buffered values remain actual application objects', () => {const s = new M({objectMode:true}); const object = {key:'value'}; s.write(object); let seen; s.on('readable', () => {seen = s.read();}); assert.equal(seen, object);}],
  ];
  if (task === 'pipeline-order') return [
    ['slow proxy pipeline retains original chunk order', async () => assert.equal(await pipeline(M, ['a','b','c','d']), 'abcd')],
    ['slow proxy pipeline preserves Unicode and longer chunk sequences', async () => assert.equal(await pipeline(M, ['α','β','γ','δ','ε']), 'αβγδε')],
    ['write result reflects flow started during readable notification', async () => {for (const chunk of ['', 'b']) {const s = new M({encoding:'utf8'}); const d = new M({encoding:'utf8'}); let result; d.concat().then(value => {result = value;}); s.write('a'); s.on('readable', () => s.pipe(d)); assert.equal(s.write(chunk), true); s.end(); await turns(); assert.equal(result, 'a'+chunk);}}],
    ['ordinary writes retain backpressure and callbacks', () => {const s = new M({encoding:'utf8'}); let callbacks = 0; assert.equal(s.write('a', () => callbacks++), false); assert.equal(callbacks, 1); assert.equal(s.read(), 'a');}],
  ];
  if (task === 'end-listeners') return [
    ['all registered completion events reach their handlers', () => assert.deepEqual(completedEvents(M).events, ['end','prefinish','finish'])],
    ['one completion event does not remove another event listener', () => {const s = new M(); let finish = 0; s.on('finish', () => finish++); s.emit('prefinish'); assert.equal(s.listenerCount('finish'), 1); s.resume(); s.end(); assert.equal(finish, 1);}],
    ['repeated end remains one-shot for registered listeners', () => {const {source,events} = completedEvents(M); source.end(); source.end(); assert.deepEqual(events, ['end','prefinish','finish']);}],
    ['late completion listeners are delivered and removed per event', () => {const {source} = completedEvents(M); const events = []; for (const event of ['finish','end','prefinish']) {source.on(event, () => events.push(event)); assert.equal(source.listenerCount(event), 0);} assert.deepEqual(events, ['finish','end','prefinish']);}],
  ];
  throw new Error('Unknown task '+task);
}
