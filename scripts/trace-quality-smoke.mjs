import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import potrace from "potrace";
import {
  applyPaletteSync,
  buildPaletteSync,
  utils as imageQUtils,
} from "image-q";
import { differenceCiede2000 } from "culori";

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

metrics.push(...(await auditLayeredPresetRecipes()));
metrics.push(testImageQPaletteFixture());

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

async function auditLayeredPresetRecipes() {
  const source = await fs.readFile(
    path.join(rootDir, "app/client/lib/converter/presetAdditions.ts"),
    "utf8",
  );
  const required = {
    "layered-detail": ["requestedPaletteCount: 32", 'layerBuildMode: "stacked-overlap"'],
    "layered-flat-color": ["requestedPaletteCount: 16", 'layerBuildMode: "per-color-cutout"'],
    "layered-soft-poster": ["requestedPaletteCount: 12", 'gapFill: "overlap"'],
    "ui-mockup-app-screen": ["requestedPaletteCount: 32", 'paletteDistance: "ciede2000"'],
    "photo-many-colors": ["requestedPaletteCount: 36", 'paletteAlgorithm: "image-q-wuquant"'],
    "filled-layers-smooth": ["requestedPaletteCount: 24", 'gapFill: "overlap"'],
    "filled-layers-separate-colors": ["requestedPaletteCount: 24", 'gapFill: "none"'],
    "clean-color-sticker": ["requestedPaletteCount: 24", 'removeWhite: false'],
  };
  const rows = [];
  for (const [id, tokens] of Object.entries(required)) {
    const block = getPresetBlock(source, id);
    if (!block) throw new Error(`Missing layered quality preset ${id}`);
    const missing = tokens.filter((token) => !block.includes(token));
    if (missing.length) {
      throw new Error(`Preset ${id} is missing required tokens: ${missing.join(", ")}`);
    }
    rows.push({
      name: `${id}:recipe`,
      requestedPaletteCount: Number(block.match(/requestedPaletteCount:\s*(\d+)/)?.[1] || 0),
      hasPaletteQuantization: block.includes("image-q-wuquant"),
      layerBuildMode: block.match(/layerBuildMode:\s*"([^"]+)"/)?.[1] || "raw-vtracer",
    });
  }
  return rows;
}

function getPresetBlock(source, id) {
  const pattern = new RegExp(
    String.raw`\{\s*id:\s*"${escapeRegExp(id)}"[\s\S]*?\n\s*\},`,
    "m",
  );
  return source.match(pattern)?.[0] || "";
}

function testImageQPaletteFixture() {
  const width = 320;
  const height = 180;
  const swatches = [
    [15, 23, 42],
    [30, 41, 59],
    [51, 65, 85],
    [71, 85, 105],
    [226, 232, 240],
    [248, 250, 252],
    [239, 68, 68],
    [248, 113, 113],
    [249, 115, 22],
    [251, 146, 60],
    [245, 158, 11],
    [250, 204, 21],
    [34, 197, 94],
    [74, 222, 128],
    [20, 184, 166],
    [45, 212, 191],
    [14, 165, 233],
    [56, 189, 248],
    [37, 99, 235],
    [96, 165, 250],
    [99, 102, 241],
    [129, 140, 248],
    [168, 85, 247],
    [192, 132, 252],
    [217, 70, 239],
    [232, 121, 249],
    [244, 114, 182],
    [251, 207, 232],
    [180, 83, 9],
    [120, 53, 15],
    [6, 95, 70],
    [8, 145, 178],
  ];
  const pixels = makeRgba(width, height, (x, y) => {
    const col = Math.min(7, Math.floor(x / (width / 8)));
    const row = Math.min(3, Math.floor(y / (height / 4)));
    const base = swatches[row * 8 + col];
    const shadow = y % 45 > 34 ? -18 : x % 40 > 30 ? 12 : 0;
    return [
      clampByte(base[0] + shadow),
      clampByte(base[1] + shadow),
      clampByte(base[2] + shadow),
      255,
    ];
  });
  const pointContainer = imageQUtils.PointContainer.fromUint8Array(pixels, width, height);
  const palette = buildPaletteSync([pointContainer], {
    colors: 32,
    colorDistanceFormula: "ciede2000",
    paletteQuantization: "wuquant",
  });
  const quantized = applyPaletteSync(pointContainer, palette, {
    colorDistanceFormula: "ciede2000",
    imageQuantization: "nearest",
  }).toUint8Array();
  const unique = countUniqueColors(quantized);
  if (unique < 24) {
    throw new Error(`image-q UI mockup palette collapsed to ${unique} colors.`);
  }
  const delta = differenceCiede2000();
  const perceptualSampleDelta = delta(
    { mode: "rgb", r: 15 / 255, g: 23 / 255, b: 42 / 255 },
    { mode: "rgb", r: 248 / 255, g: 250 / 255, b: 252 / 255 },
  );
  if (!Number.isFinite(perceptualSampleDelta) || perceptualSampleDelta < 40) {
    throw new Error("culori CIEDE2000 distance did not produce a meaningful palette delta.");
  }
  return {
    name: "IMG_8487-synthetic-ui-mockup:palette",
    requestedPaletteCount: 32,
    actualPaletteCount: unique,
    outputDetectedColors: unique,
    engine: "image-q",
    perceptualSampleDelta: Number(perceptualSampleDelta.toFixed(2)),
  };
}

function countUniqueColors(data) {
  const colors = new Set();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 18) continue;
    colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
  }
  return colors.size;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
