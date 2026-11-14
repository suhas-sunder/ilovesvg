import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const playwright = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browserName = process.env.CONVERSION_BROWSER || "chromium";
const out = path.resolve(process.env.CONVERSION_OUT || `tmp/phase3/conversion-corpus-${browserName}`);
const bases = {
  foundation: process.env.FOUNDATION_URL || "http://127.0.0.1:5300",
  phase1: process.env.PHASE1_URL || "http://127.0.0.1:5301",
  candidate: process.env.BASE_URL || "http://127.0.0.1:5302",
};
const requested = (env, values) => env?.split(",") || values;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const white = '<rect width="100%" height="100%" fill="#fff"/>';
const makeSvg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`;
const fineLabel = (fill) => `<g fill="${fill}" font-family="sans-serif"><text x="12" y="30" font-size="20">TINY PRINT</text><text x="12" y="49" font-size="10">Sphinx of black quartz</text><text x="12" y="64" font-size="7">A4b8 / pencil thin lettering</text></g>`;
const illustration = '<path fill="#173451" d="M10 130Q85 30 150 123T285 100V190H10Z"/><circle cx="227" cy="57" r="39" fill="#f99e37"/><path fill="#69a99e" d="M10 151Q85 77 143 152T285 137V190H10Z"/><path fill="#ec594f" d="M105 143l30 18 32-18-15 25h-31z"/>';
const layers = '<circle cx="99" cy="94" r="74" fill="#1357ad"/><circle cx="171" cy="106" r="74" fill="#e74c24" fill-opacity=".77"/><path fill="#f4c849" d="M88 47H225V146H88ZM121 72V116H191V72Z" fill-rule="evenodd"/><path d="M47 164L179 65" fill="none" stroke="#222034" stroke-width="2"/>';
const colors = ["#043952", "#1692a3", "#2be7ab", "#ed6464", "#eab829", "#ffe1a3", "#603563", "#a660cc"];
const pattern = Array.from({ length: 196 }, (_, i) => {
  const x = i % 14 * 22;
  const y = Math.floor(i / 14) * 16;
  const fill = colors[(i * 13 + Math.floor(i / 14) * 5) % colors.length];
  return `<ellipse cx="${x + 13}" cy="${y + 8}" rx="${10 + i % 11}" ry="${8 + i % 7}" fill="${fill}"/>`;
}).join("");

// The photo is the existing public example derivative. Every other input is
// independently synthesized here so the same bytes reach all three builds.
const cases = [
  { id: "simple-logo", width: 180, height: 130, body: `${white}<path d="M26 99L91 15L156 99H123L91 53L58 99Z"/><rect x="76" y="98" width="30" height="22"/>` },
  { id: "silhouette", route: "png", width: 210, height: 160, body: `${white}<path d="M14 135Q20 90 65 87Q30 36 91 68Q114 13 149 69Q193 73 193 115L155 115Q129 149 14 135ZM98 99a10 10 0 1 0 20 0a10 10 0 1 0 -20 0" fill-rule="evenodd"/>` },
  { id: "multicolor", width: 300, height: 200, preset: "Layered - Flat Color", body: illustration },
  { id: "transparent-icon", route: "png", width: 144, height: 144, preset: "Filled Layers - Separate Colors", body: '<circle cx="72" cy="72" r="62" fill="#43ab79" fill-opacity=".54"/><path d="M31 74L61 103L111 46" fill="none" stroke="#1544af" stroke-width="12" stroke-linecap="round"/>' },
  { id: "photograph", preset: "Photo Many Colors", source: "public/examples/output-inspection/blue-marble-source.jpg" },
  { id: "fine-lettering", route: "png", width: 230, height: 78, body: white + fineLabel("#11181f"), probe: "lettering" },
  { id: "thin-lines", width: 240, height: 150, body: white + [0.65, 1, 1.5, 2, 2.5, 3].map((stroke, i) => `<path d="M10 ${15 + i * 22}H220" fill="none" stroke="#10161f" stroke-width="${stroke}"/>`).join(""), probe: "lines" },
  { id: "pale-text", route: "png", width: 230, height: 78, body: `${white}${fineLabel("#e5e5e5")}<rect x="178" y="12" width="28" height="13" fill="#262626"/>`, probe: "lettering" },
  { id: "complex-background", width: 310, height: 226, preset: "Layered - Flat Color", body: white + pattern + '<path d="M50 176L154 26L267 170L203 157L154 207L93 153Z" stroke="#101420" stroke-width="4" fill="#f2f3ff"/>' },
  { id: "layered-artwork", route: "png", width: 245, height: 204, preset: "Filled Layers - Separate Colors", body: layers },
  { id: "large-input", route: "png", width: 4800, height: 3400, body: `${white}<g transform="scale(16 17)">${illustration}<path d="M14 16L289 178" stroke="#10161f" stroke-width="1"/></g>` },
  { id: "small-input", width: 8, height: 8, body: `${white}<path d="M1 1H7V6H5V7H1Z"/>` },
];

async function makeFixture(test) {
  const bytes = test.source
    ? await readFile(test.source)
    : await sharp(Buffer.from(makeSvg(test.width, test.height, test.body))).png().toBuffer();
  const ext = test.source ? ".jpg" : ".png";
  const filename = path.join(out, `${test.id}${ext}`);
  const metadata = await sharp(bytes).metadata();
  await writeFile(filename, bytes);
  return { ...test, filename, width: metadata.width, height: metadata.height, inputHash: hash(bytes), inputBytes: bytes.length };
}

function regionInk(data, width, height, region) {
  const [x1, y1, x2, y2] = region;
  let ink = 0;
  for (let y = y1; y < Math.min(height, y2); y++) {
    for (let x = x1; x < Math.min(width, x2); x++) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3] / 255;
      if ((255 - (data[index] + data[index + 1] + data[index + 2]) / 3) * alpha > 9) ink++;
    }
  }
  return ink;
}

async function compareRendered(input, output) {
  const full = await sharp(output).metadata();
  const width = Math.min(input.width, 350);
  const height = Math.max(1, Math.round(input.height * width / input.width));
  const resize = value => sharp(value).resize(width, height, { fit: "fill" }).ensureAlpha().raw().toBuffer();
  const [source, result] = await Promise.all([resize(input.filename), resize(output)]);
  const bbox = [width, height, -1, -1];
  let sourceAlpha = 0, resultAlpha = 0, translucentResult = 0, sumRgb = 0, sumAlpha = 0;
  for (let i = 0; i < result.length; i += 4) {
    const before = source[i + 3];
    const after = result[i + 3];
    sourceAlpha += before > 0;
    resultAlpha += after > 0;
    translucentResult += after > 0 && after < 255;
    sumAlpha += Math.abs(before - after);
    for (let channel = 0; channel < 3; channel++) {
      const onWhite = (color, alpha) => 255 - (255 - color) * alpha / 255;
      sumRgb += Math.abs(onWhite(source[i + channel], before) - onWhite(result[i + channel], after));
    }
    if ((255 - Math.min(...result.subarray(i, i + 3))) * after / 255 <= 15) continue;
    const x = i / 4 % width;
    const y = Math.floor(i / 4 / width);
    bbox[0] = Math.min(bbox[0], x);
    bbox[1] = Math.min(bbox[1], y);
    bbox[2] = Math.max(bbox[2], x);
    bbox[3] = Math.max(bbox[3], y);
  }
  assert.ok(bbox[2] >= 0 && bbox[3] >= 0, `${input.id}: downloaded SVG contains visible artwork`);
  const regions = input.probe === "lines"
    ? Array.from({ length: 6 }, (_, i) => [7, 11 + i * 22, 224, 19 + i * 22])
    : input.probe === "lettering" ? [[10, 10, 170, 34], [10, 36, 170, 52], [10, 52, 170, 67]] : [];
  return {
    intrinsicSize: [full.width, full.height],
    rasterSample: [width, height],
    rasterHash: hash(result),
    inkBounds: bbox,
    nonzeroAlpha: { source: sourceAlpha, result: resultAlpha, translucentResult },
    alphaMAE: +(sumAlpha / (width * height)).toFixed(3),
    compositedRGBMAE: +(sumRgb / (width * height * 3)).toFixed(3),
    inkRegions: regions.map(region => ({ region, source: regionInk(source, width, height, region), result: regionInk(result, width, height, region) })),
  };
}

async function browserMetrics(page) {
  return page.evaluate(() => ({
    liveWorkers: window.conversionProbe.workers.size,
    liveURLs: window.conversionProbe.urls.size,
    workersCreated: window.conversionProbe.workersCreated,
    urlsCreated: window.conversionProbe.urlsCreated,
    decodedBitmaps: window.conversionProbe.bitmapsCreated,
    liveBitmaps: window.conversionProbe.bitmaps.size,
  }));
}

async function run(browser, build, base, input) {
  const url = new URL(base);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  const routePath = input.route === "png" ? "/png-to-svg-converter" : "/";
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  const posts = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (request.method() !== "POST" || new URL(request.url()).origin !== url.origin) return;
    const body = request.postData() || "";
    posts.push({ path: new URL(request.url()).pathname, preset: body.match(/name="presetId"\r?\n\r?\n([^\r\n]+)/)?.[1] || null });
  });
  await context.route("**/*", route => new URL(route.request().url()).origin === url.origin ? route.continue() : route.abort());
  await page.addInitScript(() => {
    const probe = window.conversionProbe = {
      workers: new Set(), urls: new Set(), bitmaps: new Set(),
      workersCreated: 0, urlsCreated: 0, bitmapsCreated: 0,
    };
    window.__ILOVESVG_HYBRID_TRACE_DEBUG__ = [];
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        probe.workers.add(this);
        probe.workersCreated++;
      }
      terminate() {
        probe.workers.delete(this);
        return super.terminate();
      }
    };
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      const value = create(blob);
      probe.urls.add(value);
      probe.urlsCreated++;
      return value;
    };
    URL.revokeObjectURL = value => {
      probe.urls.delete(value);
      return revoke(value);
    };
    if (typeof createImageBitmap === "function") {
      const decode = window.createImageBitmap.bind(window);
      window.createImageBitmap = async (...args) => {
        const bitmap = await decode(...args);
        probe.bitmaps.add(bitmap);
        probe.bitmapsCreated++;
        const close = bitmap.close.bind(bitmap);
        bitmap.close = () => {
          probe.bitmaps.delete(bitmap);
          close();
        };
        return bitmap;
      };
    }
  });

  try {
    await page.goto(new URL(routePath, url).href, { waitUntil: "networkidle" });
    await page.waitForFunction(() => Object.keys(document.querySelector('input[type="file"]') || {})
      .some(key => key.startsWith("__reactProps$")));
    if (input.preset) {
      await page.getByRole("button", { name: /^Show \d+ more presets/i }).click();
      const search = page.getByRole("searchbox", { name: "Search presets", exact: true });
      await search.fill(input.preset);
      const escaped = input.preset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      await page.getByRole("button", { name: new RegExp(`^${escaped}(?:\\.|$)`, "i") }).first().click();
    }
    const begin = performance.now();
    await page.locator('input[type="file"]').first().setInputFiles(input.filename);
    const downloadButton = page.getByRole("button", { name: "Download SVG", exact: true }).first();
    await downloadButton.waitFor({ timeout: 65_000 });
    const readyMs = Math.round(performance.now() - begin);
    const card = page.locator("[data-output-stamp]").filter({ has: downloadButton }).first();
    if (input.preset) assert.match(await card.innerText(), new RegExp(input.preset));
    const cardData = await card.evaluate(element => ({ ...element.dataset }));
    const image = card.getByRole("img", { name: /SVG result/ }).first();
    const preview = await image.evaluate(async element => {
      await element.decode();
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(element.naturalWidth, 480);
      canvas.height = Math.max(1, Math.round(element.naturalHeight * canvas.width / element.naturalWidth));
      canvas.getContext("2d").drawImage(element, 0, 0, canvas.width, canvas.height);
      const pixels = canvas.toDataURL().split(",")[1];
      const response = await fetch(element.currentSrc);
      return {
        rendered: [element.naturalWidth, element.naturalHeight],
        svg: await response.text(),
        pixels,
      };
    });
    await writeFile(path.join(out, `${build}-${input.id}-preview.png`), Buffer.from(preview.pixels, "base64"));
    const [download] = await Promise.all([page.waitForEvent("download"), downloadButton.click()]);
    assert.equal(await download.failure(), null);
    const target = path.join(out, `${build}-${input.id}.svg`);
    await download.saveAs(target);
    const bytes = await readFile(target);
    assert.match(bytes.toString(), /<svg\b/);
    assert.match(bytes.toString(), /<path\b/);
    assert.doesNotMatch(bytes.toString(), /<image\b/);
    const info = await page.evaluate(svg => {
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      if (doc.querySelector("parsererror")) throw new Error("Invalid exported SVG XML");
      const root = doc.documentElement;
      const paths = [...doc.querySelectorAll("path")];
      const groups = [...doc.querySelectorAll("g")];
      return {
        viewBox: root.getAttribute("viewBox"),
        paths: paths.length,
        subpaths: paths.reduce((sum, node) => sum + (node.getAttribute("d")?.match(/[mM]/g)?.length || 0), 0),
        groupedPathCounts: groups.map(group => group.querySelectorAll("path").length),
        fills: [...new Set([...doc.querySelectorAll("[fill]")].map(node => node.getAttribute("fill")))].sort(),
        opacities: [...new Set([...doc.querySelectorAll("[opacity], [fill-opacity]")].flatMap(node =>
          [node.getAttribute("opacity"), node.getAttribute("fill-opacity")].filter(Boolean)))].sort(),
      };
    }, bytes.toString());
    const render = await compareRendered(input, bytes);
    const previewRender = await compareRendered(input, Buffer.from(preview.svg));
    assert.equal(render.rasterHash, previewRender.rasterHash, "actual SVG preview and download pixels must match");
    assert.ok(preview.rendered.every(side => side > 0));
    // WebKit can report density-adjusted intrinsic size for a large SVG image.
    // Compare aspect ratio within one raster rounding pixel and independently
    // require the actual SVG preview markup to render like the download.
    const [previewWidth, previewHeight] = preview.rendered;
    const [exportWidth, exportHeight] = render.intrinsicSize;
    assert.ok(Math.abs(previewHeight - previewWidth * exportHeight / exportWidth) <= 1);

    if (build === "candidate") {
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, `page-${input.id}.png`), animations: "disabled" });
    }
    const debug = await page.evaluate(() => window.__ILOVESVG_HYBRID_TRACE_DEBUG__.map(({ stage, presetId, engineUsed }) => ({ stage, presetId, engineUsed })));
    const beforeExit = await browserMetrics(page);
    await page.getByRole("navigation", { name: "Footer", exact: true }).getByRole("link", { name: "How it works", exact: true }).click();
    await page.waitForURL(new URL("/how-it-works", url).href);
    await page.locator("[data-output-stamp]").first().waitFor({ state: "detached" });
    await page.waitForFunction(() => window.conversionProbe && window.conversionProbe.workers.size === 0 &&
      window.conversionProbe.bitmaps.size === 0 && window.conversionProbe.urls.size === 0, undefined, { timeout: 5000 });
    const afterExit = await browserMetrics(page);
    assert.deepEqual(errors, []);
    return {
      status: "pass", build, input: input.id, inputSize: [input.width, input.height], inputHash: input.inputHash, inputBytes: input.inputBytes,
      route: routePath, preset: input.preset || "route default", engine: cardData.engineUsed, requestedPalette: cardData.requestedPaletteCount || null,
      layerMode: cardData.layerBuildMode || null, timings: cardData.outputTimings ? JSON.parse(cardData.outputTimings) : null, readyMs,
      downloadBytes: bytes.length, downloadHash: hash(bytes), filename: download.suggestedFilename(), previewHash: hash(preview.svg),
      samePreviewBytes: hash(preview.svg) === hash(bytes), screenshotPreviewHash: hash(Buffer.from(preview.pixels, "base64")),
      browserPreviewIntrinsicSize: preview.rendered,
      info, render, posts, debug, cleanup: { beforeExit, afterExit },
    };
  } catch (error) {
    await page.screenshot({ path: path.join(out, `${build}-${input.id}-failure.png`) }).catch(() => {});
    return { status: "fail", build, input: input.id, route: routePath, failure: error.message, errors, posts };
  } finally {
    await context.close();
  }
}

const browser = await playwright[browserName].launch();
const results = [];
try {
  await mkdir(out, { recursive: true });
  const engineVersion = browser.version();
  const testedBuilds = requested(process.env.CONVERSION_BUILDS, Object.keys(bases));
  const inputs = await Promise.all(cases.filter(test => requested(process.env.CONVERSION_INPUTS, cases.map(item => item.id)).includes(test.id)).map(makeFixture));
  assert.ok(inputs.length);
  for (const input of inputs) {
    for (const build of testedBuilds) {
      const result = await run(browser, build, bases[build], input);
      results.push(result);
      console.log(JSON.stringify({ build, input: input.id, status: result.status, engine: result.engine, ms: result.readyMs, failure: result.failure }));
    }
  }
  const comparisons = inputs.map(input => {
    const sameInput = results.filter(row => row.input === input.id && row.status === "pass");
    const distinct = field => new Set(sameInput.map(field)).size;
    return {
      input: input.id, successfulBuilds: sameInput.length,
      sameInput: distinct(row => row.inputHash) === 1,
      sameSVG: distinct(row => row.downloadHash) === 1,
      sameBrowserPreviewPixels: distinct(row => row.screenshotPreviewHash) === 1,
      sameRestoredPixels: distinct(row => row.render.rasterHash) === 1,
      sameStructure: distinct(row => JSON.stringify(row.info)) === 1,
      sameEngine: distinct(row => row.engine) === 1,
      cleanupURLs: Object.fromEntries(sameInput.map(row => [row.build, row.cleanup.afterExit.liveURLs])),
    };
  });
  await writeFile(path.join(out, "report.json"), JSON.stringify({ browser: browserName, engineVersion, bases, results, comparisons }, null, 2) + "\n");
  assert.deepEqual(results.filter(result => result.status !== "pass"), []);
  assert.ok(comparisons.every(row => row.successfulBuilds === testedBuilds.length && row.sameInput && row.sameSVG &&
    row.sameBrowserPreviewPixels && row.sameRestoredPixels && row.sameStructure && row.sameEngine),
  "download, preview, geometry and engine must preserve same-browser baseline parity");
} finally {
  await browser.close();
}
