import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const output = path.resolve(process.env.QUALITY_CORPUS_OUT || path.join(root, "tmp/run3-quality-corpus"));
const urls = {
  baseline: process.env.CHECKER_BROWSER_BASELINE_URL || "http://127.0.0.1:3012",
  candidate: process.env.CHECKER_BROWSER_CANDIDATE_URL || "http://127.0.0.1:3013",
};
const buildIds = {};
for (const [name, url] of Object.entries(urls)) {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname), "quality corpus requires local builds");
  const response = await fetch(new URL("/", url));
  assert.equal(response.status, 200);
  buildIds[name] = (await response.text()).match(/\/assets\/home-[\w-]+\.js/)?.[0];
  assert.ok(buildIds[name], `${name} must be a production build`);
}
assert.notEqual(new URL(urls.baseline).origin, new URL(urls.candidate).origin, "separate local servers required");

await fs.mkdir(output, { recursive: true });
const art = '<rect x="70" y="60" width="180" height="120" fill="#b42110"/><path d="M90 100H230M130 80V160" stroke="white" stroke-width="7"/>';
const svgFixture = background => sharp(Buffer.from(`<svg width="320" height="240">${background}${art}</svg>`)).png().toBuffer();
const draw = contents => sharp(Buffer.from(`<svg width="320" height="240">${contents}</svg>`)).png().toBuffer();
const neutral = '<path fill="#f8f8f8" d="M0 0H320V120H0Z"/><path fill="#dedede" d="M0 120H320V240H0Z"/>';
const textSample = [7, 9, 12, 16].map((size, row) =>
  `<text x="30" y="${75 + row * 28}" font-family="sans-serif" font-size="${size}">Review code ABC 1375</text>`).join("");
const fixtures = {
  ui: await fs.readFile(path.join(root, "tests/fixtures/IMG_8487.PNG")),
  bands: await svgFixture(neutral),
  checker: await svgFixture('<defs><pattern id="b" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#f8f8f8"/><path fill="#dedede" d="M0 0H10V10H0ZM10 10H20V20H10Z"/></pattern></defs><rect width="320" height="240" fill="url(#b)"/>'),
  transparent: await svgFixture(""),
  logo: await draw('<path fill="#174388" d="M160 25L270 190H50Z"/><path fill="#fdfdfd" d="M160 78L219 168H101Z"/><circle cx="160" cy="141" r="21" fill="#b53258"/>'),
  lettering: await draw(`${neutral}<rect x="20" y="43" width="280" height="140" rx="8" fill="#fdfdfd"/>${textSample}`),
  thinLines: await draw(`<rect width="320" height="240" fill="#f4f5f6"/>${[1, 2, 3, 4].map((width, row) => `<path fill="none" stroke="#17273b" stroke-width="${width}" d="M24 ${40 + 46 * row}Q120 ${5 + 46 * row} 280 ${40 + 46 * row}"/>`).join("")}`),
  illustration: await draw('<rect width="320" height="240" fill="#9ad5ed"/><path fill="#3a9470" d="M0 215L110 85L179 145L236 74L320 173V240H0Z"/><circle cx="256" cy="47" r="27" fill="#ffc953"/><path fill="#6351a8" d="M0 240V222L119 182L220 214L320 199V240Z"/>'),
  complex: await draw('<defs><linearGradient id="g"><stop stop-color="#3b106a"/><stop offset="1" stop-color="#f18e54"/></linearGradient></defs><rect width="320" height="240" fill="url(#g)"/>' + Array.from({length: 31}, (_, i) => `<circle cx="${(i * 53 + 19) % 320}" cy="${(i * 47 + 12) % 240}" r="${6 + i % 21}" fill="hsl(${i * 37 % 360},70%,48%)" opacity=".82"/>`).join("")),
};
if (process.env.QUALITY_CORPUS_PHOTO) {
  fixtures.photo = await sharp(process.env.QUALITY_CORPUS_PHOTO).autoOrient().resize(320, 240, { fit: "cover" }).png().toBuffer();
}
const presets = {
  lineart: "Lineart - Accurate (default)",
  "flat-medium": "Layered - Flat Color (Medium Quality)",
  "flat-high": "Layered - Flat Color (High Quality)",
  "photo-high": "Photo Many Colors (High Quality)",
  "flat-amazing": "Layered - Flat Color (Amazing Quality)",
};
const matrix = {
  ui: ["flat-high", "photo-high"], bands: ["flat-high"], checker: ["flat-high", "lineart"],
  transparent: ["flat-high", "lineart"], logo: ["flat-high"],
  lettering: ["flat-medium", "flat-high", "flat-amazing", "lineart"], thinLines: ["flat-high", "lineart"],
  illustration: ["flat-high", "photo-high"], complex: ["flat-high", "photo-high"],
  photo: ["flat-medium", "flat-high", "photo-high", "flat-amazing"],
};
const fixtureFilter = process.env.QUALITY_CORPUS_FIXTURES?.split(",");
if (fixtureFilter) for (const name of fixtureFilter) assert.ok(Object.hasOwn(fixtures, name), `Unknown fixture ${name}`);
const selected = Object.entries(fixtures).filter(([fixture]) => !fixtureFilter || fixtureFilter.includes(fixture)).flatMap(([fixture, buffer]) =>
  matrix[fixture].map(preset => ({ fixture, buffer, preset, label: presets[preset] })));
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
function comparePixels(source, output) {
  let alphaIntersection = 0, alphaUnion = 0, rgbError = 0, dark = 0, darkRecovered = 0;
  let unexpectedDark = 0;
  let edges = 0, edgesRecovered = 0;
  const luma = (bytes, offset) => (0.2126 * bytes[offset] + 0.7152 * bytes[offset + 1] + 0.0722 * bytes[offset + 2]) * bytes[offset + 3] / 255 + 255 - bytes[offset + 3];
  for (let offset = 0; offset < source.length; offset += 4) {
    const sourceAlpha = source[offset + 3] / 255;
    const outputAlpha = output[offset + 3] / 255;
    alphaIntersection += Math.min(sourceAlpha, outputAlpha);
    alphaUnion += Math.max(sourceAlpha, outputAlpha);
    for (let channel = 0; channel < 3; channel++) {
      rgbError += Math.abs((source[offset + channel] - 255) * sourceAlpha - (output[offset + channel] - 255) * outputAlpha);
    }
    const s = luma(source, offset), o = luma(output, offset);
    if (s >= 200 && o <= 64) unexpectedDark++;
    if (s <= 128) {
      dark++;
      if (o <= 150) darkRecovered++;
    }
    for (const stride of [4, 400 * 4]) {
      if (offset + stride >= source.length || (stride === 4 && (offset / 4) % 400 === 399)) continue;
      const contrast = luma(source, offset + stride) - s;
      if (Math.abs(contrast) < 48) continue;
      edges++;
      if ((luma(output, offset + stride) - o) * Math.sign(contrast) >= 24) edgesRecovered++;
    }
  }
  return {
    alphaOverlap: alphaUnion ? alphaIntersection / alphaUnion : 1,
    meanRgbError: rgbError / (3 * source.length / 4),
    darkRecall: dark ? darkRecovered / dark : null,
    edgeRecall: edges ? edgesRecovered / edges : null,
    unexpectedDarkShare: unexpectedDark / (source.length / 4),
  };
}
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
    assert.ok(row.postResponses.length <= 1 && row.postResponses.every(status => status === 200));
    if (preset !== "lineart") assert.deepEqual(row.postResponses, [200], "quality tiers must reach the real server");
    assert.deepEqual(row.pageErrors, []);
    row.bytes = exported.length;
    row.sha256 = digest(exported);
    const [sourcePixels, outputPixels] = await Promise.all([raster(buffer), raster(exported)]);
    row.rasterSha256 = digest(outputPixels);
    row.sourceOpaque = opaqueShare(sourcePixels);
    row.outputOpaque = opaqueShare(outputPixels);
    row.render = comparePixels(sourcePixels, outputPixels);
    row.paths = (exported.toString().match(/<path\b/g) || []).length;
    row.layers = (exported.toString().match(/<g\b/g) || []).length;
    row.viewBox = exported.toString().match(/\bviewBox="([^"]+)"/)?.[1];
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
  if ((fixture === "ui" || fixture === "bands" || fixture === "lettering") && preset === "flat-high") {
    report.assertions.push({ fixture, preset, check: "restored opaque coverage", ok: candidate.outputOpaque > baseline.outputOpaque + 0.1
      && candidate.outputOpaque >= baseline.sourceOpaque * 0.9 });
  }
  if (fixture === "lettering" && preset === "lineart") {
    // Allow small edge movement but reject a newly black region in a light background.
    const addedDarkShare = candidate.render.unexpectedDarkShare - baseline.render.unexpectedDarkShare;
    report.assertions.push({ fixture, preset, check: "no new large black region in pale background", addedDarkShare, ok: addedDarkShare <= 0.05 });
  }
}
await saveReport();
console.log(`Completed ${report.rows.filter(row => row.ok).length}/${report.rows.length} exports; ${report.assertions.filter(row => row.ok).length}/${report.assertions.length} output comparisons pass`);
if (report.rows.some(row => !row.ok) || report.assertions.some(row => !row.ok)) process.exitCode = 1;
