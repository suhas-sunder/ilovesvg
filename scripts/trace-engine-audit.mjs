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
  "app/client/lib/tracing/vtracerWorkerClient.ts",
  "app/client/workers/vtracer.worker.ts",
  "app/types/wasm-vtracer.d.ts",
];

const fatal = [];
const warnings = [];
let presetSummary = null;

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

  for (const block of blocks) {
    const id = block.match(/id:\s*"([^"]+)"/)?.[1];
    if (!id) continue;
    ids.push(id);

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
  if (missingIntensity.length > 0) {
    fatal.push(
      `Trace presets missing backendIntensity metadata: ${missingIntensity.join(", ")}`,
    );
  }

  presetSummary = {
    total: ids.length,
    categories: Object.fromEntries([...categories.entries()].sort()),
    intensities: Object.fromEntries([...intensities.entries()].sort()),
  };
}

async function auditTracingArchitecture() {
  const packageJson = JSON.parse(await read("package.json"));
  if (!packageJson.dependencies?.wasm_vtracer) {
    fatal.push("package.json does not include wasm_vtracer.");
  }

  const types = await read("app/shared/tracing/types.ts");
  for (const token of [
    'export type TraceEngine = "auto" | "vtracer" | "potrace"',
    "export type NormalizedTraceSettings",
    "export type TraceResult",
    "engineUsed",
    "sourceKind",
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
  ]) {
    if (!enginePolicy.includes(token)) {
      fatal.push(`Engine policy is missing expected routing/safety token: ${token}`);
    }
  }

  const workerClient = await read("app/client/lib/tracing/vtracerWorkerClient.ts");
  for (const token of [
    "getTraceEngineDecision",
    "new Worker",
    "worker.terminate",
    "worker.postMessage",
    "engineUsed: \"vtracer\"",
    "45_000",
  ]) {
    if (!workerClient.includes(token)) {
      fatal.push(`VTracer worker client is missing required token: ${token}`);
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
    "serverFallback$/",
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

  const home = await read("app/routes/home.tsx");
  for (const token of [
    "tryTraceRasterInClient",
    "handleSuccessfulTraceData",
    "clientTracing",
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
