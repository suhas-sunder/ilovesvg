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
const debugPort = Number(process.env.CDP_PORT || 9600 + Math.floor(Math.random() * 300));
const tmpDir = path.join(os.tmpdir(), "ilovesvg-post-conversion-editability", String(debugPort));
const profileDir = path.join(tmpDir, "profile");
const fixturesDir = path.join(tmpDir, "fixtures");
const downloadsDir = path.join(tmpDir, "downloads");
const reportPath = process.env.POST_CONVERSION_EDITABILITY_REPORT_PATH
  ? path.resolve(process.env.POST_CONVERSION_EDITABILITY_REPORT_PATH)
  : path.join(rootDir, "tmp", "post-conversion-editability-smoke.json");
const userFixturePath =
  process.env.POST_CONVERSION_EDITABILITY_FIXTURE ||
  "C:\\Users\\Suhas\\Downloads\\Screenshot 2026-05-06 194041.png";

const thresholds = {
  settingsOpenMs: Number(process.env.POST_CONVERSION_SETTINGS_OPEN_MS || 1500),
  colorEditMs: Number(process.env.POST_CONVERSION_COLOR_EDIT_MS || 1000),
  sliderEditMs: Number(process.env.POST_CONVERSION_SLIDER_EDIT_MS || 1000),
  copyMs: Number(process.env.POST_CONVERSION_COPY_MS || 1500),
  downloadMs: Number(process.env.POST_CONVERSION_DOWNLOAD_MS || 1500),
};

const scenarioFilter = process.env.POST_CONVERSION_ROUTE_FILTER || "";

const scenarios = [
  {
    id: "home-layered-flat-color",
    route: "/",
    routeFamily: "homepage/universal",
    panelComponent: "route-local home output panel with shared output appearance controls",
    settingsComponent: "TraceAdvancedSettingsPanel + OutputAppearanceControls",
    outputPathKind: "route-local-home",
    fixtureKind: "source",
    selectPresetBeforeUpload: false,
    settleInitialAutoBeforePreset: true,
    presetPatterns: [
      /^Layered - Flat Color\b/i,
    ],
    expectedOutputPatterns: [/Layered/i, /color/i],
    expectedOutputDescription: "Layered - Flat Color",
    conversionTimeoutMs: 240_000,
  },
  {
    id: "png-layered-flat-color",
    route: "/png-to-layered-svg-for-cricut",
    routeFamily: "layered-svg",
    panelComponent: "route-local PNG layered output panel",
    settingsComponent: "LayeredAdvancedSettingsPanel + OutputAppearanceControls",
    outputPathKind: "route-local-layered",
    fixtureKind: "source",
    presetPatterns: [
      /^Layered - Flat Color\b/i,
    ],
    expectedOutputPatterns: [/Layered/i, /color/i],
    expectedOutputDescription: "Layered - Flat Color",
    conversionTimeoutMs: 240_000,
  },
  {
    id: "jpg-layered-flat-color",
    route: "/jpg-to-layered-svg-for-cricut",
    routeFamily: "layered-svg",
    panelComponent: "BespokeTraceOutputPanel",
    settingsComponent: "LayeredAdvancedSettingsPanel + OutputAppearanceControls",
    outputPathKind: "bespoke-layered",
    fixtureKind: "jpg",
    presetPatterns: [
      /^Layered - Flat Color\b/i,
    ],
    expectedOutputPatterns: [/Layered/i, /color/i],
    expectedOutputDescription: "Layered - Flat Color",
    conversionTimeoutMs: 240_000,
  },
  {
    id: "png-generic-logo-clean",
    route: "/png-to-svg-converter",
    routeFamily: "generic raster-to-SVG",
    panelComponent: "TraceOutputPanel",
    settingsComponent: "TraceAdvancedSettingsPanel + OutputAppearanceControls",
    outputPathKind: "shared-trace-output-panel",
    fixtureKind: "representativePng",
    useCurrentPreset: true,
    waitForAutoConversion: true,
    presetPatterns: [],
    expectedOutputPatterns: [],
    expectedOutputDescription: "Lineart - Accurate default",
    conversionTimeoutMs: 180_000,
  },
  {
    id: "png-cricut-sticker-default",
    route: "/png-to-svg-for-cricut-stickers",
    routeFamily: "cricut/craft raster-to-SVG",
    panelComponent: "BespokeTraceOutputPanel",
    settingsComponent: "route-local StickerSettingsFields + OutputAppearanceControls",
    outputPathKind: "bespoke-sticker",
    fixtureKind: "representativePng",
    selectPresetBeforeUpload: false,
    presetPatterns: [
      /^Sticker - White Border\b/i,
      /^Sticker - Clean Edge\b/i,
    ],
    expectedOutputPatterns: [],
    expectedOutputDescription: "Sticker - White Border",
    conversionTimeoutMs: 180_000,
  },
  {
    id: "svg-cleaner-route-local",
    route: "/svg-cleaner",
    routeFamily: "SVG cleanup/pass-through/editor",
    panelComponent: "route-local SVG cleaner output",
    settingsComponent: "route-local Cleaner Settings",
    outputPathKind: "route-local-svg-cleaner",
    scenarioKind: "svg-cleaner",
    fixtureKind: "svg",
    presetPatterns: [],
    expectedOutputPatterns: [],
    expectedOutputDescription: "Normal cleanup",
    conversionTimeoutMs: 30_000,
    settingsEditExpectation: "route-local-settings-no-shared-output-card",
  },
  {
    id: "code-to-svg-bespoke-sample",
    route: "/code-to-svg-for-cricut",
    routeFamily: "bespoke text/base64/code output",
    panelComponent: "BespokeTraceOutputPanel",
    settingsComponent: "route-local code settings + OutputAppearanceControls",
    outputPathKind: "bespoke-code",
    scenarioKind: "code-sample",
    fixtureKind: "route-sample",
    waitForAutoConversion: true,
    presetPatterns: [
      /^Logo - Clean shapes\b/i,
      /^Lineart - Accurate\b/i,
    ],
    expectedOutputPatterns: [],
    expectedOutputDescription: "Code sample SVG",
    conversionTimeoutMs: 120_000,
    allowNoEditTarget: true,
  },
].filter(
  (scenario) =>
    !scenarioFilter ||
    scenario.id === scenarioFilter ||
    scenario.route === scenarioFilter,
);

async function main() {
  if (scenarios.length === 0) {
    throw new Error(
      `No post-conversion editability scenarios selected by POST_CONVERSION_ROUTE_FILTER=${JSON.stringify(scenarioFilter)}.`,
    );
  }
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.mkdir(downloadsDir, { recursive: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  const [server, git, fixture] = await Promise.all([
    serverState(),
    gitState(),
    prepareFixture(),
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

  const results = [];
  try {
    await waitForCdp();
    for (const scenario of scenarios) {
      console.error(`[post-conversion-editability] ${scenario.id}`);
      const result = await runScenario(scenario, fixture);
      results.push(result);
      console.error(
        `[post-conversion-editability] ${scenario.id}: settings=${formatMs(result.postConversion?.settingsOpenMs)} color=${formatMs(result.postConversion?.colorEditMs)} slider=${formatMs(result.postConversion?.sliderEditMs)} ok=${result.ok}`,
      );
    }
  } finally {
    browser.kill();
  }

  const report = {
    schemaVersion: 1,
    benchmarkKind: "post-conversion-editability",
    baseUrl,
    checkedAt: new Date().toISOString(),
    browserPath,
    debugPort,
    thresholds,
    server,
    git,
    fixture: fixture.source.info,
    fixtureVariants: {
      source: fixture.source.info,
      jpg: fixture.jpg.info,
      svg: fixture.svg.info,
      representativePng: fixture.representativePng.info,
    },
    routes: results,
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  const failures = results.filter((result) => !result.ok);
  if (failures.length > 0) {
    process.exit(1);
  }
}

async function runScenario(scenario, fixture) {
  const scenarioFixture =
    scenario.fixtureKind === "jpg" && fixture.jpg
      ? fixture.jpg
      : scenario.fixtureKind === "svg" && fixture.svg
        ? fixture.svg
        : scenario.fixtureKind === "representativePng" && fixture.representativePng
          ? fixture.representativePng
      : fixture.source;
  const client = await openTab(`${baseUrl}${scenario.route}`);
  const consoleErrors = [];
  const pageErrors = [];
  const downloads = [];
  const actionLog = [];
  const failures = [];
  let cdpTimeout = false;

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
    }
    if (message.method === "Log.entryAdded") {
      const entry = message.params?.entry;
      if (entry?.level === "error") consoleErrors.push(entry.text || "Browser log error");
    }
    if (message.method === "Page.downloadWillBegin") {
      downloads.push(message.params?.suggestedFilename || "download");
    }
  });

  const timed = async (name, fn) => {
    const started = performance.now();
    try {
      const value = await fn();
      const elapsedMs = performance.now() - started;
      actionLog.push({ step: name, ok: true, elapsedMs, value });
      return { ok: true, elapsedMs, value };
    } catch (error) {
      const elapsedMs = performance.now() - started;
      const message = error instanceof Error ? error.message : String(error);
      if (/CDP command timed out/i.test(message)) cdpTimeout = true;
      actionLog.push({ step: name, ok: false, elapsedMs, error: message });
      return { ok: false, elapsedMs, error: message };
    }
  };

  try {
    await enablePage(client);
    await configureDownloads(client);
    await waitForDocumentReady(client);
    await installObservers(client);
    await installClipboardCapture(client);

    if (scenario.scenarioKind === "svg-cleaner") {
      return await runSvgCleanerScenario({
        scenario,
        client,
        timed,
        scenarioFixture,
        failures,
        consoleErrors,
        pageErrors,
        downloads,
        actionLog,
        getCdpTimeout: () => cdpTimeout,
      });
    }

    const initial = await collectMetrics(client);
    let preset =
      scenario.useCurrentPreset
        ? {
            ok: true,
            elapsedMs: 0,
            value: {
              selected: scenario.expectedOutputDescription || "current/default preset",
              skipped: true,
            },
          }
        : scenario.selectPresetBeforeUpload === false
          ? { ok: true, elapsedMs: 0, value: { selected: null, skipped: true } }
        : await timed("select heavy layered preset before upload", () =>
            selectPreset(client, scenario.presetPatterns),
          );
    const upload = await timed("prepare input", async () =>
      prepareScenarioInput(client, scenario, scenarioFixture),
    );
    const afterUpload = await collectMetrics(client);
    const preliminaryAutoOutput =
      upload.ok && scenario.settleInitialAutoBeforePreset
        ? await timed("settle initial auto conversion before layered preset", () =>
            settleInitialAutoConversion(client, scenario.expectedOutputPatterns, 150_000),
          )
        : null;
    if (!preset.value?.selected && !scenario.useCurrentPreset) {
      preset = await timed("select heavy layered preset after upload", () =>
        selectPreset(client, scenario.presetPatterns),
      );
    }
    const beforeConvert = await collectMetrics(client);
    const outputBefore = await outputState(client);
    const conversionStartTime = new Date().toISOString();

    if (!upload.ok) failures.push(`upload failed: ${upload.error}`);
    if (!preset.ok || (!preset.value?.selected && !scenario.useCurrentPreset)) {
      failures.push(`heavy layered preset not selected: ${preset.error || preset.value?.reason || "unknown"}`);
    }
    const startConversion =
      upload.ok && preset.ok && scenario.waitForAutoConversion
        ? {
            ok: true,
            elapsedMs: 0,
            value: { clicked: false, reason: "waiting for route auto-conversion after upload" },
          }
        : upload.ok && preset.ok && preset.value?.selected
          ? await timed("start conversion", () => clickConvert(client))
        : {
            ok: false,
            elapsedMs: 0,
            error: "Skipped because upload or preset selection failed.",
            value: null,
          };
    if (!startConversion.ok) failures.push(`conversion did not start: ${startConversion.error}`);
    const completed =
      upload.ok && startConversion.ok
        ? await timed("wait for completed output", () =>
            waitForCompletedOutput(client, outputBefore.latestStamp, scenario.conversionTimeoutMs),
          )
        : {
            ok: false,
            elapsedMs: 0,
            error: "Skipped because upload or conversion start failed.",
            value: null,
          };
    const conversionCompletedTime = new Date().toISOString();
    const afterConversion = await collectMetrics(client);

    if (!completed.ok || !completed.value?.completed) {
      failures.push(`conversion did not complete: ${completed.error || completed.value?.reason || "unknown"}`);
    } else if (!completedMatchesScenario(completed.value, scenario.expectedOutputPatterns)) {
      failures.push(
        `completed output did not match ${scenario.expectedOutputDescription || "expected preset"}: ${completed.value?.latestText || "no output text"}`,
      );
    }

    let postConversion = null;
    if (completed.ok && completed.value?.completed) {
      await clearPhaseLongTasks(client, "post-conversion-edit");
      postConversion = await runPostConversionEditFlow(client, timed);
      if (!postConversion.settingsOpened) failures.push("Settings/Edit did not open on the completed output.");
      if (postConversion.colorApplicable && !postConversion.colorChanged) failures.push("Layer/fill color edit did not visibly apply.");
      if (postConversion.sliderApplicable && !postConversion.sliderChanged) failures.push("Slider edit did not visibly apply.");
      if (!postConversion.colorApplicable && !postConversion.sliderApplicable && !scenario.allowNoEditTarget) {
        failures.push("No relevant color, fill, stroke, or range edit target was available.");
      }
      if (!postConversion.copyMatchedEditedOutput) failures.push("Copy did not match the edited output.");
      if (!postConversion.downloadMatchedEditedOutput) failures.push("Download did not match the edited output.");
      if (postConversion.copyTimeMs > thresholds.copyMs) {
        failures.push(
          `Copy took ${Math.round(postConversion.copyTimeMs)} ms, threshold ${thresholds.copyMs} ms.`,
        );
      }
      if (postConversion.downloadTimeMs > thresholds.downloadMs) {
        failures.push(
          `Download took ${Math.round(postConversion.downloadTimeMs)} ms, threshold ${thresholds.downloadMs} ms.`,
        );
      }
      if (postConversion.settingsOpenMs > thresholds.settingsOpenMs) {
        failures.push(
          `Settings/Edit open took ${Math.round(postConversion.settingsOpenMs)} ms, threshold ${thresholds.settingsOpenMs} ms.`,
        );
      }
      if (postConversion.colorApplicable && postConversion.colorEditMs > thresholds.colorEditMs) {
        failures.push(
          `Color edit took ${Math.round(postConversion.colorEditMs)} ms, threshold ${thresholds.colorEditMs} ms.`,
        );
      }
      if (postConversion.sliderApplicable && postConversion.sliderEditMs > thresholds.sliderEditMs) {
        failures.push(
          `Slider edit took ${Math.round(postConversion.sliderEditMs)} ms, threshold ${thresholds.sliderEditMs} ms.`,
        );
      }
      if (!postConversion.pageRemainedResponsive) failures.push("Page did not remain responsive after editing.");
    }

    const final = await collectMetrics(client).catch((error) => ({
      pageAlive: false,
      error: error instanceof Error ? error.message : String(error),
    }));
    if (cdpTimeout || final.pageAlive === false) {
      failures.push("Page became unresponsive or a CDP timeout occurred.");
    }

    return {
      id: scenario.id,
      route: scenario.route,
      routeFamily: scenario.routeFamily,
      panelComponent: scenario.panelComponent,
      settingsComponent: scenario.settingsComponent,
      outputPathKind: scenario.outputPathKind,
      settingsEditExpectation: scenario.settingsEditExpectation || "shared-settings-edit",
      ok: failures.length === 0,
      failures,
      fixture: scenarioFixture.info,
      presetUsed: preset.value?.selected || null,
      conversionStartTime,
      conversionCompletedTime,
      conversionDurationMs:
        completed.ok && completed.value?.elapsedSinceStartMs
          ? completed.value.elapsedSinceStartMs
          : completed.elapsedMs,
      outputBefore,
      preliminaryAutoOutput: preliminaryAutoOutput?.value || null,
      initial,
      afterUpload,
      beforeConvert,
      afterConversion,
      completedOutput: completed.value || null,
      pendingReplacementStatus: {
        latestJobStatus: afterConversion.latestOutput?.jobStatus || completed.value?.latestJobStatus || null,
        activeJobs: afterConversion.activeJobs ?? completed.value?.activeJobs ?? null,
        completedOutputRemainedPending: Boolean(
          afterConversion.activeJobs || /queued|running/i.test(String(afterConversion.latestOutput?.jobStatus || "")),
        ),
      },
      postConversion,
      consoleErrors,
      pageErrors,
      downloads,
      cdpTimeout,
      final,
      actionLog,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      id: scenario.id,
      route: scenario.route,
      routeFamily: scenario.routeFamily,
      panelComponent: scenario.panelComponent,
      settingsComponent: scenario.settingsComponent,
      outputPathKind: scenario.outputPathKind,
      settingsEditExpectation: scenario.settingsEditExpectation || "shared-settings-edit",
      ok: false,
      failures: [message],
      fixture: scenarioFixture.info,
      consoleErrors,
      pageErrors,
      downloads,
      cdpTimeout: true,
      fatal: message,
      final: await collectMetrics(client).catch(() => ({ pageAlive: false })),
      actionLog,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function runSvgCleanerScenario({
  scenario,
  client,
  timed,
  scenarioFixture,
  failures,
  consoleErrors,
  pageErrors,
  downloads,
  actionLog,
  getCdpTimeout,
}) {
  const initial = await collectSvgCleanerMetrics(client);
  const input = await timed("load SVG cleaner example", async () => {
    await delay(1_200);
    await clickSvgCleanerLoadExample(client);
    const firstOutput = await waitForSvgCleanerOutput(client, 8_000).catch(() => null);
    if (firstOutput) return firstOutput;
    await delay(800);
    await clickSvgCleanerLoadExample(client);
    return waitForSvgCleanerOutput(client, scenario.conversionTimeoutMs);
  });
  if (!input.ok || !input.value?.hasOutput) {
    failures.push(`SVG cleaner output did not appear: ${input.error || input.value?.reason || "unknown"}`);
  }
  const afterConversion = await collectSvgCleanerMetrics(client);
  if (afterConversion.fakeSettingsEditControls > 0) {
    failures.push("SVG cleaner exposes a shared Settings/Edit output control despite using route-local cleanup settings.");
  }

  let postConversion = null;
  if (input.ok && input.value?.hasOutput) {
    await clearPhaseLongTasks(client, "post-conversion-edit");
    postConversion = await runSvgCleanerEditFlow(client, timed);
    if (!postConversion.settingsOpened) failures.push("Route-local SVG cleaner settings did not open.");
    if (!postConversion.editChangedOutput) failures.push("SVG cleaner setting edit did not change output.");
    if (!postConversion.copyMatchedCurrentOutput) failures.push("SVG cleaner copy did not match the current output.");
    if (!postConversion.downloadMatchedCurrentOutput) failures.push("SVG cleaner download did not match the current output.");
    if (postConversion.settingsOpenMs > thresholds.settingsOpenMs) {
      failures.push(
        `Route-local settings open took ${Math.round(postConversion.settingsOpenMs)} ms, threshold ${thresholds.settingsOpenMs} ms.`,
      );
    }
    if (postConversion.editApplyMs > thresholds.colorEditMs) {
      failures.push(
        `SVG cleaner edit took ${Math.round(postConversion.editApplyMs)} ms, threshold ${thresholds.colorEditMs} ms.`,
      );
    }
    if (postConversion.copyTimeMs > thresholds.copyMs) {
      failures.push(
        `SVG cleaner copy took ${Math.round(postConversion.copyTimeMs)} ms, threshold ${thresholds.copyMs} ms.`,
      );
    }
    if (postConversion.downloadTimeMs > thresholds.downloadMs) {
      failures.push(
        `SVG cleaner download took ${Math.round(postConversion.downloadTimeMs)} ms, threshold ${thresholds.downloadMs} ms.`,
      );
    }
    if (!postConversion.pageRemainedResponsive) failures.push("SVG cleaner page did not remain responsive after editing.");
  }

  const final = await collectSvgCleanerMetrics(client).catch((error) => ({
    pageAlive: false,
    error: error instanceof Error ? error.message : String(error),
  }));
  if (getCdpTimeout() || final.pageAlive === false) {
    failures.push("Page became unresponsive or a CDP timeout occurred.");
  }

  return {
    id: scenario.id,
    route: scenario.route,
    routeFamily: scenario.routeFamily,
    panelComponent: scenario.panelComponent,
    settingsComponent: scenario.settingsComponent,
    outputPathKind: scenario.outputPathKind,
    settingsEditExpectation: scenario.settingsEditExpectation,
    ok: failures.length === 0,
    failures,
    fixture: scenarioFixture.info,
    presetUsed: scenario.expectedOutputDescription,
    conversionStartTime: null,
    conversionCompletedTime: new Date().toISOString(),
    conversionDurationMs: input.elapsedMs,
    outputBefore: null,
    initial,
    afterUpload: input.value || null,
    beforeConvert: null,
    afterConversion,
    completedOutput: input.value || null,
    pendingReplacementStatus: {
      latestJobStatus: null,
      activeJobs: 0,
      completedOutputRemainedPending: false,
    },
    postConversion,
    consoleErrors,
    pageErrors,
    downloads,
    cdpTimeout: getCdpTimeout(),
    final,
    actionLog,
  };
}

async function prepareScenarioInput(client, scenario, scenarioFixture) {
  if (scenario.scenarioKind === "code-sample") {
    await delay(1_200);
    const clicked = await clickCodeLoadSample(client);
    let accepted = await waitForCodeSampleAccepted(client, 8_000).catch(() => null);
    if (!accepted) {
      await delay(800);
      await clickCodeLoadSample(client);
      accepted = await waitForCodeSampleAccepted(client, 20_000);
    }
    return {
      ok: true,
      mode: "route-sample",
      clicked,
      ...accepted,
    };
  }

  await setFileInput(client, scenarioFixture.path);
  return waitForUploadAccepted(client, path.basename(scenarioFixture.path), 30_000);
}

async function runPostConversionEditFlow(client, timed) {
  const settings = await timed("open Settings/Edit immediately after conversion", () =>
    openSettingsOnLatestOutput(client),
  );
  const afterSettings = await collectMetrics(client);
  const expand = await timed("open live layer controls", () => openLayerControls(client));
  const beforeColorSvg = await latestFocusedPreviewSvg(client).catch(() => "");
  const color = await timed("change layer/fill color", () => changeFirstEditableColor(client));
  const colorApplicable = !(
    !color.ok &&
    /no visible color input/i.test(String(color.error || ""))
  );
  const colorApplied = colorApplicable && color.ok
    ? await timed("wait color edit visible", () =>
        waitForPreviewToContain(client, color.value?.after, beforeColorSvg, 8_000),
      )
    : { ok: false, elapsedMs: 0, error: color.error };
  const afterColorSvg = await latestFocusedPreviewSvg(client).catch(() => "");
  const slider = await timed("move opacity/range slider", () =>
    moveFirstEditableSlider(client, afterColorSvg),
  );
  const sliderApplicable = !(
    !slider.ok &&
    /no visible range input/i.test(String(slider.error || ""))
  );
  const sliderApplied = sliderApplicable && slider.ok
    ? await timed("wait slider edit visible", () =>
        waitForPreviewChange(client, afterColorSvg, 8_000),
      )
    : { ok: false, elapsedMs: 0, error: slider.error };
  const finalPreviewSvg = await latestFocusedPreviewSvg(client).catch(() => "");
  const copy = await timed("copy edited output", () =>
    copyEditedOutput(client, finalPreviewSvg, color.value?.after),
  );
  const download = await timed("download edited output", () =>
    downloadEditedOutput(client, finalPreviewSvg, color.value?.after),
  );
  const heartbeat = await timed("post-edit heartbeat", () =>
    evaluate(client, `(() => ({ alive: true, focused: Boolean(document.querySelector('[data-focused-editor-workspace="true"]')) }))()`),
  );
  const afterEdit = await collectMetrics(client);

  return {
    settingsOpened: Boolean(settings.ok && settings.value?.panelVisible),
    settingsOpenMs: settings.elapsedMs,
    visibleSettingsPanelDetection: settings.value || null,
    layerControlOpenMs: expand.elapsedMs,
    layerControlsVisible: Boolean(expand.ok && expand.value?.opened),
    colorApplicable,
    colorNotApplicableReason: colorApplicable ? null : color.error,
    colorChanged: Boolean(colorApplicable && color.ok && colorApplied.ok && color.value?.changed),
    colorEditMs: colorApplicable ? color.elapsedMs + colorApplied.elapsedMs : null,
    colorBefore: color.value?.before || null,
    colorAfter: color.value?.after || null,
    colorApplyResult: colorApplied.value || colorApplied.error || null,
    sliderApplicable,
    sliderNotApplicableReason: sliderApplicable ? null : slider.error,
    sliderChanged: Boolean(sliderApplicable && slider.ok && sliderApplied.ok && slider.value?.moved),
    sliderEditMs:
      sliderApplicable
        ? (slider.value?.effectiveElapsedMs ?? slider.elapsedMs) + sliderApplied.elapsedMs
        : null,
    sliderMoveMs: sliderApplicable ? (slider.value?.effectiveElapsedMs ?? slider.elapsedMs) : null,
    sliderPreviewWaitMs: sliderApplicable ? sliderApplied.elapsedMs : null,
    sliderBefore: slider.value?.before ?? null,
    sliderAfter: slider.value?.after ?? null,
    sliderLabel: slider.value?.sliderLabel ?? null,
    sliderApplyResult: sliderApplied.value || sliderApplied.error || null,
    copyTimeMs: copy.elapsedMs,
    copyMatchedEditedColor: Boolean(copy.ok && copy.value?.containsEditedColor),
    copyMatchedEditedOutput: Boolean(copy.ok && copy.value?.matchesExpectedSvg),
    downloadTimeMs: download.elapsedMs,
    downloadMatchedEditedColor: Boolean(download.ok && download.value?.containsEditedColor),
    downloadMatchedEditedOutput: Boolean(download.ok && download.value?.matchesExpectedSvg),
    pageRemainedResponsive: Boolean(heartbeat.ok && heartbeat.value?.alive && afterEdit.pageAlive),
    metricsAfterSettingsOpen: afterSettings,
    metricsAfterEdit: afterEdit,
    postConversionLongTasks: afterEdit.postEditLongTasks,
  };
}

async function runSvgCleanerEditFlow(client, timed) {
  const settings = await timed("open route-local cleaner settings", () =>
    openSvgCleanerSettings(client),
  );
  const afterSettings = await collectSvgCleanerMetrics(client);
  const beforeEdit = await svgCleanerOutputSvg(client);
  const edit = await timed("toggle SVG cleaner title/desc removal", () =>
    toggleSvgCleanerSetting(client),
  );
  const editApplied = edit.ok
    ? await timed("wait SVG cleaner edit visible", () =>
        waitForSvgCleanerOutputChange(client, beforeEdit, 8_000),
      )
    : { ok: false, elapsedMs: 0, error: edit.error };
  const currentOutput = await svgCleanerOutputSvg(client);
  const copy = await timed("copy cleaned SVG", () =>
    copySvgCleanerOutput(client, currentOutput),
  );
  const download = await timed("download cleaned SVG", () =>
    downloadSvgCleanerOutput(client, currentOutput),
  );
  const heartbeat = await timed("post-cleaner-edit heartbeat", () =>
    evaluate(client, `(() => ({ alive: true, hasOutput: Boolean(Array.from(document.querySelectorAll("textarea")).find((textarea) => textarea.readOnly)?.value) }))()`),
  );
  const afterEdit = await collectSvgCleanerMetrics(client);

  return {
    settingsOpened: Boolean(settings.ok && settings.value?.settingsVisible),
    settingsOpenMs: settings.elapsedMs,
    visibleSettingsPanelDetection: settings.value || null,
    editChangedOutput: Boolean(edit.ok && editApplied.ok && edit.value?.changed),
    editApplyMs: edit.elapsedMs + editApplied.elapsedMs,
    editBefore: edit.value?.before ?? null,
    editAfter: edit.value?.after ?? null,
    editApplyResult: editApplied.value || editApplied.error || null,
    copyTimeMs: copy.elapsedMs,
    copyMatchedCurrentOutput: Boolean(copy.ok && copy.value?.matchesCurrentOutput),
    downloadTimeMs: download.elapsedMs,
    downloadMatchedCurrentOutput: Boolean(download.ok && download.value?.matchesCurrentOutput),
    pageRemainedResponsive: Boolean(heartbeat.ok && heartbeat.value?.alive && afterEdit.pageAlive),
    metricsAfterSettingsOpen: afterSettings,
    metricsAfterEdit: afterEdit,
    postConversionLongTasks: afterEdit.postEditLongTasks,
    settingsEditKind: "route-local-svg-cleaner",
    sharedSettingsEditNotApplicable: true,
  };
}

async function clickConvert(client) {
  const clicked = await clickButtonIfPresent(
    client,
    [/^Convert\b/i, /^Create\b/i],
    [/Download/i, /Copy/i, /Settings/i, /ZIP/i],
  );
  if (clicked) return clicked;
  const routeBusy = await routeConversionBusy(client);
  if (routeBusy) return { clicked: false, reason: "conversion already running", routeBusy };
  const state = await outputState(client);
  if (state.activeJobs > 0) return { clicked: false, reason: "conversion already running", state };
  throw new Error("No enabled Convert/Create button found.");
}

async function waitForCompletedOutput(client, previousLatestStamp, timeoutMs) {
  const started = performance.now();
  const completed = await waitForValue(
    client,
    () => outputStateExpression(previousLatestStamp),
    timeoutMs,
    (state) =>
      state?.pageAlive &&
      state.latestReady &&
      state.activeJobs === 0 &&
      state.latestStamp !== null,
  );
  return {
    completed: true,
    elapsedSinceStartMs: performance.now() - started,
    ...completed,
  };
}

async function settleInitialAutoConversion(client, expectedOutputPatterns, timeoutMs) {
  const started = performance.now();
  let state = await waitForValue(
    client,
    () => outputStateExpression(null),
    6_000,
    (value) => value?.pageAlive && (value.activeJobs > 0 || value.outputCards > 0),
  ).catch(() => null);

  if (!state) {
    return { settled: true, reason: "no initial auto conversion observed", elapsedMs: performance.now() - started };
  }

  if (state.activeJobs > 0 && !completedMatchesScenario(state, expectedOutputPatterns)) {
    const completed = await waitForCompletedOutput(client, state.latestStamp, timeoutMs);
    return {
      settled: true,
      reason: "waited for initial non-layered auto conversion",
      elapsedMs: performance.now() - started,
      initialState: state,
      completed,
    };
  }

  return {
    settled: true,
    reason: completedMatchesScenario(state, expectedOutputPatterns)
      ? "initial conversion already matched requested preset"
      : "initial route state idle",
    elapsedMs: performance.now() - started,
    initialState: state,
  };
}

function completedMatchesScenario(completed, patterns = []) {
  if (!patterns.length) return true;
  const text = String(completed?.latestText || "");
  return patterns.every((pattern) => pattern.test(text));
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
  return { selected: null, reason: "No matching heavy layered preset button was visible." };
}

async function waitForCodeSampleAccepted(client, timeoutMs) {
  return waitForValue(
    client,
    () => `(() => {
      const textarea = document.querySelector("textarea");
      const buttons = Array.from(document.querySelectorAll("button"));
      const enabledConvert = buttons.some((button) => {
        const text = button.innerText || button.textContent || "";
        return !button.disabled && /^\\s*Convert to SVG\\b/i.test(text);
      });
      return {
        sampleLoaded: Boolean(textarea && textarea.value.trim().length > 20),
        enabledConvert,
      };
    })()`,
    timeoutMs,
    (value) => value?.sampleLoaded && value?.enabledConvert,
  );
}

async function clickCodeLoadSample(client) {
  return evaluate(client, `(async () => {
    const button = await waitForButton(/^Load sample$/i);
    button.scrollIntoView({ block: "center", inline: "nearest" });
    button.click();
    await nextFrame();
    const textarea = document.querySelector("textarea");
    return {
      label: (button.innerText || button.textContent || "").replace(/\\s+/g, " ").trim(),
      textareaLength: textarea?.value?.length || 0,
    };

    async function waitForButton(pattern) {
      const deadline = performance.now() + 8000;
      while (performance.now() < deadline) {
        const match = Array.from(document.querySelectorAll("button")).find((candidate) => {
          const text = (candidate.innerText || candidate.textContent || "").replace(/\\s+/g, " ").trim();
          return isVisible(candidate) && !candidate.disabled && pattern.test(text);
        });
        if (match) return match;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("Code route Load sample button not found");
    }
    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }
    function nextFrame() {
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
  })()`, 10_000);
}

async function waitForSvgCleanerOutput(client, timeoutMs) {
  return waitForValue(
    client,
    () => svgCleanerOutputStateExpression(),
    timeoutMs,
    (value) => value?.pageAlive && value.hasOutput,
  );
}

async function clickSvgCleanerLoadExample(client) {
  return evaluate(client, `(async () => {
    const button = await waitForButton(/^Load example$/i);
    button.scrollIntoView({ block: "center", inline: "nearest" });
    button.click();
    await nextFrame();
    return {
      label: (button.innerText || button.textContent || "").replace(/\\s+/g, " ").trim(),
      textareaCount: document.querySelectorAll("textarea").length,
    };

    async function waitForButton(pattern) {
      const deadline = performance.now() + 8000;
      while (performance.now() < deadline) {
        const match = Array.from(document.querySelectorAll("button")).find((candidate) => {
          const text = (candidate.innerText || candidate.textContent || "").replace(/\\s+/g, " ").trim();
          return isVisible(candidate) && !candidate.disabled && pattern.test(text);
        });
        if (match) return match;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("SVG cleaner Load example button not found");
    }
    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }
    function nextFrame() {
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
  })()`, 10_000);
}

async function openSvgCleanerSettings(client) {
  const alreadyOpen = await evaluate(client, `(() => {
    const panel = document.getElementById("advanced-settings");
    return Boolean(panel && isVisible(panel));
    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }
  })()`);
  const clicked = alreadyOpen
    ? { label: "Settings already open" }
    : await clickButtonIfPresent(client, [/^Settings$/i], [/Settings\s*\/\s*Edit/i]);
  if (!clicked) throw new Error("SVG cleaner Settings button not found.");
  const visible = await waitForValue(
    client,
    () => `(() => {
      const panel = document.getElementById("advanced-settings");
      return {
        settingsVisible: Boolean(panel && isVisible(panel)),
        fakeSettingsEditControls: Array.from(document.querySelectorAll("button")).filter((button) => /Settings\\s*\\/\\s*Edit/i.test(button.innerText || button.textContent || "")).length,
        visibleCheckboxes: Array.from(panel?.querySelectorAll('input[type="checkbox"]') || []).filter(isVisible).length,
      };
      function isVisible(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && !element.disabled;
      }
    })()`,
    8_000,
    (value) => value?.settingsVisible && value.visibleCheckboxes > 0,
  );
  return { clicked, ...visible };
}

async function toggleSvgCleanerSetting(client) {
  return evaluate(client, `(async () => {
    const panel = document.getElementById("advanced-settings");
    if (!panel) throw new Error("SVG cleaner settings panel missing");
    const labels = Array.from(panel.querySelectorAll("label"));
    const label = labels.find((candidate) =>
      isVisible(candidate) && /Remove\\s*(?:<title>\\s*and\\s*<desc>|title\\s*and\\s*desc)/i.test(candidate.innerText || candidate.textContent || "")
    );
    const input = label?.querySelector('input[type="checkbox"]');
    if (!input) throw new Error("Remove title and desc checkbox not found");
    const before = Boolean(input.checked);
    input.scrollIntoView({ block: "center", inline: "nearest" });
    input.click();
    await nextFrame();
    return { changed: input.checked !== before, before, after: Boolean(input.checked) };
    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && !element.disabled;
    }
    function nextFrame() {
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
  })()`, 8_000);
}

async function waitForSvgCleanerOutputChange(client, previousSvg, timeoutMs) {
  return waitForValue(
    client,
    () => svgCleanerOutputStateExpression(previousSvg),
    timeoutMs,
    (value) => value?.hasOutput && value.changedFromPrevious,
  );
}

async function svgCleanerOutputSvg(client) {
  const state = await evaluate(client, svgCleanerOutputStateExpression(), 8_000);
  return state.outputSvg || "";
}

function svgCleanerOutputStateExpression(previousSvg = "") {
  return `(() => {
    const output = Array.from(document.querySelectorAll("textarea")).find((textarea) => textarea.readOnly);
    const outputSvg = output?.value || "";
    const parsed = outputSvg
      ? new DOMParser().parseFromString(outputSvg, "image/svg+xml")
      : null;
    const longTasks = window.__POST_CONVERSION_EDITABILITY__?.longTasks || [];
    return {
      pageAlive: true,
      hasOutput: Boolean(outputSvg.trim()),
      outputSvg: outputSvg.slice(0, 2_000_000),
      outputByteSize: new Blob([outputSvg]).size,
      pathCount: parsed ? parsed.querySelectorAll("path").length : 0,
      layerCount: parsed ? parsed.querySelectorAll("[data-layer-id], [data-fill-layer-id], [data-stroke-layer-id], g[data-layer-name]").length : 0,
      sharedOutputCards: document.querySelectorAll("[data-output-stamp]").length,
      fakeSettingsEditControls: Array.from(document.querySelectorAll("button")).filter((button) => /Settings\\s*\\/\\s*Edit/i.test(button.innerText || button.textContent || "")).length,
      copyEnabled: Array.from(document.querySelectorAll("button")).some((button) => !button.disabled && /Copy Cleaned SVG/i.test(button.innerText || button.textContent || "")),
      downloadEnabled: Array.from(document.querySelectorAll("button")).some((button) => !button.disabled && /^Download SVG$/i.test((button.innerText || button.textContent || "").trim())),
      changedFromPrevious: ${JSON.stringify(String(previousSvg || ""))} ? outputSvg !== ${JSON.stringify(String(previousSvg || ""))} : Boolean(outputSvg),
      postEditLongTasks: longTasks.filter((task) => task.phase === "post-conversion-edit"),
    };
  })()`;
}

async function collectSvgCleanerMetrics(client) {
  const page = await evaluate(client, svgCleanerOutputStateExpression(), 12_000);
  const performanceMetrics = await client
    .send("Performance.getMetrics", {}, 8_000)
    .catch(() => null);
  return {
    ...page,
    outputSvgByteSize: page.outputByteSize,
    decodedPreviewBytes: page.outputByteSize,
    decodedPreviewPaths: page.pathCount,
    browserMetrics: performanceMetrics?.metrics
      ?.filter((metric) =>
        ["JSHeapUsedSize", "JSHeapTotalSize", "Nodes", "Documents", "LayoutCount", "RecalcStyleCount"].includes(metric.name),
      )
      .reduce((acc, metric) => {
        acc[metric.name] = metric.value;
        return acc;
      }, {}),
  };
}

async function copySvgCleanerOutput(client, expectedSvg) {
  const before = await getClipboardWrites(client);
  const clicked = await clickButtonIfPresent(client, [/Copy Cleaned SVG/i], []);
  if (!clicked) throw new Error("Copy Cleaned SVG control not found");
  const write = await waitForValue(
    client,
    () => `(() => {
      const writes = window.__POST_CONVERSION_EDITABILITY__?.clipboardWrites || [];
      const latest = writes[writes.length - 1] || "";
      return {
        count: writes.length,
        bytes: new Blob([latest]).size,
        matchesCurrentOutput: latest === ${JSON.stringify(expectedSvg)},
      };
    })()`,
    8_000,
    (value) => value?.count > before.length,
  );
  return { clicked, ...write };
}

async function downloadSvgCleanerOutput(client, expectedSvg) {
  await fs.rm(downloadsDir, { recursive: true, force: true });
  await fs.mkdir(downloadsDir, { recursive: true });
  const clicked = await clickButtonIfPresent(client, [/^Download SVG$/i], []);
  if (!clicked) throw new Error("Download SVG control not found");
  const file = await waitForDownloadedSvg(10_000);
  const svg = await fs.readFile(file, "utf8");
  return {
    clicked,
    file,
    bytes: Buffer.byteLength(svg),
    matchesCurrentOutput: svg === expectedSvg,
  };
}

async function openSettingsOnLatestOutput(client) {
  const clicked = await clickButtonInLatestOutput(client, [/Settings\s*\/\s*Edit/i, /^Settings$/i], []);
  if (!clicked) throw new Error("No Settings/Edit button found on latest completed output.");
  const panel = await waitForValue(
    client,
    () => `(() => {
      const focused = document.querySelector('[data-focused-editor-workspace="true"]');
      const panel = document.querySelector('[data-editor-settings-panel="true"], [id^="output-settings-"]:not([id^="output-settings-panel-"])');
      return {
        focusedVisible: isVisible(focused),
        panelVisible: isVisible(panel),
        domNodes: document.querySelectorAll("*").length,
        layerRowCount: document.querySelectorAll('[data-settings-section] input[type="color"], [data-layer-palette-editor="true"] input[type="color"]').length,
      };
      function isVisible(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }
    })()`,
    12_000,
    (value) => value?.focusedVisible && value?.panelVisible,
  );
  return { clicked, ...panel };
}

async function openLayerControls(client) {
  return evaluate(client, `(async () => {
    const clickByText = (root, patterns) => {
      const controls = Array.from(root.querySelectorAll("button, summary"));
      const target = controls.find((control) => {
        const text = (control.innerText || control.textContent || control.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
        return isVisible(control) && patterns.some((pattern) => pattern.test(text));
      });
      if (!target) return null;
      target.scrollIntoView({ block: "center", inline: "nearest" });
      target.click();
      return (target.innerText || target.textContent || "").replace(/\\s+/g, " ").trim();
    };
    const panel = document.querySelector('[data-editor-settings-panel="true"], [id^="output-settings-"]:not([id^="output-settings-panel-"])');
    if (!panel) throw new Error("settings panel missing");
    const opened = [];
    const live = clickByText(panel, [/Live Preview Edits/i]);
    if (live) opened.push(live);
    await nextFrame();
    const layer = clickByText(panel, [/^Layer colors$/i, /Layer colors/i, /Output colors/i, /Post-processing/i]);
    if (layer) opened.push(layer);
    await nextFrame();
    const colorInput = Array.from(panel.querySelectorAll('input[type="color"]')).find(isVisible);
    const rangeInput = Array.from(panel.querySelectorAll('input[type="range"]')).find(isVisible);
    return {
      opened: Boolean(colorInput || rangeInput),
      clicked: opened,
      visibleColorInputs: Array.from(panel.querySelectorAll('input[type="color"]')).filter(isVisible).length,
      visibleRangeInputs: Array.from(panel.querySelectorAll('input[type="range"]')).filter(isVisible).length,
    };
    function isVisible(element) {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && !element.disabled;
    }
    function nextFrame() {
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
  })()`, 10_000);
}

async function changeFirstEditableColor(client) {
  return evaluate(client, `(async () => {
    const panel = document.querySelector('[data-editor-settings-panel="true"], [id^="output-settings-"]:not([id^="output-settings-panel-"])');
    if (!panel) throw new Error("settings panel missing");
    const liveSection =
      panel.querySelector('[data-settings-top-section-tone="live"]') ||
      panel;
    if (
      liveSection !== panel &&
      liveSection.getAttribute("data-settings-top-section-open") !== "true"
    ) {
      const liveToggle = Array.from(liveSection.querySelectorAll("button")).find((control) =>
        isVisible(control) && /Live Preview Edits/i.test(textFor(control))
      );
      if (liveToggle) {
        liveToggle.scrollIntoView({ block: "center", inline: "nearest" });
        liveToggle.click();
        await nextFrame();
      }
    }
    await openSection(liveSection, /Post-processing|Layer colors|Output colors/i);
    let input = findLiveColorInput(liveSection);
    if (!input) {
      const toggled = await enableFirstColorToggle(liveSection);
      if (toggled) {
        await nextFrame();
        input = findLiveColorInput(liveSection);
      }
    }
    if (!input && liveSection !== panel) {
      await openSection(panel, /Post-processing|Layer colors|Output colors/i);
      input = findLiveColorInput(panel);
      if (!input) {
        const toggled = await enableFirstColorToggle(panel);
        if (toggled) {
          await nextFrame();
          input = findLiveColorInput(panel);
        }
      }
    }
    if (!input) throw new Error("no visible color input");
    const before = input.value || "#000000";
    const after = before.toLowerCase() === "#ff0066" ? "#0ea5e9" : "#ff0066";
    window.__POST_CONVERSION_EDITABILITY__.editedColor = after;
    input.scrollIntoView({ block: "center", inline: "nearest" });
    input.focus();
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (valueSetter) {
      valueSetter.call(input, after);
    } else {
      input.value = after;
    }
    const inputEvent =
      typeof InputEvent === "function"
        ? new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: after })
        : new Event("input", { bubbles: true });
    input.dispatchEvent(inputEvent);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    if (typeof PointerEvent === "function") {
      input.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    }
    input.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    input.blur();
    await nextFrame();
    return { changed: true, before, after };
    async function openSection(root, pattern) {
      const control = Array.from(root.querySelectorAll("button, summary")).find((candidate) =>
        isVisible(candidate) && pattern.test(textFor(candidate))
      );
      if (!control) return false;
      const section = control.closest("[data-settings-section]");
      if (section?.getAttribute("data-settings-section-open") === "true") return true;
      control.scrollIntoView({ block: "center", inline: "nearest" });
      control.click();
      await nextFrame();
      return true;
    }
    async function enableFirstColorToggle(root) {
      const toggles = Array.from(root.querySelectorAll([
        '[data-post-processing-controls="true"] label',
        '[data-settings-section] [data-post-processing-controls="true"] label',
      ].join(", ")))
        .map((label) => ({
          label,
          input: label.querySelector('input[type="checkbox"]'),
          text: textFor(label),
        }))
        .filter(({ label, input, text }) =>
          input &&
          !input.disabled &&
          isVisible(input) &&
          isVisible(label) &&
          /^(Stroke color|Fill color)$/.test(text)
        );
      const target =
        toggles.find(({ text }) => /^Fill color$/.test(text)) ||
        toggles.find(({ text }) => /^Stroke color$/.test(text)) ||
        toggles[0];
      if (!target) return false;
      if (target.input.checked) return false;
      target.label.scrollIntoView({ block: "center", inline: "nearest" });
      target.input.click();
      await nextFrame();
      return true;
    }
    function findLiveColorInput(root) {
      return Array.from(root.querySelectorAll([
        '[data-post-processing-controls="true"] input[type="color"]',
        '[data-layer-palette-editor="true"] input[type="color"]',
        '[data-settings-section] input[type="color"]',
      ].join(", "))).find(isVisible);
    }
    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && !element.disabled;
    }
    function textFor(element) {
      return (element?.innerText || element?.textContent || element?.getAttribute?.("aria-label") || "").replace(/\\s+/g, " ").trim();
    }
    function nextFrame() {
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
  })()`, 10_000);
}

async function moveFirstEditableSlider(client, previewBefore) {
  const target = await evaluate(client, `(async () => {
    const panel = document.querySelector('[data-editor-settings-panel="true"], [id^="output-settings-"]:not([id^="output-settings-panel-"])');
    if (!panel) throw new Error("settings panel missing");
    const liveSection =
      panel.querySelector('[data-settings-top-section-tone="live"]') ||
      panel;
    if (
      liveSection !== panel &&
      liveSection.getAttribute("data-settings-top-section-open") !== "true"
    ) {
      const liveToggle = Array.from(liveSection.querySelectorAll("button")).find((control) =>
        isVisible(control) && /Live Preview Edits/i.test(textFor(control))
      );
      if (liveToggle) {
        liveToggle.scrollIntoView({ block: "center", inline: "nearest" });
        liveToggle.click();
        await nextFrame();
      }
    }

    await openSection(liveSection, /Layer colors/i);
    let ranges = visibleRanges(liveSection);
    let editableRanges = ranges.filter(isLiveEditRange);
    let input =
      editableRanges.find((candidate) => /Per-layer opacity/i.test(labelFor(candidate))) ||
      editableRanges[0];

    if (!input) {
      await openSection(liveSection, /Output colors/i);
      ranges = visibleRanges(liveSection);
      editableRanges = ranges.filter(isLiveEditRange);
      input =
        editableRanges.find((candidate) => /^Opacity\b/i.test(labelFor(candidate))) ||
        editableRanges[0];
    }

    if (!input) {
      await openSection(liveSection, /Post-processing/i);
      ranges = visibleRanges(liveSection);
      editableRanges = ranges.filter(isLiveEditRange);
      input =
      editableRanges.find((candidate) =>
        /Border thickness|Line weight|Fill spread|Stroke|Spread/i.test(labelFor(candidate))
      ) ||
      editableRanges.find((candidate) => /Per-layer opacity/i.test(labelFor(candidate))) ||
      editableRanges[0];
    }

    if (!input) {
      await openSection(liveSection, /Layer colors/i);
      ranges = visibleRanges(liveSection);
      editableRanges = ranges.filter(isLiveEditRange);
      input =
        editableRanges.find((candidate) => /Per-layer opacity/i.test(labelFor(candidate))) ||
        editableRanges[0];
    }
    if (!input && liveSection !== panel) {
      await openSection(panel, /Post-processing|Layer colors|Output colors/i);
      ranges = visibleRanges(panel);
      editableRanges = ranges.filter(isLiveEditRange);
      input =
        editableRanges.find((candidate) =>
          /Border thickness|Line weight|Fill spread|Stroke|Spread/i.test(labelFor(candidate))
        ) ||
        editableRanges.find((candidate) => /Per-layer opacity/i.test(labelFor(candidate))) ||
        editableRanges[0];
    }

    if (!input) throw new Error("no visible range input");
    ranges.forEach((candidate) => candidate.removeAttribute("data-post-conversion-slider-target"));
    input.setAttribute("data-post-conversion-slider-target", "true");
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const current = Number(input.value || min);
    const step = Math.max(1, Math.round((max - min) * 0.17));
    const after = Math.max(min, Math.min(max, current + step > max ? current - step : current + step));
    input.scrollIntoView({ block: "center", inline: "nearest" });
    const rect = input.getBoundingClientRect();
    const startRatio = ratioFor(current);
    const endRatio = ratioFor(after);
    return {
      before: current,
      intendedAfter: after,
      min,
      max,
      label: labelFor(input),
      startX: Math.max(1, Math.min(window.innerWidth - 2, rect.left + Math.max(0.03, Math.min(0.97, startRatio)) * rect.width)),
      endX: Math.max(1, Math.min(window.innerWidth - 2, rect.left + Math.max(0.03, Math.min(0.97, endRatio)) * rect.width)),
      y: Math.max(1, Math.min(window.innerHeight - 2, rect.top + rect.height / 2)),
      previewBeforeBytes: ${JSON.stringify(previewBefore || "")}.length,
    };
    async function openSection(scope, pattern) {
      const control = Array.from(scope.querySelectorAll("button, summary")).find((candidate) =>
        isVisible(candidate) && pattern.test(textFor(candidate))
      );
      if (control && control.getAttribute("aria-expanded") !== "true") {
        control.scrollIntoView({ block: "center", inline: "nearest" });
        control.click();
        await nextFrame();
      }
    }
    function visibleRanges(scope) {
      return Array.from(scope.querySelectorAll('input[type="range"]')).filter(isVisible);
    }
    function isLiveEditRange(candidate) {
      const label = labelFor(candidate);
      return /Border thickness|Line weight|Fill spread|Per-layer opacity|Opacity|Stroke|Spread/i.test(label) &&
        !/Global layer opacity|Layer count|Trace|Threshold|Turd|Tolerance|Region|Posterize|Max/i.test(label);
    }
    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && !element.disabled;
    }
    function textFor(element) {
      return (element.innerText || element.textContent || element.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
    }
    function labelFor(element) {
      return (element.closest("label")?.innerText || element.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
    }
    function nextFrame() {
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    function ratioFor(value) {
      if (max <= min) return 0;
      return (value - min) / (max - min);
    }
  })()`, 10_000);
  let attemptStarted = performance.now();
  await dragAtPoint(client, target);
  await delay(150);
  let after = await readFirstVisibleRangeValue(client);
  let method = "drag";
  let effectiveElapsedMs = performance.now() - attemptStarted;
  if (after === target.before) {
    attemptStarted = performance.now();
    await trustedClickAtPoint(client, { x: target.startX, y: target.y });
    await nudgeRangeWithKeyboard(client, target.intendedAfter < target.before ? "decrease" : "increase");
    await delay(150);
    after = await readFirstVisibleRangeValue(client);
    method = "keyboard";
    effectiveElapsedMs = performance.now() - attemptStarted;
  }
  if (after === target.before) {
    attemptStarted = performance.now();
    await setTargetRangeValueWithNativeInput(client, target.intendedAfter);
    await delay(150);
    after = await readFirstVisibleRangeValue(client);
    method = "native-event";
    effectiveElapsedMs = performance.now() - attemptStarted;
  }
  return {
    moved: after !== target.before,
    before: target.before,
    after,
    intendedAfter: target.intendedAfter,
    sliderLabel: target.label,
    method,
    effectiveElapsedMs,
    previewBeforeBytes: target.previewBeforeBytes,
  };
}

async function readFirstVisibleRangeValue(client) {
  return evaluate(client, `(() => {
    const panel = document.querySelector('[data-editor-settings-panel="true"], [id^="output-settings-"]:not([id^="output-settings-panel-"])');
    const input = panel ? (
      panel.querySelector('[data-post-conversion-slider-target="true"]') ||
      Array.from(panel.querySelectorAll('input[type="range"]')).find((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && !element.disabled;
      })
    ) : null;
    return input ? Number(input.value) : null;
  })()`, 6_000);
}

async function setTargetRangeValueWithNativeInput(client, value) {
  return evaluate(client, `(() => {
    const input = document.querySelector('[data-post-conversion-slider-target="true"]');
    if (!input) throw new Error("range target missing");
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!valueSetter) throw new Error("range value setter missing");
    input.focus();
    valueSetter.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: ${JSON.stringify(String(value))} }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    input.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    input.blur();
    return Number(input.value);
  })()`, 6_000);
}

async function waitForPreviewToContain(client, color, previousSvg, timeoutMs) {
  const normalized = String(color || "").toLowerCase();
  if (!normalized) throw new Error("missing edited color");
  return waitForValue(
    client,
    () => focusedPreviewStateExpression(normalized, previousSvg),
    timeoutMs,
    (value) => value?.containsColor && value.changedFromPrevious,
  );
}

async function waitForPreviewChange(client, previousSvg, timeoutMs) {
  return waitForValue(
    client,
    () => focusedPreviewStateExpression("", previousSvg),
    timeoutMs,
    (value) => value?.changedFromPrevious,
  );
}

async function latestFocusedPreviewSvg(client) {
  const state = await evaluate(client, focusedPreviewStateExpression("", ""), 8_000);
  return state.svg || "";
}

function focusedPreviewStateExpression(color, previousSvg) {
  return `(async () => {
    const workspace = document.querySelector('[data-focused-editor-workspace="true"]') || document;
    const image = workspace.querySelector('[data-editor-output-preview="true"] img, img');
    const svg = await decodeSvgImage(image);
    const lowered = svg.toLowerCase();
    const color = ${JSON.stringify(String(color || "").toLowerCase())};
    const previous = ${JSON.stringify(String(previousSvg || ""))};
    return {
      bytes: new Blob([svg]).size,
      containsColor: color ? lowered.includes(color) : true,
      changedFromPrevious: previous ? svg !== previous : Boolean(svg),
      svg: svg.slice(0, 2_000_000),
    };
    async function decodeSvgImage(image) {
      const src = image?.getAttribute("src") || "";
      if (src.startsWith("data:image/svg+xml")) {
        const comma = src.indexOf(",");
        if (comma < 0) return "";
        try {
          return decodeURIComponent(src.slice(comma + 1));
        } catch {
          return "";
        }
      }
      if (src.startsWith("blob:")) {
        try {
          const response = await fetch(src);
          const text = await response.text();
          return /<svg[\\s>]/i.test(text) ? text : "";
        } catch {
          return "";
        }
      }
      return "";
    }
  })()`;
}

async function copyEditedOutput(client, expectedSvg, editedColor) {
  const before = await getClipboardWrites(client);
  await evaluate(
    client,
    `(() => {
      window.__POST_CONVERSION_EDITABILITY__.editedColor = ${JSON.stringify(editedColor || "")};
      window.__POST_CONVERSION_EDITABILITY__.expectedEditedSvg = ${JSON.stringify(expectedSvg || "")};
      return true;
    })()`,
  );
  const clicked = await clickButtonInFocusedEditor(client, [/Copy SVG/i, /^Copy$/i], [/Copied/i]);
  if (!clicked) throw new Error("copy control not found");
  const write = await waitForValue(
    client,
    () => `(() => {
      const writes = window.__POST_CONVERSION_EDITABILITY__?.clipboardWrites || [];
      const latest = writes[writes.length - 1] || "";
      return {
        count: writes.length,
        bytes: new Blob([latest]).size,
        containsEditedColor: (window.__POST_CONVERSION_EDITABILITY__?.editedColor || "")
          ? latest.toLowerCase().includes((window.__POST_CONVERSION_EDITABILITY__?.editedColor || "").toLowerCase())
          : null,
        matchesExpectedSvg: latest === (window.__POST_CONVERSION_EDITABILITY__?.expectedEditedSvg || ""),
      };
    })()`,
    8_000,
    (value) => value?.count > before.length,
  );
  return { clicked, ...write };
}

async function downloadEditedOutput(client, expectedSvg, editedColor) {
  await fs.rm(downloadsDir, { recursive: true, force: true });
  await fs.mkdir(downloadsDir, { recursive: true });
  await evaluate(
    client,
    `(() => {
      window.__POST_CONVERSION_EDITABILITY__.editedColor = ${JSON.stringify(editedColor || "")};
      window.__POST_CONVERSION_EDITABILITY__.expectedEditedSvg = ${JSON.stringify(expectedSvg || "")};
      return true;
    })()`,
  );
  const clicked = await clickButtonInFocusedEditor(client, [/Download SVG/i, /^Download\b/i], [/ZIP/i]);
  if (!clicked) throw new Error("download control not found");
  const file = await waitForDownloadedSvg(10_000);
  const svg = await fs.readFile(file, "utf8");
  return {
    clicked,
    file,
    bytes: Buffer.byteLength(svg),
    containsEditedColor: editedColor
      ? svg.toLowerCase().includes(String(editedColor || "").toLowerCase())
      : null,
    matchesExpectedSvg: svg === String(expectedSvg || ""),
  };
}

async function getClipboardWrites(client) {
  return evaluate(
    client,
    `(() => window.__POST_CONVERSION_EDITABILITY__?.clipboardWrites || [])()`,
  );
}

async function clickButtonInFocusedEditor(client, patterns, rejectPatterns = []) {
  const target = await findButtonTarget(client, patterns, rejectPatterns, "focused");
  if (!target) return null;
  await trustedClickAtPoint(client, target);
  return target;
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
    const focusedWorkspace = document.querySelector('[data-focused-editor-workspace="true"]');
    const latest = latestCard(cards);
    const root =
      ${JSON.stringify(scope)} === "latest"
        ? latest
        : ${JSON.stringify(scope)} === "focused"
          ? (
              document.querySelector('[data-output-stamp][data-focused-editor="true"]') ||
              focusedWorkspace?.closest('[data-output-stamp]') ||
              latest
            )
          : document.body;
    if (!root) return null;
    const buttons = Array.from(root.querySelectorAll("button, [role='button'], summary"));
    const button = buttons.find((candidate) => {
      const text = (candidate.innerText || candidate.textContent || candidate.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
      return isVisible(candidate) &&
        !candidate.disabled &&
        patterns.some((pattern) => pattern.test(text)) &&
        !rejects.some((pattern) => pattern.test(text));
    });
    if (!button) return null;
    button.scrollIntoView({ block: "center", inline: "nearest" });
    const rect = button.getBoundingClientRect();
    return {
      label: (button.innerText || button.textContent || button.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim(),
      x: Math.max(1, Math.min(window.innerWidth - 2, rect.left + rect.width / 2)),
      y: Math.max(1, Math.min(window.innerHeight - 2, rect.top + rect.height / 2)),
    };
    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }
    function latestCard(items) {
      return items.reduce((best, card) => {
        if (!best) return card;
        return numberOrNull(card.getAttribute("data-output-stamp")) >= numberOrNull(best.getAttribute("data-output-stamp"))
          ? card
          : best;
      }, null);
    }
    function numberOrNull(value) {
      const text = String(value || "").trim();
      if (!text) return 0;
      const number = Number(text.replace(/[^0-9.]/g, ""));
      return Number.isFinite(number) ? number : 0;
    }
  })()`, 8_000);
}

async function collectMetrics(client) {
  const page = await evaluate(client, `(async () => {
    const cards = Array.from(document.querySelectorAll("[data-output-stamp]"));
    const latest = latestCard(cards);
    const previewImages = visibleElements('[data-output-stamp] img, [data-focused-editor-workspace="true"] img');
    const svgs = [];
    for (const image of previewImages) {
      const src = image.getAttribute("src") || "";
      if (src.startsWith("data:image/svg+xml")) {
        const comma = src.indexOf(",");
        if (comma < 0) continue;
        try {
          svgs.push(decodeURIComponent(src.slice(comma + 1)));
        } catch {}
      } else if (src.startsWith("blob:")) {
        try {
          const response = await fetch(src);
          const text = await response.text();
          if (/<svg[\\s>]/i.test(text)) svgs.push(text);
        } catch {}
      }
    }
    const parsed = svgs.map((svg) => {
      const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
      return {
        bytes: new Blob([svg]).size,
        paths: doc.querySelectorAll("path").length,
        layers: doc.querySelectorAll("[data-layer-id], [data-fill-layer-id], [data-stroke-layer-id], g[data-layer-name]").length,
      };
    });
    const longTasks = window.__POST_CONVERSION_EDITABILITY__?.longTasks || [];
    return {
      pageAlive: true,
      href: location.href,
      domNodes: document.querySelectorAll("*").length,
      outputCardCount: cards.length,
      expandedOutputCardCount: cards.filter((card) => card.getAttribute("data-collapse-state") !== "collapsed").length,
      settingsPanelCount: visibleElements('[data-editor-settings-panel="true"], [id^="output-settings-"]:not([id^="output-settings-panel-"])').length,
      focusedEditorVisible: Boolean(document.querySelector('[data-focused-editor-workspace="true"]')),
      fullSvgPreviewCount: svgs.length,
      outputSvgByteSize: latest ? numberOrNull(latest.getAttribute("data-svg-bytes")) : null,
      pathCount: latest ? numberOrNull(latest.getAttribute("data-path-count")) : null,
      layerCount: parsed.reduce((sum, item) => sum + item.layers, 0),
      decodedPreviewBytes: parsed.reduce((sum, item) => sum + item.bytes, 0),
      decodedPreviewPaths: parsed.reduce((sum, item) => sum + item.paths, 0),
      visibleColorInputs: visibleElements('input[type="color"]').length,
      visibleRangeInputs: visibleElements('input[type="range"]').length,
      activeJobs: cards.filter(isActiveCard).length,
      latestOutput: latest ? {
        stamp: numberOrNull(latest.getAttribute("data-output-stamp")),
        jobStatus: latest.getAttribute("data-job-status") || null,
        engineUsed: latest.getAttribute("data-engine-used") || null,
        svgBytes: numberOrNull(latest.getAttribute("data-svg-bytes")),
        pathCount: numberOrNull(latest.getAttribute("data-path-count")),
        text: (latest.innerText || "").replace(/\\s+/g, " ").slice(0, 700),
      } : null,
      postEditLongTasks: longTasks.filter((task) => task.phase === "post-conversion-edit"),
      longTaskCount: longTasks.length,
      longTaskTotalMs: longTasks.reduce((sum, task) => sum + Number(task.duration || 0), 0),
    };
    function visibleElements(selector) {
      return Array.from(document.querySelectorAll(selector)).filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
    }
    function isActiveCard(card) {
      return /queued|running/i.test(card.getAttribute("data-job-status") || "") ||
        /\\b(Queued|Running|Converting)\\b/i.test(card.innerText || "");
    }
    function latestCard(items) {
      return items.reduce((best, card) => {
        if (!best) return card;
        return numberOrNull(card.getAttribute("data-output-stamp")) >= numberOrNull(best.getAttribute("data-output-stamp"))
          ? card
          : best;
      }, null);
    }
    function numberOrNull(value) {
      const text = String(value || "").trim();
      if (!text) return null;
      const number = Number(text.replace(/[^0-9.]/g, ""));
      return Number.isFinite(number) ? number : null;
    }
  })()`, 15_000);
  const performanceMetrics = await client
    .send("Performance.getMetrics", {}, 8_000)
    .catch(() => null);
  return {
    ...page,
    browserMetrics: performanceMetrics?.metrics
      ?.filter((metric) =>
        ["JSHeapUsedSize", "JSHeapTotalSize", "Nodes", "Documents", "LayoutCount", "RecalcStyleCount"].includes(metric.name),
      )
      .reduce((acc, metric) => {
        acc[metric.name] = metric.value;
        return acc;
      }, {}),
  };
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
    const latestText = latest ? cheapCardText(latest, 700) : "";
    const latestReady = Boolean(latest) &&
      !isActiveCard(latest) &&
      /Settings\\s*\\/\\s*Edit|Download|Copy/i.test(latestText) &&
      !/Conversion failed|Canceled/i.test(latestText);
    return {
      pageAlive: true,
      outputCards: cards.length,
      activeJobs,
      latestStamp,
      latestReady,
      latestChanged: ${previousLatestStamp == null ? "true" : `latestStamp !== ${JSON.stringify(previousLatestStamp)}`},
      latestText,
      latestJobStatus: latest ? latest.getAttribute("data-job-status") || null : null,
      latestSvgBytes: latest ? numberOrNull(latest.getAttribute("data-svg-bytes")) : null,
      latestPathCount: latest ? numberOrNull(latest.getAttribute("data-path-count")) : null,
    };
    function isActiveCard(card) {
      return /queued|running/i.test(card.getAttribute("data-job-status") || "") ||
        /\\b(Queued|Running|Converting)\\b/i.test(cheapCardText(card, 300));
    }
    function cheapCardText(card, maxLength) {
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest("svg, textarea, script, style")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let text = "";
      while (walker.nextNode()) {
        const value = (walker.currentNode.nodeValue || "").replace(/\\s+/g, " ").trim();
        if (!value) continue;
        text += (text ? " " : "") + value;
        if (text.length >= maxLength) break;
      }
      return text.slice(0, maxLength);
    }
    function latestCard(items) {
      return items.reduce((best, card) => {
        if (!best) return card;
        return numberOrNull(card.getAttribute("data-output-stamp")) >= numberOrNull(best.getAttribute("data-output-stamp"))
          ? card
          : best;
      }, null);
    }
    function numberOrNull(value) {
      const text = String(value || "").trim();
      if (!text) return null;
      const number = Number(text.replace(/[^0-9.]/g, ""));
      return Number.isFinite(number) ? number : null;
    }
  })()`;
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
    (value) => value?.enabledConvert || value?.routeBusy || value?.outputCards > 0,
  );
}

async function routeConversionBusy(client) {
  return evaluate(client, `(() => {
    return Array.from(document.querySelectorAll("button")).some((button) => {
      const text = button.innerText || button.textContent || "";
      return button.disabled && /\\b(Building|Converting|Running|Creating)\\b/i.test(text);
    });
  })()`);
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
    const accepted = await waitForUploadAccepted(client, expectedName, 25_000).catch(() => null);
    if (accepted) return;
  } catch {}

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const nodeId = await queryFileInputNodeId(client, primaryFileInputSelector);
      await client.send("DOM.setFileInputFiles", { nodeId, files: [filePath] }, 8_000);
      await dispatchFileInputChange(client);
      const accepted = await waitForUploadAccepted(client, expectedName, 12_000).catch(() => null);
      if (accepted) return;
    } catch (error) {
      lastError = error;
      if (!/could not find node|no node with given id|cannot find context/i.test(String(error?.message || error))) break;
      await delay(150);
    }
  }
  await setFileInputFromBuffer(client, filePath);
  const accepted = await waitForUploadAccepted(client, expectedName, 20_000).catch(() => null);
  if (accepted) return;

  throw lastError || new Error(`File upload did not appear in page state for ${expectedName}.`);
}

const primaryFileInputSelector = 'label input[type="file"], input[type="file"]';

async function setFileInputViaChooser(client, filePath) {
  await client.send("Page.enable").catch(() => {});
  await client.send("Page.setInterceptFileChooserDialog", { enabled: true }).catch(() => {});
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

function mimeTypeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

async function installObservers(client) {
  await evaluate(client, `(() => {
    window.__POST_CONVERSION_EDITABILITY__ = {
      longTasks: [],
      clipboardWrites: [],
      phase: "setup",
      editedColor: "",
    };
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__POST_CONVERSION_EDITABILITY__.longTasks.push({
              phase: window.__POST_CONVERSION_EDITABILITY__.phase || "unknown",
              name: entry.name,
              startTime: Math.round(entry.startTime),
              duration: Math.round(entry.duration),
            });
          }
        });
        observer.observe({ type: "longtask", buffered: true });
        window.__POST_CONVERSION_EDITABILITY__.observer = observer;
      } catch {}
    }
    return true;
  })()`);
}

async function clearPhaseLongTasks(client, phase) {
  await evaluate(client, `(() => {
    if (!window.__POST_CONVERSION_EDITABILITY__) return false;
    window.__POST_CONVERSION_EDITABILITY__.phase = ${JSON.stringify(phase)};
    window.__POST_CONVERSION_EDITABILITY__.longTasks = [];
    return true;
  })()`);
}

async function installClipboardCapture(client) {
  await evaluate(client, `(() => {
    if (!window.__POST_CONVERSION_EDITABILITY__) {
      window.__POST_CONVERSION_EDITABILITY__ = { longTasks: [], clipboardWrites: [], phase: "setup", editedColor: "" };
    }
    const capture = async (text) => {
      window.__POST_CONVERSION_EDITABILITY__.clipboardWrites.push(String(text || ""));
      return undefined;
    };
    try {
      if (!navigator.clipboard) {
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: capture } });
      } else {
        navigator.clipboard.writeText = capture;
      }
    } catch {
      try {
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: capture } });
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

async function waitForDownloadedSvg(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = [];
  while (Date.now() < deadline) {
    last = await fs.readdir(downloadsDir).catch(() => []);
    const svg = last.find((file) => /\.svg$/i.test(file) && !/\.crdownload$/i.test(file));
    if (svg) return path.join(downloadsDir, svg);
    await delay(250);
  }
  throw new Error(`Timed out waiting for downloaded SVG. Files: ${last.join(", ")}`);
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

async function dragAtPoint(client, point) {
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: point.startX,
    y: point.y,
    button: "none",
  }, 6_000);
  await client.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    x: point.startX,
    y: point.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  }, 6_000);
  const steps = 8;
  for (let step = 1; step <= steps; step += 1) {
    const progress = step / steps;
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: point.startX + (point.endX - point.startX) * progress,
      y: point.y,
      button: "left",
      buttons: 1,
    }, 6_000);
  }
  await client.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    x: point.endX,
    y: point.y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  }, 6_000);
}

async function nudgeRangeWithKeyboard(client, direction) {
  const key = direction === "decrease" ? "ArrowLeft" : "ArrowRight";
  const code = key;
  const windowsVirtualKeyCode = direction === "decrease" ? 37 : 39;
  for (let index = 0; index < 17; index += 1) {
    await client.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key,
      code,
      windowsVirtualKeyCode,
      nativeVirtualKeyCode: windowsVirtualKeyCode,
    }, 6_000);
    await client.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key,
      code,
      windowsVirtualKeyCode,
      nativeVirtualKeyCode: windowsVirtualKeyCode,
    }, 6_000);
  }
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
    try {
      last = await evaluate(
        client,
        expressionFactory(),
        Math.min(15_000, Math.max(3_000, deadline - Date.now())),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/CDP command timed out|Runtime\.evaluate/i.test(message)) {
        throw error;
      }
      last = {
        pageAlive: false,
        transientEvaluateTimeout: message,
      };
      await delay(500);
      continue;
    }
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

async function prepareFixture() {
  const userFixtureAvailable = await fs
    .access(userFixturePath)
    .then(() => true)
    .catch(() => false);
  const fixturePath = userFixtureAvailable
    ? userFixturePath
    : path.join(fixturesDir, "generated-screenshot-like.png");
  if (!userFixtureAvailable) {
    await sharp(Buffer.from(buildScreenshotLikeSvg())).png().toFile(fixturePath);
  }
  const [stat, metadata] = await Promise.all([
    fs.stat(fixturePath),
    sharp(fixturePath, { limitInputPixels: false })
      .metadata()
      .catch(() => ({})),
  ]);
  const sourceInfo = {
    requestedPath: userFixturePath,
    path: fixturePath,
    basename: path.basename(fixturePath),
    source: userFixtureAvailable ? "real-user-fixture" : "generated-screenshot-like-fallback",
    usedUserFixture: userFixtureAvailable,
    bytes: stat.size,
    width: metadata.width || null,
    height: metadata.height || null,
    format: metadata.format || path.extname(fixturePath).slice(1),
  };
  const jpgFixturePath = path.join(fixturesDir, "screenshot-like-route-copy.jpg");
  await sharp(fixturePath, { limitInputPixels: false })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(jpgFixturePath);
  const [jpgStat, jpgMetadata] = await Promise.all([
    fs.stat(jpgFixturePath),
    sharp(jpgFixturePath, { limitInputPixels: false })
      .metadata()
      .catch(() => ({})),
  ]);
  const svgFixturePath = path.join(fixturesDir, "cleaner-route-sample.svg");
  await fs.writeFile(svgFixturePath, buildScreenshotLikeSvg());
  const svgStat = await fs.stat(svgFixturePath);
  const representativeFixturePath = path.join(fixturesDir, "representative-raster-input.png");
  await sharp(Buffer.from(buildRepresentativeRasterSvg())).png().toFile(representativeFixturePath);
  const [representativeStat, representativeMetadata] = await Promise.all([
    fs.stat(representativeFixturePath),
    sharp(representativeFixturePath, { limitInputPixels: false })
      .metadata()
      .catch(() => ({})),
  ]);
  return {
    source: {
      path: fixturePath,
      info: sourceInfo,
    },
    jpg: {
      path: jpgFixturePath,
      info: {
        requestedPath: userFixturePath,
        path: jpgFixturePath,
        basename: path.basename(jpgFixturePath),
        source: `${sourceInfo.source}-jpg-derivative-for-jpg-route`,
        usedUserFixture: userFixtureAvailable,
        derivedFrom: fixturePath,
        bytes: jpgStat.size,
        width: jpgMetadata.width || null,
        height: jpgMetadata.height || null,
        format: jpgMetadata.format || path.extname(jpgFixturePath).slice(1),
      },
    },
    svg: {
      path: svgFixturePath,
      info: {
        requestedPath: svgFixturePath,
        path: svgFixturePath,
        basename: path.basename(svgFixturePath),
        source: "generated-svg-cleaner-fixture",
        usedUserFixture: false,
        bytes: svgStat.size,
        width: 1024,
        height: 760,
        format: "svg",
      },
    },
    representativePng: {
      path: representativeFixturePath,
      info: {
        requestedPath: representativeFixturePath,
        path: representativeFixturePath,
        basename: path.basename(representativeFixturePath),
        source: "generated-representative-raster-fixture",
        usedUserFixture: false,
        bytes: representativeStat.size,
        width: representativeMetadata.width || null,
        height: representativeMetadata.height || null,
        format: representativeMetadata.format || path.extname(representativeFixturePath).slice(1),
      },
    },
  };
}

function buildScreenshotLikeSvg() {
  const panels = [];
  for (let index = 0; index < 64; index += 1) {
    const inset = 8 + index * 3;
    const width = Math.max(110, 980 - index * 10);
    const height = Math.max(70, 720 - index * 7);
    const fill = ["#e0f2fe", "#fef3c7", "#dcfce7", "#fce7f3", "#ede9fe"][index % 5];
    panels.push(`<rect x="${inset}" y="${inset}" width="${width}" height="${height}" rx="10" fill="${fill}" stroke="#0f172a" stroke-width="1"/>`);
    panels.push(`<rect x="${inset + 14}" y="${inset + 16}" width="${Math.max(30, width - 28)}" height="8" rx="4" fill="#334155" opacity=".38"/>`);
    panels.push(`<circle cx="${inset + 28}" cy="${inset + 44}" r="${7 + (index % 4)}" fill="#2563eb" opacity=".48"/>`);
    panels.push(`<path d="M${inset + 52} ${inset + 44} h${Math.max(20, width - 92)}" stroke="#111827" stroke-width="${1 + (index % 3)}" opacity=".2"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="760" viewBox="0 0 1024 760"><rect width="1024" height="760" fill="#f8fafc"/>${panels.join("")}<text x="44" y="718" font-family="Arial" font-size="24" font-weight="700" fill="#0f172a">Screenshot-like diagnostic fixture</text></svg>`;
}

function buildRepresentativeRasterSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="520" viewBox="0 0 720 520">
  <rect width="720" height="520" fill="#ffffff"/>
  <path d="M88 378 C160 262 250 244 324 326 C392 402 490 350 584 204" fill="none" stroke="#111827" stroke-width="18" stroke-linecap="round"/>
  <circle cx="210" cy="176" r="82" fill="#2563eb"/>
  <path d="M494 80 L528 154 L610 162 L550 218 L566 300 L494 258 L422 300 L438 218 L378 162 L460 154 Z" fill="#ef4444"/>
  <rect x="118" y="350" width="228" height="88" rx="18" fill="#22c55e" stroke="#111827" stroke-width="10"/>
  <path d="M430 396 h144" stroke="#111827" stroke-width="16" stroke-linecap="round"/>
  <path d="M430 432 h94" stroke="#111827" stroke-width="16" stroke-linecap="round"/>
</svg>`;
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

function formatMs(value) {
  return Number.isFinite(value) ? `${Math.round(value)}ms` : "n/a";
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
    benchmarkKind: "post-conversion-editability",
    baseUrl,
    checkedAt: new Date().toISOString(),
    fatal: error instanceof Error ? error.message : String(error),
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true }).catch(() => {});
  await fs.writeFile(reportPath, JSON.stringify(fatal, null, 2)).catch(() => {});
  console.error(JSON.stringify(fatal, null, 2));
  process.exit(1);
});
