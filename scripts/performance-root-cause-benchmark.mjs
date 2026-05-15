import { spawn, execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const execFile = promisify(execFileCallback);

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = getSmokeBaseUrl();
const debugPort = Number(
  process.env.CDP_PORT || 9500 + Math.floor(Math.random() * 400),
);
const tmpDir = path.join(
  os.tmpdir(),
  "ilovesvg-performance-root-cause",
  String(debugPort),
);
const profileDir = path.join(tmpDir, "profile");
const fixturesDir = path.join(tmpDir, "fixtures");
const downloadsDir = path.join(tmpDir, "downloads");
const reportPath = process.env.PERFORMANCE_ROOT_CAUSE_REPORT_PATH
  ? path.resolve(process.env.PERFORMANCE_ROOT_CAUSE_REPORT_PATH)
  : path.join(rootDir, "tmp", "performance-root-cause-benchmark.json");
const userFixturePath =
  process.env.PERFORMANCE_ROOT_CAUSE_SCREENSHOT_FIXTURE ||
  "C:\\Users\\Suhas\\Downloads\\Screenshot 2026-05-06 194041.png";

const routeScenarios = [
  {
    id: "home-default-screenshot",
    route: "/",
    label: "Home default on screenshot-like PNG",
    input: "screenshotPng",
    preset: null,
    expectedEngineFamily: "hybrid-auto",
    timeoutMs: 120_000,
  },
  {
    id: "home-potrace-lineart-screenshot",
    route: "/",
    label: "Home Potrace-first line-art preset on screenshot-like PNG",
    input: "screenshotPng",
    preset: [/^Lineart\b/i, /^Scan - Clean/i, /^Logo - Clean/i],
    expectedEngineFamily: "potrace-first",
    timeoutMs: 120_000,
  },
  {
    id: "home-layered-8-screenshot",
    route: "/",
    label: "Home VTracer-capable layered preset on screenshot-like PNG",
    input: "screenshotPng",
    preset: [/^Layered - 8 Color\b/i, /^Layered color SVG\b/i],
    expectedEngineFamily: "vtracer-layered",
    timeoutMs: 150_000,
  },
  {
    id: "png-layered-flat-screenshot",
    route: "/png-to-layered-svg-for-cricut",
    label: "PNG layered route flat color preset on screenshot-like PNG",
    input: "screenshotPng",
    preset: [/^Layered - Flat Color\b/i, /^Layered color SVG\b/i],
    expectedEngineFamily: "vtracer-layered",
    timeoutMs: 150_000,
  },
  {
    id: "png-layered-filled-screenshot",
    route: "/png-to-layered-svg-for-cricut",
    label: "PNG layered route filled separate colors on screenshot-like PNG",
    input: "screenshotPng",
    preset: [/^Filled Layers - Separate Colors\b/i, /^Layered color SVG\b/i],
    expectedEngineFamily: "vtracer-layered",
    timeoutMs: 150_000,
  },
  {
    id: "jpg-layered-poster-screenshot",
    route: "/jpg-to-layered-svg-for-cricut",
    label: "JPG layered route poster preset on screenshot-like JPG",
    input: "screenshotJpg",
    preset: [/^Layered - Poster\b/i, /^Layered color SVG - More detail\b/i],
    expectedEngineFamily: "vtracer-layered",
    timeoutMs: 150_000,
  },
  {
    id: "image-layered-8-screenshot",
    route: "/image-to-layered-svg-for-cricut",
    label: "Generic image layered route if present",
    input: "screenshotPng",
    preset: [/^Layered - 8 Color\b/i, /^Layered color SVG\b/i],
    expectedEngineFamily: "vtracer-layered",
    optional: true,
    timeoutMs: 150_000,
  },
  {
    id: "png-to-svg-logo-potrace",
    route: "/png-to-svg-converter",
    label: "PNG to SVG Potrace-style logo input",
    input: "simpleLogoPng",
    preset: [/^Logo - Clean/i, /^Lineart\b/i, /^Default\b/i],
    expectedEngineFamily: "potrace-or-hybrid",
    timeoutMs: 90_000,
  },
  {
    id: "jpg-to-svg-photo-potrace",
    route: "/jpg-to-svg-converter",
    label: "JPG to SVG photo-like input",
    input: "noisyJpg",
    preset: [/^Photo Edge/i, /^Lineart\b/i, /^Default\b/i],
    expectedEngineFamily: "potrace-or-hybrid",
    timeoutMs: 90_000,
  },
  {
    id: "svg-cleaner-small-svg",
    route: "/svg-cleaner",
    label: "SVG cleaner small SVG input",
    input: "smallSvg",
    preset: null,
    expectedEngineFamily: "svg-utility",
    timeoutMs: 60_000,
  },
];

const historyScenario = {
  id: "home-output-history-screenshot",
  route: "/",
  input: "screenshotPng",
  conversions: [
    { label: "default", preset: null, timeoutMs: 120_000 },
    { label: "line-art", preset: [/^Lineart\b/i, /^Scan - Clean/i], timeoutMs: 120_000 },
    { label: "layered-8", preset: [/^Layered - 8 Color\b/i, /^Layered color SVG\b/i], timeoutMs: 150_000 },
    { label: "layered-flat", preset: [/^Layered - Flat Color\b/i, /^Layered color SVG\b/i], timeoutMs: 150_000 },
  ],
};

async function main() {
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.mkdir(downloadsDir, { recursive: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  const [server, gitInfo, fixtures, staticAudit] = await Promise.all([
    serverState(),
    gitState(),
    prepareFixtures(),
    sourceStaticAudit(),
  ]);
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

  const routeResults = [];
  const historyResults = [];
  try {
    await waitForCdp();
    for (const scenario of routeScenarios) {
      console.error(`[performance-root-cause] ${scenario.id}`);
      const result = await runScenario(scenario, fixtures);
      routeResults.push(result);
      console.error(
        `[performance-root-cause] ${scenario.id}: engine=${result.final?.latestOutput?.engineUsed || "unknown"} outputCards=${result.final?.outputCards ?? "n/a"} timeouts=${result.interactionTimeoutCount}`,
      );
    }

    console.error(`[performance-root-cause] ${historyScenario.id}`);
    historyResults.push(await runHistoryScenario(historyScenario, fixtures));
  } finally {
    browser.kill();
  }

  const report = {
    schemaVersion: 1,
    benchmarkKind: "performance-root-cause-audit",
    baseUrl,
    checkedAt: new Date().toISOString(),
    browserPath,
    debugPort,
    git: gitInfo,
    server,
    fixtures: fixtures.info,
    staticAudit,
    routeScenarios: routeResults,
    historyScenarios: historyResults,
    interpretationNotes: [
      "This benchmark records bad performance as evidence rather than failing the test.",
      "CDP timeouts and page-alive failures are treated as hard browser responsiveness evidence.",
      "Copy/download checks verify callable controls and download starts, not semantic SVG parity.",
    ],
  };
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

async function runScenario(scenario, fixtures) {
  const routeAvailable = await checkRouteAvailability(scenario.route);
  if (!routeAvailable.ok) {
    return {
      id: scenario.id,
      route: scenario.route,
      skipped: true,
      optional: Boolean(scenario.optional),
      reason: routeAvailable.reason,
    };
  }

  const fixture = fixtures[scenario.input];
  const client = await openTab(`${baseUrl}${scenario.route}`);
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const downloads = [];
  const actionLog = [];
  let interactionTimeoutCount = 0;

  client.onEvent((message) => {
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params?.exceptionDetails;
      pageErrors.push(
        String(details?.exception?.description || details?.text || "Runtime exception"),
      );
    }
    if (message.method === "Runtime.consoleAPICalled") {
      const type = message.params?.type;
      const text = (message.params?.args || [])
        .map((arg) => arg.value || arg.description || "")
        .join(" ");
      if (type === "error") consoleErrors.push(text || "console.error");
      if (type === "warning") consoleWarnings.push(text || "console.warn");
    }
    if (message.method === "Log.entryAdded") {
      const entry = message.params?.entry;
      if (entry?.level === "error") consoleErrors.push(entry.text || "Browser log error");
      if (entry?.level === "warning") consoleWarnings.push(entry.text || "Browser log warning");
    }
    if (message.method === "Page.downloadWillBegin") {
      downloads.push(message.params?.suggestedFilename || "download");
    }
  });

  const step = async (name, fn) => {
    const started = performance.now();
    try {
      const value = await fn();
      const elapsedMs = performance.now() - started;
      const entry = { step: name, ok: true, elapsedMs, value };
      actionLog.push(entry);
      return entry;
    } catch (error) {
      const elapsedMs = performance.now() - started;
      const message = error instanceof Error ? error.message : String(error);
      if (/timed out|timeout|CDP command timed out/i.test(message)) {
        interactionTimeoutCount += 1;
      }
      const entry = { step: name, ok: false, elapsedMs, error: message };
      actionLog.push(entry);
      return entry;
    }
  };

  try {
    await enablePage(client);
    await configureDownloads(client).catch(() => {});
    await waitForDocumentReady(client);
    await installDiagnosticObservers(client);

    const initial = await safeCollectMetrics(client);
    const upload = await step("upload fixture", async () => {
      await setFileInput(client, fixture.path);
      return waitForUploadAccepted(client, path.basename(fixture.path), 25_000);
    });
    const afterUpload = await safeCollectMetrics(client);
    const preset = scenario.preset
      ? await step("select preset", () => selectPreset(client, scenario.preset))
      : { step: "select preset", ok: true, elapsedMs: 0, value: { selected: "default route preset" } };
    const beforeConvert = await safeCollectMetrics(client);

    const convertStarted = await step("start conversion", () => clickConvert(client));
    const startedState = await safeOutputState(client);
    const minimumOutputCount = Math.max(
      1,
      Number(startedState?.outputCards || beforeConvert.outputCards || 0),
    );
    const activePhase = await measureActiveConversionPhase(client, scenario.timeoutMs);
    const conversion = await step("wait for conversion idle", () =>
      waitForConversionIdle(client, minimumOutputCount, scenario.timeoutMs),
    );
    const afterConvert = await safeCollectMetrics(client);
    const postPhase = await measurePostConversionPhase(client, step);
    const final = await safeCollectMetrics(client);

    return {
      id: scenario.id,
      route: scenario.route,
      label: scenario.label,
      input: fixture.info,
      expectedEngineFamily: scenario.expectedEngineFamily,
      consoleErrors,
      consoleWarnings,
      pageErrors,
      downloads,
      interactionTimeoutCount,
      pageUnresponsiveOrCdpTimeout:
        interactionTimeoutCount > 0 || final?.pageAlive === false,
      initial,
      upload,
      afterUpload,
      preset,
      beforeConvert,
      convertStarted,
      activePhase,
      conversion,
      afterConvert,
      postPhase,
      final,
      actionLog,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/timed out|timeout|CDP command timed out/i.test(message)) {
      interactionTimeoutCount += 1;
    }
    return {
      id: scenario.id,
      route: scenario.route,
      label: scenario.label,
      input: fixture.info,
      consoleErrors,
      consoleWarnings,
      pageErrors,
      downloads,
      interactionTimeoutCount,
      pageUnresponsiveOrCdpTimeout: true,
      fatal: message,
      final: await safeCollectMetrics(client).catch(() => ({ pageAlive: false })),
      actionLog,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function runHistoryScenario(scenario, fixtures) {
  const routeAvailable = await checkRouteAvailability(scenario.route);
  if (!routeAvailable.ok) {
    return {
      id: scenario.id,
      route: scenario.route,
      skipped: true,
      reason: routeAvailable.reason,
    };
  }

  const fixture = fixtures[scenario.input];
  const client = await openTab(`${baseUrl}${scenario.route}`);
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const actionLog = [];
  let interactionTimeoutCount = 0;
  const snapshots = [];

  client.onEvent((message) => {
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params?.exceptionDetails;
      pageErrors.push(
        String(details?.exception?.description || details?.text || "Runtime exception"),
      );
    }
    if (message.method === "Runtime.consoleAPICalled") {
      const type = message.params?.type;
      const text = (message.params?.args || [])
        .map((arg) => arg.value || arg.description || "")
        .join(" ");
      if (type === "error") consoleErrors.push(text || "console.error");
      if (type === "warning") consoleWarnings.push(text || "console.warn");
    }
  });

  const step = async (name, fn) => {
    const started = performance.now();
    try {
      const value = await fn();
      const elapsedMs = performance.now() - started;
      const entry = { step: name, ok: true, elapsedMs, value };
      actionLog.push(entry);
      return entry;
    } catch (error) {
      const elapsedMs = performance.now() - started;
      const message = error instanceof Error ? error.message : String(error);
      if (/timed out|timeout|CDP command timed out/i.test(message)) {
        interactionTimeoutCount += 1;
      }
      const entry = { step: name, ok: false, elapsedMs, error: message };
      actionLog.push(entry);
      return entry;
    }
  };

  try {
    await enablePage(client);
    await configureDownloads(client).catch(() => {});
    await waitForDocumentReady(client);
    await installDiagnosticObservers(client);
    await step("upload fixture", async () => {
      await setFileInput(client, fixture.path);
      return waitForUploadAccepted(client, path.basename(fixture.path), 25_000);
    });

    for (const [index, conversion] of scenario.conversions.entries()) {
      if (conversion.preset) {
        await step(`select preset ${conversion.label}`, () =>
          selectPreset(client, conversion.preset),
        );
      }
      const before = await safeCollectMetrics(client);
      await step(`start conversion ${conversion.label}`, () => clickConvert(client));
      const startedState = await safeOutputState(client);
      const minimumOutputCount = Math.max(
        1,
        Number(startedState?.outputCards || before.outputCards || 0),
      );
      const activePhase = await measureActiveConversionPhase(client, conversion.timeoutMs);
      await step(`wait conversion ${conversion.label}`, () =>
        waitForConversionIdle(client, minimumOutputCount, conversion.timeoutMs),
      );
      snapshots.push({
        afterConversionIndex: index + 1,
        conversionLabel: conversion.label,
        activePhase,
        metrics: await safeCollectMetrics(client),
      });
    }

    const settingsClosed = await safeCollectMetrics(client);
    await step("open latest settings after history", () => openLatestSettings(client));
    const settingsOpen = await safeCollectMetrics(client);
    const postInteraction = await measurePostConversionPhase(client, step);
    await step("collapse older outputs if available", () => collapseOlderOutputs(client));
    const collapsedOldOutputs = await safeCollectMetrics(client);

    return {
      id: scenario.id,
      route: scenario.route,
      input: fixture.info,
      consoleErrors,
      consoleWarnings,
      pageErrors,
      interactionTimeoutCount,
      pageUnresponsiveOrCdpTimeout:
        interactionTimeoutCount > 0 || collapsedOldOutputs?.pageAlive === false,
      snapshots,
      settingsClosed,
      settingsOpen,
      postInteraction,
      collapsedOldOutputs,
      actionLog,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/timed out|timeout|CDP command timed out/i.test(message)) {
      interactionTimeoutCount += 1;
    }
    return {
      id: scenario.id,
      route: scenario.route,
      input: fixture.info,
      consoleErrors,
      consoleWarnings,
      pageErrors,
      interactionTimeoutCount,
      pageUnresponsiveOrCdpTimeout: true,
      fatal: message,
      snapshots,
      final: await safeCollectMetrics(client).catch(() => ({ pageAlive: false })),
      actionLog,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function measureActiveConversionPhase(client, timeoutMs) {
  const start = performance.now();
  const alive = await timedInteraction("active page heartbeat", () =>
    evaluate(client, `(() => ({ alive: true, activeJobs: document.querySelectorAll('[data-job-status="running"], [data-job-status="queued"]').length }))()`, 4_000),
  );
  const menu = await timedInteraction("menu while conversion active", () =>
    clickButtonInLatestOutput(client, [/^More\b/i, /Settings\s*\/\s*Edit/i], [/Download/i]),
  );
  const scroll = await timedInteraction("scroll while conversion active", () =>
    scrollPage(client),
  );
  const metrics = await safeCollectMetrics(client, 4_000);
  return {
    elapsedMs: performance.now() - start,
    timeoutBudgetMs: timeoutMs,
    alive,
    menu,
    scroll,
    metrics,
  };
}

async function measurePostConversionPhase(client, step) {
  const settings = await step("open Settings/Edit on latest output", () =>
    openLatestSettings(client),
  );
  const expand = await step("expand layer or color settings", () =>
    expandLayerColorSettings(client),
  );
  const color = await step("change first visible layer/color input", () =>
    changeFirstColor(client),
  );
  const slider = await step("move first visible slider", () => moveFirstSlider(client));
  const menu = await step("open More menu or action menu", () => openMoreMenu(client));
  const scroll = await step("scroll page after conversion", () => scrollPage(client));
  const copy = await step("attempt copy", () => clickCopy(client));
  const download = await step("attempt download", () => clickDownload(client));
  return {
    settings,
    expand,
    color,
    slider,
    menu,
    scroll,
    copy,
    download,
    metrics: await safeCollectMetrics(client),
  };
}

async function timedInteraction(label, fn) {
  const started = performance.now();
  try {
    const value = await fn();
    return { label, ok: true, elapsedMs: performance.now() - started, value };
  } catch (error) {
    return {
      label,
      ok: false,
      elapsedMs: performance.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function clickConvert(client) {
  const clicked = await clickButtonIfPresent(
    client,
    [/Convert/i, /Create/i, /Clean SVG/i],
    [/Download/i, /Copy/i, /Settings/i, /Batch/i, /Convert \d+ to ZIP/i],
  );
  if (clicked) return { clicked: true, ...clicked };
  const state = await safeOutputState(client);
  if (Number(state?.outputCards || 0) > 0 || Number(state?.activeJobs || 0) > 0) {
    return {
      clicked: false,
      reason: "No convert button was enabled because conversion/output state already existed.",
      state,
    };
  }
  throw new Error("No enabled Convert/Create/Clean button found.");
}

async function waitForConversionIdle(client, minimumOutputCount, timeoutMs) {
  return waitForValue(
    client,
    outputStateExpression,
    timeoutMs,
    (value) =>
      value?.pageAlive &&
      Number(value.outputCards || 0) >= minimumOutputCount &&
      Number(value.activeJobs || 0) === 0 &&
      Number(value.readyOutputCount || 0) >= Math.min(minimumOutputCount, Number(value.outputCards || 0)),
  ).catch(async (error) => {
    const state = await safeCollectMetrics(client, 6_000);
    return {
      timedOutWaitingForIdle: true,
      error: error instanceof Error ? error.message : String(error),
      state,
    };
  });
}

async function selectPreset(client, patterns) {
  await clickButtonIfPresent(client, [/All presets/i, /Show all presets/i], []).catch(() => null);
  await delay(250);
  for (const pattern of patterns) {
    const clicked = await clickButtonIfPresent(client, [pattern], [/Show fewer/i, /Filter presets/i]).catch(() => null);
    if (clicked) {
      await delay(500);
      return { selected: clicked.label, pattern: String(pattern) };
    }
  }
  return { selected: null, reason: "No matching preset button was visible." };
}

async function openLatestSettings(client) {
  const clicked = await clickButtonInLatestOutput(client, [/Settings\s*\/\s*Edit/i, /^Settings$/i], []);
  if (!clicked) {
    throw new Error("No Settings/Edit control found on an output card.");
  }
  const panel = await waitForValue(client, visibleSettingsPanelExpression, 12_000, Boolean);
  return { clicked, panelVisible: Boolean(panel) };
}

async function expandLayerColorSettings(client) {
  return evaluate(client, `(() => {
    const panel = findSettingsPanel();
    if (!panel) return { expanded: false, reason: "missing-settings-panel" };
    const controls = Array.from(panel.querySelectorAll("button, summary"));
    const target = controls.find((control) => {
      const text = control.innerText || control.textContent || control.getAttribute("aria-label") || "";
      const rect = control.getBoundingClientRect();
      const style = getComputedStyle(control);
      return rect.width > 0 && rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        /Layer|Color|Live Preview|Appearance|Post-processing|Fill|Stroke/i.test(text);
    });
    if (!target) return { expanded: false, reason: "no-layer-color-control" };
    target.click();
    return { expanded: true, text: (target.innerText || target.textContent || "").trim().slice(0, 120) };

    function findSettingsPanel() {
      const candidates = Array.from(document.querySelectorAll('[data-editor-settings-panel="true"], [id^="output-settings-"]:not([id^="output-settings-panel-"])'));
      return candidates.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const style = getComputedStyle(candidate);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }) || null;
    }
  })()`, 8_000);
}

async function changeFirstColor(client) {
  return evaluate(client, `(() => {
    const input = visibleInput('input[type="color"]');
    if (!input) return { changed: false, reason: "no-visible-color-input" };
    const before = input.value;
    const next = before.toLowerCase() === "#ff0066" ? "#0ea5e9" : "#ff0066";
    input.value = next;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return new Promise((resolve) => requestAnimationFrame(() => resolve({ changed: true, before, after: next })));

    function visibleInput(selector) {
      return Array.from(document.querySelectorAll(selector)).find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const style = getComputedStyle(candidate);
        return rect.width > 0 && rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          !candidate.disabled;
      }) || null;
    }
  })()`, 8_000);
}

async function moveFirstSlider(client) {
  return evaluate(client, `(() => {
    const input = visibleInput('input[type="range"]');
    if (!input) return { moved: false, reason: "no-visible-range-input" };
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const current = Number(input.value || min);
    const span = Number.isFinite(max - min) && max > min ? max - min : 100;
    const next = String(Math.max(min, Math.min(max, current + span * 0.1)));
    input.value = next;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return new Promise((resolve) => requestAnimationFrame(() => resolve({ moved: true, before: current, after: Number(next) })));

    function visibleInput(selector) {
      return Array.from(document.querySelectorAll(selector)).find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const style = getComputedStyle(candidate);
        return rect.width > 0 && rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          !candidate.disabled;
      }) || null;
    }
  })()`, 8_000);
}

async function openMoreMenu(client) {
  const clicked = await clickButtonInLatestOutput(client, [/^More\b/i], []);
  if (!clicked) return { opened: false, reason: "output More control not found" };
  await delay(250);
  return { opened: true, clicked };
}

async function scrollPage(client) {
  return evaluate(client, `(async () => {
    const startY = window.scrollY;
    const targets = [window.innerHeight * 0.7, window.innerHeight * 1.4, Math.max(0, document.documentElement.scrollHeight - window.innerHeight), 0];
    const frames = [];
    for (const y of targets) {
      const before = performance.now();
      window.scrollTo({ top: y, behavior: "auto" });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      frames.push(Math.round(performance.now() - before));
    }
    return { startY, endY: window.scrollY, scrollHeight: document.documentElement.scrollHeight, frames };
  })()`, 8_000);
}

async function clickCopy(client) {
  const clicked = await clickButtonInLatestOutput(client, [/Copy SVG/i, /^Copy$/i], [/Copied/i]);
  if (!clicked) return { clicked: false, reason: "copy control not found" };
  await delay(250);
  return { clicked: true, label: clicked.label };
}

async function clickDownload(client) {
  const clicked = await clickButtonInLatestOutput(client, [/Download/i], [/ZIP/i]);
  if (!clicked) return { clicked: false, reason: "download control not found" };
  await delay(750);
  return { clicked: true, label: clicked.label };
}

async function collapseOlderOutputs(client) {
  return evaluate(client, `(async () => {
    const cards = Array.from(document.querySelectorAll("[data-output-stamp]"));
    let collapsed = 0;
    for (let index = 0; index < Math.max(0, cards.length - 1); index += 1) {
      const card = cards[index];
      const button = Array.from(card.querySelectorAll("button")).find((candidate) => {
        const text = candidate.innerText || candidate.textContent || candidate.getAttribute("aria-label") || "";
        const rect = candidate.getBoundingClientRect();
        const style = getComputedStyle(candidate);
        return /Minimize/i.test(text) && rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
      if (button) {
        button.scrollIntoView({ block: "center", inline: "nearest" });
        button.click();
        collapsed += 1;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    return { outputCards: cards.length, collapsed };
  })()`, 12_000);
}

async function clickButtonInLatestOutput(client, patterns, rejectPatterns = []) {
  const target = await findButtonTarget(client, patterns, rejectPatterns, true);
  if (!target) return null;
  await trustedClickAtPoint(client, target);
  return target;
}

async function clickButtonIfPresent(client, patterns, rejectPatterns = []) {
  const target = await findButtonTarget(client, patterns, rejectPatterns, false);
  if (!target) return null;
  await trustedClickAtPoint(client, target);
  return target;
}

async function findButtonTarget(client, patterns, rejectPatterns, latestOutputOnly) {
  return evaluate(client, `(() => {
    const patterns = ${JSON.stringify(patterns.map((pattern) => pattern.source))}.map((source) => new RegExp(source, "i"));
    const rejects = ${JSON.stringify(rejectPatterns.map((pattern) => pattern.source))}.map((source) => new RegExp(source, "i"));
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const cards = Array.from(document.querySelectorAll("[data-output-stamp]"));
    const roots = ${latestOutputOnly ? "cards.length ? [cards[cards.length - 1]] : []" : "cards.length ? [...cards].reverse().concat(document.body) : [document.body]"};
    for (const root of roots) {
      const buttons = Array.from(root.querySelectorAll("button, [role='button'], summary"));
      const button = buttons.find((candidate) => {
        const text = candidate.innerText || candidate.textContent || candidate.getAttribute("aria-label") || "";
        return visible(candidate) &&
          !candidate.disabled &&
          patterns.some((pattern) => pattern.test(text)) &&
          !rejects.some((pattern) => pattern.test(text));
      });
      if (button) {
        button.scrollIntoView({ block: "center", inline: "nearest" });
        const rect = button.getBoundingClientRect();
        return {
          label: (button.innerText || button.textContent || button.getAttribute("aria-label") || "").trim(),
          x: Math.max(1, Math.min(window.innerWidth - 2, rect.left + rect.width / 2)),
          y: Math.max(1, Math.min(window.innerHeight - 2, rect.top + rect.height / 2)),
        };
      }
    }
    return null;
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

async function safeCollectMetrics(client, timeoutMs = 12_000) {
  try {
    return await collectMetrics(client, timeoutMs);
  } catch (error) {
    return {
      pageAlive: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function safeOutputState(client) {
  try {
    return await evaluate(client, outputStateExpression(), 6_000);
  } catch (error) {
    return {
      pageAlive: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function collectMetrics(client, timeoutMs = 12_000) {
  const page = await evaluate(client, `(async () => {
    const cards = Array.from(document.querySelectorAll("[data-output-stamp]"));
    const expandedCards = cards.filter((card) => card.getAttribute("data-collapse-state") !== "collapsed");
    const settingsPanels = visibleElements('[data-editor-settings-panel="true"], [id^="output-settings-"]:not([id^="output-settings-panel-"])');
    const layerPalettePanels = visibleElements('[data-layer-palette-editor="true"]');
    const previewImages = visibleElements('[data-output-stamp] img, [data-focused-editor-workspace="true"] img');
    const fullPreviewImages = previewImages.filter((image) => {
      const src = image.getAttribute("src") || "";
      return src.startsWith("data:image/svg+xml") || src.startsWith("blob:");
    });
    const decodedSvgs = [];
    for (const image of fullPreviewImages) {
      const src = image.getAttribute("src") || "";
      let svg = "";
      if (src.startsWith("data:image/svg+xml")) {
        const comma = src.indexOf(",");
        svg = comma >= 0 ? decodeURIComponent(src.slice(comma + 1)) : "";
      } else if (src.startsWith("blob:")) {
        svg = await fetch(src).then((response) => response.text()).catch(() => "");
      }
      if (svg) decodedSvgs.push(svg);
    }
    const parsed = decodedSvgs.map((svg) => {
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      const paths = doc.querySelectorAll("path");
      const colors = new Set();
      for (const element of doc.querySelectorAll("[fill], [stroke], [data-layer-color]")) {
        for (const attr of ["fill", "stroke", "data-layer-color"]) {
          const value = element.getAttribute(attr);
          if (value && value !== "none") colors.add(value.toLowerCase());
        }
      }
      return {
        bytes: new Blob([svg]).size,
        paths: paths.length,
        layers: doc.querySelectorAll("[data-layer-id], [data-fill-layer-id], [data-stroke-layer-id], g[data-layer-name]").length,
        colors: colors.size,
        nodes: doc.querySelectorAll("*").length,
        parserError: Boolean(doc.querySelector("parsererror")),
        viewBox: doc.documentElement?.getAttribute("viewBox") || null,
        width: doc.documentElement?.getAttribute("width") || null,
        height: doc.documentElement?.getAttribute("height") || null,
      };
    });
    const longTasks = Array.isArray(window.__ILOVESVG_PERF_ROOT_CAUSE__?.longTasks)
      ? window.__ILOVESVG_PERF_ROOT_CAUSE__.longTasks
      : [];
    const hybridEvents = Array.isArray(window.__ILOVESVG_HYBRID_TRACE_DEBUG__)
      ? window.__ILOVESVG_HYBRID_TRACE_DEBUG__
      : [];
    const latest = cards[cards.length - 1] || null;
    const latestOutput = latest ? {
      stamp: latest.getAttribute("data-output-stamp"),
      jobStatus: latest.getAttribute("data-job-status") || null,
      engineUsed: latest.getAttribute("data-engine-used") || null,
      sourceKind: latest.getAttribute("data-source-kind") || null,
      engineWarnings: latest.getAttribute("data-engine-warnings") || "",
      outputWarnings: latest.getAttribute("data-output-warnings") || "",
      layerBuildMode: latest.getAttribute("data-layer-build-mode") || null,
      requestedPaletteCount: numberOrNull(latest.getAttribute("data-requested-palette-count")),
      actualPaletteCount: numberOrNull(latest.getAttribute("data-actual-palette-count")),
      outputDetectedColors: numberOrNull(latest.getAttribute("data-output-detected-colors")),
      pathCount: numberOrNull(latest.getAttribute("data-path-count")),
      svgBytes: numberOrNull(latest.getAttribute("data-svg-bytes")),
      text: (latest.innerText || "").replace(/\\s+/g, " ").slice(0, 500),
    } : null;
    const activeJobs = cards.filter((card) =>
      /queued|running/i.test(card.getAttribute("data-job-status") || "") ||
      /\\b(Queued|Running|Converting)\\b/i.test(card.innerText || "")
    ).length;
    return {
      pageAlive: true,
      href: location.href,
      title: document.title,
      domNodes: document.querySelectorAll("*").length,
      outputCards: cards.length,
      expandedOutputCards: expandedCards.length,
      collapsedOutputCards: cards.length - expandedCards.length,
      fullSvgPreviewCount: fullPreviewImages.length,
      previewImageCount: previewImages.length,
      settingsPanelCount: settingsPanels.length,
      layerPalettePanelCount: layerPalettePanels.length,
      layerRowCount: visibleElements('[data-layer-palette-editor="true"] input[type="color"], [data-layer-id], [data-fill-layer-id], [data-stroke-layer-id]').length,
      activeJobs,
      readyOutputCount: cards.filter((card) => !/queued|running/i.test(card.getAttribute("data-job-status") || "") && /Download|Copy|Settings/i.test(card.innerText || "")).length,
      decodedPreviewBytes: parsed.reduce((sum, item) => sum + item.bytes, 0),
      decodedPreviewPaths: parsed.reduce((sum, item) => sum + item.paths, 0),
      decodedPreviewLayers: parsed.reduce((sum, item) => sum + item.layers, 0),
      decodedPreviewColors: parsed.reduce((sum, item) => sum + item.colors, 0),
      decodedPreviewNodes: parsed.reduce((sum, item) => sum + item.nodes, 0),
      decodedPreviewParserErrors: parsed.filter((item) => item.parserError).length,
      largestPreview: parsed.reduce((max, item) => item.bytes > (max?.bytes || 0) ? item : max, null),
      parsedPreviewSummaries: parsed.slice(-4),
      longTaskCount: longTasks.length,
      longTaskTotalMs: longTasks.reduce((sum, task) => sum + Number(task.duration || 0), 0),
      longTasks: longTasks.slice(-30),
      hybridEventCount: hybridEvents.length,
      hybridEvents: hybridEvents.slice(-20),
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      latestOutput,
      hasCopyControl: /Copy SVG|\\bCopy\\b/.test(document.body?.innerText || ""),
      hasDownloadControl: /Download/.test(document.body?.innerText || ""),
    };

    function visibleElements(selector) {
      return Array.from(document.querySelectorAll(selector)).filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
    }
    function numberOrNull(value) {
      const number = Number(String(value || "").replace(/[^0-9.]/g, ""));
      return Number.isFinite(number) && String(value || "").trim() ? number : null;
    }
  })()`, timeoutMs);
  const [browserMetrics, targets] = await Promise.all([
    client.send("Performance.getMetrics", {}, timeoutMs).catch(() => null),
    cdpJson("/json/list").catch(() => []),
  ]);
  return {
    ...page,
    browserMetrics: browserMetrics?.metrics
      ?.filter((metric) =>
        ["JSHeapUsedSize", "JSHeapTotalSize", "Nodes", "Documents", "LayoutCount", "RecalcStyleCount"].includes(metric.name),
      )
      .reduce((acc, metric) => {
        acc[metric.name] = metric.value;
        return acc;
      }, {}),
    cdpTargetCounts: summarizeTargets(targets),
  };
}

function summarizeTargets(targets) {
  const summary = {};
  for (const target of Array.isArray(targets) ? targets : []) {
    const type = target.type || "unknown";
    summary[type] = (summary[type] || 0) + 1;
  }
  return summary;
}

function outputStateExpression() {
  return `(() => {
    const cards = Array.from(document.querySelectorAll("[data-output-stamp]"));
    return {
      pageAlive: true,
      outputCards: cards.length,
      activeJobs: cards.filter((card) => /queued|running/i.test(card.getAttribute("data-job-status") || "") || /\\b(Queued|Running|Converting)\\b/i.test(card.innerText || "")).length,
      readyOutputCount: cards.filter((card) => !/queued|running/i.test(card.getAttribute("data-job-status") || "") && /Download|Copy|Settings/i.test(card.innerText || "")).length,
    };
  })()`;
}

function visibleSettingsPanelExpression() {
  return `(() => {
    const candidates = Array.from(document.querySelectorAll('[data-editor-settings-panel="true"], [id^="output-settings-"]:not([id^="output-settings-panel-"])'));
    return candidates.some((candidate) => {
      const rect = candidate.getBoundingClientRect();
      const style = getComputedStyle(candidate);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
  })()`;
}

async function waitForUploadAccepted(client, filename, timeoutMs) {
  return waitForValue(
    client,
    () => `(() => {
      const body = document.body?.innerText || "";
      const cards = document.querySelectorAll("[data-output-stamp]").length;
      const enabledConvert = Array.from(document.querySelectorAll("button")).some((button) => {
        const text = button.innerText || button.textContent || "";
        return !button.disabled && /Convert|Create|Clean SVG/i.test(text) && !/Download|Copy|Settings|Batch/i.test(text);
      });
      return {
        bodyHasName: body.includes(${JSON.stringify(filename)}),
        cards,
        enabledConvert,
      };
    })()`,
    timeoutMs,
    (value) => value?.cards > 0 || (value?.bodyHasName && value?.enabledConvert),
  );
}

async function setFileInput(client, filePath) {
  await waitForValue(
    client,
    () => `(() => Boolean(document.querySelector('input[type="file"]')))()`,
    12_000,
    Boolean,
  );
  const expectedName = path.basename(filePath);

  try {
    await setFileInputViaChooser(client, filePath);
    const accepted = await waitForUploadAccepted(client, expectedName, 20_000).catch(() => null);
    if (accepted) return;
  } catch {}

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const nodeId = await queryFileInputNodeId(client, 'input[type="file"]');
      await client.send("DOM.setFileInputFiles", { nodeId, files: [filePath] }, 8_000);
      await dispatchFileInputChange(client);
      const accepted = await waitForUploadAccepted(client, expectedName, 10_000).catch(() => null);
      if (accepted) return;
    } catch (error) {
      lastError = error;
      if (!isStaleDomNodeError(error)) break;
      await delay(150);
    }
  }

  try {
    const nodeId = await queryFileInputNodeId(client, 'input[type="file"]');
    const { node } = await client.send("DOM.describeNode", { nodeId }, 8_000);
    if (node?.backendNodeId) {
      await client.send("DOM.setFileInputFiles", {
        backendNodeId: node.backendNodeId,
        files: [filePath],
      }, 8_000);
      await dispatchFileInputChange(client);
      const accepted = await waitForUploadAccepted(client, expectedName, 10_000).catch(() => null);
      if (accepted) return;
    }
  } catch (error) {
    lastError = error;
  }

  try {
    await setFileInputFromBuffer(client, filePath);
    const accepted = await waitForUploadAccepted(client, expectedName, 20_000).catch(() => null);
    if (accepted) return;
  } catch (error) {
    lastError = error;
  }

  if (lastError) throw lastError;
  throw new Error(`File upload did not appear in page state for ${expectedName}.`);
}

async function setFileInputViaChooser(client, filePath) {
  await client.send("Page.enable").catch(() => {});
  await client.send("Page.setInterceptFileChooserDialog", { enabled: true }).catch(() => {});
  try {
    const chooserPromise = waitForEvent(client, "Page.fileChooserOpened", 5_000);
    const target = await evaluate(client, `(() => {
      const input = document.querySelector('input[type="file"]');
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
}

function isStaleDomNodeError(error) {
  return /could not find node|no node with given id|cannot find context/i.test(
    error instanceof Error ? error.message : String(error),
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

async function installDiagnosticObservers(client) {
  await evaluate(client, `(() => {
    window.__ILOVESVG_PERF_ROOT_CAUSE__ = { longTasks: [] };
    window.__ILOVESVG_HYBRID_TRACE_DEBUG__ = [];
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__ILOVESVG_PERF_ROOT_CAUSE__.longTasks.push({
              name: entry.name,
              startTime: Math.round(entry.startTime),
              duration: Math.round(entry.duration),
            });
          }
        });
        observer.observe({ type: "longtask", buffered: true });
        window.__ILOVESVG_PERF_ROOT_CAUSE__.observer = observer;
      } catch {}
    }
    return true;
  })()`);
}

async function configureDownloads(client) {
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadsDir,
  }, 8_000).catch(async () => {
    await client.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadsDir,
    }, 8_000);
  });
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
    last = await evaluate(client, expressionFactory(), Math.min(12_000, Math.max(3_000, deadline - Date.now())));
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
  client.targetUrl = target.url || url;
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
      // Fall through to legacy endpoint.
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

async function checkRouteAvailability(route) {
  const response = await fetch(`${baseUrl}${route}`).catch((error) => ({
    ok: false,
    status: 0,
    text: async () => error.message,
  }));
  if (!response.ok) {
    return { ok: false, reason: `HTTP ${response.status}: ${await response.text()}`.slice(0, 200) };
  }
  return { ok: true };
}

async function serverState() {
  const response = await fetch(baseUrl).catch((error) => {
    throw new Error(`Could not reach ${baseUrl}: ${error.message}`);
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Could not reach ${baseUrl}: HTTP ${response.status}`);
  }
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
      const { stdout } = await execFile("git", args, { cwd: rootDir, windowsHide: true });
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

async function sourceStaticAudit() {
  const files = {
    enginePolicy: "app/shared/tracing/enginePolicy.ts",
    vtracerClient: "app/client/lib/tracing/vtracerWorkerClient.ts",
    hybridFetcher: "app/client/lib/tracing/useHybridTraceFetcher.ts",
    outputPanel: "app/client/components/converter/TraceOutputPanel.tsx",
    editedPreview: "app/client/components/svg/EditedSvgPreviewImage.tsx",
    layerEditor: "app/client/components/svg/LayerPaletteEditor.tsx",
  };
  const entries = {};
  for (const [key, relative] of Object.entries(files)) {
    const source = await fs.readFile(path.join(rootDir, relative), "utf8").catch(() => "");
    entries[key] = {
      path: relative,
      lines: source ? source.split(/\r?\n/).length : 0,
      containsVTracer: /vtracer/i.test(source),
      containsPotrace: /potrace/i.test(source),
      containsUseMemo: /useMemo/.test(source),
      containsDataSvgUri: /data:image\/svg\+xml/.test(source),
      containsEncodeURIComponent: /encodeURIComponent/.test(source),
      containsWeakMapCache: /WeakMap/.test(source),
      containsOutputAppearanceCache: /outputAppearanceSvgCache|appearanceSvgCache/.test(source),
      containsThrottledCommit: /useThrottledCommit/.test(source),
    };
  }
  return entries;
}

async function prepareFixtures() {
  const userFixtureAvailable = await fs
    .access(userFixturePath)
    .then(() => true)
    .catch(() => false);
  const screenshotPngPath = userFixtureAvailable
    ? userFixturePath
    : path.join(fixturesDir, "generated-screenshot-like.png");
  if (!userFixtureAvailable) {
    await sharp(Buffer.from(buildScreenshotLikeSvg())).png().toFile(screenshotPngPath);
  }

  const screenshotJpgPath = path.join(fixturesDir, "screenshot-like.jpg");
  await sharp(screenshotPngPath, { limitInputPixels: false })
    .rotate()
    .jpeg({ quality: 90 })
    .toFile(screenshotJpgPath);

  const simpleLogoSvg = buildSimpleLogoSvg();
  const simpleLogoPngPath = path.join(fixturesDir, "simple-logo.png");
  const simpleLogoJpgPath = path.join(fixturesDir, "simple-logo.jpg");
  await sharp(Buffer.from(simpleLogoSvg)).png().toFile(simpleLogoPngPath);
  await sharp(Buffer.from(simpleLogoSvg)).jpeg({ quality: 92 }).toFile(simpleLogoJpgPath);

  const stickerPngPath = path.join(fixturesDir, "transparent-sticker.png");
  await sharp(Buffer.from(buildTransparentStickerSvg())).png().toFile(stickerPngPath);

  const noisyJpgPath = path.join(fixturesDir, "photo-like-noisy.jpg");
  await sharp(Buffer.from(buildNoisyPhotoLikeSvg())).jpeg({ quality: 88 }).toFile(noisyJpgPath);

  const smallSvgPath = path.join(fixturesDir, "small-cleaner-fixture.svg");
  await fs.writeFile(smallSvgPath, buildSmallSvg());

  const fixtures = {
    screenshotPng: await fixtureInfo("screenshotPng", screenshotPngPath, userFixtureAvailable ? "real-user-fixture" : "generated-screenshot-like"),
    screenshotJpg: await fixtureInfo("screenshotJpg", screenshotJpgPath, "jpeg-derived-from-screenshot-like"),
    simpleLogoPng: await fixtureInfo("simpleLogoPng", simpleLogoPngPath, "generated-simple-logo"),
    simpleLogoJpg: await fixtureInfo("simpleLogoJpg", simpleLogoJpgPath, "generated-simple-logo-jpeg"),
    transparentStickerPng: await fixtureInfo("transparentStickerPng", stickerPngPath, "generated-transparent-sticker"),
    noisyJpg: await fixtureInfo("noisyJpg", noisyJpgPath, "generated-photo-like-jpeg"),
    smallSvg: await fixtureInfo("smallSvg", smallSvgPath, "generated-small-svg"),
  };
  fixtures.info = {
    requestedUserFixture: userFixturePath,
    usedUserFixture: userFixtureAvailable,
    fixtureDirectory: fixturesDir,
    entries: Object.fromEntries(
      Object.entries(fixtures)
        .filter(([key]) => key !== "info")
        .map(([key, value]) => [key, value.info]),
    ),
  };
  return fixtures;
}

async function fixtureInfo(key, filePath, source) {
  const stat = await fs.stat(filePath);
  const metadata = await sharp(filePath, { limitInputPixels: false })
    .metadata()
    .catch(() => ({}));
  return {
    path: filePath,
    info: {
      key,
      source,
      path: filePath,
      basename: path.basename(filePath),
      bytes: stat.size,
      width: metadata.width || null,
      height: metadata.height || null,
      format: metadata.format || path.extname(filePath).slice(1),
    },
  };
}

function buildScreenshotLikeSvg() {
  const panels = [];
  for (let index = 0; index < 56; index += 1) {
    const inset = 8 + index * 3;
    const width = Math.max(110, 920 - index * 10);
    const height = Math.max(70, 640 - index * 7);
    const fill = ["#e0f2fe", "#fef3c7", "#dcfce7", "#fce7f3", "#ede9fe"][index % 5];
    panels.push(`<rect x="${inset}" y="${inset}" width="${width}" height="${height}" rx="10" fill="${fill}" stroke="#0f172a" stroke-width="1"/>`);
    panels.push(`<rect x="${inset + 14}" y="${inset + 16}" width="${Math.max(30, width - 28)}" height="8" rx="4" fill="#334155" opacity=".38"/>`);
    panels.push(`<circle cx="${inset + 28}" cy="${inset + 44}" r="${7 + (index % 4)}" fill="#2563eb" opacity=".48"/>`);
    panels.push(`<path d="M${inset + 52} ${inset + 44} h${Math.max(20, width - 92)}" stroke="#111827" stroke-width="${1 + (index % 3)}" opacity=".2"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="680" viewBox="0 0 960 680"><rect width="960" height="680" fill="#f8fafc"/>${panels.join("")}<text x="44" y="638" font-family="Arial" font-size="24" font-weight="700" fill="#0f172a">Screenshot-like diagnostic fixture</text></svg>`;
}

function buildSimpleLogoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="360" viewBox="0 0 520 360"><rect width="520" height="360" fill="#fff"/><circle cx="170" cy="180" r="96" fill="#0ea5e9"/><rect x="238" y="92" width="140" height="176" rx="32" fill="#111827"/><path d="M115 190 C165 112 230 266 310 158 S404 126 438 232" fill="none" stroke="#f97316" stroke-width="22" stroke-linecap="round"/></svg>`;
}

function buildTransparentStickerSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="360" viewBox="0 0 520 360"><path d="M258 34 C330 34 395 74 422 136 C470 146 498 184 486 229 C474 272 430 290 380 284 C342 324 286 342 224 328 C164 314 124 272 114 220 C76 200 62 158 88 122 C112 88 154 80 192 94 C208 56 228 34 258 34Z" fill="#ffffff" stroke="#0f172a" stroke-width="10"/><circle cx="210" cy="164" r="50" fill="#f97316"/><circle cx="306" cy="166" r="50" fill="#22c55e"/><path d="M178 240 C222 272 294 272 338 240" fill="none" stroke="#0f172a" stroke-width="14" stroke-linecap="round"/></svg>`;
}

function buildNoisyPhotoLikeSvg() {
  const shapes = [];
  for (let index = 0; index < 180; index += 1) {
    const x = (index * 47) % 760;
    const y = (index * 83) % 520;
    const color = ["#0f172a", "#2563eb", "#7c3aed", "#f97316", "#22c55e", "#e11d48"][index % 6];
    shapes.push(`<circle cx="${x}" cy="${y}" r="${8 + (index % 28)}" fill="${color}" opacity="${0.08 + (index % 7) * 0.04}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560" viewBox="0 0 800 560"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e0f2fe"/><stop offset=".5" stop-color="#fef3c7"/><stop offset="1" stop-color="#fce7f3"/></linearGradient></defs><rect width="800" height="560" fill="url(#g)"/>${shapes.join("")}<path d="M80 460 C160 350 220 500 320 380 S520 300 720 430" fill="none" stroke="#111827" stroke-width="16" opacity=".55"/></svg>`;
}

function buildSmallSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160"><style>.primary{fill:#111827}.accent{fill:none;stroke:#2563eb;stroke-width:6;stroke-linecap:round}</style><rect width="240" height="160" fill="#fff"/><circle class="primary" cx="72" cy="78" r="38"/><path class="accent" d="M28 132 C58 102, 94 150, 126 118 S190 126, 210 78"/><script>window.__bad=true</script></svg>`;
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
  throw new Error("No Chromium-family browser executable found for browser diagnostics.");
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
    benchmarkKind: "performance-root-cause-audit",
    baseUrl,
    checkedAt: new Date().toISOString(),
    fatal: error instanceof Error ? error.message : String(error),
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true }).catch(() => {});
  await fs.writeFile(reportPath, JSON.stringify(fatal, null, 2)).catch(() => {});
  console.error(JSON.stringify(fatal, null, 2));
  process.exit(1);
});
