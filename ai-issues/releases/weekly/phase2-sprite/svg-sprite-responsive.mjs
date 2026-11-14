import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const base = new URL(process.env.BASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname));
const playwright = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : "playwright");
const require = createRequire(import.meta.url);
const axeSource = process.env.AXE_SOURCE || require.resolve("axe-core/axe.min.js");
const out = resolve(process.env.SPRITE_OUT_DIR || "tmp/svg-sprite-responsive");
await mkdir(out, { recursive: true });
const widths = [320, 375, 390, 430, 768, 1024, 1440];
const axeOptions = { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } };
for (const engine of ["chromium", "webkit"]) {
  const browser = await playwright[engine].launch();
  try {
    for (const width of engine === "chromium" ? [...widths, 2560] : widths) {
      const page = await browser.newPage({ viewport: { width, height: width < 500 ? 844 : 950 }, ...(engine === "webkit" && width < 500 ? { isMobile: true, hasTouch: true } : {}) });
      try {
        await page.route(/^https?:/, route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
        const response = await page.goto(new URL("/svg-sprite-generator", base).href, {waitUntil:"networkidle"});
        assert.equal(response.status(), 200);
        assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://www.ilovesvg.com/svg-sprite-generator");
        await page.addScriptTag({path: axeSource});
        const name = `${engine}-${width}`;
        const checkPage = () => page.locator("main .ph-no-capture").evaluate(panel => {
          const main = panel.closest("main");
          const rect = panel.getBoundingClientRect();
          const controls = Array.from(panel.querySelectorAll("a,button,input,select,textarea,summary")).filter(el => el.getClientRects().length > 0);
          const overflow = controls.filter(el => {
            const bounds = el.getBoundingClientRect();
            return bounds.left < rect.left - 1 || bounds.right > rect.right + 1;
          }).map(el => el.id || el.textContent?.trim() || el.tagName);
          return {scroll:document.documentElement.scrollWidth, viewport:innerWidth, horizontalOverflow:overflow, toolBottom:main.getBoundingClientRect().bottom};
        });
        const initial = await checkPage();
        assert.ok(initial.scroll <= initial.viewport, name);
        assert.deepEqual(initial.horizontalOverflow, [], name);
        if (width === 320) await page.locator("main").screenshot({path:resolve(out,`${name}-empty.png`)});
        const editorAxe = async () => page.evaluate(async options => {
          const result = await axe.run("main", options);
          return result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) }));
        }, axeOptions);
        if (width === 320 || width === 1440) assert.deepEqual(await editorAxe(), [], name + " initial axe");
        await page.getByRole("button",{name:"Try two examples"}).click();
        await page.getByRole("img",{name:"Sunrise"}).waitFor();
        await page.getByRole("link",{name:"Download sprite.svg"}).waitFor();
        const ready = await checkPage();
        assert.ok(ready.scroll <= ready.viewport, name);
        assert.deepEqual(ready.horizontalOverflow, [], name);
        const label = await page.locator("main select").ariaSnapshot();
        if (width === 320 || width === 1440) assert.deepEqual(await editorAxe(), [], name + " ready axe");
        if ([320,390,1440,2560].includes(width)) await page.locator("main").screenshot({path:resolve(out,`${name}-ready.png`)});
        const contextualAd = await page.evaluate(() => {
          const main = document.querySelector("main");
          const lower = main.nextElementSibling;
          if (!lower) return [];
          const bottom = main.getBoundingClientRect().bottom;
          return [...lower.querySelectorAll("ins, [data-ad-slot], [data-ilovesvg-ad-slot]")].map(el => ({ overlap:el.getBoundingClientRect().top < bottom && el.getBoundingClientRect().height > 0, tag:el.tagName }));
        });
        assert.ok(contextualAd.every(ad => !ad.overlap), name);
        if (width === 2560) {
          await page.screenshot({path:resolve(out,`${name}-viewport.png`)});
          const result = await page.evaluate(async options => {
            const report = await axe.run(document, options);
            return report.violations.map(({ id, nodes }) => ({id,targets:nodes.map(node=>node.target)}));
          }, axeOptions);
          console.log(JSON.stringify({engine,width,globalAxe:result,contextualAd}));
        }
        if (width === 320) {
          await page.locator("#sprite-files").setInputFiles({ name: "invalid.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg>") });
          await page.locator("#sprite-error").waitFor();
          assert.deepEqual(await editorAxe(), [], name + " error axe");
          await page.locator("main").screenshot({path:resolve(out,`${name}-error.png`)});
        }
        console.log(JSON.stringify({engine,width,layout:"PASS",scopeAxe:[320,1440].includes(width)?"PASS":"sampled at 320 and 1440",label:label.split("\n")[0]}));
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
}
