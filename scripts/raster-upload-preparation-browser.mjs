import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import ts from "typescript";

// Browser tooling is intentionally optional; no production dependency is added.
const playwright = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : "playwright");
const source = await fs.readFile(new URL("../app/client/lib/converter/prepareRasterUpload.ts", import.meta.url), "utf8");
const moduleCode = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const image = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="9000" height="120"><path fill="#bb3300" d="M100 20H6000V100H100Z"/><circle fill="#0088cc" cx="7500" cy="60" r="35"/></svg>');
const png = await sharp(image).png().toBuffer();
const jpg = await sharp(image).flatten({ background: "white" }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
const small = await sharp(image).resize(300, 4).png().toBuffer();
const outDir = process.env.RASTER_BROWSER_REPORT_DIR || path.join(os.tmpdir(), "ilovesvg-raster-browser");
await fs.mkdir(outDir, { recursive: true });
const report = [];

for (const browserName of (process.env.RASTER_BROWSERS || "chromium,firefox,webkit").split(",")) {
  const executablePath = process.env[`RASTER_${browserName.toUpperCase()}_EXECUTABLE`];
  const browser = await playwright[browserName].launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    for (const mobile of browserName === "firefox" ? [false] : [false, true]) {
      const context = await browser.newContext(mobile ? { ...playwright.devices["iPhone 13"], browserName: undefined } : { viewport: { width: 1280, height: 900 } });
      try {
        const page = await context.newPage();
        await page.goto("about:blank");
        const result = await page.evaluate(async ({ moduleCode, png, jpg, small }) => {
          const url = URL.createObjectURL(new Blob([moduleCode], { type: "text/javascript" }));
          const module = await import(url);
          URL.revokeObjectURL(url);
          const file = (base64, type) => new File([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], "fixture", { type });
          let decodes = 0;
          const originalDecode = globalThis.createImageBitmap;
          if (originalDecode) globalThis.createImageBitmap = (...args) => { decodes++; return originalDecode(...args); };
          const normal = file(small, "image/png");
          const unchanged = await module.prepareRasterUpload(normal);
          const decodesForNormal = decodes;
          const dangerousBytes = Uint8Array.from(atob(png), c => c.charCodeAt(0));
          const dangerousView = new DataView(dangerousBytes.buffer);
          dangerousView.setUint32(16, 100000); dangerousView.setUint32(20, 100000);
          let unsafeRejected = false;
          try { await module.prepareRasterUpload(new File([dangerousBytes], "huge.png", { type: "image/png" })); } catch (error) { unsafeRejected = /memory/.test(error.message); }
          const unsafeDecodeCount = decodes;
          const oversized = await module.prepareRasterUpload(file(png, "image/png"));
          const rotated = await module.prepareRasterUpload(file(jpg, "image/jpeg"));
          let releaseDecode, notifyStarted;
          const started = new Promise(resolve => { notifyStarted = resolve; });
          globalThis.createImageBitmap = () => new Promise(resolve => { releaseDecode = resolve; });
          const held = module.prepareRasterUpload(file(png, "image/png"), notifyStarted);
          await started;
          let concurrentRejected = false;
          try { await module.prepareRasterUpload(file(png, "image/png")); } catch (error) { concurrentRejected = /Another large image/.test(error.message); }
          releaseDecode(await originalDecode(file(png, "image/png")));
          await held;
          // Force the Safari-compatible HTML image path too, independently of bitmap support.
          globalThis.createImageBitmap = undefined;
          const htmlImage = await module.prepareRasterUpload(file(png, "image/png"));
          globalThis.createImageBitmap = originalDecode;
          let unsupported;
          try { await module.prepareRasterUpload(new File([new Uint8Array([0x49, 0x49, 0x2a, 0])], "photo.DNG", { type: "image/x-adobe-dng" })); } catch (error) { unsupported = error.message; }
          const bitmap = await originalDecode(oversized.file);
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width; canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d"); ctx.drawImage(bitmap, 0, 0); bitmap.close();
          const transparent = [...ctx.getImageData(0, 0, 1, 1).data];
          const red = [...ctx.getImageData(200, 50, 1, 1).data];
          const encoded = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(",")[1]); reader.readAsDataURL(oversized.file); });
          return { unchanged: unchanged.file === normal, decodesForNormal, unsafeRejected, unsafeDecodeCount, concurrentRejected, header: oversized.header, rotated: rotated.header, htmlHeader: htmlImage.header, transparent, red, mime: oversized.file.type, encoded, unsupported };
        }, { moduleCode, png: png.toString("base64"), jpg: jpg.toString("base64"), small: small.toString("base64") });
        assert.equal(result.unchanged, true);
        assert.equal(result.decodesForNormal, 0);
        assert.equal(result.unsafeRejected, true);
        assert.equal(result.unsafeDecodeCount, 0, "dangerous decoded pixels rejected before browser decode");
        assert.equal(result.concurrentRejected, true, "concurrent oversized decode refused");
        assert.deepEqual(result.header, { width: 8000, height: 106, mime: "image/png" });
        assert.deepEqual(result.htmlHeader, result.header);
        assert.deepEqual(result.rotated, { width: 106, height: 8000, mime: "image/png" });
        assert.equal(result.transparent[3], 0, "transparent background stays transparent");
        assert.deepEqual(result.red, [187, 51, 0, 255], "interior color retained");
        assert.match(result.unsupported, /ProRAW\/DNG/);
        const actual = await sharp(Buffer.from(result.encoded, "base64")).raw().toBuffer();
        const baseline = await sharp(png).resize(8000, 106).raw().toBuffer();
        const mae = actual.reduce((sum, byte, i) => sum + Math.abs(byte - baseline[i]), 0) / actual.length;
        assert.ok(mae < 2, `raster fidelity MAE ${mae} < 2 against independent Sharp normalized baseline`);
        report.push({ browser: browserName, mobileEmulation: mobile, ...result, encoded: undefined, meanAbsoluteChannelDifference: mae, status: "PASS" });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ report: path.join(outDir, "report.json"), results: report }, null, 2));
