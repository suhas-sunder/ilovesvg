import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../app/client/lib/tracing/vtracerWorkerClient.ts', import.meta.url), 'utf8');
const exports = {};
const javascript = ts.transpileModule(source.replaceAll('import.meta.url', JSON.stringify(import.meta.url)), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('require','exports',javascript)(name => {
  if (name.includes('enginePolicy')) return {getTraceEngineDecision:()=>({engine:'vtracer',clientEligible:true})};
  if (name.includes('layeredQualityTier')) return {normalizeLayeredQualityTier:()=> 'default'};
  if (name.includes('prepareRasterUpload')) return {readRasterHeader:async()=>({width:200,height:100})};
  throw new Error(`Unexpected dependency ${name}`);
},exports);
globalThis.window = {setTimeout,clearTimeout};
globalThis.OffscreenCanvas = class {};
globalThis.createImageBitmap = async () => {throw new Error('Size is already supplied');};
let workers = 0, messages = 0;
globalThis.Worker = class {
  constructor(){workers++;}
  postMessage(){messages++;queueMicrotask(()=>this.onerror({message:'Synthetic worker should not start after cancellation'}));}
  terminate(){}
};
const tick=async()=>{for(let i=0;i<10;i++) await new Promise(resolve=>setImmediate(resolve));};
const failures=[];
for(const mode of ['filled','centerline']){
  workers=0;messages=0;
  let releaseBuffer;
  const bytes=new Promise(resolve=>{releaseBuffer=resolve;});
  const controller=new AbortController();
  const result=exports.tryTraceRasterInClient({file:{type:'image/png',name:'deferred.png',size:16,arrayBuffer:()=>bytes},sourceWidth:200,sourceHeight:100,settings:{engine:'vtracer',traceMode:'single',strokeOutputMode:mode},signal:controller.signal});
  await tick(); controller.abort(); releaseBuffer(new ArrayBuffer(16));
  const attempt=await result;
  if(workers!==0||messages!==0||attempt.reason!=='Conversion was canceled.') failures.push({mode,workers,messages,reason:attempt.reason});
}
console.log(JSON.stringify({failures},null,2));
assert.deepEqual(failures,[],'cancel during input read must stop before worker construction or expensive tracing');
