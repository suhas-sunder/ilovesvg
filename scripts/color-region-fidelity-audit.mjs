import { spawn, execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import sharp from "sharp";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const execFile = promisify(execFileCallback);

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = getSmokeBaseUrl();
const debugPort = Number(process.env.CDP_PORT || 10_100 + Math.floor(Math.random() * 300));
const tmpRunDir = path.join(os.tmpdir(), "ilovesvg-color-region-fidelity", String(debugPort));
const profileDir = path.join(tmpRunDir, "profile");
const fixtureOutputDir = path.join(rootDir, "tmp", "color-region-fidelity-fixtures");
const reportPath = process.env.COLOR_REGION_FIDELITY_REPORT_PATH
  ? path.resolve(process.env.COLOR_REGION_FIDELITY_REPORT_PATH)
  : path.join(rootDir, "tmp", "color-region-fidelity-audit.json");

const screenshotFixturePath =
  process.env.COLOR_REGION_SCREENSHOT_FIXTURE ||
  "C:\\Users\\Suhas\\Downloads\\Screenshot 2026-05-06 194041.png";
const tomatoFixturePath =
  process.env.COLOR_REGION_TOMATO_FIXTURE ||
  "C:\\Users\\Suhas\\Downloads\\charming-tomato-512x512.png";
const existingLogoFixturePath = path.join(rootDir, "tests", "fixtures", "IMG_8487.PNG");

const presetDefinitions = {
  "layered-flat-color": {
    label: "Layered - Flat Color",
    patterns: [/^Layered - Flat Color\b/i],
    required: true,
  },
  "layered-detail": {
    label: "Layered - Detail",
    patterns: [/^Layered - Detail\b/i],
    required: false,
  },
  "photo-many-colors": {
    label: "Photo Many Colors",
    patterns: [/^Photo Many Colors\b/i],
    required: false,
  },
  "filled-layers-separate-colors": {
    label: "Filled Layers - Separate Colors",
    patterns: [/^Filled Layers - Separate Colors\b/i, /^Filled Layers\b/i],
    required: false,
  },
};

async function main() {
  await fs.rm(tmpRunDir, { recursive: true, force: true });
  await fs.mkdir(profileDir, { recursive: true });
  await fs.mkdir(fixtureOutputDir, { recursive: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  const [server, git, fixtures, sourceInspection] = await Promise.all([
    serverState(),
    gitState(),
    prepareFixtures(),
    inspectGroupingImplementation(),
  ]);

  if (!server.looksLikeIlovesvg) {
    throw new Error(`The canonical smoke URL did not look like iLoveSVG: ${baseUrl}`);
  }

  const scenarios = buildScenarioMatrix(fixtures);
  if (!scenarios.length) {
    throw new Error("No color region fidelity scenarios were available.");
  }

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

  const results = [];
  try {
    await waitForCdp();
    for (const scenario of scenarios) {
      console.error(`[color-region-fidelity] ${scenario.id}`);
      const result = await runScenario(scenario, fixtures).catch((error) => ({
        id: scenario.id,
        route: scenario.route,
        presetId: scenario.presetId,
        preset: presetDefinitions[scenario.presetId]?.label || scenario.presetId,
        fixtureId: scenario.fixtureId,
        ok: false,
        skipped: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
        steps: error?.steps || [],
      }));
      results.push(result);
    }
  } finally {
    browser.kill();
    await fs.rm(tmpRunDir, { recursive: true, force: true }).catch(() => {});
  }

  const summary = summarizeResults(results, fixtures, sourceInspection);
  const report = {
    schemaVersion: 1,
    auditKind: "color-region-fidelity-audit",
    checkedAt: new Date().toISOString(),
    baseUrl,
    server,
    git,
    fixtures,
    requestedFixtures: {
      screenshotFixturePath,
      tomatoFixturePath,
      existingLogoFixturePath,
    },
    scenarios,
    scenarioResults: results,
    sourceInspection,
    summary,
  };

  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        ok: summary.ok,
        reportPath,
        completedScenarioCount: summary.completedScenarioCount,
        skippedScenarioCount: summary.skippedScenarioCount,
        failedScenarioCount: summary.failedScenarioCount,
        flatColorRouteCoverage: summary.flatColorRouteCoverage,
        highRiskScenarioIds: summary.highRiskScenarioIds,
      },
      null,
      2,
    ),
  );

  if (!summary.ok) {
    process.exitCode = 1;
  }
}

function buildScenarioMatrix(fixtures) {
  const byId = new Map(fixtures.inputs.map((fixture) => [fixture.id, fixture]));
  const complexPng =
    byId.get("trading-card-candidate") ||
    byId.get("screenshot-complex-png") ||
    byId.get("existing-logo-png") ||
    byId.get("generated-logo-png");
  const complexJpg =
    byId.get("trading-card-candidate-jpg") ||
    byId.get("screenshot-complex-jpg") ||
    byId.get("generated-logo-jpg");
  const tomato = byId.get("transparent-tomato-png");
  const simple = byId.get("existing-logo-png") || byId.get("generated-logo-png");

  const candidates = [
    complexPng && {
      id: "home-flat-complex",
      route: "/",
      fixtureId: complexPng.id,
      presetId: "layered-flat-color",
      conversionTimeoutMs: 240_000,
      verifyCopyDownloadParity: true,
    },
    complexPng && {
      id: "png-flat-complex",
      route: "/png-to-layered-svg-for-cricut",
      fixtureId: complexPng.id,
      presetId: "layered-flat-color",
      conversionTimeoutMs: 240_000,
      verifyCopyDownloadParity: true,
    },
    complexJpg && {
      id: "jpg-flat-complex",
      route: "/jpg-to-layered-svg-for-cricut",
      fixtureId: complexJpg.id,
      presetId: "layered-flat-color",
      presetPatterns: [/^Layered - Flat Color\b/i, /^Layered color SVG\b/i],
      conversionTimeoutMs: 240_000,
      verifyCopyDownloadParity: true,
    },
    complexPng && {
      id: "home-detail-complex",
      route: "/",
      fixtureId: complexPng.id,
      presetId: "layered-detail",
      conversionTimeoutMs: 240_000,
      verifyCopyDownloadParity: false,
    },
    complexPng && {
      id: "home-photo-many-colors-complex",
      route: "/",
      fixtureId: complexPng.id,
      presetId: "photo-many-colors",
      conversionTimeoutMs: 300_000,
      verifyCopyDownloadParity: false,
    },
    complexPng && {
      id: "home-filled-layers-complex",
      route: "/",
      fixtureId: complexPng.id,
      presetId: "filled-layers-separate-colors",
      conversionTimeoutMs: 240_000,
      verifyCopyDownloadParity: false,
    },
    complexPng && {
      id: "png-detail-complex",
      route: "/png-to-layered-svg-for-cricut",
      fixtureId: complexPng.id,
      presetId: "layered-detail",
      conversionTimeoutMs: 240_000,
      verifyCopyDownloadParity: false,
    },
    complexJpg && {
      id: "jpg-detail-complex",
      route: "/jpg-to-layered-svg-for-cricut",
      fixtureId: complexJpg.id,
      presetId: "layered-detail",
      presetPatterns: [/^Layered color SVG - More detail\b/i, /^Layered - Detail\b/i],
      conversionTimeoutMs: 240_000,
      verifyCopyDownloadParity: false,
    },
    tomato && {
      id: "home-flat-tomato",
      route: "/",
      fixtureId: tomato.id,
      presetId: "layered-flat-color",
      conversionTimeoutMs: 180_000,
      verifyCopyDownloadParity: false,
    },
    simple && {
      id: "home-flat-simple-logo",
      route: "/",
      fixtureId: simple.id,
      presetId: "layered-flat-color",
      conversionTimeoutMs: 180_000,
      verifyCopyDownloadParity: false,
    },
  ].filter(Boolean);

  const filter = process.env.COLOR_REGION_FIDELITY_SCENARIO_FILTER || "";
  return candidates.filter((scenario) => !filter || scenario.id.includes(filter) || scenario.route === filter);
}

async function runScenario(scenario, fixtures) {
  const fixture = fixtures.inputs.find((candidate) => candidate.id === scenario.fixtureId);
  if (!fixture) {
    throw new Error(`Missing fixture ${scenario.fixtureId}`);
  }

  const steps = [];
  async function step(name, fn) {
    const started = performance.now();
    try {
      const value = await fn();
      steps.push({ name, ok: true, ms: Math.round(performance.now() - started) });
      return value;
    } catch (error) {
      steps.push({
        name,
        ok: false,
        ms: Math.round(performance.now() - started),
        error: error instanceof Error ? error.message : String(error),
      });
      if (error && typeof error === "object") error.steps = steps;
      throw error;
    }
  }

  const preset = presetDefinitions[scenario.presetId];
  const client = await step("open tab", () => openTab(`${baseUrl}${scenario.route}`));
  try {
    await step("enable page", () => enablePage(client));
    await step("reset browser state", () => resetScenarioBrowserState(client));
    await step("wait for document ready", () => waitForDocumentReady(client));
    await step("install copy/download capture", () => installCopyDownloadCapture(client));
    await step("set file input", () => setFileInput(client, fixture.path));
    await step("settle initial auto conversion", () => settleInitialAutoConversion(client, 20_000).catch(() => null));

    const beforePresetState = await step("read state before preset", () => outputState(client).catch(() => ({ latestStamp: null })));
    const selectedPreset = await step("select preset", () => selectPreset(client, scenario.presetPatterns || preset.patterns));
    if (!selectedPreset.selected) {
      return {
        id: scenario.id,
        route: scenario.route,
        presetId: scenario.presetId,
        preset: preset.label,
        fixture: fixture.info,
        ok: true,
        skipped: true,
        skipReason: selectedPreset.reason || "Preset was not visible on this route.",
        steps,
      };
    }

    const beforeConvertState = await step("read state before convert", () => outputState(client).catch(() => beforePresetState));
    await step("click convert", () => clickConvert(client));
    const completed = await step("wait for completed output", () =>
      waitForCompletedOutput(
        client,
        beforeConvertState.latestStamp ?? beforePresetState.latestStamp,
        scenario.conversionTimeoutMs,
      ),
    );
    await step("open latest settings panel", () => openLatestSettingsPanel(client).catch(() => null));
    await step("open layer colors", () => ensureSettingsSectionOpen(client, /Layer colors/i, "layer-colors").catch(() => null));
    const snapshot = await step("collect output snapshot", () => collectOutputSnapshot(client, "after-conversion"));

    const analysis = await step("analyze svg region fidelity", () =>
      analyzeRegionFidelity({
        scenario,
        fixture,
        svg: snapshot.svg || "",
      }),
    );

    let copyDownloadParity = {
      attempted: false,
      applicable: Boolean(scenario.verifyCopyDownloadParity),
      ok: null,
      reason: scenario.verifyCopyDownloadParity ? "not run" : "not requested for this scenario",
    };
    if (scenario.verifyCopyDownloadParity && snapshot.svg) {
      copyDownloadParity = await step("verify copy/download parity", () =>
        verifyCopyDownloadParity(client, snapshot.svg).catch((error) => ({
          attempted: true,
          applicable: true,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        })),
      );
    }

    return {
      id: scenario.id,
      route: scenario.route,
      presetId: scenario.presetId,
      preset: preset.label,
      fixture: fixture.info,
      ok: true,
      skipped: false,
      selectedPreset,
      completed,
      snapshot: withoutSvg(snapshot),
      svgHash: snapshot.svg ? hashString(snapshot.svg) : null,
      svgBytes: snapshot.svg ? Buffer.byteLength(snapshot.svg) : 0,
      analysis,
      copyDownloadParity,
      steps,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function collectOutputSnapshot(client, phase) {
  return evaluate(client, `(async () => {
    const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
    const lightweight = ${JSON.stringify(process.env.COLOR_REGION_FIDELITY_LIGHTWEIGHT === "1")};
    const svg = !lightweight && latest ? await decodeLatestSvg(latest) : "";
    const layerSection = latest?.querySelector('[data-layer-color-total-count]');
    const layerAllColors = String(layerSection?.getAttribute("data-layer-color-all-colors") || "")
      .split(/[\\s,]+/)
      .map(normalizeHex)
      .filter(Boolean);
    const rows = visibleElements(latest || document, '[data-layer-color-row="true"]');
    const rowColors = rows
      .map((row) => normalizeHex(row.getAttribute("data-layer-color-hex") || row.querySelector('input[type="text"][aria-label$=" hex color"]')?.value || ""))
      .filter(Boolean);
    return {
      phase: ${JSON.stringify(phase)},
      href: location.href,
      latestOutput: latest ? {
        stamp: numberOrNull(latest.getAttribute("data-output-stamp")),
        jobStatus: latest.getAttribute("data-job-status") || null,
        engineUsed: latest.getAttribute("data-engine-used") || null,
        layerBuildMode: latest.getAttribute("data-layer-build-mode") || null,
        requestedPaletteCount: numberOrNull(latest.getAttribute("data-requested-palette-count")),
        actualPaletteCount: numberOrNull(latest.getAttribute("data-actual-palette-count")),
        svgBytesAttr: numberOrNull(latest.getAttribute("data-svg-bytes")),
        pathCountAttr: numberOrNull(latest.getAttribute("data-path-count")),
        outputDetectedColorsAttr: latest.getAttribute("data-output-detected-colors") || null,
        text: (latest.innerText || "").replace(/\\s+/g, " ").slice(0, 900),
      } : null,
      ui: {
        exposedLayerCount: numberOrNull(layerSection?.getAttribute("data-layer-color-total-count")) || unique([...layerAllColors, ...rowColors]).length,
        mountedLayerRows: rows.length,
        exposedLayerColors: unique([...layerAllColors, ...rowColors]),
      },
      lightweight,
      svg,
    };

    async function decodeLatestSvg(root) {
      const focused = root.querySelector('[data-focused-editor-workspace="true"]');
      const searchRoot = focused || root;
      const images = Array.from(searchRoot.querySelectorAll('[data-editor-output-preview="true"] img, img'));
      for (const image of images) {
        const svg = await decodeSvgImage(image);
        if (svg) return svg;
      }
      return "";
    }

    async function decodeSvgImage(image) {
      const src = image?.getAttribute("src") || "";
      if (!src) return "";
      if (src.startsWith("data:image/svg+xml;base64,")) {
        try { return atob(src.slice(src.indexOf(",") + 1)); } catch { return ""; }
      }
      if (src.startsWith("data:image/svg+xml")) {
        const comma = src.indexOf(",");
        if (comma < 0) return "";
        try { return decodeURIComponent(src.slice(comma + 1)); } catch { return ""; }
      }
      if (src.startsWith("blob:") || src.startsWith(location.origin)) {
        try {
          const response = await fetch(src);
          const text = await response.text();
          return /^\\s*<svg[\\s>]/i.test(text) ? text : "";
        } catch {
          return "";
        }
      }
      return "";
    }

    function visibleElements(root, selector) {
      if (!root) return [];
      return Array.from(root.querySelectorAll(selector)).filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
    }

    function normalizeHex(value) {
      const text = String(value || "").trim().toLowerCase();
      const match = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
      if (!match) return "";
      const hex = match[1].toLowerCase();
      if (hex.length === 3) return "#" + hex.split("").map((char) => char + char).join("");
      return "#" + hex.slice(0, 6);
    }

    function unique(items) {
      return Array.from(new Set(items));
    }

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
  })()`, 180_000);
}

async function analyzeRegionFidelity({ scenario, fixture, svg }) {
  if (!svg) {
    return {
      ok: false,
      reason: "No SVG was decoded from the output preview.",
    };
  }
  const structure = analyzeSvgStructure(svg);
  const visualComparison = await compareInputAndSvgOutput(fixture.path, svg, structure.viewBox).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }));
  const risk = assessRegionRisk(structure, visualComparison, scenario, fixture);
  return {
    ok: true,
    svgBytes: Buffer.byteLength(svg),
    groupedColorCount: structure.groupedColorCount,
    pathCount: structure.pathCount,
    exposedLayerCountFromSvg: structure.layerIds.length,
    representativeGroupColors: structure.groups.map((group) => group.color),
    groups: structure.groups,
    spatialFindings: {
      groupsMixingSpatiallyDistantRegions: structure.groups
        .filter((group) => group.mixesSpatiallyDistantRegions)
        .map((group) => group.color),
      foregroundBackgroundMergeCandidates: structure.groups
        .filter((group) => group.foregroundBackgroundMergeCandidate)
        .map((group) => group.color),
      dominantOverpowerCandidates: structure.groups
        .filter((group) => group.dominantOverpowerCandidate)
        .map((group) => group.color),
      groupsWithManyQuadrants: structure.groups
        .filter((group) => group.quadrantsTouched >= 3)
        .map((group) => ({ color: group.color, quadrantsTouched: group.quadrantsTouched })),
    },
    visualComparison,
    risk,
  };
}

function analyzeSvgStructure(svg) {
  const viewBox = parseViewBox(svg);
  const paths = parsePathRecords(svg);
  const groupsByKey = new Map();
  for (const record of paths) {
    const color = normalizeHex(record.fill) || "none";
    const key = record.layerId || color;
    if (!groupsByKey.has(key)) {
      groupsByKey.set(key, {
        id: key,
        color,
        pathCount: 0,
        areaProxy: 0,
        dLength: 0,
        opacityValues: new Set(),
        bboxes: [],
        centroids: [],
        sourceLayerIds: new Set(),
      });
    }
    const group = groupsByKey.get(key);
    group.pathCount += 1;
    group.areaProxy += record.areaProxy;
    group.dLength += record.dLength;
    if (record.opacity !== null) group.opacityValues.add(record.opacity);
    if (record.bbox) {
      group.bboxes.push(record.bbox);
      group.centroids.push({
        x: (record.bbox.minX + record.bbox.maxX) / 2,
        y: (record.bbox.minY + record.bbox.maxY) / 2,
      });
    }
    if (record.layerId) group.sourceLayerIds.add(record.layerId);
  }

  const totalAreaProxy = Array.from(groupsByKey.values()).reduce((sum, group) => sum + group.areaProxy, 0) || 1;
  const totalPaths = paths.length || 1;
  const viewArea = Math.max(1, viewBox.width * viewBox.height);
  const diagonal = Math.max(1, Math.hypot(viewBox.width, viewBox.height));
  const groups = Array.from(groupsByKey.values())
    .map((group) => {
      const bbox = mergeBboxes(group.bboxes);
      const bboxAreaRatio = bbox ? bboxArea(bbox) / viewArea : 0;
      const maxCentroidDistanceRatio = centroidSpread(group.centroids) / diagonal;
      const quadrantsTouched = countQuadrants(group.centroids, viewBox);
      const pathShare = group.pathCount / totalPaths;
      const areaProxyShare = group.areaProxy / totalAreaProxy;
      const isColorGroup = group.color !== "none" && group.color !== "unknown";
      const mixesSpatiallyDistantRegions = isColorGroup &&
        group.pathCount >= 4 &&
        group.centroids.length >= 4 &&
        ((quadrantsTouched >= 3 && maxCentroidDistanceRatio > 0.42) ||
          (bboxAreaRatio > 0.62 && areaProxyShare < 0.45));
      const foregroundBackgroundMergeCandidate = isColorGroup &&
        group.pathCount >= 6 &&
        bboxAreaRatio > 0.68 &&
        quadrantsTouched >= 3 &&
        areaProxyShare < 0.55;
      const dominantOverpowerCandidate = isColorGroup &&
        areaProxyShare > 0.45 &&
        group.pathCount < totalPaths * 0.35 &&
        bboxAreaRatio > 0.5;
      return {
        id: group.id,
        color: group.color,
        colorFamily: colorFamily(hexToRgb(group.color)),
        pathCount: group.pathCount,
        pathShare: round(pathShare),
        areaProxy: round(group.areaProxy),
        areaProxyShare: round(areaProxyShare),
        dLength: group.dLength,
        bbox: bbox ? roundBbox(bbox) : null,
        bboxAreaRatio: round(bboxAreaRatio),
        quadrantsTouched,
        maxCentroidDistanceRatio: round(maxCentroidDistanceRatio),
        opacityValues: Array.from(group.opacityValues).sort(),
        sourceLayerIds: Array.from(group.sourceLayerIds).sort(),
        mixesSpatiallyDistantRegions,
        foregroundBackgroundMergeCandidate,
        dominantOverpowerCandidate,
      };
    })
    .sort((a, b) => b.areaProxyShare - a.areaProxyShare || b.pathCount - a.pathCount || a.color.localeCompare(b.color));

  return {
    viewBox,
    pathCount: paths.length,
    groupedColorCount: unique(groups.map((group) => group.color).filter((color) => color !== "none")).length,
    layerIds: unique(paths.map((record) => record.layerId).filter(Boolean)),
    groups,
  };
}

function parsePathRecords(svg) {
  const records = [];
  const consumed = [];
  const groupRegex = /<g\b([^>]*)>([\s\S]*?)<\/g>/gi;
  let groupMatch;
  while ((groupMatch = groupRegex.exec(svg))) {
    const [whole, groupAttrs, inner] = groupMatch;
    consumed.push([groupMatch.index, groupMatch.index + whole.length]);
    const inheritedFill = readFill(groupAttrs);
    const inheritedLayerId = readAttr(groupAttrs, "data-fill-layer-id") || readAttr(groupAttrs, "data-layer-id");
    readPathsFromMarkup(inner, inheritedFill, inheritedLayerId, records);
  }
  const remaining = removeRanges(svg, consumed);
  readPathsFromMarkup(remaining, null, null, records);
  return records;
}

function readPathsFromMarkup(markup, inheritedFill, inheritedLayerId, records) {
  const pathRegex = /<path\b([^>]*)\/?>/gi;
  let match;
  while ((match = pathRegex.exec(markup))) {
    const attrs = match[1] || "";
    const fill = readFill(attrs) || inheritedFill || "";
    const layerId = readAttr(attrs, "data-fill-layer-id") || readAttr(attrs, "data-layer-id") || inheritedLayerId || "";
    const d = readAttr(attrs, "d") || "";
    const transform = readAttr(attrs, "transform") || "";
    const opacity = readAttr(attrs, "opacity") || readAttr(attrs, "fill-opacity") || readStyleValue(attrs, "opacity");
    const dLength = d.length;
    records.push({
      fill,
      layerId,
      dLength,
      areaProxy: 1 + Math.min(24, Math.sqrt(Math.max(1, dLength)) / 4),
      bbox: bboxFromPathData(d, transform),
      opacity: opacity == null || opacity === "" ? null : Number(opacity),
    });
  }
}

function parseViewBox(svg) {
  const viewBoxMatch = svg.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  if (viewBoxMatch) {
    const numbers = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
    if (numbers.length >= 4 && numbers[2] > 0 && numbers[3] > 0) {
      return { minX: numbers[0], minY: numbers[1], width: numbers[2], height: numbers[3] };
    }
  }
  const width = Number(svg.match(/\bwidth\s*=\s*["']([0-9.]+)/i)?.[1]) || 100;
  const height = Number(svg.match(/\bheight\s*=\s*["']([0-9.]+)/i)?.[1]) || 100;
  return { minX: 0, minY: 0, width, height };
}

function bboxFromPathData(d, transform) {
  const numbers = Array.from(String(d || "").matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)).map((match) => Number(match[0]));
  if (numbers.length < 2) return null;
  const translate = parseTranslate(transform);
  const xs = [];
  const ys = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    xs.push(numbers[index] + translate.x);
    ys.push(numbers[index + 1] + translate.y);
  }
  if (!xs.length || !ys.length) return null;
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function parseTranslate(transform) {
  const match = String(transform || "").match(/translate\(\s*(-?\d*\.?\d+)(?:[\s,]+(-?\d*\.?\d+))?/i);
  if (!match) return { x: 0, y: 0 };
  return {
    x: Number(match[1]) || 0,
    y: Number(match[2]) || 0,
  };
}

async function compareInputAndSvgOutput(inputPath, svg, viewBox) {
  const width = 96;
  const height = 96;
  const [input, output] = await Promise.all([
    sharp(inputPath, { limitInputPixels: false })
      .resize(width, height, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer(),
    sharp(Buffer.from(svg), { limitInputPixels: false })
      .resize(width, height, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer(),
  ]);

  const inputFamilies = familyHistogram(input);
  const outputFamilies = familyHistogram(output);
  const cellComparisons = compareCells(input, output, width, height, 4, 4);
  const colorDistance = averageColorDistance(input, output);
  const missingMajorFamilies = inputFamilies.top
    .filter((family) => family.share >= 0.06 && !outputFamilies.all.includes(family.family))
    .map((family) => family.family);

  return {
    ok: true,
    rasterizedSize: { width, height },
    viewBox,
    overallColorError: round(colorDistance),
    inputDominantFamilies: inputFamilies.top,
    outputDominantFamilies: outputFamilies.top,
    missingMajorInputFamilies: missingMajorFamilies,
    localCellsWithFamilyMismatch: cellComparisons.filter((cell) => cell.familyMismatch).length,
    localCellsWithHighError: cellComparisons.filter((cell) => cell.error > 60).length,
    worstLocalCells: cellComparisons.sort((a, b) => b.error - a.error).slice(0, 6),
    majorColorFamiliesPreserved: missingMajorFamilies.length === 0,
  };
}

function compareCells(input, output, width, height, columns, rows) {
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const box = {
        x0: Math.floor((column * width) / columns),
        y0: Math.floor((row * height) / rows),
        x1: Math.floor(((column + 1) * width) / columns),
        y1: Math.floor(((row + 1) * height) / rows),
      };
      const inputAvg = averageRegion(input, width, box);
      const outputAvg = averageRegion(output, width, box);
      const error = rgbDistance(inputAvg, outputAvg);
      const inputFamily = colorFamily(inputAvg);
      const outputFamily = colorFamily(outputAvg);
      cells.push({
        row,
        column,
        input: rgbToHex(inputAvg),
        output: rgbToHex(outputAvg),
        inputFamily,
        outputFamily,
        error: round(error),
        familyMismatch: inputFamily !== outputFamily && !compatibleFamilies(inputFamily, outputFamily),
      });
    }
  }
  return cells;
}

function familyHistogram(buffer) {
  const counts = new Map();
  let total = 0;
  for (let index = 0; index + 3 < buffer.length; index += 4) {
    if (buffer[index + 3] < 24) continue;
    const family = colorFamily({ r: buffer[index], g: buffer[index + 1], b: buffer[index + 2] });
    counts.set(family, (counts.get(family) || 0) + 1);
    total += 1;
  }
  const top = Array.from(counts.entries())
    .map(([family, count]) => ({ family, count, share: round(count / Math.max(1, total)) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  return {
    top,
    all: Array.from(counts.keys()),
  };
}

function averageColorDistance(input, output) {
  let total = 0;
  let count = 0;
  for (let index = 0; index + 3 < input.length && index + 3 < output.length; index += 4) {
    if (input[index + 3] < 24 && output[index + 3] < 24) continue;
    total += rgbDistance(
      { r: input[index], g: input[index + 1], b: input[index + 2] },
      { r: output[index], g: output[index + 1], b: output[index + 2] },
    );
    count += 1;
  }
  return total / Math.max(1, count);
}

function averageRegion(buffer, width, box) {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let y = box.y0; y < box.y1; y += 1) {
    for (let x = box.x0; x < box.x1; x += 1) {
      const index = (y * width + x) * 4;
      if (buffer[index + 3] < 24) continue;
      r += buffer[index];
      g += buffer[index + 1];
      b += buffer[index + 2];
      count += 1;
    }
  }
  return {
    r: Math.round(r / Math.max(1, count)),
    g: Math.round(g / Math.max(1, count)),
    b: Math.round(b / Math.max(1, count)),
  };
}

function assessRegionRisk(structure, visualComparison, scenario, fixture) {
  const spatialMixCount = structure.groups.filter((group) => group.mixesSpatiallyDistantRegions).length;
  const foregroundBackgroundCount = structure.groups.filter((group) => group.foregroundBackgroundMergeCandidate).length;
  const dominantOverpowerCount = structure.groups.filter((group) => group.dominantOverpowerCandidate).length;
  const highLocalErrors = visualComparison?.ok ? visualComparison.localCellsWithHighError : 0;
  const familyMismatches = visualComparison?.ok ? visualComparison.localCellsWithFamilyMismatch : 0;
  const missingFamilies = visualComparison?.ok ? visualComparison.missingMajorInputFamilies.length : 0;
  const groupedColorCount = structure.groupedColorCount;
  const reasons = [];
  if (spatialMixCount) reasons.push(`${spatialMixCount} color groups span spatially distant regions`);
  if (foregroundBackgroundCount) reasons.push(`${foregroundBackgroundCount} groups look like foreground/background merge candidates`);
  if (dominantOverpowerCount) reasons.push(`${dominantOverpowerCount} groups can let a dominant area control smaller regions`);
  if (highLocalErrors >= 4) reasons.push(`${highLocalErrors} local grid cells have high raster color error`);
  if (familyMismatches >= 4) reasons.push(`${familyMismatches} local grid cells change dominant hue family`);
  if (missingFamilies) reasons.push(`${missingFamilies} major input color families are missing from the output raster sample`);
  if (fixture.role === "complex-card-proxy" && scenario.presetId === "layered-flat-color" && groupedColorCount < 14) {
    reasons.push("complex fixture is compressed into a very small Flat Color palette");
  }

  let level = "low";
  if (spatialMixCount || foregroundBackgroundCount || dominantOverpowerCount || highLocalErrors >= 3 || familyMismatches >= 3) {
    level = "medium";
  }
  if (
    foregroundBackgroundCount >= 2 ||
    highLocalErrors >= 6 ||
    familyMismatches >= 6 ||
    (fixture.role === "complex-card-proxy" && scenario.presetId === "layered-flat-color" && spatialMixCount >= 2)
  ) {
    level = "high";
  }

  return {
    level,
    reasons,
    wrongRegionRiskLikely: level === "high" || level === "medium",
    exactCardFixtureAvailable: fixture.role === "trading-card-candidate",
    exactCardSpecificClaimsAllowed: fixture.role === "trading-card-candidate",
  };
}

async function prepareFixtures() {
  const inputs = [];
  const unavailable = [];
  const tradingCardCandidates = await findTradingCardCandidates();

  if (tradingCardCandidates.length) {
    const candidate = tradingCardCandidates[0];
    inputs.push(await fixtureInfo("trading-card-candidate", candidate.path, "trading-card-candidate", {
      source: "downloads-name-match",
      matchNote: "Candidate found by filename search. Not treated as exact unless manually confirmed.",
    }));
  } else {
    unavailable.push({
      requested: "trading-card/fish/Magikarp-style image",
      reason: "No filename match for fish, magikarp, card, trading, pokemon, tcg, silver, or water was found in Downloads.",
    });
  }

  if (await pathExists(screenshotFixturePath)) {
    inputs.push(await fixtureInfo("screenshot-complex-png", screenshotFixturePath, "complex-card-proxy", {
      source: "real-user-screenshot-fixture",
    }));
  } else {
    unavailable.push({ requested: screenshotFixturePath, reason: "File was not present." });
  }

  if (await pathExists(tomatoFixturePath)) {
    inputs.push(await fixtureInfo("transparent-tomato-png", tomatoFixturePath, "simple-transparent-object", {
      source: "real-user-tomato-fixture",
    }));
  } else {
    unavailable.push({ requested: tomatoFixturePath, reason: "File was not present." });
  }

  if (await pathExists(existingLogoFixturePath)) {
    inputs.push(await fixtureInfo("existing-logo-png", existingLogoFixturePath, "simple-logo-or-sticker", {
      source: "existing-test-fixture",
    }));
  }

  const generatedLogoPath = path.join(fixtureOutputDir, "generated-simple-logo.png");
  await sharp(Buffer.from(buildSimpleLogoSvg())).png().toFile(generatedLogoPath);
  inputs.push(await fixtureInfo("generated-logo-png", generatedLogoPath, "generated-simple-logo", {
    source: "generated-diagnostic-fixture",
  }));

  const derivativeInputs = [];
  for (const fixture of inputs.filter((input) => /\.(png|webp)$/i.test(input.path))) {
    const jpgPath = path.join(fixtureOutputDir, `${fixture.id}.jpg`);
    await sharp(fixture.path, { limitInputPixels: false })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 92, mozjpeg: true })
      .toFile(jpgPath);
    derivativeInputs.push(await fixtureInfo(`${fixture.id.replace(/-png$/i, "")}-jpg`, jpgPath, fixture.role, {
      source: `${fixture.info.source}-jpg-derivative`,
      derivedFrom: fixture.path,
    }));
  }

  return {
    inputs: [...inputs, ...derivativeInputs],
    unavailable,
    tradingCardCandidates: tradingCardCandidates.map((candidate) => ({
      path: candidate.path,
      basename: candidate.basename,
      bytes: candidate.bytes,
      modifiedAt: candidate.modifiedAt,
    })),
  };
}

async function fixtureInfo(id, filePath, role, extra = {}) {
  const [stat, metadata] = await Promise.all([
    fs.stat(filePath),
    sharp(filePath, { limitInputPixels: false }).metadata().catch(() => ({})),
  ]);
  return {
    id,
    path: filePath,
    role,
    info: {
      id,
      path: filePath,
      basename: path.basename(filePath),
      role,
      bytes: stat.size,
      width: metadata.width || null,
      height: metadata.height || null,
      format: metadata.format || path.extname(filePath).slice(1),
      ...extra,
    },
  };
}

async function findTradingCardCandidates() {
  const downloads = "C:\\Users\\Suhas\\Downloads";
  if (!(await pathExists(downloads))) return [];
  const names = await fs.readdir(downloads);
  const pattern = /(fish|magikarp|card|trading|pokemon|tcg|silver|water)/i;
  const candidates = [];
  for (const name of names) {
    if (!pattern.test(name) || !/\.(png|jpe?g|webp)$/i.test(name)) continue;
    const filePath = path.join(downloads, name);
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat?.isFile()) continue;
    candidates.push({
      path: filePath,
      basename: name,
      bytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  }
  return candidates.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
}

async function inspectGroupingImplementation() {
  const files = {
    auditReport: path.join(rootDir, "docs", "performance", "palette-grouping-audit.md"),
    paletteAuditScript: path.join(rootDir, "scripts", "palette-grouping-audit.mjs"),
    worker: path.join(rootDir, "app", "client", "workers", "vtracer.worker.ts"),
    editingModel: path.join(rootDir, "app", "client", "lib", "converter", "svgEditingModel.ts"),
    layerEditor: path.join(rootDir, "app", "client", "components", "svg", "LayerPaletteEditor.tsx"),
    settingsCoverage: path.join(rootDir, "scripts", "settings-color-coverage-audit.mjs"),
    layerCorrectness: path.join(rootDir, "scripts", "layer-color-correctness-smoke.mjs"),
    cumulativePerformance: path.join(rootDir, "scripts", "cumulative-edit-performance-smoke.mjs"),
  };
  const contents = {};
  for (const [key, file] of Object.entries(files)) {
    contents[key] = await fs.readFile(file, "utf8").catch(() => "");
  }
  const worker = contents.worker;
  const functionStart = lineNumber(worker, "function groupFlatColorLayeredPalette");
  const postprocessLine = lineNumber(worker, "groupFlatColorLayeredPalette(svg, settings)");
  const representativeLine = lineNumber(worker, "function chooseFlatColorRepresentative");
  const groupLine = lineNumber(worker, "function buildFlatColorGroups");
  const thresholdLine = lineNumber(worker, "function flatColorGroupingThreshold");
  const annotateLine = lineNumber(worker, "function annotateSvgLayerIds");
  const hasComponentText = /connected|component|bbox|bounding|adjacency/i.test(worker.slice(functionStart > 0 ? worker.indexOf("function groupFlatColorLayeredPalette") : 0, worker.indexOf("function annotateSvgLayerIds")));

  return {
    files,
    groupedBeforeLayerRows: Boolean(postprocessLine && annotateLine && postprocessLine < annotateLine),
    groupingGate: {
      line: functionStart,
      limitedToLayeredFlatColor:
        /settings\.traceMode\s*===\s*"layered"/.test(worker) &&
        /settings\.presetId\s*===\s*FLAT_COLOR_GROUPING_PRESET_ID/.test(worker) &&
        /getLayerBuildMode\(settings\)\s*===\s*"per-color-cutout"/.test(worker),
    },
    representativeSelection: {
      line: representativeLine,
      deterministic: /sort\(compareFlatColorStatsByImportance\)\[0\]/.test(worker.slice(worker.indexOf("function chooseFlatColorRepresentative"))),
      selectsExistingSourceColor: /return\s+\[\.\.\.members\]\.sort\(compareFlatColorStatsByImportance\)\[0\]/.test(worker.slice(worker.indexOf("function chooseFlatColorRepresentative"))),
      usesWeightPathCountAndFirstIndex: /pathWeight/.test(worker) && /pathCount/.test(worker) && /firstIndex/.test(worker),
    },
    groupingBasis: {
      line: groupLine,
      usesCiede2000: /ciede2000/.test(worker),
      usesColorDistance: /perceptualDistance/.test(worker),
      usesAreaPathWeight: /pathWeight/.test(worker),
      tracksConnectedComponentsInGrouping: hasComponentText,
      tracksBoundingBoxesInGrouping: /\bbbox|bounding/i.test(worker.slice(worker.indexOf("function groupFlatColorLayeredPalette"), worker.indexOf("function annotateSvgLayerIds"))),
      tracksAdjacencyInGrouping: /adjacency|neighbor|contiguous/i.test(worker.slice(worker.indexOf("function groupFlatColorLayeredPalette"), worker.indexOf("function annotateSvgLayerIds"))),
      thresholdLine: lineNumber(worker, "function flatColorMergeThreshold"),
    },
    pathOwnership: {
      annotateLine,
      editingModelUsesLayerIds: /data-fill-layer-id/.test(contents.editingModel),
      editorAppliesByLayerIds: /data-fill-layer-id|data-stroke-layer-id/.test(contents.layerEditor),
      ownershipPreservedAfterGrouping: true,
      note: "Paths remain editable through post-group layer IDs, but the grouping decision is not spatially aware.",
    },
    likelyFailureMode: [
      "Spatially separate regions with similar colors can share one editable group.",
      "A high-weight or high-path-count region can choose the representative color for a smaller meaningful region.",
      "Near-black and near-white thresholds can be appropriate for logos but risky on complex card or photo-like art without region guards.",
    ],
  };
}

function summarizeResults(results, fixtures, sourceInspection) {
  const completed = results.filter((result) => result.ok && !result.skipped && result.analysis?.ok);
  const skipped = results.filter((result) => result.skipped);
  const failed = results.filter((result) => !result.ok);
  const requiredFailures = failed.filter((result) => presetDefinitions[result.presetId]?.required);
  const flatColorCompleted = completed.filter((result) => result.presetId === "layered-flat-color");
  const routesCovered = unique(flatColorCompleted.map((result) => result.route));
  const highRiskScenarioIds = completed
    .filter((result) => result.analysis?.risk?.level === "high")
    .map((result) => result.id);
  const mediumRiskScenarioIds = completed
    .filter((result) => result.analysis?.risk?.level === "medium")
    .map((result) => result.id);
  const exactCardAvailable = fixtures.inputs.some((fixture) => fixture.role === "trading-card-candidate");
  const wrongRegionReproduced = exactCardAvailable && completed.some((result) => result.analysis?.risk?.level === "high");
  const wrongRegionRiskObserved = completed.some((result) => ["high", "medium"].includes(result.analysis?.risk?.level));
  const flatColorRows = flatColorCompleted.map((result) => ({
    id: result.id,
    route: result.route,
    fixture: result.fixture.basename,
    groupedColorCount: result.analysis.groupedColorCount,
    exposedLayerCount: result.snapshot.ui.exposedLayerCount,
    pathCount: result.analysis.pathCount,
    svgBytes: result.svgBytes,
    riskLevel: result.analysis.risk.level,
  }));

  return {
    ok: routesCovered.includes("/") &&
      routesCovered.includes("/png-to-layered-svg-for-cricut") &&
      routesCovered.includes("/jpg-to-layered-svg-for-cricut") &&
      requiredFailures.length === 0,
    completedScenarioCount: completed.length,
    skippedScenarioCount: skipped.length,
    failedScenarioCount: failed.length,
    requiredFailedScenarioCount: requiredFailures.length,
    flatColorRouteCoverage: routesCovered,
    flatColorRows,
    highRiskScenarioIds,
    mediumRiskScenarioIds,
    exactTradingCardFixtureAvailable: exactCardAvailable,
    exactTradingCardFixtureUnavailableReason: fixtures.unavailable.find((item) => /trading-card|fish|Magikarp/i.test(item.requested))?.reason || null,
    wrongRegionBehaviorReproduced: wrongRegionReproduced,
    wrongRegionRiskObserved,
    currentGroupingIsSpatiallyAware: Boolean(sourceInspection.groupingBasis.tracksConnectedComponentsInGrouping || sourceInspection.groupingBasis.tracksBoundingBoxesInGrouping),
    recommendation:
      wrongRegionRiskObserved || !sourceInspection.groupingBasis.tracksConnectedComponentsInGrouping
        ? "Add region-aware grouping diagnostics and connected-component or bounding-box guards before broadening palette grouping."
        : "Current Flat Color grouping appears acceptable for tested fixtures, with continued route smoke coverage.",
  };
}

async function serverState() {
  const response = await fetch(baseUrl).catch((error) => {
    throw new Error(`Could not reach ${baseUrl}: ${error.message}`);
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Could not reach ${baseUrl}: HTTP ${response.status}`);
  return {
    reachable: true,
    status: response.status,
    title: body.match(/<title>([^<]+)/i)?.[1] || null,
    looksLikeIlovesvg: /iLoveSVG|Free SVG Converter|SVG Converter/i.test(body),
  };
}

async function gitState() {
  const run = async (args) => {
    try {
      const { stdout } = await execFile("git", ["-c", `safe.directory=${rootDir}`, ...args], {
        cwd: rootDir,
        windowsHide: true,
      });
      return stdout.trim();
    } catch (error) {
      return `ERROR: ${error.message}`;
    }
  };
  return {
    branch: await run(["branch", "--show-current"]),
    head: await run(["rev-parse", "HEAD"]),
    statusShort: await run(["status", "--short", "--branch"]),
  };
}

async function clickConvert(client) {
  const clicked = await clickButtonIfPresent(
    client,
    [/^Convert\b/i, /^Create\b/i, /^Build\b/i, /^Generate\b/i, /^Trace\b/i, /Layered SVG/i],
    [/Download/i, /Copy/i, /Settings/i, /ZIP/i],
  );
  if (clicked) return clicked;
  const routeBusy = await routeConversionBusy(client);
  if (routeBusy) return { clicked: false, reason: "conversion already running", routeBusy };
  const state = await outputState(client);
  if (state.activeJobs > 0) return { clicked: false, reason: "conversion already running", state };
  const buttons = await visibleButtonLabels(client).catch(() => []);
  throw new Error(`No enabled Convert/Create button found. Visible buttons: ${JSON.stringify(buttons.slice(0, 24))}`);
}

async function routeConversionBusy(client) {
  return evaluate(client, `(() => {
    return Array.from(document.querySelectorAll("button")).some((button) => {
      const text = button.innerText || button.textContent || "";
      return button.disabled && /\\b(Building|Converting|Running|Creating)\\b/i.test(text);
    });
  })()`);
}

async function waitForCompletedOutput(client, previousLatestStamp, timeoutMs) {
  return waitForValue(
    client,
    () => outputStateExpression(previousLatestStamp),
    timeoutMs,
    (state) => state?.pageAlive && state.latestReady && state.activeJobs === 0 && state.latestStamp !== null,
  );
}

async function settleInitialAutoConversion(client, timeoutMs) {
  const state = await outputState(client).catch(() => null);
  if (!state?.activeJobs) return { settled: true, reason: "idle" };
  const completed = await waitForCompletedOutput(client, state.latestStamp, timeoutMs);
  return { settled: true, reason: "waited for initial auto conversion", completed };
}

async function selectPreset(client, patterns) {
  await clickButtonIfPresent(client, [/All presets/i, /Show all presets/i, /More presets/i], []).catch(() => null);
  await delay(250);
  for (const pattern of patterns) {
    const clicked = await clickButtonIfPresent(client, [pattern], [/Show fewer/i, /Filter presets/i]).catch(() => null);
    if (clicked) {
      await delay(300);
      return { selected: clicked.label, pattern: String(pattern) };
    }
  }
  return { selected: null, reason: "No matching layered preset button was visible." };
}

async function openLatestSettingsPanel(client) {
  const clicked = await clickButtonInLatestOutput(client, [/Settings\s*\/\s*Edit/i, /\bSettings\b/i], [/Download/i, /Copy/i]);
  if (!clicked) return { open: false, reason: "settings control not found" };
  return waitForValue(
    client,
    () => `(() => {
      const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
      if (!latest) return { open: false, reason: "no latest output" };
      const text = latest.innerText || "";
      const controls = latest.querySelectorAll('input[aria-label$=" hex color"], [data-post-processing-controls="true"], [data-settings-section]');
      return {
        open: controls.length > 0 || /Advanced settings|Layer colors|Output polish/i.test(text),
        controls: controls.length,
        text: text.replace(/\\s+/g, " ").slice(0, 300),
      };
      ${browserLatestCardHelpers()}
    })()`,
    10_000,
    (value) => value?.open,
  );
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
  if (!result?.ok) return result;
  await delay(300);
  return result;
}

async function outputState(client) {
  return evaluate(client, outputStateExpression(null), 8_000);
}

function outputStateExpression(previousLatestStamp) {
  return `(() => {
    const cards = Array.from(document.querySelectorAll("[data-output-stamp]"));
    const latest = latestCard(cards);
    const latestStamp = latest ? numberOrNull(latest.getAttribute("data-output-stamp")) : null;
    const activeJobs = cards.filter(isActiveCard).length;
    const latestReady = Boolean(latest) &&
      !isActiveCard(latest) &&
      /Settings\\s*\\/\\s*Edit|Download|Copy/i.test(latest.innerText || "") &&
      !/Conversion failed|Canceled/i.test(latest.innerText || "");
    return {
      pageAlive: true,
      outputCards: cards.length,
      activeJobs,
      latestStamp,
      latestReady,
      latestChanged: ${previousLatestStamp == null ? "true" : `latestStamp !== ${JSON.stringify(previousLatestStamp)}`},
      latestText: latest ? (latest.innerText || "").replace(/\\s+/g, " ").slice(0, 700) : "",
      latestJobStatus: latest ? latest.getAttribute("data-job-status") || null : null,
      latestSvgBytes: latest ? numberOrNull(latest.getAttribute("data-svg-bytes")) : null,
      latestPathCount: latest ? numberOrNull(latest.getAttribute("data-path-count")) : null,
    };
    function isActiveCard(card) {
      return /queued|running/i.test(card.getAttribute("data-job-status") || "") ||
        /\\b(Queued|Running|Converting|Creating|Building)\\b/i.test(card.innerText || "");
    }
    ${browserLatestCardHelpers()}
  })()`;
}

async function setFileInput(client, filePath) {
  await waitForValue(
    client,
    () => `(() => Boolean(document.querySelector('input[type="file"]')))()`,
    12_000,
    Boolean,
  );
  const expectedName = path.basename(filePath);
  let lastError = null;
  try {
    await setFileInputViaChooser(client, filePath);
    const accepted = await waitForUploadAccepted(client, expectedName, 25_000).catch(() => null);
    if (accepted) return;
  } catch (error) {
    lastError = error;
  }
  try {
    const nodeId = await queryFileInputNodeId(client, 'label input[type="file"], input[type="file"]');
    await client.send("DOM.setFileInputFiles", { nodeId, files: [filePath] }, 8_000);
    await dispatchFileInputChange(client);
    const accepted = await waitForUploadAccepted(client, expectedName, 20_000).catch(() => null);
    if (accepted) return;
  } catch (error) {
    lastError = error;
  }
  await setFileInputFromBuffer(client, filePath);
  const accepted = await waitForUploadAccepted(client, expectedName, 20_000).catch(() => null);
  if (!accepted) throw lastError || new Error(`File upload did not appear in page state for ${expectedName}.`);
}

async function setFileInputViaChooser(client, filePath) {
  await client.send("Page.enable").catch(() => {});
  await client.send("Page.setInterceptFileChooserDialog", { enabled: true }).catch(() => {});
  try {
    const chooserPromise = waitForEvent(client, "Page.fileChooserOpened", 5_000);
    const target = await evaluate(client, `(() => {
      const input = document.querySelector('label input[type="file"], input[type="file"]');
      if (!input) return null;
      input.scrollIntoView({ block: "center", inline: "nearest" });
      const rect = input.getBoundingClientRect();
      return {
        x: Math.max(1, Math.min(window.innerWidth - 2, rect.left + rect.width / 2)),
        y: Math.max(1, Math.min(window.innerHeight - 2, rect.top + rect.height / 2)),
      };
    })()`, 6_000);
    if (!target) throw new Error("No file input found.");
    await trustedClickAtPoint(client, target);
    const event = await chooserPromise;
    const backendNodeId = event.params?.backendNodeId;
    if (!backendNodeId) throw new Error("File chooser opened without a backend node id.");
    await client.send("DOM.setFileInputFiles", { backendNodeId, files: [filePath] }, 8_000);
  } finally {
    await client.send("Page.setInterceptFileChooserDialog", { enabled: false }).catch(() => {});
  }
}

async function setFileInputFromBuffer(client, filePath) {
  const file = {
    name: path.basename(filePath),
    type: mimeTypeForPath(filePath),
    base64: (await fs.readFile(filePath)).toString("base64"),
  };
  const applied = await evaluate(client, `(() => {
    const input = document.querySelector('input[type="file"]');
    if (!input) return { ok: false, reason: "missing input" };
    const binary = atob(${JSON.stringify(file.base64)});
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([bytes], ${JSON.stringify(file.name)}, { type: ${JSON.stringify(file.type)} }));
    input.files = dataTransfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  })()`, 12_000);
  if (!applied?.ok) {
    throw new Error(`Could not set file through browser DataTransfer: ${applied?.reason || "unknown"}`);
  }
}

async function waitForUploadAccepted(client, filename, timeoutMs) {
  return waitForValue(
    client,
    () => `(() => {
      const body = document.body?.innerText || "";
      const buttons = Array.from(document.querySelectorAll("button"));
      const enabledConvert = buttons.some((button) => {
        const text = button.innerText || button.textContent || "";
        return !button.disabled && /^\\s*(Convert|Create)\\b/i.test(text);
      });
      const routeBusy = buttons.some((button) => {
        const text = button.innerText || button.textContent || "";
        return button.disabled && /\\b(Building|Converting|Running|Creating)\\b/i.test(text);
      });
      const outputCards = document.querySelectorAll("[data-output-stamp]").length;
      return {
        bodyHasName: body.includes(${JSON.stringify(filename)}),
        enabledConvert,
        routeBusy,
        outputCards,
      };
    })()`,
    timeoutMs,
    (value) => value?.bodyHasName && (value?.enabledConvert || value?.routeBusy || value?.outputCards > 0),
  );
}

async function queryFileInputNodeId(client, selector) {
  const { root } = await client.send("DOM.getDocument", { depth: -1, pierce: true }, 8_000);
  const { nodeId } = await client.send("DOM.querySelector", { nodeId: root.nodeId, selector }, 8_000);
  if (!nodeId) throw new Error("No file input found.");
  return nodeId;
}

async function dispatchFileInputChange(client) {
  await evaluate(client, `(() => {
    const input = document.querySelector('input[type="file"]');
    if (!input) return false;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`, 6_000);
}

async function installCopyDownloadCapture(client) {
  return evaluate(client, `(() => {
    const state = window.__COLOR_REGION_FIDELITY__ || {};
    state.clipboardWrites = Array.isArray(state.clipboardWrites) ? state.clipboardWrites : [];
    state.downloadedSvgBlobs = Array.isArray(state.downloadedSvgBlobs) ? state.downloadedSvgBlobs : [];
    window.__COLOR_REGION_FIDELITY__ = state;
    const capture = async (text) => {
      window.__COLOR_REGION_FIDELITY__.clipboardWrites.push(String(text || ""));
      return undefined;
    };
    try {
      if (!navigator.clipboard) {
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: capture } });
      } else {
        navigator.clipboard.writeText = capture;
      }
    } catch {
      try { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: capture } }); } catch {}
    }
    if (!URL.__colorRegionFidelityCreateObjectUrl) {
      URL.__colorRegionFidelityCreateObjectUrl = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        try {
          if (blob && /image\\/svg\\+xml/i.test(String(blob.type || "")) && typeof blob.text === "function") {
            blob.text().then((text) => {
              window.__COLOR_REGION_FIDELITY__.downloadedSvgBlobs.push(String(text || ""));
            }).catch(() => {});
          }
        } catch {}
        return URL.__colorRegionFidelityCreateObjectUrl(blob);
      };
    }
    return true;
  })()`, 8_000);
}

async function verifyCopyDownloadParity(client, expectedSvg) {
  const expectedHash = hashString(expectedSvg);
  const expectedBytes = Buffer.byteLength(expectedSvg);
  const before = await getCopyDownloadCapture(client);
  const copyClick = await clickButtonInLatestOutput(client, [/Copy SVG/i, /^Copy$/i], [/Copied/i]);
  if (!copyClick) throw new Error("Copy SVG control not found.");
  const copied = await waitForValue(
    client,
    () => copyDownloadCaptureExpression(expectedHash, expectedBytes),
    8_000,
    (value) => value?.clipboardCount > before.clipboardCount,
  );
  const downloadClick = await clickButtonInLatestOutput(client, [/Download SVG/i, /^Download\b/i], [/ZIP/i]);
  if (!downloadClick) throw new Error("Download SVG control not found.");
  const downloaded = await waitForValue(
    client,
    () => copyDownloadCaptureExpression(expectedHash, expectedBytes),
    8_000,
    (value) => value?.downloadCount > before.downloadCount,
  );
  return {
    attempted: true,
    applicable: true,
    ok: copied.copyMatchedPreview && downloaded.downloadMatchedPreview,
    expectedHash,
    expectedBytes,
    copyClick,
    downloadClick,
    copyHash: copied.latestClipboardHash,
    copyBytes: copied.latestClipboardBytes,
    downloadHash: downloaded.latestDownloadHash,
    downloadBytes: downloaded.latestDownloadBytes,
    copyMatchedPreview: copied.copyMatchedPreview,
    downloadMatchedPreview: downloaded.downloadMatchedPreview,
  };
}

async function getCopyDownloadCapture(client) {
  return evaluate(client, copyDownloadCaptureExpression("", 0), 8_000);
}

function copyDownloadCaptureExpression(expectedHash, expectedBytes) {
  return `(() => {
    const state = window.__COLOR_REGION_FIDELITY__ || {};
    const clipboardWrites = state.clipboardWrites || [];
    const downloadedSvgBlobs = state.downloadedSvgBlobs || [];
    const latestClipboard = clipboardWrites[clipboardWrites.length - 1] || "";
    const latestDownload = downloadedSvgBlobs[downloadedSvgBlobs.length - 1] || "";
    const latestClipboardHash = latestClipboard ? hashString(latestClipboard) : null;
    const latestDownloadHash = latestDownload ? hashString(latestDownload) : null;
    const latestClipboardBytes = latestClipboard ? new Blob([latestClipboard]).size : 0;
    const latestDownloadBytes = latestDownload ? new Blob([latestDownload]).size : 0;
    return {
      clipboardCount: clipboardWrites.length,
      downloadCount: downloadedSvgBlobs.length,
      latestClipboardHash,
      latestDownloadHash,
      latestClipboardBytes,
      latestDownloadBytes,
      copyMatchedPreview: latestClipboardHash === ${JSON.stringify(expectedHash)} && latestClipboardBytes === ${JSON.stringify(expectedBytes)},
      downloadMatchedPreview: latestDownloadHash === ${JSON.stringify(expectedHash)} && latestDownloadBytes === ${JSON.stringify(expectedBytes)},
    };
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

async function resetScenarioBrowserState(client) {
  await evaluate(client, `(() => {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    return true;
  })()`, 8_000);
  await client.send("Page.reload", { ignoreCache: true }).catch(async () => {
    await evaluate(client, `(() => { location.reload(); return true; })()`, 8_000);
  });
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

async function visibleButtonLabels(client) {
  return evaluate(client, `(() => Array.from(document.querySelectorAll("button, [role='button'], summary"))
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    })
    .map((element) => ({
      text: (element.innerText || element.textContent || element.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim(),
      disabled: Boolean(element.disabled),
    }))
    .filter((item) => item.text))()`, 8_000);
}

async function trustedClickAtPoint(client, point) {
  await client.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y, button: "none" }, 6_000);
  await client.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 }, 6_000);
  await client.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 }, 6_000);
}

async function enablePage(client) {
  await client.send("Runtime.enable").catch(() => {});
  await client.send("Log.enable").catch(() => {});
  await client.send("Page.enable").catch(() => {});
  await client.send("DOM.enable").catch(() => {});
  await client.send("Performance.enable").catch(() => {});
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false,
  }).catch(() => {});
}

async function waitForDocumentReady(client) {
  await waitForValue(
    client,
    () => `(() => ({ href: location.href, readyState: document.readyState }))()`,
    30_000,
    (state) => state?.readyState === "interactive" || state?.readyState === "complete",
  );
}

async function waitForValue(client, expressionFactory, timeoutMs, isReady = Boolean) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await evaluate(client, expressionFactory(), Math.min(15_000, Math.max(3_000, deadline - Date.now())));
    if (isReady(last)) return last;
    await delay(250);
  }
  throw new Error(`Timed out waiting for browser state. Last value: ${JSON.stringify(last)}`);
}

async function evaluate(client, expression, timeoutMs = 12_000) {
  const response = await client.send(
    "Runtime.evaluate",
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
    timeoutMs,
  );
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ||
        response.exceptionDetails.text ||
        "Runtime.evaluate failed",
    );
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
  await ensureTabAtUrl(client, url);
  return client;
}

async function ensureTabAtUrl(client, url) {
  const current = await evaluate(client, `(() => location.href)()`).catch(() => "");
  if (current !== url) {
    await client.send("Page.navigate", { url }).catch(async () => {
      await evaluate(client, `(() => { window.location.assign(${JSON.stringify(url)}); return true; })()`);
    });
  }
  await waitForValue(
    client,
    () => `(() => ({ href: location.href, readyState: document.readyState }))()`,
    30_000,
    (state) => state?.href === url && (state.readyState === "interactive" || state.readyState === "complete"),
  );
}

async function createCdpTarget(url) {
  const browserInfo = await cdpJson("/json/version");
  if (browserInfo.webSocketDebuggerUrl) {
    try {
      const browserWs = new WebSocket(browserInfo.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        browserWs.addEventListener("open", resolve, { once: true });
        browserWs.addEventListener("error", reject, { once: true });
      });
      const browserClient = new CdpClient(browserWs);
      const { targetId } = await browserClient.send("Target.createTarget", {
        url,
        newWindow: false,
        background: false,
      });
      await browserClient.close().catch(() => {});
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        const targets = await cdpJson("/json/list");
        const target = targets.find((candidate) => candidate.id === targetId);
        if (target?.webSocketDebuggerUrl) return target;
        await delay(150);
      }
    } catch {
      // Fall back to the legacy target endpoint.
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

  close() {
    return new Promise((resolve) => {
      this.ws.addEventListener("close", resolve, { once: true });
      this.ws.close();
      setTimeout(resolve, 500).unref?.();
    });
  }
}

async function waitForCdp() {
  const deadline = Date.now() + 15_000;
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

async function cdpJson(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${debugPort}${pathname}`, options);
  if (!response.ok) {
    throw new Error(`CDP request failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
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
  throw new Error("No Chromium-family browser executable found for browser diagnostics.");
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
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }
  `;
}

function readFill(attrs) {
  const attrFill = readAttr(attrs, "fill");
  if (attrFill) return attrFill;
  return readStyleValue(attrs, "fill") || "";
}

function readAttr(attrs, name) {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*["']([^"']+)["']`, "i");
  return String(attrs || "").match(pattern)?.[1] || "";
}

function readStyleValue(attrs, property) {
  const style = readAttr(attrs, "style");
  if (!style) return "";
  const match = style.match(new RegExp(`${escapeRegExp(property)}\\s*:\\s*([^;]+)`, "i"));
  return match?.[1]?.trim() || "";
}

function removeRanges(text, ranges) {
  if (!ranges.length) return text;
  let result = "";
  let cursor = 0;
  for (const [start, end] of ranges.sort((a, b) => a[0] - b[0])) {
    result += text.slice(cursor, start);
    cursor = Math.max(cursor, end);
  }
  return result + text.slice(cursor);
}

function normalizeHex(value) {
  const text = String(value || "").trim().toLowerCase();
  const match = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!match) return "";
  const hex = match[1].toLowerCase();
  if (hex.length === 3) return "#" + hex.split("").map((char) => char + char).join("");
  return "#" + hex.slice(0, 6);
}

function hexToRgb(color) {
  const hex = normalizeHex(color);
  if (!hex) return null;
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex(rgb) {
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function toHex(value) {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

function rgbDistance(a, b) {
  return Math.hypot((a.r || 0) - (b.r || 0), (a.g || 0) - (b.g || 0), (a.b || 0) - (b.b || 0));
}

function colorFamily(rgb) {
  if (!rgb) return "unknown";
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (luma < 35) return "near-black";
  if (luma > 230 && delta < 28) return "near-white";
  if (delta < 18) return luma > 145 ? "silver-gray" : "gray";
  const hue = rgbHue(r, g, b);
  if (hue < 18 || hue >= 340) return "red";
  if (hue < 45) return "orange";
  if (hue < 72) return "yellow";
  if (hue < 165) return "green";
  if (hue < 205) return "cyan";
  if (hue < 260) return "blue";
  if (hue < 306) return "purple";
  return "magenta";
}

function rgbHue(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue;
  if (max === rn) hue = ((gn - bn) / delta) % 6;
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;
  return (hue * 60 + 360) % 360;
}

function compatibleFamilies(left, right) {
  if (left === right) return true;
  const pairs = new Set([
    "gray|silver-gray",
    "near-white|silver-gray",
    "near-black|gray",
    "cyan|blue",
    "red|orange",
    "purple|magenta",
  ]);
  return pairs.has(`${left}|${right}`) || pairs.has(`${right}|${left}`);
}

function mergeBboxes(bboxes) {
  if (!bboxes.length) return null;
  return {
    minX: Math.min(...bboxes.map((bbox) => bbox.minX)),
    minY: Math.min(...bboxes.map((bbox) => bbox.minY)),
    maxX: Math.max(...bboxes.map((bbox) => bbox.maxX)),
    maxY: Math.max(...bboxes.map((bbox) => bbox.maxY)),
  };
}

function bboxArea(bbox) {
  return Math.max(0, bbox.maxX - bbox.minX) * Math.max(0, bbox.maxY - bbox.minY);
}

function centroidSpread(centroids) {
  let max = 0;
  for (let i = 0; i < centroids.length; i += 1) {
    for (let j = i + 1; j < centroids.length; j += 1) {
      max = Math.max(max, Math.hypot(centroids[i].x - centroids[j].x, centroids[i].y - centroids[j].y));
    }
  }
  return max;
}

function countQuadrants(centroids, viewBox) {
  const midX = viewBox.minX + viewBox.width / 2;
  const midY = viewBox.minY + viewBox.height / 2;
  return new Set(
    centroids.map((point) => `${point.x >= midX ? "r" : "l"}${point.y >= midY ? "b" : "t"}`),
  ).size;
}

function roundBbox(bbox) {
  return {
    minX: round(bbox.minX),
    minY: round(bbox.minY),
    maxX: round(bbox.maxX),
    maxY: round(bbox.maxY),
  };
}

function lineNumber(content, needle) {
  const index = content.indexOf(needle);
  if (index < 0) return null;
  return content.slice(0, index).split(/\r?\n/).length;
}

function buildSimpleLogoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#f8fafc"/><circle cx="256" cy="254" r="190" fill="#dbeafe"/><path d="M118 304 C156 180 236 118 320 136 C414 156 440 268 374 350 C306 434 168 416 118 304 Z" fill="#2563eb"/><path d="M172 286 C198 224 246 196 302 204 C358 212 388 254 380 302 C370 370 260 388 202 342 C178 324 166 306 172 286 Z" fill="#60a5fa"/><circle cx="318" cy="250" r="24" fill="#ffffff"/><circle cx="326" cy="252" r="11" fill="#111827"/><path d="M139 186 L70 154 L96 232 Z" fill="#ef4444"/><path d="M390 198 L448 152 L426 246 Z" fill="#22c55e"/><path d="M138 366 C190 422 315 436 386 366" fill="none" stroke="#111827" stroke-width="24" stroke-linecap="round"/></svg>`;
}

function mimeTypeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function withoutSvg(snapshot) {
  const { svg, ...rest } = snapshot;
  return {
    ...rest,
    svgHash: svg ? hashString(svg) : null,
    svgBytes: svg ? Buffer.byteLength(svg) : 0,
  };
}

function unique(items) {
  return Array.from(new Set(items));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function round(value) {
  return Math.round(Number(value || 0) * 1000) / 1000;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

async function pathExists(filePath) {
  return fs.access(filePath).then(() => true).catch(() => false);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForEvent(client, method, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${method}`));
    }, timeoutMs);
    const cleanup = client.onEvent((message) => {
      if (message.method !== method) return;
      clearTimeout(timer);
      cleanup();
      resolve(message);
    });
  });
}

await main().catch(async (error) => {
  const fatal = {
    schemaVersion: 1,
    auditKind: "color-region-fidelity-audit",
    baseUrl,
    checkedAt: new Date().toISOString(),
    fatal: error instanceof Error ? error.message : String(error),
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true }).catch(() => {});
  await fs.writeFile(reportPath, `${JSON.stringify(fatal, null, 2)}\n`).catch(() => {});
  console.error(JSON.stringify(fatal, null, 2));
  process.exit(1);
});
