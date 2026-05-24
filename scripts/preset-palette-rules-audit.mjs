import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = getSmokeBaseUrl();
const reportPath = process.env.PRESET_PALETTE_RULES_AUDIT_REPORT_PATH
  ? path.resolve(process.env.PRESET_PALETTE_RULES_AUDIT_REPORT_PATH)
  : path.join(rootDir, "tmp", "preset-palette-rules-audit.json");
const generatedFixtureDir = path.join(rootDir, "tmp", "preset-palette-rules-fixtures");

const targetSourceFiles = [
  "app/client/lib/converter/presetAdditions.ts",
  "app/client/workers/vtracer.worker.ts",
  "app/utils/svgLayerTrace.server.ts",
  "app/utils/conversionDiagnostics.server.ts",
  "app/routes/home.tsx",
  "app/routes/png-to-layered-svg-for-cricut.tsx",
  "app/routes/jpg-to-layered-svg-for-cricut.tsx",
  "app/client/components/svg/LayerPaletteEditor.tsx",
  "app/shared/tracing/types.ts",
  "scripts/palette-grouping-audit.mjs",
  "scripts/fish-card-region-fidelity-smoke.mjs",
  "scripts/settings-color-coverage-audit.mjs",
  "scripts/layer-color-correctness-smoke.mjs",
];

const requiredFixtureSpecs = [
  {
    id: "img-8846",
    role: "real-user-high-detail",
    requested: "C:\\Users\\Suhas\\Downloads\\IMG_8846.JPEG",
  },
  {
    id: "img-9288",
    role: "real-user-high-detail",
    requested: "C:\\Users\\Suhas\\Downloads\\IMG_9288.JPEG",
  },
  {
    id: "img-9404",
    role: "real-user-high-detail",
    requested: "C:\\Users\\Suhas\\Downloads\\IMG_9404.JPEG",
  },
  {
    id: "img-9448",
    role: "real-user-high-detail",
    requested: "C:\\Users\\Suhas\\Downloads\\IMG_9448.JPEG",
  },
  {
    id: "screenshot-2026-05-06",
    role: "complex-ui-screenshot",
    requested: "C:\\Users\\Suhas\\Downloads\\Screenshot 2026-05-06 194041.png",
  },
  {
    id: "charming-tomato",
    role: "transparent-sticker",
    requested: "C:\\Users\\Suhas\\Downloads\\charming-tomato-512x512.png",
  },
  {
    id: "img-8487",
    role: "blue-light-neutral-regression",
    requested: path.join(rootDir, "tests", "fixtures", "IMG_8487.PNG"),
  },
];

const corePresetContracts = [
  {
    id: "layered-flat-color",
    label: "Layered - Flat Color",
    sourceIds: [
      "layered-flat-color",
      "layered-flat-color-medium-quality",
      "layered-insane-quality",
    ],
    intendedUserOutcome: "Clean editable flat color blocks that stay compact on simple images and expand only when detail requires it.",
    typicalImageTypes: ["logos", "stickers", "flat illustrations", "screenshots with separated color families"],
    expectedGroupRange: [6, 32],
    hardMaximumEditableColorGroups: 32,
    max30Applies: true,
    groupingAggressiveness: "adaptive strong",
    nearBlackBehavior: "Merge low-luma variants unless they mark separate high-contrast regions.",
    nearWhiteBehavior: "Merge anti-aliased whites and light neutrals, with region guards for background or highlight separation.",
    antiAliasNoiseBehavior: "Collapse anti-aliasing and trace noise into representative editable groups.",
    smallDetailBehavior: "Preserve saturated, high-contrast, or spatially important small details.",
    regionFidelitySensitivity: "high",
    performanceRisk: "medium at 28 to 30 groups, low when simple images stay compact",
    conditionalFutureDisplay: "Always available, but warn or suggest Detail/Photo when complexity is photo-like.",
    suggestedTests: [
      "settings color coverage",
      "layer color correctness",
      "transparent boundary",
      "sticker border",
      "color region fidelity",
      "cumulative edit performance at 30 rows",
    ],
  },
  {
    id: "layered-8-color",
    label: "Layered - 8 Color",
    sourceIds: ["layered-8-color"],
    intendedUserOutcome: "A deliberately compact eight-color layered SVG.",
    typicalImageTypes: ["simple clipart", "icons", "decal art", "low-color screenshots"],
    expectedGroupRange: [2, 8],
    hardMaximumEditableColorGroups: 8,
    max30Applies: false,
    groupingAggressiveness: "strong",
    nearBlackBehavior: "Merge near-black variants aggressively.",
    nearWhiteBehavior: "Merge near-white variants aggressively unless white is a deliberate large region.",
    antiAliasNoiseBehavior: "Treat anti-aliasing as noise and keep only meaningful groups.",
    smallDetailBehavior: "Preserve only large or high-contrast details that fit the eight-color contract.",
    regionFidelitySensitivity: "medium",
    performanceRisk: "low",
    conditionalFutureDisplay: "Hide or de-emphasize when source has fewer than three meaningful colors or too many nonmergeable families.",
    suggestedTests: ["simple logo", "low-color fixture", "complex screenshot guard", "layer color correctness"],
  },
  {
    id: "layered-poster",
    label: "Layered - Poster",
    sourceIds: ["layered-poster", "layered-soft-poster", "poster-soft-8-color", "poster-smooth-12-color", "comic-poster-color"],
    intendedUserOutcome: "Posterized broad color regions with intentional tonal flattening.",
    typicalImageTypes: ["portraits", "photos for poster art", "cartoons", "mockups"],
    expectedGroupRange: [4, 12],
    hardMaximumEditableColorGroups: 12,
    max30Applies: false,
    groupingAggressiveness: "strong tonal",
    nearBlackBehavior: "Merge shadows into a few tonal bands.",
    nearWhiteBehavior: "Merge highlights into broad bands unless image intent depends on highlights.",
    antiAliasNoiseBehavior: "Collapse noise and anti-aliasing into poster bands.",
    smallDetailBehavior: "Discard very small tonal fragments unless they anchor facial or subject identity.",
    regionFidelitySensitivity: "medium",
    performanceRisk: "low to medium",
    conditionalFutureDisplay: "Show for photo-like or high-color inputs, but label as stylized flattening.",
    suggestedTests: ["photo fixture", "posterized portrait fixture", "path count ceiling", "region delta check"],
  },
  {
    id: "layered-detail",
    label: "Layered - Detail",
    sourceIds: [
      "layered-detail",
      "layered-detail-medium-quality",
      "layered-color-detail",
      "png-high-detail",
      "jpg-high-detail",
    ],
    intendedUserOutcome: "Higher-detail editable color output without exposing raw SVG color fragments.",
    typicalImageTypes: ["detailed stickers", "complex screenshots", "illustrations", "multi-color art"],
    expectedGroupRange: [12, 32],
    hardMaximumEditableColorGroups: 32,
    max30Applies: true,
    groupingAggressiveness: "moderate",
    nearBlackBehavior: "Merge true near-black noise, preserve distinct outlines and dark objects.",
    nearWhiteBehavior: "Merge anti-aliased near-white edges, preserve meaningful light-neutral regions.",
    antiAliasNoiseBehavior: "Merge clear noise, but avoid flattening legitimate tonal detail.",
    smallDetailBehavior: "Preserve small saturated, dark-outline, and subject-defining details.",
    regionFidelitySensitivity: "very high",
    performanceRisk: "medium to high near 30 groups",
    conditionalFutureDisplay: "Prefer when complexity analysis finds many meaningful color families.",
    suggestedTests: ["complex screenshot", "IMG_8487", "high-color generated fixture", "cumulative edit performance"],
  },
  {
    id: "layered-low-noise",
    label: "Layered - Low Noise",
    sourceIds: ["layered-low-noise", "layered-smooth", "layered-color-smoother"],
    intendedUserOutcome: "Clean, low-noise color layers with fewer tiny pieces.",
    typicalImageTypes: ["noisy JPGs", "compressed screenshots", "web images", "rough clipart"],
    expectedGroupRange: [2, 8],
    hardMaximumEditableColorGroups: 8,
    max30Applies: false,
    groupingAggressiveness: "very strong",
    nearBlackBehavior: "Merge dark speckles and shadow variants.",
    nearWhiteBehavior: "Merge light background noise and compression halos.",
    antiAliasNoiseBehavior: "Aggressively collapse anti-aliasing and isolated speckles.",
    smallDetailBehavior: "Remove or merge small low-contrast detail.",
    regionFidelitySensitivity: "medium",
    performanceRisk: "low",
    conditionalFutureDisplay: "Show when noise or tiny-color share is high.",
    suggestedTests: ["generated noisy image", "low-color fixture", "path count and island count checks"],
  },
  {
    id: "layered-cut-friendly",
    label: "Layered - Cut Friendly",
    sourceIds: ["layered-cut-friendly", "layered-bold-shapes", "png-vinyl", "png-htv", "jpg-low-detail-cut", "vinyl-jpg", "htv-jpg"],
    intendedUserOutcome: "Few clean weedable regions that are practical for Cricut or vinyl cutting.",
    typicalImageTypes: ["decals", "logos", "vinyl art", "cardstock shapes"],
    expectedGroupRange: [1, 6],
    hardMaximumEditableColorGroups: 6,
    max30Applies: false,
    groupingAggressiveness: "very strong cut-first",
    nearBlackBehavior: "Merge dark fragments into cuttable shapes.",
    nearWhiteBehavior: "Remove or merge white backgrounds when requested.",
    antiAliasNoiseBehavior: "Remove tiny anti-aliased fragments and speckles.",
    smallDetailBehavior: "Drop details that create uncuttable islands.",
    regionFidelitySensitivity: "low to medium, cut usability is more important than tonal fidelity",
    performanceRisk: "low",
    conditionalFutureDisplay: "Show for logo/decal-like inputs, not for detailed photo preservation.",
    suggestedTests: ["simple logo", "transparent sticker", "sticker border", "tiny island rejection"],
  },
  {
    id: "filled-layers-separate-colors",
    label: "Filled Layers - Separate Colors",
    sourceIds: [
      "filled-layers-separate-colors",
    ],
    intendedUserOutcome: "Distinct filled color regions remain separately editable without raw near-duplicate colors.",
    typicalImageTypes: ["flat illustrations", "stickers", "cartoons", "separated-color artwork"],
    expectedGroupRange: [8, 32],
    hardMaximumEditableColorGroups: 32,
    max30Applies: true,
    groupingAggressiveness: "moderate",
    nearBlackBehavior: "Merge near-black variants only when they are visually interchangeable.",
    nearWhiteBehavior: "Merge near-white variants, but preserve intentional light fills.",
    antiAliasNoiseBehavior: "Merge anti-aliasing into filled regions.",
    smallDetailBehavior: "Preserve distinct small regions when they represent a real fill color.",
    regionFidelitySensitivity: "high",
    performanceRisk: "medium",
    conditionalFutureDisplay: "Show for images with several clear color regions and manageable noise.",
    suggestedTests: ["complex screenshot", "transparent sticker", "copy/download parity", "region ownership"],
  },
  {
    id: "photo-many-colors",
    label: "Photo Many Colors",
    sourceIds: [
      "photo-many-colors",
      "photo-many-colors-medium-quality",
    ],
    intendedUserOutcome: "High-complexity editable color approximation for photo-like images without raw color explosion.",
    typicalImageTypes: ["photos", "high-color illustrations", "complex rendered art"],
    expectedGroupRange: [8, 32],
    hardMaximumEditableColorGroups: 32,
    max30Applies: false,
    groupingAggressiveness: "light selective",
    nearBlackBehavior: "Merge only near-identical dark variants unless they represent subject detail.",
    nearWhiteBehavior: "Merge clear highlight noise, preserve important light areas.",
    antiAliasNoiseBehavior: "Collapse only clear compression or edge noise.",
    smallDetailBehavior: "Preserve more small detail than Flat Color when it has visual weight.",
    regionFidelitySensitivity: "very high",
    performanceRisk: "high near the ceiling",
    conditionalFutureDisplay: "Show only when image complexity supports many meaningful colors.",
    suggestedTests: ["high-color real photos", "generated noisy image", "30-row performance", "raw-color cap"],
  },
];

async function main() {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.mkdir(generatedFixtureDir, { recursive: true });

  const [sourceFiles, fixtures, optionalReports, server, git] = await Promise.all([
    readSourceFiles(),
    prepareFixtures(),
    readOptionalReports(),
    serverState(),
    gitState(),
  ]);

  const inventory = buildPresetInventory(sourceFiles);
  const sourceFindings = inspectSourceFindings(sourceFiles, inventory);
  const fixtureAnalyses = [];
  for (const fixture of fixtures.available) {
    fixtureAnalyses.push(await analyzeFixture(fixture));
  }
  const liveMeasurements = extractLiveMeasurements(optionalReports);
  const presetContracts = buildContractTable(inventory);
  const fixtureMatrix = buildFixtureMatrix({
    fixtureAnalyses,
    presetContracts,
    inventory,
    liveMeasurements,
  });
  const presetGuardrails = buildPresetGuardrailDiagnostics({
    inventory,
    fixtureMatrix,
    liveMeasurements,
  });
  const conditionalColorCountPlan = buildConditionalColorCountPlan();
  const recommendedImplementationOrder = buildRecommendedImplementationOrder();
  const summary = summarize({
    inventory,
    fixtureAnalyses,
    fixtureMatrix,
    sourceFindings,
    liveMeasurements,
    presetGuardrails,
  });

  const report = {
    schemaVersion: 1,
    auditKind: "preset-palette-rules-audit",
    checkedAt: new Date().toISOString(),
    baseUrl,
    server,
    git,
    inspectedFiles: targetSourceFiles,
    fixtures,
    sourceFindings,
    currentPresetInventory: inventory,
    liveMeasurements,
    fixtureAnalyses,
    fixturePresetMatrix: fixtureMatrix,
    presetGuardrails,
    presetContracts,
    conditionalColorCountPlan,
    recommendedImplementationOrder,
    summary,
    nonGoals: [
      "No production conversion changes outside focused 8 Color and Poster guardrails.",
      "No unrelated preset changes.",
      "No route URL, SEO, navigation, sitemap, monetization, affiliate, compression, or settings UI changes.",
      "No binary fixture commits.",
    ],
  };

  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const ok = presetGuardrails.failures.length === 0;
  console.log(
    JSON.stringify(
      {
        ok,
        reportPath,
        availableFixtureCount: fixtures.available.length,
        unavailableFixtureCount: fixtures.unavailable.length,
        presetInventoryCount: inventory.allPresets.length,
        corePresetCount: presetContracts.length,
        matrixRowCount: fixtureMatrix.length,
        guardrailScenarioCount: presetGuardrails.fixtureRouteMatrix.length,
        guardrailFailureCount: presetGuardrails.failures.length,
        guardrailFailures: presetGuardrails.failures,
        sourceRisks: summary.sourceRisks,
        measuredScenarioCount: liveMeasurements.length,
      },
      null,
      2,
    ),
  );
  if (!ok) process.exitCode = 1;
}

async function readSourceFiles() {
  const entries = {};
  for (const relativePath of targetSourceFiles) {
    const absolutePath = path.join(rootDir, relativePath);
    entries[relativePath] = {
      path: absolutePath,
      text: await fs.readFile(absolutePath, "utf8"),
    };
  }
  return entries;
}

async function prepareFixtures() {
  const available = [];
  const unavailable = [];

  for (const spec of requiredFixtureSpecs) {
    const fixture = await fixtureInfo(spec.requested, spec.id, spec.role, "external-or-repo");
    if (fixture) available.push(fixture);
    else unavailable.push({ id: spec.id, role: spec.role, requested: spec.requested, reason: "file not found or unreadable" });
  }

  for (const fixture of [
    await createSimpleLogoFixture(),
    await createLowColorFixture(),
    await createHighColorNoisyFixture(),
  ]) {
    if (fixture) available.push(fixture);
  }

  return {
    available,
    unavailable,
    generatedDirectory: generatedFixtureDir,
    note: "Generated fixtures live under tmp and must not be committed.",
  };
}

async function fixtureInfo(filePath, id, role, source) {
  try {
    const stat = await fs.stat(filePath);
    const metadata = await sharp(filePath).metadata();
    return {
      id,
      role,
      source,
      path: filePath,
      basename: path.basename(filePath),
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
  const filePath = path.join(generatedFixtureDir, "generated-simple-logo.png");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
<rect width="640" height="480" fill="transparent"/>
<circle cx="220" cy="230" r="132" fill="#1d4ed8"/>
<circle cx="220" cy="230" r="74" fill="#38bdf8"/>
<rect x="338" y="154" width="174" height="174" rx="28" fill="#f97316"/>
<path d="M124 364 C210 286 324 304 410 386" fill="none" stroke="#0f172a" stroke-width="28" stroke-linecap="round"/>
<circle cx="448" cy="218" r="28" fill="#ffffff"/>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(filePath);
  return fixtureInfo(filePath, "generated-simple-logo", "generated-simple-logo", "generated");
}

async function createLowColorFixture() {
  const filePath = path.join(generatedFixtureDir, "generated-low-color.png");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="360" viewBox="0 0 520 360">
<rect width="520" height="360" fill="#ffffff"/>
<rect x="55" y="56" width="170" height="238" rx="22" fill="#2563eb"/>
<rect x="250" y="88" width="198" height="176" rx="20" fill="#f97316"/>
<path d="M72 290 C150 238 240 246 336 304" fill="none" stroke="#111827" stroke-width="20" stroke-linecap="round"/>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(filePath);
  return fixtureInfo(filePath, "generated-low-color", "generated-low-color", "generated");
}

async function createHighColorNoisyFixture() {
  const filePath = path.join(generatedFixtureDir, "generated-high-color-noisy.png");
  const width = 520;
  const height = 360;
  const raw = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const off = (y * width + x) * 4;
      const wave = Math.sin(x / 13) * 28 + Math.cos(y / 17) * 24;
      const grain = ((x * 37 + y * 53) % 47) - 23;
      raw[off] = clampByte(60 + x * 0.34 + wave + grain);
      raw[off + 1] = clampByte(72 + y * 0.42 - wave * 0.25 - grain * 0.4);
      raw[off + 2] = clampByte(116 + ((x + y) % 180) * 0.55 + wave * 0.6 + grain);
      raw[off + 3] = 255;
    }
  }
  await sharp(raw, { raw: { width, height, channels: 4 } }).png().toFile(filePath);
  return fixtureInfo(filePath, "generated-high-color-noisy", "generated-high-color-noisy", "generated");
}

function buildPresetInventory(sourceFiles) {
  const shared = extractPresetsFromSource(
    sourceFiles["app/client/lib/converter/presetAdditions.ts"].text,
    {
      sourceFile: "app/client/lib/converter/presetAdditions.ts",
      sourceKind: "shared-layered-addition",
      routeAvailability: ["/", "/png-to-layered-svg-for-cricut", "/jpg-to-layered-svg-for-cricut"],
      sliceStart: "export const TRACE_PRESET_ADDITIONS",
      sliceEnd: "export const STROKE_TRACE_PRESET_ADDITIONS",
    },
  ).filter((preset) => preset.category === "layered" || preset.settings.traceMode === "layered");

  const home = extractPresetsFromSource(sourceFiles["app/routes/home.tsx"].text, {
    sourceFile: "app/routes/home.tsx",
    sourceKind: "home-route-local",
    routeAvailability: ["/"],
    sliceStart: "const PRESET_DEFINITIONS",
    sliceEnd: "const PRESETS",
  }).filter((preset) => preset.settings.traceMode === "layered");

  const png = extractPresetsFromSource(sourceFiles["app/routes/png-to-layered-svg-for-cricut.tsx"].text, {
    sourceFile: "app/routes/png-to-layered-svg-for-cricut.tsx",
    sourceKind: "png-route-local",
    routeAvailability: ["/png-to-layered-svg-for-cricut"],
    sliceStart: "const PRESET_DEFINITIONS",
    sliceEnd: "const PRESETS",
  });

  const jpg = extractPresetsFromSource(sourceFiles["app/routes/jpg-to-layered-svg-for-cricut.tsx"].text, {
    sourceFile: "app/routes/jpg-to-layered-svg-for-cricut.tsx",
    sourceKind: "jpg-route-local",
    routeAvailability: ["/jpg-to-layered-svg-for-cricut"],
    sliceStart: "const PRESETS",
    sliceEnd: "const DISPLAY_PRESETS",
  });

  const allPresets = [...shared, ...home, ...png, ...jpg].map((preset) => {
    const family = classifyPresetFamily(preset);
    const requestedTargetCount =
      numberOrNull(preset.settings.requestedPaletteCount) ??
      numberOrNull(preset.settings.colorLayerCount) ??
      numberOrNull(preset.settings.layerCount);
    return {
      ...preset,
      family,
      requestedTargetCount,
      enginePath: enginePathForPreset(preset),
      currentHardCaps: hardCapsForPreset(preset),
      affectedByFlatColorAdaptiveGrouping: isAffectedByFlatColorAdaptive(preset),
      overFragmentationRisk: overFragmentationRiskForPreset(preset, family),
      overFlatteningRisk: overFlatteningRiskForPreset(preset, family),
    };
  });

  return {
    allPresets,
    sharedLayeredAdditions: allPresets.filter((preset) => preset.sourceKind === "shared-layered-addition"),
    homeRouteLocal: allPresets.filter((preset) => preset.sourceKind === "home-route-local"),
    pngRouteLocal: allPresets.filter((preset) => preset.sourceKind === "png-route-local"),
    jpgRouteLocal: allPresets.filter((preset) => preset.sourceKind === "jpg-route-local"),
    requiredPresetCoverage: corePresetContracts.map((contract) => ({
      id: contract.id,
      label: contract.label,
      foundPresets: allPresets
        .filter((preset) => contract.sourceIds.includes(preset.id) || preset.family === contract.id)
        .map((preset) => ({
          id: preset.id,
          label: preset.label,
          sourceKind: preset.sourceKind,
          routeAvailability: preset.routeAvailability,
          requestedTargetCount: preset.requestedTargetCount,
        })),
    })),
  };
}

function extractPresetsFromSource(source, options) {
  const sliced = sliceSource(source, options.sliceStart, options.sliceEnd);
  const blocks = findPresetBlocks(sliced.text);
  return blocks
    .map((block) => {
      const id = readQuotedProperty(block, "id");
      const label = readQuotedProperty(block, "label");
      if (!id || !label || !/settings\s*:/.test(block)) return null;
      return {
        id,
        label,
        sourceFile: options.sourceFile,
        sourceKind: options.sourceKind,
        routeAvailability: options.routeAvailability,
        category: readQuotedProperty(block, "category") || null,
        backendIntensity: readQuotedProperty(block, "backendIntensity") || null,
        settings: extractSettings(block),
        sourceLine: lineNumber(source, sliced.offset + sliced.text.indexOf(block)),
      };
    })
    .filter(Boolean);
}

function sliceSource(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start < 0) return { text: "", offset: 0 };
  const end = source.indexOf(endMarker, start + startMarker.length);
  return {
    text: source.slice(start, end > start ? end : source.length),
    offset: start,
  };
}

function findPresetBlocks(source) {
  const blocks = [];
  const pattern = /\bid\s*:\s*["'][^"']+["']/g;
  let match;
  while ((match = pattern.exec(source))) {
    const start = source.lastIndexOf("{", match.index);
    if (start < 0) continue;
    const end = findMatchingBrace(source, start);
    if (end < 0) continue;
    const block = source.slice(start, end + 1);
    if (/settings\s*:/.test(block)) blocks.push(block);
  }
  return uniqueBy(blocks, (block) => block);
}

function findMatchingBrace(source, start) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const ch = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = "";
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function extractSettings(block) {
  const settingsStart = block.indexOf("settings");
  const open = block.indexOf("{", settingsStart);
  const close = open >= 0 ? findMatchingBrace(block, open) : -1;
  const settingsBlock = close > open ? block.slice(open + 1, close) : "";
  const keys = [
    "traceMode",
    "layerCount",
    "colorLayerCount",
    "requestedPaletteCount",
    "layerBuildMode",
    "layerOverlapPx",
    "gapFill",
    "groupBy",
    "paletteAlgorithm",
    "paletteDistance",
    "maxTraceSide",
    "layerMaxTraceSide",
    "minRegionPercent",
    "optTolerance",
    "layerOptTolerance",
    "turdSize",
    "layerTurdSize",
    "turnPolicy",
    "layerTurnPolicy",
    "posterize",
    "posterizeStrength",
    "removeWhite",
    "removeTransparent",
    "transparent",
    "colorMergeTolerance",
    "minIslandPx",
    "holeFillPx",
    "sortLayersBy",
    "fillStrokeWidth",
    "fillStrokeColor",
  ];
  const settings = {};
  for (const key of keys) {
    const valueMatch = new RegExp(`${escapeRegExp(key)}\\s*:\\s*([^,\\n}]+)`).exec(settingsBlock);
    if (valueMatch) settings[key] = parseSourceLiteral(valueMatch[1]);
  }
  return settings;
}

function readQuotedProperty(block, key) {
  return block.match(new RegExp(`\\b${escapeRegExp(key)}\\s*:\\s*["']([^"']+)["']`))?.[1] || null;
}

function parseSourceLiteral(value) {
  const cleaned = String(value || "").replace(/,$/, "").trim();
  if (/^["']/.test(cleaned)) return cleaned.replace(/^["']|["']$/g, "");
  if (cleaned === "true") return true;
  if (cleaned === "false") return false;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : cleaned;
}

function classifyPresetFamily(preset) {
  const key = `${preset.id} ${preset.label}`.toLowerCase();
  for (const contract of corePresetContracts) {
    if (contract.sourceIds.includes(preset.id)) return contract.id;
  }
  if (/photo many colors/.test(key)) return "photo-many-colors";
  if (/filled layers|separate colors/.test(key)) return "filled-layers-separate-colors";
  if (/flat color|flat layers|flat mark|flat/.test(key)) return "layered-flat-color";
  if (/8 color|8-color/.test(key)) return "layered-8-color";
  if (/poster|posterized|portrait|comic/.test(key)) return "layered-poster";
  if (/detail|preserve colors|more colors|sublimation|cartoon|high detail/.test(key)) return "layered-detail";
  if (/low noise|smooth|smoother|cleanup|scan/.test(key)) return "layered-low-noise";
  if (/cut|vinyl|htv|cardstock|shadow|2 color|3 color|fewer|bold shapes/.test(key)) return "layered-cut-friendly";
  if (/sticker|mockup|mascot|character|fill|outline|ink|icon|logo/.test(key)) return "filled-layers-separate-colors";
  return "route-specific-layered";
}

function enginePathForPreset(preset) {
  const routes = preset.routeAvailability;
  const clientCanUseVTracer =
    routes.includes("/") &&
    (
      preset.sourceKind === "shared-layered-addition" ||
      preset.settings.layerBuildMode ||
      numberOrNull(preset.settings.requestedPaletteCount) != null
    );
  const routeLocalServer = routes.some((route) =>
    route === "/png-to-layered-svg-for-cricut" || route === "/jpg-to-layered-svg-for-cricut"
  );
  if (clientCanUseVTracer && routeLocalServer) {
    return "Hybrid: homepage browser VTracer first; PNG/JPG layered routes submit to server Potrace mask builder.";
  }
  if (clientCanUseVTracer) return "Homepage browser VTracer first, server Potrace fallback.";
  if (routeLocalServer) return "Server Potrace layered mask builder on route action.";
  return "Layered route path unknown from inspected files.";
}

function hardCapsForPreset(preset) {
  const caps = [];
  if (preset.routeAvailability.includes("/") || preset.routeAvailability.includes("/png-to-layered-svg-for-cricut") || preset.routeAvailability.includes("/jpg-to-layered-svg-for-cricut")) {
    caps.push("route-local form layer count is clamped to 2..10 on server actions");
  }
  if (preset.settings.layerBuildMode === "per-color-cutout") {
    caps.push("client getSafeLayeredPaletteCount caps per-color-cutout to 18 or lower by pixel count");
  } else if (preset.settings.layerBuildMode === "stacked-overlap") {
    caps.push("client getSafeLayeredPaletteCount caps stacked-overlap to 28 or lower by pixel count");
  } else if (preset.settings.layerBuildMode === "raw-vtracer") {
    caps.push("client raw-vtracer path returns the requested count up to 40 before UI policy caps");
  }
  if (
    preset.id === "layered-flat-color" ||
    preset.id === "layered-flat-color-medium-quality" ||
    preset.id === "layered-insane-quality"
  ) {
    caps.push("post-VTracer Flat Color grouping keeps editable groups at or below 32");
  }
  return caps;
}

function isAffectedByFlatColorAdaptive(preset) {
  const settings = preset.settings;
  if (
    preset.id === "layered-flat-color" ||
    preset.id === "layered-flat-color-medium-quality" ||
    preset.id === "layered-insane-quality"
  ) {
    return {
      clientWorker: true,
      serverFallback: true,
      reason: "Flat Color quality-tier preset id is gated in the client worker and server compact flat-color path.",
    };
  }
  const layerCount = numberOrNull(settings.colorLayerCount) ?? numberOrNull(settings.layerCount);
  const maxSide = numberOrNull(settings.layerMaxTraceSide) ?? numberOrNull(settings.maxTraceSide);
  const minRegion = numberOrNull(settings.minRegionPercent);
  const posterize = settings.posterize;
  const serverHeuristic =
    layerCount != null &&
    layerCount >= 14 &&
    layerCount <= 18 &&
    maxSide != null &&
    maxSide >= 1400 &&
    minRegion != null &&
    minRegion <= 0.12 &&
    posterize === false;
  return {
    clientWorker: false,
    serverFallback: serverHeuristic,
    reason: serverHeuristic
      ? "Server flat-color heuristic can match this non-Flat Color preset in fallback/server paths."
      : "Not affected by current Flat Color grouping gates.",
  };
}

function overFragmentationRiskForPreset(preset, family) {
  const requested = numberOrNull(preset.settings.requestedPaletteCount) ?? numberOrNull(preset.settings.colorLayerCount) ?? numberOrNull(preset.settings.layerCount) ?? 0;
  if (family === "photo-many-colors" && preset.settings.layerBuildMode === "raw-vtracer") return "high: raw VTracer can emit many final colors without grouping";
  if (family === "photo-many-colors" && requested > 32) return "high: requested count exceeds the Photo Many Colors 32-group ceiling";
  if (requested >= 24) return "medium-high: many editable rows unless grouped or windowed";
  if (preset.settings.layerBuildMode === "raw-vtracer") return "high: raw VTracer can emit many final colors without grouping";
  if ((numberOrNull(preset.settings.colorMergeTolerance) ?? 0) <= 6 && requested >= 16) return "medium: low merge tolerance can preserve near-duplicates";
  return "low to medium";
}

function overFlatteningRiskForPreset(preset, family) {
  const requested = numberOrNull(preset.settings.requestedPaletteCount) ?? numberOrNull(preset.settings.colorLayerCount) ?? numberOrNull(preset.settings.layerCount) ?? 0;
  const merge = numberOrNull(preset.settings.colorMergeTolerance) ?? 0;
  const minRegion = numberOrNull(preset.settings.minRegionPercent) ?? 0;
  if (family === "layered-cut-friendly" || family === "layered-low-noise") return "intentional high flattening risk for detailed art";
  if (requested <= 5 && (merge >= 20 || minRegion >= 0.6)) return "high on detailed images";
  if (family === "layered-8-color" || family === "layered-poster") return "medium by design";
  return "low to medium";
}

function inspectSourceFindings(sourceFiles, inventory) {
  const worker = sourceFiles["app/client/workers/vtracer.worker.ts"].text;
  const server = sourceFiles["app/utils/svgLayerTrace.server.ts"].text;
  const png = sourceFiles["app/routes/png-to-layered-svg-for-cricut.tsx"].text;
  const jpg = sourceFiles["app/routes/jpg-to-layered-svg-for-cricut.tsx"].text;
  const home = sourceFiles["app/routes/home.tsx"].text;
  const sharedAdditions = inventory.sharedLayeredAdditions;
  const sharedWithColorLayerOnly = sharedAdditions.filter((preset) =>
    preset.settings.colorLayerCount != null && preset.settings.layerCount == null
  );
  return {
    flatColorClientGroupingGate: {
      exactPresetIdGate:
        /settings\.presetId\s*===\s*FLAT_COLOR_GROUPING_PRESET_ID/.test(worker) ||
        /isLayeredFlatColorQualityPresetId\(settings\.presetId\)/.test(worker),
      perColorCutoutGate: /getLayerBuildMode\(settings\)\s*===\s*"per-color-cutout"/.test(worker),
      maxEditableGroups: readConstNumber(worker, "FLAT_COLOR_MAX_EDITABLE_GROUPS"),
    },
    flatColorServerAdaptiveGate: {
      exactPresetIdGate:
        /options\.presetId\s*===\s*"layered-flat-color"/.test(server) ||
        /isLayeredQualityTierPresetId\(options\.presetId\)/.test(server),
      heuristicAlsoMatchesFlatLikeSettings: /options\.layerCount\s*>=\s*14/.test(server) && /options\.posterize\s*===\s*false/.test(server),
      maxAdaptiveTarget: /clampInt\(analysis\.target,\s*MIN_LAYER_COUNT,\s*30\)/.test(server) ? 30 : null,
    },
    pngJpgRouteLocalCaps: {
      pngMaxLayerCount: readConstNumber(png, "MAX_LAYER_COUNT"),
      jpgMaxLayerCount: readConstNumber(jpg, "MAX_LAYER_COUNT"),
      homeServerMaxLayerCount: readConstNumber(home, "MAX_LAYER_COUNT"),
    },
    sharedPresetRouteMismatchRisk: {
      present: sharedWithColorLayerOnly.length > 0,
      affectedSharedPresetIds: sharedWithColorLayerOnly.map((preset) => preset.id),
      reason:
        "Shared layered additions use colorLayerCount, while PNG/JPG route-local submit paths append layerCount. Those route actions can keep the default layerCount for shared additions unless a route-specific mapper is added.",
    },
    photoManyColorsCeilingRisk: {
      present: inventory.allPresets.some(
        (preset) =>
          preset.id === "photo-many-colors" &&
          (preset.requestedTargetCount > 32 || preset.settings.layerBuildMode === "raw-vtracer"),
      ),
      sourceRequestedCount: inventory.allPresets.find((preset) => preset.id === "photo-many-colors")?.requestedTargetCount ?? null,
      reason: "Photo Many Colors must use grouped editable palette output and stay at or below the 32-color ceiling.",
    },
  };
}

async function analyzeFixture(fixture) {
  const image = sharp(fixture.path).ensureAlpha();
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  const raw = await image.raw().toBuffer();
  const sampleStep = Math.max(1, Math.floor((width * height) / 90000));
  const colorCounts = new Map();
  let sampledPixels = 0;
  let visiblePixels = 0;
  let transparentPixels = 0;
  let nearBlackPixels = 0;
  let nearWhitePixels = 0;

  for (let pixel = 0; pixel < width * height; pixel += sampleStep) {
    const off = pixel * 4;
    const alpha = raw[off + 3];
    sampledPixels += 1;
    if (alpha < 18) {
      transparentPixels += 1;
      continue;
    }
    visiblePixels += 1;
    const color = {
      r: raw[off],
      g: raw[off + 1],
      b: raw[off + 2],
    };
    if (isNearBlack(color)) nearBlackPixels += 1;
    if (isNearWhite(color)) nearWhitePixels += 1;
    const hex = rgbToHex(color);
    colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
  }

  const colors = [...colorCounts.entries()]
    .map(([hex, count]) => {
      const rgb = hexToRgb(hex);
      const percent = (count / Math.max(1, visiblePixels)) * 100;
      return {
        hex,
        rgb,
        count,
        percent: round(percent),
        luma: round(luminance(rgb)),
        saturation: round(saturation(rgb)),
        nearBlack: isNearBlack(rgb),
        nearWhite: isNearWhite(rgb),
        tiny: percent < 0.08,
        major: percent >= 1,
      };
    })
    .sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex));

  const clusters = clusterColors(colors, 18);
  const majorColorCount = colors.filter((color) => color.major).length;
  const tinyColorCount = colors.filter((color) => color.tiny).length;
  const nearDuplicateClusterCount = clusters.filter((cluster) => cluster.colors.length > 1).length;
  const meaningfulClusterCount = clusters.filter((cluster) => cluster.percent >= 0.6 || cluster.colors.some((color) => color.major)).length;
  let suggestedUiGroupCount = clampInt(
    Math.round(
      majorColorCount +
        Math.min(12, meaningfulClusterCount * 0.55) +
        (colors.length > 1000 ? 6 : colors.length > 250 ? 3 : 0),
    ),
    1,
    30,
  );
  if (colors.length > 30000 || clusters.length > 140) {
    suggestedUiGroupCount = 30;
  } else if (colors.length > 3000 || clusters.length > 80) {
    suggestedUiGroupCount = Math.max(suggestedUiGroupCount, 24);
  }

  return {
    id: fixture.id,
    role: fixture.role,
    basename: fixture.basename,
    path: fixture.path,
    width,
    height,
    sampledPixels,
    visiblePixels,
    transparentShare: round((transparentPixels / Math.max(1, sampledPixels)) * 100),
    sampledUniqueColorCount: colors.length,
    majorColorCount,
    tinyColorCount,
    tinyColorPercent: round((tinyColorCount / Math.max(1, colors.length)) * 100),
    nearDuplicateClusterCount,
    nearBlackShare: round((nearBlackPixels / Math.max(1, visiblePixels)) * 100),
    nearWhiteShare: round((nearWhitePixels / Math.max(1, visiblePixels)) * 100),
    perceptualClusterCount: clusters.length,
    meaningfulClusterCount,
    suggestedUiGroupCount,
    topColors: colors.slice(0, 18).map(({ hex, percent, luma, saturation, nearBlack, nearWhite }) => ({
      hex,
      percent,
      luma,
      saturation,
      nearBlack,
      nearWhite,
    })),
    riskNotes: fixtureRiskNotes({ colors, clusters, suggestedUiGroupCount, majorColorCount }),
  };
}

function clusterColors(colors, threshold) {
  const clusters = [];
  for (const color of colors) {
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const cluster of clusters) {
      const distance = colorDistance(color.rgb, cluster.representative.rgb);
      if (distance < bestDistance) {
        best = cluster;
        bestDistance = distance;
      }
    }
    if (best && bestDistance <= threshold) {
      best.colors.push(color);
      best.count += color.count;
      best.percent += color.percent;
      if (color.count > best.representative.count) best.representative = color;
    } else {
      clusters.push({
        representative: color,
        colors: [color],
        count: color.count,
        percent: color.percent,
      });
    }
  }
  return clusters.sort((a, b) => b.count - a.count);
}

function fixtureRiskNotes({ colors, clusters, suggestedUiGroupCount, majorColorCount }) {
  const notes = [];
  if (suggestedUiGroupCount >= 28) notes.push("High-color fixture can justify counts near the 30 ceiling for detail/photo presets.");
  if (majorColorCount <= 3 && colors.length < 600) notes.push("Low-color fixture should stay compact and should not show high color-count presets.");
  if (clusters.length > 30) notes.push("Perceptual clusters exceed the UI ceiling and require deterministic pruning.");
  if (colors.filter((color) => color.tiny).length > colors.length * 0.6) notes.push("Most exact colors are tiny, so anti-aliasing and noise handling must dominate.");
  if (!notes.length) notes.push("No unusual fixture-level palette risk detected.");
  return notes;
}

async function readOptionalReports() {
  const sourceMtimeMs = await latestMtimeForPaths(
    targetSourceFiles.map((relativePath) => path.join(rootDir, relativePath)),
  );
  const paths = {
    settingsColorCoverage: path.join(rootDir, "tmp", "settings-color-coverage-audit.json"),
    layerColorCorrectness: path.join(rootDir, "tmp", "layer-color-correctness-report.json"),
    paletteGrouping: path.join(rootDir, "tmp", "palette-grouping-audit.json"),
    colorRegionFidelity: path.join(rootDir, "tmp", "color-region-fidelity-audit.json"),
    fishCardRegionFidelity: path.join(rootDir, "tmp", "fish-card-region-fidelity-report.json"),
  };
  const reports = {};
  for (const [key, filePath] of Object.entries(paths)) {
    reports[key] = await readJsonIfExists(filePath, sourceMtimeMs);
  }
  return reports;
}

async function latestMtimeForPaths(filePaths) {
  let latest = 0;
  for (const filePath of filePaths) {
    try {
      const stat = await fs.stat(filePath);
      latest = Math.max(latest, stat.mtimeMs);
    } catch {
      // Missing inspected files are reported elsewhere; freshness checks can ignore them.
    }
  }
  return latest;
}

async function readJsonIfExists(filePath, minimumMtimeMs = 0) {
  try {
    const stat = await fs.stat(filePath);
    if (minimumMtimeMs > 0 && stat.mtimeMs + 1000 < minimumMtimeMs) {
      return {
        path: filePath,
        parsed: null,
        stale: true,
        mtimeMs: stat.mtimeMs,
      };
    }
    return {
      path: filePath,
      parsed: JSON.parse(await fs.readFile(filePath, "utf8")),
      stale: false,
      mtimeMs: stat.mtimeMs,
    };
  } catch {
    return {
      path: filePath,
      parsed: null,
      stale: false,
      mtimeMs: null,
    };
  }
}

function extractLiveMeasurements(optionalReports) {
  const measurements = [];
  const colorRegion = optionalReports.colorRegionFidelity.parsed;
  if (Array.isArray(colorRegion?.scenarioResults)) {
    for (const result of colorRegion.scenarioResults) {
      if (!result?.ok) continue;
      measurements.push({
        sourceReport: optionalReports.colorRegionFidelity.path,
        scenarioId: result.id,
        route: result.route,
        presetId: result.presetId,
        preset: result.preset,
        fixtureBasename: result.fixture?.basename || null,
        engineUsed: result.snapshot?.latestOutput?.engineUsed || null,
        layerBuildMode: result.snapshot?.latestOutput?.layerBuildMode || null,
        requestedPaletteCount: result.snapshot?.latestOutput?.requestedPaletteCount ?? null,
        actualPaletteCount: result.snapshot?.latestOutput?.actualPaletteCount ?? null,
        exposedLayerCount: result.snapshot?.ui?.exposedLayerCount ?? null,
        groupedColorCount: result.analysis?.groupedColorCount ?? null,
        rawVisibleColorCount: result.analysis?.rawVisibleColorCount ?? null,
        svgBytes: result.svgBytes ?? result.snapshot?.latestOutput?.svgBytesAttr ?? null,
        pathCount: result.analysis?.pathCount ?? result.snapshot?.latestOutput?.pathCountAttr ?? null,
        copyDownloadParity: result.copyDownloadParity ?? null,
        riskLevel: result.analysis?.risk?.level || null,
        evidenceType: "browser-smoke-measurement",
      });
    }
  }

  const settingsCoverage = optionalReports.settingsColorCoverage.parsed;
  if (Array.isArray(settingsCoverage?.scenarios)) {
    for (const result of settingsCoverage.scenarios) {
      if (!result?.ok || result.skipped) continue;
      measurements.push({
        sourceReport: optionalReports.settingsColorCoverage.path,
        scenarioId: result.id,
        route: result.route,
        presetId: presetIdFromScenarioId(result.id, result.preset),
        preset: result.preset || null,
        fixtureBasename: result.fixture?.basename || null,
        engineUsed: result.latestOutput?.engineUsed || result.conversion?.engineUsed || null,
        layerBuildMode:
          result.latestOutput?.layerBuildMode || result.conversion?.layerBuildMode || null,
        requestedPaletteCount:
          result.latestOutput?.requestedPaletteCount ||
          result.conversion?.requestedPaletteCount ||
          null,
        actualPaletteCount:
          result.latestOutput?.actualPaletteCount ||
          result.conversion?.actualPaletteCount ||
          null,
        exposedLayerCount: result.counts?.layerRowsExposed ?? null,
        groupedColorCount: result.counts?.actualVisibleSvgColorsBeforeHide ?? null,
        rawVisibleColorCount: result.counts?.actualVisibleSvgColorsBeforeHide ?? null,
        svgBytes: result.latestOutput?.svgBytesAttr ?? result.conversion?.svgBytes ?? null,
        pathCount: result.latestOutput?.pathCountAttr ?? result.conversion?.pathCount ?? null,
        copyDownloadParity: result.copyDownloadParity ?? null,
        evidenceType: "settings-color-coverage-measurement",
      });
    }
  }

  const layerColorCorrectness = optionalReports.layerColorCorrectness.parsed;
  if (Array.isArray(layerColorCorrectness?.scenarios)) {
    for (const result of layerColorCorrectness.scenarios) {
      if (!result?.ok || result.skipped) continue;
      measurements.push({
        sourceReport: optionalReports.layerColorCorrectness.path,
        scenarioId: result.id,
        route: result.route,
        presetId: presetIdFromScenarioId(result.id, result.preset),
        preset: result.preset || null,
        fixtureBasename: result.fixture?.basename || null,
        engineUsed: result.conversion?.engineUsed || null,
        layerBuildMode: result.conversion?.layerBuildMode || null,
        requestedPaletteCount: result.conversion?.requestedPaletteCount ?? null,
        actualPaletteCount: result.conversion?.actualPaletteCount ?? null,
        exposedLayerCount: result.baseline?.targetCount ?? null,
        groupedColorCount: result.baseline?.targetCount ?? null,
        rawVisibleColorCount: null,
        svgBytes: result.conversion?.svgBytes ?? null,
        pathCount: result.conversion?.pathCount ?? null,
        copyDownloadParity: null,
        evidenceType: "layer-color-correctness-measurement",
      });
    }
  }

  const paletteGrouping = optionalReports.paletteGrouping.parsed;
  if (Array.isArray(paletteGrouping?.measuredOutputs)) {
    for (const item of paletteGrouping.measuredOutputs) {
      measurements.push({
        sourceReport: optionalReports.paletteGrouping.path,
        scenarioId: item.id,
        route: item.route,
        presetId: item.presetId || "layered-flat-color",
        preset: item.preset || "Layered - Flat Color",
        fixtureBasename: item.fixture || null,
        exposedLayerCount: item.exposedLayerRowCount ?? null,
        groupedColorCount: item.suggestedGroupedPaletteCount ?? null,
        rawVisibleColorCount: item.rawVisibleSvgColorCount ?? null,
        svgBytes: item.svgBytes ?? null,
        pathCount: item.pathCount ?? null,
        evidenceType: "palette-grouping-report-measurement",
      });
    }
  }
  return measurements;
}

function presetIdFromScenarioId(id, preset) {
  const text = `${id || ""} ${preset || ""}`.toLowerCase();
  if (text.includes("photo-many-colors") || text.includes("photo many colors")) {
    return "photo-many-colors";
  }
  if (text.includes("layered-flat-color") || text.includes("flat color")) {
    return "layered-flat-color";
  }
  if (text.includes("layered-8-color") || text.includes("8 color")) {
    return "layered-8-color";
  }
  if (text.includes("layered-poster") || text.includes("poster")) {
    return "layered-poster";
  }
  return null;
}

function buildContractTable(inventory) {
  return corePresetContracts.map((contract) => {
    const matchingPresets = inventory.allPresets.filter((preset) =>
      contract.sourceIds.includes(preset.id) || preset.family === contract.id
    );
    return {
      ...contract,
      currentSourcePresets: matchingPresets.map((preset) => ({
        id: preset.id,
        label: preset.label,
        sourceKind: preset.sourceKind,
        sourceFile: preset.sourceFile,
        sourceLine: preset.sourceLine,
        routeAvailability: preset.routeAvailability,
        requestedTargetCount: preset.requestedTargetCount,
        currentEnginePath: preset.enginePath,
        currentHardCaps: preset.currentHardCaps,
        affectedByFlatColorAdaptiveGrouping: preset.affectedByFlatColorAdaptiveGrouping,
      })),
    };
  });
}

function buildFixtureMatrix({ fixtureAnalyses, presetContracts, inventory, liveMeasurements }) {
  const rows = [];
  for (const fixture of fixtureAnalyses) {
    for (const contract of presetContracts) {
      const sourcePreset =
        contract.currentSourcePresets.find((preset) => contract.sourceIds.includes(preset.id)) ||
        contract.currentSourcePresets[0] ||
        null;
      const projectedGroupedLayerCount = projectGroupedCount(fixture, contract);
      const measured = liveMeasurements.find((measurement) =>
        measurement.presetId === contract.id &&
        (
          normalizeBasename(measurement.fixtureBasename) === normalizeBasename(fixture.basename) ||
          measurement.scenarioId?.toLowerCase().includes(fixture.id.toLowerCase())
        )
      );
      rows.push({
        inputFixture: fixture.id,
        fixtureRole: fixture.role,
        route: sourcePreset?.routeAvailability?.join(", ") || "not currently located",
        presetId: contract.id,
        preset: contract.label,
        enginePath: sourcePreset?.currentEnginePath || "source preset not found",
        requestedTargetCount: sourcePreset?.requestedTargetCount ?? null,
        projectedFinalGroupedOrExposedLayerCount: projectedGroupedLayerCount,
        measuredFinalGroupedOrExposedLayerCount: measured?.exposedLayerCount ?? measured?.groupedColorCount ?? null,
        sampledRawVisibleColorCount: fixture.sampledUniqueColorCount,
        measuredRawVisibleColorCount: measured?.rawVisibleColorCount ?? null,
        svgByteSize: measured?.svgBytes ?? null,
        pathCount: measured?.pathCount ?? null,
        nearDuplicateClusterCount: fixture.nearDuplicateClusterCount,
        nearBlackBehavior: contract.nearBlackBehavior,
        nearWhiteBehavior: contract.nearWhiteBehavior,
        copyDownloadParity: measured?.copyDownloadParity ?? "not measured in this diagnostic unless an upstream browser smoke supplied it",
        transparentBoundaryRisk: transparentBoundaryRisk(fixture, contract),
        stickerBorderCompatibility: stickerBorderCompatibility(fixture, contract),
        settingsEditPerformanceRisk: performanceRiskForProjectedCount(projectedGroupedLayerCount, contract),
        overFlattenedRisk: overFlattenedRisk(fixture, contract, projectedGroupedLayerCount),
        overFragmentedRisk: overFragmentedRisk(fixture, contract, projectedGroupedLayerCount),
        presetIntentPreservedProjection: presetIntentProjection(fixture, contract, projectedGroupedLayerCount),
        evidenceType: measured ? "browser measurement plus fixture projection" : "fixture color projection plus source inspection",
      });
    }
  }

  return rows;

  function projectGroupedCount(fixture, contract) {
    const meaningful = Math.max(1, fixture.meaningfulClusterCount);
    const major = Math.max(1, fixture.majorColorCount);
    const suggested = Math.max(1, fixture.suggestedUiGroupCount);
    const hardMax = contract.hardMaximumEditableColorGroups;
    if (contract.id === "layered-8-color") {
      if (fixture.sampledUniqueColorCount > 1000) return hardMax;
      return clampInt(Math.min(8, Math.max(major, Math.min(meaningful, 8))), 1, hardMax);
    }
    if (contract.id === "layered-poster") {
      return clampInt(Math.min(hardMax, Math.max(4, Math.min(suggested, major + 4))), 1, hardMax);
    }
    if (contract.id === "layered-low-noise") {
      return clampInt(Math.min(hardMax, Math.max(2, major + 2)), 1, hardMax);
    }
    if (contract.id === "layered-cut-friendly") {
      return clampInt(Math.min(hardMax, Math.max(1, major + 1)), 1, hardMax);
    }
    if (contract.id === "photo-many-colors") {
      if (major <= 3) return clampInt(major, 1, hardMax);
      return clampInt(Math.max(18, suggested), 1, hardMax);
    }
    if (contract.id === "layered-detail") {
      if (major <= 4) return clampInt(Math.min(major + 2, 10), 1, hardMax);
      return clampInt(Math.max(12, suggested), 1, hardMax);
    }
    if (contract.id === "filled-layers-separate-colors") {
      if (major <= 4) return clampInt(Math.min(major + 2, 10), 1, hardMax);
      return clampInt(Math.min(hardMax, Math.max(8, suggested)), 1, hardMax);
    }
    return clampInt(Math.min(hardMax, suggested), 1, hardMax);
  }
}

function buildPresetGuardrailDiagnostics({ inventory, fixtureMatrix, liveMeasurements }) {
  const focusedContracts = [
    {
      id: "layered-8-color",
      label: "Layered - 8 Color",
      expectedRange: [2, 8],
      hardMax: 8,
      posterizeRequired: true,
    },
    {
      id: "layered-poster",
      label: "Layered - Poster",
      expectedRange: [4, 12],
      hardMax: 12,
      posterizeRequired: true,
    },
    {
      id: "photo-many-colors",
      label: "Photo Many Colors",
      expectedRange: [8, 32],
      hardMax: 32,
      posterizeRequired: false,
    },
  ];
  const routes = ["/", "/png-to-layered-svg-for-cricut", "/jpg-to-layered-svg-for-cricut"];
  const failures = [];
  const sourceContracts = focusedContracts.map((contract) => {
    const sourcePreset =
      inventory.allPresets.find(
        (preset) => preset.id === contract.id && preset.sourceKind === "shared-layered-addition",
      ) || inventory.allPresets.find((preset) => preset.id === contract.id) || null;
    const settings = sourcePreset?.settings || {};
    const colorLayerCount = numberOrNull(settings.colorLayerCount);
    const routeLayerCount = numberOrNull(settings.layerCount);
    const requestedPaletteCount = numberOrNull(settings.requestedPaletteCount);
    const layerBuildMode = String(settings.layerBuildMode || "");
    const finalRequestedCount = requestedPaletteCount ?? colorLayerCount ?? routeLayerCount ?? null;
    const usesGroupedClientPath =
      layerBuildMode === "per-color-cutout" || layerBuildMode === "stacked-overlap";
    const sourceFindings = [];

    if (!sourcePreset) {
      sourceFindings.push(`${contract.label} source preset was not found.`);
    }
    if (colorLayerCount == null || colorLayerCount > contract.hardMax) {
      sourceFindings.push(
        `${contract.label} colorLayerCount must be present and <= ${contract.hardMax}.`,
      );
    }
    if (requestedPaletteCount == null || requestedPaletteCount > contract.hardMax) {
      sourceFindings.push(
        `${contract.label} requestedPaletteCount must be present and <= ${contract.hardMax} so the browser worker uses a bounded palette.`,
      );
    }
    if (routeLayerCount == null || routeLayerCount > contract.hardMax) {
      sourceFindings.push(
        `${contract.label} layerCount must be present and <= ${contract.hardMax} so PNG/JPG layered routes do not fall back to their route default.`,
      );
    }
    if (!usesGroupedClientPath) {
      sourceFindings.push(
        `${contract.label} must use a grouped client layerBuildMode, not raw VTracer posterize output.`,
      );
    }
    if (contract.posterizeRequired && settings.posterize !== true) {
      sourceFindings.push(`${contract.label} must keep posterize enabled for compact layered output.`);
    }
    if (contract.id === "layered-poster" && (numberOrNull(settings.posterizeStrength) ?? 0) < 4) {
      sourceFindings.push("Layered - Poster should keep posterizeStrength at 4 or higher for broad tonal bands.");
    }

    failures.push(...sourceFindings);

    return {
      presetId: contract.id,
      preset: contract.label,
      sourceFile: sourcePreset?.sourceFile || null,
      sourceKind: sourcePreset?.sourceKind || null,
      routeAvailability: sourcePreset?.routeAvailability || [],
      expectedRange: contract.expectedRange,
      hardMaxEditableGroups: contract.hardMax,
      colorLayerCount,
      routeLayerCount,
      requestedPaletteCount,
      finalRequestedCount,
      layerBuildMode: layerBuildMode || null,
      usesGroupedClientPath,
      posterize: settings.posterize ?? null,
      posterizeStrength: settings.posterizeStrength ?? null,
      colorMergeTolerance: settings.colorMergeTolerance ?? null,
      minIslandPx: settings.minIslandPx ?? null,
      holeFillPx: settings.holeFillPx ?? null,
      sourceFindings,
      sourceWithinContract: sourceFindings.length === 0,
    };
  });

  const fixtureRouteMatrix = [];
  for (const route of routes) {
    for (const contract of focusedContracts) {
      const source = sourceContracts.find((item) => item.presetId === contract.id);
      const projectedRows = fixtureMatrix.filter((row) => row.presetId === contract.id);
      for (const row of projectedRows) {
        const measuredCount = numberOrNull(row.measuredFinalGroupedOrExposedLayerCount);
        const projectedCount = numberOrNull(row.projectedFinalGroupedOrExposedLayerCount);
        const requestCeiling = numberOrNull(source?.finalRequestedCount ?? row.requestedTargetCount);
        const finalExposedGroupCount =
          measuredCount ??
          (projectedCount != null && requestCeiling != null
            ? Math.min(projectedCount, requestCeiling)
            : projectedCount ?? requestCeiling);
        const liveMeasurement = liveMeasurements.find(
          (measurement) =>
            measurement.presetId === contract.id &&
            measurement.route === route &&
            normalizeBasename(measurement.fixtureBasename) === normalizeBasename(row.inputFixture),
        );
        const countWithinContract =
          finalExposedGroupCount != null && finalExposedGroupCount <= contract.hardMax;
        const matrixRow = {
          inputFixture: row.inputFixture,
          fixtureRole: row.fixtureRole,
          route,
          presetId: contract.id,
          preset: contract.label,
          enginePath:
            route === "/"
              ? source?.usesGroupedClientPath
                ? "Homepage browser VTracer grouped palette first; server Potrace layered fallback."
                : "Homepage raw VTracer posterize risk; server Potrace fallback."
              : "Server Potrace layered mask builder.",
          requestedTargetCount: source?.finalRequestedCount ?? row.requestedTargetCount,
          projectedFixtureGroupCount: projectedCount,
          sourceGuardrailCeiling: requestCeiling,
          finalExposedGroupCount,
          rawVisibleColorCount: liveMeasurement?.rawVisibleColorCount ?? row.measuredRawVisibleColorCount ?? null,
          svgByteSize: liveMeasurement?.svgBytes ?? row.svgByteSize ?? null,
          pathCount: liveMeasurement?.pathCount ?? row.pathCount ?? null,
          countWithinContract,
          copyDownloadParity:
            liveMeasurement?.copyDownloadParity ??
            row.copyDownloadParity ??
            "not measured in this diagnostic run",
          layerEditability:
            countWithinContract && Boolean(source?.usesGroupedClientPath)
              ? "expected grouped editable layers; verified by layer-color browser smokes"
              : "guardrail not proven",
          overFlattenedRisk: row.overFlattenedRisk,
          overFragmentedRisk:
            !countWithinContract || row.overFragmentedRisk === "high" ? "high" : row.overFragmentedRisk,
          presetIntentPreserved:
            countWithinContract && source?.sourceWithinContract
              ? row.presetIntentPreservedProjection
              : "no, guardrail contract not satisfied",
        };
        fixtureRouteMatrix.push(matrixRow);
        if (!countWithinContract) {
          failures.push(
            `${contract.label} projected or measured ${finalExposedGroupCount ?? "unknown"} groups for ${row.inputFixture} on ${route}; expected <= ${contract.hardMax}.`,
          );
        }
      }
    }
  }

  for (const measurement of liveMeasurements) {
    const contract = focusedContracts.find((item) => item.id === measurement.presetId);
    if (!contract) continue;
    const measuredCount =
      numberOrNull(measurement.exposedLayerCount) ?? numberOrNull(measurement.groupedColorCount);
    if (measuredCount != null && measuredCount > contract.hardMax) {
      failures.push(
        `${contract.label} measured ${measuredCount} exposed groups in ${measurement.sourceReport}; expected <= ${contract.hardMax}.`,
      );
    }
  }

  return {
    sourceContracts,
    fixtureRouteMatrix,
    failures: Array.from(new Set(failures)),
  };
}

function transparentBoundaryRisk(fixture, contract) {
  if (fixture.transparentShare > 10) {
    if (contract.id === "photo-many-colors") return "medium: high complexity must not reintroduce background pixels";
    return "medium-low: preserve existing transparent clipping and alpha boundary tests";
  }
  return "low for opaque fixture, still covered by transparent-boundary smoke";
}

function stickerBorderCompatibility(fixture, contract) {
  if (/sticker|tomato|logo/.test(`${fixture.role} ${fixture.id}`)) {
    if (contract.id === "layered-cut-friendly" || contract.id === "layered-low-noise") return "high compatibility if islands and jagged fragments stay pruned";
    if (contract.id === "photo-many-colors") return "medium risk: detail can create many tiny border-adjacent paths";
    return "compatible with sticker-border smoke coverage";
  }
  return "not a sticker-focused fixture";
}

function performanceRiskForProjectedCount(projected, contract) {
  if (projected >= 28) return `${contract.performanceRisk}; requires 30-row editor and cumulative edit performance checks`;
  if (projected >= 18) return `${contract.performanceRisk}; watch layer editor row count and SVG byte size`;
  return contract.performanceRisk;
}

function overFlattenedRisk(fixture, contract, projected) {
  if (fixture.suggestedUiGroupCount >= 24 && projected <= 10 && !["layered-low-noise", "layered-cut-friendly", "layered-poster"].includes(contract.id)) {
    return "high";
  }
  if (fixture.majorColorCount > projected + 3) return "medium";
  return "low";
}

function overFragmentedRisk(fixture, contract, projected) {
  if (projected > contract.hardMaximumEditableColorGroups) return "high";
  if (contract.id === "layered-8-color" && projected > 8) return "high";
  if (contract.id === "photo-many-colors" && projected >= 30 && fixture.majorColorCount <= 6) return "medium-high";
  if (projected >= 28) return "medium";
  return "low";
}

function presetIntentProjection(fixture, contract, projected) {
  if (contract.id === "layered-8-color" && projected > 8) return "no, exceeds eight-color intent";
  if (["layered-cut-friendly", "layered-low-noise"].includes(contract.id) && projected > 8) return "no, too many editable groups for cleanup intent";
  if (contract.id === "photo-many-colors" && fixture.majorColorCount <= 3 && projected > 10) return "no, would invent complexity for low-color input";
  if (contract.id === "layered-detail" && fixture.suggestedUiGroupCount >= 24 && projected < 16) return "weak, detailed input is over-flattened";
  return "yes by projection, needs rendered-output validation before implementation";
}

function buildConditionalColorCountPlan() {
  return [
    {
      count: 10,
      shouldExist: true,
      reason: "Useful compact option above 8 without jumping to detail presets.",
      showWhen: "meaningful color count is roughly 7 to 14 and low-color presets would flatten too much",
    },
    {
      count: 12,
      shouldExist: true,
      reason: "Good poster/detail bridge and common enough to be meaningful.",
      showWhen: "input has 10 or more meaningful colors or poster/detail intent",
    },
    {
      count: 15,
      shouldExist: false,
      reason: "Likely redundant with 12 and 20 in a compact UI.",
      showWhen: "do not show initially",
    },
    {
      count: 20,
      shouldExist: true,
      reason: "Useful for complex illustrations without defaulting to 30.",
      showWhen: "meaningful cluster count is at least 16 and source is not cut-friendly",
    },
    {
      count: 25,
      shouldExist: false,
      reason: "Mostly redundant with 20 and 30 unless future testing finds a clear quality step.",
      showWhen: "hold back until measured",
    },
    {
      count: 30,
      shouldExist: true,
      reason: "Ceiling preset for high-detail or photo-like inputs, not a default.",
      showWhen: "analysis finds 24 or more meaningful clusters and major color families that cannot be merged without visible loss",
    },
  ].map((item) => ({
    ...item,
    safeguards: [
      "Do not show for one-color or two-color images.",
      "Do not invent colors beyond detected meaningful source clusters.",
      "Disable or hide when meaningful colors are below the requested count.",
      "Keep count presets in an expanded menu or conditional advanced area, not above upload by default.",
    ],
  }));
}

function buildRecommendedImplementationOrder() {
  return [
    {
      batch: 1,
      scope: "Layered - 8 Color and Layered - Poster contract guardrails only.",
      why: "They have the clearest compact contracts and lowest blast radius.",
      likelyFiles: [
        "app/client/workers/vtracer.worker.ts",
        "app/utils/svgLayerTrace.server.ts",
        "scripts/preset-palette-rules-audit.mjs",
        "scripts/color-region-fidelity-audit.mjs",
      ],
      tests: ["preset palette rules audit", "palette grouping audit", "layer color correctness", "color region fidelity"],
    },
    {
      batch: 2,
      scope: "Layered - Detail and Photo Many Colors, including explicit grouped-palette caps.",
      why: "These are high-complexity presets and need rendered quality plus performance evidence.",
      likelyFiles: [
        "app/client/workers/vtracer.worker.ts",
        "app/client/lib/tracing/vtracerWorkerClient.ts",
        "app/client/components/svg/LayerPaletteEditor.tsx",
        "scripts/cumulative-edit-performance-smoke.mjs",
      ],
      tests: ["color region fidelity", "cumulative edit performance", "post-conversion editability", "tool output"],
    },
    {
      batch: 3,
      scope: "Filled Layers - Separate Colors, Low Noise, and Cut Friendly contracts.",
      why: "These need different grouping aggressiveness and should not inherit Detail or Photo behavior.",
      likelyFiles: [
        "app/client/workers/vtracer.worker.ts",
        "app/utils/svgLayerTrace.server.ts",
        "scripts/sticker-border-correctness-smoke.mjs",
      ],
      tests: ["sticker border", "transparent boundary", "fish card region fidelity", "layer color correctness"],
    },
    {
      batch: 4,
      scope: "Conditional color-count presets.",
      why: "They should come only after preset contracts and meaningful-color detection are validated.",
      likelyFiles: [
        "app/client/lib/converter/presetAdditions.ts",
        "app/client/components/converter/PresetSelector.tsx",
        "app/client/workers/vtracer.worker.ts",
      ],
      tests: ["route preset smoke", "tool output", "accessibility if preset visibility changes"],
    },
    {
      batch: 5,
      scope: "Compression work.",
      why: "Compression should not obscure whether grouping preserved editable region fidelity.",
      likelyFiles: ["to be scoped after palette contracts pass"],
      tests: ["build", "tool output", "copy/download parity", "SVG sanitization and validity checks"],
    },
  ];
}

function summarize({ inventory, fixtureAnalyses, fixtureMatrix, sourceFindings, liveMeasurements, presetGuardrails }) {
  const maxSuggested = Math.max(0, ...fixtureAnalyses.map((fixture) => fixture.suggestedUiGroupCount));
  const highProjectionRows = fixtureMatrix.filter((row) => row.projectedFinalGroupedOrExposedLayerCount >= 28).length;
  const sourceRisks = [];
  if (sourceFindings.photoManyColorsCeilingRisk.present) sourceRisks.push(sourceFindings.photoManyColorsCeilingRisk.reason);
  if (sourceFindings.sharedPresetRouteMismatchRisk.present) sourceRisks.push(sourceFindings.sharedPresetRouteMismatchRisk.reason);
  if (sourceFindings.flatColorServerAdaptiveGate.heuristicAlsoMatchesFlatLikeSettings) {
    sourceRisks.push("Server fallback flat-color adaptive heuristic can match non-Flat Color flat-like presets.");
  }
  return {
    presetInventoryCount: inventory.allPresets.length,
    sharedLayeredAdditionCount: inventory.sharedLayeredAdditions.length,
    routeLocalLayeredPresetCount:
      inventory.homeRouteLocal.length + inventory.pngRouteLocal.length + inventory.jpgRouteLocal.length,
    fixtureAnalysisCount: fixtureAnalyses.length,
    maxSuggestedUiGroupCount: maxSuggested,
    matrixRowsAtOrNearCeiling: highProjectionRows,
    liveMeasurementCount: liveMeasurements.length,
    focusedGuardrailScenarioCount: presetGuardrails.fixtureRouteMatrix.length,
    focusedGuardrailFailureCount: presetGuardrails.failures.length,
    sourceRisks,
    result:
      presetGuardrails.failures.length
        ? "Focused 8 Color and Poster guardrails are not yet satisfied."
        : "Focused 8 Color and Poster guardrails passed source and fixture contract diagnostics. Rendered route validation is still required for visual fidelity.",
  };
}

async function serverState() {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(20_000) });
    const text = await response.text();
    return {
      reachable: true,
      status: response.status,
      title: text.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() || "",
      looksLikeIlovesvg: /iLoveSVG|SVG Converter|image to SVG/i.test(text),
    };
  } catch (error) {
    return {
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
      note: "The audit still runs source and fixture diagnostics when the local server is unavailable.",
    };
  }
}

async function gitState() {
  const { execFile } = await import("node:child_process");
  const run = (args) =>
    new Promise((resolve) => {
      execFile("git", args, { cwd: rootDir, windowsHide: true }, (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: String(stdout || "").trim(),
          stderr: String(stderr || "").trim(),
        });
      });
    });
  const [branch, head, status] = await Promise.all([
    run(["branch", "--show-current"]),
    run(["rev-parse", "--short", "HEAD"]),
    run(["status", "--short", "--branch"]),
  ]);
  return {
    branch: branch.stdout,
    head: head.stdout,
    status: status.stdout,
  };
}

function lineNumber(source, index) {
  if (index < 0) return null;
  return source.slice(0, index).split(/\r?\n/).length;
}

function readConstNumber(source, constName) {
  const match = source.match(new RegExp(`const\\s+${escapeRegExp(constName)}\\s*=\\s*(\\d+)`));
  return match ? Number(match[1]) : null;
}

function normalizeBasename(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "-");
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function numberOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampInt(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex(rgb) {
  return `#${[rgb.r, rgb.g, rgb.b].map((value) => clampByte(value).toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex) {
  const value = String(hex || "").replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16) || 0,
    g: parseInt(value.slice(2, 4), 16) || 0,
    b: parseInt(value.slice(4, 6), 16) || 0,
  };
}

function luminance(rgb) {
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function saturation(rgb) {
  const max = Math.max(rgb.r, rgb.g, rgb.b) / 255;
  const min = Math.min(rgb.r, rgb.g, rgb.b) / 255;
  if (max === min) return 0;
  const lightness = (max + min) / 2;
  return ((max - min) / (1 - Math.abs(2 * lightness - 1))) * 100;
}

function isNearBlack(rgb) {
  return luminance(rgb) <= 38 && saturation(rgb) <= 42;
}

function isNearWhite(rgb) {
  return luminance(rgb) >= 235 && saturation(rgb) <= 28;
}

function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11);
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
