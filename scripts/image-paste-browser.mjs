import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";

const base = new URL(process.env.BASE_URL || "http://127.0.0.1:5182");
const baseline = new URL(process.env.BASELINE_URL || "http://127.0.0.1:5181");
for (const url of [base, baseline]) assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browserName = process.env.PASTE_BROWSER || "chromium";
const browser = await pw[browserName].launch();
const out = path.resolve(process.env.PASTE_OUT || `tmp/phase1-evidence/paste-${browserName}`);
await mkdir(out, { recursive: true });
const fixtures = await Promise.all([
  '<path d="M20 20H90V100H20Z"/>', '<circle cx="80" cy="60" r="38"/>',
].map(shape => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120">${shape}</svg>`)).png().toBuffer()));
const report = [];

async function chooseFile(input, bytes, directory) {
  const folder = path.join(out, directory);
  await mkdir(folder, { recursive: true });
  const filename = path.join(folder, "same-name.png");
  await writeFile(filename, bytes);
  await input.page().waitForFunction(() => Object.keys(document.querySelector('input[type="file"]') || {}).some(key => key.startsWith("__reactProps$")));
  const [chooser] = await Promise.all([input.page().waitForEvent("filechooser"), input.click()]);
  await chooser.setFiles(filename);
}

async function paste(page, bytes, type = "image/png", selector = '[aria-label="Image input"]') {
  return page.locator(selector).evaluate((element, { bytes, type }) => {
    const clipboardData = new DataTransfer();
    clipboardData.items.add(new File([new Uint8Array(bytes)], "same-name.png", { type }));
    const event = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  }, { bytes: Array.from(bytes), type });
}

async function download(page, filename) {
  const action = page.locator('[data-output-stamp]').first().getByRole("button", { name: "Download SVG", exact: true });
  await action.waitFor({ timeout: 60000 });
  const pending = page.waitForEvent("download");
  await action.click();
  const result = await pending;
  assert.equal(await result.failure(), null);
  await result.saveAs(path.join(out, filename));
  const svg = await readFile(path.join(out, filename), "utf8");
  assert.match(svg, /<svg\b/); assert.match(svg, /<path\b/); assert.doesNotMatch(svg, /<image\b/);
  const pixels = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  assert.ok(pixels.some((value, index) => index % 4 === 3 && value > 0), "download contains visible pixels");
  return svg;
}

try {
  for (const [route, name, width] of [["/", "home", 1440], ["/png-to-svg-converter", "png", 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, ...(width < 500 ? { isMobile: true, hasTouch: true } : {}) });
    await context.route("**/*", r => [base.origin, baseline.origin].includes(new URL(r.request().url()).origin) ? r.continue() : r.abort());
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(new URL(route, baseline).href, { waitUntil: "networkidle" });
    await chooseFile(page.locator('input[type="file"]').first(), fixtures[0], `${name}-original`);
    const original = await download(page, `${name}-baseline.svg`);
    await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
    await page.waitForFunction(() => Object.keys(document.querySelector('[aria-label="Image input"]') || {}).some(key => key.startsWith("__reactProps$")));
    let posts = 0;
    page.on("request", request => { if (request.method() === "POST" && new URL(request.url()).origin === base.origin) posts++; });

    assert.equal(await paste(page, fixtures[0]), true);
    await page.getByRole("button", { name: "Convert pasted image", exact: true }).waitFor();
    await page.waitForTimeout(1000);
    assert.equal(posts, 0, "paste awaits explicit confirmation");
    assert.equal(await page.locator('[data-output-stamp]').count(), 0, "paste does not start a browser conversion either");
    await page.screenshot({ path: path.join(out, `${name}-confirm.png`) });
    await page.getByRole("button", { name: "Discard pasted image" }).click();
    assert.equal(await page.getByRole("button", { name: "Convert pasted image", exact: true }).count(), 0);
    assert.equal(posts, 0);

    await paste(page, [1, 2, 3], "image/heic");
    await page.getByRole("alert").filter({ hasText: "Clipboard images must be" }).waitFor();
    await paste(page, [], "image/png");
    await page.getByRole("alert").filter({ hasText: "non-empty" }).waitFor();
    assert.equal(posts, 0);

    await page.getByRole("button", { name: /Show \d+ more presets/ }).click();
    const search = page.getByRole("searchbox", { name: "Search presets", exact: true });
    await search.fill("logo");
    assert.equal(await paste(page, fixtures[0], "image/png", 'input[type="search"]'), false, "text fields retain native paste");
    assert.equal(await search.inputValue(), "logo");
    await page.getByRole("button", { name: /Hide presets|Show fewer presets|Hide extra presets|Hide advanced presets|Show fewer/ }).first().click();

    await paste(page, fixtures[0]);
    await page.getByRole("button", { name: "Convert pasted image", exact: true }).click();
    const candidate = await download(page, `${name}-candidate.svg`);
    assert.equal(candidate, original, "pasted output preserves baseline SVG bytes");
    await page.screenshot({ path: path.join(out, `${name}-result.png`) });
    const count = await page.locator('[data-output-stamp]').count();
    await chooseFile(page.getByLabel("Replace selected image", { exact: true }), fixtures[1], `${name}-replacement`);
    await page.waitForFunction(n => document.querySelectorAll('[data-output-stamp]').length > n, count);
    const replaced = await download(page, `${name}-replacement.svg`);
    assert.notEqual(replaced, candidate, "same filename with different content owns a new result");
    await paste(page, fixtures[0]);
    await page.getByRole("button", { name: /Remove selected (file|image)/ }).click();
    assert.equal(await page.getByRole("button", { name: "Convert pasted image", exact: true }).count(), 0, "removal clears pending clipboard data");
    await page.locator('[data-output-primary-action="true"]').first().click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-converter-input]')).visibility === "hidden");
    for (let step = 0; step < 10; step++) {
      await page.keyboard.press("Tab");
      assert.equal(await page.locator('[data-converter-input]').evaluate(el => el.contains(document.activeElement)), false, "hidden input controls cannot receive keyboard focus");
    }
    await page.keyboard.press("Escape");
    await page.locator('[data-converter-input]').waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.deepEqual(errors, []);
    report.push({ route, width, browser: browserName, mobileEmulation: width < 500, svgBytes: Buffer.byteLength(candidate), sha256: createHash("sha256").update(candidate).digest("hex"), baselineByteParity: true, sameNameReplacement: true, posts });
    await context.close();
  }
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
