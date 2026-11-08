import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "tmp/run2-quality-conversion");
const urls = {
  baseline: process.env.CHECKER_BROWSER_BASELINE_URL || "http://127.0.0.1:3007",
  candidate: process.env.CHECKER_BROWSER_CANDIDATE_URL || "http://127.0.0.1:3004",
};
const buildIds = {};
for (const [name, url] of Object.entries(urls)) {
  const response = await fetch(new URL("/", url));
  assert.equal(response.status, 200);
  buildIds[name] = (await response.text()).match(/\/assets\/home-[\w-]+\.js/)?.[0];
  assert.ok(buildIds[name], `${name} must be a production build`);
}
assert.notEqual(buildIds.baseline, buildIds.candidate, "separate baseline and candidate builds required");

await fs.mkdir(output, { recursive: true });
const art = '<rect x="70" y="60" width="180" height="120" fill="#b42110"/><path d="M90 100H230M130 80V160" stroke="white" stroke-width="7"/>';
const svgFixture = background => sharp(Buffer.from(`<svg width="320" height="240">${background}${art}</svg>`)).png().toBuffer();
const fixtures = {
  ui: await fs.readFile(path.join(root, "tests/fixtures/IMG_8487.PNG")),
  bands: await svgFixture('<path fill="#f8f8f8" d="M0 0H320V120H0Z"/><path fill="#dedede" d="M0 120H320V240H0Z"/>'),
  checker: await svgFixture('<defs><pattern id="b" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#f8f8f8"/><path fill="#dedede" d="M0 0H10V10H0ZM10 10H20V20H10Z"/></pattern></defs><rect width="320" height="240" fill="url(#b)"/>'),
  transparent: await svgFixture(""),
};
const presets = {
  lineart: "Lineart - Accurate (default)",
  "flat-high": "Layered - Flat Color (High Quality)",
  "photo-high": "Photo Many Colors (High Quality)",
};
const selected = Object.entries(fixtures).flatMap(([fixture, buffer]) =>
  Object.entries(presets).filter(([preset]) => preset !== "photo-high" || fixture === "ui")
    .map(([preset, label]) => ({ fixture, buffer, preset, label })));
const playwright = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const executablePath = process.env.RASTER_CHROMIUM_EXECUTABLE;
const browser = await playwright.chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const report = { buildIds, rows: [], comparisons: [], assertions: [] };
const digest = input => createHash("sha256").update(input).digest("hex");
const raster = input => sharp(input).resize(400, 220, { fit: "contain", background: "#00000000" }).ensureAlpha().raw().toBuffer();
const opaqueShare = bytes => {
  let count = 0;
  for (let i = 3; i < bytes.length; i += 4) if (bytes[i] >= 245) count++;
  return count / (bytes.length / 4);
};
const saveReport = () => fs.writeFile(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
for (const [fixture, buffer] of Object.entries(fixtures)) await fs.writeFile(path.join(output, `${fixture}-source.png`), buffer);

async function convert(build, url, { fixture, buffer, preset, label }) {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const row = { build, fixture, preset, label, postResponses: [], pageErrors: [] };
  const id = `${fixture}-${preset}-${build}`;
  const started = Date.now();
  await page.route("**/*", route => new URL(route.request().url()).origin === new URL(url).origin
    ? route.continue() : route.abort());
  page.on("response", response => {
    if (response.request().method() === "POST") row.postResponses.push(response.status());
  });
  page.on("pageerror", error => row.pageErrors.push(error.message));
  try {
    await page.goto(new URL("/", url).href);
    await page.waitForFunction(() => Object.keys(document.querySelector('input[type="file"]') || {})
      .some(key => key.startsWith("__reactProps$")));
    await page.getByRole("button", { name: /^Show \d+ more presets/i }).click();
    await page.getByRole("button", { name: "Show fewer presets", exact: true }).waitFor();
    const selector = page.getByRole("button", { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`) });
    await selector.click();
    assert.equal(await selector.getAttribute("aria-pressed"), "true");
    await page.locator('input[type="file"]').first().setInputFiles({ name: `${fixture}.png`, mimeType: "image/png", buffer });
    const card = page.locator('[data-output-stamp][data-svg-bytes]:not([data-svg-bytes=""])');
    await card.getByRole("button", { name: "Download SVG", exact: true }).waitFor({ timeout: 65000 });
    assert.equal(await card.count(), 1);
    assert.ok((await card.innerText()).replace(/\s+/g, " ").includes(label), `completed output must name selected preset: ${label}`);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-output-stamp][data-svg-bytes] img')]
      .some(img => img.complete && img.naturalWidth > 0));
    const [download] = await Promise.all([
      page.waitForEvent("download"), card.getByRole("button", { name: "Download SVG", exact: true }).click(),
    ]);
    assert.match(download.suggestedFilename(), /\.svg$/);
    row.engine = await card.getAttribute("data-engine-used");
    row.path = path.join(output, `${id}.svg`);
    await download.saveAs(row.path);
    const exported = await fs.readFile(row.path);
    assert.match(exported.toString(), /<svg\b[\s\S]*<path\b/);
    assert.doesNotMatch(exported.toString(), /<image\b/i);
    assert.deepEqual(row.postResponses, [200], "one real server conversion must succeed");
    assert.deepEqual(row.pageErrors, []);
    row.bytes = exported.length;
    row.sha256 = digest(exported);
    row.rasterSha256 = digest(await raster(exported));
    row.sourceOpaque = opaqueShare(await raster(buffer));
    row.outputOpaque = opaqueShare(await raster(exported));
    row.screenshot = path.join(output, `${id}.png`);
    await card.screenshot({ path: row.screenshot, timeout: 10000 });
    row.ok = true;
  } catch (error) {
    row.ok = false;
    row.error = error.message;
    row.text = (await page.locator("body").innerText()).slice(0, 5500);
    await page.screenshot({ path: path.join(output, `${id}-failed.png`) }).catch(() => {});
  } finally {
    row.elapsedMs = Date.now() - started;
    report.rows.push(row);
    console.log(`${id}: ${row.ok ? `${row.engine}, ${row.bytes} bytes, opaque ${row.outputOpaque.toFixed(3)}` : row.error} (${row.elapsedMs}ms)`);
    await context.close();
    await saveReport();
  }
}

try {
  for (const sample of selected) for (const [build, url] of Object.entries(urls)) await convert(build, url, sample);
} finally {
  await browser.close();
}

for (const { fixture, preset, buffer } of selected) {
  const baseline = report.rows.find(row => row.fixture === fixture && row.preset === preset && row.build === "baseline");
  const candidate = report.rows.find(row => row.fixture === fixture && row.preset === preset && row.build === "candidate");
  if (!baseline?.ok || !candidate?.ok) continue;
  const images = await Promise.all([buffer, fs.readFile(baseline.path), fs.readFile(candidate.path)].map(async source =>
    sharp(await source).flatten({ background: "white" }).resize(400, 220, { fit: "contain", background: "white" }).png().toBuffer()));
  const sheet = path.join(output, `${fixture}-${preset}-comparison.png`);
  const legend = Buffer.from('<svg width="1240" height="260"><g font-family="sans-serif" font-size="15" fill="#18263a"><text x="10" y="23">Source</text><text x="420" y="23">Before</text><text x="830" y="23">After</text></g></svg>');
  await sharp({ create: { width: 1240, height: 260, channels: 3, background: "#f4f6f8" } })
    .composite([{ input: legend, left: 0, top: 0 }, ...images.map((input, index) => ({ input, left: 10 + index * 410, top: 34 }))])
    .png().toFile(sheet);
  const parity = baseline.rasterSha256 === candidate.rasterSha256;
  const byteParity = baseline.sha256 === candidate.sha256;
  report.comparisons.push({ fixture, preset, sourceOpaque: baseline.sourceOpaque, baselineOpaque: baseline.outputOpaque,
    candidateOpaque: candidate.outputOpaque, parity, byteParity, sheet });
  if (fixture === "checker" || fixture === "transparent") {
    report.assertions.push({ fixture, preset, check: "decoded raster parity", ok: parity });
  }
  if ((fixture === "ui" || fixture === "bands") && preset === "flat-high") {
    report.assertions.push({ fixture, preset, check: "restored opaque coverage", ok: candidate.outputOpaque > baseline.outputOpaque + 0.1
      && candidate.outputOpaque >= baseline.sourceOpaque * 0.9 });
  }
}
await saveReport();
console.log(`Completed ${report.rows.filter(row => row.ok).length}/${report.rows.length} exports; ${report.assertions.filter(row => row.ok).length}/${report.assertions.length} output comparisons pass`);
if (report.rows.some(row => !row.ok) || report.assertions.some(row => !row.ok)) process.exitCode = 1;
