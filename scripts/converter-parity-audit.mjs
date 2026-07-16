import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import sharp from "sharp";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = getSmokeBaseUrl();
const debugPort = Number(
  process.env.CONVERTER_PARITY_CDP_PORT ||
    11200 + Math.floor(Math.random() * 500),
);
const runRoot = path.join(
  os.tmpdir(),
  "ilovesvg-converter-parity-audit",
  `${process.pid}-${debugPort}`,
);
const fixtureRoot = path.join(runRoot, "fixtures");
const downloadRoot = path.join(runRoot, "downloads");
const profileRoot = path.join(runRoot, "browser-profile");
const requestedSections = new Set(
  String(process.env.CONVERTER_PARITY_SECTIONS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const shouldRun = (section) => requestedSections.size === 0 || requestedSections.has(section);

const traceDefaults = {
  threshold: 224,
  turdSize: 2,
  optTolerance: 0.28,
  turnPolicy: "minority",
  lineColor: "#000000",
  invert: false,
  traceMode: "single",
  colorLayerCount: 5,
  layerMaxTraceSide: 1600,
  minRegionPercent: 0.35,
  layerOptTolerance: 0.45,
  layerTurdSize: 4,
  layerTurnPolicy: "majority",
  posterize: true,
  removeWhite: false,
  removeTransparent: true,
  transparent: true,
  bgColor: "#ffffff",
  preprocess: "none",
  blurSigma: 0.8,
  edgeBoost: 1,
};

const pngRoutes = [
  "/png-to-svg-converter",
  "/png-to-svg-for-canva",
  "/png-to-svg-for-figma",
  "/png-to-svg-for-shopify",
  "/png-to-svg-for-etsy",
  "/transparent-png-to-svg-converter",
  "/png-to-svg-for-glowforge",
];

const svgPngRoutes = [
  "/svg-to-png-converter",
  "/svg-to-png-for-shopify",
  "/svg-to-png-for-etsy",
  "/svg-to-png-for-printify",
  "/svg-to-png-for-printful",
  "/sticker-to-png-for-printing",
  "/svg-to-transparent-png-for-printing",
  "/svg-to-png-for-canva",
  "/svg-to-png-for-figma",
];

const resizeRoutes = [
  "/svg-resize-and-scale-editor",
  "/svg-resizer-for-shopify",
  "/svg-resizer-for-etsy",
  "/svg-resizer-for-glowforge",
  "/svg-resizer-for-silhouette",
  "/svg-resizer-for-canva",
  "/svg-resizer-for-figma",
];

const faviconRoutes = [
  "/svg-to-favicon-generator",
  "/image-to-favicon-generator",
  "/svg-to-favicon-for-shopify",
  "/svg-to-ico-converter",
  "/png-to-ico-converter",
  "/png-to-favicon-generator",
  "/jpg-to-favicon-generator",
  "/logo-to-favicon-generator",
  "/logo-to-favicon-for-shopify",
];

const collisionCases = [
  {
    route: "/icon-to-svg-converter",
    fixture: "monoLogoPng",
    id: "icon-bold",
    localLabel: "Icon - Bold fill",
    sharedLabel: "Icon - Bold",
    local: { threshold: 198, turdSize: 3, optTolerance: 0.42, turnPolicy: "black" },
    shared: { threshold: 206, turdSize: 3, optTolerance: 0.32, turnPolicy: "black" },
  },
  {
    route: "/logo-to-svg-converter",
    fixture: "monoLogoPng",
    id: "logo-smooth",
    localLabel: "Logo - Extra smooth (fewer nodes)",
    sharedLabel: "Logo - Smooth",
    local: { threshold: 212, turdSize: 2, optTolerance: 0.55, turnPolicy: "majority" },
    shared: { threshold: 214, turdSize: 3, optTolerance: 0.5, turnPolicy: "majority" },
  },
  {
    route: "/webp-to-svg-for-cricut",
    fixture: "multiColorWebp",
    id: "cricut-clean-cut",
    localLabel: "Cricut - Clean cut file",
    sharedLabel: "Cricut - Clean Cut",
    local: { threshold: 224, turdSize: 3, optTolerance: 0.34, turnPolicy: "majority" },
    shared: {
      threshold: 216,
      turdSize: 7,
      optTolerance: 0.62,
      turnPolicy: "majority",
      minIslandPx: 14,
      holeFillPx: 10,
      gapCloseStrength: 1,
    },
  },
  {
    route: "/jpeg-to-svg-for-cricut",
    fixture: "photoJpeg",
    id: "cricut-clean-cut",
    localLabel: "Cricut - Clean cut file",
    sharedLabel: "Cricut - Clean Cut",
    local: { threshold: 224, turdSize: 3, optTolerance: 0.34, turnPolicy: "majority" },
    shared: {
      threshold: 216,
      turdSize: 7,
      optTolerance: 0.62,
      turnPolicy: "majority",
      minIslandPx: 14,
      holeFillPx: 10,
      gapCloseStrength: 1,
    },
  },
  {
    route: "/jpg-to-svg-for-cricut",
    fixture: "photoJpg",
    id: "cricut-clean-cut",
    localLabel: "Cricut - Clean cut file",
    sharedLabel: "Cricut - Clean Cut",
    local: { threshold: 224, turdSize: 3, optTolerance: 0.34, turnPolicy: "majority" },
    shared: {
      threshold: 216,
      turdSize: 7,
      optTolerance: 0.62,
      turnPolicy: "majority",
      minIslandPx: 14,
      holeFillPx: 10,
      gapCloseStrength: 1,
    },
  },
  {
    route: "/png-to-svg-for-cricut",
    fixture: "opaquePng",
    id: "cricut-clean-cut",
    localLabel: "Cricut - Clean Cut (default)",
    sharedLabel: "Cricut - Clean Cut",
    local: { threshold: 226, turdSize: 3, optTolerance: 0.32, turnPolicy: "majority" },
    shared: {
      threshold: 216,
      turdSize: 7,
      optTolerance: 0.62,
      turnPolicy: "majority",
      minIslandPx: 14,
      holeFillPx: 10,
      gapCloseStrength: 1,
    },
  },
];

async function main() {
  await fs.rm(runRoot, { recursive: true, force: true });
  await fs.mkdir(fixtureRoot, { recursive: true });
  await fs.mkdir(downloadRoot, { recursive: true });
  await fs.mkdir(profileRoot, { recursive: true });

  const report = {
    summaryVersion: 1,
    baseUrl,
    requestedSections: requestedSections.size ? [...requestedSections] : ["all"],
    temporaryRoot: "removed after run",
    fixtureMatrix: [],
    presetCollisions: [],
    jpgJpeg: {},
    pngWrappers: {},
    svgToPng: {},
    backgroundPixels: {},
    resizers: {},
    favicons: {},
    consoleErrors: [],
    networkErrors: [],
    failures: [],
  };

  let browser = null;
  try {
    await assertLocalApp();
    const fixtures = await createFixtures();
    report.fixtureMatrix = await summarizeFixtures(fixtures);

    if (shouldRun("preset-collisions")) {
      await runReportSection(report, "preset-collisions", async () => {
        report.presetCollisions = await auditPresetCollisions(fixtures);
      });
    }
    if (shouldRun("jpg-jpeg")) {
      await runReportSection(report, "jpg-jpeg", async () => {
        report.jpgJpeg = await auditJpgJpeg(fixtures);
      });
    }
    if (shouldRun("png-wrappers")) {
      await runReportSection(report, "png-wrappers", async () => {
        report.pngWrappers = await auditPngWrappers(fixtures);
      });
    }

    const browserSections = ["svg-png", "resizers", "favicons"];
    if (browserSections.some(shouldRun)) {
      const browserPath = await findBrowserExecutable();
      browser = spawn(
        browserPath,
        [
          `--remote-debugging-port=${debugPort}`,
          `--user-data-dir=${profileRoot}`,
          "--headless=new",
          "--disable-gpu",
          "--disable-extensions",
          "--disable-component-extensions-with-background-pages",
          "--disable-background-networking",
          "--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE localhost, EXCLUDE 127.0.0.1",
          "--no-first-run",
          "--no-default-browser-check",
          "--window-size=1440,1000",
          "about:blank",
        ],
        { stdio: "ignore", windowsHide: true },
      );
      await waitForCdp();
      if (shouldRun("svg-png")) {
        await runReportSection(report, "svg-png", async () => {
          const svgPng = await auditSvgPngFamily(fixtures);
          report.svgToPng = svgPng.family;
          report.backgroundPixels = svgPng.background;
        });
      }
      if (shouldRun("resizers")) {
        await runReportSection(report, "resizers", async () => {
          report.resizers = await auditResizeFamily(fixtures);
        });
      }
      if (shouldRun("favicons")) {
        await runReportSection(report, "favicons", async () => {
          report.favicons = await auditFaviconFamily();
        });
      }
      report.consoleErrors = collectedConsoleErrors;
      report.networkErrors = collectedNetworkErrors.filter(
        (entry) => !/ERR_ABORTED|ERR_FILE_NOT_FOUND/.test(entry.errorText || ""),
      );
      report.consoleErrors.sort(compareJson);
      report.networkErrors.sort(compareJson);
    }
  } catch (error) {
    report.failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    await stopSpawnedBrowser(browser);
    await fs.rm(runRoot, { recursive: true, force: true }).catch(() => null);
  }

  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length) process.exitCode = 1;
}

async function runReportSection(report, name, task) {
  try {
    await task();
  } catch (error) {
    report.failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function assertLocalApp() {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();
  if (!response.ok || !/iLoveSVG/i.test(html) || /WRONG_APP_SENTINEL/.test(html)) {
    throw new Error(`Expected the local iLoveSVG app at ${baseUrl}.`);
  }
}

async function createFixtures() {
  const sources = {
    transparentSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><rect x="0" y="0" width="120" height="80" fill="none"/><rect x="0" y="20" width="38" height="40" fill="#1257d5"/><circle cx="65" cy="40" r="22" fill="#e02424" fill-opacity="0.5"/><path d="M92 12 L116 40 L92 68" fill="none" stroke="#16a34a" stroke-width="6" stroke-linecap="round"/></svg>`,
    fillsSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64"><rect width="96" height="64" fill="#ffffff"/><rect x="8" y="8" width="32" height="48" rx="6" fill="#0b2dff"/><circle cx="68" cy="32" r="20" fill="#f97316"/></svg>`,
    strokesSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><path d="M8 60 C30 8 74 8 112 60" fill="none" stroke="#111827" stroke-width="5"/><path d="M14 68 H106" stroke="#0ea5e9" stroke-width="3"/></svg>`,
    nonSquareSvg: `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="10 20 120 80" preserveAspectRatio="xMidYMid meet"><rect x="10" y="20" width="120" height="80" fill="#f8fafc"/><path d="M20 88 L70 30 L120 88 Z" fill="#2563eb" stroke="#0f172a" stroke-width="4"/></svg>`,
    monoLogoSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="96" viewBox="0 0 160 96"><rect width="160" height="96" fill="white"/><path d="M18 76 L50 18 L78 76 Z M88 20 H142 V38 H108 V50 H138 V68 H108 V78 H88 Z" fill="black"/></svg>`,
    multiColorSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="96" viewBox="0 0 160 96"><rect width="160" height="96" fill="#ffffff"/><circle cx="44" cy="48" r="30" fill="#ef4444"/><rect x="76" y="18" width="62" height="60" rx="12" fill="#2563eb"/><path d="M18 82 H144" stroke="#16a34a" stroke-width="8"/></svg>`,
    sketchSvg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="96" viewBox="0 0 160 96"><rect width="160" height="96" fill="white"/><g fill="none" stroke="#111" stroke-width="2"><path d="M8 70 C28 18 54 18 76 68"/><path d="M74 68 C94 16 124 16 150 70"/><path d="M12 76 C52 68 104 82 148 74"/></g></svg>`,
  };

  const paths = {};
  for (const [name, source] of Object.entries(sources)) {
    const file = path.join(fixtureRoot, `${name}.svg`);
    await fs.writeFile(file, source, "utf8");
    paths[name] = file;
  }

  paths.transparentPng = path.join(fixtureRoot, "transparent.png");
  await sharp(Buffer.from(sources.transparentSvg)).png().toFile(paths.transparentPng);
  paths.opaquePng = path.join(fixtureRoot, "opaque.png");
  await sharp(Buffer.from(sources.fillsSvg)).flatten({ background: "#ffffff" }).png().toFile(paths.opaquePng);
  paths.monoLogoPng = path.join(fixtureRoot, "mono-logo.png");
  await sharp(Buffer.from(sources.monoLogoSvg)).png().toFile(paths.monoLogoPng);
  paths.multiColorPng = path.join(fixtureRoot, "multi-color.png");
  await sharp(Buffer.from(sources.multiColorSvg)).png().toFile(paths.multiColorPng);
  paths.multiColorWebp = path.join(fixtureRoot, "multi-color.webp");
  await sharp(Buffer.from(sources.multiColorSvg)).webp({ quality: 90 }).toFile(paths.multiColorWebp);
  paths.sketchPng = path.join(fixtureRoot, "sketch.png");
  await sharp(Buffer.from(sources.sketchSvg)).png().toFile(paths.sketchPng);
  paths.photoJpg = path.join(fixtureRoot, "photo.jpg");
  await sharp(Buffer.from(sources.multiColorSvg)).jpeg({ quality: 90, chromaSubsampling: "4:4:4" }).toFile(paths.photoJpg);
  paths.photoJpeg = path.join(fixtureRoot, "photo.jpeg");
  await fs.copyFile(paths.photoJpg, paths.photoJpeg);

  const base64Svg = Buffer.from(sources.fillsSvg).toString("base64");
  paths.base64Sample = `data:image/svg+xml;base64,${base64Svg}`;
  paths.codeSample = sources.strokesSvg;
  return paths;
}

async function summarizeFixtures(fixtures) {
  const intended = {
    transparentPng: ["SVG-to-PNG background reference", "raster tracing"],
    opaquePng: ["PNG route parity", "cut presets"],
    photoJpg: ["JPG/JPEG parity"],
    photoJpeg: ["JPEG extension variant"],
    monoLogoPng: ["logo/icon collision output"],
    multiColorPng: ["platform and layered trace"],
    multiColorWebp: ["WebP Cricut collision"],
    sketchPng: ["sketch/line drawing"],
    fillsSvg: ["filled SVG utilities"],
    strokesSvg: ["stroke SVG utilities"],
    transparentSvg: ["transparent raster export"],
    nonSquareSvg: ["resizer/viewBox"],
  };
  const rows = [];
  for (const [name, uses] of Object.entries(intended)) {
    const file = fixtures[name];
    const bytes = await fs.readFile(file);
    const metadata = await sharp(bytes, { limitInputPixels: false }).metadata().catch(() => null);
    rows.push({
      id: name,
      file: path.basename(file),
      format: metadata?.format || path.extname(file).slice(1),
      width: metadata?.width ?? null,
      height: metadata?.height ?? null,
      hasAlpha: metadata?.hasAlpha ?? /transparent/i.test(name),
      bytes: bytes.length,
      sha256: sha256(bytes),
      intendedRoutes: uses,
    });
  }
  rows.push({
    id: "base64Sample",
    format: "SVG data URI",
    width: 96,
    height: 64,
    hasAlpha: false,
    bytes: Buffer.byteLength(fixtures.base64Sample),
    sha256: sha256(Buffer.from(fixtures.base64Sample)),
    intendedRoutes: ["Base64/code input"],
  });
  rows.push({
    id: "codeSample",
    format: "SVG code",
    width: 120,
    height: 80,
    hasAlpha: true,
    bytes: Buffer.byteLength(fixtures.codeSample),
    sha256: sha256(Buffer.from(fixtures.codeSample)),
    intendedRoutes: ["code input"],
  });
  return rows;
}

async function auditPresetCollisions(fixtures) {
  const selectorSource = await fs.readFile(
    path.join(rootDir, "app/client/components/converter/PresetSelector.tsx"),
    "utf8",
  );
  const selectorSemantics = {
    activeById: selectorSource.includes("activePreset === preset.id"),
    pinById: selectorSource.includes("togglePinnedPreset(preset.id)"),
    labelFirstMatchById: selectorSource.includes(
      "presets.find((preset) => preset.id === presetId)?.label",
    ),
    dedupeIncludesSettings: selectorSource.includes(
      "stablePresetSettingsSignature(preset.settings || {})",
    ),
  };

  const rows = [];
  for (const item of collisionCases) {
    const local = await postTrace(
      item.route,
      fixtures[item.fixture],
      { ...traceDefaults, ...item.local },
      item.id,
    );
    const shared = await postTrace(
      item.route,
      fixtures[item.fixture],
      { ...traceDefaults, ...item.shared },
      item.id,
    );
    rows.push({
      route: item.route,
      id: item.id,
      displayOrder: [item.localLabel, item.sharedLabel],
      selectorSemantics,
      submittedPresetIdIsIndistinguishable: true,
      local: summarizeSvgResult(local, item.local),
      shared: summarizeSvgResult(shared, item.shared),
      byteIdentical: local.svg === shared.svg,
      outputRisk: local.svg === shared.svg ? "not reproduced on this fixture" : "materially different output",
      activeCardRisk: "both same-ID cards are active",
      pinRisk: "pinning either same-ID card pins both",
      historyLabelRisk: `ID lookup resolves the first card (${item.localLabel}) even after the shared card is selected`,
    });
  }
  const identicalRows = rows.filter((row) => row.byteIdentical);
  assertComparison(rows.length === 6, `Expected six preset collisions, found ${rows.length}.`);
  assertComparison(
    identicalRows.length === 1 && identicalRows[0].route === "/logo-to-svg-converter",
    "Expected five materially different collision outputs and only the simple logo fixture to match.",
  );
  assertComparison(
    Object.values(selectorSemantics).every(Boolean),
    "PresetSelector identity semantics no longer match the audited active/pin/label/dedupe behavior.",
  );
  return rows;
}

async function auditJpgJpeg(fixtures) {
  const cases = [
    { id: "default", settings: traceDefaults },
    {
      id: "photo-bold",
      settings: {
        ...traceDefaults,
        preprocess: "edge",
        blurSigma: 0.6,
        edgeBoost: 1.4,
        threshold: 230,
        turdSize: 3,
        optTolerance: 0.4,
        turnPolicy: "majority",
      },
    },
    {
      id: "advanced-threshold",
      settings: { ...traceDefaults, threshold: 180 },
    },
    {
      id: "line-clean",
      settings: {
        ...traceDefaults,
        traceMode: "single",
        preprocess: "none",
        threshold: 224,
        turdSize: 3,
        optTolerance: 0.34,
        turnPolicy: "majority",
        lineColor: "#000000",
        invert: false,
      },
    },
  ];
  const comparisons = [];
  for (const scenario of cases) {
    const jpg = await postTrace(
      "/jpg-to-svg-converter",
      fixtures.photoJpg,
      scenario.settings,
      scenario.id,
    );
    const jpeg = await postTrace(
      "/jpeg-to-svg-converter",
      fixtures.photoJpeg,
      scenario.settings,
      scenario.id,
    );
    comparisons.push(compareSvgPair(scenario.id, jpg, jpeg));
  }
  assertComparison(
    comparisons.every(
      (comparison) =>
        comparison.byteIdentical &&
        comparison.normalizedXmlIdentical &&
        comparison.structurallyEquivalent,
    ),
    "JPG/JPEG production-action output diverged under equal input bytes and settings.",
  );
  return {
    comparisons,
    acceptedInputDifference:
      "JPG route validates JPG/JPEG/PNG/WebP/SVG; JPEG route also advertises GIF/AVIF/BMP/TIFF through its separate implementation.",
    vtracer: "Covered by the existing hybrid-browser production-path rerun outside this script.",
  };
}

async function auditPngWrappers(fixtures) {
  const rows = [];
  for (const route of pngRoutes) {
    const result = await postTrace(
      route,
      fixtures.opaquePng,
      traceDefaults,
      "audit-equalized-default",
    );
    rows.push({ route, ...summarizeSvgResult(result, traceDefaults) });
  }
  const commonRows = rows.filter((row) => row.route !== "/png-to-svg-for-glowforge");
  const glowforge = rows.find((row) => row.route === "/png-to-svg-for-glowforge");
  const commonHash = commonRows[0]?.sha256;
  const commonRoutesByteIdentical = commonRows.every((row) => row.sha256 === commonHash);
  const glowforgeDiffers = Boolean(glowforge && glowforge.sha256 !== commonHash);
  assertComparison(
    commonRoutesByteIdentical,
    "The six non-Glowforge PNG wrappers diverged under equal settings.",
  );
  assertComparison(
    glowforgeDiffers,
    "Glowforge no longer differs from the common PNG-wrapper output; review laser post-processing evidence.",
  );
  return {
    equalizedSettings: rows,
    uniqueRawHashes: [...new Set(rows.map((row) => row.sha256))],
    allByteIdentical: new Set(rows.map((row) => row.sha256)).size === 1,
    commonRoutesByteIdentical,
    glowforgeDiffers,
    defaultPresetCaveat:
      "Equalized route-action parity does not erase the verified route defaults: Shopify/Etsy, base/Canva/Figma, and Glowforge start from different preset settings.",
  };
}

async function auditSvgPngFamily(fixtures) {
  const rows = [];
  for (const route of svgPngRoutes) {
    const file = await runSvgPngScenario(route, fixtures.transparentSvg, {
      background: "transparent",
    });
    rows.push({ route, ...(await analyzePng(file)) });
  }
  const family = {
    routes: rows,
    allByteIdentical: new Set(rows.map((row) => row.sha256)).size === 1,
    allPixelIdentical: new Set(rows.map((row) => row.pixelSha256)).size === 1,
    dimensions: [...new Set(rows.map((row) => `${row.width}x${row.height}`))],
  };

  const transparent = await analyzePng(
    await runSvgPngScenario(
      "/svg-to-png-converter",
      fixtures.transparentSvg,
      { background: "transparent" },
    ),
    true,
  );
  const white = await analyzePng(
    await runSvgPngScenario(
      "/svg-to-png-converter",
      fixtures.transparentSvg,
      { background: "solid", color: "#ffffff" },
    ),
    true,
  );
  const custom = await analyzePng(
    await runSvgPngScenario(
      "/svg-to-png-converter",
      fixtures.transparentSvg,
      { background: "solid", color: "#00ff00" },
    ),
    true,
  );

  const background = compareBackgroundPixels(transparent, white, custom);
  assertComparison(
    family.allByteIdentical && family.allPixelIdentical,
    "SVG-to-PNG wrappers diverged under the audited equivalent settings.",
  );
  assertComparison(
    family.dimensions.length === 1 && family.dimensions[0] === "120x80",
    `Unexpected SVG-to-PNG dimensions: ${family.dimensions.join(", ")}.`,
  );
  for (const [label, output, comparison] of [
    ["white", background.white, background.whiteComparison],
    ["custom", background.custom, background.customComparison],
  ]) {
    assertComparison(
      output.transparentPixels === 0 && output.partialAlphaPixels === 0,
      `${label} solid SVG-to-PNG output retained alpha.`,
    );
    assertComparison(
      comparison.fullyOpaqueArtworkChanged === 0,
      `${label} background changed fully opaque SVG artwork pixels.`,
    );
    assertComparison(
      comparison.transparentCanvasChanged === background.transparent.transparentPixels &&
        comparison.partialAlphaChanged === background.transparent.partialAlphaPixels,
      `${label} background did not change every transparent and partial-alpha pixel as expected.`,
    );
  }
  return {
    family,
    background,
  };
}

async function auditResizeFamily(fixtures) {
  const rows = [];
  for (const route of resizeRoutes) {
    const file = await runResizeScenario(route, fixtures.nonSquareSvg, {});
    rows.push({ route, ...(await analyzeSvgFile(file)) });
  }

  const locked = await analyzeSvgFile(
    await runResizeScenario(
      "/svg-resize-and-scale-editor",
      fixtures.nonSquareSvg,
      { width: 240 },
    ),
  );
  const unlocked = await analyzeSvgFile(
    await runResizeScenario(
      "/svg-resize-and-scale-editor",
      fixtures.nonSquareSvg,
      { lockAspect: false, width: 240, height: 100, viewBoxMode: "match-output" },
    ),
  );
  const scaled = await analyzeSvgFile(
    await runResizeScenario(
      "/svg-resize-and-scale-editor",
      fixtures.nonSquareSvg,
      { scalePct: 50 },
    ),
  );

  const allByteIdentical = new Set(rows.map((row) => row.sha256)).size === 1;
  const allNormalizedIdentical =
    new Set(rows.map((row) => row.normalizedSha256)).size === 1;
  assertComparison(
    allByteIdentical && allNormalizedIdentical,
    "SVG resizer wrappers diverged under the audited default settings.",
  );
  assertComparison(
    locked.width === "240px" &&
      locked.height === "160px" &&
      locked.viewBox === "10 20 120 80",
    `Locked-width resizer behavior changed: ${JSON.stringify(locked)}.`,
  );
  assertComparison(
    unlocked.width === "240px" &&
      unlocked.height === "100px" &&
      unlocked.viewBox === "0 0 240 100",
    `Unlocked match-output resizer behavior changed: ${JSON.stringify(unlocked)}.`,
  );
  assertComparison(
    scaled.width === "60px" &&
      scaled.height === "40px" &&
      scaled.viewBox === "10 20 120 80",
    `Proportional 50-percent resizer behavior changed: ${JSON.stringify(scaled)}.`,
  );
  return {
    routes: rows,
    allByteIdentical,
    allNormalizedIdentical,
    lockedWidthChange: locked,
    unlockedMatchOutput: unlocked,
    proportionalScale50: scaled,
  };
}

async function auditFaviconFamily() {
  const rows = [];
  for (const route of faviconRoutes) {
    const result = await runFaviconScenario(route, {});
    rows.push({ route, ...result });
  }
  const manifestSignatures = rows.map((row) =>
    JSON.stringify(
      row.files.map((file) => [file.name, file.bytes, file.sha256]),
    ),
  );
  const whiteBackground = await runFaviconScenario(
    "/svg-to-favicon-generator",
    { background: "white" },
  );
  const onlyIco16 = await runFaviconScenario(
    "/svg-to-favicon-generator",
    { onlyIco16: true },
  );
  const allPackageManifestsIdentical = new Set(manifestSignatures).size === 1;
  const allSnippetsIdentical = new Set(rows.map((row) => row.snippetSha256)).size === 1;
  const allIcoDirectoriesIdentical =
    new Set(rows.map((row) => JSON.stringify(row.icoSizes))).size === 1;
  const deterministicRows = rows.map(({ zipBytes, zipSha256, ...row }) => row);
  const whiteChangedFiles = whiteBackground.files
    .filter((file, index) => file.sha256 !== rows[0].files[index]?.sha256)
    .map((file) => file.name);
  assertComparison(
    allPackageManifestsIdentical && allSnippetsIdentical && allIcoDirectoriesIdentical,
    "Favicon package entries, snippets, or ICO directories diverged across wrappers.",
  );
  assertComparison(
    whiteChangedFiles.length === 22,
    `Expected white background to change 22 raster/ICO entries, changed ${whiteChangedFiles.length}.`,
  );
  assertComparison(
    onlyIco16.fileCount === 24 &&
      onlyIco16.icoSizes.length === 1 &&
      onlyIco16.icoSizes[0] === "16x16",
    "The 16-only favicon setting no longer retains the 24-file package with a one-entry ICO.",
  );
  return {
    routes: deterministicRows,
    rawZipContainerComparison:
      "Hashes collected during the run but omitted from the deterministic summary; ZIP timestamps/metadata are not package-content evidence.",
    allPackageManifestsIdentical,
    allSnippetsIdentical,
    allIcoDirectoriesIdentical,
    settingsEffects: {
      whiteBackground: {
        fileCount: whiteBackground.fileCount,
        manifestMatchesDefault:
          JSON.stringify(whiteBackground.files) === JSON.stringify(rows[0].files),
        filesChanged: whiteChangedFiles,
      },
      onlyIco16: {
        fileCount: onlyIco16.fileCount,
        fileNames: onlyIco16.files.map((file) => file.name),
        icoSizes: onlyIco16.icoSizes,
        snippetBytes: onlyIco16.snippetBytes,
      },
    },
  };
}

async function postTrace(route, fixturePath, settings, presetId) {
  const form = new FormData();
  const bytes = await fs.readFile(fixturePath);
  form.append(
    "file",
    new Blob([bytes], { type: mimeTypeForPath(fixturePath) }),
    path.basename(fixturePath),
  );
  for (const [key, value] of Object.entries(settings)) {
    form.append(key, String(value));
  }
  form.append("presetId", presetId);
  const response = await fetch(`${baseUrl}${route}.data?index`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Origin: baseUrl,
      Referer: `${baseUrl}${route}`,
      "User-Agent": "ilovesvg-local-parity-audit",
    },
    body: form,
  });
  const contentType = response.headers.get("content-type") || "";
  const responseText = await response.text();
  const data = contentType.includes("text/x-script")
    ? parseSingleFetchPayload(responseText)
    : contentType.includes("json")
      ? JSON.parse(responseText)
      : { error: responseText.slice(0, 500) };
  if (!response.ok || !data?.svg) {
    throw new Error(
      `${route} action failed (${response.status}): ${data?.error || "missing SVG"}`,
    );
  }
  return data;
}

function parseSingleFetchPayload(text) {
  const values = JSON.parse(text);
  if (!Array.isArray(values)) {
    return { error: "unexpected single-fetch payload" };
  }
  const readField = (name) => {
    const index = values.findIndex((value) => value === name);
    return index >= 0 ? values[index + 1] : undefined;
  };
  return {
    svg: readField("svg"),
    error: readField("error") || readField("message"),
  };
}

function summarizeSvgResult(result, submittedSettings) {
  const svg = String(result.svg || "");
  const normalized = normalizeSvg(svg);
  return {
    submittedSettings,
    bytes: Buffer.byteLength(svg),
    sha256: sha256(Buffer.from(svg)),
    normalizedSha256: sha256(Buffer.from(normalized)),
    viewBox: svg.match(/\bviewBox=["']([^"']+)/i)?.[1] || null,
    pathCount: countMatches(svg, /<path\b/gi),
    groupCount: countMatches(svg, /<g\b/gi),
    fillCount: countMatches(svg, /\bfill=["']/gi),
    strokeCount: countMatches(svg, /\bstroke=["']/gi),
  };
}

function compareSvgPair(id, left, right) {
  const a = summarizeSvgResult(left, null);
  const b = summarizeSvgResult(right, null);
  return {
    scenario: id,
    jpg: a,
    jpeg: b,
    byteIdentical: a.sha256 === b.sha256,
    normalizedXmlIdentical: a.normalizedSha256 === b.normalizedSha256,
    structurallyEquivalent:
      a.viewBox === b.viewBox &&
      a.pathCount === b.pathCount &&
      a.groupCount === b.groupCount &&
      a.fillCount === b.fillCount &&
      a.strokeCount === b.strokeCount,
  };
}

async function runSvgPngScenario(route, fixturePath, options) {
  const dir = path.join(downloadRoot, `png-${slug(route)}-${slug(options.background)}-${slug(options.color || "none")}`);
  const client = await openPage(route, dir);
  try {
    await setFileInput(client, fixturePath);
    try {
      await waitForValue(
        client,
        () => `(() => Boolean(Array.from(document.querySelectorAll('img')).find((img) => img.alt === 'PNG result' && img.src)))()`,
        30_000,
        Boolean,
      );
    } catch (error) {
      const state = await evaluate(client, `(() => ({ files: Array.from(document.querySelectorAll('input[type=file]')).flatMap((input) => Array.from(input.files || []).map((file) => file.name)), images: Array.from(document.images).map((img) => ({ alt: img.alt, src: String(img.src || '').slice(0, 40) })), body: (document.body?.innerText || '').slice(0, 800) }))()`);
      throw new Error(`${route} live preview did not become ready: ${JSON.stringify(state)} (${error instanceof Error ? error.message : String(error)})`);
    }
    if (options.background !== "transparent") {
      await clickButtonByText(client, "Settings");
      await setLabeledControl(client, "Background", "solid");
      await setLabeledControl(client, "Background color", options.color || "#ffffff");
      await delay(650);
    }
    await clickButtonByText(client, "Convert to PNG");
    await waitForButtonEnabled(client, "Download PNG", 30_000);
    const before = new Set(await safeReaddir(dir));
    await clickButtonByText(client, "Download PNG");
    return await waitForDownloadedFile(dir, before, ".png", 30_000);
  } catch (error) {
    const state = await evaluate(client, `(() => ({ buttons: Array.from(document.querySelectorAll('button')).map((button) => ({ text: String(button.textContent || '').replace(/\\s+/g, ' ').trim(), disabled: button.disabled })).filter((button) => /PNG|Settings/i.test(button.text)), output: Array.from(document.images).filter((img) => /PNG result/i.test(img.alt || '')).map((img) => ({ alt: img.alt, src: String(img.src || '').slice(0, 40) })), body: (document.body?.innerText || '').slice(0, 600) }))()`);
    throw new Error(`${route} (${JSON.stringify(options)}) failed with ${JSON.stringify(state)}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    collectClientLogs(client, route);
    await closePage(client);
  }
}

async function runResizeScenario(route, fixturePath, options) {
  const dir = path.join(downloadRoot, `resize-${slug(route)}-${sha256(Buffer.from(JSON.stringify(options))).slice(0, 8)}`);
  const client = await openPage(route, dir);
  try {
    await setFileInput(client, fixturePath);
    await waitForValue(
      client,
      () => `(() => { const text = document.body?.innerText || ''; return text.includes('Detected:') && text.includes('viewBox 10 20 120 80'); })()`,
      20_000,
      Boolean,
    );
    await waitForButtonEnabled(client, "Download Resized SVG", 20_000);
    if (Object.keys(options).length) {
      await clickButtonByText(client, "Settings");
      if (options.lockAspect === false) {
        await setLabeledControl(client, "Lock aspect ratio", false);
      }
      if (options.width != null) await setLabeledControl(client, "Width", options.width);
      if (options.height != null) await setLabeledControl(client, "Height", options.height);
      if (options.scalePct != null) await setLabeledControl(client, "Scale (%)", options.scalePct);
      if (options.viewBoxMode) {
        await setLabeledControl(client, "viewBox handling", options.viewBoxMode);
      }
      await delay(500);
    }
    const before = new Set(await safeReaddir(dir));
    await clickButtonByText(client, "Download Resized SVG");
    return await waitForDownloadedFile(dir, before, ".svg", 20_000);
  } finally {
    collectClientLogs(client, route);
    await closePage(client);
  }
}

async function runFaviconScenario(route, options) {
  const dir = path.join(downloadRoot, `favicon-${slug(route)}-${sha256(Buffer.from(JSON.stringify(options))).slice(0, 8)}`);
  const client = await openPage(route, dir);
  try {
    await delay(2_500);
    await clickButtonByText(client, "Load example");
    await waitForButtonEnabled(client, "Generate icons", 15_000);
    if (options.background || options.onlyIco16) {
      await clickButtonByText(client, "Settings");
      if (options.background) {
        await setLabeledControl(client, "Background", options.background);
      }
      if (options.onlyIco16) {
        await setLabeledControl(client, "Generate only 16", true);
      }
      await delay(250);
    }
    await clickButtonByText(client, "Generate icons");
    await waitForButtonEnabled(client, "Download ZIP", 45_000);
    const snippet = await waitForValue(
      client,
      () => `(() => Array.from(document.querySelectorAll('textarea')).map((item) => item.value || '').find((value) => value.includes('<link rel="icon"')) || '')()`,
      15_000,
      (value) => Boolean(value),
    );
    const before = new Set(await safeReaddir(dir));
    await clickButtonByText(client, "Download ZIP");
    const zipPath = await waitForDownloadedFile(dir, before, ".zip", 30_000);
    const zipBytes = await fs.readFile(zipPath);
    const unzipped = unzipSync(new Uint8Array(zipBytes));
    const files = Object.entries(unzipped)
      .map(([name, bytes]) => ({
        name,
        bytes: bytes.length,
        sha256: sha256(Buffer.from(bytes)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
    const icoEntry = Object.entries(unzipped).find(([name]) => /\.ico$/i.test(name));
    return {
      zipBytes: zipBytes.length,
      zipSha256: sha256(zipBytes),
      fileCount: files.length,
      files,
      icoSizes: icoEntry ? parseIcoSizes(Buffer.from(icoEntry[1])) : [],
      snippetSha256: sha256(Buffer.from(snippet)),
      snippetBytes: Buffer.byteLength(snippet),
    };
  } catch (error) {
    const state = await evaluate(client, `(() => ({ buttons: Array.from(document.querySelectorAll('button')).map((button) => ({ text: String(button.textContent || '').replace(/\\s+/g, ' ').trim(), disabled: button.disabled })).filter((button) => /example|Generate icons|Download ZIP/i.test(button.text)), textareas: Array.from(document.querySelectorAll('textarea')).map((item) => String(item.value || '').slice(0, 100)), body: (document.body?.innerText || '').slice(0, 900) }))()`);
    throw new Error(`${route} failed with ${JSON.stringify(state)}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    collectClientLogs(client, route);
    await closePage(client);
  }
}

async function analyzePng(filePath, includePixels = false) {
  const bytes = await fs.readFile(filePath);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = [];
  let transparentPixels = 0;
  let partialAlphaPixels = 0;
  let opaquePixels = 0;
  for (let offset = 3; offset < data.length; offset += info.channels) {
    const value = data[offset];
    alpha.push(value);
    if (value === 0) transparentPixels += 1;
    else if (value === 255) opaquePixels += 1;
    else partialAlphaPixels += 1;
  }
  return {
    bytes: bytes.length,
    sha256: sha256(bytes),
    pixelSha256: sha256(data),
    width: info.width,
    height: info.height,
    channels: info.channels,
    transparentPixels,
    partialAlphaPixels,
    opaquePixels,
    pixels: includePixels ? Buffer.from(data).toString("base64") : undefined,
  };
}

function compareBackgroundPixels(transparent, white, custom) {
  const a = Buffer.from(transparent.pixels, "base64");
  const b = Buffer.from(white.pixels, "base64");
  const c = Buffer.from(custom.pixels, "base64");
  let whiteDiffPixels = 0;
  let customDiffPixels = 0;
  let opaqueArtworkChangedWhite = 0;
  let opaqueArtworkChangedCustom = 0;
  let transparentCanvasChangedWhite = 0;
  let transparentCanvasChangedCustom = 0;
  let partialAlphaChangedWhite = 0;
  let partialAlphaChangedCustom = 0;
  let maxChannelDifferenceWhite = 0;
  let maxChannelDifferenceCustom = 0;
  for (let offset = 0; offset < a.length; offset += 4) {
    const alpha = a[offset + 3];
    const whiteChanged = !a.subarray(offset, offset + 4).equals(b.subarray(offset, offset + 4));
    const customChanged = !a.subarray(offset, offset + 4).equals(c.subarray(offset, offset + 4));
    if (whiteChanged) whiteDiffPixels += 1;
    if (customChanged) customDiffPixels += 1;
    if (alpha === 255 && whiteChanged) opaqueArtworkChangedWhite += 1;
    if (alpha === 255 && customChanged) opaqueArtworkChangedCustom += 1;
    if (alpha === 0 && whiteChanged) transparentCanvasChangedWhite += 1;
    if (alpha === 0 && customChanged) transparentCanvasChangedCustom += 1;
    if (alpha > 0 && alpha < 255 && whiteChanged) partialAlphaChangedWhite += 1;
    if (alpha > 0 && alpha < 255 && customChanged) partialAlphaChangedCustom += 1;
    for (let channel = 0; channel < 4; channel += 1) {
      maxChannelDifferenceWhite = Math.max(
        maxChannelDifferenceWhite,
        Math.abs(a[offset + channel] - b[offset + channel]),
      );
      maxChannelDifferenceCustom = Math.max(
        maxChannelDifferenceCustom,
        Math.abs(a[offset + channel] - c[offset + channel]),
      );
    }
  }
  delete transparent.pixels;
  delete white.pixels;
  delete custom.pixels;
  return {
    transparent,
    white,
    custom,
    whiteComparison: {
      differingPixelCount: whiteDiffPixels,
      maxChannelDifference: maxChannelDifferenceWhite,
      transparentCanvasChanged: transparentCanvasChangedWhite,
      partialAlphaChanged: partialAlphaChangedWhite,
      fullyOpaqueArtworkChanged: opaqueArtworkChangedWhite,
    },
    customComparison: {
      differingPixelCount: customDiffPixels,
      maxChannelDifference: maxChannelDifferenceCustom,
      transparentCanvasChanged: transparentCanvasChangedCustom,
      partialAlphaChanged: partialAlphaChangedCustom,
      fullyOpaqueArtworkChanged: opaqueArtworkChangedCustom,
    },
  };
}

async function analyzeSvgFile(filePath) {
  const svg = await fs.readFile(filePath, "utf8");
  const normalized = normalizeSvg(svg);
  return {
    bytes: Buffer.byteLength(svg),
    sha256: sha256(Buffer.from(svg)),
    normalizedSha256: sha256(Buffer.from(normalized)),
    width: svg.match(/\bwidth=["']([^"']+)/i)?.[1] || null,
    height: svg.match(/\bheight=["']([^"']+)/i)?.[1] || null,
    viewBox: svg.match(/\bviewBox=["']([^"']+)/i)?.[1] || null,
    preserveAspectRatio:
      svg.match(/\bpreserveAspectRatio=["']([^"']+)/i)?.[1] || null,
    pathCount: countMatches(svg, /<path\b/gi),
  };
}

function parseIcoSizes(bytes) {
  if (bytes.length < 6 || bytes.readUInt16LE(2) !== 1) return [];
  const count = bytes.readUInt16LE(4);
  const sizes = [];
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16;
    if (offset + 16 > bytes.length) break;
    const width = bytes[offset] || 256;
    const height = bytes[offset + 1] || 256;
    sizes.push(`${width}x${height}`);
  }
  return sizes;
}

const collectedConsoleErrors = [];
const collectedNetworkErrors = [];

async function openPage(route, downloadDir) {
  await fs.rm(downloadDir, { recursive: true, force: true });
  await fs.mkdir(downloadDir, { recursive: true });
  const target = await createCdpTarget("about:blank");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const client = new CdpClient(ws);
  await client.send("Runtime.enable");
  await client.send("Log.enable");
  await client.send("Page.enable");
  await client.send("DOM.enable");
  await client.send("Network.enable");
  await client.send("Page.navigate", { url: `${baseUrl}${route}` });
  await client.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadDir,
  }).catch(() => null);
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadDir,
  }).catch(() => null);
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  }).catch(() => null);
  await waitForDocumentReady(client);
  await waitForValue(
    client,
    () => `(() => document.title)()`,
    30_000,
    (title) => /iLoveSVG/i.test(String(title || "")),
  );
  const identity = await evaluate(client, `(() => ({ title: document.title, h1: document.querySelector('h1')?.textContent || '', body: (document.body?.innerText || '').slice(0, 500) }))()`);
  if (!/iLoveSVG/i.test(identity.title) || /WRONG_APP_SENTINEL/.test(identity.body)) {
    throw new Error(`Wrong app detected on ${route}: ${JSON.stringify(identity)}.`);
  }
  await delay(1_500);
  return client;
}

async function closePage(client) {
  await client.send("Page.close").catch(() => null);
  await client.close().catch(() => null);
}

function collectClientLogs(client, route) {
  for (const entry of client.consoleErrors) collectedConsoleErrors.push({ route, ...entry });
  for (const entry of client.networkErrors) collectedNetworkErrors.push({ route, ...entry });
}

async function setFileInput(client, filePath) {
  await waitForValue(
    client,
    () => `(() => Boolean(document.querySelector('input[type="file"]')))()`,
    15_000,
    Boolean,
  );
  const bytes = await fs.readFile(filePath);
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const dropped = await evaluate(client, `(() => {
      const input = document.querySelector('input[type="file"]');
      const target = input?.closest('label') || input;
      if (!target) return { ok: false, reason: 'missing drop target' };
      const binary = atob(${JSON.stringify(bytes.toString("base64"))});
      const data = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) data[index] = binary.charCodeAt(index);
      const transfer = new DataTransfer();
      transfer.items.add(new File([data], ${JSON.stringify(path.basename(filePath))}, { type: ${JSON.stringify(mimeTypeForPath(filePath))} }));
      const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer });
      target.dispatchEvent(event);
      return { ok: true, files: Array.from(transfer.files).map((file) => file.name) };
    })()`);
    if (!dropped?.ok) throw new Error(`Could not drop ${path.basename(filePath)}: ${dropped?.reason || "event canceled"}`);
    try {
      await waitForValue(
        client,
        () => `(() => (document.body?.innerText || '').includes(${JSON.stringify(path.basename(filePath))}) || Array.from(document.querySelectorAll('input[type="file"]')).some((input) => Array.from(input.files || []).some((file) => file.name === ${JSON.stringify(path.basename(filePath))})))()`,
        8_000,
        Boolean,
      );
      return;
    } catch (error) {
      lastError = error;
      await delay(750);
    }
  }
  throw lastError || new Error(`Could not attach ${path.basename(filePath)}.`);
}

async function clickButtonByText(client, label) {
  const clicked = await waitForValue(
    client,
    () => `(() => {
      const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const button = Array.from(document.querySelectorAll('button')).find((item) => {
        const text = normalize(item.textContent);
        return text === ${JSON.stringify(label)} || text.startsWith(${JSON.stringify(label)});
      });
      if (!button || button.disabled) return null;
      button.scrollIntoView({ block: 'center', inline: 'nearest' });
      button.click();
      return true;
    })()`,
    20_000,
    Boolean,
  );
  if (!clicked) throw new Error(`Could not click ${label}.`);
}

async function waitForButtonEnabled(client, label, timeoutMs) {
  return waitForValue(
    client,
    () => `(() => { const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim(); const button = Array.from(document.querySelectorAll('button')).find((item) => { const text = normalize(item.textContent); return text === ${JSON.stringify(label)} || text.startsWith(${JSON.stringify(label)}); }); return Boolean(button && !button.disabled); })()`,
    timeoutMs,
    Boolean,
  );
}

async function setLabeledControl(client, label, value) {
  const result = await evaluate(client, `(() => {
    const normalize = (input) => String(input || '').replace(/\\s+/g, ' ').trim();
    const labelNode = Array.from(document.querySelectorAll('label')).find((node) => normalize(node.textContent).startsWith(${JSON.stringify(label)}));
    const control = labelNode?.querySelector('input, select, textarea');
    if (!control) return { ok: false, reason: 'missing control' };
    const value = ${JSON.stringify(value)};
    if (control instanceof HTMLInputElement && control.type === 'checkbox') {
      if (control.checked !== Boolean(value)) control.click();
      return { ok: true, value: control.checked };
    }
    const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : control instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setter) setter.call(control, String(value)); else control.value = String(value);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, value: control.value };
  })()`);
  if (!result?.ok) throw new Error(`Could not set ${label}: ${result?.reason || "unknown"}`);
  return result;
}

async function waitForDownloadedFile(dir, before, extension, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = [];
  while (Date.now() < deadline) {
    last = await safeReaddir(dir);
    const candidates = last.filter(
      (name) => !before.has(name) && name.toLowerCase().endsWith(extension) && !name.endsWith(".crdownload"),
    );
    if (candidates.length && !last.some((name) => name.endsWith(".crdownload"))) {
      const fullPath = path.join(dir, candidates[0]);
      const size = (await fs.stat(fullPath)).size;
      if (size > 0) return fullPath;
    }
    await delay(150);
  }
  throw new Error(`Timed out waiting for ${extension} download: ${last.join(", ")}`);
}

async function safeReaddir(dir) {
  return fs.readdir(dir).catch(() => []);
}

async function waitForDocumentReady(client) {
  return waitForValue(
    client,
    () => `(() => document.readyState)()`,
    30_000,
    (state) => state === "interactive" || state === "complete",
  );
}

async function waitForValue(client, expressionFactory, timeoutMs, ready = Boolean) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await evaluate(client, expressionFactory(), 8_000).catch((error) => ({
      error: error instanceof Error ? error.message : String(error),
    }));
    if (ready(last)) return last;
    await delay(200);
  }
  throw new Error(`Timed out waiting for browser state: ${JSON.stringify(last)}`);
}

async function evaluate(client, expression, timeoutMs = 12_000) {
  const response = await client.send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
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

async function createCdpTarget(url) {
  const version = await cdpJson("/json/version");
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const client = new CdpClient(ws);
  const { targetId } = await client.send("Target.createTarget", { url, background: false });
  await client.close().catch(() => null);
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const targets = await cdpJson("/json/list");
    const target = targets.find((candidate) => candidate.id === targetId);
    if (target?.webSocketDebuggerUrl) return target;
    await delay(100);
  }
  throw new Error(`Could not open browser target for ${url}.`);
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.eventWaiters = new Map();
    this.consoleErrors = [];
    this.networkErrors = [];
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id);
        clearTimeout(pending.timeout);
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
        else pending.resolve(message.result || {});
        return;
      }
      if (message.method === "Runtime.consoleAPICalled" && /error|warning/i.test(message.params?.type || "")) {
        this.consoleErrors.push({ type: message.params.type, text: (message.params.args || []).map((arg) => arg.value || arg.description || "").join(" ").slice(0, 300) });
      }
      if (message.method === "Log.entryAdded" && /error|warning/i.test(message.params?.entry?.level || "")) {
        this.consoleErrors.push({ type: message.params.entry.level, text: String(message.params.entry.text || "").slice(0, 300) });
      }
      if (message.method === "Network.loadingFailed") {
        this.networkErrors.push({ errorText: message.params?.errorText || "", type: message.params?.type || "", canceled: Boolean(message.params?.canceled) });
      }
      const waiters = this.eventWaiters.get(message.method);
      if (waiters?.length) {
        const waiter = waiters.shift();
        clearTimeout(waiter.timeout);
        waiter.resolve(message.params || {});
        if (!waiters.length) this.eventWaiters.delete(message.method);
      }
    });
  }

  waitForEvent(method, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const waiters = this.eventWaiters.get(method) || [];
        this.eventWaiters.set(method, waiters.filter((waiter) => waiter.resolve !== resolve));
        reject(new Error(`Timed out waiting for CDP event: ${method}`));
      }, timeoutMs);
      timeout.unref?.();
      const waiters = this.eventWaiters.get(method) || [];
      waiters.push({ resolve, reject, timeout });
      this.eventWaiters.set(method, waiters);
    });
  }

  send(method, params = {}, timeoutMs = 15_000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, timeoutMs);
      timeout.unref?.();
      this.pending.set(id, { resolve, reject, timeout });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    return new Promise((resolve) => {
      if (this.ws.readyState >= WebSocket.CLOSING) return resolve();
      this.ws.addEventListener("close", resolve, { once: true });
      this.ws.close();
      setTimeout(resolve, 500).unref?.();
    });
  }
}

async function cdpJson(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:${debugPort}${pathname}`, options);
  if (!response.ok) throw new Error(`CDP request failed: ${response.status}`);
  return response.json();
}

async function waitForCdp() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      await cdpJson("/json/version");
      return;
    } catch {
      await delay(200);
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

function normalizeSvg(svg) {
  return String(svg)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/>\s+</g, "><")
    .trim();
}

function mimeTypeForPath(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".svg":
      return "image/svg+xml";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "image/png";
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function countMatches(value, pattern) {
  return (String(value).match(pattern) || []).length;
}

function slug(value) {
  return String(value || "home").replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "home";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertComparison(condition, message) {
  if (!condition) throw new Error(message);
}

function compareJson(left, right) {
  return JSON.stringify(left).localeCompare(JSON.stringify(right));
}

async function stopSpawnedBrowser(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  if (await waitForChildExit(child, 2_000)) return;
  if (process.platform === "win32" && child.pid) {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.on("close", resolve);
      killer.on("error", resolve);
    });
    if (await waitForChildExit(child, 2_000)) return;
  }
  child.kill("SIGKILL");
  await waitForChildExit(child, 1_000);
}

function waitForChildExit(child, timeoutMs) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }
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

await main();
