import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const base = new URL(process.env.BASE_URL || "http://127.0.0.1:5302");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname));
const playwright = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browserName = process.env.CONVERSION_BROWSER || "chromium";
const browser = await playwright[browserName].launch();
const out = path.resolve(process.env.CONVERSION_OUT || `tmp/phase3/conversion-png-ownership-${browserName}`);
await mkdir(out, { recursive: true });

const firstSize = [160, 120];
const nextSize = [96, 72];
const first = await makeFixture("first", firstSize, '<rect x="12" y="22" width="45" height="70"/>');
const next = await makeFixture("second", nextSize, '<circle cx="70" cy="38" r="18"/>');
const reports = [];

async function makeFixture(directory, [width, height], shape) {
  const target = path.join(out, directory);
  await mkdir(target, { recursive: true });
  const name = path.join(target, "same-name.png");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/>${shape}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(name);
  return name;
}

async function selectFile(page, label, filename) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByLabel(label, { exact: true }).first().click(),
  ]);
  await chooser.setFiles(filename);
}

async function run(scenario, holdAt) {
  const context = await browser.newContext({ viewport: { width: 1250, height: 850 } });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const posts = [];
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.method() === "POST" && new URL(request.url()).origin === base.origin) posts.push(request.url());
  });
  await context.route("**/*", route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
  await page.addInitScript(holdAt => {
    const originalSlice = Blob.prototype.slice;
    const originalArrayBuffer = Blob.prototype.arrayBuffer;
    const state = window.pngOwnershipProbe = { selected: null, reads: 0, pending: null, held: false, sourceURLs: [] };
    Blob.prototype.slice = function (...args) {
      const slice = originalSlice.apply(this, args);
      if (!(this instanceof File) || this.name !== "same-name.png") return slice;
      state.selected ??= this;
      if (state.selected !== this || args[0] !== 0 || args[1] !== 4096 || ++state.reads !== holdAt) return slice;
      const original = slice.arrayBuffer.bind(slice);
      slice.arrayBuffer = () => new Promise((resolve, reject) => {
        state.held = true;
        state.pending = () => original().then(resolve, reject);
      });
      return slice;
    };
    const originalCreateURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      const url = originalCreateURL(blob);
      if (blob instanceof File && blob.name === "same-name.png") state.sourceURLs.push(url);
      return url;
    };
    // Count the hybrid fingerprint read only after route-level validation.
    Blob.prototype.arrayBuffer = function (...args) {
      if (holdAt !== "fingerprint" || this !== state.selected) return originalArrayBuffer.apply(this, args);
      return new Promise((resolve, reject) => {
        state.held = true;
        state.pending = () => originalArrayBuffer.apply(this, args).then(resolve, reject);
      });
    };
  }, holdAt);
  let hash;
  try {
    await page.goto(new URL("/png-to-svg-converter", base).href, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /^Show \d+ more presets/i }).click();
    if (holdAt === "fingerprint") {
      await page.getByRole("button", { name: /^Filled Layers - Separate Colors\./ }).first().click();
    } else {
      await page.getByRole("button", { name: "Show fewer presets", exact: true }).click();
    }
    await selectFile(page, "Click or drag a file", first);
    await page.waitForFunction(() => window.pngOwnershipProbe.held);
    if (scenario === "remove") {
      await page.getByRole("button", { name: "Remove selected image", exact: true }).click();
    } else if (scenario === "replace") {
      await selectFile(page, "Replace selected image", next);
      const downloadButton = page.getByRole("button", { name: "Download SVG", exact: true }).first();
      const [download] = await Promise.all([page.waitForEvent("download"), downloadButton.click()]);
      assert.equal(await download.failure(), null);
      const target = path.join(out, "replacement.svg");
      await download.saveAs(target);
      const bytes = await readFile(target);
      hash = createHash("sha256").update(bytes).digest("hex");
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.deepEqual([info.width, info.height], nextSize, "the new file owns the download dimensions");
      assert.ok(data[(38 * info.width + 70) * 4] < 15, "the opposite-side replacement circle appears in the export");
      assert.ok(data[(38 * info.width + 21) * 4] > 240 || data[(38 * info.width + 21) * 4 + 3] === 0, "the old rectangle does not appear in the export");
    } else if (scenario === "cancel") {
      await page.getByRole("button", { name: "Cancel", exact: true }).first().click();
    } else {
      await page.getByRole("navigation", { name: "Footer", exact: true }).getByRole("link", { name: "How it works", exact: true }).click();
      await page.waitForURL(new URL("/how-it-works", base).href);
      await page.locator('[data-converter-input="true"]').waitFor({ state: "detached" });
    }
    const sourceURLsBeforeRelease = await page.evaluate(() => {
      const probe = window.pngOwnershipProbe;
      const total = probe.sourceURLs.length;
      void probe.pending();
      return total;
    });
    await page.waitForTimeout(1300);
    const statuses = await page.locator("[data-output-stamp]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-job-status") || node.getAttribute("data-engine-used")));
    const sourceURLs = await page.evaluate(() => window.pngOwnershipProbe.sourceURLs.length);
    if (scenario === "replace") {
      assert.equal(statuses.length, 1, "only the replacement may create a result");
      assert.equal(posts.length, 1, "only the replacement may reach the server");
    } else if (scenario === "cancel") {
      assert.deepEqual(statuses, ["canceled"], "late fingerprint must not replace canceled state");
      assert.equal(posts.length, 0);
    } else {
      assert.deepEqual(statuses, [], "invalidated source must never create a card");
      assert.equal(posts.length, 0, "invalidated source must never reach server conversion");
      assert.equal(sourceURLs, sourceURLsBeforeRelease, "invalidated source must never allocate another preview snapshot");
    }
    assert.deepEqual(errors, []);
    return { scenario, holdAt, posts: posts.length, statuses, sourceURLs, hash, passed: true };
  } catch (error) {
    const statuses = await page.locator("[data-output-stamp]").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-job-status") || node.getAttribute("data-engine-used")));
    const sourceURLs = await page.evaluate(() => window.pngOwnershipProbe?.sourceURLs.length);
    await page.screenshot({ path: path.join(out, `${scenario}-${holdAt}-failure.png`) });
    return { scenario, holdAt, posts: posts.length, statuses, sourceURLs, hash, errors, passed: false, failure: error.message };
  } finally {
    await context.close();
  }
}

try {
  for (const [scenario, holdAt] of [["remove", 2], ["replace", 2], ["navigate", 2], ["navigate", 1], ["cancel", "fingerprint"]]) {
    const result = await run(scenario, holdAt);
    reports.push(result);
    console.log(JSON.stringify(result));
  }
  await writeFile(path.join(out, "report.json"), JSON.stringify(reports, null, 2) + "\n");
  assert.equal(reports.filter(row => !row.passed).length, 0);
} finally {
  await browser.close();
}
