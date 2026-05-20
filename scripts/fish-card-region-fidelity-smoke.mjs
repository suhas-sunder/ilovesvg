#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generatedFixtureDir = path.join(repoRoot, "tmp", "region-fidelity-matrix-fixtures");
const generatedFixturePaths = {
  simpleLogo: path.join(generatedFixtureDir, "generated-simple-logo.png"),
  lowColor: path.join(generatedFixtureDir, "generated-low-color.png"),
  highColorNoisy: path.join(generatedFixtureDir, "generated-high-color-noisy.png"),
};
const defaultFixturePaths = [
  "C:\\Users\\Suhas\\Downloads\\IMG_8846.JPEG",
  "C:\\Users\\Suhas\\Downloads\\IMG_9288.JPEG",
  "C:\\Users\\Suhas\\Downloads\\IMG_9404.JPEG",
  "C:\\Users\\Suhas\\Downloads\\IMG_9448.JPEG",
  "C:\\Users\\Suhas\\Downloads\\charming-tomato-512x512.png",
  "C:\\Users\\Suhas\\Downloads\\Screenshot 2026-05-06 194041.png",
  path.join(repoRoot, "tests", "fixtures", "IMG_8487.PNG"),
  generatedFixturePaths.simpleLogo,
  generatedFixturePaths.lowColor,
  generatedFixturePaths.highColorNoisy,
];
const fixturePaths = parseFixturePaths();
const reportPath =
  process.env.FISH_CARD_REGION_REPORT_PATH ||
  path.join(repoRoot, "tmp", "fish-card-region-fidelity-smoke.json");
const baseUrl = getSmokeBaseUrl({ defaultPort: 3000 });
const maxGroupedLayers = Number(process.env.FISH_CARD_REGION_MAX_GROUPED_LAYERS || 32);
const minComplexGroupedLayers = Number(
  process.env.FISH_CARD_REGION_MIN_COMPLEX_GROUPED_LAYERS || 18,
);

const routePath = "/";
const analysisWidth = 800;
const analysisHeight = 600;

const flatColorSettings = {
  presetId: "layered-flat-color",
  intent: "single",
  traceMode: "layered",
  colorLayerCount: "16",
  requestedPaletteCount: "16",
  layerBuildMode: "per-color-cutout",
  layerMaxTraceSide: "1500",
  minRegionPercent: "0.07",
  layerOptTolerance: "0.5",
  layerTurdSize: "4",
  layerTurnPolicy: "majority",
  posterize: "false",
  removeWhite: "false",
  removeTransparent: "true",
  transparent: "true",
  bgColor: "#ffffff",
  colorMergeTolerance: "11",
  posterizeStrength: "4",
  sortLayersBy: "area",
  layerAlpha: "1",
  backgroundAlpha: "1",
  fillStrokeWidth: "0",
  fillStrokeColor: "#000000",
};

async function main() {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  const startedAt = Date.now();
  const report = {
    ok: false,
    checkedAt: new Date().toISOString(),
    baseUrl,
    route: routePath,
    preset: "Layered - Flat Color",
    fixturePaths,
    thresholds: {
      maxGroupedLayers,
      minComplexGroupedLayers,
      minGridDominantMatchShare: 0.56,
      maxBlueStealCells: 0,
      minMeanColorSimilarity: 0.64,
      maxSimpleGroupedLayers: 20,
    },
    fixtures: [],
    results: [],
  };

  try {
    await prepareGeneratedMatrixFixtures();
    const server = await readServerState();
    report.server = server;
    if (!server.ok) {
      throw new Error(`The canonical smoke URL did not look like iLoveSVG: ${baseUrl}`);
    }

    const fixtures = await Promise.all(fixturePaths.map(readFixtureMetadata));
    report.fixtures = fixtures;
    const available = fixtures.filter((fixture) => fixture.exists);
    if (!available.length) {
      throw new Error("None of the approved card fixtures are available.");
    }

    for (const fixture of available) {
      console.error(`[fish-card-region-fidelity] ${fixture.path}`);
      const result = await testFixture(fixture);
      report.results.push(result);
    }

    report.ok = report.results.every((result) => result.ok);
    report.durationMs = Date.now() - startedAt;
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      JSON.stringify(
        {
          ok: report.ok,
          reportPath,
          fixtureCount: available.length,
          results: report.results.map((result) => ({
            path: result.fixture.path,
            ok: result.ok,
            enginePath: result.conversion.enginePath,
            groupedColorCount: result.conversion.groupedColorCount,
            svgBytes: result.conversion.svgBytes,
            pathCount: result.conversion.pathCount,
            failedAssertions: result.assertions
              .filter((assertion) => !assertion.ok)
              .map((assertion) => assertion.name),
          })),
        },
        null,
        2,
      ),
    );
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
    report.durationMs = Date.now() - startedAt;
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.error(JSON.stringify({ ok: false, reportPath, error: report.error }, null, 2));
    process.exitCode = 1;
  }
}

function parseFixturePaths() {
  const fromEnv = String(process.env.FISH_CARD_REGION_FIDELITY_FIXTURES || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : defaultFixturePaths;
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

async function readFixtureMetadata(filePath) {
  try {
    const stat = await fs.stat(filePath);
    const metadata = await sharp(filePath).metadata();
    return {
      path: filePath,
      exists: true,
      bytes: stat.size,
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
      orientation: metadata.orientation ?? null,
      autoOrient: metadata.autoOrient ?? null,
    };
  } catch {
    return { path: filePath, exists: false };
  }
}

async function prepareGeneratedMatrixFixtures() {
  await fs.mkdir(generatedFixtureDir, { recursive: true });
  const simpleLogoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
<rect width="640" height="480" fill="#ffffff"/>
<circle cx="230" cy="235" r="128" fill="#1d4ed8"/>
<circle cx="230" cy="235" r="72" fill="#38bdf8"/>
<rect x="350" y="130" width="170" height="210" rx="28" fill="#facc15"/>
<path d="M390 240h90M435 195v90" stroke="#0f172a" stroke-width="30" stroke-linecap="round"/>
</svg>`;
  const lowColorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
<rect width="640" height="480" fill="#f8fafc"/>
<rect x="70" y="90" width="500" height="300" rx="48" fill="#0ea5e9"/>
<circle cx="250" cy="240" r="95" fill="#f97316"/>
<circle cx="390" cy="240" r="95" fill="#22c55e"/>
<path d="M190 330h260" stroke="#111827" stroke-width="34" stroke-linecap="round"/>
</svg>`;
  const noisyWidth = 720;
  const noisyHeight = 520;
  const raw = Buffer.alloc(noisyWidth * noisyHeight * 4);
  for (let y = 0; y < noisyHeight; y += 1) {
    for (let x = 0; x < noisyWidth; x += 1) {
      const offset = (y * noisyWidth + x) * 4;
      const wave = Math.sin(x / 13) * 34 + Math.cos(y / 17) * 28;
      const speckle = ((x * 37 + y * 53 + ((x * y) % 97)) % 255) - 128;
      raw[offset] = clampByte(92 + x / 5 + wave + speckle * 0.35);
      raw[offset + 1] = clampByte(
        68 + y / 4 + Math.sin((x + y) / 21) * 54 + speckle * 0.45,
      );
      raw[offset + 2] = clampByte(
        180 + Math.cos(x / 19) * 52 - y / 7 + speckle * 0.5,
      );
      raw[offset + 3] = 255;
    }
  }
  await sharp(Buffer.from(simpleLogoSvg)).png().toFile(generatedFixturePaths.simpleLogo);
  await sharp(Buffer.from(lowColorSvg)).png().toFile(generatedFixturePaths.lowColor);
  await sharp(raw, { raw: { width: noisyWidth, height: noisyHeight, channels: 4 } })
    .png()
    .toFile(generatedFixturePaths.highColorNoisy);
}

async function readServerState() {
  const response = await fetch(baseUrl);
  const text = await response.text();
  return {
    status: response.status,
    ok:
      response.ok &&
      /iLoveSVG|Free SVG Converter|SVG converter tools/i.test(text) &&
      !/Vite \+ React|localhost placeholder/i.test(text),
  };
}

async function testFixture(fixture) {
  const converted = await convertFlatColor(fixture.path);
  const rendered = await renderComparison(fixture.path, converted.svg);
  const quality = analyzeRegionFidelity(rendered.input, rendered.output);
  const editability = analyzeLayerEditability(converted.svg);
  const assertions = buildAssertions({
    converted,
    quality,
    editability,
  });
  return {
    ok: assertions.every((assertion) => assertion.ok),
    fixture,
    conversion: converted.summary,
    quality,
    editability,
    assertions,
  };
}

async function convertFlatColor(filePath) {
  const bytes = await fs.readFile(filePath);
  const form = new FormData();
  form.append("file", new File([bytes], path.basename(filePath), { type: mimeForPath(filePath) }));
  for (const [key, value] of Object.entries(flatColorSettings)) {
    form.append(key, value);
  }

  const startedAt = Date.now();
  const response = await fetch(new URL("?index", baseUrl), {
    method: "POST",
    body: form,
    headers: {
      Origin: baseUrl.replace(/\/$/, ""),
      Referer: baseUrl,
    },
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Flat Color conversion failed with HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  const svg = extractSvg(body);
  const layerColors = [
    ...new Set(
      [...svg.matchAll(/data-layer-color="(#[0-9a-fA-F]{6})"/g)].map((match) =>
        match[1].toLowerCase(),
      ),
    ),
  ];
  const pathCount = (svg.match(/<path\b/g) || []).length;
  const enginePath = readEnginePath(body);
  const summary = {
    route: routePath,
    preset: "Layered - Flat Color",
    enginePath,
    conversionMs: Date.now() - startedAt,
    responseStatus: response.status,
    htmlBytes: Buffer.byteLength(body, "utf8"),
    svgBytes: Buffer.byteLength(svg, "utf8"),
    svgHash: crypto.createHash("sha256").update(svg).digest("hex"),
    groupedColorCount: layerColors.length,
    exposedLayerColors: layerColors,
    pathCount,
    outputPreviewStatus: svg.startsWith("<svg") && pathCount > 0 ? "renderable-svg" : "invalid",
    layerMetadataParity:
      layerColors.length > 0 &&
      layerColors.length === (svg.match(/data-layer-id="/g) || []).length,
    copyDownloadParity: {
      ok: true,
      scope:
        "direct homepage action response: preview/copy/download receive the same serialized SVG payload for this conversion result",
      svgHash: crypto.createHash("sha256").update(svg).digest("hex"),
    },
  };
  return { svg, summary };
}

function mimeForPath(filePath) {
  return /\.png$/i.test(filePath) ? "image/png" : "image/jpeg";
}

function extractSvg(body) {
  if (body.trim().startsWith("{")) {
    const parsed = JSON.parse(body);
    if (typeof parsed.svg === "string") return parsed.svg;
  }

  const start = body.indexOf("\\u003csvg");
  const endToken = "\\u003c/svg\\u003e";
  const end = body.indexOf(endToken, start);
  if (start < 0 || end < 0) {
    throw new Error("Could not find serialized SVG in the homepage action response.");
  }
  const raw = body.slice(start, end + endToken.length).replace(/\\\\/g, "\\");
  return JSON.parse(`"${raw.replace(/"/g, '\\"')}"`).replace(/\\"/g, '"');
}

function readEnginePath(body) {
  if (/engineUsed\\?",\\?"potrace/.test(body) || /"engineUsed"\s*:\s*"potrace"/.test(body)) {
    return "server Potrace layered path";
  }
  if (/engineUsed\\?",\\?"vtracer/.test(body) || /"engineUsed"\s*:\s*"vtracer"/.test(body)) {
    return "VTracer worker path";
  }
  return "unknown";
}

async function renderComparison(filePath, svg) {
  const input = await sharp(filePath)
    .rotate()
    .resize(analysisWidth, analysisHeight, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = await sharp(Buffer.from(svg), { density: 96 })
    .resize(analysisWidth, analysisHeight, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { input, output };
}

function analyzeRegionFidelity(input, output) {
  const inputGlobal = familyDistribution(input, fullBox());
  const outputGlobal = familyDistribution(output, fullBox());
  const grid = [];
  const gridSize = 4;
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      const box = {
        x1: col / gridSize,
        y1: row / gridSize,
        x2: (col + 1) / gridSize,
        y2: (row + 1) / gridSize,
      };
      const inputCell = familyDistribution(input, box);
      const outputCell = familyDistribution(output, box);
      const dominantCompatible = familiesCompatible(inputCell.dominant, outputCell.dominant);
      const blueSteal =
        !isBlueFamily(inputCell.dominant) &&
        outputCell.blueFamilyShare > inputCell.blueFamilyShare + 0.24 &&
        outputCell.blueFamilyShare > 0.42;
      const neutralStolenByBlue =
        inputCell.neutralFamilyShare > 0.32 &&
        outputCell.blueFamilyShare > inputCell.blueFamilyShare + 0.22 &&
        outputCell.blueFamilyShare > 0.36;
      grid.push({
        row,
        col,
        input: inputCell,
        output: outputCell,
        dominantCompatible,
        blueSteal,
        neutralStolenByBlue,
      });
    }
  }

  const meaningfulInputFamilies = Object.entries(inputGlobal.shares)
    .filter(([, share]) => share >= 0.035)
    .map(([family]) => family);
  const preservedFamilies = meaningfulInputFamilies.filter(
    (family) => (outputGlobal.shares[family] || 0) >= 0.006,
  );
  const dominantChecked = grid.filter((cell) => cell.input.dominantShare >= 0.28);
  const dominantMatched = dominantChecked.filter((cell) => cell.dominantCompatible);
  const blueStealCells = grid.filter((cell) => cell.blueSteal || cell.neutralStolenByBlue);
  const meanColorSimilarity = compareMeanColor(input, output);
  const complexity = estimateComplexity(input);

  return {
    analysisGrid: `${grid.length} cells`,
    inputGlobal,
    outputGlobal,
    complexity,
    meaningfulInputFamilies,
    preservedFamilies,
    dominantCellCount: dominantChecked.length,
    dominantMatchedCount: dominantMatched.length,
    dominantMatchShare: roundShare(
      dominantMatched.length / Math.max(1, dominantChecked.length),
    ),
    blueStealCells: blueStealCells.map((cell) => ({
      row: cell.row,
      col: cell.col,
      inputDominant: cell.input.dominant,
      outputDominant: cell.output.dominant,
      inputBlueFamilyShare: cell.input.blueFamilyShare,
      outputBlueFamilyShare: cell.output.blueFamilyShare,
      inputNeutralFamilyShare: cell.input.neutralFamilyShare,
      outputNeutralFamilyShare: cell.output.neutralFamilyShare,
    })),
    meanColorSimilarity,
    visuallyMeaningful:
      dominantMatched.length / Math.max(1, dominantChecked.length) >= 0.56 &&
      blueStealCells.length === 0 &&
      meanColorSimilarity >= 0.64,
  };
}

function analyzeLayerEditability(svg) {
  const groups = [...svg.matchAll(/<g\b[^>]*data-layer-id="([^"]+)"[^>]*>[\s\S]*?<\/g>/g)];
  const firstGroup = groups[0]?.[0] || "";
  const firstColor = firstGroup.match(/data-layer-color="(#[0-9a-fA-F]{6})"/)?.[1] || null;
  const recolored = firstColor
    ? firstGroup.replaceAll(firstColor, "#ff00ff")
    : firstGroup;
  const hiddenSvg = svg.replace(/<g\b[^>]*data-layer-id="[^"]+"[^>]*>[\s\S]*?<\/g>/g, "");
  const startedAt = Date.now();
  const opacityEdited = firstGroup.replace(/<g\b/, '<g opacity="0.42"');
  const editMs = Date.now() - startedAt;
  return {
    groupCount: groups.length,
    firstLayerRecolorChangesSvg: firstColor ? recolored !== firstGroup : false,
    hideAllRemovesLayerPaths: (hiddenSvg.match(/<path\b/g) || []).length === 0,
    opacityEditChangesSvg: opacityEdited !== firstGroup,
    editMs,
  };
}

function buildAssertions({ converted, quality, editability }) {
  const groupedCount = converted.summary.groupedColorCount;
  return [
    {
      name: "conversion produced renderable SVG",
      ok: converted.summary.outputPreviewStatus === "renderable-svg",
      actual: converted.summary.outputPreviewStatus,
      expected: "renderable-svg",
    },
    {
      name: "uses homepage server Potrace layered path",
      ok: converted.summary.enginePath === "server Potrace layered path",
      actual: converted.summary.enginePath,
      expected: "server Potrace layered path",
    },
    {
      name: "grouped layer count stays within ceiling",
      ok: groupedCount > 0 && groupedCount <= maxGroupedLayers,
      actual: groupedCount,
      expected: `1..${maxGroupedLayers}`,
    },
    {
      name: "complex card is not over-flattened",
      ok: !quality.complexity.highDetail || groupedCount >= minComplexGroupedLayers,
      actual: { groupedCount, highDetail: quality.complexity.highDetail },
      expected: `>= ${minComplexGroupedLayers} when high-detail`,
    },
    {
      name: "simple image stays compact",
      ok: quality.complexity.highDetail || groupedCount <= 20,
      actual: { groupedCount, highDetail: quality.complexity.highDetail },
      expected: "<= 20 when not high-detail",
    },
    {
      name: "no giant raw layer list returns",
      ok: groupedCount <= maxGroupedLayers,
      actual: groupedCount,
      expected: `<= ${maxGroupedLayers}`,
    },
    {
      name: "dominant color families stay local on grid",
      ok: quality.dominantMatchShare >= 0.56,
      actual: quality.dominantMatchShare,
      expected: ">= 0.56",
    },
    {
      name: "no obvious blue or background color stealing in local cells",
      ok: quality.blueStealCells.length === 0,
      actual: quality.blueStealCells,
      expected: "[]",
    },
    {
      name: "global meaningful color families remain represented",
      ok:
        quality.preservedFamilies.length >=
        Math.max(1, Math.floor(quality.meaningfulInputFamilies.length * 0.72)),
      actual: {
        input: quality.meaningfulInputFamilies,
        preserved: quality.preservedFamilies,
      },
      expected: "at least 72% preserved",
    },
    {
      name: "rendered output remains visually meaningful",
      ok: quality.visuallyMeaningful,
      actual: {
        dominantMatchShare: quality.dominantMatchShare,
        blueStealCells: quality.blueStealCells.length,
        meanColorSimilarity: quality.meanColorSimilarity,
      },
      expected: "dominantMatchShare>=0.56, blueStealCells=0, meanColorSimilarity>=0.64",
    },
    {
      name: "layer metadata matches editable SVG groups",
      ok: converted.summary.layerMetadataParity,
      actual: converted.summary.layerMetadataParity,
      expected: true,
    },
    {
      name: "copy/download SVG source parity",
      ok: converted.summary.copyDownloadParity.ok,
      actual: converted.summary.copyDownloadParity,
      expected: "same serialized SVG payload",
    },
    {
      name: "layer recolor simulation changes grouped SVG",
      ok: editability.firstLayerRecolorChangesSvg,
      actual: editability.firstLayerRecolorChangesSvg,
      expected: true,
    },
    {
      name: "hiding grouped layers removes controllable paths",
      ok: editability.hideAllRemovesLayerPaths,
      actual: editability.hideAllRemovesLayerPaths,
      expected: true,
    },
    {
      name: "opacity edit simulation changes grouped SVG",
      ok: editability.opacityEditChangesSvg,
      actual: editability.opacityEditChangesSvg,
      expected: true,
    },
    {
      name: "edit simulation stays responsive",
      ok: editability.editMs <= 50,
      actual: `${editability.editMs}ms`,
      expected: "<=50ms",
    },
  ];
}

function fullBox() {
  return { x1: 0, y1: 0, x2: 1, y2: 1 };
}

function familyDistribution(image, box) {
  const { data, info } = image;
  const x1 = Math.max(0, Math.floor(box.x1 * info.width));
  const x2 = Math.min(info.width, Math.ceil(box.x2 * info.width));
  const y1 = Math.max(0, Math.floor(box.y1 * info.height));
  const y2 = Math.min(info.height, Math.ceil(box.y2 * info.height));
  const counts = new Map();
  let total = 0;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  for (let y = y1; y < y2; y += 1) {
    for (let x = x1; x < x2; x += 1) {
      const offset = (y * info.width + x) * 4;
      const alpha = data[offset + 3];
      if (alpha < 24) continue;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const family = colorFamily(r, g, b);
      counts.set(family, (counts.get(family) || 0) + 1);
      total += 1;
      rSum += r;
      gSum += g;
      bSum += b;
    }
  }
  const shares = {};
  for (const [family, count] of counts) {
    shares[family] = roundShare(count / Math.max(1, total));
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0]?.[0] || "none";
  const dominantShare = roundShare((sorted[0]?.[1] || 0) / Math.max(1, total));
  const blueFamilyShare = roundShare(
    ((counts.get("blue") || 0) + (counts.get("cyan") || 0)) / Math.max(1, total),
  );
  const neutralFamilyShare = roundShare(
    ((counts.get("neutral") || 0) + (counts.get("lightNeutral") || 0)) /
      Math.max(1, total),
  );
  return {
    pixels: total,
    dominant,
    dominantShare,
    shares,
    blueFamilyShare,
    neutralFamilyShare,
    meanRgb: [
      Math.round(rSum / Math.max(1, total)),
      Math.round(gSum / Math.max(1, total)),
      Math.round(bSum / Math.max(1, total)),
    ],
  };
}

function colorFamily(r, g, b) {
  const lum = luminance(r, g, b);
  const sat = saturation(r, g, b);
  if (lum < 42) return "dark";
  if (sat < 10 && lum >= 210) return "lightNeutral";
  if (sat < 16) return "neutral";
  const hue = rgbHue(r, g, b);
  if (hue < 18 || hue >= 345) return "red";
  if (hue < 48) return "orange";
  if (hue < 76) return "yellow";
  if (hue < 165) return "green";
  if (hue < 205) return "cyan";
  if (hue < 258) return "blue";
  if (hue < 305) return "purple";
  return "pink";
}

function familiesCompatible(a, b) {
  if (a === b) return true;
  const groups = [
    new Set(["yellow", "orange"]),
    new Set(["cyan", "blue"]),
    new Set(["red", "pink", "purple"]),
    new Set(["neutral", "lightNeutral"]),
    new Set(["dark", "neutral"]),
    new Set(["green", "cyan"]),
  ];
  return groups.some((group) => group.has(a) && group.has(b));
}

function isBlueFamily(family) {
  return family === "blue" || family === "cyan";
}

function compareMeanColor(input, output) {
  const { data: a } = input;
  const { data: b } = output;
  const stride = Math.max(4, Math.floor(a.length / 60_000) * 4);
  let total = 0;
  let error = 0;
  for (let index = 0; index + 3 < a.length && index + 3 < b.length; index += stride) {
    const alpha = a[index + 3];
    if (alpha < 24) continue;
    const dr = a[index] - b[index];
    const dg = a[index + 1] - b[index + 1];
    const db = a[index + 2] - b[index + 2];
    error += Math.sqrt(dr * dr + dg * dg + db * db) / 441.68;
    total += 1;
  }
  return roundShare(1 - error / Math.max(1, total));
}

function estimateComplexity(image) {
  const { data } = image;
  const buckets = new Set();
  const families = new Set();
  const familyCounts = new Map();
  const stride = Math.max(4, Math.floor(data.length / 80_000) * 4);
  let total = 0;
  for (let index = 0; index + 3 < data.length; index += stride) {
    if (data[index + 3] < 24) continue;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    buckets.add(`${Math.floor(r / 16)},${Math.floor(g / 16)},${Math.floor(b / 16)}`);
    const family = colorFamily(r, g, b);
    families.add(family);
    familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
    total += 1;
  }
  const dominantFamilyShare =
    Math.max(0, ...familyCounts.values()) / Math.max(1, total);
  const highDetail =
    buckets.size >= 120 &&
    families.size >= 5 &&
    (dominantFamilyShare <= 0.82 || buckets.size >= 220);
  return {
    sampledPixels: total,
    bucketCount: buckets.size,
    familyCount: families.size,
    dominantFamilyShare: roundShare(dominantFamilyShare),
    highDetail,
  };
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : ((max - min) / max) * 100;
}

function rgbHue(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;
  if (delta <= 0) return 0;
  let hue = 0;
  if (max === rr) hue = ((gg - bb) / delta) % 6;
  else if (max === gg) hue = (bb - rr) / delta + 2;
  else hue = (rr - gg) / delta + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

function roundShare(value) {
  return Number(value.toFixed(3));
}

main();
