import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import ts from "typescript";

const temp = await fs.mkdtemp(path.join(os.tmpdir(), "ilovesvg-raster-admission-"));
const modulePath = path.join(temp, "prepareRasterUpload.mjs");
try {
  const source = await fs.readFile(new URL("../app/client/lib/converter/prepareRasterUpload.ts", import.meta.url), "utf8");
  await fs.writeFile(modulePath, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText);
  const { parseRasterHeader, readRasterHeader, planRasterNormalization, prepareRasterUpload } = await import(pathToFileURL(modulePath).href);
  const mib = 1024 * 1024;
  for (const format of ["png", "jpeg", "webp"]) {
    const input = await sharp({ create: { width: 200, height: 100, channels: 4, background: { r: 10, g: 80, b: 170, alpha: 0.5 } } })[format]().toBuffer();
    assert.deepEqual(parseRasterHeader(input), { width: 200, height: 100, mime: `image/${format}` });
    const file = new File([input], `fixture.${format}`, { type: `image/${format}` });
    const prepared = await prepareRasterUpload(file);
    assert.equal(prepared.file, file, "supported input retains exact original object/bytes, with no browser decode or recompression");
    assert.equal(prepared.normalized, false);
  }
  for (const orientation of [1, 3, 6, 8]) {
    const jpeg = await sharp({ create: { width: 200, height: 100, channels: 3, background: "red" } }).jpeg().withMetadata({ orientation }).toBuffer();
    const header = parseRasterHeader(jpeg);
    assert.equal(header.width, orientation >= 5 ? 100 : 200);
    assert.equal(header.height, orientation >= 5 ? 200 : 100);
  }
  const header = (width, height) => ({ width, height, mime: "image/png" });
  assert.equal(planRasterNormalization(header(6000, 5000), 30 * mib, false), null, "exact 30MP/30MiB boundary retains original");
  assert.equal(planRasterNormalization(header(8000, 1), 1, true), null, "exact max-side retains original");
  for (const mobile of [false, true]) {
    for (const original of [header(8001, 100), header(100, 8001), header(6001, 5000), header(1, 1)]) {
      const bytes = original.width === 1 ? 30 * mib + 1 : 1000;
      const target = planRasterNormalization(original, bytes, mobile);
      assert.ok(target.width <= original.width && target.height <= original.height, "never upscale");
      assert.ok(target.width <= 8000 && target.height <= 8000, "longest side bounded");
      assert.ok(target.width * target.height <= (mobile ? 6 : 12) * 1e6, "target pixel budget bounded");
      assert.ok(Math.abs(target.width / target.height - original.width / original.height) < Math.max(0.01, original.width / original.height * 0.02), "aspect ratio preserved to integer pixel rounding");
    }
    assert.throws(() => planRasterNormalization(header(8000, 8000), 1000, mobile), /memory/);
    assert.throws(() => planRasterNormalization(header(100, 100), 64 * mib + 1, mobile), /64 MB/);
  }
  assert.throws(() => parseRasterHeader(new Uint8Array([0x49, 0x49, 0x2a, 0x00])), /ProRAW\/DNG/);
  assert.throws(() => parseRasterHeader(new Uint8Array([0xff, 0xd8, 0xff, 0xe1])), /dimensions/);
  assert.throws(() => parseRasterHeader(new Uint8Array()), /PNG, JPEG, or WebP/);
  await assert.rejects(readRasterHeader(new Blob()), /too large/);
  let headerRead = false;
  await assert.rejects(readRasterHeader({ size: 64 * mib + 1, slice() { headerRead = true; throw new Error("should not read"); } }), /64 MB/);
  assert.equal(headerRead, false, "oversized original rejected before allocation or header read");
  console.log("PASS raster header, EXIF, admission boundaries, no-recompression, unsafe-input rejection");
} finally {
  await fs.unlink(modulePath).catch(() => {});
  await fs.rmdir(temp);
}
