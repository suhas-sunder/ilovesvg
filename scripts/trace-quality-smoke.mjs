import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import potrace from "potrace";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const vtracerRuntime = await import("wasm_vtracer/wasm_vtracer_bg.js");
await ensureVTracerReady();

const cases = [
  {
    name: "simple-logo",
    width: 96,
    height: 96,
    mode: "single",
    pixels: (x, y) => {
      const dx = x - 48;
      const dy = y - 48;
      return dx * dx + dy * dy < 28 * 28 ? [8, 24, 52, 255] : [255, 255, 255, 0];
    },
  },
  {
    name: "layered-color",
    width: 120,
    height: 90,
    mode: "layered",
    pixels: (x, y) => {
      if (x < 40) return [24, 128, 224, 255];
      if (x < 80) return [16, 176, 112, 255];
      return y < 45 ? [245, 158, 11, 255] : [220, 38, 38, 255];
    },
  },
  {
    name: "thin-lines",
    width: 128,
    height: 128,
    mode: "single",
    pixels: (x, y) => {
      const line = Math.abs(x - y) <= 1 || Math.abs(x + y - 127) <= 1;
      return line ? [0, 0, 0, 255] : [255, 255, 255, 0];
    },
  },
  {
    name: "low-contrast-edge",
    width: 96,
    height: 96,
    mode: "single",
    pixels: (x, y) => {
      const inside = x > 20 && x < 76 && y > 24 && y < 72;
      return inside ? [142, 152, 164, 255] : [205, 213, 224, 255];
    },
  },
  {
    name: "transparent-artwork",
    width: 100,
    height: 80,
    mode: "layered",
    pixels: (x, y) => {
      const body = x > 15 && x < 85 && y > 12 && y < 68;
      const hole = x > 38 && x < 62 && y > 28 && y < 52;
      if (!body || hole) return [255, 255, 255, 0];
      return x < 50 ? [14, 165, 233, 255] : [2, 132, 199, 255];
    },
  },
];

const metrics = [];

for (const fixture of cases) {
  const pixels = makeRgba(fixture.width, fixture.height, fixture.pixels);
  const vtracerSvg = traceWithVTracer(pixels, fixture.width, fixture.height, {
    layered: fixture.mode === "layered",
  });
  metrics.push(validateSvg(`${fixture.name}:vtracer`, vtracerSvg));
}

const potracePixels = makeRgba(96, 96, (x, y) => {
  const on = x > 20 && x < 76 && y > 24 && y < 72;
  return on ? [0, 0, 0, 255] : [255, 255, 255, 255];
});
const potraceSvg = await traceWithPotrace(potracePixels, 96, 96);
metrics.push(validateSvg("legacy-lineart:potrace", potraceSvg));

console.log(JSON.stringify({ checkedAt: new Date().toISOString(), metrics }, null, 2));

async function ensureVTracerReady() {
  try {
    if (vtracerRuntime.isReady()) return;
  } catch {
    // wasm_vtracer_bg.js throws before __wbg_set_wasm is called; initialize below.
  }

  const wasmUrl = import.meta.resolve("wasm_vtracer/wasm_vtracer_bg.wasm");
  const wasmBytes = await fs.readFile(fileURLToPath(wasmUrl));
  const imports = {
    "./wasm_vtracer_bg.js": {
      __wbindgen_object_drop_ref: vtracerRuntime.__wbindgen_object_drop_ref,
      __wbg_new_8a6f238a6ece86ea: vtracerRuntime.__wbg_new_8a6f238a6ece86ea,
      __wbg_stack_0ed75d68575b0f3c: vtracerRuntime.__wbg_stack_0ed75d68575b0f3c,
      __wbg_error_7534b8e9a36f1ab4: vtracerRuntime.__wbg_error_7534b8e9a36f1ab4,
      __wbg_Error_52673b7de5a0ca89: vtracerRuntime.__wbg_Error_52673b7de5a0ca89,
      __wbg___wbindgen_throw_dd24417ed36fc46e:
        vtracerRuntime.__wbg___wbindgen_throw_dd24417ed36fc46e,
    },
  };
  const result = await WebAssembly.instantiate(wasmBytes, imports);
  vtracerRuntime.__wbg_set_wasm(result.instance.exports);
  result.instance.exports.__wbindgen_start?.();
  vtracerRuntime.init();
}

function traceWithVTracer(pixels, width, height, options) {
  const config = new vtracerRuntime.TracerConfig();
  config.setColorMode(vtracerRuntime.ColorMode.Color);
  config.setHierarchical(
    options.layered
      ? vtracerRuntime.Hierarchical.Stacked
      : vtracerRuntime.Hierarchical.Cutout,
  );
  config.setPathSimplifyMode(vtracerRuntime.PathSimplifyMode.Spline);
  config.setFilterSpeckle(options.layered ? 4 : 2);
  config.setColorPrecision(options.layered ? 6 : 7);
  config.setLayerDifference(options.layered ? 12 : 16);
  config.setCornerThreshold(60);
  config.setLengthThreshold(4);
  config.setMaxIterations(10);
  config.setSpliceThreshold(45);
  config.setPathPrecision(2);
  try {
    return vtracerRuntime.convertImageToSvg(
      new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength),
      width,
      height,
      config,
    );
  } finally {
    config.free();
  }
}

async function traceWithPotrace(pixels, width, height) {
  const png = await sharp(Buffer.from(pixels), {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();

  return new Promise((resolve, reject) => {
    potrace.trace(
      png,
      {
        color: "#000000",
        threshold: 128,
        turdSize: 2,
        optTolerance: 0.2,
      },
      (error, svg) => {
        if (error) reject(error);
        else resolve(svg);
      },
    );
  });
}

function validateSvg(name, svg) {
  if (!svg || typeof svg !== "string") {
    throw new Error(`${name} did not return SVG text.`);
  }
  if (!/<svg\b/i.test(svg) || !/<path\b/i.test(svg)) {
    throw new Error(`${name} returned an empty or malformed SVG.`);
  }
  if (/<script\b|on\w+=|javascript:/i.test(svg)) {
    throw new Error(`${name} returned unsafe SVG content.`);
  }

  return {
    name,
    bytes: Buffer.byteLength(svg),
    paths: (svg.match(/<path\b/gi) || []).length,
    hasViewBox: /\bviewBox\s*=/i.test(svg),
  };
}

function makeRgba(width, height, paint) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = paint(x, y);
      const offset = (y * width + x) * 4;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = a;
    }
  }
  return pixels;
}
