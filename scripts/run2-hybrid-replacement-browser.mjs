import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
const pw=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=(process.env.BASE_URL||'http://localhost:3002').replace(/\/$/,'');
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const out=process.env.RUN2_HYBRID_BROWSER_REPORT_DIR||path.join(os.tmpdir(),'ilovesvg-run2-hybrid');await fs.mkdir(out,{recursive:true});
const fixture=await sharp(Buffer.from('<svg width="240" height="160"><rect width="240" height="160" fill="white"/><path d="M20 20H100V140H20z"/><circle cx="170" cy="80" r="45" fill="#b43010"/></svg>')).png().toBuffer();
const replacement=await sharp(fixture).flop().png().toBuffer();
const report=[];
async function upload(page,name,buffer,browserName){if(await page.locator('input[type=file]').count()===0)await page.getByRole('button',{name:'Remove selected image',exact:true}).click();const input=page.locator('input[type=file]').first();await input.setInputFiles({name,mimeType:'image/png',buffer});if(browserName==='webkit'){await page.waitForTimeout(150);if(await input.count()&&await input.evaluate(e=>e.files?.length>0))await input.dispatchEvent('change');}}
for(const browserName of (process.env.RUN2_HYBRID_BROWSERS||'chromium,firefox,webkit').split(',')){
 const executablePath=process.env['RASTER_'+browserName.toUpperCase()+'_EXECUTABLE'];const browser=await pw[browserName].launch({headless:true,...(executablePath?{executablePath}:{})});
 try{for(const mobile of browserName==='firefox'||process.env.RUN2_HYBRID_DESKTOP_ONLY==='1'?[false]:[false,true]){for(const scenario of (process.env.RUN2_HYBRID_SCENARIOS||'replace-server,join-before-failure,join-cancel-producer,three-consumers,replace-shared-group,replace-same-name').split(',')){
 const context=await browser.newContext({...(mobile?{...pw.devices['iPhone 13'],browserName:undefined}:{viewport:{width:1280,height:900}}),acceptDownloads:true});
 const page=await context.newPage(),errors=[];let posts=0,releaseHeld,downloadSha256;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
 await page.addInitScript(({delayed})=>{
  window.__ILOVESVG_HYBRID_TRACE_DEBUG__=[];window.__run2Workers=[];
  window.__run2NativeOffscreenCanvas=typeof window.OffscreenCanvas!=='undefined';
  if(!delayed)return;
  // This fixture substitutes the worker, never draws to a canvas. Cached
  // Windows WebKit lacks OffscreenCanvas, so force only the capability gate
  // for these fault-injection cases. Replacement cases retain native capabilities.
  if(!window.__run2NativeOffscreenCanvas)window.OffscreenCanvas=class SyntheticWorkerCapability{};
  const Original=window.Worker;
  window.Worker=new Proxy(Original,{construct(target,args){if(String(args[0]).includes('vtracer.worker')){const worker={onmessage:null,onerror:null,postMessage(){window.__run2Workers.push(()=>worker.onerror?.({message:'Synthetic delayed browser initialization failure'}));},terminate(){}};return worker;}return Reflect.construct(target,args);}});
 },{delayed:!scenario.startsWith('replace-')});
 await page.route('**/*.data*',async route=>{if(route.request().method()!=='POST')return route.continue();posts++;if(scenario.startsWith('replace-')&&posts===1){await new Promise(resolve=>{releaseHeld=resolve;});return route.abort('aborted').catch(()=>{});}return route.continue();});
 try{
  await page.goto(base+'/png-to-svg-converter');
  await page.waitForFunction(()=>Object.keys(document.querySelector('input[type=file]')||{}).some(k=>k.startsWith('__reactProps$')));
  await page.getByRole('button',{name:/^Show \d+ more presets/i}).click();
  await page.getByRole('button',{name:'Show fewer presets',exact:true}).waitFor();
  if(!scenario.startsWith('replace-'))await page.getByRole('button',{name:/^Filled Layers - Separate Colors\./}).first().click();
  else await page.getByRole('button',{name:'Show fewer presets',exact:true}).click();
  if(scenario.startsWith('replace-')){
   await upload(page,'held.png',fixture,browserName);await page.waitForFunction(()=>window.__ILOVESVG_HYBRID_TRACE_DEBUG__.some(e=>e.stage==='server-fallback-submit'));await page.waitForTimeout(100);
   if(scenario==='replace-shared-group'){await upload(page,'held.png',fixture,browserName);await page.waitForFunction(()=>window.__ILOVESVG_HYBRID_TRACE_DEBUG__.some(e=>e.stage==='in-flight-join'));}
   const nextName=scenario==='replace-same-name'?'held.png':'replacement.png';
   await upload(page,nextName,replacement,browserName);
   const output=page.locator('[data-output-stamp][data-job-status="succeeded"]').filter({has:page.locator(`[data-output-source-file="${nextName}"]`)});await output.waitFor({timeout:30000});
   const expectedJob=await page.evaluate(()=>window.__ILOVESVG_HYBRID_TRACE_DEBUG__.filter(e=>e.stage==='server-fallback-submit').at(-1)?.clientRunId);
   assert.equal(await output.getAttribute('data-job-id'),expectedJob,'replacement ownership uses latest job, never a filename match');
   const old=page.locator('[data-output-stamp]:not([data-job-status="succeeded"])').filter({has:page.locator('[data-output-source-file="held.png"]')});assert.equal(await old.count(),scenario==='replace-shared-group'?2:1); assert.deepEqual(await old.evaluateAll(elements=>elements.map(e=>e.getAttribute('data-job-status'))),Array(scenario==='replace-shared-group'?2:1).fill('failed'),'every superseded history card must settle');
   assert.equal(await page.getByRole('button',{name:'Convert PNG to SVG',exact:true}).isEnabled(),true,'no stranded waiter can keep converter busy');
   const downloadPromise=page.waitForEvent('download');await output.getByRole('button',{name:'Download SVG',exact:true}).click();const download=await downloadPromise;assert.equal(await download.failure(),null);
   const file=path.join(out,`${browserName}-${mobile?'mobile':'desktop'}-${scenario}.svg`);await download.saveAs(file);downloadSha256=createHash('sha256').update(await fs.readFile(file)).digest('hex');
   releaseHeld();await page.waitForTimeout(500);assert.equal(await page.locator('[data-output-stamp][data-job-status="succeeded"]').filter({has:page.locator('[data-output-source-file="held.png"]')}).count(),scenario==='replace-same-name'?1:0);assert.equal(posts,2);
  }else{
   await upload(page,'same.png',fixture,browserName);await page.waitForFunction(()=>window.__run2Workers.length===1,{},{timeout:10000});
   await upload(page,'same.png',fixture,browserName);await page.waitForFunction(()=>window.__ILOVESVG_HYBRID_TRACE_DEBUG__.some(e=>e.stage==='in-flight-join'));
   if(scenario==='three-consumers'){await upload(page,'same.png',fixture,browserName);await page.waitForFunction(()=>window.__ILOVESVG_HYBRID_TRACE_DEBUG__.filter(e=>e.stage==='in-flight-join').length>=2);}
   if(scenario==='join-cancel-producer')await page.getByRole('button',{name:'Cancel',exact:true}).last().click();
   await page.evaluate(()=>window.__run2Workers[0]());
   await page.locator('[data-job-status="succeeded"]').first().waitFor({timeout:30000});await page.waitForTimeout(300);
   assert.equal(await page.locator('[data-job-status="succeeded"]').count(),scenario==='join-cancel-producer'?1:scenario==='three-consumers'?3:2);
   assert.equal(await page.locator('[data-job-status="running"]').count(),0,'every live consumer settles');
   assert.equal(posts,1,'deduplicated consumer has one supported server fallback');
   assert.equal(await page.getByRole('button',{name:'Convert PNG to SVG',exact:true}).isEnabled(),true);
  }
  assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=2,'no horizontal overflow');const screenshot=path.join(out,`${browserName}-${mobile?'mobile':'desktop'}-${scenario}.png`);await page.screenshot({path:screenshot});
  const workerCapabilityShim=!scenario.startsWith('replace-')&&!(await page.evaluate(()=>window.__run2NativeOffscreenCanvas));
  report.push({browser:browserName,mobileEmulation:mobile,scenario,workerCapabilityShim,posts,downloadSha256,screenshot,status:'PASS'});
 }catch(error){const screenshot=path.join(out,`${browserName}-${mobile?'mobile':'desktop'}-${scenario}-FAILED.png`);await page.screenshot({path:screenshot});const traceStages=await page.evaluate(()=>window.__ILOVESVG_HYBRID_TRACE_DEBUG__?.map(({stage,reason})=>({stage,reason})));report.push({browser:browserName,mobileEmulation:mobile,scenario,posts,screenshot,status:'FAIL',error:error.message,traceStages});}
 finally{releaseHeld?.();await context.close();}
 console.log(JSON.stringify(report.at(-1)));
 }}}finally{await browser.close();}
}
await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));assert.deepEqual(report.filter(r=>r.status==='FAIL'),[],'actual replacement/deduplicated fallback browser cases must pass');
const downloads=report.filter(row=>row.downloadSha256);if(downloads.length)assert.equal(new Set(downloads.map(row=>row.downloadSha256)).size,1,'same replacement bytes/settings produce identical downloads even with identical source names');
