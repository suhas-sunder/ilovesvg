import { chromium, webkit } from 'file:///C:/Users/Suhas/AppData/Local/npm-cache/_npx/b234c773f454f454/node_modules/playwright/index.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://127.0.0.1:5302';
const out = process.env.OUT || 'tmp/phase3/ads-before';
await mkdir(out, { recursive: true });
const axe = await readFile('C:/Users/Suhas/.codex/worktrees/ilovesvg-phase1-20261112/tmp/phase1-a11y/node_modules/axe-core/axe.min.js', 'utf8');
const results = [];
for (const [engineName, engine] of Object.entries({ chromium, webkit })) {
  const browser = await engine.launch();
  for (const width of [390, 1440, 2600]) {
    const context = await browser.newContext({ viewport: { width, height: 950 } });
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.addInitScript(() => { window.__pushes = 0; window.adsbygoogle = { push() { window.__pushes++; } }; });
    await page.goto(base + '/png-to-svg-converter', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__reactRouterDataRouter);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(2100);
    await page.locator('ins.adsbygoogle').evaluateAll(nodes => nodes.find(ins => ins.parentElement.getBoundingClientRect().width > 0 && ins.parentElement.querySelector('[aria-hidden="true"]'))?.setAttribute('data-phase3-target','1'));
    const states = [];
    async function state(label) {
      const data = await page.evaluate(() => [...document.querySelectorAll('ins.adsbygoogle')].map(ins => {
        const wrapper = ins.parentElement; const p = wrapper.querySelector('[aria-hidden="true"]');
        const b = wrapper.getBoundingClientRect();
        return { slot: ins.dataset.adSlot, status: ins.dataset.adStatus || null, placeholder: p ? getComputedStyle(p).opacity : null, display: getComputedStyle(wrapper).display, box: [b.x+scrollX,b.y+scrollY,b.width,b.height], role: wrapper.getAttribute('role'), label: wrapper.getAttribute('aria-label'), overlap: p && ins.querySelector('iframe') ? p.getBoundingClientRect().width > 0 && Number(getComputedStyle(p).opacity) > 0 : false };
      }));
      states.push({ label, pushes: await page.evaluate(() => window.__pushes), slots: data });
    }
    await state('pending');
    await page.locator('[data-phase3-target]').evaluate(ins => ins.setAttribute('data-ad-status', 'unfilled'));
    await page.waitForTimeout(300); await state('unfilled');
    await page.locator('[data-phase3-target]').evaluate(ins => { ins.setAttribute('data-ad-status','filled'); const frame=document.createElement('iframe'); frame.title='Local mock creative'; frame.style.cssText='width:100%;height:90px;background:#146b3a'; ins.append(frame); });
    await page.waitForTimeout(350); await state('first-fill-mock');
    await page.locator('[data-phase3-target]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${engineName}-${width}-fill.png` });
    // A real global latch would retain suppression after a later unfilled state.
    await page.locator('[data-phase3-target]').evaluate(ins => {ins.setAttribute('data-ad-status','unfilled'); ins.querySelector('iframe')?.remove();});
    await page.waitForTimeout(350); await state('later-unfilled-mock');
    await page.addScriptTag({ content: axe });
    const violations = await page.evaluate(async () => (await axe.run()).violations.map(v => ({id:v.id, impact:v.impact, nodes:v.nodes.map(n=>({html:n.html,target:n.target}))})));
    await page.setViewportSize({ width: width === 390 ? 1440 : 390, height:950 }); await page.waitForTimeout(500); await state('resize');
    await page.getByRole('link', {name:'SVG Minifier', exact:true}).first().click();
    await page.waitForURL('**/svg-minifier'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(2500); await state('spa-navigation');
    assert.ok(states.find(s=>s.label==='first-fill-mock').slots.some(s => s.placeholder === '0'));
    results.push({engineName,width,states,violations});
    await context.close();
  }
  await browser.close();
}
await writeFile(`${out}/report.json`, JSON.stringify({base, mockOnly:true,results},null,2));
console.log(JSON.stringify(results.map(r=>({engine:r.engineName,width:r.width,violations:r.violations.map(v=>v.id),first:r.states[2].slots.map(s=>s.placeholder),later:r.states[3].slots.map(s=>s.placeholder)}))));
