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
  { path: "/", id: "home", file: "png", policy: "client", hasVTracerPreset: true, hasPotracePreset: true, hasCenterlinePreset: true, defaultEngine: "potrace" },
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
  { path: "/line-art-to-svg-converter", id: "line-art-to-svg-converter", file: "png", policy: "potrace", hasCenterlinePreset: true, defaultEngine: "potrace" },
  { path: "/line-art-to-svg-for-cricut", id: "line-art-to-svg-for-cricut", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/logo-to-layered-svg-for-cricut", id: "logo-to-layered-svg-for-cricut", file: "png", policy: "client", hasVTracerPreset: true, hasPotracePreset: false, defaultEngine: "vtracer" },
  { path: "/logo-to-svg-converter", id: "logo-to-svg-converter", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/logo-to-svg-for-cricut", id: "logo-to-svg-for-cricut", file: "png", policy: "potrace", defaultEngine: "potrace" },
  { path: "/photo-to-svg-for-cricut", id: "photo-to-svg-for-cricut", file: "jpg", policy: "potrace", defaultEngine: "potrace" },
  { path: "/photo-to-svg-outline", id: "photo-to-svg-outline", file: "jpg", policy: "potrace", defaultEngine: "potrace" },
  { path: "/png-to-layered-svg-for-cricut", id: "png-to-layered-svg-for-cricut", file: "png", policy: "client", hasVTracerPreset: true, hasPotracePreset: false, defaultEngine: "vtracer" },
  { path: "/png-to-svg-converter", id: "png-to-svg-converter", file: "png", policy: "client", hasVTracerPreset: true, hasPotracePreset: true, hasCenterlinePreset: true },
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
const UTILITY_LAYOUT_ROUTES = [
  { path: "/", id: "home", file: "png", conversion: "raster" },
  { path: "/png-to-svg-converter", id: "png-to-svg-converter", file: "png", conversion: "raster" },
  { path: "/jpg-to-svg-converter", id: "jpg-to-svg-converter", file: "jpg", conversion: "raster" },
  { path: "/jpeg-to-svg-converter", id: "jpeg-to-svg-converter", file: "jpg", conversion: "raster" },
  { path: "/line-art-to-svg-converter", id: "line-art-to-svg-converter", file: "png", conversion: "raster" },
  { path: "/logo-to-svg-converter", id: "logo-to-svg-converter", file: "png", conversion: "raster" },
  { path: "/photo-to-svg-outline", id: "photo-to-svg-outline", file: "jpg", conversion: "raster" },
  {
    path: "/svg-to-png-converter",
    id: "svg-to-png-converter",
    file: "svg",
    conversion: "svg-to-png",
    settingsScopedToOutput: true,
  },
  { path: "/image-to-layered-svg-for-cricut", id: "image-to-layered-svg-for-cricut", file: "png", conversion: "raster" },
];
const UTILITY_LAYOUT_WIDTHS = [320, 360, 390, 430, 768, 1024, 1280];

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
  let queue = null;
  let outputUx = null;
  let utilityLayout = null;
  let svgInput = null;
  try {
    await waitForCdp();
    if (process.env.LAYOUT_SMOKE === "1") {
      console.error("[hybrid-browser] utility-first layout");
      utilityLayout = await runUtilityLayoutSmoke(fixtures);
      console.error(`[hybrid-browser] utility-first layout -> ${utilityLayout.ok ? "ok" : "failed"}`);
    } else if (process.env.OUTPUT_UX_SMOKE === "1") {
      console.error("[hybrid-browser] output card UX");
      outputUx = await runOutputUxSmoke(fixtures);
      console.error(`[hybrid-browser] output card UX -> ${outputUx.ok ? "ok" : "failed"}`);
    } else if (process.env.SVG_INPUT_SMOKE === "1") {
      console.error("[hybrid-browser] home SVG input");
      svgInput = await runHomeSvgInputSmoke(fixtures);
      console.error(`[hybrid-browser] home SVG input -> ${svgInput.ok ? "ok" : "failed"}`);
    } else if (process.env.QUEUE_SMOKE === "1") {
      console.error("[hybrid-browser] conversion queue");
      queue = await runQueueSmoke(fixtures);
      console.error(`[hybrid-browser] conversion queue -> ${queue.ok ? "ok" : "failed"}`);
    } else {
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
    queue,
    outputUx,
    utilityLayout,
    svgInput,
  };

  console.log(JSON.stringify(report, null, 2));

  const failures = results.filter((result) => !result.ok);
  if (batchZip && !batchZip.ok) failures.push(batchZip);
  if (queue && !queue.ok) failures.push(queue);
  if (outputUx && !outputUx.ok) failures.push(outputUx);
  if (utilityLayout && !utilityLayout.ok) failures.push(utilityLayout);
  if (svgInput && !svgInput.ok) failures.push(svgInput);
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
    if (route.hasCenterlinePreset) {
      scenarios.push({
        ...route,
        scenario: "centerline-preset",
        mode: "centerline",
        expectedEngine: "centerline",
        optional: false,
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
    } else if (route.mode === "centerline") {
      selectedPreset = await selectCenterlinePreset(client, route);
      if (!selectedPreset) {
        throw new Error("Could not select a Centerline stroke preset.");
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
        route.mode === "vtracer" || route.mode === "centerline" ? route.expectedEngine : null,
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
      (route.mode !== "centerline" || output.hasCenterlineStrokes) &&
      copyDownload.hasCopy &&
      copyDownload.hasDownload &&
      actions.copyOk &&
      actions.downloadOk &&
      (route.mode !== "centerline" || (actions.copyHasStrokeWidth && actions.downloadHasStrokeWidth)) &&
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
      hasCenterlineStrokes: output.hasCenterlineStrokes,
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

async function runHomeSvgInputSmoke(fixtures) {
  const svgFixture = fixtures.svg;
  const client = await openTab(`${baseUrl}/`);
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("DOM.enable");
  await client.send("Network.enable");
  await waitForDocumentReady(client);
  await evaluate(client, `(() => { window.__ILOVESVG_HYBRID_TRACE_DEBUG__ = []; return true; })()`);
  await delay(3_000);

  await setFileInput(client, svgFixture);
  await delay(500);

  const selectedPreset = await evaluate(client, `(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const active = buttons.find((button) => {
      const aria = button.getAttribute("aria-pressed");
      const text = button.innerText || "";
      return aria === "true" && /Lineart|Cricut|Photo|Logo|Sketch|Centerline/i.test(text);
    });
    return active ? active.innerText.trim() : "";
  })()`);

  let convertButton = "auto-submit";
  let output = await waitForValue(
    client,
    homeSvgOutputExpression,
    30_000,
    (value) => value?.done,
  ).catch(() => null);
  if (!output) {
    await waitForConvertButtonEnabled(client, 8_000);
    convertButton = await clickConvertButton(client);
    output = await waitForValue(
      client,
      homeSvgOutputExpression,
      30_000,
      (value) => value?.done,
    );
  }

  const ok = Boolean(
    output.hasOutput &&
      output.sourceKind === "svg" &&
      (/svg (?:cleanup|sanitize)|sanitized svg|svg passthrough/i.test(output.enginePathLabel) ||
        output.hasSvgCleanupLabel) &&
      !output.hasHybridTrace &&
      !/^(?:vtracer|potrace|centerline)$/.test(output.engineUsed || "") &&
      !output.hasFailure &&
      output.previewHasMeaningfulSvg &&
      output.copy.enabled &&
      output.download.enabled,
  );

  return {
    ok,
    route: "/",
    scenario: "svg-input-cleanup",
    selectedPreset,
    convertButton,
    ...output,
    failure: ok ? null : "Homepage SVG input did not produce a visible SVG cleanup output with enabled copy/download and no Hybrid trace label.",
  };
}

function homeSvgOutputExpression() {
  return `(async () => {
    const body = document.body.innerText || "";
    const output = Array.from(document.querySelectorAll("[data-source-kind], [data-engine-used]"))
      .find((candidate) => /Output|Conversion did not finish|Engine path/i.test(candidate.innerText || ""));
    const outputText = output?.innerText || "";
    const lines = outputText.split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean);
    const enginePathIndex = lines.findIndex((line) => /^Engine path$/i.test(line));
    const enginePathLabel = enginePathIndex >= 0 ? lines[enginePathIndex + 1] || "" : "";
    const buttonState = (pattern) => {
      const buttons = Array.from((output || document).querySelectorAll("button, a"))
        .filter((element) => {
          const text = element.innerText || element.getAttribute("aria-label") || element.getAttribute("title") || "";
          const rect = element.getBoundingClientRect();
          const visible =
            rect.width > 0 &&
            rect.height > 0 &&
            getComputedStyle(element).visibility !== "hidden" &&
            getComputedStyle(element).display !== "none";
          return pattern.test(text) && visible;
        });
      return {
        visible: buttons.length > 0,
        enabled: buttons.some((element) =>
          !element.disabled &&
            element.getAttribute("aria-disabled") !== "true" &&
            !element.hasAttribute("disabled")
        ),
      };
    };
    const previewImages = output ? Array.from(output.querySelectorAll("img")) : [];
    const previewSrc = previewImages[0]?.getAttribute("src") || "";
    let decodedPreviewSvg = "";
    if (previewSrc.startsWith("data:image/svg+xml")) {
      decodedPreviewSvg = decodeURIComponent(previewSrc.slice(previewSrc.indexOf(",") + 1));
    } else if (previewSrc.startsWith("blob:")) {
      decodedPreviewSvg = await fetch(previewSrc).then((response) => response.text()).catch(() => "");
    }
    let previewParseError = "";
    let previewVisibleDrawableCount = 0;
    if (decodedPreviewSvg) {
      const parsed = new DOMParser().parseFromString(decodedPreviewSvg, "image/svg+xml");
      previewParseError = parsed.querySelector("parsererror")?.textContent || "";
      previewVisibleDrawableCount = Array.from(parsed.querySelectorAll("path,polygon,polyline,rect,circle,ellipse,line,text,image"))
        .filter((element) => {
          const tag = element.tagName.toLowerCase();
          const attrs = element.getAttributeNames().map((name) => name + '="' + (element.getAttribute(name) || "") + '"').join(" ");
          if (/display\\s*=\\s*["']none["']/i.test(attrs)) return false;
          if (/visibility\\s*=\\s*["']hidden["']/i.test(attrs)) return false;
          if (/opacity\\s*=\\s*["'](?:0|0\\.0+)["']/i.test(attrs)) return false;
          if (tag === "path" && !(element.getAttribute("d") || "").trim()) return false;
          return true;
        }).length;
    }
    const copy = buttonState(/Copy SVG/i);
    const download = buttonState(/Download SVG/i);
    const batch = buttonState(/Batch/i);
    const settings = buttonState(/Settings|Edit/i);
    const fullscreen = buttonState(/fullscreen|full screen|preview/i);
    const hasFailure = /Conversion did not finish|no visible artwork after sanitizing/i.test(outputText || body);
    const isRunning = /\\bConverting\\b|\\bRunning\\b/i.test(outputText);
    const hasOutput = Boolean(output);
    const previewHasMeaningfulSvg = Boolean(decodedPreviewSvg && !previewParseError && previewVisibleDrawableCount > 0);
    return {
      done: Boolean(hasFailure || (hasOutput && previewHasMeaningfulSvg && !isRunning)),
      hasOutput,
      isRunning,
      sourceKind: output?.getAttribute("data-source-kind") || "",
      engineUsed: output?.getAttribute("data-engine-used") || "",
      enginePathLabel,
      hasHybridTrace: /Engine path\\s+Hybrid trace/i.test(outputText) || /\\bHybrid trace\\b/i.test(outputText),
      hasSvgCleanupLabel: /svg (?:cleanup|sanitize)|sanitized svg|svg passthrough/i.test(outputText),
      hasFailure,
      previewHasMeaningfulSvg,
      previewVisibleDrawableCount,
      copy,
      download,
      batch,
      settings,
      fullscreen,
      outputText: outputText.slice(0, 800),
    };
  })()`;
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

async function runQueueSmoke(fixtures) {
  const client = await openTab(`${baseUrl}/png-to-svg-converter`);
  const errors = [];
  const queueFixture = await createQueueFixture(fixtures.png);
  const cancelFixture = await createQueueCancelFixture(fixtures.png);
  const replacementFixture = fixtures.jpg || fixtures.png;
  const replacementName = path.basename(replacementFixture);
  const queueSourceName = path.basename(queueFixture);
  const cancelSourceName = path.basename(cancelFixture);
  const oldSlowIsActive = (value) =>
    value?.cards?.some(
      (card) =>
        card.isSlow &&
        card.sourceFileName === queueSourceName &&
        (card.status === "queued" || card.status === "running"),
    );
  const oldSlowIsComplete = (value) =>
    value?.cards?.some(
      (card) =>
        card.isSlow &&
        card.sourceFileName === queueSourceName &&
        card.engine === "vtracer" &&
        card.previewDecoded,
    );
  const slowActiveForSource = (value, sourceName) =>
    value?.cards?.some(
      (card) =>
        card.isSlow &&
        card.sourceFileName === sourceName &&
        (card.status === "queued" || card.status === "running"),
    );
  const slowPotraceCompleteForSource = (value, sourceName) =>
    value?.cards?.some(
      (card) =>
        card.isSlow &&
        card.sourceFileName === sourceName &&
        card.engine === "potrace" &&
        card.previewDecoded,
    );
  const slowCanceledForSource = (value, sourceName) =>
    value?.cards?.some(
      (card) =>
        card.isSlow &&
        card.sourceFileName === sourceName &&
        card.status === "canceled",
    );
  const fastCompleteForSource = (value, sourceName) =>
    value?.cards?.some(
      (card) =>
        card.isFast &&
        card.sourceFileName === sourceName &&
        card.engine === "potrace" &&
        card.previewDecoded,
    );
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
  });

  try {
    await client.send("Runtime.enable");
    await client.send("Log.enable");
    await client.send("Page.enable");
    await client.send("DOM.enable");
    await waitForDocumentReady(client);
    await evaluate(client, `(() => { window.__ILOVESVG_HYBRID_TRACE_DEBUG__ = []; return true; })()`);
    await delay(1_000);

    await setFileInput(client, queueFixture);
    await waitForValue(client, () => textIncludesExpression(path.basename(queueFixture)), 8_000);
    await waitForValue(
      client,
      queueSnapshotExpression,
      70_000,
      (value) =>
        !value?.cards?.some((card) => card.status === "queued" || card.status === "running"),
    ).catch(() => null);
    await showAllPresetButtons(client);

    const slowSelected = await clickButtonMatching(client, "/^Filled Layers - Separate Colors\\b/i");
    const slowPending = await waitForValue(
      client,
      queueSnapshotExpression,
      8_000,
      oldSlowIsActive,
    );

    const replacementControls = await evaluate(client, `(() => {
      const hasFileInput = Boolean(document.querySelector('input[type="file"]'));
      const hasRemoveButton = Array.from(document.querySelectorAll('button')).some((button) => {
        const text = button.innerText || button.getAttribute('aria-label') || "";
        return /Remove selected file|^x$|^×$/i.test(text);
      });
      return { hasFileInput, hasRemoveButton };
    })()`);
    let replacementWhileSlow = {
      supported: false,
      reason: "The route does not expose file replacement controls while a conversion is actively running.",
      slowActive: slowPending.slowActive,
      sourceFileNames: slowPending.sourceFileNames || [],
    };
    if (replacementControls?.hasFileInput || replacementControls?.hasRemoveButton) {
      if (!replacementControls.hasFileInput) {
        await clickButtonIfPresent(client, "/Remove selected file|^x$|^×$/i");
      }
      await setFileInput(client, replacementFixture);
      replacementWhileSlow = await waitForValue(
        client,
      queueSnapshotExpression,
      20_000,
      (value) =>
          oldSlowIsActive(value) &&
          value?.sourceFileNames?.some((name) => name === queueSourceName) &&
          value?.sourceFileNames?.some((name) => name === replacementName),
      );
      replacementWhileSlow.supported = true;
    }

    await showAllPresetButtons(client);
    const fastSelected = await clickButtonMatching(client, "/^Lineart - Clean\\b/i");
    const fastWhileSlow = await waitForValue(
      client,
      queueSnapshotExpression,
      40_000,
      (value) =>
        fastCompleteForSource(value, replacementWhileSlow.supported ? replacementName : queueSourceName) &&
        oldSlowIsActive(value),
    );

    const slowComplete = await waitForValue(
      client,
      queueSnapshotExpression,
      100_000,
      oldSlowIsComplete,
    );

    await clickButtonIfPresent(client, "/Remove selected file|^x$|^\\u00d7$/i");
    await delay(250);
    await setFileInput(client, cancelFixture);
    await waitForValue(client, () => textIncludesExpression(cancelSourceName), 8_000);
    await showAllPresetButtons(client);
    const cancelSelected = await clickButtonMatching(client, "/^Filled Layers - Separate Colors\\b/i");
    const cancelPending = await waitForValue(
      client,
      queueSnapshotExpression,
      8_000,
      (value) => slowActiveForSource(value, cancelSourceName),
    );
    const cancelClicked = await clickCancelForSlowJob(client, cancelSourceName);
    const canceled = await waitForValue(
      client,
      queueSnapshotExpression,
      8_000,
      (value) => slowCanceledForSource(value, cancelSourceName),
    );
    const traceDebug = await readTraceDebug(client);
    const canceledFallback = traceDebug.some(
      (event) =>
        event?.stage === "server-fallback-submit" &&
        /canceled/i.test(String(event?.reason || "")),
    );

    const ok =
      errors.length === 0 &&
      Boolean(slowSelected) &&
      Boolean(fastSelected) &&
      Boolean(cancelSelected) &&
      Boolean(cancelClicked) &&
      slowPending.slowActive &&
      !slowPotraceCompleteForSource(slowPending, queueSourceName) &&
      oldSlowIsActive(replacementWhileSlow) &&
      (!replacementWhileSlow.supported ||
        (replacementWhileSlow.sourceFileNames.includes(queueSourceName) &&
          replacementWhileSlow.sourceFileNames.includes(replacementName))) &&
      fastCompleteForSource(fastWhileSlow, replacementWhileSlow.supported ? replacementName : queueSourceName) &&
      oldSlowIsActive(fastWhileSlow) &&
      !slowPotraceCompleteForSource(fastWhileSlow, queueSourceName) &&
      oldSlowIsComplete(slowComplete) &&
      !slowPotraceCompleteForSource(slowComplete, queueSourceName) &&
      slowCanceledForSource(canceled, cancelSourceName) &&
      !canceledFallback &&
      slowComplete.vtracerPreviewDecoded &&
      fastWhileSlow.potracePreviewDecoded;

    return {
      route: "/png-to-svg-converter",
      fixture: path.basename(queueFixture),
      cancelFixture: path.basename(cancelFixture),
      replacementFixture: replacementName,
      slowSelected,
      fastSelected,
      cancelSelected,
      slowPending,
      replacementWhileSlow,
      fastWhileSlow,
      slowComplete,
      cancelPending,
      canceled,
      cancelClicked,
      canceledFallback,
      traceDebug,
      consoleErrors: errors,
      ok,
      failure: ok
        ? null
        : "Queue smoke did not observe independent slow/fast completion and cancellation.",
    };
  } catch (error) {
    return {
      route: "/png-to-svg-converter",
      fixture: path.basename(queueFixture),
      traceDebug: await readTraceDebug(client).catch(() => []),
      consoleErrors: errors,
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

async function createQueueFixture(fallbackPng) {
  const source = path.join(rootDir, "tests/fixtures/IMG_8487.PNG");
  const target = path.join(fixturesDir, "queue-IMG_8487-upscaled.png");
  try {
    await fs.access(source);
    await sharp(source, { limitInputPixels: false })
      .resize({ width: 2200, fit: "inside", withoutEnlargement: false })
      .png()
      .toFile(target);
    return target;
  } catch {
    return fallbackPng;
  }
}

async function createQueueCancelFixture(fallbackPng) {
  const source = path.join(rootDir, "tests/fixtures/IMG_8487.PNG");
  const target = path.join(fixturesDir, "queue-IMG_8487-cancel.png");
  const input = await fs.access(source).then(() => source).catch(() => fallbackPng);
  try {
    await sharp(input, { limitInputPixels: false })
      .resize({ width: 2050, fit: "inside", withoutEnlargement: false })
      .png()
      .toFile(target);
    return target;
  } catch {
    return fallbackPng;
  }
}

async function showAllPresetButtons(client) {
  await evaluate(client, `(() => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((candidate) => /^Show \\d+ more presets/i.test(candidate.innerText || ""));
    if (button) button.click();
    return Boolean(button);
  })()`).catch(() => false);
  await delay(250);
}

function queueSnapshotExpression() {
  return `(() => {
    const cards = Array.from(document.querySelectorAll("[data-engine-used]")).map((card, index) => {
      const text = card.innerText || "";
      const engine = card.getAttribute("data-engine-used") || "";
      const status = card.getAttribute("data-job-status") || "";
      const sourceFileName = card.querySelector("[data-output-source-file]")?.getAttribute("data-output-source-file") || "";
      const images = Array.from(card.querySelectorAll("img"));
      const previewDecoded = images.some((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
      const isSlow = /Filled Layers - Separate Colors/i.test(text);
      const isFast = /Lineart - Clean/i.test(text);
      return {
        index,
        engine,
        status,
        isSlow,
        isFast,
        sourceFileName,
        previewDecoded,
        text: text.slice(0, 500),
      };
    });
    const sourceFileNames = cards.map((card) => card.sourceFileName).filter(Boolean);
    const isActive = (card) => card.status === "queued" || card.status === "running";
    const slowActive = cards.some((card) => card.isSlow && isActive(card));
    const slowComplete = cards.some((card) => card.isSlow && card.engine === "vtracer" && card.previewDecoded);
    const slowPotraceComplete = cards.some((card) => card.isSlow && card.engine === "potrace" && card.previewDecoded);
    const slowCanceled = cards.some((card) => card.isSlow && card.status === "canceled");
    const fastComplete = cards.some((card) => card.isFast && card.engine === "potrace" && card.previewDecoded);
    return {
      outputCount: cards.length,
      slowCards: cards.filter((card) => card.isSlow).length,
      slowActive,
      slowComplete,
      slowPotraceComplete,
      slowCanceled,
      fastComplete,
      sourceFileNames,
      vtracerPreviewDecoded: cards.some((card) => card.engine === "vtracer" && card.previewDecoded),
      potracePreviewDecoded: cards.some((card) => card.engine === "potrace" && card.previewDecoded),
      cards,
    };
  })()`;
}

async function clickCancelForSlowJob(client, sourceName = "") {
  return evaluate(client, `(() => {
    const sourceName = ${JSON.stringify(sourceName)};
    const cards = Array.from(document.querySelectorAll("[data-engine-used]"));
    const card = cards.find((candidate) => {
      const text = candidate.innerText || "";
      const status = candidate.getAttribute("data-job-status") || "";
      const sourceFileName = candidate.querySelector("[data-output-source-file]")?.getAttribute("data-output-source-file") || "";
      return /Filled Layers - Separate Colors/i.test(text) &&
        (!sourceName || sourceFileName === sourceName) &&
        (status === "queued" || status === "running");
    });
    if (!card) return false;
    const button = Array.from(card.querySelectorAll("button"))
      .find((candidate) => /Cancel/i.test(candidate.innerText || "") && !candidate.disabled);
    if (!button) return false;
    button.click();
    return true;
  })()`);
}

async function runUtilityLayoutSmoke(fixtures) {
  const routes = process.env.LAYOUT_ROUTE_FILTER
    ? UTILITY_LAYOUT_ROUTES.filter((route) => route.path === process.env.LAYOUT_ROUTE_FILTER)
    : UTILITY_LAYOUT_ROUTES;
  const results = [];

  for (const route of routes) {
    const client = await openTab(`${baseUrl}${route.path}`);
    const errors = [];
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
      if (message.method === "Network.responseReceived") {
        const response = message.params?.response;
        if (response?.url?.startsWith(baseUrl)) {
          network.push({ status: response.status, url: response.url });
        }
      }
    });

    try {
      await client.send("Runtime.enable");
      await client.send("Log.enable");
      await client.send("Page.enable");
      await client.send("DOM.enable");
      await client.send("Network.enable");

      const widths = [];
      for (const width of UTILITY_LAYOUT_WIDTHS) {
        await client.send("Emulation.setDeviceMetricsOverride", {
          width,
          height: 900,
          deviceScaleFactor: 1,
          mobile: width < 768,
        });
        await client.navigate(`${baseUrl}${route.path}`);
        await waitForDocumentReady(client);
        await delay(300);
        widths.push(await captureUtilityLayoutState(client, route));
      }

      const conversion = await runUtilityLayoutConversion(client, route, fixtures).catch((error) => ({
        ok: false,
        failure: error instanceof Error ? error.message : String(error),
      }));
      const failures = [
        ...widths.flatMap((state) =>
          state.failures.map((failure) => `${state.width}px: ${failure}`),
        ),
        ...(conversion.ok ? [] : [`conversion: ${conversion.failure}`]),
        ...errors.map((error) => `console: ${error}`),
      ];

      results.push({
        route: route.path,
        widths,
        conversion,
        consoleErrors: errors,
        network: network.filter((entry) => entry.status >= 400),
        ok: failures.length === 0,
        failures,
      });
    } catch (error) {
      results.push({
        route: route.path,
        ok: false,
        failures: [error instanceof Error ? error.message : String(error)],
        debug: await getPageDebugState(client).catch((debugError) => ({
          error: debugError instanceof Error ? debugError.message : String(debugError),
        })),
      });
    } finally {
      await client.close().catch(() => {});
    }
  }

  return {
    routes: results,
    ok: results.every((result) => result.ok),
  };
}

async function captureUtilityLayoutState(client, route) {
  const settingsScopedToOutput = Boolean(route.settingsScopedToOutput);
  return evaluate(client, `(() => {
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const main = document.querySelector("main");
    const sections = Array.from(main?.querySelectorAll("section") || []);
    const grid = sections.find((section) => {
      const className = String(section.getAttribute("class") || "");
      const text = section.innerText || "";
      return className.includes("grid") && /convert|upload|choose|paste/i.test(text) && section.querySelector("h1, input[type='file'], textarea");
    }) || null;
    const parent = grid?.parentElement || null;
    const siblings = parent ? Array.from(parent.children) : [];
    const gridIndex = grid ? siblings.indexOf(grid) : -1;
    const preceding = gridIndex >= 0 ? siblings.slice(0, gridIndex).filter((element) => {
      if (!visible(element)) return false;
      const text = (element.innerText || "").trim();
      const isAdOnly = !text && Boolean(element.querySelector("ins, iframe"));
      return !isAdOnly && (text || element.querySelector("h1, header, nav, p, a"));
    }) : [];
    const inputCard = grid ? Array.from(grid.children).find((element) => visible(element) && (element.querySelector("h1, input[type='file'], textarea") || /upload|paste|choose/i.test(element.innerText || ""))) : null;
    const outputPanel = grid?.querySelector(".converter-output-panel, [data-layout-output-panel='true']") || null;
    const inputRect = inputCard?.getBoundingClientRect() || null;
    const outputRect = outputPanel?.getBoundingClientRect() || null;
    const inputText = inputCard?.innerText || "";
    const settingsButtonInInput = inputCard
      ? Array.from(inputCard.querySelectorAll("button, summary")).some((element) => /\\bSettings\\b/i.test(element.innerText || ""))
      : false;
    const otherTools = document.querySelector("#other-tools");
    const otherToolsRect = otherTools?.getBoundingClientRect() || null;
    const failures = [];
    if (!grid) failures.push("missing main converter grid");
    if (preceding.some((element) => element.matches("header, nav") || element.querySelector("h1, header, nav, p, a"))) {
      failures.push("standalone hero, breadcrumb, intro, or route chips before converter grid");
    }
    if (!inputCard?.querySelector("h1")) failures.push("utility/input card is missing the route H1");
    if (inputCard && inputCard.querySelectorAll("h1").length !== 1) failures.push("utility/input card should contain exactly one H1");
    if (${JSON.stringify(settingsScopedToOutput)} && inputCard && (settingsButtonInInput || /\\bSettings\\b[\\s\\S]*(Size|scale|transparency|export)/i.test(inputText))) {
      failures.push("settings are exposed in the input card before output");
    }
    if (window.innerWidth >= 1024) {
      if (!outputPanel || !visible(outputPanel)) {
        failures.push("desktop output card is missing beside the utility");
      } else if (inputRect && outputRect) {
        if (outputRect.left <= inputRect.left + inputRect.width * 0.75) {
          failures.push("desktop output card is not placed beside the utility card");
        }
        if (Math.abs(outputRect.top - inputRect.top) > 140) {
          failures.push("desktop output card is not aligned with the utility card");
        }
      }
    }
    if (otherToolsRect && grid) {
      const gridRect = grid.getBoundingClientRect();
      if (otherToolsRect.top < gridRect.top) {
        failures.push("related/SEO tools appear above the converter");
      }
    }
    const documentOverflow = Math.ceil(document.documentElement.scrollWidth - window.innerWidth);
    const bodyOverflow = Math.ceil(document.body.scrollWidth - window.innerWidth);
    if (documentOverflow > 2 || bodyOverflow > 2) {
      failures.push(\`horizontal overflow: document \${documentOverflow}px, body \${bodyOverflow}px\`);
    }
    return {
      width: window.innerWidth,
      href: location.pathname,
      gridFound: Boolean(grid),
      precedingText: preceding.map((element) => (element.innerText || element.tagName || "").trim().slice(0, 120)),
      inputH1: inputCard?.querySelector("h1")?.innerText?.trim() || "",
      settingsButtonInInput,
      outputFound: Boolean(outputPanel),
      inputRect: inputRect ? { left: inputRect.left, top: inputRect.top, width: inputRect.width, height: inputRect.height } : null,
      outputRect: outputRect ? { left: outputRect.left, top: outputRect.top, width: outputRect.width, height: outputRect.height } : null,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      innerWidth: window.innerWidth,
      failures,
    };
  })()`);
}

async function runUtilityLayoutConversion(client, route, fixtures) {
  if (!route.conversion) return { ok: true, status: "not-required" };
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.navigate(`${baseUrl}${route.path}`);
  await waitForDocumentReady(client);
  await delay(300);

  if (route.conversion === "svg-to-png") {
    await configureDownloads(client);
    const before = new Set(await listDownloads());
    await setFileInput(client, fixtures.svg);
    await waitForValue(client, () => textIncludesExpression(path.basename(fixtures.svg)), 8_000);
    await waitForConvertButtonEnabled(client, 8_000);
    await clickConvertButton(client);
    const output = await waitForValue(
      client,
      () => `(() => {
        const img = document.querySelector("[data-layout-output-panel='true'] img[alt='PNG result'], [data-layout-output-panel='true'] img[alt='PNG preview']");
        const downloadButton = Array.from(document.querySelectorAll("button")).find((button) => /Download PNG/i.test(button.innerText || ""));
        const fullscreenButton = document.querySelector("[data-layout-output-panel='true'] button[aria-label*='fullscreen' i], [data-layout-output-panel='true'] button[title*='fullscreen' i]");
        return {
          previewDecoded: Boolean(img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0),
          hasDownload: Boolean(downloadButton && !downloadButton.disabled),
          hasFullscreen: Boolean(fullscreenButton),
        };
      })()`,
      20_000,
      (value) => value?.previewDecoded && value?.hasDownload,
    );
    const fullscreenStatus = await verifyFullscreenPreview(client);
    await clickButtonMatching(client, "/Download PNG/i");
    const file = await waitForDownload(before, ".png", 12_000);
    const ok = Boolean(output.previewDecoded && output.hasDownload && fullscreenStatus.ok && file);
    return {
      ok,
      status: "converted",
      hasFullscreen: output.hasFullscreen,
      fullscreenStatus,
      downloadFile: file,
      failure: ok ? null : "SVG to PNG did not render, open full-screen preview, and download.",
    };
  }

  const fixturePath = fixtures[route.file];
  await setFileInput(client, fixturePath);
  await waitForValue(client, () => textIncludesExpression(path.basename(fixturePath)), 8_000);
  let output = await waitForOutput(client, 8_000).catch(() => null);
  if (!output) {
    await clickConvertButton(client);
    output = await waitForOutput(client, 60_000);
  }
  const copyStatus = await verifyCopySvg(client);
  const downloadStatus = await verifySvgDownload(client, `utility-layout-${safeName(route.id)}`);
  const updateStatus = await verifyUpdatePreview(client, output.engineUsed);
  const fullscreenStatus = await verifyFullscreenPreview(client);
  const ok = Boolean(
    output?.hasOutput &&
      output.previewDecoded &&
      copyStatus.ok &&
      downloadStatus.ok &&
      updateStatus.ok &&
      fullscreenStatus.ok,
  );
  return {
    ok,
    status: "converted",
    engineUsed: output?.engineUsed || null,
    copyStatus,
    downloadStatus,
    updateStatus,
    fullscreenStatus,
    failure: ok ? null : "Raster conversion, copy, download, full-screen preview, or update-preview check failed.",
  };
}

async function verifyFullscreenPreview(client) {
  const clicked = await evaluate(client, `(() => {
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const button = Array.from(document.querySelectorAll("button[aria-label='Preview full screen'], button[title='Preview full screen']"))
      .find((candidate) => visible(candidate) && !candidate.disabled);
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) {
    return {
      ok: false,
      available: false,
      failure: "Preview full screen button was not available.",
    };
  }

  const opened = await waitForValue(
    client,
    () => `(() => {
      const dialog = document.querySelector("[role='dialog'][aria-label='Full-screen output preview']");
      const img = dialog?.querySelector("img");
      return Boolean(dialog && img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
    })()`,
    8_000,
    Boolean,
  );
  if (!opened) {
    return {
      ok: false,
      available: true,
      failure: "Full-screen output preview did not open.",
    };
  }

  await evaluate(client, `(() => {
    const close = document.querySelector("button[aria-label='Close full-screen preview']");
    close?.click();
    return Boolean(close);
  })()`);
  const closed = await waitForValue(
    client,
    () => `(() => !document.querySelector("[role='dialog'][aria-label='Full-screen output preview']"))()`,
    8_000,
    Boolean,
  );
  return {
    ok: Boolean(opened && closed),
    available: true,
    opened: Boolean(opened),
    closed: Boolean(closed),
    failure: opened && closed ? null : "Full-screen output preview did not close.",
  };
}

async function runOutputUxSmoke(fixtures) {
  const cases = [
    { route: "/", fixture: fixtures.png, replacementFixture: fixtures.jpg, expectedEngine: null },
    { route: "/png-to-svg-converter", fixture: fixtures.png, replacementFixture: fixtures.jpg, expectedEngine: null },
    { route: "/sketch-to-svg-converter", fixture: fixtures.png, replacementFixture: fixtures.jpg, expectedEngine: null },
    { route: "/photo-to-svg-outline", fixture: fixtures.jpg, replacementFixture: fixtures.png, expectedEngine: null },
    { route: "/png-to-svg-for-cricut", fixture: fixtures.png, replacementFixture: fixtures.jpg, expectedEngine: null },
    {
      route: "/png-to-layered-svg-for-cricut",
      fixture: fixtures.png,
      replacementFixture: fixtures.jpg,
      expectedEngine: null,
    },
  ];
  const results = [];
  for (const testCase of cases) {
    results.push(await runOutputUxRouteSmoke(testCase));
  }
  return {
    route: "output-card-ux",
    scenario: "focused-collapse-appearance",
    results,
    ok: results.every((result) => result.ok),
    failure: results.every((result) => result.ok)
      ? null
      : "One or more output-card UX smoke cases failed.",
  };
}

async function runOutputUxRouteSmoke(testCase) {
  const client = await openTab(`${baseUrl}${testCase.route}`);
  const errors = [];
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
  });

  try {
    await client.send("Runtime.enable");
    await client.send("Log.enable");
    await client.send("Page.enable");
    await client.send("DOM.enable");
    await waitForDocumentReady(client);
    await delay(750);
    await setFileInput(client, testCase.fixture);
    await waitForValue(client, () => textIncludesExpression(path.basename(testCase.fixture)), 8_000);
    let output = await waitForOutput(client, 8_000, testCase.expectedEngine).catch(() => null);
    if (!output) {
      await clickConvertButton(client);
      output = await waitForOutput(client, 60_000, testCase.expectedEngine);
    }
    const historyReplacement = await verifyOutputHistoryPersistsAcrossInputReplacement(
      client,
      testCase.fixture,
      testCase.replacementFixture || testCase.fixture,
      testCase.route,
    );

    const opened = await clickButtonMatching(client, "/Settings/i", {
      reject: "/Advanced/i",
    });
    const focused = await waitForValue(
      client,
      outputUxSnapshotExpression,
      8_000,
      (value) =>
        value?.focused &&
        value?.hasDone &&
        value?.hasPreview &&
        value?.hasOutputComparison &&
        value?.hasOriginalComparison &&
        value?.hasSettingsPanel &&
        value?.hasFileSize &&
        !value?.hasFocusedRedundantActions &&
        value?.openSettingsSectionCount === 0 &&
        !value?.minimizeInActionRow &&
        value?.leftPaneCollapsed &&
        value?.editorNearTop &&
        value?.layoutShift?.ok &&
        value?.cursorViolations?.length === 0,
    );
    const accordionShift = await verifyFocusedAccordionHasNoHorizontalShift(client);
    const controls = await evaluate(client, `(() => {
      const text = document.body.innerText || "";
      const labels = Array.from(document.querySelectorAll("label"));
      const findLabeledRange = (pattern) => {
        const label = labels.find((candidate) => pattern.test(candidate.textContent || ""));
        if (!label) return null;
        return label.querySelector('input[type="range"]') || label.parentElement?.querySelector('input[type="range"]') || null;
      };
      const lineInput = findLabeledRange(/Line weight/i);
      const fillInput = findLabeledRange(/Fill spread/i);
      const hasFillColor = /Fill color/i.test(text);
      const hasStrokeColor = /Stroke color/i.test(text);
      const hasGradientFill = /Gradient fill/i.test(text);
      const hasPatternFill = /Pattern fill/i.test(text);
      const hasStickerBorder = /Enable border/i.test(text);
      const hasStrokeOutputMode = /Stroke output mode/i.test(text);
      const hasShadowEffect = /Shadow and glow/i.test(text);
      const hasAnyAppearanceControl = [
        lineInput,
        fillInput,
        hasFillColor,
        hasStrokeColor,
        hasGradientFill,
        hasPatternFill,
        hasStickerBorder,
        hasStrokeOutputMode,
        hasShadowEffect,
      ].some(Boolean);
      return {
        hasLineWeight: /Line weight/i.test(text),
        hasFillSpread: /Fill spread/i.test(text),
        hasFillColor,
        hasStrokeColor,
        hasGradientFill,
        hasPatternFill,
        hasStickerBorder,
        hasStrokeOutputMode,
        hasShadowEffect,
        hasAnyAppearanceControl,
        lineWeightDisabled: Boolean(lineInput?.disabled),
        fillSpreadDisabled: Boolean(fillInput?.disabled),
      };
    })()`);

    const appearance = await applyFillSpreadIfAvailable(client);
    if (appearance.applied) {
      await delay(150);
    }

    const copy = await verifyCopySvg(client);
    const download = await verifySvgDownload(client, `${safeName(testCase.route)}-output-ux`);

    await clickButtonMatching(client, "/Done editing/i");
    const restored = await waitForValue(
      client,
      outputUxSnapshotExpression,
      8_000,
      (value) =>
        !value?.focused &&
        value?.expandedCards >= 1 &&
        value?.hasHeaderMinimize &&
        value?.hasFileSize &&
        !value?.minimizeInActionRow,
    );

    await clickControlBySelector(client, '[data-output-minimize-control="true"]');
    const collapsed = await waitForValue(
      client,
      outputUxSnapshotExpression,
      8_000,
      (value) => value?.collapsedCards >= 1,
    );
    await clickOutputRestoreControl(client);
    const expanded = await waitForValue(
      client,
      outputUxSnapshotExpression,
      8_000,
      (value) => value?.collapsedCards === 0 && value?.expandedCards >= 1,
    );
    let batchShortcut = { tested: false, ok: true, status: "not-applicable" };
    if (testCase.route === "/") {
      const clickedBatch = await clickButtonMatching(client, "/Batch/i", {
        reject: "/ZIP|Convert/i",
      });
      const batchFocused = await waitForValue(
        client,
        outputUxSnapshotExpression,
        8_000,
        (value) =>
          value?.focused &&
          value?.batchSectionOpen &&
          value?.openSettingsSectionCount === 1 &&
          !value?.hasFocusedRedundantActions,
      );
      await clickButtonMatching(client, "/Done editing/i");
      batchShortcut = {
        tested: true,
        ok: Boolean(clickedBatch && batchFocused.batchSectionOpen),
        clicked: clickedBatch,
        snapshot: batchFocused,
      };
    }
    const responsive = await runOutputUxResponsiveChecks(client);

    const ok =
      errors.length === 0 &&
      Boolean(opened) &&
      focused.focused &&
      focused.hasDone &&
      focused.hasOutputComparison &&
      focused.hasOriginalComparison &&
      focused.hasSettingsPanel &&
      focused.hasFileSize &&
      !focused.hasFocusedRedundantActions &&
      focused.openSettingsSectionCount === 0 &&
      controls.hasAnyAppearanceControl &&
      (!controls.hasLineWeight || focused.appearanceRanges.lineWeightMax >= 30) &&
      (!controls.hasFillSpread || focused.appearanceRanges.fillSpreadMax >= 30) &&
      Math.max(
        focused.transitionSample.outputPanelMs,
        focused.transitionSample.workspaceMs,
        focused.transitionSample.settingsPanelMs,
      ) >= 280 &&
      !focused.minimizeInActionRow &&
      focused.leftPaneCollapsed &&
      focused.editorNearTop &&
      focused.layoutShift.ok &&
      accordionShift.ok &&
      focused.cursorViolations.length === 0 &&
      (!appearance.applied ||
        (Number(appearance.value) >= 20 && copy.hasFillSpread && download.hasFillSpread)) &&
      copy.ok &&
      download.ok &&
      !restored.focused &&
      restored.hasHeaderMinimize &&
      restored.hasFileSize &&
      !restored.minimizeInActionRow &&
      collapsed.collapsedCards >= 1 &&
      expanded.expandedCards >= 1 &&
      historyReplacement.ok &&
      batchShortcut.ok &&
      responsive.every((item) => item.ok) &&
      output.previewDecoded;

    return {
      route: testCase.route,
      opened,
      historyReplacement,
      focused,
      accordionShift,
      controls,
      appearance,
      copy,
      download,
      restored,
      collapsed,
      expanded,
      batchShortcut,
      responsive,
      consoleErrors: errors,
      ok,
      failure: ok ? null : "Focused editor, history preservation, collapse, or appearance controls did not behave as expected.",
    };
  } catch (error) {
    return {
      route: testCase.route,
      consoleErrors: errors,
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

async function verifyOutputHistoryPersistsAcrossInputReplacement(
  client,
  firstFixture,
  replacementFixture,
  route,
) {
  const firstName = path.basename(firstFixture);
  const replacementName = path.basename(replacementFixture);
  const shouldVerifySourcePreview = new Set([
    "/",
    "/png-to-svg-converter",
    "/png-to-layered-svg-for-cricut",
  ]).has(route);
  const before = await waitForValue(
    client,
    outputUxSnapshotExpression,
    8_000,
    (value) =>
      value?.expandedCards >= 1 &&
      value?.sourceFileNames?.some((name) => name === firstName),
  );
  const firstPreviewBefore = shouldVerifySourcePreview
    ? await verifyFocusedOriginalPreviewForSource(client, firstName)
    : null;
  if (firstPreviewBefore) await closeFocusedEditorIfOpen(client);
  const removed = await clickButtonIfPresent(client, "/Remove selected file|^x$|^×$/i");
  const afterRemove = await waitForValue(
    client,
    outputUxSnapshotExpression,
    8_000,
    (value) =>
      value?.expandedCards >= before.expandedCards &&
      value?.sourceFileNames?.some((name) => name === firstName),
  ).catch(() => null);
  const firstPreviewAfterRemove =
    shouldVerifySourcePreview && afterRemove
      ? await verifyFocusedOriginalPreviewForSource(client, firstName).catch(
          (error) => ({
            ok: false,
            failure: error instanceof Error ? error.message : String(error),
          }),
        )
      : null;
  if (firstPreviewAfterRemove) await closeFocusedEditorIfOpen(client);
  await setFileInput(client, replacementFixture);
  let after = await waitForValue(
    client,
    outputUxSnapshotExpression,
    10_000,
    (value) =>
      value?.expandedCards >= Math.min(10, before.expandedCards + 1) &&
      value?.sourceFileNames?.some((name) => name === firstName) &&
      value?.sourceFileNames?.some((name) => name === replacementName),
  ).catch(() => null);
  if (!after) {
    await clickConvertButton(client).catch(() => {});
    after = await waitForValue(
      client,
      outputUxSnapshotExpression,
      60_000,
      (value) =>
        value?.expandedCards >= Math.min(10, before.expandedCards + 1) &&
        value?.sourceFileNames?.some((name) => name === firstName) &&
        value?.sourceFileNames?.some((name) => name === replacementName),
    ).catch(() => null);
  }
  const firstPreviewAfterReplacement =
    shouldVerifySourcePreview && after
      ? await verifyFocusedOriginalPreviewForSource(client, firstName).catch(
          (error) => ({
            ok: false,
            failure: error instanceof Error ? error.message : String(error),
          }),
        )
      : null;
  if (firstPreviewAfterReplacement) await closeFocusedEditorIfOpen(client);
  const replacementPreview =
    shouldVerifySourcePreview && after
      ? await verifyFocusedOriginalPreviewForSource(client, replacementName).catch(
          (error) => ({
            ok: false,
            failure: error instanceof Error ? error.message : String(error),
          }),
        )
      : null;
  if (replacementPreview) await closeFocusedEditorIfOpen(client);
  const sourcePreviewOk =
    !shouldVerifySourcePreview ||
    (firstPreviewBefore?.ok &&
      firstPreviewAfterRemove?.ok &&
      firstPreviewAfterReplacement?.ok &&
      replacementPreview?.ok &&
      firstPreviewAfterReplacement.src &&
      replacementPreview.src &&
      firstPreviewAfterReplacement.src !== replacementPreview.src);
  return {
    ok: Boolean(afterRemove && after && sourcePreviewOk),
    removed,
    firstName,
    replacementName,
    before,
    afterRemove,
    after,
    firstPreviewBefore,
    firstPreviewAfterRemove,
    firstPreviewAfterReplacement,
    replacementPreview,
    sourcePreviewOk,
  };
}

async function verifyFocusedOriginalPreviewForSource(client, sourceFileName) {
  const opened = await openOutputEditorForSource(client, sourceFileName);
  if (!opened) {
    throw new Error(`Could not open focused editor for ${sourceFileName}.`);
  }
  const snapshot = await waitForValue(
    client,
    focusedOriginalPreviewSnapshotExpression,
    8_000,
    (value) =>
      value?.focused &&
      value?.hasOriginalContainer &&
      value?.hasImage &&
      value?.decoded &&
      !value?.showsUnavailable,
  );
  return { ...snapshot, ok: true, sourceFileName };
}

async function openOutputEditorForSource(client, sourceFileName) {
  const result = await waitForValue(
    client,
    () => `(() => {
      const sourceName = ${JSON.stringify(sourceFileName)};
      const cards = Array.from(document.querySelectorAll('[data-collapse-state]'));
      const focusedCard = cards.find((candidate) =>
        candidate.getAttribute('data-focused-editor') === 'true' &&
        Array.from(candidate.querySelectorAll('[data-output-source-file]')).some(
          (element) => element.getAttribute('data-output-source-file') === sourceName,
        )
      );
      if (focusedCard) return { clicked: true, alreadyFocused: true };
      const card = cards.find((candidate) =>
        Array.from(candidate.querySelectorAll('[data-output-source-file]')).some(
          (element) => element.getAttribute('data-output-source-file') === sourceName,
        )
      );
      if (!card) return { clicked: false, reason: 'missing-card' };
      if (card.getAttribute('data-collapse-state') === 'collapsed') {
        const restore = Array.from(card.querySelectorAll('button')).find((button) =>
          /Restore|Expand/i.test(button.innerText || button.getAttribute('aria-label') || ''),
        );
        restore?.click();
        return { clicked: false, reason: 'restoring' };
      }
      const button = Array.from(card.querySelectorAll('button')).find((candidate) =>
        /Settings\\s*\\/\\s*Edit/i.test(candidate.innerText || candidate.getAttribute('aria-label') || ''),
      );
      if (!button || button.disabled) return { clicked: false, reason: 'not-ready' };
      button.click();
      return { clicked: true };
    })()`,
    30_000,
    (value) => value?.clicked === true,
  ).catch(() => null);
  return Boolean(result?.clicked);
}

async function closeFocusedEditorIfOpen(client) {
  const clicked = await clickButtonIfPresent(client, "/Done editing/i");
  if (clicked) {
    await waitForValue(
      client,
      outputUxSnapshotExpression,
      8_000,
      (value) => !value?.focused && value?.expandedCards >= 1,
    ).catch(() => null);
  }
  return clicked;
}

function focusedOriginalPreviewSnapshotExpression() {
  return `(() => {
    const focusedCard = document.querySelector('[data-collapse-state="expanded"][data-focused-editor="true"]');
    const original = document.querySelector('[data-editor-original-preview="true"]');
    const image = original?.querySelector('img') || null;
    const text = original?.innerText || "";
    return {
      focused: Boolean(focusedCard),
      hasOriginalContainer: Boolean(original),
      hasImage: Boolean(image),
      decoded: Boolean(image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
      src: image?.currentSrc || image?.src || "",
      naturalWidth: image?.naturalWidth || 0,
      naturalHeight: image?.naturalHeight || 0,
      showsUnavailable: /unavailable/i.test(text),
      text: text.slice(0, 240),
    };
  })()`;
}

async function verifyFocusedAccordionHasNoHorizontalShift(client) {
  const before = await outputUxLayoutSnapshot(client);
  const result = await evaluate(client, `(async () => {
    const panel = document.querySelector('[data-editor-settings-panel="true"]');
    if (!panel) return { clicked: false, samples: [] };
    const buttons = Array.from(panel.querySelectorAll('button[aria-controls]'));
    const read = () => {
      const rect = (element) => {
        const r = element?.getBoundingClientRect?.();
        return r
          ? { left: r.left, right: r.right, width: r.width }
          : { left: 0, right: 0, width: 0 };
      };
      const root = document.querySelector('main') || document.body;
      const outputPanel = document.querySelector('[data-output-panel-focused="true"]');
      const grid = outputPanel?.parentElement || null;
      const workspace = document.querySelector('[data-focused-editor-workspace="true"]');
      const previewPane =
        document.querySelector('[data-editor-comparison-panel="true"]') ||
        document.querySelector('[data-editor-output-preview="true"]');
      const settingsRail = document.querySelector('[data-editor-settings-panel="true"]');
      const accordion =
        settingsRail?.querySelector('[data-settings-section]') || settingsRail;
      return {
        root: rect(root),
        grid: rect(grid),
        outputPanel: rect(outputPanel),
        workspace: rect(workspace),
        previewPane: rect(previewPane),
        settingsRail: rect(settingsRail),
        accordion: rect(accordion),
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    };
    const settledBefore = read();
    const samples = [];
    for (const button of buttons) {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 280));
      samples.push(read());
    }
    return { clicked: buttons.length > 0, settledBefore, samples };
  })()`);
  const after = await outputUxLayoutSnapshot(client);
  const base = result.settledBefore || {};
  const trackedKeys = [
    "root",
    "grid",
    "outputPanel",
    "workspace",
    "previewPane",
    "settingsRail",
    "accordion",
  ];
  const deltas = (result.samples || []).map((sample) => {
    const entry = {
      hasHorizontalOverflow: sample.scrollWidth > sample.viewportWidth + 2,
    };
    for (const key of trackedKeys) {
      const current = sample[key] || {};
      const baseline = base[key] || {};
      entry[`${key}LeftDelta`] = Math.abs((current.left || 0) - (baseline.left || 0));
      entry[`${key}RightDelta`] = Math.abs((current.right || 0) - (baseline.right || 0));
      entry[`${key}WidthDelta`] = Math.abs((current.width || 0) - (baseline.width || 0));
    }
    return entry;
  });
  const maxDelta = deltas.reduce(
    (acc, sample) => {
      const next = { ...acc };
      for (const [key, value] of Object.entries(sample)) {
        if (key === "hasHorizontalOverflow") {
          next.hasHorizontalOverflow = next.hasHorizontalOverflow || Boolean(value);
        } else {
          next[key] = Math.max(next[key] || 0, Number(value) || 0);
        }
      }
      return next;
    },
    { hasHorizontalOverflow: false },
  );
  const stableKeys = [
    "previewPaneLeftDelta",
    "previewPaneRightDelta",
    "previewPaneWidthDelta",
    "settingsRailLeftDelta",
    "settingsRailRightDelta",
    "settingsRailWidthDelta",
    "workspaceLeftDelta",
    "workspaceRightDelta",
    "outputPanelLeftDelta",
    "outputPanelRightDelta",
  ];
  const maxStableDelta = stableKeys.reduce(
    (max, key) => Math.max(max, Number(maxDelta[key]) || 0),
    0,
  );
  return {
    ok:
      Boolean(result.clicked) &&
      !after.hasHorizontalOverflow &&
      !maxDelta.hasHorizontalOverflow &&
      maxStableDelta <= 2,
    clicked: result.clicked,
    sampleCount: result.samples?.length || 0,
    maxStableDelta,
    trackedDeltas: maxDelta,
    samples: result.samples || [],
    before,
    after,
  };
}

async function runOutputUxResponsiveChecks(client) {
  const widths = [320, 360, 390, 430, 768, 1024, 1280, 1440, 1920];
  const checks = [];
  for (const width of widths) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width < 768 ? 900 : 960,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await delay(80);
    const normal = await outputUxLayoutSnapshot(client);
    await clickButtonMatching(client, "/Settings \\/ Edit/i");
    const focused = await waitForValue(
      client,
      outputUxSnapshotExpression,
      8_000,
      (value) => value?.focused && value?.hasDone && value?.hasPreview,
    );
    const focusedLayout = await outputUxLayoutSnapshot(client);
    const accordionShift = await verifyFocusedAccordionHasNoHorizontalShift(client);
    await clickButtonMatching(client, "/Done editing/i");
    await waitForValue(
      client,
      outputUxSnapshotExpression,
      8_000,
      (value) => !value?.focused && value?.expandedCards >= 1,
    );
    await clickControlBySelector(client, '[data-output-minimize-control="true"]');
    const collapsed = await waitForValue(
      client,
      outputUxSnapshotExpression,
      8_000,
      (value) => value?.collapsedCards >= 1,
    );
    const collapsedLayout = await outputUxLayoutSnapshot(client);
    await clickOutputRestoreControl(client);
    await waitForValue(
      client,
      outputUxSnapshotExpression,
      8_000,
      (value) => value?.collapsedCards === 0 && value?.expandedCards >= 1,
    );
    const conditions = {
      normalNoOverflow: !normal.hasHorizontalOverflow,
      focused: focused.focused,
      focusedHasOutputComparison: focused.hasOutputComparison,
      focusedHasOriginalComparison: focused.hasOriginalComparison,
      focusedHasSettingsPanel: focused.hasSettingsPanel,
      focusedHasFileSize: focused.hasFileSize,
      noFocusedRedundantActions: !focused.hasFocusedRedundantActions,
      noSettingsSectionsOpen: focused.openSettingsSectionCount === 0,
      appearanceControlsAvailable:
        focused.appearanceControlCount > 0 ||
        focused.appearanceRanges.lineWeightMax >= 30 ||
        focused.appearanceRanges.fillSpreadMax >= 30,
      lineWeightRange:
        focused.appearanceRanges.lineWeightMax === 0 ||
        focused.appearanceRanges.lineWeightMax >= 30,
      fillSpreadRange:
        focused.appearanceRanges.fillSpreadMax === 0 ||
        focused.appearanceRanges.fillSpreadMax >= 30,
      noMinimizeInActionRow: !focused.minimizeInActionRow,
      leftPaneCollapsed: focused.leftPaneCollapsed,
      editorNearTop: focused.editorNearTop,
      noCursorViolations: focused.cursorViolations.length === 0,
      focusedNoLayoutShift: focused.layoutShift.ok,
      focusedLayoutNoOverflow: !focusedLayout.hasHorizontalOverflow,
      focusedLayoutHasOutputComparison: focusedLayout.hasOutputComparison,
      focusedLayoutHasOriginalComparison: focusedLayout.hasOriginalComparison,
      focusedLayoutHasSettingsPanel: focusedLayout.hasSettingsPanel,
      focusedLayoutLeftPaneCollapsed: focusedLayout.leftPaneCollapsed,
      focusedLayoutEditorNearTop: focusedLayout.editorNearTop,
      accordionStable: accordionShift.ok,
      collapsedCardCreated: collapsed.collapsedCards >= 1,
      collapsedNoOverflow: !collapsedLayout.hasHorizontalOverflow,
    };
    const ok = Object.values(conditions).every(Boolean);
    checks.push({
      width,
      ok,
      normal,
      focused: focusedLayout,
      conditionFailures: Object.entries(conditions)
        .filter(([, passed]) => !passed)
        .map(([name]) => name),
      accordionShift,
      collapsed: collapsedLayout,
    });
  }
  await client.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
  return checks;
}

async function outputUxLayoutSnapshot(client) {
  return evaluate(client, `(() => {
    const doc = document.documentElement;
    const cards = Array.from(document.querySelectorAll("[data-collapse-state]"));
    const expanded = cards.filter((card) => card.getAttribute("data-collapse-state") === "expanded");
    const collapsed = cards.filter((card) => card.getAttribute("data-collapse-state") === "collapsed");
    const focused = cards.filter((card) => card.getAttribute("data-focused-editor") === "true");
    const preview = document.querySelector('[data-editor-output-preview="true"] img, [data-collapse-state="expanded"] img');
    const outputComparison = document.querySelector('[data-editor-output-preview="true"]');
    const originalComparison = document.querySelector('[data-editor-original-preview="true"]');
    const settingsPanel = document.querySelector('[data-editor-settings-panel="true"]');
    const workspace = document.querySelector('[data-focused-editor-workspace="true"]');
    const outputPanel = document.querySelector('[data-output-panel-focused="true"]');
    const grid = outputPanel?.parentElement || null;
    const leftPane = grid
      ? Array.from(grid.children).find((child) => child !== outputPanel && child.className && String(child.className).includes("order-1"))
      : null;
    const leftPaneRect = leftPane?.getBoundingClientRect?.();
    const outputPanelRect = outputPanel?.getBoundingClientRect?.();
    const gridRect = grid?.getBoundingClientRect?.();
    const leftPaneStyle = leftPane ? getComputedStyle(leftPane) : null;
    const leftPaneCollapsed = !outputPanel || !leftPane || !leftPaneRect || !leftPaneStyle
      ? true
      : Number.parseFloat(leftPaneStyle.opacity || "1") < 0.15 ||
        leftPaneStyle.pointerEvents === "none" ||
        leftPaneRect.height < 24 ||
        leftPaneRect.width < 24;
    const editorNearTop = !outputPanel || !outputPanelRect || !gridRect
      ? true
      : outputPanelRect.top <= gridRect.top + 56;
    const settingsPanelRect = settingsPanel?.getBoundingClientRect?.();
    const workspaceRect = workspace?.getBoundingClientRect?.();
    const previewPane =
      document.querySelector('[data-editor-comparison-panel="true"]') ||
      document.querySelector('[data-editor-output-preview="true"]');
    const previewPaneRect = previewPane?.getBoundingClientRect?.();
    return {
      viewportWidth: window.innerWidth,
      scrollWidth: doc.scrollWidth,
      hasHorizontalOverflow: doc.scrollWidth > window.innerWidth + 2,
      expandedCards: expanded.length,
      collapsedCards: collapsed.length,
      focusedCards: focused.length,
      hasPreview: Boolean(preview && preview.complete && preview.naturalWidth > 0 && preview.naturalHeight > 0),
      hasDone: /Done editing/i.test(document.body.innerText || ""),
      hasOutputComparison: Boolean(outputComparison),
      hasOriginalComparison: Boolean(originalComparison),
      hasSettingsPanel: Boolean(settingsPanel),
      leftPaneCollapsed,
      editorNearTop,
      settingsPanelRect: settingsPanelRect
        ? {
            left: settingsPanelRect.left,
            right: settingsPanelRect.right,
            width: settingsPanelRect.width,
          }
        : null,
      workspaceRect: workspaceRect
        ? {
            left: workspaceRect.left,
            right: workspaceRect.right,
            width: workspaceRect.width,
          }
        : null,
      outputPanelRect: outputPanelRect
        ? {
            left: outputPanelRect.left,
            right: outputPanelRect.right,
            width: outputPanelRect.width,
          }
        : null,
      gridRect: gridRect
        ? {
            left: gridRect.left,
            right: gridRect.right,
            width: gridRect.width,
          }
        : null,
      previewPaneRect: previewPaneRect
        ? {
            left: previewPaneRect.left,
            right: previewPaneRect.right,
            width: previewPaneRect.width,
          }
        : null,
    };
  })()`);
}

async function applyFillSpreadIfAvailable(client) {
  return await evaluate(client, `(() => {
    const labels = Array.from(document.querySelectorAll("label"));
    const label = labels.find((candidate) => /Fill spread/i.test(candidate.textContent || ""));
    if (!label) return { available: false, applied: false, reason: "missing" };
    const input = label.querySelector('input[type="range"]') || label.parentElement?.querySelector('input[type="range"]');
    if (!input) return { available: true, applied: false, reason: "missing-input" };
    if (input.disabled) return { available: true, applied: false, disabled: true };
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "20");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { available: true, applied: true, value: input.value, max: input.max };
  })()`);
}

function outputUxSnapshotExpression() {
  return `(() => {
    const cards = Array.from(document.querySelectorAll("[data-collapse-state]"));
    const focusedContainers = Array.from(document.querySelectorAll('[data-focused-editor="true"]'));
    const text = document.body.innerText || "";
    const focusedCards = cards.filter((card) => card.getAttribute("data-focused-editor") === "true");
    const expandedCards = cards.filter((card) => card.getAttribute("data-collapse-state") === "expanded");
    const collapsedCards = cards.filter((card) => card.getAttribute("data-collapse-state") === "collapsed");
    const focusedCard = focusedCards[0] || null;
    const previews = Array.from(document.querySelectorAll('[data-editor-output-preview="true"] img, [data-collapse-state="expanded"] img'));
    const outputComparison = document.querySelector('[data-editor-output-preview="true"]');
    const originalComparison = document.querySelector('[data-editor-original-preview="true"]');
    const settingsPanel = document.querySelector('[data-editor-settings-panel="true"]');
    const doc = document.documentElement;
    const openSettingsSections = settingsPanel
      ? Array.from(settingsPanel.querySelectorAll('[data-settings-section-open="true"]'))
      : [];
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const focusedButtons = focusedCard
      ? Array.from(focusedCard.querySelectorAll("button"))
          .filter((button) => visible(button))
          .map((button) => ({
            label: (button.innerText || button.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " "),
            isOutputMinimize: button.getAttribute("data-output-minimize-control") === "true",
          }))
      : [];
    const hasFocusedRedundantActions = focusedButtons.some(({ label, isOutputMinimize }) =>
      isOutputMinimize || /Settings\\s*\\/\\s*Edit/i.test(label)
    );
    const outputPanel = document.querySelector('[data-output-panel-focused="true"]');
    const grid = outputPanel?.parentElement || null;
    const leftPane = grid
      ? Array.from(grid.children).find((child) => child !== outputPanel && child.className && String(child.className).includes("order-1"))
      : null;
    const leftPaneRect = leftPane?.getBoundingClientRect?.();
    const outputPanelRect = outputPanel?.getBoundingClientRect?.();
    const gridRect = grid?.getBoundingClientRect?.();
    const leftPaneStyle = leftPane ? getComputedStyle(leftPane) : null;
    const leftPaneCollapsed = !outputPanel || !leftPane || !leftPaneRect || !leftPaneStyle
      ? true
      : Number.parseFloat(leftPaneStyle.opacity || "1") < 0.15 ||
        leftPaneStyle.pointerEvents === "none" ||
        leftPaneRect.height < 24 ||
        leftPaneRect.width < 24;
    const editorNearTop = !outputPanel || !outputPanelRect || !gridRect
      ? true
      : outputPanelRect.top <= gridRect.top + 56;
    const cursorViolations = Array.from((outputPanel || document).querySelectorAll("button, summary"))
      .filter((element) => visible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true")
      .map((element) => ({
        text: (element.textContent || element.getAttribute("aria-label") || element.title || element.tagName).trim().replace(/\\s+/g, " ").slice(0, 80),
        cursor: getComputedStyle(element).cursor,
      }))
      .filter((entry) => entry.cursor !== "pointer");
    const sourceFileNames = Array.from(document.querySelectorAll('[data-output-source-file]'))
      .map((element) => element.getAttribute("data-output-source-file") || "")
      .filter(Boolean);
    const appearanceRanges = Array.from(document.querySelectorAll("label")).reduce((acc, label) => {
      const text = label.textContent || "";
      const input = label.querySelector('input[type="range"]') || label.parentElement?.querySelector('input[type="range"]');
      if (!input) return acc;
      if (/Line weight/i.test(text)) acc.lineWeightMax = Number(input.max || 0);
      if (/Fill spread/i.test(text)) acc.fillSpreadMax = Number(input.max || 0);
      return acc;
    }, { lineWeightMax: 0, fillSpreadMax: 0 });
    const appearanceControlCount = Array.from(document.querySelectorAll('[data-output-polish-group] button, [data-output-polish-group] input, [data-output-polish-group] select'))
      .filter((element) => visible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true")
      .length;
    const transitionSample = (() => {
      const outputPanel = document.querySelector('[data-output-panel-focused="true"]');
      const workspace = document.querySelector('[data-focused-editor-workspace="true"]');
      const settingsPanel = document.querySelector('[data-editor-settings-panel="true"]');
      const getMs = (element) => {
        if (!element) return 0;
        const style = getComputedStyle(element);
        const durations = style.transitionDuration.split(",").map((value) => {
          const trimmed = value.trim();
          if (trimmed.endsWith("ms")) return Number.parseFloat(trimmed);
          if (trimmed.endsWith("s")) return Number.parseFloat(trimmed) * 1000;
          return Number.parseFloat(trimmed) || 0;
        });
        const animationDuration = style.animationDuration.trim().endsWith("s")
          ? Number.parseFloat(style.animationDuration) * 1000
          : Number.parseFloat(style.animationDuration) || 0;
        return Math.max(animationDuration, ...durations);
      };
      return {
        outputPanelMs: getMs(outputPanel),
        workspaceMs: getMs(workspace),
        settingsPanelMs: getMs(settingsPanel),
      };
    })();
    return {
      focused: focusedContainers.length > 0 || focusedCards.length > 0,
      focusedCards: focusedCards.length,
      expandedCards: expandedCards.length,
      collapsedCards: collapsedCards.length,
      hasDone: /Done editing/i.test(text),
      hasPreview: previews.some((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0),
      hasOutputComparison: Boolean(outputComparison),
      hasOriginalComparison: Boolean(originalComparison),
      hasSettingsPanel: Boolean(settingsPanel),
      hasFileSize: Boolean(document.querySelector('[data-output-file-size="true"]')),
      hasHeaderMinimize: Boolean(document.querySelector('[data-output-minimize-control="true"]')),
      minimizeInActionRow: Boolean(document.querySelector('[data-output-action-row="true"] [data-output-minimize-control="true"]')),
      hasFocusedRedundantActions,
      openSettingsSectionCount: openSettingsSections.length,
      batchShortcut: Boolean(document.querySelector('[data-output-batch-shortcut="true"]')),
      batchSectionOpen: Boolean(document.querySelector('[data-settings-section^="output-batch-"][data-settings-section-open="true"]')),
      leftPaneCollapsed,
      editorNearTop,
      cursorViolations,
      sourceFileNames,
      appearanceRanges,
      appearanceControlCount,
      transitionSample,
      layoutShift: {
        ok: doc.scrollWidth <= window.innerWidth + 2,
        scrollWidth: doc.scrollWidth,
        viewportWidth: window.innerWidth,
      },
    };
  })()`;
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
    copyHasStrokeWidth: copy.hasStrokeWidth,
    downloadOk: download.ok,
    downloadFile: download.file,
    downloadBytes: download.bytes,
    downloadHasStrokeWidth: download.hasStrokeWidth,
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
    hasFillSpread: typeof text === "string" ? /data-fill-spread=|paint-order=["']stroke fill markers/i.test(text) : false,
    hasStrokeWidth: typeof text === "string" ? /stroke-width=/i.test(text) : false,
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
    hasFillSpread: /data-fill-spread=|paint-order=["']stroke fill markers/i.test(text),
    hasStrokeWidth: /stroke-width=/i.test(text),
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

async function clickControlBySelector(client, selector) {
  const clicked = await evaluate(client, `(() => {
    const controls = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
    const target = controls.find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      const style = getComputedStyle(candidate);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        !candidate.disabled &&
        candidate.getAttribute("aria-disabled") !== "true"
      );
    });
    if (!target) return null;
    const label = target.innerText?.trim() || target.getAttribute("aria-label") || ${JSON.stringify(selector)};
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
    target.click();
    return label;
  })()`);
  if (!clicked) throw new Error(`No visible enabled control matched ${selector}.`);
  return clicked;
}

async function clickOutputRestoreControl(client) {
  const clickedByMarker = await clickControlIfPresentBySelector(client, '[data-output-restore-control="true"]');
  if (clickedByMarker) return clickedByMarker;
  return clickButtonMatching(client, "/^Restore$/i");
}

async function clickControlIfPresentBySelector(client, selector) {
  return evaluate(client, `(() => {
    const controls = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
    const target = controls.find((candidate) => {
      const rect = candidate.getBoundingClientRect();
      const style = getComputedStyle(candidate);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        !candidate.disabled &&
        candidate.getAttribute("aria-disabled") !== "true"
      );
    });
    if (!target) return null;
    const label = target.innerText?.trim() || target.getAttribute("aria-label") || ${JSON.stringify(selector)};
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
    target.click();
    return label;
  })()`);
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
  let nodeId = await setFileInputFilesByFreshNode(client, selector, filePaths);
  const filesAfterNodeSet = await evaluate(client, `(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    return input ? Array.from(input.files || []).map((file) => file.name) : null;
  })()`).catch(() => []);
  if (Array.isArray(filesAfterNodeSet) && filesAfterNodeSet.length === 0) {
    try {
      const { node } = await describeFreshInputNode(client, selector, nodeId);
      nodeId = node.nodeId || nodeId;
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

async function queryFileInputNodeId(client, selector) {
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
  return nodeId;
}

async function setFileInputFilesByFreshNode(client, selector, filePaths) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nodeId = await queryFileInputNodeId(client, selector);
    try {
      await client.send("DOM.setFileInputFiles", { nodeId, files: filePaths });
      return nodeId;
    } catch (error) {
      lastError = error;
      if (!isStaleDomNodeError(error)) throw error;
      await delay(150);
    }
  }
  throw lastError || new Error(`Could not attach files to ${selector}.`);
}

async function describeFreshInputNode(client, selector, preferredNodeId) {
  try {
    return await client.send("DOM.describeNode", { nodeId: preferredNodeId });
  } catch (error) {
    if (!isStaleDomNodeError(error)) throw error;
    const nodeId = await queryFileInputNodeId(client, selector);
    return client.send("DOM.describeNode", { nodeId });
  }
}

function isStaleDomNodeError(error) {
  return /could not find node|no node with given id|cannot find context/i.test(
    error instanceof Error ? error.message : String(error),
  );
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

async function selectCenterlinePreset(client, route) {
  await evaluate(client, `(() => {
    const button = Array.from(document.querySelectorAll("button"))
      .find((candidate) => /^Show \\d+ more presets/i.test(candidate.innerText || ""));
    if (button) button.click();
    return Boolean(button);
  })()`);
  await delay(250);
  const matchers = getRouteCenterlinePresetMatchers(route);
  return evaluate(client, `(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const reject = /Show|Clear|Convert|Download|Copy|Settings|Search presets|Filter presets/i;
    const preferredMatchers = ${JSON.stringify(matchers)}.map((source) => new RegExp(source, "i"));
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

function getRouteCenterlinePresetMatchers(_route) {
  if (process.env.CENTERLINE_PRESET_PATTERN) {
    return [process.env.CENTERLINE_PRESET_PATTERN];
  }
  return [
    "^Stroke Trace - Clean Lines\\b",
    "^Centerline Sketch\\b",
    "^Technical Outline Stroke\\b",
  ];
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

async function waitForConvertButtonEnabled(client, timeoutMs) {
  return waitForValue(
    client,
    () => `(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const button = buttons.find((candidate) => {
        const text = candidate.innerText || "";
        const rect = candidate.getBoundingClientRect();
        const visible =
          rect.width > 0 &&
          rect.height > 0 &&
          getComputedStyle(candidate).visibility !== "hidden" &&
          getComputedStyle(candidate).display !== "none";
        return /Convert|Create/i.test(text) && !/batch|ZIP|Download/i.test(text) && visible;
      });
      return button
        ? { found: true, disabled: Boolean(button.disabled), label: button.innerText.trim() }
        : { found: false, disabled: true, label: null };
    })()`,
    timeoutMs,
    (state) => state?.found === true && state.disabled === false,
  );
}

async function waitForOutput(client, timeoutMs, expectedEngine = null) {
  return waitForValue(
    client,
    () => `(async () => {
      const outputs = Array.from(document.querySelectorAll("[data-engine-used]"))
        .filter((candidate) => {
          const engine = candidate.getAttribute("data-engine-used");
          return engine === "vtracer" || engine === "potrace" || engine === "centerline";
        });
      const output = ${JSON.stringify(expectedEngine)}
        ? outputs.find((candidate) => candidate.getAttribute("data-engine-used") === ${JSON.stringify(expectedEngine)})
        : outputs[0];
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
      let decodedPreviewSvg = "";
      let previewVisibleDrawableCount = 0;
      let previewPathCount = 0;
      let previewViewBoxOk = false;
      const previewSrc = previewImages[0]?.getAttribute("src") || "";
      if (previewSrc.startsWith("data:image/svg+xml")) {
        const encoded = previewSrc.slice(previewSrc.indexOf(",") + 1);
        decodedPreviewSvg = decodeURIComponent(encoded);
      } else if (previewSrc.startsWith("blob:")) {
        decodedPreviewSvg = await fetch(previewSrc).then((response) => response.text()).catch(() => "");
      }
      if (decodedPreviewSvg) {
        const parsed = new DOMParser().parseFromString(decodedPreviewSvg, "image/svg+xml");
        previewParseError = parsed.querySelector("parsererror")?.textContent?.slice(0, 400) || "";
        previewPathCount = parsed.querySelectorAll("path").length;
        const svgRoot = parsed.querySelector("svg");
        const viewBox = svgRoot?.getAttribute("viewBox") || "";
        const viewBoxParts = viewBox.trim().split(/[\\s,]+/).map(Number);
        const width = Number.parseFloat(svgRoot?.getAttribute("width") || "");
        const height = Number.parseFloat(svgRoot?.getAttribute("height") || "");
        previewViewBoxOk =
          (viewBoxParts.length === 4 &&
            viewBoxParts.every(Number.isFinite) &&
            viewBoxParts[2] > 0 &&
            viewBoxParts[3] > 0) ||
          (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0);
        const isVisibleDrawable = (element) => {
          const tag = element.tagName.toLowerCase();
          const attrs = element.getAttributeNames()
            .map((name) => name + '="' + (element.getAttribute(name) || "") + '"')
            .join(" ");
          if (/display\\s*=\\s*["']none["']/i.test(attrs)) return false;
          if (/visibility\\s*=\\s*["']hidden["']/i.test(attrs)) return false;
          if (/opacity\\s*=\\s*["'](?:0|0\\.0+)["']/i.test(attrs)) return false;
          if (/fill-opacity\\s*=\\s*["'](?:0|0\\.0+)["']/i.test(attrs)) return false;
          if (/stroke-opacity\\s*=\\s*["'](?:0|0\\.0+)["']/i.test(attrs)) return false;
          if (/style\\s*=\\s*["'][^"']*(?:display\\s*:\\s*none|visibility\\s*:\\s*hidden|opacity\\s*:\\s*0)(?:\\D|$)/i.test(attrs)) return false;
          if (tag === "path" && !(element.getAttribute("d") || "").trim()) return false;
          if (tag === "image" && !(element.getAttribute("href") || element.getAttribute("xlink:href") || "").trim()) return false;
          return true;
        };
        previewVisibleDrawableCount = Array.from(parsed.querySelectorAll("path,polygon,polyline,rect,circle,ellipse,line,text,image"))
          .filter(isVisibleDrawable).length;
        if (previewParseError) {
          const line = decodedPreviewSvg.split(/\\r?\\n/)[3] || decodedPreviewSvg;
          previewParseExcerpt = line.slice(3800, 4100);
        }
      }
      return {
        hasOutput: Boolean(output),
        outputCount: outputs.length,
        engineUsed: inferredEngine,
        previewDecoded,
        hasBrokenPreview,
        previewImageCount: previewImages.length,
        previewSrcPrefix: previewSrc.slice(0, 600),
        previewParseError,
        previewParseExcerpt,
        previewVisibleDrawableCount,
        previewPathCount,
        previewViewBoxOk,
        previewHasMeaningfulSvg: Boolean(
          decodedPreviewSvg &&
            !previewParseError &&
            previewViewBoxOk &&
            previewVisibleDrawableCount > 0
        ),
        hasCenterlineStrokes: /fill=["']none["']/i.test(decodedPreviewSvg) && /stroke-width=["']?\\d/i.test(decodedPreviewSvg),
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
        ? value?.hasOutput && value.engineUsed === expectedEngine && value.previewDecoded && value.previewHasMeaningfulSvg && !value.hasBrokenPreview && !value.hasDerivedLabel
        : value?.hasOutput && value.previewDecoded && value.previewHasMeaningfulSvg && !value.hasBrokenPreview && !value.hasDerivedLabel),
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
    homeSvg: path.join(fixturesDir, "png-to-svg-converter.svg"),
    svg: path.join(fixturesDir, `${path.basename(sourcePng, path.extname(sourcePng))}.svg`),
    png: path.join(fixturesDir, path.basename(sourcePng)),
    jpg: path.join(fixturesDir, `${path.basename(sourcePng, path.extname(sourcePng))}.jpg`),
    webp: path.join(fixturesDir, `${path.basename(sourcePng, path.extname(sourcePng))}.webp`),
  };
  await fs.writeFile(files.homeSvg, buildHomeSvgInputFixture());
  await fs.writeFile(files.svg, `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160"><rect width="240" height="160" fill="#fff"/><circle cx="72" cy="78" r="38" fill="#0ea5e9"/><path d="M32 132 C58 102, 94 150, 126 118 S190 126, 210 78" fill="none" stroke="#111827" stroke-width="9" stroke-linecap="round"/></svg>`);
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
    homeSvg: path.join(fixturesDir, "png-to-svg-converter.svg"),
    svg: path.join(fixturesDir, "hybrid-smoke.svg"),
    png: path.join(fixturesDir, "hybrid-smoke.png"),
    jpg: path.join(fixturesDir, "hybrid-smoke.jpg"),
    webp: path.join(fixturesDir, "hybrid-smoke.webp"),
  };
  await fs.writeFile(files.homeSvg, buildHomeSvgInputFixture());
  await fs.writeFile(files.svg, svg);
  await fs.writeFile(files.png, png);
  await fs.writeFile(files.jpg, jpg);
  await fs.writeFile(files.webp, webp);
  return files;
}

function buildHomeSvgInputFixture() {
  const commands = Array.from(
    { length: 2600 },
    (_item, index) => `L ${12 + (index % 216)} ${18 + (index % 124)}`,
  ).join(" ");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">` +
    `<style>.primary{fill:#111827}.accent{fill:none;stroke:#2563eb;stroke-width:6;stroke-linecap:round}</style>` +
    `<path class="primary" d="M 8 8 ${commands} Z"/>` +
    `<path class="accent" d="M28 132 C58 102, 94 150, 126 118 S190 126, 210 78"/>` +
    `<text x="42" y="82" font-family="Arial" font-size="28" font-weight="700" fill="#ffffff">SVG</text>` +
    `</svg>`
  );
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
    /Access to resource at 'https:\/\/script\.google\.com\/macros\/s\//i.test(message) ||
    /Failed to load resource: net::ERR_FAILED/i.test(message) ||
    /Framing 'https:\/\/www\.google\.com\/' violates .*report-only Content Security Policy/i.test(message) ||
    /server responded with a status of 404/i.test(message)
  );
}

await main();
