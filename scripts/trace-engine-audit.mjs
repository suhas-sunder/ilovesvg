import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const requiredFiles = [
  "app/shared/tracing/types.ts",
  "app/shared/tracing/enginePolicy.ts",
  "app/shared/tracing/serverFallback.ts",
  "app/shared/tracing/serverFallback.client.ts",
  "app/shared/tracing/serverFallback.server.ts",
  "app/client/lib/tracing/useHybridTraceFetcher.ts",
  "app/client/lib/tracing/vtracerWorkerClient.ts",
  "app/shared/tracing/centerlineTrace.ts",
  "app/shared/tracing/svgPathStructureOptimizer.ts",
  "app/client/workers/centerline.worker.ts",
  "app/client/workers/vtracer.worker.ts",
  "app/types/culori.d.ts",
  "app/types/wasm-vtracer.d.ts",
];

const fatal = [];
const warnings = [];
let presetSummary = null;
let routeEnginePathSummary = null;

const textCache = new Map();

async function main() {
  for (const file of requiredFiles) {
    if (!(await exists(file))) {
      fatal.push(`Missing tracing architecture file: ${file}`);
    }
  }

  if (fatal.length === 0) {
    await auditTracingArchitecture();
  }
  await auditPresets();
  await auditRoutes();
  await auditServerRouteSafety();

  const report = {
    checkedAt: new Date().toISOString(),
    fatal,
    warnings,
    presetSummary,
    routeEnginePathSummary,
  };

  console.log(JSON.stringify(report, null, 2));

  if (fatal.length > 0) {
    process.exitCode = 1;
  }
}

async function auditPresets() {
  const source = await read("app/client/lib/converter/presetAdditions.ts");
  const blocks = source
    .split(/\n\s*\{\s*\n\s*id:\s*/g)
    .slice(1)
    .map((block) => `id: ${block}`);
  const ids = [];
  const categories = new Map();
  const intensities = new Map();
  const missingIntensity = [];
  const blockById = new Map();
  const idsByLabel = new Map();
  const idsBySettings = new Map();

  for (const block of blocks) {
    const id = block.match(/id:\s*"([^"]+)"/)?.[1];
    if (!id) continue;
    ids.push(id);
    blockById.set(id, block);
    const label = block.match(/label:\s*"([^"]+)"/)?.[1] || "";
    if (label) {
      idsByLabel.set(label, [...(idsByLabel.get(label) || []), id]);
    }

    const settingsBody = block.match(/settings:\s*\{([\s\S]*?)\n\s*\},?\s*\n\s*\}/)?.[1] || "";
    const settingsSignature = settingsBody.replace(/\s+/g, " ").trim();
    if (settingsSignature) {
      idsBySettings.set(settingsSignature, [
        ...(idsBySettings.get(settingsSignature) || []),
        id,
      ]);
    }

    const category = block.match(/category:\s*"([^"]+)"/)?.[1] || "unknown";
    categories.set(category, (categories.get(category) || 0) + 1);

    const intensity = block.match(/backendIntensity:\s*"([^"]+)"/)?.[1] || null;
    if (!intensity) {
      missingIntensity.push(id);
    } else {
      intensities.set(intensity, (intensities.get(intensity) || 0) + 1);
    }
  }

  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    fatal.push(`Duplicate trace preset ids: ${[...new Set(duplicateIds)].join(", ")}`);
  }
  const duplicateLabels = [...idsByLabel.entries()].filter(([, ids]) => ids.length > 1);
  if (duplicateLabels.length > 0) {
    fatal.push(
      `Duplicate trace preset labels: ${duplicateLabels
        .map(([label, ids]) => `${label} (${ids.join(", ")})`)
        .join("; ")}`,
    );
  }
  const duplicateSettings = [...idsBySettings.values()].filter(
    (ids) => ids.length > 1 && !isAllowedDuplicatePresetSettings(ids),
  );
  if (duplicateSettings.length > 0) {
    fatal.push(
      `Trace presets with duplicate settings: ${duplicateSettings
        .map((ids) => ids.join(", "))
        .join("; ")}`,
    );
  }
  if (missingIntensity.length > 0) {
    fatal.push(
      `Trace presets missing backendIntensity metadata: ${missingIntensity.join(", ")}`,
    );
  }

  const tunedExistingPresets = {
    "layered-detail": [
      "requestedPaletteCount: 28",
      'layerBuildMode: "stacked-overlap"',
      'paletteAlgorithm: "image-q-wuquant"',
      "layerOverlapPx: 1",
    ],
    "layered-flat-color": [
      "requestedPaletteCount: 16",
      'layerBuildMode: "per-color-cutout"',
      'gapFill: "close-small-gaps"',
    ],
    "layered-soft-poster": [
      "requestedPaletteCount: 12",
      'layerBuildMode: "stacked-overlap"',
      "layerOverlapPx: 0.8",
    ],
  };
  const newWorkflowPresets = {
    "ui-mockup-app-screen": [
      "requestedPaletteCount: 28",
      'layerBuildMode: "stacked-overlap"',
      'paletteDistance: "ciede2000"',
    ],
    "photo-many-colors": [
      "requestedPaletteCount: 32",
      'layerBuildMode: "per-color-cutout"',
      'paletteAlgorithm: "image-q-wuquant"',
    ],
    "filled-layers-smooth": [
      "requestedPaletteCount: 20",
      'gapFill: "overlap"',
      "layerOverlapPx: 1",
    ],
    "filled-layers-separate-colors": [
      "requestedPaletteCount: 16",
      'layerBuildMode: "per-color-cutout"',
      'gapFill: "none"',
    ],
    "clean-color-sticker": [
      "requestedPaletteCount: 20",
      'layerBuildMode: "stacked-overlap"',
      'removeWhite: false',
    ],
  };
  const centerlinePresets = {
    "stroke-trace-clean-lines": [
      'strokeOutputMode: "centerline"',
      "centerlineStrokeWidth",
      "centerlineSimplifyTolerance",
    ],
    "stroke-trace-bold-lines": [
      'strokeOutputMode: "centerline"',
      "centerlineStrokeWidth: 4",
    ],
    "centerline-sketch": [
      'strokeOutputMode: "centerline"',
      "centerlineMaxTraceSide: 1050",
    ],
    "single-line-drawing": [
      'strokeOutputMode: "centerline"',
      "centerlineSimplifyTolerance: 2.5",
    ],
  };
  const curatedPresetExpansion = {
    "sticker-soft-fill-outline": [
      'traceMode: "layered"',
      "requestedPaletteCount: 16",
      'layerBuildMode: "stacked-overlap"',
      "fillStrokeWidth: 2.6",
      "removeTransparent: true",
    ],
    "sticker-bold-ink-fill": [
      'traceMode: "layered"',
      "requestedPaletteCount: 14",
      'gapFill: "overlap"',
      "fillStrokeWidth: 3.25",
    ],
    "transparent-sticker-clean-color": [
      'traceMode: "layered"',
      "requestedPaletteCount: 12",
      "removeWhite: false",
      "removeTransparent: true",
    ],
    "mascot-fill-outline": [
      'traceMode: "layered"',
      "requestedPaletteCount: 20",
      'paletteDistance: "ciede2000"',
      "fillStrokeWidth: 2.1",
    ],
    "cute-character-fill-ink": [
      'traceMode: "layered"',
      "requestedPaletteCount: 18",
      "fillStrokeWidth: 1.7",
      "holeFillPx: 8",
    ],
    "icon-fill-stroke": [
      'traceMode: "layered"',
      "requestedPaletteCount: 8",
      "fillStrokeWidth: 1.4",
      "colorMergeTolerance: 18",
    ],
    "logo-color-ink-outline": [
      'traceMode: "layered"',
      "requestedPaletteCount: 10",
      "fillStrokeWidth: 1.5",
      "removeWhite: true",
    ],
    "transparent-logo-smooth-color": [
      'traceMode: "layered"',
      "requestedPaletteCount: 6",
      "removeWhite: true",
      "removeTransparent: true",
    ],
    "app-icon-smooth-color": [
      'traceMode: "layered"',
      "requestedPaletteCount: 8",
      'layerBuildMode: "stacked-overlap"',
      "posterize: true",
    ],
    "web-icon-flat-color": [
      'traceMode: "layered"',
      "requestedPaletteCount: 6",
      'layerBuildMode: "per-color-cutout"',
      "colorMergeTolerance: 22",
    ],
    "poster-soft-8-color": [
      'traceMode: "layered"',
      "requestedPaletteCount: 8",
      "posterizeStrength: 4",
      'gapFill: "overlap"',
    ],
    "poster-smooth-12-color": [
      'traceMode: "layered"',
      "requestedPaletteCount: 12",
      'paletteAlgorithm: "image-q-wuquant"',
      "layerOverlapPx: 1",
    ],
    "comic-poster-color": [
      'traceMode: "layered"',
      "requestedPaletteCount: 10",
      "fillStrokeWidth: 1.8",
      "edgeThickness: 2",
    ],
    "ui-screenshot-clean-regions": [
      'traceMode: "layered"',
      "requestedPaletteCount: 18",
      'paletteDistance: "ciede2000"',
      "minIslandPx: 6",
    ],
    "dashboard-screenshot-simplified": [
      'traceMode: "layered"',
      "requestedPaletteCount: 12",
      "colorMergeTolerance: 16",
      "layerTurdSize: 4",
    ],
    "product-mockup-flat-color": [
      'traceMode: "layered"',
      "requestedPaletteCount: 10",
      'layerBuildMode: "stacked-overlap"',
      "posterizeStrength: 5",
    ],
    "alpha-safe-layered-color": [
      'traceMode: "layered"',
      "requestedPaletteCount: 10",
      "removeWhite: false",
      "removeTransparent: true",
    ],
    "remove-white-smooth-color": [
      'traceMode: "layered"',
      "requestedPaletteCount: 8",
      "removeWhite: true",
      "transparent: true",
    ],
  };

  for (const [id, tokens] of Object.entries({
    ...tunedExistingPresets,
    ...newWorkflowPresets,
    ...centerlinePresets,
    ...curatedPresetExpansion,
  })) {
    const block = blockById.get(id) || "";
    if (!block) {
      fatal.push(`Layered/color quality preset is missing: ${id}`);
      continue;
    }
    for (const token of tokens) {
      if (!block.includes(token)) {
        fatal.push(`Preset ${id} is missing required layered-quality setting token: ${token}`);
      }
    }
  }

  presetSummary = {
    total: ids.length,
    categories: Object.fromEntries([...categories.entries()].sort()),
    intensities: Object.fromEntries([...intensities.entries()].sort()),
    tunedExistingLayeredPresets: Object.keys(tunedExistingPresets),
    newWorkflowLayeredPresets: Object.keys(newWorkflowPresets),
    centerlinePresets: Object.keys(centerlinePresets),
    curatedPresetExpansion: Object.keys(curatedPresetExpansion),
  };
}

function isAllowedDuplicatePresetSettings(ids) {
  void ids;
  return false;
}

async function auditTracingArchitecture() {
  const packageJson = JSON.parse(await read("package.json"));
  if (!packageJson.dependencies?.wasm_vtracer) {
    fatal.push("package.json does not include wasm_vtracer.");
  }
  for (const dependency of ["image-q", "culori"]) {
    if (!packageJson.dependencies?.[dependency]) {
      fatal.push(`package.json does not include ${dependency}.`);
    }
  }

  const types = await read("app/shared/tracing/types.ts");
  for (const token of [
    'export type TraceEngine = "auto" | "vtracer" | "potrace"',
    "export type NormalizedTraceSettings",
    "export type TraceResult",
    "engineUsed",
    "sourceKind",
    "LayerBuildMode",
    "requestedPaletteCount",
    "actualPaletteCount",
    "outputDetectedColors",
    "strokeOutputMode",
    "centerlineStrokeWidth",
  ]) {
    if (!types.includes(token)) {
      fatal.push(`Trace types are missing required token: ${token}`);
    }
  }

  const enginePolicy = await read("app/shared/tracing/enginePolicy.ts");
  for (const token of [
    "getTraceEngineDecision",
    "canRunVTracerClient",
    "CLIENT_MAX_BYTES",
    "CLIENT_MAX_PIXELS",
    "CLIENT_MAX_SIDE",
    "Layered color tracing is routed to VTracer",
    "current line-art/cut-file parity",
    "\"line-\"",
    "\"sketch\"",
    "\"drawing\"",
    "\"photo\"",
    "\"edge\"",
    "\"comics\"",
    "\"diagram\"",
    "\"sticker-clean\"",
    "\"sticker-thick\"",
    "\"sticker-smooth\"",
  ]) {
    if (!enginePolicy.includes(token)) {
      fatal.push(`Engine policy is missing expected routing/safety token: ${token}`);
    }
  }
  const vtracerTermsMatch = enginePolicy.match(
    /const VTRACER_PRESET_TERMS = \[([\s\S]*?)\];/,
  );
  const vtracerTermsBody = vtracerTermsMatch?.[1] || "";
  for (const forbidden of [
    "sketch",
    "drawing",
    "pencil",
    "photo",
    "edge",
    "comic",
    "comics",
    "ink",
    "inks",
    "diagram",
    "technical",
    "blueprint",
    "cut",
    "cricut",
    "vinyl",
    "scan",
    "lineart",
    "sticker",
  ]) {
    if (new RegExp(`["']${forbidden}["']`).test(vtracerTermsBody)) {
      fatal.push(
        `Engine policy must not treat single-trace parity family "${forbidden}" as VTracer-capable in auto mode.`,
      );
    }
  }
  if (/settings\.preprocess\s*===\s*["']edge["'][\s\S]{0,600}engine:\s*["']vtracer["']/.test(enginePolicy)) {
    fatal.push(
      "Engine policy regressed: edge/photo preprocessing alone must not route auto-mode single-trace work to VTracer.",
    );
  }
  if (/presetBackendIntensity[\s\S]{0,900}engine:\s*["']vtracer["']/.test(enginePolicy)) {
    fatal.push(
      "Engine policy regressed: slow/high-detail backend intensity alone must not route auto-mode single-trace work to VTracer.",
    );
  }

  const workerClient = await read("app/client/lib/tracing/vtracerWorkerClient.ts");
  for (const token of [
    "getTraceEngineDecision",
    "tryTraceCenterlineInClient",
    "centerline.worker.ts",
    "new Worker",
    "terminate()",
    "postMessage(",
    "engineUsed: \"vtracer\"",
    "45_000",
    "getUnusableTraceResultReason",
    "Browser tracing returned an empty SVG",
    "Browser tracing returned invalid SVG",
    "SVG with no drawable content",
    "oversized SVG",
    "too many paths",
    "path-heavy SVG output",
  ]) {
    if (!workerClient.includes(token)) {
      fatal.push(`VTracer worker client is missing required token: ${token}`);
    }
  }

  const centerlineTrace = await read("app/shared/tracing/centerlineTrace.ts");
  for (const token of [
    "traceCenterlineRasterToSvg",
    "buildBinaryLineMask",
    "skeletonizeZhangSuen",
    "fill=\"none\"",
    "stroke-linecap=\"round\"",
    "engineUsed: \"centerline\"",
    "MAX_CENTERLINE_PIXELS",
    "MAX_SKELETON_PIXELS",
  ]) {
    if (!centerlineTrace.includes(token)) {
      fatal.push(`Centerline trace module is missing required token: ${token}`);
    }
  }

  const centerlineWorker = await read("app/client/workers/centerline.worker.ts");
  for (const token of [
    "traceCenterlineRasterToSvg",
    "createImageBitmap",
    "OffscreenCanvas",
    "CENTERLINE_MAX_TRACE_SIDE",
    "postProgress",
  ]) {
    if (!centerlineWorker.includes(token)) {
      fatal.push(`Centerline worker is missing required token: ${token}`);
    }
  }

  const hybridFetcher = await read("app/client/lib/tracing/useHybridTraceFetcher.ts");
  for (const token of [
    "useHybridTraceFetcher",
    "tryTraceRasterInClient",
    "formDataToTraceSettings",
    "requestedEngine === \"vtracer\"",
    "Browser VTracer was not used",
    "engineUsed: data.engineUsed || \"potrace\"",
  ]) {
    if (!hybridFetcher.includes(token)) {
      fatal.push(`Shared hybrid fetcher is missing expected runtime token: ${token}`);
    }
  }

  const worker = await read("app/client/workers/vtracer.worker.ts");
  for (const token of [
    "wasm_vtracer_bg.wasm?url",
    "WebAssembly.instantiate",
    "createImageBitmap",
    "OffscreenCanvas",
    "convertImageToSvg",
    "postProgress",
    "removeSelectedColors",
    "extractEditableLayers",
    "buildPaletteSync",
    "applyPaletteSync",
    "differenceCiede2000",
    "quantizeLayeredPixels",
    "applyLayerMaskProcessing",
    "removeTinyComponents",
    "fillTinyHoles",
    "dilateMask",
    "layerBuildMode",
    "requestedPaletteCount",
    "actualPaletteCount",
    "outputDetectedColors",
  ]) {
    if (!worker.includes(token)) {
      fatal.push(`VTracer worker is missing required token: ${token}`);
    }
  }
  if (/from\s+["']wasm_vtracer["']/.test(worker)) {
    fatal.push(
      "VTracer worker imports the package entrypoint directly; use the manual .wasm?url loader.",
    );
  }

  const viteConfig = await read("vite.config.ts");
  if (!viteConfig.includes("worker:") || !viteConfig.includes('format: "es"')) {
    fatal.push("vite.config.ts is missing explicit ES module worker configuration.");
  }
  for (const token of [
    "tracingServerFallbackResolver",
    "options.ssr",
    "serverFallback.server.ts",
    "serverFallback.client.ts",
  ]) {
    if (!viteConfig.includes(token)) {
      fatal.push(`vite.config.ts is missing shared fallback alias token: ${token}`);
    }
  }

  const serverFallback = await read("app/shared/tracing/serverFallback.server.ts");
  for (const token of [
    "runSharedRasterNormalization",
    "runSharedPotraceSvgTrace",
    "runSharedLayeredColorTrace",
    "annotateSharedSingleTraceSvg",
    "neutralizeTransparencyCheckerboard",
    "normalizeRasterForTrace",
    "traceBitmapToSvg",
    "createLayeredColorSvg",
  ]) {
    if (!serverFallback.includes(token)) {
      fatal.push(`Shared server fallback adapter is missing required token: ${token}`);
    }
  }

  const layeredServer = await read("app/utils/svgLayerTrace.server.ts");
  if (!layeredServer.includes("export const MAX_LAYER_COUNT = 40")) {
    fatal.push("Server layered fallback must allow detailed layered presets above the old 12-layer cap.");
  }

  const home = await read("app/routes/home.tsx");
  for (const token of [
    "tryTraceRasterInClient",
    "handleSuccessfulTraceData",
    "activeClientTraceCount",
    "engineUsed: \"potrace\"",
    "/api/batch-svg",
  ]) {
    if (!home.includes(token)) {
      fatal.push(`Home route is missing expected tracing integration token: ${token}`);
    }
  }
}

async function auditRoutes() {
  const routeFiles = await listRouteFiles();
  const routeIds = routeFiles
    .filter((file) => !file.startsWith("api."))
    .map((file) => file.replace(/\.tsx$/, ""));
  const routeCapabilities = await read("app/client/lib/converter/routeCapabilities.ts");
  const missingCapabilities = routeIds.filter(
    (routeId) => !hasRouteCapability(routeCapabilities, routeId),
  );
  if (missingCapabilities.length > 0) {
    fatal.push(
      `Routes missing route capability entries: ${missingCapabilities.join(", ")}`,
    );
  }

  const routeLocalViolations = [];
  for (const file of routeFiles) {
    const text = await read(`app/routes/${file}`);
    if (
      text.includes("normalizeRasterForTrace") ||
      text.includes("createLayeredColorSvg") ||
      text.includes("traceBitmapToSvg") ||
      text.includes("../utils/imagePreprocess.server") ||
      text.includes("../utils/svgLayerTrace.server") ||
      text.includes("~/utils/potraceCompat") ||
      text.includes("~/shared/tracing/serverFallback.server")
    ) {
      routeLocalViolations.push(file);
    }
  }

  if (routeLocalViolations.length > 0) {
    fatal.push(
      `${routeLocalViolations.length} route files still contain route-local direct tracing imports/calls: ${routeLocalViolations.join(", ")}`,
    );
  }

  await auditRouteEnginePaths(routeFiles, routeCapabilities);
}

async function auditRouteEnginePaths(routeFiles, routeCapabilitiesSource) {
  const routeGroups = parseRouteGroups(routeCapabilitiesSource);
  const rasterRouteIds = [...routeGroups.entries()]
    .filter(([, group]) =>
      group === "raster-to-svg" || group === "cricut" || group === "layered",
    )
    .map(([routeId]) => routeId)
    .sort((a, b) => a.localeCompare(b));

  const routeFileSet = new Set(routeFiles.map((file) => file.replace(/\.tsx$/, "")));
  const incompleteServerFirst = [];
  const rows = [];

  for (const routeId of rasterRouteIds) {
    if (!routeFileSet.has(routeId)) continue;
    const file = `${routeId}.tsx`;
    const text = await readResolvedRouteText(file);
    const group = routeGroups.get(routeId);
    const usesSharedHybrid =
      text.includes("useHybridTraceFetcher") ||
      text.includes("tryTraceRasterInClient");
    const usesPlainServerFetcher = /useFetcher<ServerResult>\(\)/.test(text);
    const returnsEngineUsed =
      text.includes("engineUsed") ||
      text.includes("useHybridTraceFetcher") ||
      text.includes("tryTraceRasterInClient");
    const expectedPolicy = getExpectedRoutePolicy(routeId, group);
    const status = usesSharedHybrid
      ? expectedPolicy === "potrace-primary-by-policy"
        ? "potrace-primary-by-policy"
        : "client-vtracer-capable"
      : "incomplete-server-first";

    if (
      !usesSharedHybrid ||
      (usesPlainServerFetcher && routeId !== "home") ||
      !returnsEngineUsed
    ) {
      incompleteServerFirst.push(
        `${routeId} (${!usesSharedHybrid ? "missing shared hybrid path" : usesPlainServerFetcher ? "plain useFetcher path" : "missing engineUsed"})`,
      );
    }

    rows.push({
      routeId,
      group,
      acceptsRasterInput: true,
      acceptsSvgInput: routeId === "home" || routeId.includes("image-to"),
      supportsLayeredOutput: group === "layered" || text.includes("traceMode"),
      supportsBatch: text.includes("batch") || routeId === "home",
      normalConversionPath: usesSharedHybrid
        ? routeId === "home"
          ? "home client engine router"
          : "shared useHybridTraceFetcher"
        : "plain server action",
      callsSharedClientEngineRouter: usesSharedHybrid,
      submitsDirectlyToServerAsNormalPath:
        !usesSharedHybrid || (usesPlainServerFetcher && routeId !== "home"),
      returnsEngineUsed,
      expectedPolicy,
      status,
    });
  }

  routeEnginePathSummary = {
    totalRasterRoutes: rows.length,
    clientVTracerCapable: rows.filter((row) => row.status === "client-vtracer-capable").length,
    potracePrimaryByPolicy: rows.filter((row) => row.status === "potrace-primary-by-policy").length,
    incompleteServerFirst: rows.filter((row) => row.status === "incomplete-server-first").length,
    routes: rows,
  };

  if (incompleteServerFirst.length > 0) {
    fatal.push(
      `Raster routes still server-first instead of shared hybrid/client-engine routing: ${incompleteServerFirst.join(", ")}`,
    );
  }
}

async function readResolvedRouteText(file) {
  const text = await read(`app/routes/${file}`);
  const templateImport = text.match(/import\s+Template(?:\s*,\s*\{[^}]+\})?\s+from\s+"\.\/([^"]+)"/);
  if (!templateImport) return text;

  const templateFile = `${templateImport[1]}.tsx`;
  if (!(await exists(`app/routes/${templateFile}`))) return text;
  return `${text}\n${await read(`app/routes/${templateFile}`)}`;
}

function parseRouteGroups(source) {
  const match = source.match(/const ROUTE_GROUPS:[\s\S]*?= \{([\s\S]*?)\};/);
  const body = match?.[1] || "";
  const groups = new Map();
  for (const routeMatch of body.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)) {
    groups.set(routeMatch[1], routeMatch[2]);
  }
  for (const routeMatch of body.matchAll(/\b([a-zA-Z][\w-]*)\s*:\s*"([^"]+)"/g)) {
    groups.set(routeMatch[1], routeMatch[2]);
  }
  return groups;
}

function getExpectedRoutePolicy(routeId, group) {
  if (group === "layered") return "client-vtracer-capable";
  if (
    /line-art|black-and-white|logo|scan|cricut|vinyl|laser|silhouette|sketch|drawing|photo|outline/.test(
      routeId,
    )
  ) {
    return "potrace-primary-by-policy";
  }
  return "client-vtracer-capable";
}

async function auditServerRouteSafety() {
  const routeFiles = await listRouteFiles();
  const server = await read("server.js");
  const hasGlobalOriginProtection =
    server.includes("REQUEST_ORIGIN_BLOCKED") &&
    server.includes("hasMatchingOrigin") &&
    server.includes("req.method.toUpperCase() !== \"POST\"");
  const multipartRoutes = [];
  for (const file of routeFiles) {
    const text = await read(`app/routes/${file}`);
    if (!text.includes("parseMultipartFormData")) continue;
    const missing = [];

    if (!hasGlobalOriginProtection && !text.includes("validateSameOrigin")) {
      missing.push("validateSameOrigin");
    }
    if (
      !text.includes("checkBackendConversionRateLimit") &&
      !text.includes("checkBackendRateLimit")
    ) {
      missing.push("backend rate limit");
    }
    if (
      !text.includes("validateFileSignature") &&
      !text.includes("isSupportedFontSignature")
    ) {
      missing.push("file/signature validation");
    }
    if (!text.includes("createMemoryUploadHandler")) {
      missing.push("createMemoryUploadHandler");
    }
    if (missing.length > 0) {
      multipartRoutes.push(`${file} missing ${missing.join(", ")}`);
    }
  }

  if (multipartRoutes.length > 0) {
    warnings.push(
      `Multipart route safety should be reviewed: ${multipartRoutes.join("; ")}`,
    );
  }

  const batchRoute = await read("app/routes/api.batch-svg.tsx");
  if (
    !batchRoute.includes("export { action } from \"./home\"") &&
    !batchRoute.includes("action as homeAction")
  ) {
    warnings.push("api.batch-svg.tsx is not reusing the home batch action.");
  }
}

async function listRouteFiles() {
  const routesDir = path.join(rootDir, "app", "routes");
  return (await fs.readdir(routesDir))
    .filter((file) => file.endsWith(".tsx"))
    .sort((a, b) => a.localeCompare(b));
}

function hasRouteCapability(source, routeId) {
  const escaped = escapeRegExp(routeId);
  return (
    new RegExp(`["']${escaped}["']\\s*:`).test(source) ||
    new RegExp(`\\b${escaped}\\s*:`).test(source)
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(rootDir, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function read(relativePath) {
  if (!textCache.has(relativePath)) {
    textCache.set(
      relativePath,
      fs.readFile(path.join(rootDir, relativePath), "utf8"),
    );
  }
  return textCache.get(relativePath);
}

await main();
