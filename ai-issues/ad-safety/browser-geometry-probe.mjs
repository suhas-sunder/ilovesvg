import { chromium } from 'file:///C:/Users/Suhas/AppData/Local/npm-cache/_npx/b234c773f454f454/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch();
const results = [];
try {
  for (const base of ['http://127.0.0.1:5320','http://127.0.0.1:5321']) {
    const context = await browser.newContext({viewport:{width:768,height:950}});
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await context.addInitScript(() => { window.adsbygoogle = {push(){}}; });
    const page = await context.newPage();
    await page.goto(base+'/png-to-svg-converter',{waitUntil:'networkidle'});
    await page.waitForFunction(() => !!window.__reactRouterDataRouter);
    await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(7600);
    const data = await page.evaluate(() => [...document.querySelectorAll('main h1,main h2,main h3,main p,main section,ins.adsbygoogle')].map(node => {const b=node.getBoundingClientRect(),s=getComputedStyle(node);return {tag:node.tagName,text:node.textContent?.slice(0,100),className:node.className,x:b.x,y:b.y+scrollY,width:b.width,height:b.height,font:s.font,lineHeight:s.lineHeight};}));
    results.push({base,data});
    await page.screenshot({path:`tmp/ad-safety/geometry-${base.endsWith('5320')?'before':'after'}.png`,fullPage:true});
    await context.close();
  }
} finally {await browser.close();}
await writeFile('tmp/ad-safety/geometry-probe.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results[0].data.flatMap((a,i) => JSON.stringify(a)===JSON.stringify(results[1].data[i]) ? [] : [{before:a,after:results[1].data[i]}]).slice(0,8),null,2));
