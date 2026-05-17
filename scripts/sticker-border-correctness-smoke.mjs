import { spawn, execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  applyOutputAppearanceToSvg,
  detectOutputAppearanceSupport,
  normalizeOutputAppearance,
} from "../app/client/lib/converter/outputAppearance.ts";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const execFile = promisify(execFileCallback);

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = getSmokeBaseUrl();
const debugPort = Number(process.env.CDP_PORT || 11_200 + Math.floor(Math.random() * 500));
const tmpRunDir = path.join(os.tmpdir(), "ilovesvg-sticker-border", String(debugPort));
const profileDir = path.join(tmpRunDir, "profile");
const fixturesDir = path.join(rootDir, "tmp", "sticker-border-fixtures");
const reportPath = process.env.STICKER_BORDER_REPORT_PATH
  ? path.resolve(process.env.STICKER_BORDER_REPORT_PATH)
  : path.join(rootDir, "tmp", "sticker-border-correctness-report.json");
const userFixturePath =
  process.env.STICKER_BORDER_FIXTURE ||
  "C:\\Users\\Suhas\\Downloads\\charming-tomato-512x512.png";
const runBrowserScenarios = process.env.STICKER_BORDER_BROWSER !== "0";

const scenarios = [
  {
    id: "home-layered-flat-color",
    route: "/",
    fixtureKind: "png",
    presetPatterns: [/^Layered - Flat Color\b/i],
    presetLabel: "Layered - Flat Color",
    conversionTimeoutMs: 240_000,
  },
  {
    id: "png-layered-flat-color",
    route: "/png-to-layered-svg-for-cricut",
    fixtureKind: "png",
    presetPatterns: [/^Layered - Flat Color\b/i],
    presetLabel: "Layered - Flat Color",
    conversionTimeoutMs: 240_000,
  },
  {
    id: "image-layered-flat-color",
    route: "/image-to-layered-svg-for-cricut",
    fixtureKind: "png",
    presetPatterns: [/^Layered - Flat Color\b/i, /^Layered color SVG\b/i],
    presetLabel: "Layered - Flat Color or equivalent layered color preset",
    conversionTimeoutMs: 240_000,
  },
  {
    id: "logo-layered-flat-color",
    route: "/logo-to-layered-svg-converter",
    fixtureKind: "png",
    presetPatterns: [/^Layered - Flat Color\b/i, /^Layered color SVG\b/i],
    presetLabel: "Layered - Flat Color or equivalent layered color preset",
    conversionTimeoutMs: 240_000,
  },
].filter((scenario) => {
  const filter = process.env.STICKER_BORDER_ROUTE_FILTER || "";
  return !filter || filter === scenario.id || filter === scenario.route;
});

async function main() {
  await fs.rm(tmpRunDir, { recursive: true, force: true });
  await fs.mkdir(profileDir, { recursive: true });
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  const [server, git, fixture] = await Promise.all([
    serverState(),
    gitState(),
    prepareFixture(),
  ]);

  const model = runModelChecks();
  const browserResults = [];
  let browserSkippedReason = null;

  if (model.ok && runBrowserScenarios) {
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

    try {
      await waitForCdp();
      for (const scenario of scenarios) {
        console.error(`[sticker-border] ${scenario.id}`);
        const result = await runScenario(scenario, fixture).catch((error) => ({
          id: scenario.id,
          route: scenario.route,
          preset: scenario.presetLabel,
          fixture: fixture.png.info,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : null,
          steps: error?.steps || [],
        }));
        browserResults.push(result);
      }
    } finally {
      browser.kill();
      await fs.rm(tmpRunDir, { recursive: true, force: true }).catch(() => {});
    }
  } else if (!runBrowserScenarios) {
    browserSkippedReason = "STICKER_BORDER_BROWSER=0";
  } else {
    browserSkippedReason = "model checks failed";
  }

  const summary = summarizeResults(model, browserResults, browserSkippedReason);
  const ok = model.ok && browserResults.every((result) => result.ok) && !summary.failureCount;
  const report = {
    schemaVersion: 1,
    auditKind: "sticker-border-correctness",
    checkedAt: new Date().toISOString(),
    baseUrl,
    server,
    git,
    fixture,
    model,
    browser: {
      skipped: Boolean(browserSkippedReason),
      skipReason: browserSkippedReason,
      scenarios: browserResults,
    },
    summary,
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        ok,
        reportPath,
        modelOk: model.ok,
        browserScenarioCount: browserResults.length,
        summary,
      },
      null,
      2,
    ),
  );

  if (!ok) process.exitCode = 1;
}

function runModelChecks() {
  const checks = [];
  const pushCheck = (name, fn) => {
    try {
      checks.push({ name, ok: true, details: fn() || {} });
    } catch (error) {
      checks.push({
        name,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const simpleSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><defs><style>.keep{fill:#0f172a}</style></defs><path fill="#ffffff" d="M0 0H100V80H0Z"/><path id="subject" fill="#f97316" d="M20 20H70V60H20Z"/><path fill="#dc2626" d="M36 30H54V46H36Z"/></svg>';
  const alphaSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><clipPath id="source-alpha-boundary-clip" clipPathUnits="userSpaceOnUse"><path d="M24 18C50 0 84 22 78 58C74 86 35 93 18 68C4 48 8 28 24 18Z"/></clipPath></defs><g data-alpha-boundary-clip="true" clip-path="url(#source-alpha-boundary-clip)"><path id="full-canvas-base" data-fill-layer-id="layer-orange" fill="#f97316" d="M0 0H100V100H0Z"/><path id="internal-detail" data-fill-layer-id="layer-red" fill="#dc2626" d="M36 35H64V63H36Z"/></g></svg>';

  pushCheck("default sticker border renders behind artwork", () => {
    const settings = normalizeOutputAppearance({
      stickerBorderEnabled: true,
      stickerBorderWidth: 10,
      stickerBorderColor: "#ffffff",
    });
    const support = detectOutputAppearanceSupport(simpleSvg);
    const edited = applyOutputAppearanceToSvg(simpleSvg, settings, support, {
      idPrefix: "sticker-default",
    });
    const analysis = analyzeStickerSvg(edited, {
      expectedColor: "#ffffff",
      expectedWidth: 10,
      expectedOpacity: 1,
      requireBehind: true,
      sourceLabel: "simple SVG",
    });
    assert(settings.stickerBorderPlacement === "behind", "sticker border should default to behind artwork");
    assert(analysis.ok, analysis.failures.join("; "));
    return analysis;
  });

  pushCheck("alpha-clipped layered output uses outer source silhouette", () => {
    const settings = normalizeOutputAppearance({
      stickerBorderEnabled: true,
      stickerBorderWidth: 16,
      stickerBorderColor: "#ffffff",
      stickerBorderOpacity: 0.65,
    });
    const support = detectOutputAppearanceSupport(alphaSvg);
    const edited = applyOutputAppearanceToSvg(alphaSvg, settings, support, {
      idPrefix: "sticker-alpha",
    });
    const group = extractStickerGroup(edited);
    const analysis = analyzeStickerSvg(edited, {
      expectedColor: "#ffffff",
      expectedWidth: 16,
      expectedOpacity: 0.65,
      requireBehind: true,
      sourceLabel: "alpha-clipped layered SVG",
    });
    assert(analysis.ok, analysis.failures.join("; "));
    assert(
      group.includes("source-alpha-boundary") || group.includes("data-sticker-border-source=\"alpha-boundary\""),
      "sticker border should identify or derive from the source alpha boundary",
    );
    assert(!group.includes("id=\"internal-detail\""), "sticker border should not clone internal detail IDs");
    assert(
      !/M36 35H64V63H36Z/.test(group),
      "sticker border should not use internal detail geometry when an alpha boundary is available",
    );
    assert(
      !/M0 0H100V100H0Z/.test(group),
      "sticker border should not use full-canvas base geometry",
    );
    return analysis;
  });

  pushCheck("explicit top placement remains bounded and non-duplicated", () => {
    const settings = normalizeOutputAppearance({
      stickerBorderEnabled: true,
      stickerBorderWidth: 8,
      stickerBorderColor: "#ff00aa",
      stickerBorderPlacement: "top",
    });
    const support = detectOutputAppearanceSupport(simpleSvg);
    const edited = applyOutputAppearanceToSvg(simpleSvg, settings, support, {
      idPrefix: "sticker-top",
    });
    const analysis = analyzeStickerSvg(edited, {
      expectedColor: "#ff00aa",
      expectedWidth: 8,
      expectedOpacity: 1,
      requireBehind: false,
      sourceLabel: "explicit top SVG",
    });
    assert(analysis.ok, analysis.failures.join("; "));
    assert(analysis.stickerGroupCount === 1, "sticker border should be emitted once");
    return analysis;
  });

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

async function runScenario(scenario, fixture) {
  const file = fixture.png;
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

  const client = await step("open tab", () => openTab(`${baseUrl}${scenario.route}`));
  try {
    await step("enable page", () => enablePage(client));
    await step("reset browser state", () => resetScenarioBrowserState(client));
    await step("wait for document ready", () => waitForDocumentReady(client));
    await step("install copy/download capture", () => installCopyDownloadCapture(client));
    await step("set file input", () => setFileInput(client, file.path));
    await step("settle initial auto conversion", () =>
      settleInitialAutoConversion(client, 20_000).catch(() => null),
    );
    const beforePresetState = await step("read state before preset", () =>
      outputState(client).catch(() => ({ latestStamp: null })),
    );
    const selectedPreset = await step("select preset", () =>
      selectPreset(client, scenario.presetPatterns),
    );
    const beforeConvertState = await step("read state before convert", () =>
      outputState(client).catch(() => beforePresetState),
    );
    await step("click convert", () => clickConvert(client));
    const completed = await step("wait for completed output", () =>
      waitForCompletedOutput(
        client,
        beforeConvertState.latestStamp ?? beforePresetState.latestStamp,
        scenario.conversionTimeoutMs,
      ),
    );

    const baselineSvg = await step("decode baseline SVG", () => decodeLatestSvg(client));
    const baselineBoundary = await step("verify baseline transparency", () =>
      analyzeRenderedBoundary(baselineSvg, file.path, "baseline"),
    );
    await step("open latest settings panel", () => openLatestSettingsPanel(client));
    await step("open post-processing", () =>
      ensureSettingsSectionOpen(client, /Post-processing/i, "post-processing"),
    );
    const stickerUi = await step("enable sticker border and edit controls", () =>
      enableStickerBorderControls(client, {
        color: "#ffffff",
        thickness: 24,
        opacity: 0.65,
      }),
    );
    await delay(900);
    const stickerSvg = await step("decode sticker SVG", () => decodeLatestSvg(client));
    const stickerAnalysis = analyzeStickerSvg(stickerSvg, {
      expectedColor: "#ffffff",
      expectedWidth: 24,
      expectedOpacity: 0.65,
      requireBehind: true,
      sourceLabel: scenario.id,
    });
    const stickerBoundary = await step("verify sticker transparency", () =>
      analyzeRenderedBoundary(stickerSvg, file.path, "sticker-border"),
    );
    const stickerParity = await step("verify sticker copy/download", () =>
      verifyCopyDownloadParity(client, stickerSvg),
    );

    const changed = await step("change sticker border without stacking", () =>
      enableStickerBorderControls(client, {
        color: "#00aaff",
        thickness: 36,
        opacity: 0.4,
      }),
    );
    await delay(900);
    const changedSvg = await step("decode changed sticker SVG", () => decodeLatestSvg(client));
    const changedAnalysis = analyzeStickerSvg(changedSvg, {
      expectedColor: "#00aaff",
      expectedWidth: 36,
      expectedOpacity: 0.4,
      requireBehind: true,
      sourceLabel: `${scenario.id} changed`,
    });

    const reset = await step("reset sticker border", () => resetStickerBorder(client));
    await delay(700);
    const resetSvg = await step("decode reset SVG", () => decodeLatestSvg(client));
    const resetAnalysis = {
      hasStickerBorder: /data-post-processing\s*=\s*["']sticker-border["']/i.test(resetSvg),
    };

    const failures = [
      ...baselineBoundary.failures,
      ...stickerAnalysis.failures,
      ...stickerBoundary.failures,
      ...changedAnalysis.failures,
    ];
    if (!stickerParity.copyMatchedPreview || !stickerParity.downloadMatchedPreview) {
      failures.push("Copy/download output did not match sticker-border preview.");
    }
    if (changedAnalysis.stickerGroupCount !== 1) {
      failures.push(`Expected one sticker border after repeated edits, found ${changedAnalysis.stickerGroupCount}.`);
    }
    if (resetAnalysis.hasStickerBorder) {
      failures.push("Reset did not remove the sticker border.");
    }

    return {
      id: scenario.id,
      route: scenario.route,
      preset: scenario.presetLabel,
      selectedPreset,
      fixture: file.info,
      conversion: completed,
      ui: { initial: stickerUi, changed, reset },
      boundary: { baseline: baselineBoundary, sticker: stickerBoundary },
      sticker: {
        initial: stickerAnalysis,
        changed: changedAnalysis,
        reset: resetAnalysis,
        copyDownloadParity: stickerParity,
      },
      ok: failures.length === 0,
      failures,
      steps,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

function analyzeStickerSvg(svg, options) {
  const failures = [];
  const source = String(svg || "");
  const stickerGroup = extractStickerGroup(source);
  const stickerGroupCount = (source.match(/data-post-processing\s*=\s*["']sticker-border["']/gi) || []).length;
  const firstArtworkIndex = findFirstArtworkIndex(source);
  const stickerIndex = source.indexOf('data-post-processing="sticker-border"');
  const viewport = readSvgViewport(source);
  const fullCanvasShapes = collectFullCanvasShapes(stickerGroup, viewport);
  const expectedColor = String(options.expectedColor || "").toLowerCase();
  const expectedOpacity = Number(options.expectedOpacity ?? 1);
  const expectedWidth = Number(options.expectedWidth ?? 0);

  if (!stickerGroup) failures.push(`${options.sourceLabel}: sticker border group was not emitted.`);
  if (stickerGroupCount !== 1) {
    failures.push(`${options.sourceLabel}: expected one sticker border group, found ${stickerGroupCount}.`);
  }
  if (options.requireBehind && !(stickerIndex >= 0 && firstArtworkIndex >= 0 && stickerIndex < firstArtworkIndex)) {
    failures.push(`${options.sourceLabel}: sticker border did not render behind the original artwork.`);
  }
  if (expectedColor && !stickerGroup.toLowerCase().includes(expectedColor)) {
    failures.push(`${options.sourceLabel}: sticker border did not include requested color ${expectedColor}.`);
  }
  if (expectedWidth > 0 && !stickerGroup.includes(formatExpectedNumber(expectedWidth))) {
    failures.push(`${options.sourceLabel}: sticker border did not include requested thickness ${expectedWidth}.`);
  }
  if (
    expectedOpacity < 0.999 &&
    !stickerGroup.includes(formatExpectedNumber(expectedOpacity))
  ) {
    failures.push(`${options.sourceLabel}: sticker border did not include requested opacity ${expectedOpacity}.`);
  }
  if (fullCanvasShapes.length) {
    failures.push(
      `${options.sourceLabel}: sticker border includes full-canvas geometry: ${fullCanvasShapes
        .slice(0, 4)
        .map((shape) => `${shape.tag}:${shape.coverage.toFixed(3)}`)
        .join(", ")}`,
    );
  }

  return {
    ok: failures.length === 0,
    failures,
    stickerGroupCount,
    stickerBeforeArtwork: stickerIndex >= 0 && firstArtworkIndex >= 0 && stickerIndex < firstArtworkIndex,
    hasFilter: /\bfilter\s*=\s*["']url\(#/i.test(stickerGroup),
    hasMorphology: /<feMorphology\b/i.test(stickerGroup) || /<feMorphology\b/i.test(source),
    fullCanvasShapeCount: fullCanvasShapes.length,
    firstArtworkIndex,
    stickerIndex,
    stickerGroupBytes: Buffer.byteLength(stickerGroup),
  };
}

function extractStickerGroup(svg) {
  const source = String(svg || "");
  const markerMatch = /data-post-processing\s*=\s*["']sticker-border["']/i.exec(source);
  if (!markerMatch?.index) return "";
  const groupStart = source.lastIndexOf("<g", markerMatch.index);
  if (groupStart < 0) return "";
  const groupEnd = findMatchingGroupEnd(source, groupStart);
  return groupEnd > groupStart ? source.slice(groupStart, groupEnd) : "";
}

function findMatchingGroupEnd(source, groupStart) {
  const tagPattern = /<\/?g\b[^>]*>/gi;
  tagPattern.lastIndex = groupStart;
  let depth = 0;
  let match;
  while ((match = tagPattern.exec(source))) {
    const tag = match[0];
    if (/^<g\b/i.test(tag) && !/\/>$/.test(tag)) depth += 1;
    else if (/^<\/g\b/i.test(tag)) {
      depth -= 1;
      if (depth === 0) return tagPattern.lastIndex;
    }
  }
  return -1;
}

function findFirstArtworkIndex(svg) {
  const source = String(svg || "");
  const svgOpenEnd = source.indexOf(">");
  const searchStart = svgOpenEnd >= 0 ? findInsertPositionAfterSvgDefs(source, svgOpenEnd + 1) : 0;
  const elementPattern = /<(path|polygon|rect|circle|ellipse|g)\b([^>]*)>/gi;
  elementPattern.lastIndex = searchStart;
  let match;
  while ((match = elementPattern.exec(source))) {
    const attrs = match[2] || "";
    if (/data-post-processing\s*=/.test(attrs)) continue;
    if (/data-sticker-border-source\s*=/.test(attrs)) continue;
    if (/data-role\s*=\s*["']cut-outline["']/i.test(attrs)) continue;
    return match.index;
  }
  return -1;
}

function findInsertPositionAfterSvgDefs(source, afterSvgOpen) {
  const rest = source.slice(afterSvgOpen);
  const defsMatch = rest.match(/^\s*<defs\b[\s\S]*?<\/defs>/i);
  return defsMatch ? afterSvgOpen + defsMatch[0].length : afterSvgOpen;
}

function collectFullCanvasShapes(svg, viewport) {
  if (!viewport) return [];
  const shapes = [];
  const pattern = /<(path|rect|polygon)\b([^>]*)>/gi;
  let match;
  while ((match = pattern.exec(String(svg || "")))) {
    const tag = match[1].toLowerCase();
    const attrs = parseAttributes(match[2] || "");
    const bounds =
      tag === "path"
        ? measurePathBounds(attrs.d || "")
        : tag === "rect"
          ? rectBounds(attrs)
          : polygonBounds(attrs.points || "");
    if (!bounds) continue;
    const coverage = boundsCoverage(bounds, viewport);
    if (coverage < 0.96) continue;
    if (tag === "path" && !isSimpleFullCanvasPath(attrs.d || "", viewport)) continue;
    shapes.push({ tag, coverage, bounds });
  }
  return shapes;
}

function isSimpleFullCanvasPath(d, viewport) {
  const commands = (String(d || "").match(/[a-z]/gi) || []).join("").toUpperCase();
  if (!/^(?:MHVHZ|MLLLZ)$/.test(commands)) return false;
  const bounds = measurePathBounds(d);
  if (!bounds) return false;
  const tolerance = Math.max(1, Math.max(viewport.width, viewport.height) * 0.01);
  return (
    Math.abs(bounds.minX - viewport.x) <= tolerance &&
    Math.abs(bounds.minY - viewport.y) <= tolerance &&
    Math.abs(bounds.maxX - (viewport.x + viewport.width)) <= tolerance &&
    Math.abs(bounds.maxY - (viewport.y + viewport.height)) <= tolerance
  );
}

function readSvgViewport(svg) {
  const open = String(svg || "").match(/<svg\b([^>]*)>/i)?.[1] || "";
  const viewBox = parseNumberList(readAttribute(open, "viewBox") || "");
  if (viewBox.length >= 4 && viewBox[2] > 0 && viewBox[3] > 0) {
    return { x: viewBox[0], y: viewBox[1], width: viewBox[2], height: viewBox[3] };
  }
  const width = parseFloat(readAttribute(open, "width") || "");
  const height = parseFloat(readAttribute(open, "height") || "");
  return width > 0 && height > 0 ? { x: 0, y: 0, width, height } : null;
}

function parseNumberList(value) {
  return [...String(value || "").matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map((match) =>
    Number(match[0]),
  );
}

function parseAttributes(attrs) {
  const parsed = {};
  for (const match of String(attrs || "").matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) {
    parsed[match[1]] = match[3];
  }
  return parsed;
}

function readAttribute(attrs, attribute) {
  return String(attrs || "").match(
    new RegExp(`\\s${escapeRegExp(attribute)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"),
  )?.[2] || null;
}

function rectBounds(attrs) {
  const x = Number(attrs.x || 0);
  const y = Number(attrs.y || 0);
  const width = Number(attrs.width || 0);
  const height = Number(attrs.height || 0);
  return width > 0 && height > 0 ? { minX: x, minY: y, maxX: x + width, maxY: y + height } : null;
}

function polygonBounds(points) {
  const numbers = parseNumberList(points);
  if (numbers.length < 6 || numbers.length % 2 !== 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < numbers.length; index += 2) {
    minX = Math.min(minX, numbers[index]);
    maxX = Math.max(maxX, numbers[index]);
    minY = Math.min(minY, numbers[index + 1]);
    maxY = Math.max(maxY, numbers[index + 1]);
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

function measurePathBounds(d) {
  const numbers = parseNumberList(d);
  if (numbers.length < 2) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < numbers.length - 1; index += 2) {
    const x = numbers[index];
    const y = numbers[index + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

function boundsCoverage(bounds, viewport) {
  const width = Math.max(0, bounds.maxX - bounds.minX);
  const height = Math.max(0, bounds.maxY - bounds.minY);
  const area = width * height;
  const viewportArea = Math.max(1, viewport.width * viewport.height);
  return area / viewportArea;
}

async function analyzeRenderedBoundary(svg, sourcePngPath, label) {
  const rendered = await renderSvgAlpha(svg);
  const sourceMask = await renderSourceAlphaMask(sourcePngPath, rendered.width, rendered.height);
  const allowedMask = dilateMask(
    sourceMask.mask,
    rendered.width,
    rendered.height,
    Math.max(8, Math.round(Math.max(rendered.width, rendered.height) * 0.08)),
  );
  let visible = 0;
  let outside = 0;
  for (let index = 0; index < rendered.alpha.length; index += 1) {
    if (rendered.alpha[index] <= 12) continue;
    visible += 1;
    if (!allowedMask[index]) outside += 1;
  }
  const outsideLimit = Math.max(120, Math.round(Math.max(visible, 1) * 0.025));
  const failures = [];
  if (visible < 100) failures.push(`${label}: SVG output has no meaningful visible artwork.`);
  if (outside > outsideLimit) {
    failures.push(`${label}: ${outside} rendered pixel(s) fell outside the sticker silhouette tolerance.`);
  }
  return {
    ok: failures.length === 0,
    failures,
    width: rendered.width,
    height: rendered.height,
    visiblePixels: visible,
    outsideSilhouettePixels: outside,
    outsideLimit,
  };
}

async function renderSvgAlpha(svg) {
  const { data, info } = await sharp(Buffer.from(String(svg || ""), "utf8"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = info.width | 0;
  const height = info.height | 0;
  const channels = info.channels | 0;
  if (!width || !height || channels < 4) {
    throw new Error("Could not render SVG output for sticker border analysis.");
  }
  const alpha = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    alpha[index] = data[index * channels + 3];
  }
  return { width, height, alpha };
}

async function renderSourceAlphaMask(sourcePngPath, width, height) {
  const { data, info } = await sharp(sourcePngPath)
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels | 0;
  if (channels < 4) {
    throw new Error("Could not read source alpha mask for sticker border analysis.");
  }
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    mask[index] = data[index * channels + 3] >= 18 ? 1 : 0;
  }
  return { mask };
}

function dilateMask(mask, width, height, radius) {
  const out = new Uint8Array(mask.length);
  const r = Math.max(0, radius | 0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let covered = false;
      for (let dy = -r; dy <= r && !covered; dy += 1) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -r; dx <= r; dx += 1) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          if (dx * dx + dy * dy > r * r) continue;
          if (mask[yy * width + xx]) {
            covered = true;
            break;
          }
        }
      }
      out[y * width + x] = covered ? 1 : 0;
    }
  }
  return out;
}

async function enableStickerBorderControls(client, settings) {
  const result = await evaluate(client, `(async () => {
    const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
    if (!latest) return { ok: false, reason: "missing latest output" };
    const group = latest.querySelector('[data-output-polish-group="sticker-border"]');
    if (!group) return { ok: false, reason: "missing sticker border controls" };
    const toggle = Array.from(group.querySelectorAll('label')).map((label) => ({
      label,
      input: label.querySelector('input[type="checkbox"]'),
      text: textFor(label),
    })).find((item) => item.input && /Enable border/i.test(item.text));
    if (!toggle?.input) return { ok: false, reason: "missing enable border checkbox" };
    if (!toggle.input.checked) {
      toggle.label.scrollIntoView({ block: "center", inline: "nearest" });
      toggle.input.click();
      await nextFrame();
    }
    const placement = Array.from(group.querySelectorAll('select')).find((select) =>
      /Border layer/i.test(labelFor(select))
    );
    let color = group.querySelector('input[type="color"]');
    let ranges = Array.from(group.querySelectorAll('input[type="range"]'));
    for (let attempt = 0; attempt < 20 && (!color || ranges.length < 2); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      color = group.querySelector('input[type="color"]');
      ranges = Array.from(group.querySelectorAll('input[type="range"]'));
    }
    const thickness = ranges.find((input) => /Border thickness/i.test(labelFor(input))) || ranges[0];
    const opacity = ranges.find((input) => /Border opacity/i.test(labelFor(input))) || ranges[1];
    if (!color || !thickness || !opacity) {
      return {
        ok: false,
        reason: "missing sticker border color, thickness, or opacity controls",
        controlCounts: { colors: group.querySelectorAll('input[type="color"]').length, ranges: ranges.length },
      };
    }
    if (placement && placement.value !== "behind") {
      setNativeValue(placement, "behind");
      placement.dispatchEvent(new Event("change", { bubbles: true }));
      await nextFrame();
    }
    setNativeValue(color, ${JSON.stringify(settings.color)});
    color.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: ${JSON.stringify(settings.color)} }));
    color.dispatchEvent(new Event("change", { bubbles: true }));
    setNativeValue(thickness, ${JSON.stringify(String(settings.thickness))});
    thickness.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: ${JSON.stringify(String(settings.thickness))} }));
    thickness.dispatchEvent(new Event("change", { bubbles: true }));
    setNativeValue(opacity, ${JSON.stringify(String(settings.opacity))});
    opacity.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: ${JSON.stringify(String(settings.opacity))} }));
    opacity.dispatchEvent(new Event("change", { bubbles: true }));
    await nextFrame();
    return {
      ok: true,
      placement: placement?.value || null,
      color: color.value,
      thickness: thickness.value,
      opacity: opacity.value,
    };

    function labelFor(input) {
      const label = input.closest("label") || input.parentElement?.querySelector("label");
      return textFor(label || input.parentElement || input);
    }
    function setNativeValue(element, value) {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
      if (descriptor?.set) descriptor.set.call(element, value);
      else element.value = value;
    }
    function nextFrame() {
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    ${browserDomHelpers()}
  })()`, 12_000);
  if (!result?.ok) {
    throw new Error(`Could not enable sticker border controls: ${result?.reason || "unknown"}`);
  }
  return result;
}

async function resetStickerBorder(client) {
  const result = await evaluate(client, `(async () => {
    const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
    if (!latest) return { ok: false, reason: "missing latest output" };
    const group = latest.querySelector('[data-output-polish-group="sticker-border"]');
    if (!group) return { ok: false, reason: "missing sticker border controls" };
    const reset = Array.from(group.querySelectorAll("button")).find((button) =>
      isVisible(button) && /^Reset$/i.test(textFor(button)) && !button.disabled
    );
    if (!reset) return { ok: false, reason: "missing enabled reset button" };
    reset.scrollIntoView({ block: "center", inline: "nearest" });
    reset.click();
    await new Promise((resolve) => setTimeout(resolve, 350));
    return { ok: true };
    ${browserDomHelpers()}
  })()`, 8_000);
  if (!result?.ok) throw new Error(`Could not reset sticker border: ${result?.reason || "unknown"}`);
  return result;
}

async function decodeLatestSvg(client) {
  const svg = await evaluate(client, `(() => {
    const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
    if (!latest) return "";
    const focused = latest.querySelector('[data-focused-editor-workspace="true"]');
    const root = focused || latest;
    const images = Array.from(root.querySelectorAll('[data-editor-output-preview="true"] img, img'));
    for (const image of images) {
      const src = image?.getAttribute("src") || "";
      if (!src.startsWith("data:image/svg+xml")) continue;
      const comma = src.indexOf(",");
      if (comma < 0) continue;
      try { return decodeURIComponent(src.slice(comma + 1)); } catch {}
    }
    return "";
    ${browserDomHelpers()}
  })()`, 8_000);
  if (!svg || !/<svg\b/i.test(svg)) throw new Error("Could not decode latest SVG preview.");
  return svg;
}

async function installCopyDownloadCapture(client) {
  return evaluate(client, `(() => {
    const state = window.__STICKER_BORDER_CORRECTNESS__ || {};
    state.clipboardWrites = Array.isArray(state.clipboardWrites) ? state.clipboardWrites : [];
    state.downloadedSvgBlobs = Array.isArray(state.downloadedSvgBlobs) ? state.downloadedSvgBlobs : [];
    state.objectUrlSvgBlobs = state.objectUrlSvgBlobs && typeof state.objectUrlSvgBlobs === "object"
      ? state.objectUrlSvgBlobs
      : {};
    window.__STICKER_BORDER_CORRECTNESS__ = state;
    const capture = async (text) => {
      window.__STICKER_BORDER_CORRECTNESS__.clipboardWrites.push(String(text || ""));
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
    if (!URL.__stickerBorderCreateObjectUrl) {
      URL.__stickerBorderCreateObjectUrl = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        const url = URL.__stickerBorderCreateObjectUrl(blob);
        try {
          if (blob && /image\\/svg\\+xml/i.test(String(blob.type || "")) && typeof blob.text === "function") {
            window.__STICKER_BORDER_CORRECTNESS__.objectUrlSvgBlobs[url] = blob;
          }
        } catch {}
        return url;
      };
    }
    if (!HTMLAnchorElement.prototype.__stickerBorderClick) {
      HTMLAnchorElement.prototype.__stickerBorderClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function (...args) {
        try {
          const href = this.href || this.getAttribute("href") || "";
          const download = this.download || this.getAttribute("download") || "";
          const blob = download ? window.__STICKER_BORDER_CORRECTNESS__?.objectUrlSvgBlobs?.[href] : null;
          if (blob && typeof blob.text === "function") {
            blob.text().then((text) => {
              window.__STICKER_BORDER_CORRECTNESS__.downloadedSvgBlobs.push(String(text || ""));
            }).catch(() => {});
          }
        } catch {}
        return HTMLAnchorElement.prototype.__stickerBorderClick.apply(this, args);
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
  if (!copyClick) throw new Error("Copy SVG control not found for parity check.");
  const copied = await waitForValue(
    client,
    () => copyDownloadCaptureExpression(expectedHash, expectedBytes),
    8_000,
    (value) => value?.clipboardCount > before.clipboardCount,
  );

  const downloadClick = await clickButtonInLatestOutput(client, [/Download SVG/i, /^Download\b/i], [/ZIP/i]);
  if (!downloadClick) throw new Error("Download SVG control not found for parity check.");
  const downloaded = await waitForValue(
    client,
    () => copyDownloadCaptureExpression(expectedHash, expectedBytes),
    8_000,
    (value) => value?.downloadCount > before.downloadCount,
  );

  const result = {
    expectedHash,
    expectedBytes,
    copyClick,
    downloadClick,
    copyHash: copied.latestClipboardHash,
    copyBytes: copied.latestClipboardBytes,
    downloadHash: downloaded.latestDownloadHash,
    downloadBytes: downloaded.latestDownloadBytes,
    copyMatchedPreview:
      copied.latestClipboardHash === expectedHash &&
      copied.latestClipboardBytes === expectedBytes,
    downloadMatchedPreview:
      downloaded.latestDownloadHash === expectedHash &&
      downloaded.latestDownloadBytes === expectedBytes,
  };
  if (!result.copyMatchedPreview) throw new Error("Copy SVG did not match sticker preview SVG.");
  if (!result.downloadMatchedPreview) throw new Error("Download SVG did not match sticker preview SVG.");
  return result;
}

async function getCopyDownloadCapture(client) {
  return evaluate(client, copyDownloadCaptureExpression("", 0), 8_000);
}

function copyDownloadCaptureExpression(expectedHash, expectedBytes) {
  return `(() => {
    const state = window.__STICKER_BORDER_CORRECTNESS__ || {};
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
      latestClipboardBytes,
      latestDownloadHash,
      latestDownloadBytes,
      copyMatchedPreview: latestClipboardHash === ${JSON.stringify(expectedHash)} && latestClipboardBytes === ${Number(expectedBytes)},
      downloadMatchedPreview: latestDownloadHash === ${JSON.stringify(expectedHash)} && latestDownloadBytes === ${Number(expectedBytes)},
    };
    function hashString(value) {
      let hash = 0;
      const text = String(value || "");
      for (let index = 0; index < text.length; index += 1) {
        hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
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

async function clickConvert(client) {
  const clicked = await clickButtonIfPresent(
    client,
    [/^Convert\b/i, /^Create\b/i, /^Build\b/i, /^Generate\b/i, /^Trace\b/i, /Layered SVG/i],
    [/Download/i, /Copy/i, /Settings/i, /ZIP/i],
  );
  if (clicked) return clicked;
  const state = await outputState(client);
  if (state.activeJobs > 0) return { clicked: false, reason: "conversion already running", state };
  if (state.latestReady) return { clicked: false, reason: "output already ready", state };
  const buttons = await visibleButtonLabels(client).catch(() => []);
  throw new Error(`No enabled Convert/Create button found. Visible buttons: ${JSON.stringify(buttons.slice(0, 24))}`);
}

async function waitForCompletedOutput(client, previousLatestStamp, timeoutMs) {
  return waitForValue(
    client,
    () => outputStateExpression(previousLatestStamp),
    timeoutMs,
    (state) =>
      state?.pageAlive &&
      state.latestReady &&
      state.activeJobs === 0 &&
      state.latestStamp !== null,
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
  throw new Error(`No matching layered preset button was visible for ${patterns.map(String).join(", ")}.`);
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
    };
    function isActiveCard(card) {
      return /queued|running/i.test(card.getAttribute("data-job-status") || "") ||
        /\\b(Queued|Running|Converting|Creating|Building)\\b/i.test(card.innerText || "");
    }
    ${browserDomHelpers()}
  })()`;
}

async function visibleButtonLabels(client) {
  return evaluate(client, `(() => Array.from(document.querySelectorAll("button, [role='button'], summary"))
    .filter((element) => isVisible(element))
    .map((element) => ({
      text: textFor(element),
      disabled: Boolean(element.disabled),
    }))
    .filter((item) => item.text))()
    ${browserDomHelpers()}`, 8_000);
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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const nodeId = await queryFileInputNodeId(client, 'label input[type="file"], input[type="file"]');
      await client.send("DOM.setFileInputFiles", { nodeId, files: [filePath] }, 8_000);
      await dispatchFileInputChange(client);
      const accepted = await waitForUploadAccepted(client, expectedName, 12_000).catch(() => null);
      if (accepted) return;
    } catch (error) {
      lastError = error;
      await delay(150);
    }
  }
  await setFileInputFromBuffer(client, filePath);
  const accepted = await waitForUploadAccepted(client, expectedName, 20_000).catch(() => null);
  if (accepted) return;
  throw lastError || new Error(`File upload did not appear in page state for ${expectedName}.`);
}

async function queryFileInputNodeId(client, selector) {
  const { root } = await client.send("DOM.getDocument", { depth: -1, pierce: true }, 8_000);
  const { nodeId } = await client.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector,
  }, 8_000);
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

async function setFileInputFromBuffer(client, filePath) {
  await waitForValue(
    client,
    () => `(() => Boolean(document.querySelector('input[type="file"]')))()`,
    12_000,
    Boolean,
  );
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
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
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
  await waitForUploadAccepted(client, file.name, 25_000);
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

function mimeTypeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

async function openLatestSettingsPanel(client) {
  const clicked = await clickButtonInLatestOutput(client, [/Settings\s*\/\s*Edit/i, /^Settings$/i], []);
  if (clicked) {
    await delay(400);
    return clicked;
  }
  const labels = await visibleButtonLabels(client).catch(() => []);
  throw new Error(`No Settings/Edit button found. Visible buttons: ${JSON.stringify(labels.slice(0, 24))}`);
}

async function ensureSettingsSectionOpen(client, titlePattern, fallbackName) {
  const source = titlePattern instanceof RegExp ? titlePattern.source : String(titlePattern);
  const result = await evaluate(client, `(async () => {
    const pattern = new RegExp(${JSON.stringify(source)}, "i");
    const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
    if (!latest) return { opened: false, reason: "missing latest output" };
    const hasOpenContent = () => Boolean(latest.querySelector('[data-output-polish-group="sticker-border"]'));
    if (hasOpenContent()) return { opened: true, alreadyOpen: true };
    const controls = Array.from(latest.querySelectorAll("button, summary"));
    const control = controls.find((candidate) =>
      isVisible(candidate) && !candidate.disabled && pattern.test(textFor(candidate))
    );
    if (!control) return { opened: false, reason: "section control not found", fallback: ${JSON.stringify(fallbackName)} };
    control.scrollIntoView({ block: "center", inline: "nearest" });
    control.click();
    await new Promise((resolve) => setTimeout(resolve, 350));
    return { opened: hasOpenContent(), clicked: textFor(control) };
    ${browserDomHelpers()}
  })()`, 10_000);
  if (!result?.opened) {
    throw new Error(`Could not open settings section ${fallbackName}: ${result?.reason || "unknown"}`);
  }
  return result;
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
      const text = textFor(candidate);
      return isVisible(candidate) &&
        !candidate.disabled &&
        patterns.some((pattern) => pattern.test(text)) &&
        !rejects.some((pattern) => pattern.test(text));
    });
    if (!button) return null;
    button.scrollIntoView({ block: "center", inline: "nearest" });
    const rect = button.getBoundingClientRect();
    return {
      label: textFor(button),
      x: Math.max(1, Math.min(window.innerWidth - 2, rect.left + rect.width / 2)),
      y: Math.max(1, Math.min(window.innerHeight - 2, rect.top + rect.height / 2)),
    };
    ${browserDomHelpers()}
  })()`, 8_000);
}

async function trustedClickAtPoint(client, point) {
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
    button: "none",
  }, 6_000);
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  }, 6_000);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  }, 6_000);
}

function browserDomHelpers() {
  return `
    function textFor(element) {
      return (element?.innerText || element?.textContent || element?.getAttribute?.("aria-label") || "").replace(/\\s+/g, " ").trim();
    }
    function isVisible(element) {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
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
  `;
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
    (state) =>
      state?.readyState === "interactive" || state?.readyState === "complete",
  );
}

async function waitForValue(client, expressionFactory, timeoutMs, isReady = Boolean) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await evaluate(
      client,
      expressionFactory(),
      Math.min(15_000, Math.max(3_000, deadline - Date.now())),
    );
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
      await evaluate(
        client,
        `(() => { window.location.assign(${JSON.stringify(url)}); return true; })()`,
      );
    });
  }
  await waitForValue(
    client,
    () => `(() => ({ href: location.href, readyState: document.readyState }))()`,
    30_000,
    (state) =>
      state?.href === url &&
      (state.readyState === "interactive" || state.readyState === "complete"),
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
      // Fall through to the legacy endpoint.
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
        reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      this.ws.send(payload);
    });
  }

  async close() {
    this.ws.close();
  }
}

async function cdpJson(endpoint, options = {}) {
  const response = await fetch(`http://127.0.0.1:${debugPort}${endpoint}`, options);
  if (!response.ok) {
    throw new Error(`CDP ${endpoint} failed with ${response.status}`);
  }
  return response.json();
}

async function waitForCdp() {
  const deadline = Date.now() + 20_000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      return await cdpJson("/json/version");
    } catch (error) {
      lastError = error;
      await delay(150);
    }
  }
  throw lastError || new Error("Timed out waiting for browser CDP endpoint.");
}

async function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("Could not find Chrome or Edge for sticker border smoke.");
}

async function prepareFixture() {
  await fs.mkdir(fixturesDir, { recursive: true });
  const userFixture = path.resolve(userFixturePath);
  const userExists = await fs.access(userFixture).then(() => true).catch(() => false);
  const pngPath = userExists
    ? userFixture
    : path.join(fixturesDir, "generated-transparent-sticker.png");
  if (!userExists) {
    await createGeneratedStickerFixture(pngPath);
  }
  return {
    png: {
      path: pngPath,
      info: {
        source: userExists ? "user-fixture" : "generated",
        path: pngPath,
        ...await imageInfo(pngPath),
      },
    },
  };
}

async function createGeneratedStickerFixture(filePath) {
  const width = 256;
  const height = 256;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="none"/>
    <path fill="#166534" d="M129 38C151 20 178 25 195 45C173 49 152 48 129 38Z"/>
    <path fill="#7f1d1d" d="M126 58C170 58 205 91 205 136C205 188 166 221 126 221C84 221 50 185 50 136C50 91 84 58 126 58Z"/>
    <path fill="#ef4444" d="M118 65C156 66 188 96 188 136C188 179 156 207 122 207C87 207 62 176 62 136C62 96 87 65 118 65Z"/>
    <path fill="#f97316" d="M93 70C126 51 160 69 178 98C127 88 89 111 65 154C57 119 66 85 93 70Z" opacity="0.9"/>
    <path fill="#ffffff" d="M92 86C110 76 132 78 144 91C125 88 105 93 88 106C84 100 86 91 92 86Z" opacity="0.82"/>
    <path fill="#111827" d="M126 58C170 58 205 91 205 136C205 188 166 221 126 221C84 221 50 185 50 136C50 91 84 58 126 58ZM126 72C92 72 64 100 64 136C64 176 91 207 126 207C160 207 191 180 191 136C191 100 161 72 126 72Z" fill-rule="evenodd"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(filePath);
}

async function imageInfo(filePath) {
  const metadata = await sharp(filePath).metadata();
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    bytes: (await fs.stat(filePath)).size,
  };
}

async function serverState() {
  try {
    const response = await fetch(baseUrl, { method: "GET" });
    return {
      baseUrl,
      reachable: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type"),
    };
  } catch (error) {
    return {
      baseUrl,
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function gitState() {
  const [branch, status, commit] = await Promise.all([
    execFile("git", ["branch", "--show-current"], { cwd: rootDir }).then((result) => result.stdout.trim()).catch(() => ""),
    execFile("git", ["status", "--short", "--branch"], { cwd: rootDir }).then((result) => result.stdout.trim()).catch(() => ""),
    execFile("git", ["rev-parse", "--short", "HEAD"], { cwd: rootDir }).then((result) => result.stdout.trim()).catch(() => ""),
  ]);
  return { branch, status, commit };
}

function summarizeResults(model, browserResults, browserSkippedReason) {
  const failures = [];
  for (const check of model.checks || []) {
    if (!check.ok) failures.push(`model:${check.name}: ${check.error}`);
  }
  for (const result of browserResults) {
    if (!result.ok) failures.push(`browser:${result.id}: ${result.failures?.join("; ") || result.error || "failed"}`);
  }
  return {
    modelOk: model.ok,
    browserSkipped: Boolean(browserSkippedReason),
    browserSkippedReason,
    scenarioCount: browserResults.length,
    failureCount: failures.length,
    failures,
  };
}

function hashString(value) {
  let hash = 0;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(16);
}

function formatExpectedNumber(value) {
  return Number(value).toFixed(6).replace(/\.?0+$/, "");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
