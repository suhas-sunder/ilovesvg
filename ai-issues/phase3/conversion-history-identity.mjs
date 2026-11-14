import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const base = new URL(process.env.BASE_URL || "http://127.0.0.1:5302");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname));
const pw = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browserName = process.env.CONVERSION_BROWSER || "chromium";
const browser = await pw[browserName].launch();
const out = path.resolve(process.env.CONVERSION_OUT || `tmp/phase3/conversion-history-identity-${browserName}`);
const cards = "[data-output-stamp]";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const first = await fixture("first", 160, 120, '<path d="M18 24H76V99H18Z"/>');
const other = await fixture("other", 96, 72, '<circle cx="67" cy="37" r="21"/>');
const rows = [];

async function fixture(subfolder, w, h, markup) {
  const dir = path.join(out, subfolder);
  await mkdir(dir, { recursive: true });
  const filename = path.join(dir, "same-name.png");
  const input = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="white"/>${markup}</svg>`);
  const bytes = await sharp(input).png().toBuffer();
  assert.ok(bytes.length < 4096);
  // Equal lengths ensure that a same-name collision reaches byte comparison.
  await writeFile(filename, Buffer.concat([bytes, Buffer.alloc(4096 - bytes.length)]));
  return filename;
}

async function capture(card, target) {
  const page = card.page();
  const button = card.getByRole("button", { name: /^(Download SVG|Download)$/ });
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  await download.saveAs(target);
  const bytes = await readFile(target);
  const metadata = await sharp(bytes).metadata();
  return { hash: hash(bytes), dimensions: [metadata.width, metadata.height] };
}

async function update(card) {
  await card.getByRole("button", { name: "Settings / Edit" }).press("Enter");
  const open = card.getByRole("button", { name: /^Click To Convert/ });
  if (await open.isVisible() && await open.getAttribute("aria-expanded") !== "true") await open.click();
  await card.getByRole("button", { name: "Line tracing", exact: true }).click();
  const action = card.getByRole("button", { name: "Update preview", exact: true });
  if (await action.isEnabled()) await action.click();
}

async function reselect(page, filename) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByLabel("Replace selected image", { exact: true }).click(),
  ]);
  await chooser.setFiles(filename);
}

async function run(route, name) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(9000);
  let posts = 0;
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", req => {
    if (req.method() === "POST" && new URL(req.url()).origin === base.origin) posts++;
  });
  await context.route("**/*", r => new URL(r.request().url()).origin === base.origin ? r.continue() : r.abort());
  try {
    await page.goto(new URL(route, base).href, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^Show \d+ more presets/ }).click();
    await page.getByRole("button", { name: "Show fewer presets" }).click();
    await page.locator('input[type="file"]').first().setInputFiles(first);
    const existing = page.locator(cards).first();
    await existing.getByRole("button", { name: "Download SVG" }).waitFor();
    const stamp = await existing.getAttribute("data-output-stamp");
    const old = page.locator(`${cards}[data-output-stamp="${stamp}"]`);
    const original = await capture(old, path.join(out, `${name}-original.svg`));

    await reselect(page, other);
    const newest = page.locator(`${cards}:not([data-output-stamp="${stamp}"])`).first();
    await newest.getByRole("button", { name: "Download SVG" }).waitFor();
    const replacement = await capture(newest, path.join(out, `${name}-replacement.svg`));
    const beforeUpdate = posts;
    await update(old);
    await page.waitForTimeout(1500);
    const after = await capture(old, path.join(out, `${name}-after-update.svg`));
    await page.screenshot({ path: path.join(out, `${name}-editor.png`) });
    const additionalPosts = posts - beforeUpdate;
    if (after.hash !== original.hash) return { route, original, replacement, after, additionalPosts, errors, passed: false };
    await old.getByRole("button", { name: "Done editing" }).click();
    const existingStamps = await page.locator(cards).evaluateAll(elements => elements.map(element => element.dataset.outputStamp));
    await reselect(page, first);
    const reselected = page.locator(cards + existingStamps.map(value => `:not([data-output-stamp="${value}"])`).join("")).first();
    await reselected.getByRole("button", { name: "Download SVG" }).waitFor();
    await update(old);
    await page.waitForFunction(stamp => document.querySelector(
      `[data-output-stamp="${stamp}"] [aria-label="Show previous version of this output"]:enabled`,
    ), stamp);
    const afterReselect = await capture(old, path.join(out, `${name}-original-reselected.svg`));
    return {
      route, original, replacement, after, afterReselect, additionalPosts, errors,
      passed: afterReselect.hash === original.hash && additionalPosts === 0 && errors.length === 0,
    };
  } catch (error) {
    await page.screenshot({ path: path.join(out, `${name}-failure.png`) }).catch(() => {});
    return { route, failure: error.message, errors, posts, passed: false };
  } finally {
    await context.close();
  }
}

try {
  for (const [route, name] of [["/", "home"], ["/png-to-svg-converter", "png"]]) {
    const row = await run(route, name);
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  await writeFile(path.join(out, "report.json"), JSON.stringify(rows, null, 2) + "\n");
  assert.ok(rows.every(row => row.passed), "same-name replacement is never used to retrace the original history result");
} finally {
  await browser.close();
}
