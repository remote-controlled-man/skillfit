import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {casesFor} from './cases.mjs';
const M = createRequire(import.meta.url)(resolve(process.argv[3], 'runtime.cjs'));
const checks = [];
for (const [name, run] of casesFor(M, process.argv[2])) {
  try {await run(); checks.push({name,pass:true});}
  catch (error) {checks.push({name,pass:false,detail:String(error.message).slice(0,300)});}
}
console.log(JSON.stringify({checks}));
