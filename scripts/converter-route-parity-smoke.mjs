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
  process.env.CDP_PORT || 10650 + Math.floor(Math.random() * 300),
);
const timeoutMs = Number(process.env.CONVERTER_ROUTE_PARITY_TIMEOUT_MS || 300_000);
const runDir = path.join(rootDir, "tmp", "converter-route-parity-smoke");
const downloadRoot = path.join(runDir, "downloads");
const fixtureRoot = path.join(runDir, "fixtures");
const profileDir = path.join(
  os.tmpdir(),
  "ilovesvg-converter-route-parity-smoke",
  String(debugPort),
);
const reportPath = process.env.CONVERTER_ROUTE_PARITY_REPORT_PATH
  ? path.resolve(process.env.CONVERTER_ROUTE_PARITY_REPORT_PATH)
  : path.join(runDir, "report.json");

const criticalFixture =
  process.env.CONVERTER_ROUTE_PARITY_FIXTURE ||
  "C:\\Users\\Suhas\\Downloads\\IMG_8846.JPEG";

const presets = {
  flatAmazing: {
    id: "layered-flat-color-insane-quality",
    label: "Layered - Flat Color (Amazing Quality)",
    pattern: /^Layered - Flat Color \(Amazing Quality\)(?:\s|$)/i,
    layered: true,
  },
  genericAmazing: {
    id: "layered-insane-quality",
    label: "Layered - Amazing Quality",
    pattern: /^Layered - Amazing Quality(?:\s|$)/i,
    layered: true,
  },
  photoAmazing: {
    id: "photo-many-colors-insane-quality",
    label: "Photo Many Colors (Amazing Quality)",
    pattern: /^Photo Many Colors \(Amazing Quality\)(?:\s|$)/i,
    layered: true,
  },
};

async function main() {
  await fs.rm(runDir, { recursive: true, force: true });
  await fs.rm(profileDir, { recursive: true, force: true });
  await fs.mkdir(downloadRoot, { recursive: true });
  await fs.mkdir(fixtureRoot, { recursive: true });
  await fs.mkdir(profileDir, { recursive: true });

  if (!(await fileExists(criticalFixture))) {
    throw new Error(`Required route-parity fixture is missing: ${criticalFixture}`);
  }

  const routineFixture = await createRoutineFixture();
  const server = await serverState();
  if (!server.looksLikeIlovesvg) {
    throw new Error(`Expected iLoveSVG at ${baseUrl}; saw ${server.title || server.status}`);
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

  const scenarios = [
    {
      route: "/",
      preset: presets.flatAmazing,
      fixturePath: criticalFixture,
      requireVisible: true,
      critical: true,
    },
    {
      route: "/png-to-svg-for-silhouette",
      preset: presets.flatAmazing,
      fixturePath: criticalFixture,
      requireVisible: true,
      critical: true,
    },
    {
      route: "/png-to-svg-for-cricut",
      preset: presets.flatAmazing,
      fixturePath: routineFixture,
    },
    {
      route: "/png-to-svg-converter",
      preset: presets.flatAmazing,
      fixturePath: routineFixture,
    },
    {
      route: "/png-to-layered-svg-for-cricut",
      preset: presets.flatAmazing,
      fixturePath: routineFixture,
    },
    {
      route: "/image-to-layered-svg-for-cricut",
      preset: presets.flatAmazing,
      fixturePath: routineFixture,
    },
    {
      route: "/png-to-svg-for-silhouette",
      preset: presets.photoAmazing,
      fixturePath: routineFixture,
    },
    {
      route: "/png-to-svg-converter",
      preset: presets.genericAmazing,
      fixturePath: routineFixture,
    },
  ];

  const report = {
    checkedAt: new Date().toISOString(),
    baseUrl,
    gitHead: await gitHead(),
    server,
    browserPath,
    timeoutMs,
    criticalFixture,
    routineFixture,
    routes: [],
    failures: [],
  };

  try {
    await waitForCdp();
    for (const scenario of scenarios) {
      const result = await runRouteScenario(scenario).catch((error) => ({
        route: scenario.route,
        presetId: scenario.preset.id,
        presetLabel: scenario.preset.label,
        fixture: fixtureSummary(scenario.fixturePath),
        supported: "error",
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      }));
      report.routes.push(result);
      const failures = validateScenarioResult(result, scenario);
      report.failures.push(...failures);
      await writeReport(report);
      const status = result.ok ? "ok" : result.supported === "hidden" ? "hidden" : "failed";
      console.error(
        `[route-parity] ${scenario.route} ${scenario.preset.label}: ${status} title="${result.outputTitle || ""}" bytes=${result.svgBytes || 0}`,
      );
    }
  } finally {
    browser.kill();
    await fs.rm(profileDir, { recursive: true, force: true }).catch(() => null);
  }

  await writeReport(report);
  console.log(JSON.stringify(summarizeReport(report), null, 2));
  if (report.failures.length) {
    process.exitCode = 1;
  }
}

async function runRouteScenario({
  route,
  preset,
  fixturePath,
  requireVisible = false,
}) {
  const scenarioId = `${slug(route || "home")}-${preset.id}`;
  const downloadDir = path.join(downloadRoot, scenarioId);
  await fs.mkdir(downloadDir, { recursive: true });
  const client = await openTab(`${baseUrl}${route}`);
  const startedAt = Date.now();
  let stage = "open";

  try {
    stage = "enable page";
    await enablePage(client, downloadDir);
    await waitForDocumentReady(client);
    await verifyClipboardAccess(client).catch(() => null);
    stage = "wait for route document";
    await waitForRouteDocument(client, `${baseUrl}${route}`);
    stage = "seed stale settings localStorage";
    await seedStaleSettingsTopLevelStorage(client);

    stage = "upload fixture";
    await uploadFixtureWithRetry(client, fixturePath);

    stage = "settle initial output";
    await settleInitialAutoConversion(client, 20_000).catch(() => null);
    const beforePreset = await outputState(client).catch(() => ({ latestStamp: null }));

    stage = "select preset";
    const selectedPreset = await selectPreset(client, [preset.pattern], preset.label);
    if (!selectedPreset.selected) {
      return {
        route,
        presetId: preset.id,
        presetLabel: preset.label,
        fixture: fixtureSummary(fixturePath),
        supported: "hidden",
        requireVisible,
        ok: !requireVisible,
        selectedPreset,
        elapsedMs: Date.now() - startedAt,
      };
    }

    stage = "start selected conversion";
    const afterPreset = await waitForValue(
      client,
      () => outputStateExpression(beforePreset.latestStamp),
      5_000,
      (value) => value?.activeJobs > 0 || value?.latestChanged,
    ).catch(() => outputState(client).catch(() => beforePreset));
    const conversionStartedFromPreset =
      afterPreset?.activeJobs > 0 ||
      (beforePreset.latestStamp != null && afterPreset?.latestChanged);
    if (!conversionStartedFromPreset) {
      await clickConvert(client);
    }

    stage = "wait for selected output";
    const terminal = await waitForTerminalOutput(
      client,
      beforePreset.latestStamp,
      timeoutMs,
    );

    stage = "open settings";
    const settingsOpened = terminal.latestReady
      ? await openLatestSettingsPanel(client).catch((error) => ({
          open: false,
          error: error instanceof Error ? error.message : String(error),
        }))
      : { open: false, skipped: true };
    const layerColors = terminal.latestReady && preset.layered
      ? await ensureSettingsSectionOpen(client, /Layer colors/i, "layer-colors").catch(
          (error) => ({
            ok: false,
            reason: error instanceof Error ? error.message : String(error),
          }),
        )
      : { ok: true, skipped: true };

    stage = "collect UI";
    const ui = await collectUi(client);

    let copyDownloadParity = null;
    let download = null;
    let svg = null;
    if (terminal.latestReady) {
      stage = "prime clipboard";
      const beforeCapture = await primeClipboard(client, scenarioId);
      stage = "copy svg";
      const copyClick = await clickButtonInLatestOutput(
        client,
        [/Copy SVG/i, /^Copy$/i],
        [/Copied/i],
      ).catch(() => null);
      stage = "wait for copy";
      const copyCapture = copyClick
        ? await waitForClipboardSvg(client, beforeCapture.latestClipboardHash).catch(
            () => null,
          )
        : null;
      stage = "download svg";
      download = await downloadLatestSvg(client, downloadDir).catch((error) => ({
        error: error instanceof Error ? error.message : String(error),
      }));
      if (download?.path) {
        svg = await analyzeSvgFile(download.path);
      }
      copyDownloadParity = {
        attempted: Boolean(copyClick || download),
        copyClicked: Boolean(copyClick),
        downloadClicked: Boolean(download?.path),
        ok: Boolean(
          copyCapture &&
            download?.path &&
            copyCapture.latestClipboardHash === download.hash &&
            copyCapture.latestClipboardBytes === download.bytes,
        ),
        copyBytes: copyCapture?.latestClipboardBytes || 0,
        downloadBytes: download?.bytes || 0,
        copyHash: copyCapture?.latestClipboardHash || null,
        downloadHash: download?.hash || null,
        downloadError: download?.error || null,
      };
    }

    const result = {
      route,
      presetId: preset.id,
      presetLabel: preset.label,
      fixture: fixtureSummary(fixturePath),
      supported: "visible",
      ok: true,
      selectedPreset,
      elapsedMs: Date.now() - startedAt,
      terminal,
      settingsOpened,
      layerColors,
      outputTitle: ui?.outputTitle || terminal.latestOutputTitle || "",
      engineUsed: ui?.engineUsed || terminal.latestEngineUsed || null,
      dimensions: ui?.dimensions || svg?.dimensions || null,
      svgBytes: download?.bytes || ui?.svgBytesAttr || terminal.latestSvgBytes || 0,
      groupCount: ui?.layerTotalCount ?? svg?.groupCount ?? null,
      pathCount: ui?.pathCount ?? svg?.pathCount ?? null,
      segmentCount: svg?.segmentCount ?? null,
      preview: ui?.preview || null,
      copyDownloadParity,
      download: download?.path
        ? {
            path: download.path,
            basename: download.basename,
            bytes: download.bytes,
            hash: download.hash,
          }
        : null,
      browserLogs: client.collectLogs(),
    };
    return result;
  } catch (error) {
    return {
      route,
      presetId: preset.id,
      presetLabel: preset.label,
      fixture: fixtureSummary(fixturePath),
      supported: "error",
      ok: false,
      stage,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      lastState: await outputState(client).catch(() => null),
      browserLogs: client.collectLogs(),
    };
  } finally {
    await client.close().catch(() => null);
  }
}

function validateScenarioResult(result, scenario) {
  const failures = [];
  const add = (reason) =>
    failures.push({
      route: scenario.route,
      presetId: scenario.preset.id,
      presetLabel: scenario.preset.label,
      fixture: path.basename(scenario.fixturePath),
      reason,
    });

  if (scenario.requireVisible && result.supported === "hidden") {
    add("required preset was not visible/selectable");
    return failures;
  }
  if (result.supported === "hidden") return failures;
  if (result.error) {
    add(`${result.stage || "scenario"} failed: ${result.error}`);
    return failures;
  }
  if (!result.selectedPreset?.selected) add("preset was visible check failed or not selected");
  if (result.terminal?.activeJobs > 0) add("pending output remained active");
  if (result.terminal?.latestFailed) {
    add(`selected preset ended in failed output: ${result.terminal.latestFailureText || ""}`);
  }
  if (!result.terminal?.latestReady) add("selected preset did not produce a usable SVG result");
  if (
    result.outputTitle &&
    !normalizeText(result.outputTitle).includes(normalizeText(scenario.preset.label))
  ) {
    add(`output title does not match selected preset; saw "${result.outputTitle}"`);
  }
  if (
    result.terminal?.latestBodyText &&
    !normalizeText(result.terminal.latestBodyText).includes(normalizeText(scenario.preset.label))
  ) {
    add("latest output card body did not include the selected preset label");
  }
  if (result.settingsOpened && !result.settingsOpened.open) {
    add(`Settings/Edit did not open: ${result.settingsOpened.error || "unknown"}`);
  }
  if (
    result.settingsOpened?.topLevelSettings?.count > 0 &&
    !(
      result.settingsOpened.topLevelSettings.liveOpen &&
      result.settingsOpened.topLevelSettings.convertOpen
    )
  ) {
    add("Live Preview Edits and Click To Convert did not default open with stale localStorage seeded");
  }
  if (
    result.settingsOpened?.topLevelSettings?.count > 0 &&
    result.settingsOpened.openSettingsSectionCount !== 0
  ) {
    add("Settings/Edit subsections did not remain collapsed by default");
  }
  if (scenario.preset.layered && result.layerColors && result.layerColors.ok === false) {
    add(`Layer colors did not open for layered output: ${result.layerColors.reason || "unknown"}`);
  }
  if (!result.copyDownloadParity?.ok) add("Copy SVG and Download SVG did not match");
  if (!result.preview?.visible) add("SVG preview was not visible in the latest output");
  if (
    Number(result.svgBytes || 0) >= 1_000_000 &&
    result.preview?.srcKind &&
    result.preview.srcKind !== "blob"
  ) {
    add(`large SVG preview did not use Blob URL handling; saw ${result.preview.srcKind}`);
  }
  return failures;
}

function summarizeReport(report) {
  return {
    baseUrl: report.baseUrl,
    gitHead: report.gitHead,
    routeCount: report.routes.length,
    failed: report.failures.length,
    reportPath,
    routes: report.routes.map((route) => ({
      route: route.route,
      preset: route.presetLabel,
      supported: route.supported,
      ok: route.ok && !report.failures.some(
        (failure) =>
          failure.route === route.route &&
          failure.presetId === route.presetId &&
          failure.fixture === route.fixture?.basename,
      ),
      outputTitle: route.outputTitle || null,
      svgBytes: route.svgBytes || 0,
      groupCount: route.groupCount ?? null,
      settingsOpen: route.settingsOpened?.open ?? null,
      layerColors: route.layerColors?.ok ?? null,
      copyDownloadParity: route.copyDownloadParity?.ok ?? null,
    })),
    failures: report.failures,
  };
}

async function createRoutineFixture() {
  const fixturePath = path.join(fixtureRoot, "route-parity-logo.png");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="384" viewBox="0 0 512 384">
      <rect width="512" height="384" fill="#f8fafc"/>
      <rect x="56" y="48" width="400" height="288" rx="28" fill="#facc15"/>
      <rect x="80" y="74" width="352" height="240" rx="18" fill="#38bdf8"/>
      <circle cx="190" cy="190" r="74" fill="#f97316"/>
      <path d="M154 190c22-44 70-44 96 0-28 38-70 38-96 0Z" fill="#fff7ed"/>
      <path d="M118 110h276M118 276h276M330 130l46 46-46 46" fill="none" stroke="#111827" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="120" y="250" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#111827">SVG</text>
    </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(fixturePath);
  return fixturePath;
}

async function serverState() {
  const response = await fetch(baseUrl);
  const text = await response.text();
  return {
    status: response.status,
    title: text.match(/<title>(.*?)<\/title>/i)?.[1] || "",
    looksLikeIlovesvg: /iLoveSVG|Free SVG Converter/i.test(text),
  };
}

async function gitHead() {
  const { execFile } = await import("node:child_process");
  return new Promise((resolve) => {
    execFile("git", ["rev-parse", "HEAD"], { cwd: rootDir }, (error, stdout) =>
      resolve(error ? null : stdout.trim()),
    );
  });
}

function fixtureSummary(filePath) {
  return { path: filePath, basename: path.basename(filePath) };
}

async function setFileInput(client, filePath) {
  await waitForValue(
    client,
    () => `(() => Boolean(document.querySelector('input[type="file"]')))()`,
    12_000,
    Boolean,
  );
  const basename = path.basename(filePath);

  try {
    await setFileInputViaChooser(client, filePath);
    const accepted = await waitForUploadAccepted(client, basename, 25_000).catch(
      () => null,
    );
    if (accepted) return accepted;
  } catch {}

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const nodeId = await queryFileInputNodeId(client, primaryFileInputSelector);
      await client.send("DOM.setFileInputFiles", { nodeId, files: [filePath] }, 10_000);
      await dispatchFileInputChange(client);
      const accepted = await waitForUploadAccepted(client, basename, 15_000).catch(
        () => null,
      );
      if (accepted) return accepted;
    } catch (error) {
      lastError = error;
      await delay(200);
    }
  }

  await setFileInputFromBuffer(client, filePath);
  const accepted = await waitForUploadAccepted(client, basename, 25_000).catch(
    () => null,
  );
  if (accepted) return accepted;

  throw lastError || new Error(`File upload did not appear in page state for ${basename}.`);
}

async function waitForUploadAccepted(client, filename, waitTimeoutMs) {
  return waitForValue(
    client,
    () => `(() => {
      const body = document.body?.innerText || "";
      const inputHasFile = Array.from(document.querySelectorAll('input[type="file"]')).some((input) =>
        Array.from(input.files || []).some((file) => file.name === ${JSON.stringify(filename)}),
      );
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
      const previewVisible = Array.from(document.querySelectorAll("img")).some((image) =>
        /Input|Original/i.test(image.alt || "") && image.currentSrc,
      );
      const errorText = Array.from(document.querySelectorAll("span, p, div"))
        .map((element) => (element.textContent || "").replace(/\\s+/g, " ").trim())
        .find((text) => /choose|upload|too large|could not read|unsupported/i.test(text) && /png|jpg|webp|image|file/i.test(text)) || "";
      return {
        bodyHasName: body.includes(${JSON.stringify(filename)}),
        inputHasFile,
        enabledConvert,
        routeBusy,
        outputCards,
        previewVisible,
        errorText,
      };
    })()`,
    waitTimeoutMs,
    (value) =>
      value?.bodyHasName ||
      value?.routeBusy ||
      value?.outputCards > 0,
  );
}

const primaryFileInputSelector = 'label input[type="file"], input[type="file"]';

async function setFileInputViaChooser(client, filePath) {
  await client.send("Page.enable").catch(() => {});
  await client.send("Page.setInterceptFileChooserDialog", { enabled: true }).catch(
    () => {},
  );
  try {
    const chooserPromise = waitForEvent(client, "Page.fileChooserOpened", 5_000);
    const target = await evaluate(client, `(() => {
      const input = document.querySelector(${JSON.stringify(primaryFileInputSelector)});
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
    await client.send("DOM.setFileInputFiles", { backendNodeId, files: [filePath] }, 10_000);
  } finally {
    await client.send("Page.setInterceptFileChooserDialog", { enabled: false }).catch(
      () => {},
    );
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
    const input = document.querySelector(${JSON.stringify(primaryFileInputSelector)});
    if (!input) return false;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
}

async function setFileInputFromBuffer(client, filePath) {
  const file = {
    name: path.basename(filePath),
    type: mimeTypeForPath(filePath),
    base64: (await fs.readFile(filePath)).toString("base64"),
  };
  const applied = await evaluate(client, `(() => {
    const input = document.querySelector(${JSON.stringify(primaryFileInputSelector)});
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
  })()`, 30_000);
  if (!applied?.ok) {
    throw new Error(`Could not set file through browser DataTransfer: ${applied?.reason || "unknown"}`);
  }
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
  return "application/octet-stream";
}

async function selectPreset(client, patterns, searchText = "") {
  await clickButtonIfPresent(
    client,
    [/All presets/i, /Show all presets/i, /More presets/i, /Show\s+\d+\s+more presets/i],
    [],
  ).catch(() => null);
  await waitForValue(
    client,
    () => `(() => Boolean(document.querySelector('input[type="search"][placeholder*="presets"]')) || /All presets/i.test(document.body?.innerText || ""))()`,
    2_500,
    Boolean,
  ).catch(() => delay(500));
  for (const pattern of patterns) {
    const clicked = await clickButtonIfPresent(
      client,
      [pattern],
      [/Show fewer/i, /Filter presets/i, /Pin preset/i],
    ).catch(() => null);
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
        const clicked = await clickButtonIfPresent(
          client,
          [pattern],
          [/Show fewer/i, /Filter presets/i, /Pin preset/i],
        ).catch(() => null);
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
  })()`);
}

async function clickConvert(client) {
  const clicked = await clickButtonIfPresent(client, [/^Convert\b/i, /^Create\b/i], [/Update/i]);
  if (!clicked) throw new Error("Could not find enabled Convert button.");
  return clicked;
}

async function settleInitialAutoConversion(client, settleTimeoutMs) {
  const state = await waitForValue(
    client,
    () => outputStateExpression(null),
    6_000,
    (value) => value?.activeJobs > 0 || value?.latestReady || value?.latestFailed,
  ).catch(() => outputState(client).catch(() => null));
  if (!state?.activeJobs) return { settled: true, reason: "idle" };
  return waitForTerminalOutput(client, state.latestStamp, settleTimeoutMs);
}

async function waitForTerminalOutput(client, previousLatestStamp, waitTimeoutMs) {
  return waitForValue(
    client,
    () => outputStateExpression(previousLatestStamp),
    waitTimeoutMs,
    (state) =>
      (state?.latestReady || state?.latestFailed) &&
      !state?.activeJobs &&
      (state?.latestChanged || Number(state?.latestSvgBytes || 0) > 0),
  );
}

async function outputState(client) {
  return evaluate(client, outputStateExpression(null));
}

function outputStateExpression(previousLatestStamp) {
  return `(() => {
    const cards = Array.from(document.querySelectorAll("[data-output-stamp]"));
    const latest = latestCard(cards);
    const latestStamp = latest ? numberOrNull(latest.getAttribute("data-output-stamp")) : null;
    const activeJobs = cards.filter(isActiveCard).length;
    const latestFailed = Boolean(latest) && isFailedCard(latest);
    const latestReady = Boolean(latest) &&
      !isActiveCard(latest) &&
      !latestFailed &&
      Boolean(latest.querySelector("[data-output-primary-action], [data-output-action-row='true'] button")) &&
      numberOrNull(latest.getAttribute("data-svg-bytes")) !== null;
    return {
      outputCards: cards.length,
      activeJobs,
      latestStamp,
      latestReady,
      latestFailed,
      latestChanged: ${previousLatestStamp == null ? "true" : `latestStamp !== ${JSON.stringify(previousLatestStamp)}`},
      latestJobStatus: latest ? latest.getAttribute("data-job-status") || null : null,
      latestEngineUsed: latest ? latest.getAttribute("data-engine-used") || null : null,
      latestSvgBytes: latest ? numberOrNull(latest.getAttribute("data-svg-bytes")) : null,
      latestOutputTitle: latest ? outputTitle(latest) : "",
      latestFailureText: latest && latestFailed ? (latest.innerText || latest.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 800) : "",
      latestBodyText: latest ? (latest.innerText || latest.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 1600) : "",
    };
    function isActiveCard(card) {
      if (/queued|running/i.test(card.getAttribute("data-job-status") || "")) return true;
      if (numberOrNull(card.getAttribute("data-svg-bytes")) !== null) return false;
      return /\\b(Queued|Running|Converting|Creating|Building|Preparing)\\b/i.test(card.textContent || "");
    }
    function isFailedCard(card) {
      return /failed|canceled/i.test(card.getAttribute("data-job-status") || "") ||
        /\\b(Conversion did not finish|Conversion failed|Failed|Canceled)\\b/i.test(card.textContent || "");
    }
    function outputTitle(card) {
      const texts = Array.from(card.querySelectorAll("p, span, strong, h2, h3"))
        .map((element) => (element.textContent || "").replace(/\\s+/g, " ").trim())
        .filter(Boolean);
      return texts.find((text) => /^Editing\\s+Output\\b/i.test(text)) ||
        texts.find((text) => /^Output\\s*[-0-9]/i.test(text)) ||
        texts.find((text) => /^Output\\b/i.test(text)) ||
        texts[0] ||
        "";
    }
    ${browserLatestCardHelpers()}
  })()`;
}

async function openLatestSettingsPanel(client) {
  await clickButtonInLatestOutput(
    client,
    [/Settings\s*\/\s*Edit/i, /\bSettings\b/i],
    [/Download/i, /Copy/i],
  );
  return waitForValue(
    client,
    () => `(() => {
      const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
      if (!latest) return { open: false };
      const text = latest.innerText || "";
      const controls = latest.querySelectorAll('input[aria-label$=" hex color"], [data-post-processing-controls="true"], [data-settings-section], [data-layer-color-total-count]');
      const liveTop = latest.querySelector('[data-settings-top-section-tone="live"]');
      const convertTop = latest.querySelector('[data-settings-top-section-tone="convert"]');
      const topSections = Array.from(latest.querySelectorAll('[data-settings-top-section-tone]'));
      const openSettingsSections = Array.from(latest.querySelectorAll('[data-settings-section-open="true"]'));
      return {
        open: controls.length > 0 || /Advanced settings|Layer colors|Output polish/i.test(text),
        controls: controls.length,
        openSettingsSectionCount: openSettingsSections.length,
        topLevelSettings: {
          count: topSections.length,
          liveOpen: liveTop?.getAttribute("data-settings-top-section-open") === "true",
          convertOpen: convertTop?.getAttribute("data-settings-top-section-open") === "true",
        },
      };
      ${browserLatestCardHelpers()}
    })()`,
    12_000,
    (value) => value?.open,
  );
}

async function seedStaleSettingsTopLevelStorage(client) {
  return evaluate(client, `(() => {
    try {
      const stalePayload = JSON.stringify({
        live: false,
        convert: false,
        liveTopOpen: false,
        convertTopOpen: false,
        topSections: { live: false, convert: false },
      });
      const keys = [
        "ilovesvg:settings-top-level:v1",
        "ilovesvg:advanced-settings-top-level:v1",
        "ilovesvg:settings:top-sections",
        "advanced-settings-top-sections",
        "ilovesvg.settings.topSections",
      ];
      for (const key of keys) localStorage.setItem(key, stalePayload);
      return { seeded: true, keys, payloadBytes: stalePayload.length };
    } catch (error) {
      return { seeded: false, error: error instanceof Error ? error.message : String(error) };
    }
  })()`);
}

async function waitForRouteDocument(client, expectedUrlPrefix) {
  return waitForValue(
    client,
    () => `(() => ({ href: location.href, readyState: document.readyState }))()`,
    30_000,
    (state) =>
      typeof state?.href === "string" &&
      state.href.startsWith(expectedUrlPrefix) &&
      (state.readyState === "interactive" || state.readyState === "complete"),
  );
}

async function ensureSettingsSectionOpen(client, titlePattern, expectedKind) {
  const source = titlePattern.source;
  const result = await evaluate(client, `(() => {
    const pattern = new RegExp(${JSON.stringify(source)}, "i");
    const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
    if (!latest) return { ok: false, reason: "missing latest output card" };
    if (latest.querySelector("[data-layer-color-total-count]")) {
      return { ok: true, reason: "layer color metadata already present" };
    }
    const text = (latest.innerText || latest.textContent || "").replace(/\\s+/g, " ").trim();
    if (/Layer colors|Edit SVG layers/i.test(text) && latest.querySelector('input[type="color"]')) {
      return { ok: true, reason: "route-local layer color controls are visible" };
    }
    const buttons = Array.from(latest.querySelectorAll("button, summary"));
    const button = buttons.find((candidate) => {
      const text = (candidate.innerText || candidate.textContent || candidate.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
      return pattern.test(text) && isVisible(candidate);
    });
    if (!button) return { ok: false, reason: "section button not found", expected: ${JSON.stringify(expectedKind)} };
    if (button.getAttribute("aria-expanded") !== "true") {
      button.scrollIntoView({ block: "center", inline: "nearest" });
      button.click();
    }
    return { ok: true };
    ${browserVisibleHelpers()}
    ${browserLatestCardHelpers()}
  })()`);
  await delay(350);
  return result;
}

async function collectUi(client) {
  return evaluate(client, `(() => {
    const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
    if (!latest) return null;
    const layerSection = latest.querySelector("[data-layer-color-total-count]");
    const outputTitle = outputTitleFromCard(latest);
    const fileSizeText = latest.querySelector("[data-output-file-size='true']")?.textContent || "";
    const sourceFile = latest.querySelector("[data-output-source-file]")?.getAttribute("data-output-source-file") || "";
    const previewImage = Array.from(latest.querySelectorAll("img")).find((image) => /svg|result|output/i.test(image.alt || "") || image.src);
    const imageSrc = previewImage?.getAttribute("src") || "";
    return {
      outputTitle,
      engineUsed: latest.getAttribute("data-engine-used") || null,
      svgBytesAttr: numberOrNull(latest.getAttribute("data-svg-bytes")),
      pathCount: numberOrNull(latest.getAttribute("data-path-count")),
      fileSizeText,
      sourceFile,
      layerTotalCount: numberOrNull(layerSection?.getAttribute("data-layer-color-total-count")),
      layerMountedCount: numberOrNull(layerSection?.getAttribute("data-layer-color-mounted-count")),
      preview: {
        visible: Boolean(previewImage && isVisible(previewImage)),
        srcKind: imageSrc.startsWith("blob:") ? "blob" : imageSrc.startsWith("data:") ? "data" : imageSrc ? "other" : "",
      },
      dimensions: (() => {
        const text = latest.innerText || "";
        const match = text.match(/(\\d+)\\s*x\\s*(\\d+)\\s*px/i);
        return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
      })(),
    };
    function outputTitleFromCard(card) {
      const texts = Array.from(card.querySelectorAll("p, span, strong, h2, h3"))
        .map((element) => (element.textContent || "").replace(/\\s+/g, " ").trim())
        .filter(Boolean);
      return texts.find((text) => /^Editing\\s+Output\\b/i.test(text)) ||
        texts.find((text) => /^Output\\s*[-0-9]/i.test(text)) ||
        texts.find((text) => /^Output\\b/i.test(text)) ||
        texts[0] ||
        "";
    }
    ${browserVisibleHelpers()}
    ${browserLatestCardHelpers()}
  })()`);
}

async function verifyClipboardAccess(client) {
  await client.send("Page.bringToFront").catch(() => {});
  await client.send("Browser.grantPermissions", {
    origin: baseUrl,
    permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  }).catch(() => {});
  await evaluate(
    client,
    `(() => { window.focus(); document.body?.focus?.(); return true; })()`,
  ).catch(() => {});
  return true;
}

async function primeClipboard(client, scenarioId) {
  await verifyClipboardAccess(client);
  const marker = `__converter_route_parity_${scenarioId}_${Date.now()}__`;
  await evaluate(client, `navigator.clipboard.writeText(${JSON.stringify(marker)}).then(() => true)`);
  return clipboardCapture(client);
}

async function clipboardCapture(client) {
  return evaluate(client, clipboardCaptureExpression());
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

async function waitForDownloadedFile(downloadDir, before, waitTimeoutMs) {
  const deadline = Date.now() + waitTimeoutMs;
  let last = [];
  while (Date.now() < deadline) {
    last = await safeReaddir(downloadDir);
    const candidates = last.filter(
      (name) => !before.has(name) && !/\.crdownload$/i.test(name),
    );
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

async function analyzeSvgFile(svgPath) {
  const svg = await fs.readFile(svgPath, "utf8");
  return {
    groupCount: countMatches(svg, /<g\b/gi),
    pathCount: countMatches(svg, /<path\b/gi),
    segmentCount: estimateSegmentCount(svg),
    dimensions: svgDimensions(svg),
  };
}

function estimateSegmentCount(svg) {
  let total = 0;
  for (const match of svg.matchAll(/\sd\s*=\s*(["'])(.*?)\1/gis)) {
    total += countMatches(match[2] || "", /[MLHVCSQTAZ]/gi);
  }
  return total;
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
  })()`);
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
    buttons: 1,
    clickCount: 1,
  });
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.x,
    y: point.y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
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
  await client.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadDir,
  }).catch(() => {});
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadDir,
  }).catch(() => {});
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false,
  }).catch(() => {});
}

async function waitForDocumentReady(client) {
  return waitForValue(
    client,
    () => `(() => ({ href: location.href, readyState: document.readyState }))()`,
    30_000,
    (state) => state?.readyState === "interactive" || state?.readyState === "complete",
  );
}

async function waitForValue(client, expressionFactory, waitTimeoutMs, isReady = Boolean) {
  const deadline = Date.now() + waitTimeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    try {
      last = await evaluate(
        client,
        expressionFactory(),
        Math.min(5_000, Math.max(1_000, deadline - Date.now())),
      );
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

async function evaluate(client, expression, waitTimeoutMs = 12_000) {
  const response = await client.send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    waitTimeoutMs,
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
      if (
        message.method === "Runtime.consoleAPICalled" &&
        /error|warning/i.test(message.params?.type || "")
      ) {
        this.consoleErrors.push({
          type: message.params.type,
          text: (message.params.args || [])
            .map((arg) => arg.value || arg.description || "")
            .join(" ")
            .slice(0, 500),
        });
      }
      if (
        message.method === "Log.entryAdded" &&
        /error|warning/i.test(message.params?.entry?.level || "")
      ) {
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
  send(method, params = {}, waitTimeoutMs = 15_000) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, waitTimeoutMs);
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
  if (!response.ok) {
    throw new Error(`CDP request failed: ${response.status} ${await response.text()}`);
  }
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

function waitForEvent(client, method, waitTimeoutMs = 5_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`Timed out waiting for ${method}`));
    }, waitTimeoutMs);
    timeout.unref?.();
    const unsubscribe = client.onEvent((message) => {
      if (message.method !== method) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(message);
    });
  });
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

async function writeReport(report) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function slug(value) {
  return String(value || "home").replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "home";
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
