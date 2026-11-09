import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const playwright = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const baseUrl = getSmokeBaseUrl();
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname), "synthetic reliability tests must target a local test server");
const outDir = process.env.RASTER_ROUTE_REPORT_DIR || path.join(os.tmpdir(), "ilovesvg-raster-route-browser");
await fs.mkdir(outDir, { recursive: true });
const source = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="9000" height="120"><path fill="#111" d="M100 20H6000V100H100Z"/><circle fill="#111" cx="7500" cy="60" r="35"/></svg>');
const wide = await sharp(source).png().toBuffer();
const small = await sharp(source).resize(300, 200, { fit: "fill" }).png().toBuffer();
const unsafe = Buffer.from(wide); unsafe.writeUInt32BE(100000, 16); unsafe.writeUInt32BE(100000, 20);
const report = [];
for (const browserName of (process.env.RASTER_BROWSERS || "chromium,firefox,webkit").split(",")) {
  const executablePath = process.env[`RASTER_${browserName.toUpperCase()}_EXECUTABLE`];
  const browser = await playwright[browserName].launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    for (const mobile of browserName === "firefox" ? [false] : [false, true]) {
      const context = await browser.newContext({ ...(mobile ? { ...playwright.devices["iPhone 13"], browserName: undefined } : { viewport: { width: 1280, height: 900 } }), acceptDownloads: true });
      try {
        await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseUrl).origin ? route.continue() : route.abort());
        for (const fixture of [
          { id: "normal", name: "normal.png", type: "image/png", buffer: small, dimensions: "300 x 200" },
          { id: "wide", name: "wide.png", type: "image/png", buffer: wide, dimensions: "8000 x 106" },
          { id: "dng", name: "photo.DNG", type: "image/x-adobe-dng", buffer: Buffer.from([0x49, 0x49, 0x2a, 0]), error: /ProRAW\/DNG/ },
          { id: "unsafe", name: "unsafe.png", type: "image/png", buffer: unsafe, error: /too much memory/ },
        ]) {
          const page = await context.newPage();
          const errors = [], posts = [];
          page.on("pageerror", error => errors.push(error.message));
          page.on("response", response => { if (response.request().method() === "POST" && new URL(response.url()).origin === new URL(baseUrl).origin) posts.push({ status: response.status(), url: new URL(response.url()).pathname }); });
          await page.addInitScript(() => {
            window.__rasterDecodeCount = 0;
            const decode = globalThis.createImageBitmap;
            if (decode) globalThis.createImageBitmap = (...args) => { window.__rasterDecodeCount++; return decode(...args); };
          });
          await page.goto(`${baseUrl}/png-to-svg-converter`, { waitUntil: "networkidle" });
          await page.locator("input[type=file]").setInputFiles({ name: fixture.name, mimeType: fixture.type, buffer: fixture.buffer });
          if (fixture.error) {
            await page.getByText(fixture.error).first().waitFor({ timeout: 15000 });
            await page.waitForTimeout(500);
            assert.equal(posts.length, 0, "unsupported/dangerous images never upload");
            assert.equal(await page.evaluate(() => window.__rasterDecodeCount), 0, "unsupported/dangerous images never decode");
            assert.equal(await page.locator("[data-output-stamp]").count(), 0);
          } else {
            await page.getByText(fixture.dimensions, { exact: true }).waitFor({ timeout: 15000 });
            const output = page.locator('[data-output-stamp][data-job-status="succeeded"]').first();
            await output.waitFor({ timeout: 60000 });
            const downloadPromise = page.waitForEvent("download");
            await output.getByRole("button", { name: "Download SVG", exact: true }).click();
            const download = await downloadPromise;
            assert.equal(await download.failure(), null);
            const downloadedPath = path.join(outDir, `${browserName}-${mobile ? "mobile" : "desktop"}-${fixture.id}.svg`);
            await download.saveAs(downloadedPath);
            const svg = await fs.readFile(downloadedPath, "utf8");
            assert.match(svg, /<svg\b/); assert.match(svg, /<path\b/); assert.doesNotMatch(svg, /<image\b/);
            assert.ok(posts.some(post => post.status === 200), "real compatible server path completes");
            fixture.sha256 = createHash("sha256").update(svg).digest("hex");
            fixture.downloadedBytes = Buffer.byteLength(svg);
            if (fixture.id === "wide") {
              await output.scrollIntoViewIfNeeded();
              for (const colorScheme of ["light", "dark"]) {
                await page.emulateMedia({ colorScheme });
                await page.screenshot({ path: path.join(outDir, `${browserName}-${mobile ? "mobile" : "desktop"}-${colorScheme}.png`) });
              }
            }
          }
          const layout = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, h1: [...document.querySelectorAll("h1")].filter(element => element.getBoundingClientRect().height > 0).length }));
          assert.ok(layout.scrollWidth <= layout.viewport + 1, "no horizontal overflow");
          assert.equal(layout.h1, 1);
          assert.deepEqual(errors, [], "no page/hydration exceptions");
          report.push({ browser: browserName, mobileEmulation: mobile, fixture: fixture.id, posts, errors, layout, downloadedBytes: fixture.downloadedBytes, sha256: fixture.sha256, status: "PASS" });
          await page.close();
        }
        // Hold an oversized decoder briefly so a replacement selection wins deterministically.
        const replacementPage = await context.newPage();
        const replacementPosts = [];
        replacementPage.on("response", response => { if (response.request().method() === "POST" && new URL(response.url()).origin === new URL(baseUrl).origin) replacementPosts.push(response.status()); });
        await replacementPage.addInitScript(() => {
          window.__rasterDecodeStarted = false;
          const decode = globalThis.createImageBitmap;
          globalThis.createImageBitmap = async (...args) => {
            window.__rasterDecodeStarted = true;
            const result = await decode(...args);
            await new Promise(resolve => setTimeout(resolve, 500));
            return result;
          };
        });
        await replacementPage.goto(`${baseUrl}/png-to-svg-converter`, { waitUntil: "networkidle" });
        await replacementPage.locator("input[type=file]").setInputFiles({ name: "superseded.png", mimeType: "image/png", buffer: wide });
        await replacementPage.waitForFunction(() => window.__rasterDecodeStarted);
        await replacementPage.locator("input[type=file]").setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: small });
        await replacementPage.locator('[data-output-stamp][data-job-status="succeeded"]').first().waitFor({ timeout: 60000 });
        await replacementPage.waitForTimeout(1000);
        assert.equal(await replacementPage.locator('[data-output-source-file="superseded.png"]').count(), 0);
        assert.ok(await replacementPage.locator('[data-output-source-file="replacement.png"]').count() > 0);
        assert.deepEqual(replacementPosts, [200], "only winning replacement submits a server request");
        report.push({ browser: browserName, mobileEmulation: mobile, fixture: "replacement-during-normalization", posts: replacementPosts, status: "PASS" });
        await replacementPage.close();
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
for (const fixture of ["normal", "wide"]) {
  assert.equal(new Set(report.filter(result => result.fixture === fixture).map(result => result.sha256)).size, 1, `${fixture} tracing download agrees byte-for-byte across browser configurations`);
}
await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ report: path.join(outDir, "report.json"), cases: report.length, results: report }, null, 2));
