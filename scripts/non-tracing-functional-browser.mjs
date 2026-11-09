import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { inflateSync } from "node:zlib";
import { unzipSync } from "fflate";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const playwright = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const baseUrl = getSmokeBaseUrl();
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname), "Synthetic functional checks must use a local server");
const outDir = process.env.UTILITY_FUNCTIONAL_REPORT_DIR || path.join(os.tmpdir(), "ilovesvg-utility-functional-browser");
await fs.mkdir(outDir, { recursive: true });
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect x="10" y="10" width="50" height="45" fill="#bb3300"/><path d="M70 10L110 60" stroke="#003388" stroke-width="4"/></svg>';
const browser = await playwright.chromium.launch({ headless: true, ...(process.env.UTILITY_CHROMIUM_EXECUTABLE ? { executablePath: process.env.UTILITY_CHROMIUM_EXECUTABLE } : {}) });
const report = [];
const routes = (process.env.UTILITY_FUNCTIONAL_ROUTES || "svg-to-png-converter,svg-to-pdf-converter,svg-minifier,svg-resize-and-scale-editor,svg-to-favicon-generator,svg-to-jsx-converter,svg-to-base64").split(",");

async function download(page, button, filename) {
  const [event] = await Promise.all([page.waitForEvent("download", { timeout: 20_000 }), button.click()]);
  assert.equal(await event.failure(), null);
  const buffer = await fs.readFile(await event.path());
  await fs.writeFile(path.join(outDir, filename), buffer);
  return { buffer, filename: event.suggestedFilename(), bytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex") };
}

async function copy(page, button) {
  await button.click();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  assert.ok(text.length > 20, "Copy must produce actual clipboard contents");
  return text;
}

function pdfImagePixels(pdf, stream) {
  const width = Number(stream.dict.get(PDFName.of("Width")).toString());
  const height = Number(stream.dict.get(PDFName.of("Height")).toString());
  const params = stream.dict.lookup(PDFName.of("DecodeParms"), PDFDict);
  const channels = Number(params.get(PDFName.of("Colors")).toString());
  assert.equal(Number(params.get(PDFName.of("Predictor")).toString()), 11, "Expected the default lossless PDF PNG Sub predictor");
  const data = inflateSync(stream.contents);
  const stride = width * channels;
  assert.equal(data.length, height * (stride + 1));
  const result = Buffer.alloc(width * height * channels);
  for (let row = 0; row < height; row++) {
    assert.equal(data[row * (stride + 1)], 1);
    for (let column = 0; column < stride; column++) {
      result[row * stride + column] = (data[row * (stride + 1) + 1 + column] +
        (column >= channels ? result[row * stride + column - channels] : 0)) & 255;
    }
  }
  return { width, height, channels, data: result };
}

try {
  for (const width of [1280, 390]) {
    for (const route of routes) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 390, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await context.route("**/*", request => new URL(request.request().url()).origin === new URL(baseUrl).origin ? request.continue() : request.abort());
      const result = { route, width, ok: false };
      try {
        await page.goto(`${baseUrl}/${route}`);
        await page.waitForLoadState("networkidle");
        await page.waitForFunction(() => [...document.querySelectorAll('input[type="file"]')].some(input => Object.keys(input).some(key => key.startsWith("__reactProps"))));
        await page.locator('input[type="file"]').first().setInputFiles({ name: "synthetic.svg", mimeType: "image/svg+xml", buffer: Buffer.from(svg) });
        await page.waitForFunction(route => route === "svg-to-jsx-converter"
          ? document.querySelector('textarea[readonly]')?.value.includes("#bb3300")
          : document.body.innerText.includes("synthetic.svg"), route);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        if (route === "svg-to-png-converter") {
          const output = await download(page, page.getByRole("button", { name: "Download PNG", exact: true }), `${width}-export.png`);
          const meta = await sharp(output.buffer).metadata();
          assert.equal(meta.width, 120); assert.equal(meta.height, 80); assert.equal(meta.format, "png");
          const { data } = await sharp(output.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
          assert.equal(data[3], 0); assert.deepEqual([...data.subarray((20 * 120 + 20) * 4, (20 * 120 + 20) * 4 + 4)], [187, 51, 0, 255]);
          result.output = { bytes: output.bytes, sha256: output.sha256, width: meta.width, height: meta.height, alphaPreserved: true };
        } else if (route === "svg-to-pdf-converter") {
          await page.getByRole("button", { name: "Settings", exact: true }).click();
          await page.getByRole("button", { name: "Convert to PDF", exact: true }).click();
          const output = await download(page, page.getByRole("button", { name: "Download PDF", exact: true }), `${width}-export.pdf`);
          assert.equal(output.buffer.subarray(0, 5).toString(), "%PDF-");
          const pdf = await PDFDocument.load(output.buffer);
          assert.equal(pdf.getPageCount(), 1);
          assert.ok(pdf.getPage(0).getWidth() > 0 && pdf.getPage(0).getHeight() > 0);
          const images = pdf.getPage(0).node.Resources().lookup(PDFName.of("XObject"), PDFDict);
          const image = pdf.context.lookup(images.entries()[0][1]);
          const pixels = pdfImagePixels(pdf, image);
          assert.equal(pixels.width, 120); assert.equal(pixels.height, 80); assert.equal(pixels.channels, 3);
          assert.deepEqual([...pixels.data.subarray((20 * 120 + 20) * 3, (20 * 120 + 20) * 3 + 3)], [187, 51, 0], "PDF must contain actual source artwork pixels, not merely a valid blank page");
          result.output = { bytes: output.bytes, pages: pdf.getPageCount(), filename: output.filename, artworkPixelsVerified: true };
        } else if (route === "svg-minifier") {
          await page.getByRole("button", { name: /^Tiniest/ }).click();
          const output = await download(page, page.getByRole("button", { name: "Download Minified SVG", exact: true }), `${width}-minified.svg`);
          const text = output.buffer.toString(); assert.match(text, /<svg\b/);
          const actual = await sharp(output.buffer).resize(120, 80).ensureAlpha().raw().toBuffer();
          const expected = await sharp(Buffer.from(svg)).resize(120, 80).ensureAlpha().raw().toBuffer();
          assert.deepEqual(actual, expected, "Minified output must preserve rendered pixels");
          await page.getByText("Output SVG code", { exact: true }).click();
          const copied = await copy(page, page.getByRole("button", { name: "Copy SVG", exact: true }));
          assert.equal(copied, text);
          result.output = { bytes: output.bytes, sha256: output.sha256, copied: true, pixelIdentical: true };
        } else if (route === "svg-resize-and-scale-editor") {
          await page.getByRole("button", { name: "Settings", exact: true }).click();
          const input = page.getByText("Width", { exact: true }).locator("..").locator("input");
          await input.fill("240"); await input.press("Tab");
          const output = await download(page, page.getByRole("button", { name: "Download Resized SVG", exact: true }), `${width}-resized.svg`);
          const meta = await sharp(output.buffer).metadata();
          assert.equal(meta.width, 240); assert.equal(meta.height, 160);
          result.output = { bytes: output.bytes, width: meta.width, height: meta.height, aspectPreserved: true };
        } else if (route === "svg-to-favicon-generator") {
          await page.getByRole("button", { name: "Generate icons", exact: true }).click();
          const ico = await download(page, page.getByRole("button", { name: "Download .ico", exact: true }), `${width}-favicon.ico`);
          assert.equal(ico.buffer.readUInt16LE(0), 0); assert.equal(ico.buffer.readUInt16LE(2), 1);
          const icoEntries = ico.buffer.readUInt16LE(4); assert.ok(icoEntries >= 3);
          const zip = await download(page, page.getByRole("button", { name: "Download ZIP", exact: true }), `${width}-favicon.zip`);
          const files = unzipSync(zip.buffer); const pngs = Object.keys(files).filter(file => file.endsWith(".png")); assert.ok(pngs.length >= 5);
          for (const file of pngs) { const meta = await sharp(Buffer.from(files[file])).metadata(); assert.equal(meta.width, meta.height); assert.ok(meta.width >= 16); }
          assert.ok(Object.keys(files).some(file => file.endsWith(".ico")));
          result.output = { icoBytes: ico.bytes, icoEntries, zipBytes: zip.bytes, pngFiles: pngs.length };
        } else if (route === "svg-to-jsx-converter") {
          await page.getByLabel("Component name", { exact: true }).fill("FunctionalIcon");
          const output = await download(page, page.getByRole("button", { name: "Download TSX", exact: true }), `${width}-component.tsx`);
          const text = output.buffer.toString(); assert.match(text, /FunctionalIcon/); assert.match(text, /strokeWidth/); assert.match(text, /viewBox/);
          const copied = await copy(page, page.getByRole("button", { name: "Copy JSX", exact: true }));
          // Windows clipboard text uses CRLF; compare the actual code with only
          // that platform newline conversion normalized.
          assert.equal(copied.replace(/\r\n/g, "\n"), text.replace(/\r\n/g, "\n"));
          result.output = { bytes: output.bytes, sha256: output.sha256, copied: true, componentNameEdited: true };
        } else if (route === "svg-to-base64") {
          await page.getByRole("button", { name: "Settings", exact: true }).click();
          await page.locator("select").first().selectOption("base64-only");
          const output = await download(page, page.getByRole("button", { name: "Download Output", exact: true }), `${width}-base64.txt`);
          const text = output.buffer.toString(); const decoded = Buffer.from(text, "base64").toString(); assert.match(decoded, /<svg\b/); assert.match(decoded, /#bb3300/); assert.match(decoded, /stroke-width="4"/);
          assert.equal(await copy(page, page.getByRole("button", { name: "Copy Output", exact: true })), text);
          result.output = { bytes: output.bytes, sha256: output.sha256, copied: true, decodedGeometryPreserved: true };
        }
        assert.deepEqual(errors, [], "No application page/hydration exception is allowed");
        result.overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.ok(result.overflow <= 1);
        await page.screenshot({ path: path.join(outDir, `${width}-${route}.png`) });
        result.ok = true;
      } catch (error) {
        result.error = error.message;
        await page.screenshot({ path: path.join(outDir, `${width}-${route}-failed.png`) }).catch(() => {});
      } finally {
        report.push(result); console.log(JSON.stringify(result)); await context.close();
      }
    }
  }
} finally { await browser.close(); }
await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
assert.ok(report.every(result => result.ok), `${report.filter(result => !result.ok).length} functional checks failed; see ${outDir}`);
