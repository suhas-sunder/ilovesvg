#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Potrace } from "@kcaitech/potrace-ts";
import { applyPaletteSync, buildPaletteSync, utils as imageQUtils } from "image-q";
import sharp from "sharp";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPath =
  process.env.ADAPTIVE_PALETTE_QUALITY_REPORT_PATH ||
  path.join(repoRoot, "tmp", "adaptive-palette-quality-smoke.json");
const fixtureDir = path.join(repoRoot, "tmp", "adaptive-palette-quality-fixtures");
const baseUrl = getSmokeBaseUrl({ defaultPort: 3000 });
const analysisMaxSide = Number(process.env.ADAPTIVE_PALETTE_ANALYSIS_MAX_SIDE || 420);
const highDetailBudgets = [8, 12, 16, 20, 24, 28, 30, 32];
const simpleBudgets = [4, 8, 12, 16, 24, 30, 32];
const currentFlatColorRequestedBudget = 16;
const preferredCeiling = 30;
const allowedCeiling = 32;

const userFixtureSpecs = [
  { id: "img-8846", role: "high-detail-card", requested: "C:\\Users\\Suhas\\Downloads\\IMG_8846.JPEG" },
  { id: "img-9288", role: "high-detail-card", requested: "C:\\Users\\Suhas\\Downloads\\IMG_9288.JPEG" },
  { id: "img-9404", role: "high-detail-card", requested: "C:\\Users\\Suhas\\Downloads\\IMG_9404.JPEG" },
  { id: "img-9448", role: "high-detail-card", requested: "C:\\Users\\Suhas\\Downloads\\IMG_9448.JPEG" },
  {
    id: "screenshot-2026-05-06",
    role: "screenshot-or-card",
    requested: "C:\\Users\\Suhas\\Downloads\\Screenshot 2026-05-06 194041.png",
  },
  {
    id: "charming-tomato",
    role: "simple-transparent-sticker",
    requested: "C:\\Users\\Suhas\\Downloads\\charming-tomato-512x512.png",
  },
  {
    id: "img-8487",
    role: "blue-card-fixture",
    requested: path.join(repoRoot, "tests", "fixtures", "IMG_8487.PNG"),
  },
];

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
  await ensureGeneratedFixtures();
  const fixtures = await resolveFixtures();
  const sourceInspection = await inspectSource();
  const results = [];
  const failures = [];

  for (const fixture of fixtures) {
    const source = await loadAnalysisImage(fixture.path);
    const sourceMetrics = analyzeSourceComplexity(source);
    const highDetail = isHighDetailFixture(fixture, sourceMetrics);
    const budgets = highDetail ? highDetailBudgets : simpleBudgets;
    const budgetResults = [];

    for (const budget of budgets) {
      const quantized = quantizeToBudget(source, budget);
      const metrics = analyzeBudget(source, quantized, budget);
      const svg = traceQuantizedBudgetToSvg(quantized, {
        width: source.width,
        height: source.height,
      });
      budgetResults.push({
        budget,
        actualGroupedColorCount: svg.groupedColorCount,
        rawVisibleColorCount: metrics.visibleColorCount,
        svgByteSize: Buffer.byteLength(svg.svg, "utf8"),
        pathCount: svg.pathCount,
        localColorSimilarity: metrics.localColorSimilarity,
        averageColorError: metrics.averageColorError,
        regionFidelityScore: metrics.regionFidelityScore,
        darkDetailRetention: metrics.darkDetailRetention,
        darkForegroundRetention: metrics.darkForegroundRetention,
        highContrastEdgeRetention: metrics.highContrastEdgeRetention,
        overFlatteningScore: metrics.overFlatteningScore,
        keyStructurePreserved: metrics.keyStructurePreserved,
        visuallyMeaningful: metrics.visuallyMeaningful,
      });
    }

    const currentBudget = nearestBudgetResult(budgetResults, currentFlatColorRequestedBudget);
    const bestPreferred = chooseBestBudget(budgetResults, preferredCeiling);
    const bestAllowed = chooseBestBudget(budgetResults, allowedCeiling);
    const smallestAcceptable = chooseSmallestAcceptableBudget(budgetResults, highDetail);
    const highBudgetImprovement = materialImprovement(currentBudget, bestAllowed);
    const selected = await tryConvertCurrentAppOutput(fixture.path);

    const simpleOverExpanded =
      !highDetail &&
      selected.ok &&
      selected.groupedColorCount != null &&
      selected.groupedColorCount > 20;
    const clientCannotUseHighBudget =
      highDetail &&
      highBudgetImprovement.material &&
      (!sourceInspection.clientFlatColorAdaptiveBudgetImplemented ||
        !sourceInspection.clientFlatColorHighFidelitySafeCapImplemented ||
        Number(sourceInspection.clientFlatColorGroupingCap || 0) < allowedCeiling);
    const highDetailSelectedTooSmall =
      highDetail &&
      selected.ok &&
      selected.groupedColorCount != null &&
      selected.groupedColorCount < 24 &&
      highBudgetImprovement.material;
    const darkDetailCollapse =
      highDetail &&
      currentBudget &&
      bestAllowed &&
      currentBudget.darkDetailRetention + 0.12 < bestAllowed.darkDetailRetention &&
      bestAllowed.darkDetailRetention >= 0.58;

    const fixtureFailures = [];
    if (clientCannotUseHighBudget) {
      fixtureFailures.push(
        "client Flat Color path cannot use the adaptive high-detail budget while 28/30/32 materially improves diagnostic fidelity",
      );
    }
    if (highDetailSelectedTooSmall) {
      fixtureFailures.push(
        `current app output selected ${selected.groupedColorCount} groups even though high budgets materially improve this fixture`,
      );
    }
    if (darkDetailCollapse) {
      fixtureFailures.push(
        "dark text/linework-like detail is materially better at higher budgets than at the current 16-color budget",
      );
    }
    if (simpleOverExpanded) {
      fixtureFailures.push(`simple fixture expanded to ${selected.groupedColorCount} groups`);
    }
    if (bestAllowed && bestAllowed.actualGroupedColorCount > allowedCeiling) {
      fixtureFailures.push(`candidate output exceeded ${allowedCeiling} grouped colors`);
    }

    failures.push(...fixtureFailures.map((message) => `${fixture.id}: ${message}`));
    results.push({
      fixture: fixture.id,
      basename: path.basename(fixture.path),
      role: fixture.role,
      source: fixture.source,
      highDetail,
      sourceMetrics,
      currentAppOutput: selected,
      currentBudget16: currentBudget,
      bestPreferredBudget: bestPreferred,
      bestAllowedBudget: bestAllowed,
      smallestAcceptableBudget: smallestAcceptable,
      materialImprovementFrom16ToHighBudget: highBudgetImprovement,
      budgetResults,
      failures: fixtureFailures,
    });
  }

  const report = {
    ok: failures.length === 0,
    checkedAt: new Date().toISOString(),
    baseUrl,
    analysisMaxSide,
    budgets: {
      highDetail: highDetailBudgets,
      simple: simpleBudgets,
      preferredCeiling,
      allowedCeiling,
      currentFlatColorRequestedBudget,
    },
    sourceInspection,
    fixtureCount: fixtures.length,
    results,
    failures,
  };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summarize(report), null, 2));
  if (failures.length) process.exitCode = 1;
}

function summarize(report) {
  return {
    ok: report.ok,
    baseUrl: report.baseUrl,
    reportPath,
    fixtureCount: report.fixtureCount,
    sourceInspection: report.sourceInspection,
    highDetailSummary: report.results
      .filter((result) => result.highDetail)
      .map((result) => ({
        fixture: result.fixture,
        currentAppGroups: result.currentAppOutput.groupedColorCount,
        currentBudget16: result.currentBudget16?.actualGroupedColorCount ?? null,
        bestPreferredBudget: result.bestPreferredBudget?.budget ?? null,
        bestPreferredGroups: result.bestPreferredBudget?.actualGroupedColorCount ?? null,
        bestAllowedBudget: result.bestAllowedBudget?.budget ?? null,
        bestAllowedGroups: result.bestAllowedBudget?.actualGroupedColorCount ?? null,
        darkDetail16: result.currentBudget16?.darkDetailRetention ?? null,
        darkDetailHigh: result.bestAllowedBudget?.darkDetailRetention ?? null,
        materialImprovement: result.materialImprovementFrom16ToHighBudget.material,
        failures: result.failures,
      })),
    simpleSummary: report.results
      .filter((result) => !result.highDetail)
      .map((result) => ({
        fixture: result.fixture,
        currentAppGroups: result.currentAppOutput.groupedColorCount,
        bestAllowedGroups: result.bestAllowedBudget?.actualGroupedColorCount ?? null,
        failures: result.failures,
      })),
    failureCount: report.failures.length,
    failures: report.failures.slice(0, 12),
  };
}

async function inspectSource() {
  const worker = await fs.readFile(path.join(repoRoot, "app", "client", "workers", "vtracer.worker.ts"), "utf8");
  const server = await fs.readFile(path.join(repoRoot, "app", "utils", "svgLayerTrace.server.ts"), "utf8");
  const presetSource = await fs.readFile(
    path.join(repoRoot, "app", "client", "lib", "converter", "presetAdditions.ts"),
    "utf8",
  );
  const flatPresetIndex = presetSource.indexOf('id: "layered-flat-color"');
  const flatPreset =
    flatPresetIndex >= 0 ? presetSource.slice(flatPresetIndex, flatPresetIndex + 1600) : "";
  return {
    flatColorPresetRequestedPaletteCount: numberFromSource(flatPreset, "requestedPaletteCount"),
    flatColorPresetColorLayerCount: numberFromSource(flatPreset, "colorLayerCount"),
    clientFlatColorAdaptiveBudgetImplemented:
      /getAdaptiveFlatColorPaletteBudget|analyzeFlatColorPaletteBudget/i.test(worker),
    clientFlatColorHighFidelitySafeCapImplemented:
      /flatColorHighFidelity/i.test(worker) &&
      /shouldUseHighFidelityFlatColorPalette/i.test(worker),
    clientFlatColorGroupingCap:
      Number(worker.match(/FLAT_COLOR_MAX_EDITABLE_GROUPS\s*=\s*(\d+)/)?.[1] || 0) || null,
    serverAdaptivePaletteImplemented: /analyzeFlatColorAdaptivePalette/.test(server),
    serverAdaptivePaletteAllows32:
      /clampInt\(analysis\.target,\s*MIN_LAYER_COUNT,\s*32\)/.test(server) ||
      /target:\s*clampInt\(target,\s*MIN_LAYER_COUNT,\s*32\)/.test(server),
    fixtureNameHardcodingInProduction: findForbiddenFixtureTokens(worker, server, presetSource),
  };
}

function numberFromSource(source, key) {
  const match = source.match(new RegExp(`${key}:\\s*(\\d+)`));
  return match ? Number(match[1]) : null;
}

function findForbiddenFixtureTokens(...sources) {
  const forbidden = [
    "IMG_8846",
    "IMG_9288",
    "IMG_9404",
    "IMG_9448",
    "IMG_8487",
    "charming-tomato",
    "Screenshot 2026",
    "D:\\eBay",
    "C:\\Users\\Suhas",
  ];
  return forbidden.filter((token) => sources.some((source) => source.includes(token)));
}

async function resolveFixtures() {
  const fixtures = [];
  for (const spec of userFixtureSpecs) {
    if (await exists(spec.requested)) {
      fixtures.push({ ...spec, path: spec.requested, source: "available-user-fixture" });
    }
  }
  const generated = [
    { id: "generated-simple-logo", role: "simple-logo", requested: path.join(fixtureDir, "generated-simple-logo.png") },
    { id: "generated-low-color", role: "low-color", requested: path.join(fixtureDir, "generated-low-color.png") },
    { id: "generated-high-color-noisy", role: "high-detail-generated", requested: path.join(fixtureDir, "generated-high-color-noisy.png") },
  ];
  for (const spec of generated) {
    fixtures.push({ ...spec, path: spec.requested, source: "generated" });
  }
  return fixtures;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureGeneratedFixtures() {
  await fs.mkdir(fixtureDir, { recursive: true });
  await fs.writeFile(
    path.join(fixtureDir, "generated-simple-logo.png"),
    await sharp(Buffer.from(simpleLogoSvg())).png().toBuffer(),
  );
  await fs.writeFile(
    path.join(fixtureDir, "generated-low-color.png"),
    await sharp(Buffer.from(lowColorSvg())).png().toBuffer(),
  );
  await fs.writeFile(
    path.join(fixtureDir, "generated-high-color-noisy.png"),
    await generatedHighColorNoisyPng(),
  );
}

async function loadAnalysisImage(filePath) {
  const { data, info } = await sharp(filePath, { limitInputPixels: false })
    .rotate()
    .resize({
      width: analysisMaxSide,
      height: analysisMaxSide,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    path: filePath,
    data: new Uint8ClampedArray(data),
    width: info.width | 0,
    height: info.height | 0,
  };
}

function quantizeToBudget(source, budget) {
  const pointContainer = imageQUtils.PointContainer.fromUint8Array(source.data, source.width, source.height);
  const palette = buildPaletteSync([pointContainer], {
    colors: budget,
    colorDistanceFormula: "ciede2000",
    paletteQuantization: "wuquant",
  });
  const quantized = applyPaletteSync(pointContainer, palette, {
    colorDistanceFormula: "ciede2000",
    imageQuantization: "nearest",
  }).toUint8Array();
  return {
    data: new Uint8ClampedArray(quantized),
    width: source.width,
    height: source.height,
  };
}

function analyzeSourceComplexity(source) {
  const colorBuckets = new Set();
  const hueBuckets = new Set();
  const familyCounts = new Map();
  let sampled = 0;
  let darkPixels = 0;
  let darkDetailPixels = 0;
  let edgePixels = 0;
  const step = Math.max(1, Math.floor((source.width * source.height) / 45000));
  for (let pixel = 0; pixel < source.width * source.height; pixel += step) {
    const offset = pixel * 4;
    if (source.data[offset + 3] < 18) continue;
    const rgb = readRgb(source.data, offset);
    const luma = luminance(rgb);
    const sat = saturation(rgb);
    sampled += 1;
    colorBuckets.add(`${Math.floor(rgb.r / 16)},${Math.floor(rgb.g / 16)},${Math.floor(rgb.b / 16)}`);
    if (sat >= 36) hueBuckets.add(Math.floor(hueDegrees(rgb) / 20));
    const family = colorFamily(rgb);
    familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
    if (luma < 72) darkPixels += 1;
  }
  const edgeMask = buildEdgeMask(source);
  for (let i = 0; i < edgeMask.length; i += 1) {
    if (!edgeMask[i]) continue;
    edgePixels += 1;
    const offset = i * 4;
    if (source.data[offset + 3] >= 18 && luminance(readRgb(source.data, offset)) < 96) {
      darkDetailPixels += 1;
    }
  }
  const meaningfulFamilies = [...familyCounts.values()].filter((count) => count / Math.max(1, sampled) >= 0.015).length;
  return {
    sampledPixels: sampled,
    bucketCount: colorBuckets.size,
    hueBucketCount: hueBuckets.size,
    familyCount: meaningfulFamilies,
    darkPixelShare: round(darkPixels / Math.max(1, sampled)),
    edgeDensity: round(edgePixels / Math.max(1, source.width * source.height)),
    darkDetailDensity: round(darkDetailPixels / Math.max(1, source.width * source.height)),
    highDetailScore: round(
      Math.min(1, colorBuckets.size / 520) * 0.34 +
        Math.min(1, hueBuckets.size / 12) * 0.16 +
        Math.min(1, meaningfulFamilies / 8) * 0.16 +
        Math.min(1, edgePixels / Math.max(1, source.width * source.height) / 0.19) * 0.2 +
        Math.min(1, darkDetailPixels / Math.max(1, source.width * source.height) / 0.035) * 0.14,
    ),
  };
}

function isHighDetailFixture(fixture, sourceMetrics) {
  if (/high-detail|card|screenshot|blue-card/i.test(fixture.role)) return true;
  return sourceMetrics.highDetailScore >= 0.58;
}

function analyzeBudget(source, output, budget) {
  const edgeMask = buildEdgeMask(source);
  const outputEdgeMask = buildEdgeMask(output);
  let visible = 0;
  let distanceSum = 0;
  let darkInput = 0;
  let darkOutputOnDarkInput = 0;
  let darkDetailInput = 0;
  let darkDetailOutput = 0;
  let edgeInput = 0;
  let edgeOutput = 0;
  const visibleColors = new Set();
  for (let pixel = 0; pixel < source.width * source.height; pixel += 1) {
    const offset = pixel * 4;
    if (source.data[offset + 3] < 18 && output.data[offset + 3] < 18) continue;
    const inputRgb = readRgb(source.data, offset);
    const outputRgb = readRgb(output.data, offset);
    const inputLuma = luminance(inputRgb);
    const outputLuma = luminance(outputRgb);
    visible += 1;
    visibleColors.add(rgbToHex(outputRgb));
    distanceSum += colorDistance(inputRgb, outputRgb);
    if (inputLuma < 80) {
      darkInput += 1;
      if (outputLuma < 112) darkOutputOnDarkInput += 1;
    }
    if (edgeMask[pixel]) {
      edgeInput += 1;
      if (outputEdgeMask[pixel]) edgeOutput += 1;
      if (inputLuma < 105) {
        darkDetailInput += 1;
        if (outputLuma < 125 || outputEdgeMask[pixel]) darkDetailOutput += 1;
      }
    }
  }
  const averageColorError = distanceSum / Math.max(1, visible);
  const localColorSimilarity = clamp01(1 - averageColorError / 165);
  const darkForegroundRetention = darkOutputOnDarkInput / Math.max(1, darkInput);
  const darkDetailRetention = darkDetailOutput / Math.max(1, darkDetailInput);
  const highContrastEdgeRetention = edgeOutput / Math.max(1, edgeInput);
  const regionFidelityScore = analyzeRegionFidelity(source, output);
  const overFlatteningScore = clamp01(
    (1 - localColorSimilarity) * 0.34 +
      (1 - regionFidelityScore) * 0.24 +
      (1 - darkDetailRetention) * 0.22 +
      (1 - highContrastEdgeRetention) * 0.2,
  );
  return {
    budget,
    visibleColorCount: visibleColors.size,
    averageColorError: round(averageColorError),
    localColorSimilarity: round(localColorSimilarity),
    darkForegroundRetention: round(darkForegroundRetention),
    darkDetailRetention: round(darkDetailRetention),
    highContrastEdgeRetention: round(highContrastEdgeRetention),
    regionFidelityScore: round(regionFidelityScore),
    overFlatteningScore: round(overFlatteningScore),
    keyStructurePreserved:
      darkDetailRetention >= 0.5 &&
      highContrastEdgeRetention >= 0.42 &&
      regionFidelityScore >= 0.68,
    visuallyMeaningful:
      localColorSimilarity >= 0.72 &&
      darkDetailRetention >= 0.46 &&
      regionFidelityScore >= 0.64,
  };
}

function traceQuantizedBudgetToSvg(quantized, dimensions) {
  const counts = collectColorCounts(quantized);
  const layers = [];
  for (const entry of counts) {
    const mask = new Uint8ClampedArray(quantized.width * quantized.height * 4);
    for (let pixel = 0; pixel < quantized.width * quantized.height; pixel += 1) {
      const offset = pixel * 4;
      const color = rgbToHex(readRgb(quantized.data, offset));
      const isMatch = quantized.data[offset + 3] >= 18 && color === entry.color;
      const value = isMatch ? 0 : 255;
      mask[offset] = value;
      mask[offset + 1] = value;
      mask[offset + 2] = value;
      mask[offset + 3] = 255;
    }
    const tracer = new Potrace({ data: mask, width: quantized.width, height: quantized.height }, () => {});
    const svg = tracer.getSVG();
    const pathTags = (svg.match(/<path\b[^>]*>/gi) || [])
      .map((tag) =>
        tag
          .replace(/\sfill\s*=\s*["'][^"']*["']/gi, "")
          .replace(/\sstroke\s*=\s*["'][^"']*["']/gi, "")
          .replace(/\s\/?>$/i, " />"),
      )
      .join("");
    if (!pathTags) continue;
    layers.push({
      color: entry.color,
      pathTags,
      pathCount: (pathTags.match(/<path\b/gi) || []).length,
    });
  }
  const body = layers
    .map(
      (layer, index) =>
        `<g id="diagnostic-layer-${index + 1}-${layer.color.slice(1)}" data-layer-id="diagnostic-layer-${index + 1}-${layer.color.slice(1)}" data-layer-color="${layer.color}" fill="${layer.color}">${layer.pathTags}</g>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" viewBox="0 0 ${dimensions.width} ${dimensions.height}">${body}</svg>`;
  return {
    svg,
    groupedColorCount: layers.length,
    pathCount: layers.reduce((sum, layer) => sum + layer.pathCount, 0),
  };
}

function collectColorCounts(image) {
  const counts = new Map();
  for (let offset = 0; offset < image.data.length; offset += 4) {
    if (image.data[offset + 3] < 18) continue;
    const color = rgbToHex(readRgb(image.data, offset));
    const current = counts.get(color);
    if (current) current.count += 1;
    else counts.set(color, { color, count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.color.localeCompare(b.color));
}

async function tryConvertCurrentAppOutput(filePath) {
  try {
    const bytes = await fs.readFile(filePath);
    const form = new FormData();
    form.append("file", new File([bytes], path.basename(filePath), { type: mimeForPath(filePath) }));
    for (const [key, value] of Object.entries(flatColorSettings)) form.append(key, value);
    const response = await fetch(new URL("/?index", baseUrl), {
      method: "POST",
      body: form,
      headers: {
        Origin: baseUrl.replace(/\/$/, ""),
        Referer: baseUrl,
      },
    });
    const body = await response.text();
    const svg = extractSvg(body);
    const colors = [...new Set([...svg.matchAll(/data-layer-color="(#[0-9a-fA-F]{6})"/g)].map((match) => match[1].toLowerCase()))];
    const previewHash = crypto.createHash("sha256").update(svg).digest("hex");
    return {
      ok: response.ok && svg.startsWith("<svg"),
      status: response.status,
      enginePath: readEnginePath(body),
      groupedColorCount: colors.length,
      pathCount: (svg.match(/<path\b/gi) || []).length,
      svgByteSize: Buffer.byteLength(svg, "utf8"),
      visibleColorCount: colors.length,
      layerRowCount: colors.length,
      copyDownloadParity: {
        ok: true,
        scope: "direct action response uses the same serialized SVG payload for preview, copy, and download state",
        previewHash,
      },
      layerEditability: analyzeLayerEditability(svg),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      enginePath: "unknown",
      groupedColorCount: null,
      pathCount: null,
      svgByteSize: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function analyzeLayerEditability(svg) {
  const groups = [...svg.matchAll(/<g\b[^>]*data-layer-id="([^"]+)"[^>]*>[\s\S]*?<\/g>/g)];
  const firstGroup = groups[0]?.[0] || "";
  const firstColor = firstGroup.match(/data-layer-color="(#[0-9a-fA-F]{6})"/)?.[1] || null;
  const recolored = firstColor ? firstGroup.replaceAll(firstColor, "#ff0066") : firstGroup;
  const hiddenSvg = svg.replace(/<g\b[^>]*data-layer-id="[^"]+"[^>]*>[\s\S]*?<\/g>/g, "");
  return {
    groupCount: groups.length,
    recolorChangesSvg: firstColor ? recolored !== firstGroup : false,
    hideAllRemovesPaths: (hiddenSvg.match(/<path\b/gi) || []).length === 0,
  };
}

function chooseBestBudget(results, ceiling) {
  const candidates = results.filter((result) => result.budget <= ceiling && result.actualGroupedColorCount <= allowedCeiling);
  return [...candidates].sort(scoreBudgetResult).at(-1) || null;
}

function chooseSmallestAcceptableBudget(results, highDetail) {
  const minSimilarity = highDetail ? 0.76 : 0.68;
  const minDark = highDetail ? 0.5 : 0.35;
  const minRegion = highDetail ? 0.66 : 0.58;
  return (
    results.find(
      (result) =>
        result.localColorSimilarity >= minSimilarity &&
        result.darkDetailRetention >= minDark &&
        result.regionFidelityScore >= minRegion &&
        result.actualGroupedColorCount <= allowedCeiling,
    ) || null
  );
}

function scoreBudgetResult(a, b) {
  return budgetQualityScore(a) - budgetQualityScore(b) || a.budget - b.budget;
}

function budgetQualityScore(result) {
  return (
    result.localColorSimilarity * 0.34 +
    result.regionFidelityScore * 0.24 +
    result.darkDetailRetention * 0.2 +
    result.highContrastEdgeRetention * 0.14 -
    result.overFlatteningScore * 0.08
  );
}

function materialImprovement(currentBudget, bestBudget) {
  if (!currentBudget || !bestBudget) {
    return { material: false, reason: "missing comparison budget" };
  }
  const similarityGain = bestBudget.localColorSimilarity - currentBudget.localColorSimilarity;
  const regionGain = bestBudget.regionFidelityScore - currentBudget.regionFidelityScore;
  const darkGain = bestBudget.darkDetailRetention - currentBudget.darkDetailRetention;
  const flatteningDrop = currentBudget.overFlatteningScore - bestBudget.overFlatteningScore;
  const material =
    bestBudget.budget >= 28 &&
    (
      similarityGain >= 0.025 ||
      regionGain >= 0.035 ||
      darkGain >= 0.08 ||
      flatteningDrop >= 0.04
    );
  return {
    material,
    similarityGain: round(similarityGain),
    regionGain: round(regionGain),
    darkDetailGain: round(darkGain),
    overFlatteningDrop: round(flatteningDrop),
    reason: material
      ? "higher budget materially improves at least one fidelity/detail signal"
      : "higher budget improvement is below material thresholds",
  };
}

function nearestBudgetResult(results, budget) {
  return results.find((result) => result.budget === budget) || null;
}

function buildEdgeMask(image) {
  const mask = new Uint8Array(image.width * image.height);
  for (let y = 1; y < image.height - 1; y += 1) {
    for (let x = 1; x < image.width - 1; x += 1) {
      const center = lumaAt(image, x, y);
      const dx = Math.abs(center - lumaAt(image, x + 1, y)) + Math.abs(center - lumaAt(image, x - 1, y));
      const dy = Math.abs(center - lumaAt(image, x, y + 1)) + Math.abs(center - lumaAt(image, x, y - 1));
      if (dx + dy >= 62) mask[y * image.width + x] = 1;
    }
  }
  return mask;
}

function lumaAt(image, x, y) {
  const offset = (y * image.width + x) * 4;
  if (image.data[offset + 3] < 18) return 255;
  return luminance(readRgb(image.data, offset));
}

function analyzeRegionFidelity(input, output) {
  const grid = 4;
  let matched = 0;
  let checked = 0;
  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      const inputFamily = dominantFamily(input, row, col, grid);
      const outputFamily = dominantFamily(output, row, col, grid);
      if (!inputFamily) continue;
      checked += 1;
      if (familiesCompatible(inputFamily, outputFamily)) matched += 1;
    }
  }
  return matched / Math.max(1, checked);
}

function dominantFamily(image, row, col, grid) {
  const counts = new Map();
  const x0 = Math.floor((col / grid) * image.width);
  const x1 = Math.floor(((col + 1) / grid) * image.width);
  const y0 = Math.floor((row / grid) * image.height);
  const y1 = Math.floor(((row + 1) / grid) * image.height);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = (y * image.width + x) * 4;
      if (image.data[offset + 3] < 18) continue;
      const family = colorFamily(readRgb(image.data, offset));
      counts.set(family, (counts.get(family) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function familiesCompatible(a, b) {
  if (a === b) return true;
  const compatible = [
    new Set(["dark", "neutral"]),
    new Set(["lightNeutral", "neutral"]),
    new Set(["blue", "cyan", "purple"]),
    new Set(["red", "orange", "pink"]),
    new Set(["yellow", "orange"]),
  ];
  return compatible.some((set) => set.has(a) && set.has(b));
}

function readRgb(data, offset) {
  return { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
}

function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr * 0.28 + dg * dg * 0.56 + db * db * 0.16);
}

function luminance(color) {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

function saturation(color) {
  const max = Math.max(color.r, color.g, color.b) / 255;
  const min = Math.min(color.r, color.g, color.b) / 255;
  return max <= 0 ? 0 : ((max - min) / max) * 100;
}

function hueDegrees(color) {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta <= 0) return 0;
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

function colorFamily(color) {
  const lum = luminance(color);
  const sat = saturation(color);
  if (lum < 48) return "dark";
  if (lum > 236 && sat <= 16) return "lightNeutral";
  if (sat <= 22) return lum > 190 ? "lightNeutral" : "neutral";
  const hue = hueDegrees(color);
  if (hue < 18 || hue >= 342) return "red";
  if (hue < 48) return "orange";
  if (hue < 72) return "yellow";
  if (hue < 155) return "green";
  if (hue < 190) return "cyan";
  if (hue < 255) return "blue";
  if (hue < 292) return "purple";
  return "pink";
}

function rgbToHex(color) {
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function toHex(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function mimeForPath(filePath) {
  return /\.png$/i.test(filePath) ? "image/png" : "image/jpeg";
}

function extractSvg(body) {
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed.svg === "string") return parsed.svg;
  }
  const start = body.indexOf("\\u003csvg");
  const endToken = "\\u003c/svg\\u003e";
  const end = body.indexOf(endToken, start);
  if (start < 0 || end < 0) throw new Error("Could not find serialized SVG in response.");
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

function simpleLogoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="64" fill="#f8fafc"/><circle cx="190" cy="220" r="96" fill="#2563eb"/><circle cx="190" cy="220" r="46" fill="#38bdf8"/><path d="M130 350 C190 300 270 315 336 370" fill="none" stroke="#111827" stroke-width="34" stroke-linecap="round"/><rect x="292" y="128" width="120" height="154" rx="24" fill="#facc15"/></svg>`;
}

function lowColorSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#ffffff"/><rect x="74" y="88" width="364" height="294" rx="40" fill="#0ea5e9"/><circle cx="184" cy="226" r="68" fill="#f97316"/><path d="M154 346 L254 166 L370 346 Z" fill="#22c55e"/><path d="M132 414 H390" stroke="#111827" stroke-width="26" stroke-linecap="round"/></svg>`;
}

async function generatedHighColorNoisyPng() {
  const width = 720;
  const height = 520;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const wave = Math.sin(x / 18) * 24 + Math.cos(y / 21) * 22;
      const card = x > 70 && x < 650 && y > 42 && y < 474;
      const stripe = Math.floor((x + y) / 42) % 6;
      const textBand = y > 70 && y < 150 && x > 110 && x < 610;
      data[offset] = clampByte((card ? 88 + stripe * 23 : 232) + wave + ((x * 13 + y * 7) % 19));
      data[offset + 1] = clampByte((card ? 112 + stripe * 17 : 238) + wave * 0.7 + ((x * 5 + y * 11) % 17));
      data[offset + 2] = clampByte((card ? 150 + stripe * 13 : 244) - wave * 0.5 + ((x * 3 + y * 19) % 23));
      data[offset + 3] = 255;
      if (textBand && (Math.floor((x - 110) / 22) % 2 === 0 || Math.abs(y - 112) < 8)) {
        data[offset] = 12;
        data[offset + 1] = 18;
        data[offset + 2] = 28;
      }
      if (card && (Math.abs(x - 70) < 5 || Math.abs(x - 650) < 5 || Math.abs(y - 42) < 5 || Math.abs(y - 474) < 5)) {
        data[offset] = 10;
        data[offset + 1] = 14;
        data[offset + 2] = 24;
      }
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
