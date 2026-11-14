import { chromium, webkit } from 'file:///C:/Users/Suhas/AppData/Local/npm-cache/_npx/b234c773f454f454/node_modules/playwright/index.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:5302', out=process.env.OUT||'tmp/phase3/content';
await mkdir(out,{recursive:true});
const axe=await readFile('C:/Users/Suhas/.codex/worktrees/ilovesvg-phase1-20261112/tmp/phase1-a11y/node_modules/axe-core/axe.min.js','utf8');
const pages=[['A','/author/suhas-sunder','What I maintain'],['B','/how-it-works/troubleshooting','A phone photo won’t upload or convert'],['C','/how-it-works/exporting-and-downloads',''],['D','/png-to-svg-for-cricut','Check the paths before you cut'],['E','/svg-background-editor','Try it with the built-in example'],['F','/svg-sprite-generator','']];
const results=[];
for (const [engineName,engine] of Object.entries({chromium,webkit})) {
 const browser=await engine.launch();
 for(const [id,path,heading] of pages.filter(p=>!process.env.PACKAGE||p[0]===process.env.PACKAGE)) for(const width of (process.env.WIDTHS?process.env.WIDTHS.split(',').map(Number):[320,375,390,430,768,1024,1440,1920])) {
  const context=await browser.newContext({viewport:{width,height:920}});
  await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
  const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
   await page.goto(base+path,{waitUntil:'networkidle'});
   await page.waitForFunction(()=>!!window.__reactRouterDataRouter);
   const facts=await page.evaluate(()=>({h1:[...document.querySelectorAll('h1')].map(n=>n.textContent.trim()),width:document.documentElement.scrollWidth,canonical:[...document.querySelectorAll('link[rel=canonical]')].map(n=>n.href),jsonld:[...document.querySelectorAll('script[type="application/ld+json"]')].map(n=>JSON.parse(n.textContent)),slots:document.querySelectorAll('ins.adsbygoogle').length}));
   assert.equal(facts.width,width);assert.equal(facts.h1.length,1);assert.deepEqual(facts.canonical,['https://www.ilovesvg.com'+path]);
   if(id==='A')assert.equal(facts.slots,0);
   await page.screenshot({path:`${out}/${id}-${engineName}-${width}-hero.jpg`,quality:78});
   if(heading)await page.getByRole('heading',{name:heading,exact:true}).scrollIntoViewIfNeeded();
   else if(id==='C')await page.locator('figure').first().scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>[...document.images].filter(image=>{const r=image.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&r.width>0;}).every(image=>image.complete&&image.naturalWidth>0),null,{timeout:10000});
   await page.screenshot({path:`${out}/${id}-${engineName}-${width}-content.jpg`,quality:78});
   const violations=[];
   if([390,1440].includes(width)) {
    await page.addScriptTag({content:axe});
    violations.push(...await page.evaluate(async()=> (await axe.run()).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({html:n.html,target:n.target}))}))));
    await page.evaluate(()=>scrollTo(0,0));
    await page.keyboard.press('Tab');
    const focused=await page.evaluate(()=>({tag:document.activeElement.tagName,text:document.activeElement.textContent.trim(),outline:getComputedStyle(document.activeElement).outlineStyle}));
    facts.keyboardStart=focused;
   }
   assert.deepEqual(errors,[]);results.push({id,engineName,width,facts,violations});
  }catch(e){results.push({id,engineName,width,error:e.stack});}
  await context.close();
 }
 await browser.close();
}
await writeFile(`${out}/report.json`,JSON.stringify({base,results},null,2));
console.log(JSON.stringify({runs:results.length,failures:results.filter(r=>r.error),axe:results.filter(r=>r.violations?.length).map(r=>({id:r.id,engine:r.engineName,width:r.width,violations:r.violations.map(v=>v.id)}))}));
if(results.some(r=>r.error))process.exitCode=1;
