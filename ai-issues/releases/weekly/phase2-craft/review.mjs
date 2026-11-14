import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const target = process.argv[2] ?? "craft";
assert.ok(["craft", "background"].includes(target));
const craft = target === "craft";
const path = craft ? "/png-to-svg-for-cricut" : "/svg-background-editor";
const heading = craft ? "Check the paths before you cut" : "Try it with the built-in example";
const base = new URL(process.env.BASE_URL ?? (craft ? "http://127.0.0.1:5286" : "http://127.0.0.1:5287"));
const baseline = new URL(process.env.BASELINE_URL ?? "http://127.0.0.1:5280");
const output = process.env.REVIEW_OUTPUT ?? fileURLToPath(new URL(`../phase2-${target}/browser/`, import.meta.url));
const playwright = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const report = { target, path, base: base.href, baseline: baseline.href, layout: [], workflows: [], failures: [] };
const widths = [320, 375, 390, 430, 768, 1024, 1440];
const cutFixture = "/examples/output-inspection/cut-mark-source.png";
await mkdir(output, { recursive: true });

function structure() {
  const faq = [...document.querySelectorAll('[itemtype="https://schema.org/Question"]')].map(question => ({
    q: question.querySelector('[itemprop="name"]')?.textContent.trim(),
    a: question.querySelector('[itemprop="text"]')?.textContent.trim(),
  }));
  const data = [...document.querySelectorAll('script[type="application/ld+json"]')].map(node => JSON.parse(node.textContent));
  const faqJson = data.find(item => item["@type"] === "FAQPage");
  return {
    metadata: {
      title: document.title,
      canonical: [...document.querySelectorAll('link[rel="canonical"]')].map(node => node.href),
      tags: [...document.head.querySelectorAll('meta[name="description"],meta[name="robots"],meta[name="viewport"],meta[name="theme-color"],meta[property^="og:"],meta[name^="twitter:"]')].map(node => [
        node.name || node.getAttribute("property"),
        node.content,
      ]),
    },
    schema: {
      nonFaqJsonLd: data.filter(item => item["@type"] !== "FAQPage"),
      microdata: [...new Set([...document.querySelectorAll("[itemtype]")].map(node => node.getAttribute("itemtype")))].sort(),
      faqJson: Boolean(faqJson),
      faq: faqJson ? faqJson.mainEntity.map(item => ({
        q: item.name,
        a: item.acceptedAnswer.text,
      })) : faq,
    },
    viewport: {
      inner: innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    },
    adSlots: [...document.querySelectorAll("ins.adsbygoogle")].map(node => node.dataset.adSlot).sort(),
    h1: [...document.querySelectorAll("h1")].map(node => node.textContent.trim()),
  };
}

async function readDocument(engine, origin) {
  const response = await fetch(new URL(path, origin), { headers: { accept: "text/html" } });
  assert.equal(response.status, 200);
  const context = await engine.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.setContent(await response.text(), { waitUntil: "domcontentloaded" });
    return { data: await page.evaluate(structure), robots: response.headers.get("x-robots-tag") };
  } finally {
    await context.close();
  }
}

async function verifyLayout(page, width, expected, engineName) {
  const response = await page.goto(new URL(path, base).href, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  assert.equal(response.headers()["x-robots-tag"] ?? null, expected.robots);
  const section = page.getByRole("heading", { name: heading, exact: true });
  await section.waitFor();
  await section.evaluate(node => node.scrollIntoView({ block: "start" }));
  if (craft) {
    const figure = page.locator("figure").filter({ has: page.getByRole("link", { name: "Download source PNG", exact: true }) });
    assert.equal(await figure.count(), 1);
    await figure.evaluate(node => node.scrollIntoView({ block: "center" }));
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll('figure img[src*="cut-mark-"]')];
      return images.length === 2 && images.every(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0 && image.width > 0 && image.height > 0);
    }, null, { timeout: 5000 });
    assert.deepEqual(await figure.getByRole("img").evaluateAll(images => images.map(image => [image.getAttribute("width"), image.getAttribute("height")])), [["320", "240"], ["320", "240"]]);
    assert.equal(await figure.getByRole("link", { name: "Download source PNG" }).getAttribute("href"), cutFixture);
    assert.equal(await figure.getByRole("link", { name: "Download traced SVG" }).getAttribute("href"), "/examples/output-inspection/cut-mark-traced.svg");
  }
  const actual = await page.evaluate(structure);
  assert.deepEqual(actual.metadata, expected.data.metadata);
  assert.deepEqual(actual.h1, expected.data.h1);
  assert.equal(actual.h1.length, 1);
  assert.deepEqual(actual.schema.nonFaqJsonLd, expected.data.schema.nonFaqJsonLd);
  assert.deepEqual(actual.schema.microdata, expected.data.schema.microdata);
  assert.equal(actual.schema.faqJson, expected.data.schema.faqJson);
  const questions = actual.schema.faq;
  assert.ok(questions.length > 0 && questions.every(item => item.q && item.a));
  assert.equal(new Set(questions.map(item => item.q)).size, questions.length);
  const visibleText = await page.locator("body").innerText();
  for (const item of questions) {
    assert.ok(visibleText.includes(item.q), `Missing visible question: ${item.q}`);
    if (craft) assert.ok(visibleText.includes(item.a), `Missing visible answer: ${item.q}`);
  }
  if (!craft) {
    for (const item of questions) {
      const details = page.locator("details").filter({ hasText: item.q });
      assert.equal(await details.count(), 1);
      assert.ok((await details.textContent()).includes(item.a), `Missing expandable answer: ${item.q}`);
    }
  }
  assert.equal(actual.viewport.inner, width);
  assert.equal(actual.viewport.document, width);
  assert.equal(actual.viewport.body, width);
  await section.evaluate(node => node.scrollIntoView({ block: "start" }));
  const screenshot = `${engineName}-${width}.jpg`;
  await page.screenshot({ path: join(output, screenshot), quality: 82 });
  report.layout.push({ engineName, width, screenshot, ...actual });
}

async function upload(page, name, mimeType, buffer) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByLabel("Click or drag a file", { exact: true }).click(),
  ]);
  await chooser.setFiles({ name, mimeType, buffer });
}

async function save(page, button, name) {
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  const file = join(output, name);
  await download.saveAs(file);
  return readFile(file);
}

async function inspectSvg(page, buffer) {
  const geometry = await page.evaluate(svg => {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    assertSvg(doc);
    function assertSvg(document) {
      if (document.documentElement.localName !== "svg" || document.querySelector("parsererror")) {
        throw Error("Invalid SVG output");
      }
    }
    const paths = [...doc.querySelectorAll("path")];
    return {
      viewBox: doc.documentElement.getAttribute("viewBox"),
      paths: paths.length,
      subpaths: paths.reduce((sum, node) => sum + (node.getAttribute("d")?.match(/[Mm]/g)?.length ?? 0), 0),
      rects: [...doc.querySelectorAll("rect")].map(rect => [rect.getAttribute("fill"), rect.getAttribute("width"), rect.getAttribute("height")]),
      circles: [...doc.querySelectorAll("circle")].map(circle => ["cx", "cy", "r", "fill"].map(name => circle.getAttribute(name))),
      images: doc.querySelectorAll("image").length,
    };
  }, buffer.toString("utf8"));
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    ...geometry,
    width: info.width,
    height: info.height,
    corner: [...data.subarray(0, 4)],
    center: [...data.subarray((Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * 4, (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * 4 + 4)],
    sampleAlpha: craft ? [[100, 100], [44, 100], [205, 100], [278, 176]].map(([x, y]) => data[(y * info.width + x) * 4 + 3]) : [],
  };
}

async function verifyCraft(page, engineName) {
  const response = await fetch(new URL(cutFixture, base));
  assert.equal(response.status, 200);
  const source = Buffer.from(await response.arrayBuffer());
  await upload(page, "cut-mark-source.png", "image/png", source);
  const current = page.locator("[data-output-stamp]").first();
  const download = current.getByRole("button", { name: "Download Cricut SVG", exact: true });
  const read = async name => inspectSvg(page, await save(page, download, `${engineName}-${name}.svg`));
  const initial = await read("clean");
  assert.equal(initial.viewBox, "0 0 320 240");
  assert.equal(initial.images, 0);
  assert.equal(initial.paths, 1);
  assert.equal(initial.subpaths, 3);
  assert.deepEqual(initial.rects, []);
  assert.deepEqual(initial.sampleAlpha, [0, 255, 255, 255]);
  await page.getByRole("button", { name: /Show \d+ more presets/ }).click();
  const darkButton = page.getByRole("button", { name: /^White Vinyl.*Dark Preview\./i });
  await darkButton.click();
  await current.getByText(/White Vinyl.*Dark Preview/i).first().waitFor();
  const dark = await read("dark");
  assert.deepEqual(dark.rects, [["#0b1020", "320", "240"]]);
  assert.deepEqual(dark.corner, [11, 16, 32, 255]);
  await current.getByRole("button", { name: "Settings / Edit" }).click();
  const appearance = page.getByRole("button", { name: "Appearance", exact: true }).last();
  if ((await appearance.getAttribute("aria-expanded")) === "false") await appearance.click();
  await page.getByRole("checkbox", { name: "Invert line art", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "Transparent background", exact: true }).check();
  await page.getByRole("button", { name: "Update preview", exact: true }).filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Done editing", exact: true }).click();
  const recovered = await read("recovered");
  assert.deepEqual(recovered.rects, []);
  assert.deepEqual(recovered.sampleAlpha, [0, 255, 255, 255]);
  assert.equal(recovered.subpaths, 3);
  await download.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(output, `${engineName}-workflow.jpg`), quality: 82 });
  return { initial, dark, recovered };
}

async function verifyBackground(page, engineName) {
  await page.getByRole("button", { name: "Paste SVG Example" }).click();
  const preview = page.getByAltText("Output SVG preview", { exact: true });
  await preview.waitFor();
  const previewSrc = await preview.getAttribute("src");
  const checker = page.getByText("Checkerboard", { exact: true }).locator("..").getByRole("checkbox");
  await checker.uncheck();
  assert.equal(await preview.getAttribute("src"), previewSrc);
  await checker.check();
  const download = page.getByRole("button", { name: "Download SVG", exact: true });
  const removed = await save(page, download, `${engineName}-transparent.svg`);
  const transparent = await inspectSvg(page, removed);
  assert.equal(transparent.viewBox, "0 0 120 120");
  assert.deepEqual(transparent.rects, []);
  assert.deepEqual(transparent.circles, [["60", "60", "42", "#0b2dff"]]);
  assert.deepEqual(transparent.corner, [0, 0, 0, 0]);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await upload(page, "transparent.svg", "image/svg+xml", removed);
  await page.getByText(/No obvious background detected\./).waitFor();
  const mode = page.getByRole("combobox").filter({ has: page.locator('option[value="add"]') });
  await mode.selectOption("add");
  const addTransparency = page.getByRole("checkbox", { name: "Insert no background fill (keeps SVG transparent)" });
  if (await addTransparency.isChecked()) await addTransparency.uncheck();
  const added = await save(page, download, `${engineName}-opaque.svg`);
  const opaque = await inspectSvg(page, added);
  assert.deepEqual(opaque.rects, [["#ffffff", "120", "120"]]);
  assert.match(added.toString(), /<rect\b[^>]*data-ilovesvg-bg="1"[^>]*\/>\s*<circle/);
  assert.deepEqual(opaque.circles, transparent.circles);
  assert.deepEqual(opaque.center, transparent.center);
  assert.deepEqual(opaque.corner, [255, 255, 255, 255]);
  await preview.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(output, `${engineName}-workflow.jpg`), quality: 82 });
  return { transparent, opaque };
}

for (const engineName of ["chromium", "webkit"]) {
  const browser = await playwright[engineName].launch();
  try {
    const expected = await readDocument(browser, baseline);
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 920 }, acceptDownloads: true });
      await context.route("**/*", route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      const runtimeErrors = [];
      page.on("pageerror", error => runtimeErrors.push(error.message));
      try {
        await verifyLayout(page, width, expected, engineName);
        if (width === 390) {
          await page.reload({ waitUntil: "networkidle" });
          const result = craft ? await verifyCraft(page, engineName) : await verifyBackground(page, engineName);
          report.workflows.push({ engineName, width, ...result });
        }
        assert.deepEqual(runtimeErrors, []);
      } catch (error) {
        report.failures.push({ engineName, width, error: error.stack });
        console.error(engineName, width, error.message);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ target, layout: report.layout.length, workflows: report.workflows.length, failures: report.failures.length, output }));
if (report.failures.length) process.exitCode = 1;
