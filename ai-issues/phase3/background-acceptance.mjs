import {chromium,webkit} from 'file:///C:/Users/Suhas/AppData/Local/npm-cache/_npx/b234c773f454f454/node_modules/playwright/index.mjs';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const base=process.env.BASE_URL||'http://127.0.0.1:5302',out=process.env.OUT||'tmp/phase3/background';await mkdir(out,{recursive:true});
const results=[];
for(const [engineName,engine]of Object.entries({chromium,webkit})){
 const browser=await engine.launch(),context=await browser.newContext({viewport:{width:390,height:920},acceptDownloads:true});
 await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());
 const page=await context.newPage();
 try{
  await page.goto(base+'/svg-background-editor',{waitUntil:'networkidle'});
  async function upload(svg,underlay=false){const[picker]=await Promise.all([page.waitForEvent('filechooser'),underlay?page.getByRole('button',{name:'Upload underlay SVG',exact:true}).click():page.getByLabel('Click or drag a file',{exact:true}).click()]);await picker.setFiles({name:underlay?'underlay.svg':'source.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});await page.waitForTimeout(150);}
  async function save(label){const[d]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download SVG',exact:true}).click()]);const path=`${out}/${engineName}-${label}.svg`;await d.saveAs(path);const bytes=await readFile(path);const{data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});const pixel=(x,y)=>[...data.subarray((y*info.width+x)*4,(y*info.width+x)*4+4)];return{svg:bytes.toString(),corner:pixel(2,2),center:pixel(50,50),edge:pixel(10,10)};}
  const original='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="white"/><circle cx="50" cy="50" r="20" fill="#0033ff"/></svg>';
  await upload(original);const removed=await save('removed');assert.deepEqual(removed.corner,[0,0,0,0]);assert.deepEqual(removed.center,[0,51,255,255]);
  const preview=page.getByAltText('Output SVG preview',{exact:true});const src=await preview.getAttribute('src');
  const checker=page.getByText('Checkerboard',{exact:true}).locator('..').getByRole('checkbox');await checker.uncheck();assert.equal(await preview.getAttribute('src'),src);await checker.check();
  const mode=page.getByRole('combobox').filter({has:page.locator('option[value="replace"]')});await mode.selectOption('replace');
  await upload('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#00aa44"/></svg>',true);
  const replaced=await save('replaced');assert.deepEqual(replaced.corner,[0,170,68,255]);assert.deepEqual(replaced.center,removed.center);
  await page.getByRole('button',{name:'Clear',exact:true}).click();await upload(replaced.svg);await mode.selectOption('remove');const repeat=await save('repeat-removed');assert.deepEqual(repeat.corner,[0,0,0,0]);assert.deepEqual(repeat.center,removed.center);
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  await upload('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="5" y="5" width="85" height="85" fill="#ff0000"/><circle cx="50" cy="50" r="20" fill="#0033ff"/></svg>');
  const beforeManual=await save('manual-before');assert.deepEqual(beforeManual.edge,[255,0,0,255]);
  const manual=page.getByRole('combobox').filter({has:page.locator('option[value="bg-0"]')});await manual.selectOption('bg-0');const afterManual=await save('manual-after');assert.deepEqual(afterManual.edge,[0,0,0,0]);assert.deepEqual(afterManual.center,removed.center);
  await preview.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/${engineName}-manual.png`});
  results.push({engineName,removed,replaced,repeat,beforeManual,afterManual});
 }catch(e){results.push({engineName,error:e.stack});}
 await browser.close();
}
await writeFile(`${out}/report.json`,JSON.stringify({base,results},null,2));console.log(JSON.stringify(results));if(results.some(r=>r.error))process.exitCode=1;
