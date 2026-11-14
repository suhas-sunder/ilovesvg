import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : "playwright");
import { readFile } from "node:fs/promises";
const bundled = await readFile("node_modules/posthog-js/dist/recorder-v2.js","utf8");
const base = process.env.BASE_URL;
if (base) assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
for (const [engine, browserType] of Object.entries({chromium,webkit})) {
  const browser = await browserType.launch();
  try {
    const page = await browser.newPage();
    if (base) {
      await page.route(/^https?:/, route => new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort());
      await page.goto(new URL("/svg-sprite-generator", base).href, {waitUntil:"networkidle"});
    } else await page.setContent('<body><p>Outside recorder positive control</p><div id="tool" class="ph-no-capture"></div>');
    await page.addScriptTag({content:bundled});
    await page.evaluate(() => {
      const record = window.__PosthogExtensions__.rrweb.record;
      window.reviewCapture = [];
      window.reviewStopCapture = record({ emit: event => window.reviewCapture.push(event), blockClass:"ph-no-capture", maskAllInputs:true, recordAfter: "DOMContentLoaded" });
    });
    const marker = "PRIVATE_REPLAY_7B395F";
    if (base) {
      await page.getByLabel("Select SVG icon files or drop them here").setInputFiles({name:marker + ".svg",mimeType:"image/svg+xml",buffer:Buffer.from(`<svg viewBox="0 0 24 24"><title>${marker}</title><rect width="24" height="24" fill="#a00"/></svg>`)});
      await page.getByRole("img",{name:marker}).waitFor();
      await page.getByRole("button",{name:"Copy sprite markup"}).click();
      await page.getByRole("button",{name:"Copy HTML snippet"}).click();
      await page.getByLabel("Select SVG icon files or drop them here").setInputFiles({name:marker + "-bad.svg",mimeType:"image/svg+xml",buffer:Buffer.from("<svg>")});
      await page.locator("#sprite-error").waitFor();
      assert.ok(await page.getByText(new RegExp(marker)).count());
    } else await page.locator("#tool").evaluate((node, marker) => {
      node.innerHTML = `<img alt="${marker}" src="data:image/png;test,${marker}"/><p id="error" aria-label="${marker}">${marker}</p><textarea>${marker}</textarea>`;
      node.querySelector("p").textContent = marker + "EDITED";
      node.querySelector("img").alt = marker + "EDITED";
      node.querySelector("textarea").select();
    }, marker);
    await page.evaluate(() => {
      const p = document.createElement("p");
      p.textContent = "POSITIVE_CONTROL_3D1E";
      document.body.append(p);
      window.__PosthogExtensions__.rrweb.record.takeFullSnapshot();
    });
    await page.waitForTimeout(150);
    const events = await page.evaluate(() => { window.reviewStopCapture(); return window.reviewCapture; });
    const serialized = JSON.stringify(events);
    assert.ok(events.length > 1);
    assert.ok(serialized.includes("POSITIVE_CONTROL_3D1E"));
    assert.ok(!serialized.toLowerCase().includes(marker.toLowerCase()));
    console.log(JSON.stringify({engine,route:Boolean(base),captured:events.length,privateMarkerExcluded:true,positiveControlCaptured:true}));
  } finally { await browser.close(); }
}
