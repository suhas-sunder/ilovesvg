import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE || 'file:///C:/Users/Suhas/AppData/Local/npm-cache/_npx/b234c773f454f454/node_modules/playwright/index.mjs');
const source=await readFile('app/client/lib/monetization/adPlaceholderSafety.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {AD_PLACEHOLDER_SAFETY_SCRIPT:bootstrap}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const fullCss=await readFile('app/app.css','utf8');
const safetyCss=fullCss.slice(fullCss.indexOf('/* Protected ad safety:'),fullCss.indexOf('@theme'));
assert.ok(safetyCss.includes('data-ad-placeholders-suppressed'));
const fixture=`<style>${safetyCss}[data-ad-container]{position:relative;isolation:isolate;width:300px;height:120px}[data-ad-placeholder]{position:absolute;inset:0;background:#ddd;z-index:0;pointer-events:none}ins{position:relative;z-index:1;display:block;width:300px;height:120px}</style><div data-ad-container><div data-ad-placeholder>Advertisement</div><ins class="adsbygoogle" id="one"></ins></div><div data-ad-container><div data-ad-placeholder>Advertisement</div><ins class="adsbygoogle" id="two"></ins></div>`;
const results=[];
for(const [engineName,engine] of Object.entries({chromium,webkit})){
  const browser=await engine.launch();
  const observed=[];
  for(const scenario of ['false-positive-controls','prehydration-filled-unfilled','same-task-detach-transition','prefilled-subtree-insertion','initial-filled-scan','idempotence-and-disconnect','new-document-isolation']){
    const page=await browser.newPage();
    await page.route('**/*',route=>route.abort());
    await page.setContent(fixture);
    await page.evaluate(()=>{
      const NativeObserver=window.MutationObserver;const tracked=new WeakSet();
      window.reviewMetrics={created:0,disconnected:0,callbacks:0};
      window.MutationObserver=class extends NativeObserver{
        constructor(callback){super((records,observer)=>{if(tracked.has(observer))window.reviewMetrics.callbacks++;callback(records,observer);});}
        observe(target,options){if(target===document.documentElement&&options.attributeFilter?.includes('data-ad-status')&&!tracked.has(this)){tracked.add(this);window.reviewMetrics.created++;}return super.observe(target,options);}
        disconnect(){if(tracked.has(this))window.reviewMetrics.disconnected++;super.disconnect();}
      };
    });
    if(scenario==='initial-filled-scan')await page.locator('#one').evaluate(ins=>ins.setAttribute('data-ad-status','filled'));
    await page.addScriptTag({content:bootstrap});
    const row=await page.evaluate(async({scenario,bootstrap})=>{
      const root=document.documentElement,one=document.querySelector('#one'),two=document.querySelector('#two');
      const latch=()=>root.getAttribute('data-ad-placeholders-suppressed');
      const visible=()=>[...document.querySelectorAll('[data-ad-placeholder]')].map(p=>getComputedStyle(p).visibility);
      const checkpoint=()=>new Promise(resolve=>setTimeout(resolve,0));
      const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const check=(message,condition)=>{if(!condition)throw new Error(scenario+': '+message);};
      const states=[];
      const record=label=>states.push({label,latch:latch(),visibility:visible()});
      if(scenario==='false-positive-controls'){
        const iframe=document.createElement('iframe');iframe.style.cssText='width:300px;height:120px;border:0';one.append(iframe);
        await checkpoint();record('large-pending-iframe');check('pending frame only clears own slot',latch()===null&&visible()[0]==='hidden'&&visible()[1]==='visible');
        iframe.remove();one.setAttribute('data-ad-status','unfilled');
        const child=document.createElement('span');one.append(child);child.setAttribute('data-ad-status','filled');child.setAttribute('data-ad-status','unfilled');
        one.setAttribute('data-unrelated','filled');one.setAttribute('data-unrelated','unfilled');
        await checkpoint();record('unfilled-unrelated-and-nested-markers');check('no false latch',latch()===null&&visible().every(v=>v==='visible'));
      }else if(scenario==='prehydration-filled-unfilled'){
        one.setAttribute('data-ad-status','filled');record('synchronous-css-before-callback');
        check('synchronous CSS protects every slot',visible().every(v=>v==='hidden'));
        await frame();record('filled-before-hydration');
        one.setAttribute('data-ad-status','unfilled');await frame();record('later-unfilled-before-hydration');
        check('early observer retains fill history',latch()==='true'&&visible().every(v=>v==='hidden'));
      }else if(scenario==='same-task-detach-transition'){
        one.setAttribute('data-ad-status','filled');one.setAttribute('data-ad-status','unfilled');one.parentElement.remove();
        await checkpoint();record('detached-before-delivery');check('oldValue retained for detached slot',latch()==='true'&&visible().every(v=>v==='hidden'));
      }else if(scenario==='prefilled-subtree-insertion'){
        const subtree=document.createElement('section');subtree.innerHTML='<div><ins class="adsbygoogle" data-ad-status="filled"></ins></div>';
        document.body.append(subtree);subtree.remove();await checkpoint();record('prepopulated-subtree-added-then-removed');
        check('transient prefilled subtree retained',latch()==='true'&&visible().every(v=>v==='hidden'));
      }else if(scenario==='initial-filled-scan'){
        record('existing-fill-on-bootstrap');check('initial scan latches',latch()==='true'&&visible().every(v=>v==='hidden'));
      }else if(scenario==='idempotence-and-disconnect'){
        const duplicate=document.createElement('script');duplicate.textContent=bootstrap;document.head.append(duplicate);await checkpoint();
        check('one observer before fill',window.reviewMetrics.created===1);
        one.setAttribute('data-ad-status','filled');await checkpoint();const callbackCount=window.reviewMetrics.callbacks;
        for(let i=0;i<1000;i++){one.setAttribute('data-ad-status',i%2?'filled':'unfilled');const el=document.createElement('span');two.append(el);el.remove();}
        await checkpoint();check('observer disconnected permanently',window.reviewMetrics.disconnected===1&&window.reviewMetrics.callbacks===callbackCount);
        const wrapper=one.parentElement.cloneNode(true);wrapper.querySelector('ins').removeAttribute('data-ad-status');document.body.append(wrapper);
        check('new slot hidden immediately',getComputedStyle(wrapper.querySelector('[data-ad-placeholder]')).visibility==='hidden');
        record('1000-post-latch-transitions-and-new-slot');
      }else{
        record('new-document-starts-unsuppressed');check('session does not cross documents',latch()===null&&visible().every(v=>v==='visible'));
      }
      return{scenario,states,metrics:window.reviewMetrics};
    },{scenario,bootstrap});
    observed.push(row);await page.close();
  }
  results.push({engine:engineName,observed});await browser.close();
}
await writeFile('ai-issues/ad-safety/independent-race-results.json',JSON.stringify({scope:'Native DOM bootstrap and actual source CSS race probes; production-app matrix is separate. No ad network requests.',scriptSourceSha256:createHash('sha256').update(source).digest('hex'),results},null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({engine:r.engine,passed:r.observed.length}))));
