import {chromium,webkit} from 'file:///C:/Users/Suhas/AppData/Local/npm-cache/_npx/b234c773f454f454/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.BASE_URL||'http://127.0.0.1:5303';const results=[];await mkdir('tmp/phase3/author',{recursive:true});
for(const [engineName,engine]of Object.entries({chromium,webkit})){
 const browser=await engine.launch(),context=await browser.newContext({viewport:{width:390,height:844}});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const page=await context.newPage();
 await page.goto(base+'/author/suhas-sunder',{waitUntil:'networkidle'});assert.equal(await page.locator('ins.adsbygoogle').count(),0);assert.equal(await page.locator('script[src*="adsbygoogle"]').count(),0);
 await page.goto(base+'/',{waitUntil:'networkidle'});const link=page.locator('footer').getByRole('link',{name:'Suhas Sunder',exact:true});await link.focus();await page.keyboard.press('Enter');await page.waitForURL('**/author/suhas-sunder');await page.getByRole('heading',{name:'Suhas Sunder',exact:true}).waitFor();assert.equal(await page.locator('ins.adsbygoogle').count(),0);
 const profile=await page.locator('script[type="application/ld+json"]').evaluateAll(nodes=>nodes.map(n=>JSON.parse(n.textContent)).find(n=>n['@type']==='ProfilePage'));assert.equal(profile.mainEntity.name,'Suhas Sunder');assert.equal(profile.mainEntity.jobTitle,'Software engineer');
 await page.getByRole('link',{name:'Open the converter',exact:true}).focus();await page.keyboard.press('Enter');await page.waitForURL(base+'/');assert.equal(await page.locator('h1').count(),1);results.push({engineName,coldAds:0,footerKeyboardRoundTrip:true,visibleProfileMatchesSchema:true});await browser.close();
}
await writeFile('tmp/phase3/author/report.json',JSON.stringify({base,results},null,2));console.log(JSON.stringify(results));
