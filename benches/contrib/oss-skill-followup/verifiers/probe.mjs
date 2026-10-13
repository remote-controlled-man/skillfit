import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {casesFor} from './cases.mjs';
const api=await import(pathToFileURL(resolve(process.argv[3],'index.js')));
const checks=[];
for(const [name,run] of casesFor(api,process.argv[2])) {
  try {await run();checks.push({name,pass:true});}
  catch(error) {checks.push({name,pass:false,detail:String(error.message).slice(0,300)});}
}
console.log(JSON.stringify({checks}));
