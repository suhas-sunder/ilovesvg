import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { unzipSync } from "fflate";
import sharp from "sharp";

const base = new URL(process.env.BASE_URL || "http://127.0.0.1:3012");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname));
const playwright = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const browserName = process.env.BATCH_BROWSER || "chromium";
const browser = await playwright[browserName].launch({ executablePath: process.env[`RASTER_${browserName.toUpperCase()}_EXECUTABLE`] || undefined });
const out = path.resolve(process.env.BATCH_BROWSER_OUT || "tmp/batch-navigation-browser");
await mkdir(out, { recursive: true });
const images = await Promise.all(["M10 12H83V67H10Z", "M12 60L70 10L83 67Z"].map(d =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="80"><path d="${d}" fill="black"/></svg>`)).png().toBuffer()));
const files = images.map(buffer => ({ name: "same-name.png", mimeType: "image/png", buffer }));
const report = [];

async function upload(input, files, trigger = input) {
  if (browserName !== "webkit") {
    await input.setInputFiles(files);
    return;
  }
  // Use WebKit's picker path, including the input event sent for disk files.
  const paths = [];
  for (const [index, file] of [files].flat().entries()) {
    const dir = path.join(out, `picker-${index}`);
    await mkdir(dir, { recursive: true });
    const filename = path.join(dir, file.name);
    await writeFile(filename, file.buffer);
    paths.push(filename);
  }
  const [chooser] = await Promise.all([input.page().waitForEvent("filechooser"), trigger.click()]);
  await chooser.setFiles(paths);
}

async function prepareBatch(page, batchFiles) {
  await page.goto(base.href);
  await page.waitForFunction(() => Object.keys(document.querySelector('input[type="file"]') || {}).some(key => key.startsWith("__reactProps$")));
  await upload(page.locator('input[type="file"]').first(), files[0]);
  const card = page.locator('[data-output-stamp][data-svg-bytes]:not([data-svg-bytes=""])').first();
  const download = card.getByRole("button", { name: "Download SVG", exact: true });
  try {
    await download.waitFor({ timeout: 5000 });
  } catch {
    const convert = page.getByRole("button", { name: "Convert to SVG", exact: true });
    if (await convert.isVisible() && await convert.isEnabled()) await convert.click();
    await download.waitFor({ timeout: 20000 });
  }
  await card.getByRole("button", { name: /^Settings/i }).first().click();
  await page.getByRole("button", { name: /^Batch conversion/i }).click();
  await upload(page.locator('input[type="file"][multiple]'), batchFiles, page.getByRole("button", { name: "Choose batch files", exact: true }));
  await page.getByText("2 files selected", { exact: false }).first().waitFor();
  await page.evaluate(() => {
    window.Worker = class { constructor() { throw new Error("Test forces batch server fallback"); } };
  });
}

try {
  for (const scenario of ["navigate", "complete", "partial"]) {
    const navigate = scenario === "navigate";
    const partial = scenario === "partial";
    const page = await browser.newPage({
      acceptDownloads: true,
      ...(process.env.BATCH_MOBILE === "1" ? { ...playwright.devices["iPhone 13"], browserName: undefined } : {}),
    });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let requestCount = 0;
    let release;
    let arrive;
    const hold = new Promise(resolve => { release = resolve; });
    const firstRequest = new Promise(resolve => { arrive = resolve; });
    const responses = [];
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin !== base.origin) return route.abort();
      if (url.pathname !== "/api/batch-svg") return route.continue();
      requestCount++;
      if (navigate && requestCount === 1) {
        arrive();
        await hold;
      }
      await route.continue().catch(() => {});
    });
    page.on("response", response => {
      if (new URL(response.url()).pathname === "/api/batch-svg") responses.push(response.status());
    });
    try {
      const invalid = { name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("invalid PNG") };
      await prepareBatch(page, partial ? [files[0], invalid] : files);
      await page.evaluate(() => {
        window.batchRequests = [];
        const original = window.fetch;
        window.fetch = (input, options) => {
          if (String(input) !== "/api/batch-svg") return original(input, options);
          const row = { signal: Boolean(options?.signal), aborted: false };
          options?.signal?.addEventListener("abort", () => { row.aborted = true; }, { once: true });
          window.batchRequests.push(row);
          return original(input, options);
        };
      });
      await page.getByRole("button", { name: /Convert 2 to ZIP/i }).click();
      if (navigate) {
        await Promise.race([firstRequest, page.waitForTimeout(10000).then(() => { throw new Error("Batch request never started"); })]);
        await page.locator('a[href="/how-it-works"]').filter({ visible: true }).first().click();
        await page.waitForURL("**/how-it-works");
        await page.waitForFunction(() => !document.querySelector('input[type="file"]'));
        await page.screenshot({ path: path.join(out, "after-navigation.png") });
        release();
        await page.waitForTimeout(600);
        const requests = await page.evaluate(() => window.batchRequests);
        report.push({ scenario, requestCount, requests, responses, errors });
        assert.deepEqual(requests, [{ signal: true, aborted: true }]);
        assert.equal(requestCount, 1);
        assert.deepEqual(responses, []);
      } else {
        const button = page.getByRole("button", { name: "Download ZIP", exact: true });
        await button.waitFor({ timeout: 45000 });
        await page.screenshot({ path: path.join(out, `${scenario}.png`) });
        const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
        const entries = unzipSync(await readFile(await download.path()));
        assert.deepEqual(Object.keys(entries), partial ? ["001-same-name.svg"] : ["001-same-name.svg", "002-same-name.svg"]);
        const pixels = await Promise.all(Object.values(entries).map(svg => sharp(svg).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
        for (const { info } of pixels) assert.deepEqual([info.width, info.height, info.channels], [96, 80, 4]);
        const alpha = (image, x, y) => image.data[(y * 96 + x) * 4 + 3];
        assert.equal(alpha(pixels[0], 20, 20), 255);
        assert.equal(alpha(pixels[0], 4, 4), 0);
        if (partial) {
          assert.equal(responses[0], 200);
          assert.ok(responses[1] >= 400 && responses[1] < 500);
          await page.getByText("1 file converted. 1 failed.").waitFor();
        } else {
          assert.equal(alpha(pixels[1], 20, 20), 0);
          assert.equal(alpha(pixels[1], 63, 45), 255);
          assert.deepEqual(responses, [200, 200]);
        }
        assert.equal(requestCount, 2);
        report.push({ scenario, requestCount, responses, entries: Object.keys(entries), errors });
      }
      assert.deepEqual(errors, []);
    } catch (error) {
      await page.screenshot({ path: path.join(out, `${scenario}-failed.png`) }).catch(() => {});
      console.error((await page.locator("body").innerText()).split("\n").filter(line => /SVG|same-name|error|fail/i.test(line)).slice(0, 24));
      throw error;
    } finally {
      release();
      await page.close();
      await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
    }
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
