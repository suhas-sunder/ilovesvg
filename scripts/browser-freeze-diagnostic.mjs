import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = getSmokeBaseUrl();
const debugPort = Number(
  process.env.CDP_PORT || 9400 + Math.floor(Math.random() * 500),
);
const tmpDir = path.join(os.tmpdir(), "ilovesvg-browser-freeze-diagnostic", String(debugPort));
const profileDir = path.join(tmpDir, "profile");
const fixturesDir = path.join(tmpDir, "fixtures");
const downloadsDir = path.join(tmpDir, "downloads");
const reportPath = process.env.BROWSER_FREEZE_REPORT_PATH
  ? path.resolve(process.env.BROWSER_FREEZE_REPORT_PATH)
  : path.join(rootDir, "tmp", "browser-freeze-diagnostic-report.json");
const userFixturePath =
  process.env.BROWSER_FREEZE_SCREENSHOT_FIXTURE ||
  "C:\\Users\\Suhas\\Downloads\\Screenshot 2026-05-06 194041.png";

const routes = [
  {
    path: "/",
    label: "home",
    fixtureKind: "png",
    fastPresets: [/^Lineart\b/i, /^Sketch\b/i, /^Scan - Clean/i, /^Logo - Clean/i],
    layeredPresets: [
      /^Layered color SVG\b/i,
      /^Layered - Flat Color\b/i,
      /^UI Mockup \/ App Screen\b/i,
      /^Filled Layers - Separate Colors\b/i,
    ],
  },
  {
    path: "/jpg-to-layered-svg-for-cricut",
    label: "jpg-layered-cricut",
    fixtureKind: "jpg",
    fastPresets: [/^Layered color SVG - Fewer/i, /^Layered - 3 Color/i, /^Layered color SVG\b/i],
    layeredPresets: [/^Layered color SVG - More detail/i, /^Filled Layers - Separate Colors\b/i, /^UI Mockup \/ App Screen\b/i],
  },
  {
    path: "/png-to-layered-svg-for-cricut",
    label: "png-layered-cricut",
    fixtureKind: "png",
    fastPresets: [/^Layered color SVG - Fewer/i, /^Layered - 3 Color/i, /^Layered color SVG\b/i],
    layeredPresets: [/^Layered color SVG - More detail/i, /^Filled Layers - Separate Colors\b/i, /^UI Mockup \/ App Screen\b/i],
  },
];

async function main() {
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.mkdir(downloadsDir, { recursive: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  const server = await serverState();
  const browserPath = await findBrowserExecutable();
  const fixtures = await prepareFixtures();
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
    for (const route of routes) {
      console.error(`[browser-freeze-diagnostic] ${route.path}`);
      const result = await runRoute(route, fixtures);
      results.push(result);
      console.error(
        `[browser-freeze-diagnostic] ${route.path}: alive=${result.final?.pageAlive ?? false}, timeouts=${result.interactionTimeoutCount}`,
      );
    }
  } finally {
    browser.kill();
  }

  const report = {
    baseUrl,
    checkedAt: new Date().toISOString(),
    browserPath,
    debugPort,
    server,
    fixture: fixtures.fixtureInfo,
    routes: results,
  };
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

async function runRoute(route, fixtures) {
  const client = await openTab(`${baseUrl}${route.path}`);
  const consoleErrors = [];
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
      if (type === "warning") actionLog.push({ step: "console-warning", text });
    }
    if (message.method === "Log.entryAdded") {
      const entry = message.params?.entry;
      if (entry?.level === "error") consoleErrors.push(entry.text || "Browser log error");
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
      actionLog.push({ step: name, ok: true, elapsedMs, value });
      return { ok: true, elapsedMs, value };
    } catch (error) {
      const elapsedMs = performance.now() - started;
      const message = error instanceof Error ? error.message : String(error);
      if (/timed out|timeout/i.test(message)) interactionTimeoutCount += 1;
      actionLog.push({ step: name, ok: false, elapsedMs, error: message });
      return { ok: false, elapsedMs, error: message };
    }
  };

  try {
    await client.send("Runtime.enable");
    await client.send("Log.enable").catch(() => {});
    await client.send("Page.enable").catch(() => {});
    await client.send("DOM.enable").catch(() => {});
    await client.send("Performance.enable").catch(() => {});
    await configureDownloads(client).catch(() => {});
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false,
    }).catch(() => {});
    await waitForDocumentReady(client);
    await installLongTaskObserver(client);

    const fixturePath = route.fixtureKind === "jpg" ? fixtures.jpg : fixtures.png;
    const initial = await safeCollectMetrics(client);

    await step("upload screenshot-like fixture", async () => {
      await setFileInput(client, fixturePath);
      return waitForUploadAccepted(client, path.basename(fixturePath), 20_000);
    });

    const afterUpload = await safeCollectMetrics(client);
    await step("select normal or fast preset", () => selectPreset(client, route.fastPresets));
    await step("convert with normal or fast preset", () => clickConvertAndWait(client, 1, 120_000));
    const afterFirstConvert = await safeCollectMetrics(client);

    const minimumSecondCount = Math.max(2, Number(afterFirstConvert?.outputCards || 0) + 1);
    await step("select layered or color preset", () => selectPreset(client, route.layeredPresets));
    await step("convert with layered or color preset", () =>
      clickConvertAndWait(client, minimumSecondCount, 160_000),
    );
    const afterSecondConvert = await safeCollectMetrics(client);

    const settings = await step("open Settings/Edit on latest editable output", () =>
      openLatestSettings(client),
    );
    await step("expand layer/color settings if available", () => expandLayerColorSettings(client));
    const colorEdit = await step("change a layer color if available", () => changeFirstColor(client));
    const sliderMove = await step("move opacity/slider control if available", () => moveFirstSlider(client));
    const moreMenu = await step("open More menu while output/settings exist", () => openMoreMenu(client));
    const scroll = await step("scroll page while output/settings exist", () => scrollPage(client));
    const copy = await step("attempt copy if output is valid", () => clickCopy(client));
    const download = await step("attempt download if output is valid", () => clickDownload(client));
    const final = await safeCollectMetrics(client);

    return {
      route: route.path,
      label: route.label,
      fixture: path.basename(fixturePath),
      consoleErrors,
      pageErrors,
      downloads,
      interactionTimeoutCount,
      pageUnresponsiveOrCdpTimeout: interactionTimeoutCount > 0 || final?.pageAlive === false,
      initial,
      afterUpload,
      afterFirstConvert,
      afterSecondConvert,
      timings: {
        openSettingsMs: settings.elapsedMs,
        colorEditMs: colorEdit.elapsedMs,
        sliderMoveMs: sliderMove.elapsedMs,
        moreMenuMs: moreMenu.elapsedMs,
        scrollMs: scroll.elapsedMs,
        copyMs: copy.elapsedMs,
        downloadMs: download.elapsedMs,
      },
      previewCopyDownloadCorrectness: {
        copyAttempted: copy.value?.clicked === true,
        downloadAttempted: download.value?.clicked === true,
        downloadStarted: downloads.length > 0,
        caveat: "Diagnostic verifies controls stayed callable and downloads started; it does not prove semantic SVG parity.",
      },
      final,
      actionLog,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/timed out|timeout/i.test(message)) interactionTimeoutCount += 1;
    return {
      route: route.path,
      label: route.label,
      fixture: route.fixtureKind === "jpg" ? path.basename(fixtures.jpg) : path.basename(fixtures.png),
      consoleErrors,
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

async function clickConvertAndWait(client, minimumOutputCount, timeoutMs) {
  const before = await outputState(client).catch(() => ({ outputCards: 0 }));
  const clicked = await clickButtonIfPresent(
    client,
    [/Convert/i, /Create/i],
    [/Download/i, /Copy/i, /Settings/i, /Batch/i],
  );
  if (!clicked && Number(before.outputCards || 0) <= 0 && Number(before.activeJobs || 0) <= 0) {
    throw new Error("No enabled Convert/Create button and no existing conversion job.");
  }
  const wanted = Math.max(minimumOutputCount, Number(before.outputCards || 0));
  return waitForValue(
    client,
    outputStateExpression,
    timeoutMs,
    (value) =>
      value?.pageAlive &&
      Number(value.outputCards || 0) >= wanted &&
      Number(value.activeJobs || 0) === 0 &&
      Number(value.readyOutputCount || 0) >= Math.min(wanted, Number(value.outputCards || 0)),
  ).catch(async () => {
    await waitForValue(client, outputStateExpression, 20_000, (value) => value?.activeJobs === 0).catch(() => null);
    const state = await outputState(client);
    return { ...state, timedOutWaitingForIdle: true, clicked: Boolean(clicked) };
  });
}

async function selectPreset(client, patterns) {
  const opened = await clickButtonIfPresent(client, [/All presets/i, /Show all presets/i], []).catch(() => null);
  if (opened) await delay(250);
  for (const pattern of patterns) {
    const clicked = await clickButtonIfPresent(client, [pattern], [/Show fewer/i, /Filter presets/i]).catch(() => null);
    if (clicked) {
      await delay(350);
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
  })()`);
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
      const candidates = Array.from(document.querySelectorAll(selector));
      return candidates.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const style = getComputedStyle(candidate);
        return rect.width > 0 && rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          !candidate.disabled;
      }) || null;
    }
  })()`);
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
      const candidates = Array.from(document.querySelectorAll(selector));
      return candidates.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        const style = getComputedStyle(candidate);
        return rect.width > 0 && rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          !candidate.disabled;
      }) || null;
    }
  })()`);
}

async function openMoreMenu(client) {
  const clicked = await clickButtonInLatestOutput(client, [/^More\b/i], []);
  if (!clicked) return { opened: false, reason: "output More control not found" };
  const menu = await waitForValue(
    client,
    () => `(() => Boolean(document.querySelector('[role="menu"]')) || /Download|Copy|Settings|Batch/i.test(document.body.innerText || ""))()`,
    4_000,
    Boolean,
  ).catch(() => false);
  return { opened: Boolean(menu), clicked };
}

async function scrollPage(client) {
  return evaluate(client, `(async () => {
    const startY = window.scrollY;
    for (const y of [window.innerHeight * 0.7, window.innerHeight * 1.4, 0]) {
      window.scrollTo({ top: y, behavior: "auto" });
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return { startY, endY: window.scrollY, scrollHeight: document.documentElement.scrollHeight };
  })()`);
}

async function clickCopy(client) {
  const clicked = await clickButtonInLatestOutput(client, [/Copy SVG/i, /^Copy$/i], [/Copied/i]);
  if (!clicked) return { clicked: false, reason: "copy control not found" };
  await delay(250);
  return { clicked: true, label: clicked.label };
}

async function clickDownload(client) {
  const before = await getDownloadCount(client);
  const clicked = await clickButtonInLatestOutput(client, [/Download/i], [/ZIP/i]);
  if (!clicked) return { clicked: false, reason: "download control not found" };
  await delay(750);
  const after = await getDownloadCount(client);
  return { clicked: true, label: clicked.label, downloadCountBefore: before, downloadCountAfter: after };
}

async function getDownloadCount(client) {
  return evaluate(client, `(() => 0)()`).then(() => 0);
}

async function clickButtonInLatestOutput(client, patterns, rejectPatterns = []) {
  const target = await evaluate(client, `(() => {
    const patterns = ${JSON.stringify(patterns.map((pattern) => pattern.source))}.map((source) => new RegExp(source, "i"));
    const rejects = ${JSON.stringify(rejectPatterns.map((pattern) => pattern.source))}.map((source) => new RegExp(source, "i"));
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const cards = Array.from(document.querySelectorAll("[data-output-stamp]"));
    const roots = cards.length ? cards : [document.body];
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
  })()`);
  if (!target) return null;
  await trustedClickAtPoint(client, target);
  return target;
}

async function clickButtonMatching(client, patterns, rejectPatterns = []) {
  const clicked = await clickButtonIfPresent(client, patterns, rejectPatterns);
  if (!clicked) {
    throw new Error(`No enabled button matched ${patterns.map(String).join(", ")}`);
  }
  return clicked;
}

async function clickButtonIfPresent(client, patterns, rejectPatterns = []) {
  const target = await evaluate(client, `(() => {
    const patterns = ${JSON.stringify(patterns.map((pattern) => pattern.source))}.map((source) => new RegExp(source, "i"));
    const rejects = ${JSON.stringify(rejectPatterns.map((pattern) => pattern.source))}.map((source) => new RegExp(source, "i"));
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], summary"));
    const button = buttons.find((candidate) => {
      const text = candidate.innerText || candidate.textContent || candidate.getAttribute("aria-label") || "";
      const rect = candidate.getBoundingClientRect();
      const style = getComputedStyle(candidate);
      return rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        !candidate.disabled &&
        patterns.some((pattern) => pattern.test(text)) &&
        !rejects.some((pattern) => pattern.test(text));
    });
    if (!button) return null;
    button.scrollIntoView({ block: "center", inline: "nearest" });
    const rect = button.getBoundingClientRect();
    return {
      label: (button.innerText || button.textContent || button.getAttribute("aria-label") || "").trim(),
      x: Math.max(1, Math.min(window.innerWidth - 2, rect.left + rect.width / 2)),
      y: Math.max(1, Math.min(window.innerHeight - 2, rect.top + rect.height / 2)),
    };
  })()`);
  if (!target) return null;
  await trustedClickAtPoint(client, target);
  return target;
}

async function trustedClickAtPoint(client, point) {
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

async function safeCollectMetrics(client) {
  try {
    return await collectMetrics(client);
  } catch (error) {
    return {
      pageAlive: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function collectMetrics(client) {
  const page = await evaluate(client, `(async () => {
    const cards = Array.from(document.querySelectorAll("[data-output-stamp]"));
    const expandedCards = cards.filter((card) => card.getAttribute("data-collapse-state") !== "collapsed");
    const settingsPanels = visibleElements('[data-editor-settings-panel="true"], [id^="output-settings-"]:not([id^="output-settings-panel-"])');
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
      return {
        bytes: new Blob([svg]).size,
        paths: doc.querySelectorAll("path").length,
        layers: doc.querySelectorAll("[data-layer-id], [data-fill-layer-id], [data-stroke-layer-id], g[data-layer-name]").length,
        nodes: doc.querySelectorAll("*").length,
        parserError: Boolean(doc.querySelector("parsererror")),
      };
    });
    const longTasks = Array.isArray(window.__ILOVESVG_FREEZE_DIAGNOSTIC__?.longTasks)
      ? window.__ILOVESVG_FREEZE_DIAGNOSTIC__.longTasks
      : [];
    const outputText = cards.map((card) => (card.innerText || "").replace(/\\s+/g, " ").slice(0, 240));
    const body = document.body?.innerText || "";
    return {
      pageAlive: true,
      href: location.href,
      title: document.title,
      domNodes: document.querySelectorAll("*").length,
      outputCards: cards.length,
      expandedOutputCards: expandedCards.length,
      collapsedOutputCards: cards.length - expandedCards.length,
      fullSvgPreviewCount: fullPreviewImages.length,
      settingsPanelCount: settingsPanels.length,
      layerRowCount: visibleElements('[data-layer-id], [data-fill-layer-id], [data-stroke-layer-id], input[type="color"]').length,
      activeJobs: cards.filter((card) => /queued|running/i.test(card.getAttribute("data-job-status") || "") || /\\b(Queued|Running|Converting)\\b/i.test(card.innerText || "")).length,
      readyOutputCount: cards.filter((card) => !/queued|running/i.test(card.getAttribute("data-job-status") || "") && /Download|Copy|Settings/i.test(card.innerText || "")).length,
      decodedPreviewBytes: parsed.reduce((sum, item) => sum + item.bytes, 0),
      decodedPreviewPaths: parsed.reduce((sum, item) => sum + item.paths, 0),
      decodedPreviewLayers: parsed.reduce((sum, item) => sum + item.layers, 0),
      decodedPreviewNodes: parsed.reduce((sum, item) => sum + item.nodes, 0),
      decodedPreviewParserErrors: parsed.filter((item) => item.parserError).length,
      largestPreviewBytes: parsed.reduce((max, item) => Math.max(max, item.bytes), 0),
      longTaskCount: longTasks.length,
      longTasks: longTasks.slice(-20),
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      hasMoreMenuText: /^More\\b/m.test(body) || /\\bMore\\b/.test(body),
      hasCopyControl: /Copy SVG|\\bCopy\\b/.test(body),
      hasDownloadControl: /Download/.test(body),
      outputText,
    };

    function visibleElements(selector) {
      return Array.from(document.querySelectorAll(selector)).filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
    }
  })()`);
  const browserMetrics = await client.send("Performance.getMetrics").catch(() => null);
  return {
    ...page,
    browserMetrics: browserMetrics?.metrics
      ?.filter((metric) =>
        ["JSHeapUsedSize", "JSHeapTotalSize", "Nodes", "Documents", "LayoutCount"].includes(metric.name),
      )
      .reduce((acc, metric) => {
        acc[metric.name] = metric.value;
        return acc;
      }, {}),
  };
}

async function outputState(client) {
  return evaluate(client, outputStateExpression());
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
        return !button.disabled && /Convert|Create/i.test(text) && !/Download|Copy|Settings|Batch/i.test(text);
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
      await client.send("DOM.setFileInputFiles", { nodeId, files: [filePath] });
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
    const { node } = await client.send("DOM.describeNode", { nodeId });
    if (node?.backendNodeId) {
      await client.send("DOM.setFileInputFiles", {
        backendNodeId: node.backendNodeId,
        files: [filePath],
      });
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

  if (lastError) {
    throw lastError;
  }
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
    })()`);
    if (!target) throw new Error("No file input found.");
    await trustedClickAtPoint(client, target);
    const event = await chooserPromise;
    const backendNodeId = event.params?.backendNodeId;
    if (!backendNodeId) throw new Error("File chooser opened without a backend node id.");
    await client.send("DOM.setFileInputFiles", { backendNodeId, files: [filePath] });
  } finally {
    await client.send("Page.setInterceptFileChooserDialog", { enabled: false }).catch(() => {});
  }
}

async function queryFileInputNodeId(client, selector) {
  const { root } = await client.send("DOM.getDocument", { depth: -1, pierce: true });
  const { nodeId } = await client.send("DOM.querySelector", {
    nodeId: root.nodeId,
    selector,
  });
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
  })()`);
}

async function uploadLooksAccepted(client, filename) {
  return evaluate(client, `(() => {
    const body = document.body?.innerText || "";
    const cards = document.querySelectorAll("[data-output-stamp]").length;
    const enabledConvert = Array.from(document.querySelectorAll("button")).some((button) => {
      const text = button.innerText || button.textContent || "";
      return !button.disabled && /Convert|Create/i.test(text) && !/Download|Copy|Settings|Batch/i.test(text);
    });
    return body.includes(${JSON.stringify(filename)}) || cards > 0 || enabledConvert;
  })()`).catch(() => false);
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
  })()`);
  if (!applied?.ok) {
    throw new Error(`Could not set file through browser DataTransfer: ${applied?.reason || "unknown"}`);
  }
}

function mimeTypeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function isStaleDomNodeError(error) {
  return /could not find node|no node with given id|cannot find context/i.test(
    error instanceof Error ? error.message : String(error),
  );
}

async function installLongTaskObserver(client) {
  await evaluate(client, `(() => {
    window.__ILOVESVG_FREEZE_DIAGNOSTIC__ = { longTasks: [] };
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__ILOVESVG_FREEZE_DIAGNOSTIC__.longTasks.push({
              name: entry.name,
              startTime: Math.round(entry.startTime),
              duration: Math.round(entry.duration),
            });
          }
        });
        observer.observe({ type: "longtask", buffered: true });
        window.__ILOVESVG_FREEZE_DIAGNOSTIC__.observer = observer;
      } catch {}
    }
    return true;
  })()`);
}

async function configureDownloads(client) {
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadsDir,
  });
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
    last = await evaluate(client, expressionFactory());
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

async function prepareFixtures() {
  const userFixtureAvailable = await fs
    .access(userFixturePath)
    .then(() => true)
    .catch(() => false);
  const png = userFixtureAvailable
    ? userFixturePath
    : path.join(fixturesDir, "generated-screenshot-like.png");
  if (!userFixtureAvailable) {
    await sharp(Buffer.from(buildScreenshotLikeSvg())).png().toFile(png);
  }
  const jpg = path.join(fixturesDir, "screenshot-like.jpg");
  await sharp(png, { limitInputPixels: false }).jpeg({ quality: 90 }).toFile(jpg);
  const pngStat = await fs.stat(png);
  const jpgStat = await fs.stat(jpg);
  return {
    png,
    jpg,
    fixtureInfo: {
      requestedUserFixture: userFixturePath,
      usedUserFixture: userFixtureAvailable,
      png,
      pngBytes: pngStat.size,
      jpg,
      jpgBytes: jpgStat.size,
    },
  };
}

function buildScreenshotLikeSvg() {
  const panels = [];
  for (let index = 0; index < 42; index += 1) {
    const inset = 8 + index * 4;
    const width = Math.max(90, 760 - index * 9);
    const height = Math.max(60, 520 - index * 6);
    const fill = ["#e0f2fe", "#fef3c7", "#dcfce7", "#fce7f3"][index % 4];
    panels.push(`<rect x="${inset}" y="${inset}" width="${width}" height="${height}" rx="10" fill="${fill}" stroke="#0f172a" stroke-width="1"/>`);
    panels.push(`<rect x="${inset + 14}" y="${inset + 16}" width="${Math.max(30, width - 28)}" height="8" rx="4" fill="#334155" opacity=".35"/>`);
    panels.push(`<circle cx="${inset + 28}" cy="${inset + 44}" r="${7 + (index % 4)}" fill="#2563eb" opacity=".45"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="540" viewBox="0 0 780 540"><rect width="780" height="540" fill="#f8fafc"/>${panels.join("")}<text x="44" y="502" font-family="Arial" font-size="24" font-weight="700" fill="#0f172a">Screenshot-like diagnostic fixture</text></svg>`;
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
    baseUrl,
    checkedAt: new Date().toISOString(),
    fatal: error instanceof Error ? error.message : String(error),
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true }).catch(() => {});
  await fs.writeFile(reportPath, JSON.stringify(fatal, null, 2)).catch(() => {});
  console.error(JSON.stringify(fatal, null, 2));
  process.exit(1);
});
