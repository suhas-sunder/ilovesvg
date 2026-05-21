import { execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const execFile = promisify(execFileCallback);

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = getSmokeBaseUrl();
const reportPath = process.env.PALETTE_GROUPING_AUDIT_REPORT_PATH
  ? path.resolve(process.env.PALETTE_GROUPING_AUDIT_REPORT_PATH)
  : path.join(rootDir, "tmp", "palette-grouping-audit.json");
const coverageReportPath = process.env.SETTINGS_COLOR_COVERAGE_REPORT_PATH
  ? path.resolve(process.env.SETTINGS_COLOR_COVERAGE_REPORT_PATH)
  : path.join(rootDir, "tmp", "settings-color-coverage-audit.json");

const screenshotFixturePath =
  process.env.PALETTE_GROUPING_SCREENSHOT_FIXTURE ||
  "C:\\Users\\Suhas\\Downloads\\Screenshot 2026-05-06 194041.png";
const tomatoFixturePath =
  process.env.PALETTE_GROUPING_TOMATO_FIXTURE ||
  "C:\\Users\\Suhas\\Downloads\\charming-tomato-512x512.png";

const fixtureOutputDir = path.join(rootDir, "tmp", "palette-grouping-audit-fixtures");
const FLAT_COLOR_MAX_EDITABLE_GROUPS = 32;
const FLAT_COLOR_RAW_EXPOSURE_REGRESSION_THRESHOLD = 160;

const presetContracts = [
  {
    id: "layered-flat-color",
    label: "Layered - Flat Color",
    sourceIds: ["layered-flat-color"],
    target: "Clean flat editable color blocks.",
    typicalRange: [8, 20],
    maxEditableGroups: 30,
    groupingAggressiveness: "strong",
    collapseAntialiasing: true,
    collapseDarkLight: true,
    collapseTinyRegions: true,
    qualityRisk: "medium",
    performanceRisk: "low after grouping, high if left raw",
    suggestedFirstBatch: true,
  },
  {
    id: "layered-8-color",
    label: "Layered - 8 Color",
    sourceIds: ["layered-8-color"],
    target: "A deliberately compact layered palette.",
    typicalRange: [6, 10],
    maxEditableGroups: 12,
    groupingAggressiveness: "strong",
    collapseAntialiasing: true,
    collapseDarkLight: true,
    collapseTinyRegions: true,
    qualityRisk: "low",
    performanceRisk: "low",
  },
  {
    id: "layered-poster",
    label: "Layered - Poster",
    sourceIds: ["layered-poster", "layered-soft-poster"],
    target: "Posterized color regions with simplified tonal steps.",
    typicalRange: [5, 14],
    maxEditableGroups: 18,
    groupingAggressiveness: "strong",
    collapseAntialiasing: true,
    collapseDarkLight: true,
    collapseTinyRegions: true,
    qualityRisk: "medium",
    performanceRisk: "low",
  },
  {
    id: "layered-detail",
    label: "Layered - Detail",
    sourceIds: ["layered-detail"],
    target: "Detailed layered color output where more meaningful tones may remain editable.",
    typicalRange: [16, 28],
    maxEditableGroups: 30,
    groupingAggressiveness: "moderate",
    collapseAntialiasing: true,
    collapseDarkLight: true,
    collapseTinyRegions: "mostly",
    qualityRisk: "medium-high",
    performanceRisk: "medium",
  },
  {
    id: "layered-low-noise",
    label: "Layered - Low Noise",
    sourceIds: ["layered-low-noise"],
    target: "Simple low-noise layers for easy editing and cutting.",
    typicalRange: [3, 8],
    maxEditableGroups: 12,
    groupingAggressiveness: "very strong",
    collapseAntialiasing: true,
    collapseDarkLight: true,
    collapseTinyRegions: true,
    qualityRisk: "low-medium",
    performanceRisk: "low",
  },
  {
    id: "layered-cut-friendly",
    label: "Layered - Cut Friendly",
    sourceIds: ["layered-cut-friendly"],
    target: "Few, clean, weedable shapes.",
    typicalRange: [2, 6],
    maxEditableGroups: 8,
    groupingAggressiveness: "very strong",
    collapseAntialiasing: true,
    collapseDarkLight: true,
    collapseTinyRegions: true,
    qualityRisk: "low for cut use, medium for art fidelity",
    performanceRisk: "low",
  },
  {
    id: "filled-layers-separate-colors",
    label: "Filled Layers - Separate Colors",
    sourceIds: ["filled-layers-separate-colors"],
    target: "Separate filled color regions without overlap.",
    typicalRange: [8, 18],
    maxEditableGroups: 24,
    groupingAggressiveness: "moderate-strong",
    collapseAntialiasing: true,
    collapseDarkLight: true,
    collapseTinyRegions: true,
    qualityRisk: "medium",
    performanceRisk: "medium",
  },
  {
    id: "photo-many-colors",
    label: "Photo Many Colors",
    sourceIds: ["photo-many-colors"],
    target: "High-color photo-like output for visual fidelity, not simple cutting.",
    typicalRange: [24, 32],
    maxEditableGroups: 32,
    groupingAggressiveness: "light",
    collapseAntialiasing: "selective",
    collapseDarkLight: "selective",
    collapseTinyRegions: "only noise",
    qualityRisk: "high if over-grouped",
    performanceRisk: "high unless UI remains windowed",
  },
];

const measuredScenarioToContract = new Map([
  ["home-layered-flat-color", "layered-flat-color"],
  ["png-layered-flat-color", "layered-flat-color"],
  ["jpg-layered-flat-color", "layered-flat-color"],
]);

async function main() {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.mkdir(fixtureOutputDir, { recursive: true });

  const [server, git, coverageReport, presetSource, fixtures] = await Promise.all([
    serverState(),
    gitState(),
    readCoverageReport(),
    readPresetSource(),
    prepareFixtures(),
  ]);

  const sourceInspection = inspectSourcePaths(presetSource);
  const measuredOutputs = analyzeCoverageScenarios(coverageReport);
  const fixtureAnalyses = [];
  for (const fixture of fixtures) {
    fixtureAnalyses.push(await analyzeFixture(fixture));
  }

  const contractTable = buildContractTable(sourceInspection.presets);
  const fixturePresetMatrix = buildFixturePresetMatrix(fixtureAnalyses, contractTable);
  const recommendations = buildRecommendations(measuredOutputs, fixtureAnalyses, contractTable);
  const summary = summarize(measuredOutputs, fixtureAnalyses, recommendations);
  const implementationFailures = flatColorImplementationFailures(measuredOutputs);
  const ok =
    Boolean(coverageReport?.summary?.ok) &&
    measuredOutputs.length > 0 &&
    implementationFailures.length === 0;

  const report = {
    schemaVersion: 1,
    auditKind: "palette-grouping-audit",
    checkedAt: new Date().toISOString(),
    baseUrl,
    server,
    git,
    coverageReportPath,
    fixtures,
    sourceInspection,
    measuredOutputs,
    fixtureAnalyses,
    fixturePresetMatrix,
    presetContracts: contractTable,
    recommendations,
    summary,
    implementationFailures,
  };

  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        ok,
        reportPath,
        coverageReportPath,
        measuredScenarioCount: measuredOutputs.length,
        fixtureCount: fixtureAnalyses.length,
        summary,
        implementationFailures,
      },
      null,
      2,
    ),
  );

  if (!ok) {
    process.exitCode = 1;
  }
}

async function readCoverageReport() {
  try {
    const raw = await fs.readFile(coverageReportPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed?.summary?.ok) {
      throw new Error("settings color coverage report exists but is not ok");
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `Palette grouping audit needs a fresh settings color coverage report at ${coverageReportPath}. Run npm.cmd run test:settings-color-coverage first. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function readPresetSource() {
  const file = path.join(rootDir, "app", "client", "lib", "converter", "presetAdditions.ts");
  return {
    file,
    text: await fs.readFile(file, "utf8"),
  };
}

function inspectSourcePaths(presetSource) {
  const textFiles = [
    "app/client/workers/vtracer.worker.ts",
    "app/utils/svgLayerTrace.server.ts",
    "app/routes/home.tsx",
    "app/routes/png-to-layered-svg-for-cricut.tsx",
    "app/routes/jpg-to-layered-svg-for-cricut.tsx",
    "app/client/lib/converter/outputAppearance.ts",
    "app/client/lib/converter/svgEditingModel.ts",
  ];
  const findings = {
    rawColorCreation: [
      "client worker quantizeLayeredPixels collects image-q palette output, then VTracer may emit more SVG fill colors than requested palette colors",
      "server layered trace builds explicit grouped masks from paletteRgb and returns grouped pathTags",
      "homepage stores the final VTracer SVG directly and completes Layer colors from final data-fill-layer-id attributes",
    ],
    paletteCaps: [
      "client getSafeLayeredPaletteCount caps per-color-cutout at 18/16/14/12 by pixel count",
      "server layered routes still expose route-local MAX_LAYER_COUNT 10 for classic grouped mask builders",
      "editable row coverage intentionally no longer slices homepage final annotated SVG rows to the palette cap",
    ],
    rowSources: [
      "homepage rows can be derived from raw annotated path fill colors in the final SVG",
      "PNG/JPG route rows are mostly route-local layer metadata from grouped pathTags",
      "svgEditingModel and outputAppearance can also build color and layer targets from data-fill-layer-id/data-stroke-layer-id",
    ],
    alphaHandling: [
      "transparent pixels are masked before and after client quantization",
      "server collect/assign paths skip alpha below 18 when removeTransparent is true",
      "recent alpha boundary clipping keeps route-local rebuilds inside source silhouette",
    ],
    inspectedFiles: textFiles,
    presets: extractRelevantPresetSettings(presetSource.text),
  };
  return findings;
}

function extractRelevantPresetSettings(source) {
  return presetContracts.map((contract) => {
    const matched = contract.sourceIds
      .map((id) => extractPresetBlock(source, id))
      .filter(Boolean);
    return {
      id: contract.id,
      label: contract.label,
      foundSourceIds: matched.map((item) => item.id),
      sourceSettings: matched.map((item) => item.settings),
    };
  });
}

function extractPresetBlock(source, id) {
  const idPattern = new RegExp(`id:\\s*["']${escapeRegExp(id)}["']`);
  const idMatch = idPattern.exec(source);
  if (!idMatch) return null;
  const start = Math.max(0, source.lastIndexOf("{", idMatch.index));
  const nextPreset = source.indexOf("\n  {", idMatch.index + 1);
  const end = nextPreset > 0 ? nextPreset : source.indexOf("\n];", idMatch.index);
  const block = source.slice(start, end > start ? end : idMatch.index + 1200);
  const settings = {};
  for (const key of [
    "colorLayerCount",
    "requestedPaletteCount",
    "layerBuildMode",
    "paletteAlgorithm",
    "paletteDistance",
    "layerMaxTraceSide",
    "minRegionPercent",
    "layerOptTolerance",
    "layerTurdSize",
    "posterize",
    "posterizeStrength",
    "removeWhite",
    "removeTransparent",
    "transparent",
    "colorMergeTolerance",
    "minIslandPx",
    "holeFillPx",
    "sortLayersBy",
  ]) {
    const valueMatch = new RegExp(`${escapeRegExp(key)}:\\s*([^,\\n}]+)`).exec(block);
    if (valueMatch) settings[key] = parseSourceLiteral(valueMatch[1].trim());
  }
  return { id, settings };
}

function parseSourceLiteral(value) {
  const cleaned = value.replace(/,$/, "").trim();
  if (/^["']/.test(cleaned)) return cleaned.replace(/^["']|["']$/g, "");
  if (cleaned === "true") return true;
  if (cleaned === "false") return false;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : cleaned;
}

async function prepareFixtures() {
  const fixtures = [];
  const screenshot = await fixtureInfo(screenshotFixturePath, "screenshot-ui", "real-user-screenshot");
  if (screenshot) fixtures.push(screenshot);
  const tomato = await fixtureInfo(tomatoFixturePath, "transparent-tomato", "real-user-transparent-sticker");
  if (tomato) fixtures.push(tomato);
  fixtures.push(await createSimpleLogoFixture());
  fixtures.push(await createNoisyPhotoFixture());
  return fixtures;
}

async function fixtureInfo(filePath, id, source) {
  try {
    const stat = await fs.stat(filePath);
    const metadata = await sharp(filePath).metadata();
    return {
      id,
      source,
      path: filePath,
      exists: true,
      bytes: stat.size,
      width: metadata.width || null,
      height: metadata.height || null,
      format: metadata.format || null,
      hasAlpha: Boolean(metadata.hasAlpha),
    };
  } catch {
    return null;
  }
}

async function createSimpleLogoFixture() {
  const filePath = path.join(fixtureOutputDir, "simple-logo.png");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
<rect width="640" height="480" fill="transparent"/>
<circle cx="230" cy="235" r="128" fill="#1d4ed8"/>
<circle cx="230" cy="235" r="72" fill="#38bdf8"/>
<rect x="335" y="150" width="170" height="170" rx="28" fill="#f97316"/>
<path d="M126 365 C215 285 322 302 404 385" fill="none" stroke="#0f172a" stroke-width="28" stroke-linecap="round"/>
<circle cx="444" cy="218" r="28" fill="#ffffff"/>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(filePath);
  return fixtureInfo(filePath, "simple-logo", "generated-small-logo");
}

async function createNoisyPhotoFixture() {
  const filePath = path.join(fixtureOutputDir, "noisy-photo-like.png");
  const width = 360;
  const height = 260;
  const raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const off = (y * width + x) * 4;
      const wave = Math.sin(x / 18) * 22 + Math.cos(y / 21) * 18;
      const grain = ((x * 17 + y * 31) % 29) - 14;
      raw[off] = clampByte(80 + x * 0.32 + wave + grain);
      raw[off + 1] = clampByte(95 + y * 0.38 + wave * 0.4 - grain);
      raw[off + 2] = clampByte(135 + (x + y) * 0.12 - wave + grain * 0.7);
      raw[off + 3] = 255;
    }
  }
  await sharp(raw, { raw: { width, height, channels: 4 } }).png().toFile(filePath);
  return fixtureInfo(filePath, "noisy-photo-like", "generated-noisy-photo-like");
}

async function analyzeFixture(fixture) {
  const image = sharp(fixture.path).ensureAlpha();
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const raw = await image.raw().toBuffer();
  const sampleStep = Math.max(1, Math.floor((width * height) / 60000));
  const colors = new Map();
  let visiblePixels = 0;
  let transparentPixels = 0;
  for (let pixel = 0; pixel < width * height; pixel += sampleStep) {
    const off = pixel * 4;
    const alpha = raw[off + 3];
    if (alpha < 18) {
      transparentPixels += 1;
      continue;
    }
    visiblePixels += 1;
    const color = rgbToHex({
      r: raw[off],
      g: raw[off + 1],
      b: raw[off + 2],
    });
    const item = colors.get(color) || { color, uses: 0 };
    item.uses += 1;
    colors.set(color, item);
  }
  const entries = Array.from(colors.values()).sort((a, b) => b.uses - a.uses);
  const clusterAnalysis = analyzeColorSet(entries, { source: "fixture", visiblePixels });
  return {
    id: fixture.id,
    source: fixture.source,
    width,
    height,
    visibleSampleCount: visiblePixels,
    transparentSampleCount: transparentPixels,
    sampledUniqueColors: entries.length,
    clusterAnalysis,
  };
}

function analyzeCoverageScenarios(coverageReport) {
  return (coverageReport.scenarios || []).map((scenario) => {
    const colors =
      scenario.svgAnalysisBeforeHide?.colors ||
      scenario.svgAnalysisBeforeHide?.entries ||
      [];
    const normalizedColors = Array.isArray(colors)
      ? colors
          .map((entry) => ({
            color: normalizeHex(entry.color),
            uses: Number(entry.uses || 1),
            channels: entry.channels || [],
            sources: entry.sources || [],
          }))
          .filter((entry) => entry.color)
      : [];
    const contractId = measuredScenarioToContract.get(scenario.id) || "unknown";
    const contract = presetContracts.find((item) => item.id === contractId);
    const clusterAnalysis = analyzeColorSet(normalizedColors, {
      source: "svg",
      targetMax: contract?.maxEditableGroups || 30,
    });
    return {
      id: scenario.id,
      route: scenario.route,
      preset: scenario.preset,
      fixture: scenario.fixture?.source || scenario.fixture?.basename || null,
      rawVisibleSvgColorCount: scenario.counts?.actualVisibleSvgColorsBeforeHide || normalizedColors.length,
      exposedLayerRowCount: scenario.counts?.layerRowsExposed || 0,
      remainingAfterHide: scenario.counts?.visibleColorsAfterHidingAllExposedLayerColors ?? null,
      pathCount:
        scenario.conversion?.latestPathCount ||
        scenario.latestOutput?.pathCountAttr ||
        scenario.svgAnalysisBeforeHide?.structural?.pathCount ||
        null,
      layerBuildMode: scenario.latestOutput?.layerBuildMode || null,
      requestedPaletteCount: scenario.latestOutput?.requestedPaletteCount || null,
      actualPaletteCount: scenario.latestOutput?.actualPaletteCount || null,
      clickToConvertDetectedColorSwatches:
        scenario.counts?.clickToConvertDetectedColorSwatches ?? null,
      contractId,
      clusterAnalysis,
      suggestedGroupedPaletteCount: suggestGroupedCount(clusterAnalysis, contract),
      suggestedMaxEditableGroups: contract?.maxEditableGroups || 30,
      qualityRisk: qualityRiskForScenario(clusterAnalysis, contract),
      performanceImpact: performanceImpactForScenario(scenario, clusterAnalysis),
    };
  });
}

function analyzeColorSet(entries, options = {}) {
  const colors = entries
    .map((entry) => {
      const color = normalizeHex(entry.color);
      if (!color) return null;
      const rgb = hexToRgb(color);
      const hsl = rgbToHsl(rgb);
      const lab = rgbToLab(rgb);
      return {
        color,
        uses: Math.max(1, Number(entry.uses || 1)),
        rgb,
        hsl,
        lab,
        luma: relativeLuma(rgb),
        chroma: Math.sqrt(lab.a * lab.a + lab.b * lab.b),
      };
    })
    .filter(Boolean);
  const totalUses = colors.reduce((sum, item) => sum + item.uses, 0) || 1;
  for (const color of colors) {
    color.percent = (color.uses / totalUses) * 100;
    color.tiny = color.percent < 0.15 || color.uses <= 1;
    color.nearBlack = color.luma <= 0.018 || (color.lab.L <= 14 && color.chroma <= 18);
    color.nearWhite = color.luma >= 0.88 && color.hsl.s <= 0.22;
  }

  const clusters = clusterNearDuplicates(colors);
  const nearBlack = colors.filter((item) => item.nearBlack);
  const nearWhite = colors.filter((item) => item.nearWhite);
  const tiny = colors.filter((item) => item.tiny);
  const nearDuplicateClusters = clusters.filter((cluster) => cluster.colors.length > 1);
  const bigClusters = nearDuplicateClusters
    .map((cluster) => summarizeCluster(cluster))
    .sort((a, b) => b.totalPercent - a.totalPercent || b.size - a.size);

  const majorColors = colors
    .filter((item) => item.percent >= 1 || (!item.tiny && item.chroma > 25))
    .sort((a, b) => b.percent - a.percent);

  return {
    source: options.source || "unknown",
    inputColorCount: colors.length,
    totalUses,
    nearDuplicateClusterCount: nearDuplicateClusters.length,
    nearDuplicateColorCount: nearDuplicateClusters.reduce((sum, cluster) => sum + cluster.colors.length, 0),
    nearBlackColorCount: nearBlack.length,
    nearBlackClusterCount: clusterNearDuplicates(nearBlack, { forceFamily: "black" }).filter(
      (cluster) => cluster.colors.length > 0,
    ).length,
    nearWhiteColorCount: nearWhite.length,
    nearWhiteClusterCount: clusterNearDuplicates(nearWhite, { forceFamily: "white" }).filter(
      (cluster) => cluster.colors.length > 0,
    ).length,
    tinyColorCount: tiny.length,
    tinyColorPercent: percentOf(tiny, totalUses),
    majorColorCount: majorColors.length,
    suggestedClusterCount: clusters.length,
    suggestedUiGroupCount: Math.min(options.targetMax || 30, Math.max(1, clusters.length)),
    largestClusters: bigClusters.slice(0, 12),
    preserveColorCount: majorColors.length,
    mergeCandidateCount: Math.max(0, colors.length - clusters.length),
    riskNotes: riskNotes(colors, clusters),
  };
}

function clusterNearDuplicates(colors, options = {}) {
  const sorted = [...colors].sort((a, b) => b.uses - a.uses || a.color.localeCompare(b.color));
  const clusters = [];
  for (const color of sorted) {
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const cluster of clusters) {
      const representative = cluster.representative;
      const threshold = clusterThreshold(color, representative, options);
      const distance = labDistance(color.lab, representative.lab);
      if (distance <= threshold && distance < bestDistance) {
        best = cluster;
        bestDistance = distance;
      }
    }
    if (best) {
      best.colors.push(color);
      best.totalUses += color.uses;
      if (color.uses > best.representative.uses) best.representative = color;
    } else {
      clusters.push({
        representative: color,
        colors: [color],
        totalUses: color.uses,
      });
    }
  }
  return clusters;
}

function clusterThreshold(left, right, options = {}) {
  if (options.forceFamily === "black") return 18;
  if (options.forceFamily === "white") return 14;
  if (left.nearBlack && right.nearBlack) return 18;
  if (left.nearWhite && right.nearWhite) return 14;
  if (left.tiny || right.tiny) return 10;
  if (left.chroma > 35 || right.chroma > 35) return 6.5;
  return 8.5;
}

function summarizeCluster(cluster) {
  const total = cluster.colors.reduce((sum, item) => sum + item.uses, 0) || 1;
  return {
    representative: cluster.representative.color,
    size: cluster.colors.length,
    totalUses: total,
    totalPercent: Number(cluster.colors.reduce((sum, item) => sum + item.percent, 0).toFixed(2)),
    family: cluster.representative.nearBlack
      ? "near-black"
      : cluster.representative.nearWhite
        ? "near-white"
        : cluster.representative.tiny
          ? "tiny-or-edge"
          : "mid-tone",
    maxDeltaE: Number(
      Math.max(
        0,
        ...cluster.colors.map((item) => labDistance(item.lab, cluster.representative.lab)),
      ).toFixed(2),
    ),
  };
}

function suggestGroupedCount(clusterAnalysis, contract) {
  const ceiling = contract?.maxEditableGroups || 30;
  const typical = contract?.typicalRange || [8, 24];
  const suggested = clusterAnalysis.suggestedClusterCount;
  if (suggested <= ceiling) return suggested;
  if (clusterAnalysis.tinyColorPercent > 20) return Math.min(ceiling, typical[1]);
  return ceiling;
}

function qualityRiskForScenario(clusterAnalysis, contract) {
  if (!contract) return "unknown";
  if (clusterAnalysis.inputColorCount > contract.maxEditableGroups * 4) return "medium-high";
  if (contract.id === "photo-many-colors" && clusterAnalysis.mergeCandidateCount > 20) return "high";
  if (clusterAnalysis.mergeCandidateCount > 10) return "medium";
  return "low";
}

function performanceImpactForScenario(scenario, clusterAnalysis) {
  const rows = Number(scenario.counts?.layerRowsExposed || 0);
  if (rows > 100) return "high current UI/edit-state impact, grouping should reduce row work materially";
  if (rows > 30) return "medium current UI impact, grouping should help";
  if (clusterAnalysis.mergeCandidateCount > 0) return "low current UI impact, possible minor simplification";
  return "low";
}

function riskNotes(colors, clusters) {
  const notes = [];
  const saturated = colors.filter((item) => item.chroma > 45 && !item.tiny);
  const tiny = colors.filter((item) => item.tiny);
  if (saturated.length > 8) {
    notes.push("Many saturated colors: use strict mid-tone thresholds to avoid merging meaningful hues.");
  }
  if (tiny.length > colors.length * 0.5) {
    notes.push("Most colors are tiny/noise candidates: area weighting should dominate grouping.");
  }
  if (clusters.length > 30) {
    notes.push("Suggested perceptual clusters still exceed UI ceiling: need preset-specific secondary pruning.");
  }
  if (!notes.length) notes.push("No unusual grouping risk found by the diagnostic heuristics.");
  return notes;
}

function buildContractTable(sourcePresetSettings) {
  return presetContracts.map((contract) => {
    const source = sourcePresetSettings.find((item) => item.id === contract.id);
    return {
      id: contract.id,
      label: contract.label,
      intendedUserOutcome: contract.target,
      desiredPaletteBehavior: `${contract.groupingAggressiveness} grouping, max ${contract.maxEditableGroups} editable groups`,
      suggestedTypicalColorRange: contract.typicalRange,
      hardMaximumEditableColorGroups: contract.maxEditableGroups,
      groupingAggressiveness: contract.groupingAggressiveness,
      collapseAntialiasingAndNoise: contract.collapseAntialiasing,
      collapseNearBlackNearWhite: contract.collapseDarkLight,
      mergeTinyRegions: contract.collapseTinyRegions,
      qualityRisk: contract.qualityRisk,
      performanceRisk: contract.performanceRisk,
      requiredFixtures: requiredFixturesForContract(contract.id),
      sourcePresetSettings: source?.sourceSettings || [],
      sourcePresetFound: Boolean(source?.foundSourceIds?.length),
    };
  });
}

function buildFixturePresetMatrix(fixtureAnalyses, contractTable) {
  return fixtureAnalyses.flatMap((fixture) =>
    contractTable.map((contract) => {
      const clusterAnalysis = fixture.clusterAnalysis;
      const projectedGroupedPaletteCount = projectGroupedCountForContract(
        clusterAnalysis,
        contract,
      );
      return {
        fixtureId: fixture.id,
        presetId: contract.id,
        presetLabel: contract.label,
        evidenceType: "fixture-color-projection",
        note:
          "Projection uses fixture pixel colors plus source-inspected preset contract; it is not a converted output measurement.",
        sampledUniqueColors: fixture.sampledUniqueColors,
        nearDuplicateClusterCount: clusterAnalysis.nearDuplicateClusterCount,
        nearBlackClusterCount: clusterAnalysis.nearBlackClusterCount,
        nearWhiteClusterCount: clusterAnalysis.nearWhiteClusterCount,
        tinyNoiseColorCount: clusterAnalysis.tinyColorCount,
        majorColorCount: clusterAnalysis.majorColorCount,
        projectedGroupedPaletteCount,
        hardMaximumEditableColorGroups: contract.hardMaximumEditableColorGroups,
        qualityRisk: projectedQualityRisk(clusterAnalysis, contract),
      };
    }),
  );
}

function projectGroupedCountForContract(clusterAnalysis, contract) {
  const [, typicalHigh] = contract.suggestedTypicalColorRange || [1, 30];
  const hardMax = contract.hardMaximumEditableColorGroups || 30;
  const clusterCount = clusterAnalysis.suggestedUiGroupCount || clusterAnalysis.suggestedClusterCount || 1;
  const majorCount = Math.max(1, clusterAnalysis.majorColorCount || 1);
  const base = Math.min(hardMax, clusterCount);
  if (/very strong/i.test(contract.groupingAggressiveness)) {
    return Math.max(1, Math.min(base, typicalHigh, majorCount + 2));
  }
  if (/strong/i.test(contract.groupingAggressiveness)) {
    return Math.max(1, Math.min(base, Math.max(typicalHigh, majorCount + 4)));
  }
  if (/light/i.test(contract.groupingAggressiveness)) {
    return Math.max(1, Math.min(hardMax, Math.max(base, Math.min(hardMax, majorCount + 8))));
  }
  return Math.max(1, Math.min(base, hardMax));
}

function projectedQualityRisk(clusterAnalysis, contract) {
  const risks = [];
  if (clusterAnalysis.suggestedUiGroupCount > contract.hardMaximumEditableColorGroups) {
    risks.push("requires secondary pruning below preset maximum");
  }
  if (clusterAnalysis.majorColorCount > contract.hardMaximumEditableColorGroups) {
    risks.push("major color count exceeds preset maximum");
  }
  if (/light/i.test(contract.groupingAggressiveness) && clusterAnalysis.tinyColorPercent > 75) {
    risks.push("many tiny colors but preset expects fidelity");
  }
  if (!risks.length) return contract.qualityRisk;
  return `${contract.qualityRisk}; ${risks.join("; ")}`;
}

function requiredFixturesForContract(contractId) {
  if (contractId === "photo-many-colors") return ["screenshot-ui", "noisy-photo-like"];
  if (contractId === "layered-cut-friendly") return ["simple-logo", "transparent-tomato"];
  if (contractId === "layered-detail") return ["screenshot-ui", "transparent-tomato", "noisy-photo-like"];
  return ["screenshot-ui", "transparent-tomato", "simple-logo"];
}

function buildRecommendations(measuredOutputs, fixtureAnalyses, contractTable) {
  const home = measuredOutputs.find((item) => item.id === "home-layered-flat-color");
  const flatContract = contractTable.find((item) => item.id === "layered-flat-color");
  const firstBatch = {
    scope: [
      "Layered - Flat Color only",
      "homepage VTracer final annotated SVG",
      "PNG/JPG layered routes only to preserve parity and avoid route regression",
      "no preset count or engine quality changes in the first implementation pass",
    ],
    likelyFiles: [
      "app/client/workers/vtracer.worker.ts",
      "app/utils/svgLayerTrace.server.ts",
      "app/client/lib/converter/svgEditingModel.ts",
      "app/client/components/svg/LayerPaletteEditor.tsx",
      "scripts/settings-color-coverage-audit.mjs",
      "scripts/layer-color-correctness-smoke.mjs",
      "scripts/palette-grouping-audit.mjs",
    ],
    strategy: {
      distanceMethod: "Use Lab or CIEDE2000-like perceptual distance for grouping, not raw RGB alone.",
      nearBlackRule: "Group near-black variants more aggressively when luma is very low and chroma is low.",
      nearWhiteRule: "Group near-white variants aggressively unless tint/chroma is meaningful or area is large.",
      alphaHandling: "Ignore transparent pixels and preserve existing alpha clip behavior before grouping.",
      weighting: "Rank groups by area first, then path count, contrast, saturation, and source order.",
      representativeColor:
        "Choose weighted median or dominant source color, not the first color encountered.",
      stableIds:
        "Create deterministic group ids from preset id, representative color, and sorted member layer ids.",
      pathOwnership:
        "Keep every original path owned by exactly one editable group; do not color-match broad selectors after grouping.",
      qualityTests:
        "Compare visible SVG color count, rendered pixel delta, copy/download parity, layer correctness, and transparent boundary.",
      performanceTests:
        "Keep homepage editable groups below 30 and rerun cumulative edit performance with 30 and 31 rows.",
    },
  };
  return {
    coreFinding: home
      ? `Homepage Layered - Flat Color exposes ${home.exposedLayerRowCount} rows for ${home.rawVisibleSvgColorCount} visible colors; suggested first-pass grouped count is ${home.suggestedGroupedPaletteCount}.`
      : "Homepage Layered - Flat Color measurement was unavailable.",
    firstImplementationBatch: firstBatch,
    flatColorContract: flatContract,
    fixtureRiskSummary: fixtureAnalyses.map((fixture) => ({
      id: fixture.id,
      sampledUniqueColors: fixture.sampledUniqueColors,
      suggestedClusterCount: fixture.clusterAnalysis.suggestedClusterCount,
      tinyColorPercent: fixture.clusterAnalysis.tinyColorPercent,
      nearDuplicateClusterCount: fixture.clusterAnalysis.nearDuplicateClusterCount,
    })),
  };
}

function summarize(measuredOutputs, fixtureAnalyses, recommendations) {
  const maxRaw = Math.max(0, ...measuredOutputs.map((item) => item.rawVisibleSvgColorCount));
  const maxRows = Math.max(0, ...measuredOutputs.map((item) => item.exposedLayerRowCount));
  const maxSuggested = Math.max(0, ...measuredOutputs.map((item) => item.suggestedGroupedPaletteCount));
  const home = measuredOutputs.find((item) => item.id === "home-layered-flat-color");
  return {
    measuredOutputCount: measuredOutputs.length,
    fixtureAnalysisCount: fixtureAnalyses.length,
    maxRawVisibleSvgColors: maxRaw,
    maxExposedLayerRows: maxRows,
    maxSuggestedGroupedPaletteCount: maxSuggested,
    homepageRawRows: home
      ? {
          actual: home.rawVisibleSvgColorCount,
          exposed: home.exposedLayerRowCount,
          remainingAfterHide: home.remainingAfterHide,
          suggestedGroupedPaletteCount: home.suggestedGroupedPaletteCount,
        }
      : null,
    recommendation: recommendations.coreFinding,
  };
}

function flatColorImplementationFailures(measuredOutputs) {
  const failures = [];
  const home = measuredOutputs.find((item) => item.id === "home-layered-flat-color");
  if (!home) {
    failures.push("Home Layered - Flat Color measurement is missing.");
    return failures;
  }
  if (home.rawVisibleSvgColorCount > FLAT_COLOR_MAX_EDITABLE_GROUPS) {
    failures.push(
      `Home Layered - Flat Color still has ${home.rawVisibleSvgColorCount} visible SVG colors; expected grouped output at or below ${FLAT_COLOR_MAX_EDITABLE_GROUPS}.`,
    );
  }
  if (home.exposedLayerRowCount > FLAT_COLOR_MAX_EDITABLE_GROUPS) {
    failures.push(
      `Home Layered - Flat Color still exposes ${home.exposedLayerRowCount} layer rows; expected grouped rows at or below ${FLAT_COLOR_MAX_EDITABLE_GROUPS}.`,
    );
  }
  if (home.exposedLayerRowCount !== home.rawVisibleSvgColorCount) {
    failures.push(
      `Home Layered - Flat Color exposes ${home.exposedLayerRowCount} rows for ${home.rawVisibleSvgColorCount} grouped SVG colors.`,
    );
  }
  if (home.exposedLayerRowCount >= FLAT_COLOR_RAW_EXPOSURE_REGRESSION_THRESHOLD) {
    failures.push(`Home Layered - Flat Color still has raw row exposure: ${home.exposedLayerRowCount} rows.`);
  }
  if (Number(home.remainingAfterHide || 0) > 0) {
    failures.push(`Home Layered - Flat Color leaves ${home.remainingAfterHide} visible colors after hiding grouped rows.`);
  }
  return failures;
}

async function serverState() {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(20_000) });
    const text = await response.text();
    const title = text.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "";
    return {
      reachable: true,
      status: response.status,
      title,
      looksLikeIlovesvg: /iLoveSVG|SVG Converter|image to SVG/i.test(text),
    };
  } catch (error) {
    return {
      reachable: false,
      status: null,
      title: "",
      looksLikeIlovesvg: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function gitState() {
  const branch = await execFile("git", ["branch", "--show-current"], { cwd: rootDir });
  const head = await execFile("git", ["rev-parse", "HEAD"], { cwd: rootDir });
  const status = await execFile("git", ["status", "--short", "--branch"], { cwd: rootDir });
  return {
    branch: branch.stdout.trim(),
    head: head.stdout.trim(),
    statusShort: status.stdout.trim(),
  };
}

function percentOf(colors, totalUses) {
  const sum = colors.reduce((total, item) => total + item.uses, 0);
  return Number(((sum / Math.max(1, totalUses)) * 100).toFixed(2));
}

function normalizeHex(value) {
  const text = String(value || "").trim().toLowerCase();
  const match = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return "";
  const body = match[1].length === 3
    ? match[1].split("").map((char) => char + char).join("")
    : match[1];
  return `#${body.toLowerCase()}`;
}

function hexToRgb(hex) {
  const body = normalizeHex(hex).slice(1);
  return {
    r: Number.parseInt(body.slice(0, 2), 16),
    g: Number.parseInt(body.slice(2, 4), 16),
    b: Number.parseInt(body.slice(4, 6), 16),
  };
}

function rgbToHex(rgb) {
  return `#${[rgb.r, rgb.g, rgb.b]
    .map((value) => clampByte(value).toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbToHsl(rgb) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
}

function relativeLuma(rgb) {
  const toLinear = (channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

function rgbToLab(rgb) {
  const pivotRgb = (value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = pivotRgb(rgb.r);
  const g = pivotRgb(rgb.g);
  const b = pivotRgb(rgb.b);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const pivotXyz = (value) => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
  const fx = pivotXyz(x);
  const fy = pivotXyz(y);
  const fz = pivotXyz(z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function labDistance(left, right) {
  return Math.sqrt(
    (left.L - right.L) ** 2 +
      (left.a - right.a) ** 2 +
      (left.b - right.b) ** 2,
  );
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
