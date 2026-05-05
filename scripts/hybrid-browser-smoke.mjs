import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import sharp from "sharp";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const baseUrl = getSmokeBaseUrl();
const debugPort = Number(process.env.CDP_PORT || 9237);
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = path.join(os.tmpdir(), "ilovesvg-hybrid-browser-smoke", String(debugPort));
const profileDir = path.join(tmpDir, "profile");
const fixturesDir = path.join(tmpDir, "fixtures");
const downloadsDir = path.join(tmpDir, "downloads");

const RASTER_ROUTES = [
  { path: "/", id: "home", file: "png", policy: "client", hasVTracerPreset: true, hasPotracePreset: true, defaultEngine: "potrace" },
  { path: "/black-and-white-image-to-svg-converter", id: "black-and-white-image-to-svg-converter", file: "png", policy: "potrace" },
  { path: "/black-and-white-image-to-svg-for-cricut", id: "black-and-white-image-to-svg-for-cricut", file: "png", policy: "potrace" },
  { path: "/cricut-svg-converter", id: "cricut-svg-converter", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/drawing-to-svg-converter", id: "drawing-to-svg-converter", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/drawing-to-svg-for-cricut", id: "drawing-to-svg-for-cricut", file: "png", policy: "potrace" },
  { path: "/icon-to-svg-converter", id: "icon-to-svg-converter", file: "png", policy: "client", hasVTracerPreset: true, hasPotracePreset: false },
  { path: "/image-to-layered-svg-for-cricut", id: "image-to-layered-svg-for-cricut", file: "png", policy: "client", hasVTracerPreset: true, hasPotracePreset: false, defaultEngine: "vtracer" },
  { path: "/image-to-svg-for-cricut", id: "image-to-svg-for-cricut", file: "png", policy: "potrace" },
  { path: "/image-to-svg-outline", id: "image-to-svg-outline", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/jpeg-to-svg-converter", id: "jpeg-to-svg-converter", file: "jpg", policy: "client", hasVTracerPreset: true, hasPotracePreset: true },
  { path: "/jpeg-to-svg-for-cricut", id: "jpeg-to-svg-for-cricut", file: "jpg", policy: "potrace" },
  { path: "/jpg-to-layered-svg-for-cricut", id: "jpg-to-layered-svg-for-cricut", file: "jpg", policy: "client", hasVTracerPreset: true, hasPotracePreset: false, defaultEngine: "vtracer" },
  { path: "/jpg-to-svg-converter", id: "jpg-to-svg-converter", file: "jpg", policy: "client", hasVTracerPreset: true, hasPotracePreset: true },
  { path: "/jpg-to-svg-for-cricut", id: "jpg-to-svg-for-cricut", file: "jpg", policy: "potrace" },
  { path: "/layered-svg-for-cricut", id: "layered-svg-for-cricut", file: "png", policy: "client", hasVTracerPreset: true, hasPotracePreset: false, defaultEngine: "vtracer" },
  { path: "/line-art-to-svg-converter", id: "line-art-to-svg-converter", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/line-art-to-svg-for-cricut", id: "line-art-to-svg-for-cricut", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/logo-to-layered-svg-for-cricut", id: "logo-to-layered-svg-for-cricut", file: "png", policy: "client", hasVTracerPreset: true, hasPotracePreset: false, defaultEngine: "vtracer" },
  { path: "/logo-to-svg-converter", id: "logo-to-svg-converter", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/logo-to-svg-for-cricut", id: "logo-to-svg-for-cricut", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/photo-to-svg-for-cricut", id: "photo-to-svg-for-cricut", file: "jpg", policy: "potrace", defaultEngine: "potrace" },
  { path: "/photo-to-svg-outline", id: "photo-to-svg-outline", file: "jpg", policy: "potrace", defaultEngine: "potrace" },
  { path: "/png-to-layered-svg-for-cricut", id: "png-to-layered-svg-for-cricut", file: "png", policy: "client", hasVTracerPreset: true, hasPotracePreset: false, defaultEngine: "vtracer" },
  { path: "/png-to-svg-converter", id: "png-to-svg-converter", file: "png", policy: "client", hasVTracerPreset: true, hasPotracePreset: true },
  { path: "/png-to-svg-for-cricut", id: "png-to-svg-for-cricut", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/png-to-svg-for-cricut-print-then-cut", id: "png-to-svg-for-cricut-print-then-cut", file: "png", policy: "potrace" },
  { path: "/png-to-svg-for-cricut-stickers", id: "png-to-svg-for-cricut-stickers", file: "png", policy: "potrace" },
  { path: "/png-to-svg-for-cricut-vinyl", id: "png-to-svg-for-cricut-vinyl", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/png-to-svg-for-etsy", id: "png-to-svg-for-etsy", file: "png", policy: "client", hasVTracerPreset: true, hasPotracePreset: true },
  { path: "/png-to-svg-for-laser-cutting", id: "png-to-svg-for-laser-cutting", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/png-to-svg-for-silhouette", id: "png-to-svg-for-silhouette", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/scan-to-svg-converter", id: "scan-to-svg-converter", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/sketch-to-svg-converter", id: "sketch-to-svg-converter", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/sketch-to-svg-for-cricut", id: "sketch-to-svg-for-cricut", file: "png", policy: "potrace" },
  { path: "/sticker-to-svg-converter", id: "sticker-to-svg-converter", file: "png", policy: "client", hasVTracerPreset: true, hasPotracePreset: true },
  { path: "/sticker-to-svg-for-cricut", id: "sticker-to-svg-for-cricut", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/webp-to-svg-converter", id: "webp-to-svg-converter", file: "webp", policy: "client", hasVTracerPreset: true, hasPotracePreset: true },
  { path: "/webp-to-svg-for-cricut", id: "webp-to-svg-for-cricut", file: "webp", policy: "potrace", defaultEngine: "potrace" },
];

const SMOKE_ROUTES = buildSmokeScenarios();

async function main() {
  const browserPath = await findBrowserExecutable();
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.mkdir(downloadsDir, { recursive: true });
  const fixtures = await createFixtures();

  const browser = spawn(browserPath, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-component-extensions-with-background-pages",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ], {
    stdio: "ignore",
    windowsHide: true,
  });

  const results = [];
  let batchZip = null;
  try {
    await waitForCdp();
    const routes = process.env.ROUTE_FILTER
      ? SMOKE_ROUTES.filter(
          (route) =>
            route.path === process.env.ROUTE_FILTER &&
            (!process.env.SCENARIO_FILTER || route.scenario === process.env.SCENARIO_FILTER),
        )
      : SMOKE_ROUTES;
    for (const route of routes) {
      console.error(`[hybrid-browser] ${route.path} (${route.scenario})`);
      const result = await runRouteSmoke(route, fixtures[route.file]);
      results.push(result);
      console.error(
        `[hybrid-browser] ${route.path} ${route.scenario} -> ${result.engineUsed || "none"} ${result.ok ? "ok" : "failed"}`,
      );
    }

    if (!process.env.ROUTE_FILTER || process.env.INCLUDE_BATCH === "1") {
      console.error("[hybrid-browser] home batch ZIP");
      batchZip = await runBatchZipSmoke(fixtures);
      console.error(`[hybrid-browser] home batch ZIP -> ${batchZip.ok ? "ok" : "failed"}`);
    }
  } finally {
    browser.kill();
  }

  const report = {
    baseUrl,
    checkedAt: new Date().toISOString(),
    browserPath,
    routes: results,
    batchZip,
  };

  console.log(JSON.stringify(report, null, 2));

  const failures = results.filter((result) => !result.ok);
  if (batchZip && !batchZip.ok) failures.push(batchZip);
  if (failures.length > 0) {
    process.exit(1);
  }
}

function buildSmokeScenarios() {
  const scenarios = [];
  for (const route of RASTER_ROUTES) {
    scenarios.push({
      ...route,
      scenario: "default",
      mode: "default",
      expectedEngine: route.defaultEngine || null,
      optional: false,
    });
    if (route.hasVTracerPreset) {
      scenarios.push({
        ...route,
        scenario: "vtracer-preset",
        mode: "vtracer",
        expectedEngine: "vtracer",
        optional: false,
      });
    }
    if (route.hasPotracePreset) {
      scenarios.push({
        ...route,
        scenario: "potrace-preset",
        mode: "potrace",
        expectedEngine: "potrace",
        optional: true,
      });
    }
  }
  return scenarios;
}

async function runRouteSmoke(route, fixturePath) {
  const client = await openTab(`${baseUrl}${route.path}`);
  const errors = [];
  const network = [];
  let selectedPreset = null;
  let convertButton = null;
  client.onEvent((message) => {
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params?.exceptionDetails;
      const text =
        details?.exception?.description ||
        details?.exception?.value ||
        details?.text ||
        "Runtime exception";
      if (!isIgnorableDevConsoleMessage(text)) errors.push(text);
    }
    if (message.method === "Log.entryAdded") {
      const entry = message.params?.entry;
      const text = entry?.text || "Browser log error";
      if (entry?.level === "error" && !isIgnorableDevConsoleMessage(text)) {
        errors.push(text);
      }
    }
    if (message.method === "Network.requestWillBeSent") {
      const request = message.params?.request;
      if (request?.url?.startsWith(baseUrl)) {
        network.push({ type: "request", method: request.method, url: request.url });
      }
    }
    if (message.method === "Network.responseReceived") {
      const response = message.params?.response;
      if (response?.url?.startsWith(baseUrl)) {
        network.push({ type: "response", status: response.status, url: response.url });
      }
    }
    if (message.method === "Network.loadingFailed") {
      network.push({
        type: "failed",
        errorText: message.params?.errorText,
        requestId: message.params?.requestId,
      });
    }
  });

  try {
    await client.send("Runtime.enable");
    await client.send("Log.enable");
    await client.send("Page.enable");
    await client.send("DOM.enable");
    await client.send("Network.enable");
    await waitForDocumentReady(client);
    await evaluate(client, `(() => { window.__ILOVESVG_HYBRID_TRACE_DEBUG__ = []; return true; })()`);
    await delay(1_000);

    await setFileInput(client, fixturePath);
    await waitForValue(client, () => textIncludesExpression(path.basename(fixturePath)), 8_000);

    let output = null;
    if (route.mode === "vtracer") {
      selectedPreset = await selectVTracerPreset(client, route);
      if (!selectedPreset) {
        throw new Error("Could not select a VTracer-eligible preset.");
      }
    } else if (route.mode === "potrace") {
      selectedPreset = await selectPotracePreset(client, route);
      if (!selectedPreset) {
        if (route.optional) {
          return {
            route: route.path,
            scenario: route.scenario,
            mode: route.mode,
            expectedEngine: route.expectedEngine,
            engineUsed: null,
            selectedPreset: null,
            skipped: true,
            skipReason: "No Potrace-first preset found on this route.",
            ok: true,
          };
        }
        throw new Error("Could not select a Potrace-first preset.");
      }
    }

    output = await waitForOutput(
      client,
      route.mode === "default" ? 4_000 : 60_000,
      route.expectedEngine,
    ).catch(() => null);

    if (!output) {
      convertButton = await clickConvertButton(client);
      output = await waitForOutput(
        client,
        60_000,
        route.mode === "vtracer" ? route.expectedEngine : null,
      );
    } else {
      convertButton = "preset-triggered conversion";
    }
    const copyDownload = await evaluate(client, `(() => {
      const text = document.body.innerText || "";
      return {
        hasCopy: /Copy SVG/i.test(text),
        hasDownload: /Download/i.test(text),
        hasSettings: /Settings/i.test(text),
      };
    })()`);
    const actions = await verifyOutputActions(client, route, output.engineUsed);

    const ok =
      (!route.expectedEngine || output.engineUsed === route.expectedEngine) &&
      !output.hasGenericFailure &&
      output.hasOutput &&
      output.previewDecoded &&
      !output.hasBrokenPreview &&
      !output.hasDerivedLabel &&
      copyDownload.hasCopy &&
      copyDownload.hasDownload &&
      actions.copyOk &&
      actions.downloadOk &&
      actions.updatePreviewOk &&
      errors.length === 0;

    return {
      route: route.path,
      scenario: route.scenario,
      mode: route.mode,
      expectedEngine: route.expectedEngine,
      engineUsed: output.engineUsed,
      selectedPreset,
      convertButton,
      hasOutput: output.hasOutput,
      previewDecoded: output.previewDecoded,
      hasBrokenPreview: output.hasBrokenPreview,
      hasDerivedLabel: output.hasDerivedLabel,
      hasCopy: copyDownload.hasCopy,
      hasDownload: copyDownload.hasDownload,
      hasSettings: copyDownload.hasSettings,
      actions,
      warnings: output.warnings,
      metrics: output.metrics,
      capabilities: output.capabilities,
      traceDebug: await readTraceDebug(client),
      consoleErrors: errors,
      network,
      ok,
      failure: ok
        ? null
        : route.expectedEngine
          ? `Expected ${route.expectedEngine}, saw ${output.engineUsed || "none"}.`
          : `Expected any engineUsed, saw ${output.engineUsed || "none"}.`,
    };
  } catch (error) {
    const debug = await getPageDebugState(client).catch((debugError) => ({
      error: debugError instanceof Error ? debugError.message : String(debugError),
    }));
    return {
      route: route.path,
      scenario: route.scenario,
      mode: route.mode,
      expectedEngine: route.expectedEngine,
      engineUsed: null,
      selectedPreset,
      convertButton,
      hasOutput: false,
      hasCopy: false,
      hasDownload: false,
      hasSettings: false,
      actions: null,
      consoleErrors: errors,
      network,
      traceDebug: await readTraceDebug(client).catch(() => []),
      ok: false,
      failure: error instanceof Error ? error.message : String(error),
      debug,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function runBatchZipSmoke(fixtures) {
  const client = await openTab(`${baseUrl}/`);
  const errors = [];
  const batchResponseIds = [];
  const network = [];
  client.onEvent((message) => {
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params?.exceptionDetails;
      const text =
        details?.exception?.description ||
        details?.exception?.value ||
        details?.text ||
        "Runtime exception";
      if (!isIgnorableDevConsoleMessage(text)) errors.push(text);
    }
    if (message.method === "Log.entryAdded") {
      const entry = message.params?.entry;
      const text = entry?.text || "Browser log error";
      if (entry?.level === "error" && !isIgnorableDevConsoleMessage(text)) {
        errors.push(text);
      }
    }
    if (message.method === "Network.requestWillBeSent") {
      const request = message.params?.request;
      if (request?.url?.startsWith(baseUrl)) {
        network.push({ type: "request", method: request.method, url: request.url });
      }
    }
    if (message.method === "Network.responseReceived") {
      const response = message.params?.response;
      if (response?.url?.includes("/api/batch-svg")) {
        batchResponseIds.push(message.params.requestId);
      }
      if (response?.url?.startsWith(baseUrl)) {
        network.push({ type: "response", status: response.status, url: response.url });
      }
    }
  });

  try {
    await client.send("Runtime.enable");
    await client.send("Log.enable");
    await client.send("Page.enable");
    await client.send("DOM.enable");
    await client.send("Network.enable");
    await waitForDocumentReady(client);
    await evaluate(client, `(() => { window.__ILOVESVG_HYBRID_TRACE_DEBUG__ = []; return true; })()`);
    await delay(1_000);

    await setFileInput(client, fixtures.png);
    await waitForValue(client, () => textIncludesExpression(path.basename(fixtures.png)), 8_000);
    const selectedPreset = await selectVTracerPreset(client, { path: "/" });
    if (!selectedPreset) throw new Error("Could not select VTracer preset for batch setup.");
    const initialOutput = await waitForOutput(client, 60_000, "vtracer");
    if (!initialOutput.hasOutput) throw new Error("Initial VTracer output did not render.");

    await clickButtonMatching(client, "/Settings/i");
    await clickButtonMatching(client, "/Batch conversion/i");
    await setFileInputFilesFromBuffers(client, 'input[type="file"][multiple]', [
      fixtures.png,
      fixtures.jpg,
      fixtures.webp,
    ]);
    await waitForValue(client, () => textIncludesExpression("3 files selected"), 8_000);

    await evaluate(client, `(() => {
      const NativeWorker = window.Worker;
      if (!NativeWorker || window.__ILOVESVG_BATCH_WORKER_PATCHED__) return false;
      window.__ILOVESVG_BATCH_WORKER_PATCHED__ = true;
      window.__ILOVESVG_BATCH_WORKER_EVENTS__ = [];
      let shouldFail = true;
      window.Worker = function(url, options) {
        const href = String(url);
        const forcedFailure = shouldFail && /vtracer\\.worker/i.test(href);
        window.__ILOVESVG_BATCH_WORKER_EVENTS__.push({ href, forcedFailure });
        if (forcedFailure) {
          shouldFail = false;
          throw new Error("__batch_forced_vtracer_failure__");
        }
        return new NativeWorker(url, options);
      };
      window.Worker.prototype = NativeWorker.prototype;
      return true;
    })()`);

    await clickButtonMatching(client, "/Convert 3 to ZIP/i");
    const progressSeen = await waitForValue(
      client,
      () => `(() => /Converting \\d+\\/3/i.test(document.body.innerText || ""))()`,
      5_000,
    ).catch(() => false);
    const doneState = await waitForValue(
      client,
      () => `(() => {
        const text = document.body.innerText || "";
        return {
          hasZipButton: /Download ZIP/i.test(text),
          text,
          info: (text.match(/\\d+ files converted\\.[^\\n]*/i) || [null])[0],
        };
      })()`,
      90_000,
      (value) => value?.hasZipButton,
    );

    const batchResponses = [];
    for (const requestId of batchResponseIds) {
      try {
        const body = await client.send("Network.getResponseBody", { requestId });
        batchResponses.push(JSON.parse(body.body || "{}"));
      } catch (error) {
        batchResponses.push({ error: error instanceof Error ? error.message : String(error) });
      }
    }

    const before = new Set(await listDownloads());
    await configureDownloads(client).catch(() => {});
    await clickButtonMatching(client, "/Download ZIP/i");
    const zipFile = await waitForDownload(before, ".zip", 12_000);
    const zipPath = path.join(downloadsDir, zipFile);
    const zipBytes = await fs.readFile(zipPath);
    const entries = unzipSync(new Uint8Array(zipBytes));
    const entryNames = Object.keys(entries);
    const svgEntries = entryNames.filter((entry) => entry.toLowerCase().endsWith(".svg"));
    const invalidSvgEntries = svgEntries.filter(
      (entry) => !/<svg[\s>]/i.test(Buffer.from(entries[entry]).toString("utf8")),
    );
    const workerEvents = await evaluate(client, `(() => window.__ILOVESVG_BATCH_WORKER_EVENTS__ || [])()`);
    const fallbackEngineResults = batchResponses
      .map((response) => response.engineUsed)
      .filter(Boolean);
    const expectedForcedWorkerFailure = workerEvents.some((event) => event.forcedFailure);
    const unexpectedErrors = expectedForcedWorkerFailure
      ? errors.filter((message) => !/ERR_FILE_NOT_FOUND/i.test(message))
      : errors;
    const ok =
      unexpectedErrors.length === 0 &&
      progressSeen &&
      doneState.hasZipButton &&
      svgEntries.length === 3 &&
      invalidSvgEntries.length === 0 &&
      expectedForcedWorkerFailure &&
      fallbackEngineResults.includes("potrace");

    return {
      route: "/",
      scenario: "batch-zip",
      selectedPreset,
      initialEngineUsed: initialOutput.engineUsed,
      progressSeen,
      info: doneState.info,
      zipFile,
      zipBytes: zipBytes.byteLength,
      svgEntries,
      invalidSvgEntries,
      workerEvents,
      fallbackEngineResults,
      batchResponses: batchResponses.map((response) => ({
        engineUsed: response.engineUsed,
        width: response.width,
        height: response.height,
        error: response.error,
      })),
      consoleErrors: unexpectedErrors,
      expectedConsoleErrors: errors.filter((message) => !unexpectedErrors.includes(message)),
      network,
      ok,
      failure: ok
        ? null
        : "Batch ZIP flow did not show expected progress, fallback, or valid ZIP contents.",
    };
  } catch (error) {
    return {
      route: "/",
      scenario: "batch-zip",
      consoleErrors: errors,
      network,
      ok: false,
      failure: error instanceof Error ? error.message : String(error),
      debug: await getPageDebugState(client).catch((debugError) => ({
        error: debugError instanceof Error ? debugError.message : String(debugError),
      })),
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function readTraceDebug(client) {
  return evaluate(client, `(() => Array.isArray(window.__ILOVESVG_HYBRID_TRACE_DEBUG__) ? window.__ILOVESVG_HYBRID_TRACE_DEBUG__ : [])()`);
}

async function verifyOutputActions(client, route, expectedEngine) {
  const copy = await verifyCopySvg(client);
  const download = await verifySvgDownload(client, `${safeName(route.id)}-${route.scenario}`);
  const updatePreview = await verifyUpdatePreview(client, expectedEngine);
  return {
    copyOk: copy.ok,
    copyLength: copy.length,
    downloadOk: download.ok,
    downloadFile: download.file,
    downloadBytes: download.bytes,
    updatePreviewOk: updatePreview.ok,
    updatePreview: updatePreview.status,
  };
}

async function verifyCopySvg(client) {
  await client.send("Page.bringToFront").catch(() => {});
  await client.send("Browser.grantPermissions", {
    origin: baseUrl,
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  }).catch(() => {});
  await evaluate(client, `(() => { window.focus(); document.body?.focus?.(); return true; })()`).catch(() => {});
  await clickButtonMatching(client, "/Copy SVG/i", { reject: "/ZIP|batch/i" });
  const text = await waitForValue(
    client,
    () => `navigator.clipboard.readText().catch(() => "")`,
    8_000,
    (value) => typeof value === "string" && /<svg[\s>]/i.test(value),
  ).catch(() => "");
  return {
    ok: /<svg[\s>]/i.test(text),
    length: typeof text === "string" ? text.length : 0,
  };
}

async function verifySvgDownload(client, label) {
  await fs.rm(downloadsDir, { recursive: true, force: true });
  await fs.mkdir(downloadsDir, { recursive: true });
  const before = new Set(await listDownloads());
  await configureDownloads(client).catch(() => {});
  await clickButtonMatching(client, "/Download/i", { reject: "/ZIP|batch/i" });
  const file = await waitForDownload(before, ".svg", 12_000);
  const fullPath = path.join(downloadsDir, file);
  const text = await fs.readFile(fullPath, "utf8");
  return {
    ok: /<svg[\s>]/i.test(text),
    file: `${label}:${file}`,
    bytes: Buffer.byteLength(text),
  };
}

async function verifyUpdatePreview(client, expectedEngine) {
  const opened = await clickButtonIfPresent(client, "/Settings/i", { reject: "/Advanced/i" });
  if (!opened) {
    return { ok: true, status: "not-available" };
  }
  const clicked = await clickButtonIfPresent(client, "/Update preview/i");
  if (!clicked) {
    return { ok: true, status: "settings-open-no-update-preview" };
  }
  const output = await waitForOutput(client, 60_000, expectedEngine).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }));
  if (output?.error) {
    return { ok: false, status: output.error };
  }
  return { ok: Boolean(output?.hasOutput && !output?.hasGenericFailure), status: "updated" };
}

async function configureDownloads(client) {
  const params = { behavior: "allow", downloadPath: downloadsDir };
  try {
    await client.send("Browser.setDownloadBehavior", params);
  } catch {
    await client.send("Page.setDownloadBehavior", params);
  }
}

async function waitForDownload(before, extension, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastFiles = [];
  while (Date.now() < deadline) {
    lastFiles = await listDownloads();
    const candidate = lastFiles.find(
      (file) =>
        !before.has(file) &&
        file.toLowerCase().endsWith(extension) &&
        !file.endsWith(".crdownload"),
    );
    if (candidate) return candidate;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${extension} download. Files: ${lastFiles.join(", ")}`);
}

async function listDownloads() {
  await fs.mkdir(downloadsDir, { recursive: true });
  return fs.readdir(downloadsDir).catch(() => []);
}

async function clickButtonMatching(client, patternSource, options = {}) {
  const clicked = await clickButtonIfPresent(client, patternSource, options);
  if (!clicked) throw new Error(`No enabled button matched ${patternSource}.`);
  return clicked;
}

async function clickButtonIfPresent(client, patternSource, options = {}) {
  return evaluate(client, `(() => {
    const pattern = ${patternSource};
    const reject = ${options.reject || "null"};
    const buttons = Array.from(document.querySelectorAll("button, a, [role='button'], summary"));
    const target = buttons.find((candidate) => {
      const text = candidate.innerText || candidate.getAttribute("aria-label") || "";
      const rect = candidate.getBoundingClientRect();
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        getComputedStyle(candidate).visibility !== "hidden" &&
        getComputedStyle(candidate).display !== "none";
      return visible && !candidate.disabled && pattern.test(text) && !(reject && reject.test(text));
    });
    if (!target) return null;
    const label = target.innerText.trim() || target.getAttribute("aria-label") || "";
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
    target.click();
    return label;
  })()`);
}

async function openTab(url) {
  const target = await createCdpTarget(url);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const client = new CdpClient(ws);
  client.targetUrl = target.url || url;
  await client.send("Runtime.enable");
  await client.send("Page.enable").catch(() => {});
  await client.send("Page.bringToFront").catch(() => {});
  await ensureTabAtUrl(client, url);
  return client;
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
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message || JSON.stringify(message.error)));
        } else {
          resolve(message.result || {});
        }
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
  }

  onEvent(listener) {
    this.listeners.add(listener);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 30_000).unref?.();
    });
  }

  async navigate(url) {
    await this.send("Page.navigate", { url });
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      try {
        const state = await evaluate(
          this,
          `(() => document.readyState)()`,
        );
        if (state === "interactive" || state === "complete") return;
      } catch {}
      await delay(250);
    }
    throw new Error("Timed out waiting for document readiness after navigation.");
  }

  close() {
    return new Promise((resolve) => {
      this.ws.addEventListener("close", resolve, { once: true });
      this.ws.close();
      setTimeout(resolve, 500).unref?.();
    });
  }
}

async function setFileInput(client, filePath) {
  await setFileInputFiles(client, 'input[type="file"]', [filePath]);
}

async function setFileInputFiles(client, selector, filePaths) {
  const expectedFileNames = filePaths.map((filePath) => path.basename(filePath));
  const { root } = await client.send("DOM.getDocument", {
    depth: -1,
    pierce: true,
  });
  const { nodeId } = await client.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector,
  });
  if (!nodeId) {
    const debug = await getPageDebugState(client);
    throw new Error(`No file input found for ${selector}. Page state: ${JSON.stringify(debug)}`);
  }
  await client.send("DOM.setFileInputFiles", { nodeId, files: filePaths });
  const filesAfterNodeSet = await evaluate(client, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    return input ? Array.from(input.files || []).map((file) => file.name) : null;
  })()`).catch(() => []);
  if (Array.isArray(filesAfterNodeSet) && filesAfterNodeSet.length === 0) {
    try {
      const { node } = await client.send("DOM.describeNode", { nodeId });
      await client.send("DOM.setFileInputFiles", {
        backendNodeId: node.backendNodeId,
        files: filePaths,
      });
    } catch (error) {
      const alreadyVisible = await evaluate(client, `(() => {
        const body = document.body?.innerText || "";
        return ${JSON.stringify(expectedFileNames)}.every((name) => body.includes(name));
      })()`).catch(() => false);
      if (!alreadyVisible) throw error;
    }
  }
  const filesAfterBackendSet = await evaluate(client, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    return input ? Array.from(input.files || []).map((file) => file.name) : null;
  })()`).catch(() => []);
  let bodyHasExpectedFiles = await evaluate(client, `(() => {
    const body = document.body?.innerText || "";
    return ${JSON.stringify(expectedFileNames)}.every((name) => body.includes(name));
  })()`).catch(() => false);
  let expectedAttached = Array.isArray(filesAfterBackendSet)
    && expectedFileNames.every((name) => filesAfterBackendSet.includes(name));
  if (!expectedAttached && !bodyHasExpectedFiles) {
    const settled = await waitForValue(
      client,
      () => `(() => {
        const input = document.querySelector(${JSON.stringify(selector)});
        const files = input ? Array.from(input.files || []).map((file) => file.name) : [];
        const body = document.body?.innerText || "";
        const expected = ${JSON.stringify(expectedFileNames)};
        return {
          inputAttached: expected.every((name) => files.includes(name)),
          bodyHasExpected: expected.every((name) => body.includes(name)),
        };
      })()`,
      2_000,
      (state) => Boolean(state?.inputAttached || state?.bodyHasExpected),
    ).catch(() => null);
    expectedAttached = Boolean(settled?.inputAttached);
    bodyHasExpectedFiles = Boolean(settled?.bodyHasExpected);
  }
  if (!expectedAttached) {
    if (!bodyHasExpectedFiles) {
      await setFileInputFilesFromBuffers(client, selector, filePaths);
    }
  }
  const finalFiles = await evaluate(client, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    return input ? Array.from(input.files || []).map((file) => file.name) : null;
  })()`).catch(() => []);
  const finalBodyHasExpectedFiles = await evaluate(client, `(() => {
    const body = document.body?.innerText || "";
    return ${JSON.stringify(expectedFileNames)}.every((name) => body.includes(name));
  })()`).catch(() => false);
  const finalAttached = Array.isArray(finalFiles)
    && expectedFileNames.every((name) => finalFiles.includes(name));
  if (!finalAttached) {
    if (!finalBodyHasExpectedFiles) {
      throw new Error(`Could not attach files to ${selector}. Expected ${expectedFileNames.join(", ")}, got ${JSON.stringify(finalFiles)}`);
    }
  }
  await evaluate(client, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) return false;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
}

async function setFileInputFilesViaChooser(client, buttonPatternSource, filePaths) {
  await client.send("Page.enable").catch(() => {});
  await client.send("DOM.enable").catch(() => {});
  await client.send("Page.setInterceptFileChooserDialog", { enabled: true }).catch(() => {});
  const chooserPromise = waitForEvent(client, "Page.fileChooserOpened", 5_000);
  await trustedClickButtonMatching(client, buttonPatternSource);
  const event = await chooserPromise;
  const backendNodeId = event.params?.backendNodeId;
  if (!backendNodeId) throw new Error("File chooser opened without a backend node id.");
  await client.send("DOM.setFileInputFiles", { backendNodeId, files: filePaths });
  await client.send("Page.setInterceptFileChooserDialog", { enabled: false }).catch(() => {});
}

async function setFileInputFilesFromBuffers(client, selector, filePaths) {
  const files = await Promise.all(
    filePaths.map(async (filePath) => ({
      name: path.basename(filePath),
      type: mimeTypeForPath(filePath),
      base64: (await fs.readFile(filePath)).toString("base64"),
    })),
  );
  const applied = await evaluate(client, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input) return { ok: false, reason: "missing input" };
    const dt = new DataTransfer();
    for (const item of ${JSON.stringify(files)}) {
      const binary = atob(item.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      dt.items.add(new File([bytes], item.name, { type: item.type }));
    }
    input.files = dt.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return {
      ok: true,
      files: Array.from(input.files || []).map((file) => ({ name: file.name, type: file.type, size: file.size })),
    };
  })()`);
  if (!applied?.ok) throw new Error(`Could not set files through browser DataTransfer: ${applied?.reason || "unknown"}`);
}

function mimeTypeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

async function trustedClickButtonMatching(client, patternSource, options = {}) {
  const point = await evaluate(client, `(() => {
    const pattern = ${patternSource};
    const reject = ${options.reject || "null"};
    const controls = Array.from(document.querySelectorAll("button, a, [role='button'], summary"));
    const target = controls.find((candidate) => {
      const text = candidate.innerText || candidate.textContent || candidate.getAttribute("aria-label") || "";
      const rect = candidate.getBoundingClientRect();
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        getComputedStyle(candidate).visibility !== "hidden" &&
        getComputedStyle(candidate).display !== "none";
      return visible && !candidate.disabled && pattern.test(text) && !(reject && reject.test(text));
    });
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  if (!point) throw new Error(`No visible button matched ${patternSource}.`);
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.x,
    y: point.y,
    button: "none",
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    clickCount: 1,
  });
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
      // Fall through to the legacy /json/new endpoint below.
    }
  }

  return cdpJson(`/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
}

async function ensureTabAtUrl(client, url) {
  let href = await evaluate(client, `(() => location.href)()`).catch(() => "");
  if (href !== url) {
    await client.send("Page.enable").catch(() => {});
    await client.send("Page.navigate", { url }).catch(async () => {
      await evaluate(client, `(() => { window.location.assign(${JSON.stringify(url)}); return true; })()`);
    });
  }
  await waitForValue(
    client,
    () => `(() => ({ href: location.href, readyState: document.readyState }))()`,
    20_000,
    (state) =>
      state?.href === url &&
      (state.readyState === "interactive" || state.readyState === "complete"),
  );
}

async function getPageDebugState(client) {
  try {
    return await evaluate(client, `(() => ({
      href: location.href,
      title: document.title,
      readyState: document.readyState,
      fileInputs: document.querySelectorAll('input[type="file"]').length,
      fileInputDetails: Array.from(document.querySelectorAll('input[type="file"]')).map((input) => ({
        multiple: Boolean(input.multiple),
        accept: input.getAttribute("accept"),
        files: Array.from(input.files || []).map((file) => ({ name: file.name, size: file.size, type: file.type })),
      })),
      forms: document.querySelectorAll("form").length,
      buttons: Array.from(document.querySelectorAll("button")).slice(0, 12).map((button) => button.innerText.trim()),
      controls: Array.from(document.querySelectorAll("button, a, [role='button'], summary")).map((control) => ({
        text: (control.innerText || control.textContent || control.getAttribute("aria-label") || "").trim(),
        tag: control.tagName,
        visible: (() => {
          const rect = control.getBoundingClientRect();
          const style = getComputedStyle(control);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
        })(),
      })).filter((control) => /Settings|Batch|Download|Copy|Convert|Choose/i.test(control.text)).slice(0, 80),
      bodyText: (document.body?.innerText || "").slice(0, 2000),
    }))()`);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      targetUrl: client.targetUrl,
    };
  }
}

async function selectVTracerPreset(client, route) {
  await evaluate(client, `(() => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((candidate) => /^Show \\d+ more presets/i.test(candidate.innerText || ""));
    if (button) button.click();
    return Boolean(button);
  })()`);
  await delay(250);
  const routeSpecificMatchers = getRoutePresetMatchers(route);
  return evaluate(client, `(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const reject = /Show|Clear|Convert|Download|Copy|Settings|Search presets|Filter presets/i;
    const preferredMatchers = ${JSON.stringify(routeSpecificMatchers)}.map((source) => new RegExp(source, "i")).concat([
      /^Layered color SVG\\b/i,
      /^Layered - /i,
    ]);
    let button = null;
    for (const matcher of preferredMatchers) {
      button = buttons.find((candidate) => {
        const text = candidate.innerText || "";
        if (candidate.disabled || reject.test(text) || /^Color - /i.test(text)) return false;
        return matcher.test(text.trim());
      });
      if (button) break;
    }
    if (!button) return null;
    button.click();
    return button.innerText.trim();
  })()`);
}

async function selectPotracePreset(client, route) {
  await evaluate(client, `(() => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((candidate) => /^Show \\d+ more presets/i.test(candidate.innerText || ""));
    if (button) button.click();
    return Boolean(button);
  })()`);
  await delay(250);
  const routeSpecificMatchers = getRoutePotracePresetMatchers(route);
  return evaluate(client, `(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const reject = /Show|Clear|Convert|Download|Copy|Settings|Search presets|Filter presets|Layered color/i;
    const preferredMatchers = ${JSON.stringify(routeSpecificMatchers)}.map((source) => new RegExp(source, "i")).concat([
      /^Lineart - Accurate\\b/i,
      /^Lineart - Clean\\b/i,
      /^Lineart - Bold\\b/i,
      /^Black and White\\b/i,
      /^Logo - Clean\\b/i,
      /^Scan - Clean\\b/i,
      /^Cricut - Clean\\b/i,
    ]);
    let button = null;
    for (const matcher of preferredMatchers) {
      button = buttons.find((candidate) => {
        const text = candidate.innerText || "";
        if (candidate.disabled || reject.test(text)) return false;
        return matcher.test(text.trim());
      });
      if (button) break;
    }
    if (!button) return null;
    button.click();
    return button.innerText.trim();
  })()`);
}

function getRoutePresetMatchers(route) {
  if (process.env.VTRACER_PRESET_PATTERN) {
    return [process.env.VTRACER_PRESET_PATTERN];
  }
  if (route.path === "/") {
    return ["^Layered color SVG\\b", "^Layered - "];
  }
  if (route.path === "/webp-to-svg-converter") {
    return ["^Layered color SVG\\b", "^Layered - "];
  }
  if (route.path.includes("layered")) {
    return ["^Layered color SVG\\b", "^Layered - "];
  }
  return ["^Layered color SVG\\b", "^Layered - "];
}

function getRoutePotracePresetMatchers(route) {
  if (process.env.POTRACE_PRESET_PATTERN) {
    return [process.env.POTRACE_PRESET_PATTERN];
  }
  if (route.path === "/") {
    return ["^Sketch - Clean Lines", "^Drawing - Smooth Ink", "^Lineart - Accurate"];
  }
  if (route.path.includes("logo")) {
    return ["^Logo - Clean", "^Logo - Sharp", "^Lineart - Accurate"];
  }
  if (route.path.includes("scan")) {
    return ["^Scan - Clean", "^Scanned", "^Lineart - Accurate"];
  }
  if (route.path.includes("cricut")) {
    return ["^Cricut - Clean", "^Lineart - Clean", "^Lineart - Accurate"];
  }
  return ["^Lineart - Accurate", "^Lineart - Clean", "^Lineart - Bold"];
}

async function clickConvertButton(client) {
  const clicked = await evaluate(client, `(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const button = buttons.find((candidate) => {
      const text = candidate.innerText || "";
      const rect = candidate.getBoundingClientRect();
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        getComputedStyle(candidate).visibility !== "hidden" &&
        getComputedStyle(candidate).display !== "none";
      return /Convert|Create/i.test(text) && !/batch|ZIP|Download/i.test(text) && !candidate.disabled && visible;
    });
    if (!button) return null;
    const label = button.innerText.trim();
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
      button.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
    button.click();
    return label;
  })()`);
  if (!clicked) throw new Error("No enabled convert button found.");
  return clicked;
}

async function waitForOutput(client, timeoutMs, expectedEngine = null) {
  return waitForValue(
    client,
    () => `(() => {
      const output = Array.from(document.querySelectorAll("[data-engine-used]"))
        .find((candidate) => {
          const engine = candidate.getAttribute("data-engine-used");
          return engine === "vtracer" || engine === "potrace";
        });
      const debug = Array.isArray(window.__ILOVESVG_HYBRID_TRACE_DEBUG__)
        ? window.__ILOVESVG_HYBRID_TRACE_DEBUG__
        : [];
      const lastClientSuccess = [...debug].reverse().find((event) => event.stage === "client-attempt-success" && event.engineUsed);
      const lastFallback = [...debug].reverse().find((event) => event.stage === "server-fallback-submit");
      const body = document.body.innerText || "";
      const hasOutputControls = /Copy SVG/i.test(body) && /Download/i.test(body);
      const inferredEngine = output
        ? output.getAttribute("data-engine-used")
        : lastClientSuccess?.engineUsed || (lastFallback && hasOutputControls ? "potrace" : null);
      const previewImages = output ? Array.from(output.querySelectorAll("img")) : [];
      const outputText = output?.innerText || "";
      const numericAttr = (name) => {
        const raw = output?.getAttribute(name);
        if (raw == null || raw === "") return null;
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
      };
      const previewDecoded = previewImages.some((image) =>
        image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
      );
      const hasBrokenPreview = previewImages.some((image) =>
        image.complete && image.naturalWidth === 0
      );
      let previewParseError = "";
      let previewParseExcerpt = "";
      const previewSrc = previewImages[0]?.getAttribute("src") || "";
      if (previewSrc.startsWith("data:image/svg+xml")) {
        const encoded = previewSrc.slice(previewSrc.indexOf(",") + 1);
        const decoded = decodeURIComponent(encoded);
        const parsed = new DOMParser().parseFromString(decoded, "image/svg+xml");
        previewParseError = parsed.querySelector("parsererror")?.textContent?.slice(0, 400) || "";
        if (previewParseError) {
          const line = decoded.split(/\\r?\\n/)[3] || decoded;
          previewParseExcerpt = line.slice(3800, 4100);
        }
      }
      return {
        hasOutput: Boolean(output),
        engineUsed: inferredEngine,
        previewDecoded,
        hasBrokenPreview,
        previewImageCount: previewImages.length,
        previewSrcPrefix: previewSrc.slice(0, 600),
        previewParseError,
        previewParseExcerpt,
        hasDerivedLabel: /Derived from Output/i.test(outputText),
        outputTitle: outputText.split(/\\r?\\n/).find((line) => /Output \\d+/i.test(line)) || "",
        sourceKind: output ? output.getAttribute("data-source-kind") : null,
        warnings: output ? output.getAttribute("data-engine-warnings") : "",
        metrics: output
          ? {
              layerBuildMode: output.getAttribute("data-layer-build-mode") || null,
              requestedPaletteCount: numericAttr("data-requested-palette-count"),
              actualPaletteCount: numericAttr("data-actual-palette-count"),
              outputDetectedColors: numericAttr("data-output-detected-colors"),
              pathCount: numericAttr("data-path-count"),
              svgBytes: numericAttr("data-svg-bytes"),
            }
          : null,
        capabilities: {
          worker: typeof Worker !== "undefined",
          wasm: typeof WebAssembly !== "undefined",
          createImageBitmap: typeof createImageBitmap !== "undefined",
          offscreenCanvas: typeof OffscreenCanvas !== "undefined",
        },
        hasGenericFailure: /Conversion failed\\. Please try a smaller image or adjust the output settings\\./i.test(body),
      };
    })()`,
    timeoutMs,
    (value) =>
      value?.hasGenericFailure ||
      (expectedEngine
        ? value?.hasOutput && value.engineUsed === expectedEngine && value.previewDecoded && !value.hasBrokenPreview && !value.hasDerivedLabel
        : value?.hasOutput && value.previewDecoded && !value.hasBrokenPreview && !value.hasDerivedLabel),
  );
}

async function waitForDocumentReady(client) {
  return waitForValue(
    client,
    () => `(() => document.readyState)()`,
    20_000,
    (state) => state === "interactive" || state === "complete",
  );
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed.");
  }
  return result.result?.value;
}

async function waitForValue(client, expressionFactory, timeoutMs, isReady = Boolean) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expressionFactory());
    if (isReady(last)) return last;
    await delay(250);
  }
  throw new Error(`Timed out waiting for browser state. Last value: ${JSON.stringify(last)}`);
}

function textIncludesExpression(text) {
  return `(() => (document.body.innerText || "").includes(${JSON.stringify(text)}))()`;
}

async function waitForEvent(client, method, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.listeners.delete(listener);
      reject(new Error(`Timed out waiting for ${method}`));
    }, timeoutMs);
    timeout.unref?.();
    const listener = (message) => {
      if (message.method !== method) return;
      clearTimeout(timeout);
      client.listeners.delete(listener);
      resolve(message);
    };
    client.listeners.add(listener);
  });
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

async function createFixtures() {
  if (process.env.FIXTURE_PNG) {
    const sourcePng = path.resolve(process.env.FIXTURE_PNG);
    const source = sharp(sourcePng, { limitInputPixels: false }).rotate();
    const metadata = await source.metadata();
    const sourcePixels = (metadata.width || 0) * (metadata.height || 0);
    const maxSide = Number(process.env.FIXTURE_MAX_SIDE || 1600);
    const maxPixels = Number(process.env.FIXTURE_MAX_PIXELS || 4_000_000);
    const shouldResize =
      sourcePixels > maxPixels ||
      (metadata.width || 0) > maxSide ||
      (metadata.height || 0) > maxSide;
    const normalized = shouldResize
      ? source.resize({
          width: maxSide,
          height: maxSide,
          fit: "inside",
          withoutEnlargement: true,
        })
      : source;
    const png = await normalized.png().toBuffer();
    const jpg = await sharp(png).jpeg({ quality: 92 }).toBuffer();
    const webp = await sharp(png).webp({ quality: 90 }).toBuffer();
    const files = {
      png: path.join(fixturesDir, path.basename(sourcePng)),
      jpg: path.join(fixturesDir, `${path.basename(sourcePng, path.extname(sourcePng))}.jpg`),
      webp: path.join(fixturesDir, `${path.basename(sourcePng, path.extname(sourcePng))}.webp`),
    };
    await fs.writeFile(files.png, png);
    await fs.writeFile(files.jpg, jpg);
    await fs.writeFile(files.webp, webp);
    return files;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">
      <rect width="240" height="160" fill="#ffffff"/>
      <circle cx="72" cy="78" r="38" fill="#0ea5e9"/>
      <rect x="118" y="36" width="72" height="72" rx="14" fill="#f97316"/>
      <path d="M32 132 C58 102, 94 150, 126 118 S190 126, 210 78" fill="none" stroke="#111827" stroke-width="9" stroke-linecap="round"/>
      <text x="28" y="30" font-family="Arial" font-size="20" font-weight="700" fill="#111827">Hybrid smoke</text>
    </svg>
  `;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const jpg = await sharp(png).jpeg({ quality: 92 }).toBuffer();
  const webp = await sharp(png).webp({ quality: 90 }).toBuffer();
  const files = {
    png: path.join(fixturesDir, "hybrid-smoke.png"),
    jpg: path.join(fixturesDir, "hybrid-smoke.jpg"),
    webp: path.join(fixturesDir, "hybrid-smoke.webp"),
  };
  await fs.writeFile(files.png, png);
  await fs.writeFile(files.jpg, jpg);
  await fs.writeFile(files.webp, webp);
  return files;
}

async function findBrowserExecutable() {
  const candidates = [
    process.env.BROWSER_EXECUTABLE,
    path.join(process.env.PROGRAMFILES || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Microsoft/Edge/Application/msedge.exe"),
    path.join(process.env.PROGRAMFILES || "", "BraveSoftware/Brave-Browser/Application/brave.exe"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "BraveSoftware/Brave-Browser/Application/brave.exe"),
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
  throw new Error("No Chromium-family browser executable found for browser smoke testing.");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeName(value) {
  return String(value || "route").replace(/[^a-z0-9._-]+/gi, "-").slice(0, 80);
}

function isIgnorableDevConsoleMessage(message) {
  return (
    /ws:\/\/127\.0\.0\.1:24678/i.test(message) ||
    /WebSocket connection .*24678/i.test(message) ||
    /WebSocket closed without opened/i.test(message) ||
    /Failed to load resource: net::ERR_FILE_NOT_FOUND/i.test(message) ||
    /Framing 'https:\/\/www\.google\.com\/' violates .*report-only Content Security Policy/i.test(message) ||
    /server responded with a status of 404/i.test(message)
  );
}

await main();
