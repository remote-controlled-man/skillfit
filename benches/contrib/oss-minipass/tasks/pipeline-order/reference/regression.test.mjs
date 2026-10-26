import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const M = createRequire(import.meta.url)('./runtime.cjs');
test('a slow proxy pipeline preserves the order of old and new chunks', async () => {
  const source=new M({encoding:'utf8'}), mid=new M({encoding:'utf8'}), proxy=new M({encoding:'utf8'}), destination=new M({encoding:'utf8'});
  mid.write=function(chunk,encoding,cb) {M.prototype.write.call(this,chunk,encoding,cb); return proxy.write(chunk,encoding,cb);};
  proxy.on('drain',()=>mid.emit('drain')); proxy.on('readable',()=>setImmediate(()=>proxy.read()));
  source.write('a'); source.write('b');
  const pipeline=new (class extends M {
    constructor() {super({encoding:'utf8'}); destination.on('data',chunk=>super.write(chunk)); destination.on('end',()=>super.end());}
    emit(event,...args) {if(event==='resume') destination.resume(); return super.emit(event,...args);}
  })();
  mid.pipe(destination); source.pipe(mid);
  let settled=false, result; pipeline.concat().then(value=>{settled=true;result=value;});
  source.write('c'); source.write('d'); source.end();
  for(let i=0;i<24;i++) await new Promise(setImmediate);
  assert.equal(settled,true); assert.equal(result,'abcd');
});
