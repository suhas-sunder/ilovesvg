import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const debugPort = Number(process.env.CDP_PORT || 10450 + Math.floor(Math.random() * 300));
const runDir = path.join(rootDir, "tmp", "high-fidelity-browser-output-smoke");
const downloadRoot = path.join(runDir, "downloads");
const renderRoot = path.join(runDir, "renders");
const reportPath = process.env.HF_BROWSER_OUTPUT_REPORT_PATH
  ? path.resolve(process.env.HF_BROWSER_OUTPUT_REPORT_PATH)
  : path.join(runDir, "report.json");
const profileDir = path.join(os.tmpdir(), "ilovesvg-high-fidelity-browser-output-smoke", String(debugPort));
const scenarioTimeoutMs = Number(process.env.HF_BROWSER_OUTPUT_TIMEOUT_MS || 300_000);
const preferredSvgBytes = Number(process.env.HF_BROWSER_OUTPUT_PREFERRED_BYTES || 1_200_000);
const acceptableSvgBytes = Number(process.env.HF_BROWSER_OUTPUT_ACCEPTABLE_BYTES || 1_500_000);
const maxSvgBytes = Number(process.env.HF_BROWSER_OUTPUT_MAX_BYTES || 1_500_000);
const maxCriticalPresetSvgBytes = Number(process.env.HF_BROWSER_OUTPUT_MAX_PRESET_BYTES || 3_000_000);
const minHighDetailLayerCount = Number(process.env.HF_BROWSER_OUTPUT_MIN_LAYERS || 20);
const maxGroupedColors = Number(process.env.HF_BROWSER_OUTPUT_MAX_GROUPS || 32);

const defaultFlatFixtures = [
  "C:\\Users\\Suhas\\Downloads\\IMG_8846.JPEG",
  "C:\\Users\\Suhas\\Downloads\\IMG_9404.JPEG",
];
const extraFlatFixtures = (process.env.HF_BROWSER_OUTPUT_EXTRA_FIXTURES || "")
  .split(/[;\n]/)
  .map((fixture) => fixture.trim())
  .filter(Boolean);
const allFlatFixtures = Array.from(
  new Set([...defaultFlatFixtures, ...extraFlatFixtures]),
);

const allPresetChecks = [
  { id: "layered-flat-color", label: "Layered - Flat Color", pattern: /^Layered - Flat Color(?! \()\b/i },
  { id: "layered-flat-color-medium-quality", label: "Layered - Flat Color (Medium Quality)", pattern: /^Layered - Flat Color \(Medium Quality\)(?:\s|$)/i },
  { id: "layered-flat-color-high-quality", label: "Layered - Flat Color (High Quality)", pattern: /^Layered - Flat Color \(High Quality\)(?:\s|$)/i },
  { id: "layered-flat-color-insane-quality", label: "Layered - Flat Color (Amazing Quality)", pattern: /^Layered - Flat Color \(Amazing Quality\)(?:\s|$)/i },
  { id: "layered-insane-quality", label: "Layered - Amazing Quality", pattern: /^Layered - Amazing Quality(?:\s|$)/i },
  { id: "photo-many-colors", label: "Photo Many Colors", pattern: /^Photo Many Colors(?! \()\b/i },
  { id: "photo-many-colors-medium-quality", label: "Photo Many Colors (Medium Quality)", pattern: /^Photo Many Colors \(Medium Quality\)(?:\s|$)/i },
  { id: "photo-many-colors-high-quality", label: "Photo Many Colors (High Quality)", pattern: /^Photo Many Colors \(High Quality\)(?:\s|$)/i },
  { id: "photo-many-colors-insane-quality", label: "Photo Many Colors (Amazing Quality)", pattern: /^Photo Many Colors \(Amazing Quality\)(?:\s|$)/i },
  { id: "premium-cartoon-fill-ink", label: "Premium Cartoon Fill + Ink", pattern: /^Premium Cartoon Fill \+ Ink\b/i },
  { id: "sticker-fill-stroke-detail", label: "Sticker Fill + Stroke Detail", pattern: /^Sticker Fill \+ Stroke Detail\b/i },
  { id: "filled-layers-separate-colors", label: "Filled Layers - Separate Colors", pattern: /^Filled Layers - Separate Colors(?! \()\b/i },
  { id: "filled-layers-separate-colors-medium-quality", label: "Filled Layers - Separate Colors (Medium Quality)", pattern: /^Filled Layers - Separate Colors \(Medium Quality\)(?:\s|$)/i },
  { id: "filled-layers-separate-colors-high-quality", label: "Filled Layers - Separate Colors (High Quality)", pattern: /^Filled Layers - Separate Colors \(High Quality\)(?:\s|$)/i },
  { id: "filled-layers-separate-colors-insane-quality", label: "Filled Layers - Separate Colors (Amazing Quality)", pattern: /^Filled Layers - Separate Colors \(Amazing Quality\)(?:\s|$)/i },
  { id: "layered-detail", label: "Layered - Detail", pattern: /^Layered - Detail(?! \()\b/i },
  { id: "layered-detail-medium-quality", label: "Layered - Detail (Medium Quality)", pattern: /^Layered - Detail \(Medium Quality\)(?:\s|$)/i },
  { id: "layered-detail-high-quality", label: "Layered - Detail (High Quality)", pattern: /^Layered - Detail \(High Quality\)(?:\s|$)/i },
  { id: "layered-detail-insane-quality", label: "Layered - Detail (Amazing Quality)", pattern: /^Layered - Detail \(Amazing Quality\)(?:\s|$)/i },
  { id: "layered-poster", label: "Layered - Poster", pattern: /^Layered - Poster\b/i },
  { id: "layered-8-color", label: "Layered - 8 Color", pattern: /^Layered - 8 Color\b/i },
];

const img8846 = "C:\\Users\\Suhas\\Downloads\\IMG_8846.JPEG";
const flatFixtures = process.env.HF_BROWSER_OUTPUT_FIXTURE_BASENAME
  ? allFlatFixtures.filter((fixture) => path.basename(fixture).toLowerCase() === process.env.HF_BROWSER_OUTPUT_FIXTURE_BASENAME.toLowerCase())
  : allFlatFixtures;
const presetMatrixFixture = flatFixtures[0] || img8846;
const requestedPresetIds = process.env.HF_BROWSER_OUTPUT_PRESET_IDS
  ? new Set(process.env.HF_BROWSER_OUTPUT_PRESET_IDS.split(",").map((id) => id.trim()).filter(Boolean))
  : process.env.HF_BROWSER_OUTPUT_PRESET_ID
    ? new Set([process.env.HF_BROWSER_OUTPUT_PRESET_ID])
    : null;
const presetChecks = requestedPresetIds
  ? allPresetChecks.filter((preset) => requestedPresetIds.has(preset.id))
  : allPresetChecks;
const runFlatMatrix = process.env.HF_BROWSER_OUTPUT_RUN_FLAT !== "0";
const runPresetMatrix = process.env.HF_BROWSER_OUTPUT_RUN_PRESETS === "1";
const runTierComparison =
  process.env.HF_BROWSER_OUTPUT_RUN_TIER_COMPARISON === "1" ||
  (!requestedPresetIds && process.env.HF_BROWSER_OUTPUT_RUN_TIER_COMPARISON !== "0");
const renderPreviews = process.env.HF_BROWSER_OUTPUT_RENDER !== "0";
const qualityTierComparisonFamilies = [
  {
    label: "Layered - Flat Color",
    order: [
      "layered-flat-color",
      "layered-flat-color-medium-quality",
      "layered-flat-color-high-quality",
      "layered-flat-color-insane-quality",
    ],
  },
  {
    label: "Photo Many Colors",
    order: [
      "photo-many-colors",
      "photo-many-colors-medium-quality",
      "photo-many-colors-high-quality",
      "photo-many-colors-insane-quality",
    ],
  },
  {
    label: "Layered - Detail",
    order: [
      "layered-detail",
      "layered-detail-medium-quality",
      "layered-detail-high-quality",
      "layered-detail-insane-quality",
    ],
  },
  {
    label: "Filled Layers - Separate Colors",
    order: [
      "filled-layers-separate-colors",
      "filled-layers-separate-colors-medium-quality",
      "filled-layers-separate-colors-high-quality",
      "filled-layers-separate-colors-insane-quality",
    ],
  },
  {
    label: "Layered - Amazing Quality",
    order: ["layered-insane-quality"],
  },
];
const qualityTierComparisonPresets = Array.from(
  new Set(qualityTierComparisonFamilies.flatMap((family) => family.order)),
)
  .map((id) => allPresetChecks.find((preset) => preset.id === id))
  .filter(Boolean);

async function main() {
  await fs.rm(runDir, { recursive: true, force: true });
  await fs.rm(profileDir, { recursive: true, force: true });
  await fs.mkdir(downloadRoot, { recursive: true });
  await fs.mkdir(renderRoot, { recursive: true });
  await fs.mkdir(profileDir, { recursive: true });

  const server = await serverState();
  if (!server.looksLikeIlovesvg) throw new Error(`Expected iLoveSVG at ${baseUrl}`);

  const browserPath = await findBrowserExecutable();
  const browser = spawn(
    browserPath,
    [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      "--headless=new",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-component-extensions-with-background-pages",
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1440,1050",
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  browser.unref?.();

  const report = {
    checkedAt: new Date().toISOString(),
    baseUrl,
    gitHead: await gitHead(),
    server,
    browserPath,
    budgets: {
      scenarioTimeoutMs,
      preferredSvgBytes,
      acceptableSvgBytes,
      maxSvgBytes,
      maxCriticalPresetSvgBytes,
      minHighDetailLayerCount,
      maxGroupedColors,
    },
    flatColor: [],
    qualityTierComparison: [],
    presetStuckLoading: [],
    outputStructure: {},
    failures: [],
    notes: [],
  };

  try {
    await waitForCdp();
    if (runFlatMatrix) for (const fixturePath of flatFixtures) {
      const result = await runUiScenario({
        fixturePath,
        preset: presetChecks[0],
        scenarioId: `flat-${path.basename(fixturePath).replace(/\W+/g, "-").toLowerCase()}`,
        timeoutMs: scenarioTimeoutMs,
        collectStructure: true,
        renderPreview: renderPreviews,
      }).catch(async (error) => ({
        scenarioId: `flat-${path.basename(fixturePath).replace(/\W+/g, "-").toLowerCase()}`,
        route: "/",
        presetId: presetChecks[0].id,
        presetLabel: presetChecks[0].label,
        fixture: await fixtureInfo(fixturePath).catch(() => ({ path: fixturePath, basename: path.basename(fixturePath) })),
        completed: false,
        elapsedMs: null,
        harnessError: error instanceof Error ? error.message : String(error),
        harnessStack: error instanceof Error ? error.stack : null,
      }));
      report.flatColor.push(result);
      if (result.structure) report.outputStructure[path.basename(fixturePath)] = result.structure;
      await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
      console.error(`[flat] ${path.basename(fixturePath)} ${result.completed ? "completed" : "not-complete"} layers=${result.ui?.layerTotalCount ?? "n/a"} bytes=${result.download?.bytes ?? 0}`);
    }

    if (runTierComparison) for (const fixturePath of flatFixtures) {
      for (const preset of qualityTierComparisonPresets) {
        const existing = preset.id === "layered-flat-color"
          ? report.flatColor.find((item) => item.fixture?.basename === path.basename(fixturePath))
          : null;
        const result = existing || await runUiScenario({
          fixturePath,
          preset,
          scenarioId: `tier-${path.basename(fixturePath).replace(/\W+/g, "-").toLowerCase()}-${preset.id}`,
          timeoutMs: scenarioTimeoutMs,
          collectStructure: true,
          renderPreview: renderPreviews,
        }).catch(async (error) => ({
          scenarioId: `tier-${path.basename(fixturePath).replace(/\W+/g, "-").toLowerCase()}-${preset.id}`,
          route: "/",
          presetId: preset.id,
          presetLabel: preset.label,
          fixture: await fixtureInfo(fixturePath).catch(() => ({ path: fixturePath, basename: path.basename(fixturePath) })),
          completed: false,
          elapsedMs: null,
          harnessError: error instanceof Error ? error.message : String(error),
          harnessStack: error instanceof Error ? error.stack : null,
        }));
        report.qualityTierComparison.push(toQualityTierComparisonEntry(result));
        await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
        console.error(`[tier] ${path.basename(fixturePath)} ${preset.label} ${result.completed ? "completed" : "not-complete"} ${Math.round((result.elapsedMs || 0) / 1000)}s`);
      }
    }

    if (runPresetMatrix) for (const preset of presetChecks) {
      const existing = preset.id === "layered-flat-color"
        ? report.flatColor.find((item) => item.fixture.basename === path.basename(presetMatrixFixture))
        : null;
      const result = existing || await runUiScenario({
        fixturePath: presetMatrixFixture,
        preset,
        scenarioId: `preset-${preset.id}`,
        timeoutMs: scenarioTimeoutMs,
        collectStructure: true,
        renderPreview: isQualityTierPresetId(preset.id),
      }).catch(async (error) => ({
        scenarioId: `preset-${preset.id}`,
        route: "/",
        presetId: preset.id,
        presetLabel: preset.label,
        fixture: await fixtureInfo(presetMatrixFixture).catch(() => ({ path: presetMatrixFixture, basename: path.basename(presetMatrixFixture) })),
        completed: false,
        elapsedMs: null,
        harnessError: error instanceof Error ? error.message : String(error),
        harnessStack: error instanceof Error ? error.stack : null,
      }));
      report.presetStuckLoading.push({
        presetId: preset.id,
        presetLabel: preset.label,
        selectedPreset: result.selectedPreset,
        completed: result.completed,
        elapsedMs: result.elapsedMs,
        engineUsed: result.ui?.engineUsed || null,
        engineLine: result.ui?.engineLine || null,
        outputTitle: result.ui?.outputTitle || null,
        fixture: result.fixture || null,
        fixtureBytes: result.fixture?.bytes ?? null,
        fixtureWidth: result.fixture?.displayWidth ?? result.fixture?.width ?? null,
        fixtureHeight: result.fixture?.displayHeight ?? result.fixture?.height ?? null,
        svgBytes: result.download?.bytes ?? result.ui?.svgBytesAttr ?? null,
        svgWidth: result.svg?.width ?? null,
        svgHeight: result.svg?.height ?? null,
        visibleColorCount: result.svg?.visibleColorCount ?? null,
        dataLayerColorCount: result.svg?.dataLayerColorCount ?? null,
        layerTotalCount: result.ui?.layerTotalCount ?? null,
        layerMountedCount: result.ui?.layerMountedCount ?? null,
        layerCountText: result.ui?.layerCountText || null,
        structure: result.structure || null,
        render: result.render || null,
        previewVisible: result.ui?.previewVisible ?? null,
        settingsOpened: result.ui?.settingsOpened ?? null,
        copyDownloadParity: result.copyDownloadParity || null,
        pendingAfterTimeout: !result.completed ? result.pendingState : null,
        harnessError: result.harnessError || null,
        consoleErrors: result.consoleErrors || [],
        networkErrors: result.networkErrors || [],
      });
      await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
      console.error(`[preset] ${preset.label} ${result.completed ? "completed" : "not-complete"} ${Math.round(result.elapsedMs / 1000)}s`);
    }
  } finally {
    await stopSpawnedBrowser(browser).catch((error) => {
      report.notes.push(`Browser cleanup warning: ${error instanceof Error ? error.message : String(error)}`);
    });
    report.failures = collectFailures(report);
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  const failures = collectFailures(report);
  report.failures = failures;
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  const ok = failures.length === 0;
  console.log(JSON.stringify({
    ok,
    reportPath,
    failureCount: failures.length,
    failures,
    flatColor: report.flatColor.map((item) => ({
      fixture: item.fixture.basename,
      completed: item.completed,
      layerCountText: item.ui?.layerCountText,
      layerTotalCount: item.ui?.layerTotalCount,
      engineUsed: item.ui?.engineUsed,
      bytes: item.download?.bytes,
      pathCount: item.svg?.pathCount,
      visibleColorCount: item.svg?.visibleColorCount,
      dataLayerColorCount: item.svg?.dataLayerColorCount,
      averageDecimalPlaces: item.structure?.averageDecimalPlaces,
      largestPathDataLength: item.structure?.largestPathDataLength,
      copyDownloadParity: item.copyDownloadParity?.ok,
    })),
    presets: report.presetStuckLoading.map((item) => ({
      preset: item.presetLabel,
      completed: item.completed,
      elapsedMs: item.elapsedMs,
      layers: item.layerTotalCount,
      bytes: item.svgBytes,
      ratio: item.fixtureBytes && item.svgBytes
        ? Number((item.svgBytes / item.fixtureBytes).toFixed(3))
        : null,
    })),
    qualityTierComparison: report.qualityTierComparison.map((item) => ({
      fixture: item.fixture?.basename,
      preset: item.presetLabel,
      completed: item.completed,
      elapsedMs: item.elapsedMs,
      layers: item.layerTotalCount,
      bytes: item.svgBytes,
      score: item.render ? Number(qualityTierSourceDetailScore(item).toFixed(4)) : null,
      pairedDetailMetrics: item.render?.pairedDetailMetrics || null,
    })),
  }, null, 2));
  if (!ok) process.exitCode = 1;
}

function toQualityTierComparisonEntry(result) {
  return {
    scenarioId: result.scenarioId,
    route: result.route,
    presetId: result.presetId,
    presetLabel: result.presetLabel,
    tier: qualityTierForPresetId(result.presetId),
    fixture: result.fixture || null,
    completed: result.completed,
    elapsedMs: result.elapsedMs,
    selectedPreset: result.selectedPreset || null,
    engineUsed: result.ui?.engineUsed || null,
    engineLine: result.ui?.engineLine || null,
    outputTitle: result.ui?.outputTitle || null,
    svgBytes: result.download?.bytes ?? result.ui?.svgBytesAttr ?? null,
    svgWidth: result.svg?.width ?? null,
    svgHeight: result.svg?.height ?? null,
    visibleColorCount: result.svg?.visibleColorCount ?? null,
    dataLayerColorCount: result.svg?.dataLayerColorCount ?? null,
    layerTotalCount: result.ui?.layerTotalCount ?? null,
    pathCount: result.svg?.pathCount ?? result.structure?.pathCount ?? null,
    segmentCount: result.structure?.totalPathSegmentCount ?? null,
    structure: result.structure || null,
    render: result.render || null,
    previewVisible: result.ui?.previewVisible ?? null,
    settingsOpened: result.ui?.settingsOpened ?? null,
    copyDownloadParity: result.copyDownloadParity || null,
    copyHash: result.copyDownloadParity?.copyHash || null,
    downloadHash: result.copyDownloadParity?.downloadHash || null,
    harnessError: result.harnessError || null,
    consoleErrors: result.consoleErrors || [],
    networkErrors: result.networkErrors || [],
  };
}

function collectFailures(report) {
  const failures = [];
  if (presetChecks.length === 0) {
    failures.push({
      scenarioId: "preset-selection",
      fixture: null,
      preset: null,
      reason: "No presets matched the requested high-fidelity browser smoke filter",
    });
    return failures;
  }
  for (const result of report.flatColor) {
    failures.push(...validateHighFidelityFlatResult(result));
  }
  if (runTierComparison) {
    for (const result of report.qualityTierComparison) {
      failures.push(...validateQualityTierResult(result));
    }
    failures.push(...validateProgressiveQualityTierComparison(report.qualityTierComparison));
    failures.push(...validateQualityTierFamilyCollapse(report.qualityTierComparison));
  }
  if (runPresetMatrix) {
    for (const result of report.presetStuckLoading) {
      failures.push(...validatePresetTriageResult(result));
    }
  }
  return failures;
}

function qualityTierForPresetId(presetId) {
  const id = String(presetId || "").toLowerCase();
  if (id.endsWith("-insane-quality") || id === "layered-insane-quality") return "amazing";
  if (id.endsWith("-high-quality")) return "high";
  if (id.endsWith("-medium-quality")) return "medium";
  return "default";
}

function isQualityTierPresetId(presetId) {
  return qualityTierForPresetId(presetId) !== "default";
}

function qualityTierRatioCeiling(tier) {
  if (tier === "high" || tier === "amazing") return 10;
  if (tier === "medium") return 3;
  return null;
}

function normalizeUiText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function validateHighFidelityFlatResult(result) {
  const label = `${result.fixture?.basename || result.scenarioId} / ${result.presetLabel || "Layered - Flat Color"}`;
  const failures = [];
  const add = (reason) => failures.push({ scenarioId: result.scenarioId, fixture: result.fixture?.basename || null, preset: result.presetLabel || null, reason });
  if (result.harnessError) add(`harness error: ${result.harnessError}`);
  if (!result.selectedPreset?.selected) add(`requested preset was not selected: ${result.selectedPreset?.reason || "unknown reason"}`);
  if (!result.completed) add(`usable output was not reached within ${scenarioTimeoutMs} ms`);
  if (
    result.presetLabel &&
    result.ui?.outputTitle &&
    !normalizeUiText(result.ui.outputTitle).includes(normalizeUiText(result.presetLabel))
  ) {
    add(`latest output title did not match requested preset; saw "${result.ui.outputTitle}"`);
  }
  if (!result.ui?.settingsOpened) add("Settings / Edit did not open for the latest output");
  if (!result.ui?.layerCountText && !result.ui?.layerTotalCount) {
    add("Layer colors section did not expose count text or count metadata");
  }
  if (!result.download?.bytes) add("Download SVG did not produce a file");
  if (!result.copyDownloadParity?.ok) add("Copy SVG and Download SVG did not match");
  const layerCount = result.ui?.layerTotalCount ?? result.svg?.dataLayerColorCount ?? 0;
  if (layerCount < minHighDetailLayerCount) add(`grouped layer count regressed below ${minHighDetailLayerCount}; saw ${layerCount} for ${label}`);
  if (layerCount > maxGroupedColors) add(`grouped layer count exceeded ${maxGroupedColors}; saw ${layerCount}`);
  const visibleColors = result.svg?.visibleColorCount ?? 0;
  if (visibleColors > maxGroupedColors) add(`visible color count exceeded ${maxGroupedColors}; saw ${visibleColors}`);
  const tier = qualityTierForPresetId(result.presetId);
  const ratioCeiling = qualityTierRatioCeiling(tier);
  const fixtureBytes = Number(result.fixture?.bytes || 0);
  const sizeBudget = ratioCeiling && fixtureBytes > 0
    ? Math.round(fixtureBytes * ratioCeiling)
    : maxSvgBytes;
  if ((result.download?.bytes || 0) > sizeBudget) {
    const budgetLabel = ratioCeiling
      ? `${ratioCeiling}x input size (${sizeBudget} bytes)`
      : `${maxSvgBytes} bytes`;
    add(`downloaded SVG exceeded ${budgetLabel}; saw ${result.download.bytes}`);
  }
  if (tier === "default" && (result.download?.bytes || 0) > acceptableSvgBytes) {
    add(`downloaded SVG exceeded acceptable intermediate budget ${acceptableSvgBytes} bytes; saw ${result.download.bytes}`);
  }
  const expectedWidth = result.fixture?.displayWidth || result.fixture?.width || 0;
  const expectedHeight = result.fixture?.displayHeight || result.fixture?.height || 0;
  if (expectedWidth && expectedHeight && result.svg?.width && result.svg?.height) {
    if (result.svg.width < expectedWidth || result.svg.height < expectedHeight) {
      add(`SVG dimensions were reduced from displayed source ${expectedWidth} x ${expectedHeight} to ${result.svg.width} x ${result.svg.height}`);
    }
  }
  if (!result.structure) {
    add("SVG structure report was not collected");
  } else {
    if (result.structure.totalBytes > sizeBudget) add(`structure bytes exceeded ${sizeBudget}; saw ${result.structure.totalBytes}`);
    if (result.structure.pathCount < 1) add("SVG structure has no paths");
    if (result.structure.averageDecimalPlaces > 3) add(`path numeric precision is still excessive; average decimal places ${result.structure.averageDecimalPlaces}`);
  }
  failures.push(...validateRenderMetrics(result, label));
  return failures;
}

function validatePresetTriageResult(result) {
  const failures = [];
  const add = (reason) => failures.push({ scenarioId: `preset-${result.presetId}`, fixture: path.basename(img8846), preset: result.presetLabel, reason });
  if (result.harnessError) add(`harness error: ${result.harnessError}`);
  if (!result.selectedPreset?.selected) add(`requested preset was not selected: ${result.selectedPreset?.reason || "unknown reason"}`);
  if (!result.completed) add(`preset did not reach usable output within ${scenarioTimeoutMs} ms`);
  if (
    result.presetLabel &&
    result.outputTitle &&
    !normalizeUiText(result.outputTitle).includes(normalizeUiText(result.presetLabel))
  ) {
    add(`latest output title did not match requested preset; saw "${result.outputTitle}"`);
  }
  if (!result.previewVisible) add("preset preview was not visible");
  if (!result.settingsOpened) add("Settings / Edit did not open");
  if (!result.copyDownloadParity?.ok) add("Copy SVG and Download SVG did not match");
  const tier = qualityTierForPresetId(result.presetId);
  const ratioCeiling = qualityTierRatioCeiling(tier);
  const fixtureBytes = Number(result.fixtureBytes || 0);
  const budgetBytes = ratioCeiling && fixtureBytes > 0
    ? Math.round(fixtureBytes * ratioCeiling)
    : maxCriticalPresetSvgBytes;
  if ((result.svgBytes || 0) > budgetBytes) {
    const budgetLabel = ratioCeiling
      ? `${ratioCeiling}x input size (${budgetBytes} bytes)`
      : `${maxCriticalPresetSvgBytes} bytes`;
    add(`preset SVG exceeded ${budgetLabel}; saw ${result.svgBytes} bytes`);
  }
  if (tier !== "default" && result.render) {
    failures.push(...validateRenderMetrics(result, result.presetLabel));
  }
  const expectedWidth = Number(result.fixtureWidth || 0);
  const expectedHeight = Number(result.fixtureHeight || 0);
  if (expectedWidth && expectedHeight && result.svgWidth && result.svgHeight) {
    if (result.svgWidth < expectedWidth || result.svgHeight < expectedHeight) {
      add(`SVG dimensions were reduced from source ${expectedWidth} x ${expectedHeight} to ${result.svgWidth} x ${result.svgHeight}`);
    }
  }
  const layerCount = result.layerTotalCount || 0;
  if (layerCount > maxGroupedColors) add(`grouped layer count exceeded ${maxGroupedColors}; saw ${layerCount}`);
  if (tier !== "default" && layerCount < minHighDetailLayerCount) {
    add(`quality-tier preset fell below ${minHighDetailLayerCount} editable layers; saw ${layerCount}`);
  }
  return failures;
}

function validateQualityTierResult(result) {
  const failures = [];
  const add = (reason) => failures.push({
    scenarioId: result.scenarioId,
    fixture: result.fixture?.basename || null,
    preset: result.presetLabel || null,
    reason,
  });
  if (result.harnessError) add(`harness error: ${result.harnessError}`);
  if (!result.selectedPreset?.selected) add(`requested preset was not selected: ${result.selectedPreset?.reason || "unknown reason"}`);
  if (!result.completed) add(`tier comparison did not reach usable output within ${scenarioTimeoutMs} ms`);
  if (!result.previewVisible) add("tier comparison preview was not visible");
  if (!result.settingsOpened) add("Settings / Edit did not open");
  if (!result.copyDownloadParity?.ok) add("Copy SVG and Download SVG did not match");
  const layerCount = result.layerTotalCount || result.dataLayerColorCount || 0;
  if (layerCount > maxGroupedColors) add(`grouped layer count exceeded ${maxGroupedColors}; saw ${layerCount}`);
  const tier = qualityTierForPresetId(result.presetId);
  if (tier !== "default" && layerCount < minHighDetailLayerCount) {
    add(`quality-tier output fell below ${minHighDetailLayerCount} editable layers; saw ${layerCount}`);
  }
  const fixtureBytes = Number(result.fixture?.bytes || 0);
  const ratioCeiling = qualityTierRatioCeiling(tier);
  const budgetBytes = ratioCeiling && fixtureBytes > 0
    ? Math.round(fixtureBytes * ratioCeiling)
    : maxSvgBytes;
  const shouldEnforceSizeBudget =
    tier !== "default" || result.presetId === "layered-flat-color";
  if (shouldEnforceSizeBudget && (result.svgBytes || 0) > budgetBytes) {
    add(`tier comparison SVG exceeded ${ratioCeiling ? `${ratioCeiling}x input size` : `${budgetBytes} bytes`}; saw ${result.svgBytes}`);
  }
  const expectedWidth = Number(result.fixture?.displayWidth || result.fixture?.width || 0);
  const expectedHeight = Number(result.fixture?.displayHeight || result.fixture?.height || 0);
  if (expectedWidth && expectedHeight && result.svgWidth && result.svgHeight) {
    if (result.svgWidth < expectedWidth || result.svgHeight < expectedHeight) {
      add(`SVG dimensions were reduced from source ${expectedWidth} x ${expectedHeight} to ${result.svgWidth} x ${result.svgHeight}`);
    }
  }
  failures.push(...validateRenderMetrics(result, result.presetLabel));
  return failures;
}

function validateProgressiveQualityTierComparison(results) {
  const failures = [];
  const byFixture = new Map();
  for (const result of results) {
    const basename = result.fixture?.basename || "unknown";
    if (!byFixture.has(basename)) byFixture.set(basename, new Map());
    byFixture.get(basename).set(result.presetId, result);
  }

  for (const [fixture, byPreset] of byFixture.entries()) {
    for (const family of qualityTierComparisonFamilies) {
      if (family.order.length < 2) continue;
      const ordered = family.order.map((id) => byPreset.get(id));
      for (const [index, result] of ordered.entries()) {
        if (!result) {
          failures.push({
            scenarioId: `tier-comparison-${fixture}-${family.label}`,
            fixture,
            preset: family.order[index],
            reason: `missing ${family.order[index]} from ${family.label} progressive tier comparison`,
          });
        }
      }
      if (ordered.some((result) => !result?.completed || !result.render?.pairedDetailMetrics)) {
        continue;
      }
      const scored = ordered.map((result) => ({
        result,
        score: qualityTierSourceDetailScore(result),
      }));
      const requiredDeltas = [0.004, 0.0035, 0.0045];
      for (let index = 1; index < scored.length; index += 1) {
        const previous = scored[index - 1];
        const current = scored[index];
        const previousPaired = previous.result.render.pairedDetailMetrics;
        const currentPaired = current.result.render.pairedDetailMetrics;
        const previousOutput = previous.result.render.outputMetrics || {};
        const currentOutput = current.result.render.outputMetrics || {};
        const improvesWrongRegionDarkFromDefault =
          index === 1 &&
          currentPaired.unsupportedOutputDarkShare <= previousPaired.unsupportedOutputDarkShare - 0.004 &&
          currentPaired.sourceSupportedDarkRecall >= previousPaired.sourceSupportedDarkRecall * 0.82;
        const improvesControlledSourceRecallFromDefault =
          index === 1 &&
          currentPaired.sourceSupportedDarkRecall >= previousPaired.sourceSupportedDarkRecall + 0.004 &&
          currentPaired.sourceHighContrastDarkRecall >= previousPaired.sourceHighContrastDarkRecall * 0.96 &&
          currentPaired.unsupportedOutputDarkShare <= previousPaired.unsupportedOutputDarkShare + 0.0025;
        const improvesNoisyDefaultCleanup =
          index === 1 &&
          previousPaired.unsupportedOutputDarkShare >= 0.024 &&
          currentPaired.unsupportedOutputDarkShare <= previousPaired.unsupportedOutputDarkShare - 0.006 &&
          currentPaired.sourceSupportedDarkRecall >= 0.12 &&
          currentPaired.sourceHighContrastDarkRecall >= 0.16 &&
          (currentOutput.darkPixelShare || 0) <= (previousOutput.darkPixelShare || 0) * 0.84 &&
          ((current.score >= previous.score - 0.06 &&
            (currentOutput.colorfulPixelShare || 0) >= (previousOutput.colorfulPixelShare || 0) * 0.98) ||
            ((currentOutput.lightNeutralPixelShare || 0) >= (previousOutput.lightNeutralPixelShare || 0) * 1.1 &&
              (currentOutput.highContrastEdgeShare || 0) >= (previousOutput.highContrastEdgeShare || 0) * 0.72));
        const improvesSourceDetailFromDefault =
          index === 1 &&
          currentPaired.sourceSupportedDarkRecall >= previousPaired.sourceSupportedDarkRecall + 0.004 &&
          currentPaired.sourceHighContrastDarkRecall >= previousPaired.sourceHighContrastDarkRecall + 0.004 &&
          currentPaired.unsupportedOutputDarkShare <= previousPaired.unsupportedOutputDarkShare + 0.003;
        const improvesBalancedDarkFromDefault =
          index === 1 &&
          currentPaired.sourceSupportedDarkRecall >= previousPaired.sourceSupportedDarkRecall + 0.002 &&
          currentPaired.unsupportedOutputDarkShare <= previousPaired.unsupportedOutputDarkShare - 0.002;
        const improvesHighContrastDetail =
          index > 1 &&
          currentPaired.sourceHighContrastDarkRecall >= previousPaired.sourceHighContrastDarkRecall + 0.002 &&
          currentPaired.sourceSupportedDarkRecall >= previousPaired.sourceSupportedDarkRecall * 0.99;
        const improvesSourceConstrainedFineEdges =
          index > 1 &&
          (current.result.render.outputMetrics?.highContrastEdgeShare || 0) >=
            (previous.result.render.outputMetrics?.highContrastEdgeShare || 0) + 0.0008 &&
          (current.result.render.outputMetrics?.nearBlackPixelShare || 0) >=
            (previous.result.render.outputMetrics?.nearBlackPixelShare || 0) * 1.02 &&
          currentPaired.unsupportedOutputDarkShare <= previousPaired.unsupportedOutputDarkShare + 0.003;
        const improvesGlareRegionDetail =
          index > 1 &&
          currentPaired.sourceGlareDetailPixelShare >= 0.003 &&
          currentPaired.sourceGlareDetailRecall >= previousPaired.sourceGlareDetailRecall + 0.006 &&
          currentPaired.sourceHighContrastDarkRecall >= previousPaired.sourceHighContrastDarkRecall * 0.98 &&
          currentPaired.unsupportedOutputDarkShare <= previousPaired.unsupportedOutputDarkShare + 0.004;
        const improvesCleanGlareDetail =
          index > 1 &&
          currentPaired.sourceGlareDetailPixelShare >= 0.003 &&
          currentPaired.sourceGlareDetailRecall >= previousPaired.sourceGlareDetailRecall + 0.018 &&
          currentPaired.sourceHighContrastDarkRecall >= previousPaired.sourceHighContrastDarkRecall * 0.91 &&
          currentPaired.sourceSupportedDarkRecall >= previousPaired.sourceSupportedDarkRecall * 0.91 &&
          currentPaired.unsupportedOutputDarkShare <= previousPaired.unsupportedOutputDarkShare + 0.001 &&
          (currentPaired.outputDarkPixelShare || 0) <= (previousPaired.outputDarkPixelShare || 0) * 0.98;
        const improvesGlareWithoutBlackArtifacts =
          index > 1 &&
          currentPaired.sourceGlareDetailPixelShare >= 0.003 &&
          currentPaired.sourceGlareDetailRecall >= previousPaired.sourceGlareDetailRecall + 0.025 &&
          (currentOutput.nearBlackPixelShare || 0) <=
            (previousOutput.nearBlackPixelShare || 0) * 0.15 &&
          currentPaired.sourceHighContrastDarkRecall >= previousPaired.sourceHighContrastDarkRecall * 0.95 &&
          currentPaired.unsupportedOutputDarkShare <= previousPaired.unsupportedOutputDarkShare + 0.003;
        if (
          !improvesWrongRegionDarkFromDefault &&
          !improvesNoisyDefaultCleanup &&
          !improvesSourceDetailFromDefault &&
          !improvesControlledSourceRecallFromDefault &&
          !improvesBalancedDarkFromDefault &&
          !improvesHighContrastDetail &&
          !improvesSourceConstrainedFineEdges &&
          !improvesGlareRegionDetail &&
          !improvesCleanGlareDetail &&
          !improvesGlareWithoutBlackArtifacts &&
          current.score < previous.score + requiredDeltas[index - 1]
        ) {
          failures.push({
            scenarioId: current.result.scenarioId,
            fixture,
            preset: current.result.presetLabel,
            reason: `${family.label}: ${current.result.presetLabel} did not improve source-supported detail score over ${previous.result.presetLabel}; ${current.score.toFixed(4)} vs ${previous.score.toFixed(4)}`,
          });
        }
      }
      const amazing = scored.find((item) => qualityTierForPresetId(item.result.presetId) === "amazing");
      const high = scored.find((item) => qualityTierForPresetId(item.result.presetId) === "high");
      const lowerTierMaxUnsupported = Math.max(
        ...scored
          .filter((item) => qualityTierForPresetId(item.result.presetId) !== "amazing")
          .map((item) => item.result.render.pairedDetailMetrics.unsupportedOutputDarkShare),
      );
      const amazingUnsupported = amazing?.result.render.pairedDetailMetrics.unsupportedOutputDarkShare;
      const highPairedForUnsupportedGate = high?.result.render.pairedDetailMetrics;
      const amazingPairedForUnsupportedGate = amazing?.result.render.pairedDetailMetrics;
      const amazingHasBalancedDetailGain =
        highPairedForUnsupportedGate &&
        amazingPairedForUnsupportedGate &&
        amazingUnsupported <= 0.033 &&
        amazingPairedForUnsupportedGate.sourceHighContrastDarkRecall >=
          highPairedForUnsupportedGate.sourceHighContrastDarkRecall + 0.035 &&
        amazingPairedForUnsupportedGate.sourceGlareDetailRecall >=
          highPairedForUnsupportedGate.sourceGlareDetailRecall + 0.09;
      if (
        amazing &&
        amazingUnsupported > Math.max(0.02, lowerTierMaxUnsupported * 1.15) &&
        !amazingHasBalancedDetailGain
      ) {
        failures.push({
          scenarioId: amazing.result.scenarioId,
          fixture,
          preset: amazing.result.presetLabel,
          reason: `${family.label}: Amazing Quality increased unsupported dark detail too much; unsupported share ${amazingUnsupported}`,
        });
      }
      if (amazing && high) {
        const amazingPaired = amazing.result.render.pairedDetailMetrics;
        const highPaired = high.result.render.pairedDetailMetrics;
        const amazingOutput = amazing.result.render.outputMetrics || {};
        const highOutput = high.result.render.outputMetrics || {};
        const improvementSignals = [
          amazingPaired.sourceGlareDetailPixelShare >= 0.003 &&
            amazingPaired.sourceGlareDetailRecall >= highPaired.sourceGlareDetailRecall + 0.01,
          amazingPaired.sourceSupportedDarkRecall >= highPaired.sourceSupportedDarkRecall + 0.006,
          amazingPaired.sourceHighContrastDarkRecall >= highPaired.sourceHighContrastDarkRecall + 0.008,
          (amazingOutput.highContrastEdgeShare || 0) >=
            (highOutput.highContrastEdgeShare || 0) + 0.0015,
          (amazingOutput.nearBlackPixelShare || 0) <=
            (highOutput.nearBlackPixelShare || 0) * 0.15 &&
            amazingPaired.sourceGlareDetailRecall >= highPaired.sourceGlareDetailRecall + 0.025 &&
            amazingPaired.unsupportedOutputDarkShare <= highPaired.unsupportedOutputDarkShare + 0.003,
          amazingPaired.sourceGlareDetailRecall >= highPaired.sourceGlareDetailRecall + 0.018 &&
            amazingPaired.sourceHighContrastDarkRecall >= highPaired.sourceHighContrastDarkRecall * 0.91 &&
            amazingPaired.sourceSupportedDarkRecall >= highPaired.sourceSupportedDarkRecall * 0.91 &&
            amazingPaired.unsupportedOutputDarkShare <= highPaired.unsupportedOutputDarkShare + 0.001 &&
            (amazingPaired.outputDarkPixelShare || 0) <= (highPaired.outputDarkPixelShare || 0) * 0.98,
        ].filter(Boolean).length;
        if (
          improvementSignals < 2 ||
          amazingPaired.unsupportedOutputDarkShare >
            Math.max(0.04, highPaired.unsupportedOutputDarkShare + 0.006)
        ) {
          failures.push({
            scenarioId: amazing.result.scenarioId,
            fixture,
            preset: amazing.result.presetLabel,
            reason: `${family.label}: Amazing Quality did not materially improve source-backed text/glare/linework detail over High without increasing wrong-region dark detail`,
          });
        }
      }
    }
  }
  return failures;
}

function validateQualityTierFamilyCollapse(results) {
  const failures = [];
  const familySpecificIds = new Set(
    qualityTierComparisonFamilies
      .filter((family) => family.order.length > 1)
      .flatMap((family) => family.order),
  );
  const byFixtureAndTier = new Map();
  for (const result of results) {
    if (!result.completed || !familySpecificIds.has(result.presetId)) continue;
    const tier = qualityTierForPresetId(result.presetId);
    if (tier === "default") continue;
    const fixture = result.fixture?.basename || "unknown";
    const key = `${fixture}:${tier}`;
    if (!byFixtureAndTier.has(key)) byFixtureAndTier.set(key, []);
    byFixtureAndTier.get(key).push(result);
  }

  for (const [key, tierResults] of byFixtureAndTier.entries()) {
    const signatures = new Map();
    for (const result of tierResults) {
      const signature = [
        result.downloadHash || result.copyHash || "",
        result.svgBytes || 0,
        result.pathCount || 0,
        result.segmentCount || 0,
        result.layerTotalCount || 0,
      ].join(":");
      if (!signatures.has(signature)) signatures.set(signature, []);
      signatures.get(signature).push(result);
    }
    for (const duplicates of signatures.values()) {
      if (duplicates.length < 2) continue;
      const [fixture, tier] = key.split(":");
      failures.push({
        scenarioId: `tier-family-collapse-${fixture}-${tier}`,
        fixture,
        preset: duplicates.map((item) => item.presetLabel).join(", "),
        reason: `${tier} quality family presets produced identical SVG output signatures; labels must not silently collapse to one hidden implementation`,
      });
    }
  }
  return failures;
}

function qualityTierSourceDetailScore(result) {
  const paired = result.render?.pairedDetailMetrics;
  const output = result.render?.outputMetrics;
  if (!paired || !output) return 0;
  const darkOvershoot = Math.max(
    0,
    paired.outputDarkPixelShare - paired.sourceSupportedDarkPixelShare * 1.25,
  );
  const sourceBoundedEdgeShare = Math.min(
    output.highContrastEdgeShare || 0,
    (paired.sourceHighContrastDarkPixelShare || 0) * 0.06,
  );
  return (
    paired.sourceSupportedDarkRecall * 0.52 +
    paired.sourceHighContrastDarkRecall * 0.4 +
    (paired.sourceNearBlackRecall || 0) * 0.12 +
    (paired.sourceGlareDetailRecall || 0) * 0.16 +
    sourceBoundedEdgeShare * 10 +
    output.colorfulPixelShare * 0.02 -
    paired.unsupportedOutputDarkShare * 1.8 -
    darkOvershoot
  );
}

function validateRenderMetrics(result, label) {
  const failures = [];
  const source = result.render?.sourceMetrics;
  const output = result.render?.outputMetrics;
  if (!source || !output) return failures;
  const add = (reason) => failures.push({ scenarioId: result.scenarioId, fixture: result.fixture?.basename || null, preset: result.presetLabel || null, reason });
  const paired = result.render?.pairedDetailMetrics;
  if (
    !paired &&
    source.nearBlackPixelShare > 0.01 &&
    output.nearBlackPixelShare < source.nearBlackPixelShare * 0.45
  ) {
    add(`near-black text/linework metric dropped materially for ${label}: source ${source.nearBlackPixelShare}, output ${output.nearBlackPixelShare}`);
  }
  if (source.darkPixelShare > 0.02 && output.darkPixelShare < source.darkPixelShare * 0.5) {
    add(`dark detail metric dropped materially for ${label}: source ${source.darkPixelShare}, output ${output.darkPixelShare}`);
  }
  const tier = qualityTierForPresetId(result.presetId);
  const edgeRetentionRatio = tier === "default" ? 0.5 : 0.25;
  if (source.highContrastEdgeShare > 0.004 && output.highContrastEdgeShare < source.highContrastEdgeShare * edgeRetentionRatio - 0.0002) {
    add(`edge/detail metric dropped materially for ${label}: source ${source.highContrastEdgeShare}, output ${output.highContrastEdgeShare}`);
  }
  const sourceAlpha = result.render?.sourceAlphaMetrics;
  const outputAlpha = result.render?.outputAlphaMetrics;
  if (sourceAlpha && outputAlpha && outputAlpha.paintedCoverage < sourceAlpha.paintedCoverage * 0.88) {
    add(`painted coverage dropped materially for ${label}: source ${sourceAlpha.paintedCoverage}, output ${outputAlpha.paintedCoverage}`);
  }
  if (source.lightNeutralPixelShare > 0.04 && output.lightNeutralPixelShare < source.lightNeutralPixelShare * 0.35) {
    add(`light/neutral detail metric collapsed for ${label}: source ${source.lightNeutralPixelShare}, output ${output.lightNeutralPixelShare}`);
  }
  if (source.colorfulPixelShare > 0.06 && output.colorfulPixelShare < source.colorfulPixelShare * 0.35) {
    add(`color/detail metric collapsed for ${label}: source ${source.colorfulPixelShare}, output ${output.colorfulPixelShare}`);
  }
  if (paired) {
    const minSourceDarkRecall =
      tier === "amazing" ? 0.093 : tier === "high" ? 0.095 : tier === "medium" ? 0.09 : 0;
    const minHighContrastDarkRecall =
      tier === "amazing" ? 0.152 : tier === "high" ? 0.13 : tier === "medium" ? 0.11 : 0;
    if (tier !== "default" && paired.sourceSupportedDarkPixelShare > 0.005 && paired.sourceSupportedDarkRecall < minSourceDarkRecall) {
      add(`source-supported dark text/linework recall is too low for ${label}: ${paired.sourceSupportedDarkRecall}`);
    }
    const cleanAmazingGlareRecovery =
      tier === "amazing" &&
      paired.sourceGlareDetailRecall >= 0.39 &&
      paired.sourceHighContrastDarkRecall >= 0.151 &&
      paired.unsupportedOutputDarkShare <= 0.012 &&
      paired.outputDarkPixelShare <= paired.sourceSupportedDarkPixelShare * 1.18;
    if (
      tier !== "default" &&
      paired.sourceHighContrastDarkPixelShare > 0.003 &&
      paired.sourceHighContrastDarkRecall < minHighContrastDarkRecall &&
      !cleanAmazingGlareRecovery
    ) {
      add(`high-contrast dark linework recall is too low for ${label}: ${paired.sourceHighContrastDarkRecall}`);
    }
    const minNearBlackRecall =
      tier === "amazing" ? 0.045 : tier === "high" ? 0.045 : tier === "medium" ? 0.04 : 0;
    if (
      tier !== "default" &&
      paired.sourceNearBlackPixelShare > 0.003 &&
      paired.sourceNearBlackRecall < minNearBlackRecall
    ) {
      add(`source near-black text/linework recall is too low for ${label}: ${paired.sourceNearBlackRecall}`);
    }
    const minGlareDetailRecall = tier === "amazing" ? 0.16 : tier === "high" ? 0.11 : 0;
    if (
      minGlareDetailRecall > 0 &&
      paired.sourceGlareDetailPixelShare > 0.003 &&
      paired.sourceGlareDetailRecall < minGlareDetailRecall
    ) {
      add(`glare/bright-region text-detail recall is too low for ${label}: ${paired.sourceGlareDetailRecall}`);
    }
    const unsupportedDarkLimit = tier === "default" ? 0.065 : tier === "amazing" ? 0.04 : 0.035;
    if (paired.unsupportedOutputDarkShare > unsupportedDarkLimit) {
      add(`output adds too much dark detail where the source is not dark/high-contrast for ${label}: ${paired.unsupportedOutputDarkShare}`);
    }
    if (tier !== "default" && paired.unsupportedOutputDarkShare > paired.sourceSupportedDarkPixelShare * 1.6 + 0.012) {
      add(`wrong-region dark detail outweighs source-supported dark detail for ${label}: unsupported ${paired.unsupportedOutputDarkShare}, source-supported ${paired.sourceSupportedDarkPixelShare}`);
    }
    const overDarkLimit = paired.sourceSupportedDarkPixelShare * 1.45 + 0.03;
    if (tier !== "default" && paired.outputDarkPixelShare > overDarkLimit) {
      add(`output dark detail is no longer source-constrained for ${label}: output ${paired.outputDarkPixelShare}, source-supported ${paired.sourceSupportedDarkPixelShare}`);
    }
  }
  return failures;
}

async function runUiScenario({ fixturePath, preset, scenarioId, timeoutMs, collectStructure, renderPreview }) {
  const fixture = await fixtureInfo(fixturePath);
  const client = await openTab(`${baseUrl}/`);
  const downloadDir = path.join(downloadRoot, scenarioId);
  await fs.mkdir(downloadDir, { recursive: true });
  const startedAt = Date.now();
  let stage = "starting";

  try {
    stage = "enable page";
    await enablePage(client, downloadDir);
    stage = "wait for document ready";
    await waitForDocumentReady(client);
    stage = "verify clipboard access";
    await verifyClipboardAccess(client).catch(() => null);
    stage = "upload fixture";
    await uploadFixtureWithRetry(client, fixturePath);
    stage = "settle initial conversion";
    await settleInitialAutoConversion(client, 20_000).catch(() => null);
    stage = "read state before preset";
    const beforePresetState = await outputState(client).catch(() => ({ latestStamp: null }));
    stage = "select preset";
    const selectedPreset = await selectPreset(client, [preset.pattern], preset.label);
    stage = "read state after preset";
    const afterPresetState = await waitForValue(
      client,
      () => outputStateExpression(beforePresetState.latestStamp),
      4_000,
      (value) => value?.activeJobs > 0 || value?.latestChanged,
    ).catch(() => outputState(client).catch(() => beforePresetState));
    const beforeConvertState = afterPresetState || beforePresetState;
    let convertAction = { clicked: false, autoStarted: false, reason: "" };
    if (beforeConvertState?.activeJobs > 0) {
      convertAction = { clicked: false, autoStarted: true, reason: "preset selection started conversion before Convert could be clicked" };
    } else {
      const convertClick = await clickConvert(client).catch((error) => ({ error: error instanceof Error ? error.message : String(error) }));
      if (convertClick?.error) {
        const afterFailedClickState = await waitForValue(
          client,
          () => outputStateExpression(beforeConvertState.latestStamp ?? beforePresetState.latestStamp),
          8_000,
          (value) => value?.activeJobs > 0 || value?.latestChanged,
        ).catch(() => outputState(client).catch(() => beforeConvertState));
        if (afterFailedClickState?.activeJobs > 0 || afterFailedClickState?.latestChanged) {
          convertAction = { clicked: false, autoStarted: true, reason: `conversion started while looking for Convert: ${convertClick.error}` };
        } else {
          throw new Error(convertClick.error);
        }
      } else {
        convertAction = { clicked: true, autoStarted: false, reason: "clicked Convert" };
      }
    }

    let completed = null;
    let pendingState = null;
    stage = "wait for completed output";
    try {
      completed = await waitForCompletedOutput(client, beforeConvertState.latestStamp ?? beforePresetState.latestStamp, timeoutMs);
    } catch (error) {
      stage = "read pending state";
      pendingState = await outputState(client).catch(() => ({ error: error instanceof Error ? error.message : String(error) }));
    }
    const elapsedMs = Date.now() - startedAt;

    let ui = null;
    let download = null;
    let svg = null;
    let structure = null;
    let copyDownloadParity = null;
    let render = null;
    if (completed) {
      stage = "open settings";
      await openLatestSettingsPanel(client).catch(() => null);
      stage = "prime clipboard state";
      const beforeCapture = await primeClipboard(client, scenarioId);
      stage = "copy svg";
      const copyClick = await clickButtonInLatestOutput(client, [/Copy SVG/i, /^Copy$/i], [/Copied/i]).catch(() => null);
      stage = "wait for copy capture";
      const copyCapture = copyClick ? await waitForClipboardSvg(client, beforeCapture.latestClipboardHash).catch(() => null) : null;
      stage = "download svg";
      download = await downloadLatestSvg(client, downloadDir);
      stage = "analyze svg";
      svg = await analyzeSvgFile(download.path);
      copyDownloadParity = {
        attempted: Boolean(copyClick && download),
        copyClicked: Boolean(copyClick),
        copyClick,
        downloadClicked: Boolean(download),
        ok: Boolean(copyCapture && download && copyCapture.latestClipboardHash === download.hash && copyCapture.latestClipboardBytes === download.bytes),
        copyHash: copyCapture?.latestClipboardHash || null,
        copyBytes: copyCapture?.latestClipboardBytes || 0,
        rawCopyHash: copyCapture?.rawClipboardHash || null,
        rawCopyBytes: copyCapture?.rawClipboardBytes || 0,
        downloadHash: download.hash,
        downloadBytes: download.bytes,
      };
      if (collectStructure) {
        stage = "analyze structure";
        structure = await analyzeStructure(download.path);
      }
      if (renderPreview) {
        stage = "render comparison";
        render = await renderComparison(fixturePath, download.path, scenarioId).catch((error) => ({ error: error.message }));
      }
      stage = "open layer colors";
      await ensureSettingsSectionOpen(client, /Layer colors/i, "layer-colors").catch(() => null);
      stage = "collect ui";
      ui = await collectUi(client);
      ui = { ...ui, settingsOpened: true };
    }

    stage = "collect logs";
    const logs = await client.collectLogs();
    return {
      scenarioId,
      route: "/",
      presetId: preset.id,
      presetLabel: preset.label,
      selectedPreset,
      convertAction,
      fixture,
      completed: Boolean(completed),
      elapsedMs,
      completedState: completed,
      pendingState,
      ui,
      download,
      svg,
      structure,
      render,
      copyDownloadParity,
      consoleErrors: logs.consoleErrors,
      networkErrors: logs.networkErrors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${stage}: ${message}`, { cause: error });
  } finally {
    await client.close().catch(() => {});
  }
}

async function fixtureInfo(filePath) {
  const stat = await fs.stat(filePath);
  const meta = await sharp(filePath).metadata();
  const oriented = orientedDimensions(meta);
  return {
    path: filePath,
    basename: path.basename(filePath),
    bytes: stat.size,
    width: meta.width || null,
    height: meta.height || null,
    displayWidth: oriented.width,
    displayHeight: oriented.height,
    orientation: meta.orientation || null,
    format: meta.format || null,
  };
}

function orientedDimensions(meta) {
  const width = meta.width || null;
  const height = meta.height || null;
  if (!width || !height) return { width, height };
  return [5, 6, 7, 8].includes(Number(meta.orientation))
    ? { width: height, height: width }
    : { width, height };
}

async function renderComparison(sourcePath, svgPath, scenarioId) {
  const sourceOut = path.join(renderRoot, `${scenarioId}-source.png`);
  const svgOut = path.join(renderRoot, `${scenarioId}-svg.png`);
  const sheetOut = path.join(renderRoot, `${scenarioId}-comparison.png`);
  const sourceAlphaOut = path.join(renderRoot, `${scenarioId}-source-alpha.png`);
  const svgAlphaOut = path.join(renderRoot, `${scenarioId}-svg-alpha.png`);
  await sharp(sourcePath).resize({ width: 520, height: 520, fit: "inside", background: "#fff" }).png().toFile(sourceOut);
  await sharp(svgPath, { density: 72 }).resize({ width: 520, height: 520, fit: "inside", background: "#fff" }).png().toFile(svgOut);
  await sharp(sourcePath).ensureAlpha().resize({ width: 520, height: 520, fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(sourceAlphaOut);
  await sharp(svgPath, { density: 72 }).resize({ width: 520, height: 520, fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(svgAlphaOut);
  const source = await sharp(sourceOut).resize(520, 520, { fit: "contain", background: "#ffffff" }).removeAlpha().raw().toBuffer();
  const output = await sharp(svgOut).resize(520, 520, { fit: "contain", background: "#ffffff" }).removeAlpha().raw().toBuffer();
  const sourceAlpha = await sharp(sourceAlphaOut).resize(520, 520, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer();
  const outputAlpha = await sharp(svgAlphaOut).resize(520, 520, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer();
  const sourceMetrics = imageDarkMetrics(source);
  const outputMetrics = imageDarkMetrics(output);
  const pairedDetailMetrics = pairedSourceOutputDetailMetrics(source, output, 520, 520);
  const sourceAlphaMetrics = imageAlphaMetrics(sourceAlpha);
  const outputAlphaMetrics = imageAlphaMetrics(outputAlpha);
  await sharp({
    create: { width: 1080, height: 580, channels: 4, background: "#ffffff" },
  })
    .composite([
      { input: sourceOut, left: 20, top: 40 },
      { input: svgOut, left: 560, top: 40 },
    ])
    .png()
    .toFile(sheetOut);
  return {
    sourceOut,
    svgOut,
    sheetOut,
    sourceMetrics,
    outputMetrics,
    pairedDetailMetrics,
    sourceAlphaMetrics,
    outputAlphaMetrics,
  };
}

function imageDarkMetrics(raw) {
  let dark = 0;
  let nearBlack = 0;
  let contrastEdges = 0;
  let lightNeutral = 0;
  let colorful = 0;
  let saturationSum = 0;
  const pixels = raw.length / 3;
  for (let i = 0; i < raw.length; i += 3) {
    const luma = 0.2126 * raw[i] + 0.7152 * raw[i + 1] + 0.0722 * raw[i + 2];
    if (luma < 80) dark += 1;
    if (luma < 35) nearBlack += 1;
    const saturation = Math.max(raw[i], raw[i + 1], raw[i + 2]) - Math.min(raw[i], raw[i + 1], raw[i + 2]);
    if (luma >= 150 && luma <= 245 && saturation <= 48) lightNeutral += 1;
    if (saturation >= 55) colorful += 1;
    saturationSum += saturation;
    if (i >= 3) {
      const prev = 0.2126 * raw[i - 3] + 0.7152 * raw[i - 2] + 0.0722 * raw[i - 1];
      if (Math.abs(luma - prev) > 90) contrastEdges += 1;
    }
  }
  return {
    darkPixelShare: round(dark / pixels, 4),
    nearBlackPixelShare: round(nearBlack / pixels, 4),
    highContrastEdgeShare: round(contrastEdges / pixels, 4),
    lightNeutralPixelShare: round(lightNeutral / pixels, 4),
    colorfulPixelShare: round(colorful / pixels, 4),
    meanSaturation: round(saturationSum / pixels, 2),
  };
}

function imageAlphaMetrics(raw) {
  let painted = 0;
  const pixels = raw.length / 4;
  for (let i = 0; i < raw.length; i += 4) {
    if (raw[i + 3] >= 16) painted += 1;
  }
  const paintedCoverage = round(painted / pixels, 4);
  return {
    paintedCoverage,
    transparentMissingRatio: round(1 - paintedCoverage, 4),
  };
}

function pairedSourceOutputDetailMetrics(source, output, width, height) {
  let sourceSupportedDark = 0;
  let sourceSupportedDarkHit = 0;
  let sourceHighContrastDark = 0;
  let sourceHighContrastDarkHit = 0;
  let sourceGlareDetail = 0;
  let sourceGlareDetailHit = 0;
  let sourceNearBlack = 0;
  let sourceNearBlackHit = 0;
  let unsupportedOutputDark = 0;
  let outputDark = 0;
  const pixels = width * height;
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const offset = pixel * 3;
    const sourceColor = {
      r: source[offset],
      g: source[offset + 1],
      b: source[offset + 2],
    };
    const outputColor = {
      r: output[offset],
      g: output[offset + 1],
      b: output[offset + 2],
    };
    const sourceLuma = rgbLuma255(sourceColor);
    const outputLuma = rgbLuma255(outputColor);
    const sourceContrast = localLumaContrast(source, width, height, pixel);
    const outputContrast = localLumaContrast(output, width, height, pixel);
    const sourceSaturation = Math.max(sourceColor.r, sourceColor.g, sourceColor.b) - Math.min(sourceColor.r, sourceColor.g, sourceColor.b);
    const isOutputDark = outputLuma < 82;
    const isSourceSupportedDark =
      sourceLuma < 86 &&
      (sourceLuma < 44 || sourceContrast >= 34 || sourceSaturation <= 34);
    const isSourceHighContrastDark =
      sourceLuma < 104 &&
      sourceContrast >= 54;
    const isSourceNearBlack =
      sourceLuma < 44 &&
      (sourceContrast >= 24 || sourceSaturation <= 38);
    const isSourceGlareDetail =
      sourceLuma >= 86 &&
      sourceLuma < 178 &&
      sourceContrast >= 44 &&
      sourceSaturation <= 72;
    const isGlareDetailHit =
      isOutputDark ||
      outputContrast >= 48 ||
      sourceLuma - outputLuma >= 18;
    const isUnsupportedDark =
      outputLuma < 72 &&
      sourceLuma > 112 &&
      sourceContrast < 42 &&
      sourceSaturation > 26;

    if (isOutputDark) outputDark += 1;
    if (isSourceSupportedDark) {
      sourceSupportedDark += 1;
      if (isOutputDark) sourceSupportedDarkHit += 1;
    }
    if (isSourceHighContrastDark) {
      sourceHighContrastDark += 1;
      if (isOutputDark) sourceHighContrastDarkHit += 1;
    }
    if (isSourceNearBlack) {
      sourceNearBlack += 1;
      if (isOutputDark) sourceNearBlackHit += 1;
    }
    if (isSourceGlareDetail) {
      sourceGlareDetail += 1;
      if (isGlareDetailHit) sourceGlareDetailHit += 1;
    }
    if (isUnsupportedDark) unsupportedOutputDark += 1;
  }
  return {
    sourceSupportedDarkPixelShare: round(sourceSupportedDark / pixels, 4),
    sourceSupportedDarkRecall: round(sourceSupportedDarkHit / Math.max(1, sourceSupportedDark), 4),
    sourceHighContrastDarkPixelShare: round(sourceHighContrastDark / pixels, 4),
    sourceHighContrastDarkRecall: round(sourceHighContrastDarkHit / Math.max(1, sourceHighContrastDark), 4),
    sourceNearBlackPixelShare: round(sourceNearBlack / pixels, 4),
    sourceNearBlackRecall: round(sourceNearBlackHit / Math.max(1, sourceNearBlack), 4),
    sourceGlareDetailPixelShare: round(sourceGlareDetail / pixels, 4),
    sourceGlareDetailRecall: round(sourceGlareDetailHit / Math.max(1, sourceGlareDetail), 4),
    outputDarkPixelShare: round(outputDark / pixels, 4),
    unsupportedOutputDarkShare: round(unsupportedOutputDark / pixels, 4),
  };
}

function localLumaContrast(raw, width, height, pixel) {
  const x = pixel % width;
  const y = Math.floor(pixel / width);
  const center = rgbLumaAt(raw, pixel);
  let maxDelta = 0;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, -2], [0, 2]]) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    maxDelta = Math.max(maxDelta, Math.abs(center - rgbLumaAt(raw, ny * width + nx)));
  }
  return maxDelta;
}

function rgbLumaAt(raw, pixel) {
  const offset = pixel * 3;
  return rgbLuma255({
    r: raw[offset],
    g: raw[offset + 1],
    b: raw[offset + 2],
  });
}

function rgbLuma255(color) {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

async function analyzeSvgFile(svgPath) {
  const svg = await fs.readFile(svgPath, "utf8");
  const colors = visibleColors(svg);
  const dimensions = svgDimensions(svg);
  return {
    bytes: Buffer.byteLength(svg),
    ...dimensions,
    pathCount: countMatches(svg, /<path\b/gi),
    groupCount: countMatches(svg, /<g\b/gi),
    visibleColorCount: colors.length,
    visibleColors: colors,
    dataLayerColorCount: unique([...svg.matchAll(/\bdata-layer-color\s*=\s*["'](#[0-9a-fA-F]{3,8})["']/g)].map((m) => normalizeHex(m[1]))).length,
  };
}

async function analyzeStructure(svgPath) {
  const svg = await fs.readFile(svgPath, "utf8");
  const pathData = [...svg.matchAll(/<path\b[^>]*\bd\s*=\s*["']([^"']*)["'][^>]*>/gi)].map((m) => m[1]);
  const pathStructures = pathData.map(analyzePathStructure);
  const duplicatePathStrings = pathData.length - new Set(pathData).size;
  const attrMatches = [...svg.matchAll(/\s([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*["']([^"']{500,})["']/g)];
  const largeAttrs = attrMatches.reduce((map, match) => {
    const key = match[1];
    map[key] = (map[key] || 0) + 1;
    return map;
  }, {});
  const decimalMatches = [...svg.matchAll(/-?\d+\.\d+/g)].map((m) => m[0]);
  const decimalPlaces = decimalMatches.map((value) => value.split(".")[1]?.length || 0);
  const maxDecimalPlaces = decimalPlaces.reduce((max, value) => Math.max(max, value), 0);
  return {
    totalBytes: Buffer.byteLength(svg),
    pathCount: pathData.length,
    averagePathDataLength: pathData.length ? Math.round(pathData.reduce((sum, value) => sum + value.length, 0) / pathData.length) : 0,
    largestPathDataLength: pathData.length ? Math.max(...pathData.map((value) => value.length)) : 0,
    totalPathCommandCount: pathStructures.reduce((sum, value) => sum + value.commandCount, 0),
    totalPathSegmentCount: pathStructures.reduce((sum, value) => sum + value.segmentCount, 0),
    totalPathPointCount: pathStructures.reduce((sum, value) => sum + value.pointCount, 0),
    totalSubpathCount: pathStructures.reduce((sum, value) => sum + value.subpathCount, 0),
    averageSegmentsPerPath: pathStructures.length
      ? Math.round(pathStructures.reduce((sum, value) => sum + value.segmentCount, 0) / pathStructures.length)
      : 0,
    largestPathSegmentCount: pathStructures.length
      ? Math.max(...pathStructures.map((value) => value.segmentCount))
      : 0,
    pathCommandHistogram: mergeHistograms(pathStructures.map((value) => value.commandHistogram)),
    duplicatePathStrings,
    duplicatePathRatio: pathData.length ? round(duplicatePathStrings / pathData.length, 4) : 0,
    groupCount: countMatches(svg, /<g\b/gi),
    defsCount: countMatches(svg, /<defs\b/gi),
    clipPathCount: countMatches(svg, /<clipPath\b/gi),
    maskCount: countMatches(svg, /<mask\b/gi),
    filterCount: countMatches(svg, /<filter\b/gi),
    styleBlockCount: countMatches(svg, /<style\b/gi),
    dataFillLayerIdCount: countMatches(svg, /\bdata-fill-layer-id\s*=/gi),
    dataStrokeLayerIdCount: countMatches(svg, /\bdata-stroke-layer-id\s*=/gi),
    dataLayerIdCount: countMatches(svg, /\bdata-layer-id\s*=/gi),
    dataLayerLabelCount: countMatches(svg, /\bdata-layer-label\s*=/gi),
    dataLayerColorCount: countMatches(svg, /\bdata-layer-color\s*=/gi),
    repeatedLargeAttributes: largeAttrs,
    decimalNumberCount: decimalMatches.length,
    averageDecimalPlaces: decimalPlaces.length ? round(decimalPlaces.reduce((sum, value) => sum + value, 0) / decimalPlaces.length, 2) : 0,
    maxDecimalPlaces,
    visibleColorCount: visibleColors(svg).length,
  };
}

function analyzePathStructure(pathData) {
  const tokens = [...String(pathData || "").matchAll(/[AaCcHhLlMmQqSsTtVvZz]|-?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)].map((m) => m[0]);
  let index = 0;
  let command = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let commandCount = 0;
  let segmentCount = 0;
  let pointCount = 0;
  let subpathCount = 0;
  const commandHistogram = {};
  const isCommand = (token) => /^[AaCcHhLlMmQqSsTtVvZz]$/.test(token);
  const readNumber = () => Number(tokens[index++]);
  const addCommand = (value) => {
    const key = value.toUpperCase();
    commandCount += 1;
    commandHistogram[key] = (commandHistogram[key] || 0) + 1;
  };
  const segmentTo = (nextX, nextY) => {
    segmentCount += 1;
    pointCount += 1;
    x = nextX;
    y = nextY;
  };

  while (index < tokens.length) {
    if (isCommand(tokens[index])) {
      command = tokens[index++];
      addCommand(command);
    }
    if (!command) break;
    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    if (upper === "Z") {
      segmentTo(startX, startY);
      command = "";
      continue;
    }
    if (upper === "M") {
      if (index + 1 > tokens.length) break;
      let nextX = readNumber();
      let nextY = readNumber();
      if (relative) {
        nextX += x;
        nextY += y;
      }
      x = nextX;
      y = nextY;
      startX = x;
      startY = y;
      pointCount += 1;
      subpathCount += 1;
      command = relative ? "l" : "L";
      continue;
    }
    if (upper === "L") {
      if (index + 1 > tokens.length) break;
      let nextX = readNumber();
      let nextY = readNumber();
      if (relative) {
        nextX += x;
        nextY += y;
      }
      segmentTo(nextX, nextY);
      continue;
    }
    if (upper === "H") {
      if (index >= tokens.length) break;
      let nextX = readNumber();
      if (relative) nextX += x;
      segmentTo(nextX, y);
      continue;
    }
    if (upper === "V") {
      if (index >= tokens.length) break;
      let nextY = readNumber();
      if (relative) nextY += y;
      segmentTo(x, nextY);
      continue;
    }
    if (upper === "C") {
      if (index + 5 >= tokens.length) break;
      const values = [readNumber(), readNumber(), readNumber(), readNumber(), readNumber(), readNumber()];
      const nextX = relative ? x + values[4] : values[4];
      const nextY = relative ? y + values[5] : values[5];
      segmentTo(nextX, nextY);
      continue;
    }
    if (upper === "Q" || upper === "S") {
      if (index + 3 >= tokens.length) break;
      const values = [readNumber(), readNumber(), readNumber(), readNumber()];
      const nextX = relative ? x + values[2] : values[2];
      const nextY = relative ? y + values[3] : values[3];
      segmentTo(nextX, nextY);
      continue;
    }
    if (upper === "T") {
      if (index + 1 >= tokens.length) break;
      let nextX = readNumber();
      let nextY = readNumber();
      if (relative) {
        nextX += x;
        nextY += y;
      }
      segmentTo(nextX, nextY);
      continue;
    }
    if (upper === "A") {
      if (index + 6 >= tokens.length) break;
      index += 5;
      let nextX = readNumber();
      let nextY = readNumber();
      if (relative) {
        nextX += x;
        nextY += y;
      }
      segmentTo(nextX, nextY);
      continue;
    }
    break;
  }

  return { commandCount, segmentCount, pointCount, subpathCount, commandHistogram };
}

function mergeHistograms(items) {
  return items.reduce((merged, item) => {
    for (const [key, value] of Object.entries(item || {})) {
      merged[key] = (merged[key] || 0) + value;
    }
    return merged;
  }, {});
}

function svgDimensions(svg) {
  const open = String(svg || "").match(/<svg\b([^>]*)>/i)?.[1] || "";
  const width = parseSvgLength(open.match(/\bwidth\s*=\s*(["'])([^"']+)\1/i)?.[2]);
  const height = parseSvgLength(open.match(/\bheight\s*=\s*(["'])([^"']+)\1/i)?.[2]);
  const viewBoxValues =
    open
      .match(/\bviewBox\s*=\s*(["'])([^"']+)\1/i)?.[2]
      ?.trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter(Number.isFinite) || [];
  return {
    width,
    height,
    viewBoxWidth: viewBoxValues.length >= 4 ? viewBoxValues[2] : null,
    viewBoxHeight: viewBoxValues.length >= 4 ? viewBoxValues[3] : null,
  };
}

function parseSvgLength(value) {
  const match = String(value || "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function visibleColors(svg) {
  const colors = [];
  for (const match of svg.matchAll(/\b(?:fill|stroke)\s*=\s*["']([^"']+)["']/gi)) {
    const color = normalizePaint(match[1]);
    if (color) colors.push(color);
  }
  for (const match of svg.matchAll(/\bstyle\s*=\s*["']([^"']+)["']/gi)) {
    const style = match[1];
    for (const prop of ["fill", "stroke"]) {
      const value = style.match(new RegExp(`${prop}\\s*:\\s*([^;]+)`, "i"))?.[1];
      const color = normalizePaint(value || "");
      if (color) colors.push(color);
    }
  }
  return unique(colors);
}

function normalizePaint(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text || text === "none" || text === "transparent" || /^url\(/i.test(text)) return "";
  return normalizeHex(text) || text;
}

function normalizeHex(value) {
  const text = String(value || "").trim().toLowerCase();
  const match = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (!match) return "";
  const hex = match[1];
  if (hex.length === 3) return "#" + hex.split("").map((c) => c + c).join("");
  return "#" + hex.slice(0, 6);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

async function serverState() {
  const response = await fetch(baseUrl);
  const text = await response.text();
  return {
    status: response.status,
    title: text.match(/<title>(.*?)<\/title>/i)?.[1] || "",
    looksLikeIlovesvg: /iLoveSVG|Free SVG Converter/i.test(text),
    exposesCommit: /9c44950|9c44950388f971fac8fdbd1b4d05670474844ae7/.test(text),
  };
}

async function gitHead() {
  const { execFile } = await import("node:child_process");
  return new Promise((resolve) => {
    execFile("git", ["rev-parse", "HEAD"], { cwd: rootDir }, (error, stdout) => resolve(error ? null : stdout.trim()));
  });
}

async function setFileInput(client, filePath) {
  await waitForValue(client, () => `(() => Boolean(document.querySelector('input[type="file"]')))()`, 12_000, Boolean);
  const basename = path.basename(filePath);
  const acceptedExpression = () => `(() => {
    const body = document.body?.innerText || "";
    const inputHasFile = Array.from(document.querySelectorAll('input[type="file"]')).some((input) =>
      Array.from(input.files || []).some((file) => file.name === ${JSON.stringify(basename)}),
    );
    const activeJobs = Array.from(document.querySelectorAll("[data-output-stamp]")).filter((card) =>
      /queued|running/i.test(card.getAttribute("data-job-status") || "") ||
      /\\b(Queued|Running|Converting|Creating|Building)\\b/i.test(card.textContent || ""),
    ).length;
    const enabledConvert = Array.from(document.querySelectorAll("button")).some((button) => !button.disabled && /^\\s*(Convert|Create)\\b/i.test(button.innerText || button.textContent || ""));
    return { bodyHasName: body.includes(${JSON.stringify(basename)}), inputHasFile, activeJobs, enabledConvert };
  })()`;
  try {
    const { root } = await client.send("DOM.getDocument", { depth: -1, pierce: true }, 8_000);
    const { nodeIds = [] } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: 'input[type="file"]' }, 8_000);
    if (!nodeIds.length) throw new Error("No file input found.");
    for (const nodeId of nodeIds) {
      await client.send("DOM.setFileInputFiles", { nodeId, files: [filePath] }, 20_000);
    }
    await evaluate(client, `(() => {
      const input = document.querySelector('label input[type="file"], input[type="file"]');
      if (!input) return false;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`, 8_000);
    return await waitForValue(
      client,
      acceptedExpression,
      12_000,
      (value) => value?.bodyHasName || value?.enabledConvert || value?.activeJobs > 0,
    );
  } catch {}

  const file = {
    name: basename,
    type: mimeTypeForPath(filePath),
    base64: (await fs.readFile(filePath)).toString("base64"),
  };
  const applied = await evaluate(client, `(() => {
    const inputs = Array.from(document.querySelectorAll('label input[type="file"], input[type="file"]'));
    if (!inputs.length) return { ok: false, reason: "missing input" };
    const binary = atob(${JSON.stringify(file.base64)});
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    for (const input of inputs) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File([bytes], ${JSON.stringify(file.name)}, { type: ${JSON.stringify(file.type)} }));
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return { ok: true };
  })()`, 30_000);
  if (!applied?.ok) throw new Error(`Could not set file through browser DataTransfer: ${applied?.reason || "unknown"}`);
  return waitForValue(
    client,
    acceptedExpression,
    30_000,
    (value) => value?.bodyHasName || value?.enabledConvert || value?.activeJobs > 0,
  );
}

async function uploadFixtureWithRetry(client, filePath) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await delay(attempt === 1 ? 350 : 900);
      return await setFileInput(client, filePath);
    } catch (error) {
      lastError = error;
      if (attempt >= 3) break;
      await client.send("Page.reload", { ignoreCache: true }).catch(() => null);
      await waitForDocumentReady(client).catch(() => null);
    }
  }
  throw lastError || new Error("Unable to upload fixture.");
}

function mimeTypeForPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

async function selectPreset(client, patterns, searchText = "") {
  await clickButtonIfPresent(client, [/All presets/i, /Show all presets/i, /More presets/i, /Show\s+\d+\s+more presets/i], []).catch(() => null);
  await waitForValue(
    client,
    () => `(() => Boolean(document.querySelector('input[type="search"][placeholder*="presets"]')) || /All presets/i.test(document.body?.innerText || ""))()`,
    2_500,
    Boolean,
  ).catch(() => delay(500));
  for (const pattern of patterns) {
    const clicked = await clickButtonIfPresent(client, [pattern], [/Show fewer/i, /Filter presets/i, /Pin preset/i]).catch(() => null);
    if (clicked) {
      await delay(350);
      return { selected: clicked.label, pattern: String(pattern) };
    }
  }
  if (searchText) {
    const searched = await setPresetSearch(client, searchText).catch(() => null);
    if (searched?.ok) {
      await delay(300);
      for (const pattern of patterns) {
        const clicked = await clickButtonIfPresent(client, [pattern], [/Show fewer/i, /Filter presets/i, /Pin preset/i]).catch(() => null);
        if (clicked) {
          await delay(350);
          return { selected: clicked.label, pattern: String(pattern), searched: true };
        }
      }
    }
  }
  return { selected: null, reason: "No matching preset button was visible." };
}

async function setPresetSearch(client, searchText) {
  return evaluate(client, `(() => {
    const inputs = Array.from(document.querySelectorAll('input[type="search"]'));
    const input = inputs.find((candidate) =>
      /Search (pinned )?presets/i.test(candidate.getAttribute("placeholder") || ""),
    );
    if (!input) return { ok: false, reason: "preset search input not found" };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    input.scrollIntoView({ block: "center", inline: "nearest" });
    input.focus();
    if (setter) setter.call(input, ${JSON.stringify(searchText)});
    else input.value = ${JSON.stringify(searchText)};
    input.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: ${JSON.stringify(searchText)},
    }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  })()`, 8_000);
}

async function clickConvert(client) {
  const clicked = await clickButtonIfPresent(client, [/^Convert\b/i, /^Create\b/i], [/Update/i]);
  if (!clicked) throw new Error("Could not find enabled Convert button.");
  return clicked;
}

async function settleInitialAutoConversion(client, timeoutMs) {
  const state = await waitForValue(
    client,
    () => outputStateExpression(null),
    6_000,
    (value) => value?.activeJobs > 0 || value?.latestReady,
  ).catch(() => outputState(client).catch(() => null));
  if (!state?.activeJobs) return { settled: true, reason: "idle" };
  return waitForCompletedOutput(client, state.latestStamp, timeoutMs);
}

async function waitForCompletedOutput(client, previousLatestStamp, timeoutMs) {
  return waitForValue(
    client,
    () => outputStateExpression(previousLatestStamp),
    timeoutMs,
    (state) =>
      state?.latestReady &&
      !state?.activeJobs &&
      (state?.latestChanged || Number(state?.latestSvgBytes || 0) > 0),
  );
}

async function outputState(client) {
  return evaluate(client, outputStateExpression(null), 10_000);
}

function outputStateExpression(previousLatestStamp) {
  return `(() => {
    const cards = Array.from(document.querySelectorAll("[data-output-stamp]"));
    const latest = latestCard(cards);
    const latestStamp = latest ? numberOrNull(latest.getAttribute("data-output-stamp")) : null;
    const activeJobs = cards.filter(isActiveCard).length;
    const latestReady = Boolean(latest) &&
      !isActiveCard(latest) &&
      Boolean(latest.querySelector("[data-output-primary-action], [data-output-action-row='true'] button")) &&
      numberOrNull(latest.getAttribute("data-svg-bytes")) !== null;
    const fileSize = latest ? latest.querySelector("[data-output-file-size='true']")?.textContent || "" : "";
    const source = latest ? latest.querySelector("[data-output-source-file]")?.getAttribute("data-output-source-file") || "" : "";
    return {
      outputCards: cards.length,
      activeJobs,
      latestStamp,
      latestReady,
      latestChanged: ${previousLatestStamp == null ? "true" : `latestStamp !== ${JSON.stringify(previousLatestStamp)}`},
      latestJobStatus: latest ? latest.getAttribute("data-job-status") || null : null,
      latestText: latest ? [latest.getAttribute("data-engine-used") || "", fileSize, source].filter(Boolean).join(" ") : "",
      latestBodyText: latest ? (latest.innerText || latest.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 1200) : "",
      latestSvgBytes: latest ? numberOrNull(latest.getAttribute("data-svg-bytes")) : null,
    };
    function isActiveCard(card) {
      if (/queued|running/i.test(card.getAttribute("data-job-status") || "")) return true;
      if (numberOrNull(card.getAttribute("data-svg-bytes")) !== null) return false;
      return /\\b(Queued|Running|Converting|Creating|Building)\\b/i.test(card.textContent || "");
    }
    ${browserLatestCardHelpers()}
  })()`;
}

async function openLatestSettingsPanel(client) {
  await clickButtonInLatestOutput(client, [/Settings\s*\/\s*Edit/i, /\bSettings\b/i], [/Download/i, /Copy/i]);
  return waitForValue(client, () => `(() => {
    const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
    if (!latest) return { open: false };
    const text = latest.innerText || "";
    const controls = latest.querySelectorAll('input[aria-label$=" hex color"], [data-post-processing-controls="true"], [data-settings-section]');
    return { open: controls.length > 0 || /Advanced settings|Layer colors|Output polish/i.test(text), controls: controls.length };
    ${browserLatestCardHelpers()}
  })()`, 12_000, (value) => value?.open);
}

async function ensureSettingsSectionOpen(client, titlePattern, expectedKind) {
  const source = titlePattern.source;
  const result = await evaluate(client, `(() => {
    const pattern = new RegExp(${JSON.stringify(source)}, "i");
    const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
    if (!latest) return { ok: false, reason: "missing latest output card" };
    const buttons = Array.from(latest.querySelectorAll("button, summary"));
    const button = buttons.find((candidate) => {
      const text = (candidate.innerText || candidate.textContent || candidate.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
      return pattern.test(text) && isVisible(candidate);
    });
    if (!button) return { ok: false, reason: "section button not found", expected: ${JSON.stringify(expectedKind)} };
    const expanded = button.getAttribute("aria-expanded");
    if (expanded !== "true") {
      button.scrollIntoView({ block: "center", inline: "nearest" });
      button.click();
    }
    return { ok: true, expandedBefore: expanded };
    ${browserVisibleHelpers()}
    ${browserLatestCardHelpers()}
  })()`, 8_000);
  await delay(350);
  return result;
}

async function collectUi(client) {
  return evaluate(client, `(() => {
    const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
    if (!latest) return null;
    const layerSection = latest.querySelector("[data-layer-color-total-count]");
    const layerText = layerSection ? (layerSection.textContent || "").replace(/\\s+/g, " ").trim() : "";
    const cardTitle = Array.from(latest.querySelectorAll("p, span"))
      .map((element) => (element.textContent || "").replace(/\\s+/g, " ").trim())
      .find((value) => /^(?:Editing\\s+)?Output\\s+\\d+\\s+·/i.test(value)) || "";
    const fileSizeText = latest.querySelector("[data-output-file-size='true']")?.textContent || "";
    const sourceFile = latest.querySelector("[data-output-source-file]")?.getAttribute("data-output-source-file") || "";
    const layerCountText = layerText.match(/Showing\\s+\\d+\\s+of\\s+\\d+\\s+layer colors/i)?.[0] ||
      layerText.match(/Layer colors[^.]{0,180}/i)?.[0] ||
      null;
    const outputTitle = (cardTitle || "").replace(/\\s+/g, " ").trim();
    const engineUsed = latest.getAttribute("data-engine-used") || null;
    const engineLine = engineUsed ? "Engine: " + engineUsed : null;
    return {
      outputTitle,
      engineLine,
      engineUsed,
      engineWarnings: latest.getAttribute("data-engine-warnings") || null,
      layerBuildMode: latest.getAttribute("data-layer-build-mode") || null,
      outputDetectedColors: numberOrNull(latest.getAttribute("data-output-detected-colors")),
      svgBytesAttr: numberOrNull(latest.getAttribute("data-svg-bytes")),
      fileSizeText,
      sourceFile,
      layerCountText,
      layerTotalCount: numberOrNull(layerSection?.getAttribute("data-layer-color-total-count")),
      layerMountedCount: numberOrNull(layerSection?.getAttribute("data-layer-color-mounted-count")),
      layerHeavyCount: numberOrNull(layerSection?.getAttribute("data-layer-color-heavy-count")),
      layerAllColors: String(layerSection?.getAttribute("data-layer-color-all-colors") || "").trim(),
      visibleLayerRows: Array.from(latest.querySelectorAll('[data-layer-color-row="true"]')).filter(isVisible).length,
      previewVisible: Boolean(latest.querySelector('img[alt="SVG result"], img[alt*="result"], svg')),
      text: [outputTitle, engineLine, fileSizeText, sourceFile, layerText].filter(Boolean).join(" ").slice(0, 1400),
    };
    ${browserVisibleHelpers()}
    ${browserLatestCardHelpers()}
  })()`, 12_000);
}

async function verifyClipboardAccess(client) {
  await client.send("Page.bringToFront").catch(() => {});
  await client.send("Browser.grantPermissions", {
    origin: baseUrl,
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  }).catch(() => {});
  await evaluate(client, `(() => { window.focus(); document.body?.focus?.(); return true; })()`, 8_000).catch(() => {});
  return true;
}

async function primeClipboard(client, scenarioId) {
  await verifyClipboardAccess(client);
  const marker = `__high_fidelity_browser_output_smoke_${scenarioId}_${Date.now()}__`;
  await evaluate(client, `navigator.clipboard.writeText(${JSON.stringify(marker)}).then(() => true)`, 8_000);
  return clipboardCapture(client);
}

async function clipboardCapture(client) {
  return evaluate(client, clipboardCaptureExpression(), 12_000);
}

async function waitForClipboardSvg(client, previousHash) {
  return waitForValue(
    client,
    clipboardCaptureExpression,
    30_000,
    (value) =>
      value?.hasSvg &&
      value?.latestClipboardBytes > 0 &&
      value?.latestClipboardHash !== previousHash,
  );
}

function clipboardCaptureExpression() {
  return `(() => {
    return navigator.clipboard.readText()
      .then((latest) => {
        const normalized = normalizeNewlines(latest || "");
        return {
          hasSvg: /<svg[\\s>]/i.test(normalized),
          latestClipboardHash: normalized ? hashString(normalized) : null,
          latestClipboardBytes: normalized ? new Blob([normalized]).size : 0,
          rawClipboardHash: latest ? hashString(latest) : null,
          rawClipboardBytes: latest ? new Blob([latest]).size : 0,
        };
      })
      .catch((error) => ({
        hasSvg: false,
        latestClipboardHash: null,
        latestClipboardBytes: 0,
        rawClipboardHash: null,
        rawClipboardBytes: 0,
        error: error instanceof Error ? error.message : String(error),
      }));
    function normalizeNewlines(value) {
      return String(value || "").replace(/\\r\\n/g, "\\n").replace(/\\r/g, "\\n");
    }
    function hashString(value) {
      let hash = 2166136261;
      for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16);
    }
  })()`;
}

async function downloadLatestSvg(client, downloadDir) {
  const before = new Set(await safeReaddir(downloadDir));
  await clickButtonInLatestOutput(client, [/Download SVG/i, /^Download\b/i], [/ZIP/i]);
  const file = await waitForDownloadedFile(downloadDir, before, 90_000);
  const svg = await fs.readFile(file, "utf8");
  return {
    path: file,
    basename: path.basename(file),
    bytes: Buffer.byteLength(svg),
    hash: hashString(svg),
  };
}

async function waitForDownloadedFile(downloadDir, before, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = [];
  while (Date.now() < deadline) {
    last = await safeReaddir(downloadDir);
    const candidates = last.filter((name) => !before.has(name) && !/\.crdownload$/i.test(name));
    const downloading = last.some((name) => /\.crdownload$/i.test(name));
    if (candidates.length && !downloading) {
      const full = path.join(downloadDir, candidates[0]);
      const stat = await fs.stat(full).catch(() => null);
      if (stat?.size > 0) return full;
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for SVG download. Last files: ${last.join(", ")}`);
}

async function safeReaddir(dir) {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

async function clickButtonInLatestOutput(client, patterns, rejectPatterns = []) {
  const target = await findButtonTarget(client, patterns, rejectPatterns, "latest");
  if (!target) return null;
  await trustedClickAtPoint(client, target);
  return target;
}

async function clickButtonIfPresent(client, patterns, rejectPatterns = []) {
  const target = await findButtonTarget(client, patterns, rejectPatterns, "document");
  if (!target) return null;
  await trustedClickAtPoint(client, target);
  return target;
}

async function findButtonTarget(client, patterns, rejectPatterns, scope) {
  return evaluate(client, `(() => {
    const patterns = ${JSON.stringify(patterns.map((pattern) => pattern.source))}.map((source) => new RegExp(source, "i"));
    const rejects = ${JSON.stringify(rejectPatterns.map((pattern) => pattern.source))}.map((source) => new RegExp(source, "i"));
    const cards = Array.from(document.querySelectorAll("[data-output-stamp]"));
    const latest = latestCard(cards);
    const root = ${JSON.stringify(scope)} === "latest" ? latest : document.body;
    if (!root) return null;
    const buttons = Array.from(root.querySelectorAll("button, [role='button'], summary"));
    const button = buttons.find((candidate) => {
      const text = (candidate.innerText || candidate.textContent || candidate.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
      return isVisible(candidate) && !candidate.disabled && patterns.some((pattern) => pattern.test(text)) && !rejects.some((pattern) => pattern.test(text));
    });
    if (!button) return null;
    button.scrollIntoView({ block: "center", inline: "nearest" });
    const rect = button.getBoundingClientRect();
    return {
      label: (button.innerText || button.textContent || button.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim(),
      x: Math.max(1, Math.min(window.innerWidth - 2, rect.left + rect.width / 2)),
      y: Math.max(1, Math.min(window.innerHeight - 2, rect.top + rect.height / 2)),
    };
    ${browserVisibleHelpers()}
    ${browserLatestCardHelpers()}
  })()`, 8_000);
}

async function trustedClickAtPoint(client, point) {
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "none" }, 6_000);
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", buttons: 1, clickCount: 1 }, 6_000);
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", buttons: 0, clickCount: 1 }, 6_000);
}

async function enablePage(client, downloadDir) {
  await client.send("Runtime.enable").catch(() => {});
  await client.send("Log.enable").catch(() => {});
  await client.send("Page.enable").catch(() => {});
  await client.send("DOM.enable").catch(() => {});
  await client.send("Network.enable").catch(() => {});
  await client.send("Browser.grantPermissions", {
    origin: baseUrl,
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  }).catch(() => {});
  await client.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir }).catch(() => {});
  await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir }).catch(() => {});
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false,
  }).catch(() => {});
}

async function waitForDocumentReady(client) {
  return waitForValue(client, () => `(() => ({ href: location.href, readyState: document.readyState }))()`, 30_000, (state) =>
    state?.readyState === "interactive" || state?.readyState === "complete"
  );
}

async function waitForValue(client, expressionFactory, timeoutMs, isReady = Boolean) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await evaluate(client, expressionFactory(), Math.min(5_000, Math.max(1_000, deadline - Date.now())));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      last = { error: message };
      if (!/timed out/i.test(message)) throw error;
      await delay(500);
      continue;
    }
    if (isReady(last)) return last;
    await delay(300);
  }
  throw new Error(`Timed out waiting for browser state. Last value: ${JSON.stringify(last)}`);
}

async function evaluate(client, expression, timeoutMs = 12_000) {
  const response = await client.send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    timeoutMs,
  );
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return response.result?.value;
}

async function openTab(url) {
  const target = await createCdpTarget(url);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const client = new CdpClient(ws);
  await client.send("Runtime.enable").catch(() => {});
  await client.send("Page.enable").catch(() => {});
  await waitForDocumentReady(client).catch(() => {});
  return client;
}

async function createCdpTarget(url) {
  const browserInfo = await cdpJson("/json/version");
  if (browserInfo.webSocketDebuggerUrl) {
    const browserWs = new WebSocket(browserInfo.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      browserWs.addEventListener("open", resolve, { once: true });
      browserWs.addEventListener("error", reject, { once: true });
    });
    const browserClient = new CdpClient(browserWs);
    const { targetId } = await browserClient.send("Target.createTarget", { url, newWindow: false, background: false });
    await browserClient.close().catch(() => {});
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const targets = await cdpJson("/json/list");
      const target = targets.find((candidate) => candidate.id === targetId);
      if (target?.webSocketDebuggerUrl) return target;
      await delay(150);
    }
  }
  return cdpJson(`/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.consoleErrors = [];
    this.networkErrors = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject, timeout } = this.pending.get(message.id);
        clearTimeout(timeout);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message || JSON.stringify(message.error)));
        else resolve(message.result || {});
        return;
      }
      if (message.method === "Runtime.consoleAPICalled" && /error|warning/i.test(message.params?.type || "")) {
        this.consoleErrors.push({
          type: message.params.type,
          text: (message.params.args || []).map((arg) => arg.value || arg.description || "").join(" ").slice(0, 500),
        });
      }
      if (message.method === "Log.entryAdded" && /error|warning/i.test(message.params?.entry?.level || "")) {
        this.consoleErrors.push({
          type: message.params.entry.level,
          text: String(message.params.entry.text || "").slice(0, 500),
        });
      }
      if (message.method === "Network.loadingFailed") {
        this.networkErrors.push({
          errorText: message.params?.errorText || "",
          type: message.params?.type || "",
          canceled: Boolean(message.params?.canceled),
        });
      }
      for (const listener of this.listeners) listener(message);
    });
  }
  send(method, params = {}, timeoutMs = 15_000) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);
      timeout.unref?.();
      this.pending.set(id, { resolve, reject, timeout });
      this.ws.send(payload);
    });
  }
  onEvent(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  collectLogs() {
    return { consoleErrors: this.consoleErrors, networkErrors: this.networkErrors };
  }
  close() {
    return new Promise((resolve) => {
      this.ws.addEventListener("close", resolve, { once: true });
      this.ws.close();
      setTimeout(resolve, 500).unref?.();
    });
  }
}

async function cdpJson(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${debugPort}${pathname}`, options);
  if (!response.ok) throw new Error(`CDP request failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function waitForCdp() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      await cdpJson("/json/version");
      return;
    } catch {
      await delay(250);
    }
  }
  throw new Error("Timed out waiting for browser CDP endpoint.");
}

async function findBrowserExecutable() {
  const candidates = [
    process.env.BROWSER_EXECUTABLE,
    path.join(process.env.PROGRAMFILES || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env.PROGRAMFILES || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Google/Chrome/Application/chrome.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/Application/chrome.exe"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("No Chromium-family browser executable found.");
}

function browserLatestCardHelpers() {
  return `
    function latestCard(items) {
      return items.reduce((best, card) => {
        if (!best) return card;
        return numberOrNull(card.getAttribute("data-output-stamp")) >= numberOrNull(best.getAttribute("data-output-stamp")) ? card : best;
      }, null);
    }
    function numberOrNull(value) {
      const text = String(value || "").trim();
      if (!text) return null;
      const number = Number(text.replace(/[^0-9.]/g, ""));
      return Number.isFinite(number) ? number : null;
    }
  `;
}

function browserVisibleHelpers() {
  return `
    function isVisible(element) {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }
  `;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopSpawnedBrowser(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  if (await waitForChildExit(child, 2_000)) return;
  if (process.platform === "win32" && child.pid) {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      killer.on("close", resolve);
      killer.on("error", resolve);
    });
    if (await waitForChildExit(child, 2_000)) return;
  }
  child.kill("SIGKILL");
  await waitForChildExit(child, 1_000);
}

function waitForChildExit(child, timeoutMs) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve(true);
    });
    child.once("error", () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
