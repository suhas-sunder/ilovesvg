import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Suhas/AppData/Local/npm-cache/_npx/b234c773f454f454/node_modules/playwright/index.mjs');
const source=await readFile('app/client/lib/monetization/adPlaceholderSafety.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {AD_PLACEHOLDER_SAFETY_SCRIPT:bootstrap}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const results=[];
for(const [engineName,engine] of Object.entries({chromium,webkit})){
  const browser=await engine.launch();const page=await browser.newPage();
  await page.route('**/*',route=>route.abort());
  await page.setContent('<main id="fixture"></main>');
  await page.evaluate(()=>{
    const NativeObserver=window.MutationObserver;const tracked=new WeakSet();
    window.reviewResources={observers:0,disconnects:0,callbacks:0,records:0,callbackMs:0,maxCallbackMs:0};
    window.MutationObserver=class extends NativeObserver{
      constructor(callback){super((records,observer)=>{
        if(!tracked.has(observer))return callback(records,observer);
        const start=performance.now();window.reviewResources.callbacks++;window.reviewResources.records+=records.length;
        callback(records,observer);const duration=performance.now()-start;
        window.reviewResources.callbackMs+=duration;window.reviewResources.maxCallbackMs=Math.max(window.reviewResources.maxCallbackMs,duration);
      });}
      observe(target,options){if(target===document.documentElement&&options.attributeFilter?.includes('data-ad-status')&&!tracked.has(this)){tracked.add(this);window.reviewResources.observers++;}return super.observe(target,options);}
      disconnect(){if(tracked.has(this))window.reviewResources.disconnects++;super.disconnect();}
    };
  });
  await page.addScriptTag({content:bootstrap});
  const result=await page.evaluate(async()=>{
    const fixture=document.querySelector('#fixture'),root=document.documentElement;
    const nextTask=()=>new Promise(resolve=>setTimeout(resolve,0));
    const snapshot=()=>({...window.reviewResources});
    const stages=[];const startAll=performance.now();
    // Upload previews may insert an already-populated SVG subtree at once.
    let start=performance.now();const bulk=document.createElementNS('http://www.w3.org/2000/svg','svg');
    for(let i=0;i<20000;i++){const path=document.createElementNS(bulk.namespaceURI,'path');path.setAttribute('d',`M${i%100},0h1v1z`);bulk.append(path);}
    fixture.append(bulk);await nextTask();stages.push({name:'one-20000-path-subtree',elapsedMs:performance.now()-start,...snapshot()});
    // Attribute edits do not match the observer's data-ad-status filter.
    start=performance.now();const beforeAttributes=snapshot();for(const path of bulk.children){path.setAttribute('fill','#123456');path.setAttribute('stroke-width','1');}
    await nextTask();stages.push({name:'40000-unrelated-svg-attribute-edits',elapsedMs:performance.now()-start,additionalCallbacks:window.reviewResources.callbacks-beforeAttributes.callbacks,additionalRecords:window.reviewResources.records-beforeAttributes.records,...snapshot()});
    bulk.remove();await nextTask();
    // Repeated route/editor redraws; each previous subtree is discarded.
    start=performance.now();for(let round=0;round<40;round++){
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');fixture.replaceChildren(svg);
      for(let i=0;i<500;i++){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',`M${i},0h1v1z`);svg.append(path);}
      await nextTask();
    }
    stages.push({name:'40-spa-like-replacements-500-attached-paths-each',elapsedMs:performance.now()-start,...snapshot()});
    const beforeFill=snapshot();const nodesBeforeFill=fixture.querySelectorAll('*').length;
    const ins=document.createElement('ins');ins.className='adsbygoogle';fixture.append(ins);ins.setAttribute('data-ad-status','filled');await nextTask();
    const afterFill=snapshot();
    start=performance.now();for(let round=0;round<40;round++){
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');fixture.replaceChildren(svg);
      for(let i=0;i<500;i++){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',`M${i},0h1v1z`);svg.append(path);}
      await nextTask();
    }
    stages.push({name:'40-equivalent-post-fill-replacements',elapsedMs:performance.now()-start,...snapshot()});
    fixture.replaceChildren();await nextTask();
    return{stages,beforeFill,afterFill,final:snapshot(),nodesBeforeFill,remainingFixtureNodes:fixture.querySelectorAll('*').length,latch:root.getAttribute('data-ad-placeholders-suppressed'),observerPropertyPresent:Object.hasOwn(root,'__iloveSvgAdPlaceholderObserver'),totalElapsedMs:performance.now()-startAll};
  });
  assert.equal(result.beforeFill.observers,1);assert.equal(result.beforeFill.disconnects,0);
  assert.equal(result.afterFill.disconnects,1);assert.equal(result.final.callbacks,result.afterFill.callbacks);
  assert.equal(result.final.records,result.afterFill.records);assert.equal(result.remainingFixtureNodes,0);
  assert.equal(result.observerPropertyPresent,false);assert.equal(result.latch,'true');
  assert.equal(result.stages[1].additionalRecords,0);
  results.push({engine:engineName,...result});await browser.close();
}
await writeFile('ai-issues/ad-safety/independent-resource-results.json',JSON.stringify({scope:'Bounded native-DOM resource probe with actual bootstrap, before and after fill. No network, no artwork uploads, no universal performance or heap-retention claim.',sourceSha256:createHash('sha256').update(source).digest('hex'),results},null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({engine:r.engine,beforeFill:r.beforeFill,afterFill:r.afterFill,totalElapsedMs:r.totalElapsedMs,remainingFixtureNodes:r.remainingFixtureNodes}))));
