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
import { traceCenterlineRasterToSvg } from "../app/shared/tracing/centerlineTrace.ts";
import { STROKE_TRACE_PRESET_ADDITIONS } from "../app/client/lib/converter/presetAdditions.ts";

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
metrics.push(...auditCenterlineStrokeRecipes());

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
    "layered-detail": ["requestedPaletteCount: 28", 'layerBuildMode: "stacked-overlap"'],
    "layered-flat-color": ["requestedPaletteCount: 16", 'layerBuildMode: "per-color-cutout"'],
    "layered-soft-poster": ["requestedPaletteCount: 12", 'gapFill: "overlap"'],
    "ui-mockup-app-screen": ["requestedPaletteCount: 28", 'paletteDistance: "ciede2000"'],
    "photo-many-colors": ["requestedPaletteCount: 32", 'layerBuildMode: "raw-vtracer"'],
    "filled-layers-smooth": ["requestedPaletteCount: 20", 'gapFill: "overlap"'],
    "filled-layers-separate-colors": ["requestedPaletteCount: 16", 'gapFill: "none"'],
    "clean-color-sticker": ["requestedPaletteCount: 20", 'removeWhite: false'],
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

function auditCenterlineStrokeRecipes() {
  const rows = [];
  const cleanLinePixels = makeRgba(160, 120, (x, y) => {
    const outline =
      Math.abs(Math.hypot((x - 80) / 48, (y - 58) / 34) - 1) < 0.045;
    const diagonal = Math.abs(y - (0.45 * x + 22)) <= 1.4 && x > 26 && x < 126;
    return outline || diagonal ? [0, 0, 0, 255] : [250, 246, 238, 255];
  });
  const cleanLineResult = traceCenterlineRasterToSvg(
    { data: cleanLinePixels, width: 160, height: 120 },
    {
      threshold: 218,
      transparent: true,
      lineColor: "#000000",
      centerlineStrokeWidth: 2,
      centerlineSimplifyTolerance: 1,
      centerlineMinPathLength: 5,
      traceDiagnosticsMode: "summary",
    },
  );
  validateCenterlineSvg("centerline-clean-line-art", cleanLineResult.svg);
  if (cleanLineResult.pathCount < 2 || cleanLineResult.pathCount > 120) {
    throw new Error(
      `centerline-clean-line-art returned an implausible path count: ${cleanLineResult.pathCount}`,
    );
  }
  rows.push({
    name: "centerline-clean-line-art",
    engine: cleanLineResult.engineUsed,
    paths: cleanLineResult.pathCount,
    bytes: cleanLineResult.svgBytes,
  });

  for (const preset of STROKE_TRACE_PRESET_ADDITIONS) {
    const result = traceCenterlineRasterToSvg(
      { data: cleanLinePixels, width: 160, height: 120 },
      {
        ...preset.settings,
        traceDiagnosticsMode: "summary",
      },
    );
    validateCenterlineSvg(`centerline-preset:${preset.id}`, result.svg);
    if (result.pathCount < 1 || result.pathCount > 180) {
      throw new Error(
        `centerline-preset:${preset.id} returned an implausible path count: ${result.pathCount}`,
      );
    }
    rows.push({
      name: `centerline-preset:${preset.id}`,
      engine: result.engineUsed,
      paths: result.pathCount,
      bytes: result.svgBytes,
    });
  }

  const cartoonOutlinePixels = makeCartoonOutlineFixture(512, 512);
  const outlinePresets = [
    "technical-outline-stroke",
    "fine-pen-centerline",
    "rounded-outline-stroke",
  ];
  for (const presetId of outlinePresets) {
    const preset = STROKE_TRACE_PRESET_ADDITIONS.find((candidate) => candidate.id === presetId);
    if (!preset) throw new Error(`Missing centerline quality preset ${presetId}`);
    const result = traceCenterlineRasterToSvg(
      { data: cartoonOutlinePixels, width: 512, height: 512 },
      {
        ...preset.settings,
        traceDiagnosticsMode: "summary",
      },
    );
    validateCenterlineSvg(`centerline-cartoon-outline:${preset.id}`, result.svg);
    const coverage = measureSvgCoordinateCoverage(result.svg);
    const outlineRecall = measureCartoonOutlineRecall(result.svg);
    const hasSmoothedStrokePaths = /\sd="[^"]*\bQ-?\d/i.test(result.svg);
    if (
      result.pathCount < 8 ||
      result.pathCount > 260 ||
      coverage.width < 280 ||
      coverage.height < 280 ||
      outlineRecall < 0.55 ||
      !hasSmoothedStrokePaths
    ) {
      throw new Error(
        `centerline-cartoon-outline:${preset.id} did not preserve the drawing outline enough: paths=${result.pathCount}, coverage=${coverage.width}x${coverage.height}, recall=${outlineRecall.toFixed(2)}, smoothed=${hasSmoothedStrokePaths}`,
      );
    }
    rows.push({
      name: `centerline-cartoon-outline:${preset.id}`,
      engine: result.engineUsed,
      paths: result.pathCount,
      bytes: result.svgBytes,
      coverage,
      outlineRecall,
    });
  }

  const internalDetailPixels = makeLayerInternalLineFixture(420, 360);
  for (const presetId of ["inked-linework-stroke", "fine-pen-centerline"]) {
    const preset = STROKE_TRACE_PRESET_ADDITIONS.find((candidate) => candidate.id === presetId);
    if (!preset) throw new Error(`Missing centerline internal-detail preset ${presetId}`);
    const result = traceCenterlineRasterToSvg(
      { data: internalDetailPixels, width: 420, height: 360 },
      {
        ...preset.settings,
        traceDiagnosticsMode: "summary",
      },
    );
    validateCenterlineSvg(`centerline-internal-lines:${preset.id}`, result.svg);
    const internalLineRecall = measureInternalLayerLineRecall(result.svg);
    if (internalLineRecall < 0.65) {
      throw new Error(
        `centerline-internal-lines:${preset.id} missed low-contrast lines inside a filled layer: recall=${internalLineRecall.toFixed(2)}, paths=${result.pathCount}`,
      );
    }
    rows.push({
      name: `centerline-internal-lines:${preset.id}`,
      engine: result.engineUsed,
      paths: result.pathCount,
      bytes: result.svgBytes,
      internalLineRecall,
    });
  }

  const fragmentedPixels = makeRgba(512, 512, (x, y) => {
    const mainDiagonal = Math.abs(x - y) <= 1 && x > 48 && x < 464;
    const mainHorizontal = Math.abs(y - 260) <= 1 && x > 80 && x < 430;
    if (mainDiagonal || mainHorizontal) return [0, 0, 0, 255];
    const cellX = Math.floor(x / 8);
    const cellY = Math.floor(y / 8);
    const localX = x % 8;
    const localY = y % 8;
    const active =
      (cellX * 17 + cellY * 31) % 5 !== 0 &&
      localX === 3 &&
      localY >= 2 &&
      localY <= 5;
    return active ? [0, 0, 0, 255] : [255, 255, 255, 0];
  });
  const fragmentedResult = traceCenterlineRasterToSvg(
    { data: fragmentedPixels, width: 512, height: 512 },
    {
      threshold: 200,
      transparent: true,
      lineColor: "#000000",
      centerlineStrokeWidth: 1,
      centerlineSimplifyTolerance: 0.5,
      centerlineMinPathLength: 2,
      traceDiagnosticsMode: "summary",
    },
  );
  validateCenterlineSvg("centerline-fragment-guard", fragmentedResult.svg);
  if (fragmentedResult.pathCount > 1_000) {
    throw new Error(
      `centerline-fragment-guard returned ${fragmentedResult.pathCount} paths; capped centerline output must stay below client preview guards.`,
    );
  }
  rows.push({
    name: "centerline-fragment-guard",
    engine: fragmentedResult.engineUsed,
    paths: fragmentedResult.pathCount,
    bytes: fragmentedResult.svgBytes,
    warnings: fragmentedResult.warnings || [],
  });

  return rows;
}

function makeCartoonOutlineFixture(width, height) {
  return makeRgba(width, height, (x, y) => {
    const bg = [247, 240, 225, 255];
    const head =
      Math.abs(Math.hypot((x - 190) / 75, (y - 220) / 60) - 1) < 0.04;
    const body =
      Math.abs(Math.hypot((x - 290) / 92, (y - 306) / 55) - 1) < 0.04;
    const wingA =
      Math.abs(Math.hypot((x - 320) / 46, (y - 165) / 90) - 1) < 0.035 &&
      y < 255;
    const wingB =
      Math.abs(Math.hypot((x - 372) / 64, (y - 215) / 78) - 1) < 0.035 &&
      y < 310;
    const antennaA = distToSegment(x, y, 160, 166, 137, 112) < 2.2;
    const antennaB = distToSegment(x, y, 215, 166, 212, 106) < 2.2;
    const keyBase = distToSegment(x, y, 118, 405, 260, 410) < 3;
    const leg = distToSegment(x, y, 145, 345, 108, 390) < 3;
    const outline =
      head || body || wingA || wingB || antennaA || antennaB || keyBase || leg;
    if (outline) return [5, 22, 48, 255];
    const wingVein =
      distToSegment(x, y, 308, 190, 356, 128) < 1.4 ||
      distToSegment(x, y, 322, 230, 408, 200) < 1.4 ||
      distToSegment(x, y, 342, 250, 417, 252) < 1.4;
    if (wingVein) return [120, 178, 235, 210];
    const blueMarks =
      distToSegment(x, y, 34, 322, 85, 322) < 3 ||
      distToSegment(x, y, 396, 92, 436, 92) < 3 ||
      distToSegment(x, y, 375, 430, 430, 430) < 3;
    if (blueMarks) return [77, 148, 221, 255];
    const darkFill =
      Math.hypot((x - 300) / 74, (y - 312) / 44) < 0.88 && x > 240;
    if (darkFill) return [20, 48, 84, 255];
    return bg;
  });
}

function makeLayerInternalLineFixture(width, height) {
  return makeRgba(width, height, (x, y) => {
    const bg = [248, 241, 229, 255];
    const body = Math.hypot((x - 240) / 92, (y - 220) / 58) < 1;
    if (body) {
      const stripeA = distToSegment(x, y, 205, 168, 282, 273) < 2.4;
      const stripeB = distToSegment(x, y, 238, 162, 315, 263) < 2.4;
      if (stripeA || stripeB) return [5, 24, 50, 255];
      return [28, 58, 94, 255];
    }
    const outline = Math.abs(Math.hypot((x - 240) / 92, (y - 220) / 58) - 1) < 0.035;
    return outline ? [5, 24, 50, 255] : bg;
  });
}

function distToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function measureSvgCoordinateCoverage(svg) {
  const values = extractSvgPolylines(svg).flat();
  if (!values.length) return { width: 0, height: 0 };
  const xs = values.map(([x]) => x);
  const ys = values.map(([, y]) => y);
  return {
    width: Math.round(Math.max(...xs) - Math.min(...xs)),
    height: Math.round(Math.max(...ys) - Math.min(...ys)),
  };
}

function measureCartoonOutlineRecall(svg) {
  const anchors = [
    ...sampleEllipse(190, 220, 75, 60, 0, Math.PI * 2, 80),
    ...sampleEllipse(290, 306, 92, 55, 0, Math.PI * 2, 80),
    ...sampleEllipse(320, 165, 46, 90, -Math.PI * 0.82, Math.PI * 0.82, 58),
    ...sampleEllipse(372, 215, 64, 78, -Math.PI * 0.82, Math.PI * 0.82, 58),
    ...sampleLine(160, 166, 137, 112, 20),
    ...sampleLine(215, 166, 212, 106, 20),
    ...sampleLine(118, 405, 260, 410, 30),
    ...sampleLine(145, 345, 108, 390, 18),
  ];
  return measureSvgAnchorRecall(svg, anchors, 12);
}

function measureInternalLayerLineRecall(svg) {
  const anchors = [
    ...sampleLine(205, 168, 282, 273, 24),
    ...sampleLine(238, 162, 315, 263, 24),
  ];
  return measureSvgAnchorRecall(svg, anchors, 8);
}

function measureSvgAnchorRecall(svg, anchors, radius) {
  const outputPolylines = extractSvgPolylines(svg);
  if (!outputPolylines.length || !anchors.length) return 0;
  let hits = 0;
  for (const [anchorX, anchorY] of anchors) {
    const close = outputPolylines.some((line) =>
      line.some(([x, y], index) => {
        if (Math.hypot(x - anchorX, y - anchorY) <= radius) return true;
        if (index === 0) return false;
        const [prevX, prevY] = line[index - 1];
        return distToSegment(anchorX, anchorY, prevX, prevY, x, y) <= radius;
      }),
    );
    if (close) hits += 1;
  }
  return hits / anchors.length;
}

function extractSvgPolylines(svg) {
  return [...svg.matchAll(/\sd="([^"]+)"/g)]
    .map((match) => sampleSvgPathData(match[1]))
    .filter((line) => line.length > 0);
}

function sampleSvgPathData(pathData) {
  const tokens = [...pathData.matchAll(/[MLQ]|-?\d+(?:\.\d+)?/g)].map((match) => match[0]);
  const points = [];
  let index = 0;
  let current = null;
  while (index < tokens.length) {
    const command = tokens[index++];
    if (command === "M" || command === "L") {
      const x = Number(tokens[index++]);
      const y = Number(tokens[index++]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) break;
      current = [x, y];
      points.push(current);
      continue;
    }
    if (command === "Q") {
      const cx = Number(tokens[index++]);
      const cy = Number(tokens[index++]);
      const x = Number(tokens[index++]);
      const y = Number(tokens[index++]);
      if (
        !current ||
        !Number.isFinite(cx) ||
        !Number.isFinite(cy) ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        break;
      }
      const [startX, startY] = current;
      for (let step = 1; step <= 8; step += 1) {
        const t = step / 8;
        const inv = 1 - t;
        points.push([
          inv * inv * startX + 2 * inv * t * cx + t * t * x,
          inv * inv * startY + 2 * inv * t * cy + t * t * y,
        ]);
      }
      current = [x, y];
      continue;
    }
    break;
  }
  return points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
}

function sampleEllipse(cx, cy, rx, ry, start, end, count) {
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const t = start + ((end - start) * i) / Math.max(1, count - 1);
    points.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return points;
}

function sampleLine(x1, y1, x2, y2, count) {
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / Math.max(1, count - 1);
    points.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
  }
  return points;
}

function validateCenterlineSvg(name, svg) {
  validateSvg(name, svg);
  if (!/\bfill="none"/i.test(svg) || !/\bstroke-width="/i.test(svg)) {
    throw new Error(`${name} did not return a real stroked SVG.`);
  }
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
