import { spawn, execFile as execFileCallback } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getSmokeBaseUrl } from "./smoke-base-url.mjs";

const execFile = promisify(execFileCallback);

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = getSmokeBaseUrl();
const debugPort = Number(process.env.CDP_PORT || 9900 + Math.floor(Math.random() * 300));
const tmpDir = path.join(os.tmpdir(), "ilovesvg-cumulative-edit-performance", String(debugPort));
const profileDir = path.join(tmpDir, "profile");
const fixturesDir = path.join(tmpDir, "fixtures");
const downloadsDir = path.join(tmpDir, "downloads");
const reportPath = process.env.CUMULATIVE_EDIT_REPORT_PATH
  ? path.resolve(process.env.CUMULATIVE_EDIT_REPORT_PATH)
  : path.join(rootDir, "tmp", "cumulative-edit-performance-smoke.json");
const userFixturePath =
  process.env.CUMULATIVE_EDIT_FIXTURE ||
  "C:\\Users\\Suhas\\Downloads\\Screenshot 2026-05-06 194041.png";
const rounds = Math.max(2, Number(process.env.CUMULATIVE_EDIT_ROUNDS || 2));

const thresholds = {
  editTargetMs: Number(process.env.CUMULATIVE_EDIT_TARGET_MS || 1000),
  hardStepMs: Number(process.env.CUMULATIVE_EDIT_HARD_STEP_MS || 1500),
  copyMs: Number(process.env.CUMULATIVE_EDIT_COPY_MS || 1500),
  downloadMs: Number(process.env.CUMULATIVE_EDIT_DOWNLOAD_MS || 1500),
  growthFactor: Number(process.env.CUMULATIVE_EDIT_GROWTH_FACTOR || 5),
  minRealEdits: Number(process.env.CUMULATIVE_EDIT_MIN_REAL_EDITS || 5),
};

const routeFilter = process.env.CUMULATIVE_EDIT_ROUTE_FILTER || "";

const scenarios = [
  {
    id: "home-layered-cumulative-edits",
    route: "/",
    fixtureKind: "png",
    presetPatterns: [/^Layered - Flat Color\b/i],
    presetLabel: "Layered - Flat Color",
    panelComponent: "route-local home output panel",
    settingsComponent: "TraceAdvancedSettingsPanel + LayerPaletteEditor + OutputAppearanceControls",
    outputPathKind: "route-local-home",
    conversionTimeoutMs: 240_000,
  },
  {
    id: "png-layered-cumulative-edits",
    route: "/png-to-layered-svg-for-cricut",
    fixtureKind: "png",
    presetPatterns: [/^Layered - Flat Color\b/i],
    presetLabel: "Layered - Flat Color",
    panelComponent: "route-local PNG layered output panel",
    settingsComponent: "LayeredAdvancedSettingsPanel + LayerPaletteEditor + OutputAppearanceControls",
    outputPathKind: "route-local-layered",
    conversionTimeoutMs: 240_000,
  },
  {
    id: "jpg-layered-cumulative-edits",
    route: "/jpg-to-layered-svg-for-cricut",
    fixtureKind: "jpg",
    presetPatterns: [/^Layered - Flat Color\b/i, /^Layered color SVG\b/i],
    presetLabel: "Layered - Flat Color or equivalent layered color preset",
    panelComponent: "BespokeTraceOutputPanel",
    settingsComponent: "LayeredAdvancedSettingsPanel + LayerPaletteEditor + OutputAppearanceControls",
    outputPathKind: "bespoke-layered",
    conversionTimeoutMs: 240_000,
  },
].filter(
  (scenario) =>
    !routeFilter ||
    scenario.id === routeFilter ||
    scenario.route === routeFilter,
);

async function main() {
  if (!scenarios.length) {
    throw new Error(`No cumulative edit scenarios selected by CUMULATIVE_EDIT_ROUTE_FILTER=${JSON.stringify(routeFilter)}.`);
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
      console.error(`[cumulative-edit-performance] ${scenario.id}`);
      const result = await runScenario(scenario, fixture).catch((error) => ({
        id: scenario.id,
        route: scenario.route,
        fixture: scenario.fixtureKind === "jpg" ? fixture.jpg.info : fixture.png.info,
        preset: scenario.presetLabel,
        panelComponent: scenario.panelComponent,
        settingsComponent: scenario.settingsComponent,
        outputPathKind: scenario.outputPathKind,
        ok: false,
        failures: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        steps: [],
        realEditCount: 0,
        firstEditMs: null,
        lastEditMs: null,
        maxEditMs: null,
        editGrowthFactor: null,
      }));
      results.push(result);
      console.error(
        `[cumulative-edit-performance] ${scenario.id}: edits=${result.realEditCount} maxEdit=${formatMs(result.maxEditMs)} growth=${formatNumber(result.editGrowthFactor)} copy=${result.copyDownload?.copyMatchedPreviewHash ? "ok" : "fail"} download=${result.copyDownload?.downloadMatchedPreviewHash ? "ok" : "fail"} ok=${result.ok}`,
      );
    }
  } finally {
    browser.kill();
  }

  const failures = results.flatMap((result) =>
    result.failures.map((failure) => `${result.route}: ${failure}`),
  );
  const report = {
    schemaVersion: 1,
    benchmarkKind: "cumulative-edit-performance",
    baseUrl,
    checkedAt: new Date().toISOString(),
    browserPath,
    debugPort,
    rounds,
    thresholds,
    server,
    git,
    fixture: fixture.png.info,
    fixtureVariants: {
      png: fixture.png.info,
      jpg: fixture.jpg.info,
    },
    scenarios: results,
    ok: failures.length === 0,
    failures,
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (failures.length) {
    process.exitCode = 1;
  }
}

async function runScenario(scenario, fixture) {
  const url = `${baseUrl}${scenario.route}`;
  const client = await openTab(url);
  const actionLog = [];
  const consoleErrors = [];
  const pageErrors = [];
  const downloads = [];
  let cdpTimeout = false;

  client.onEvent((message) => {
    if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
      consoleErrors.push(message.params.args?.map((arg) => arg.value || arg.description || "").join(" "));
    }
    if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
      consoleErrors.push(message.params.entry.text);
    }
    if (message.method === "Runtime.exceptionThrown") {
      pageErrors.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text || "Runtime exception");
    }
    if (message.method === "Page.downloadWillBegin") {
      downloads.push(message.params);
    }
  });

  const timed = async (label, fn, options = {}) => {
    const before = await collectMetrics(client).catch((error) => ({ pageAlive: false, error: error.message }));
    const previewBefore = await focusedPreviewSnapshot(client).catch(() => null);
    await setPerfPhase(client, label);
    const started = performance.now();
    let value = null;
    let error = null;
    try {
      value = await fn(previewBefore);
      if (value?.applicable !== false && options.expectPreviewChange) {
        await waitForPreviewChange(client, previewBefore, options.previewTimeoutMs || 10_000);
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
      if (/CDP command timed out|Timed out waiting/i.test(error)) cdpTimeout = true;
    }
    const elapsedMs = performance.now() - started;
    const after = await collectMetrics(client).catch((caught) => ({
      pageAlive: false,
      error: caught instanceof Error ? caught.message : String(caught),
    }));
    const perf = await getPerfState(client).catch(() => null);
    const step = {
      label,
      ok: !error,
      error,
      elapsedMs,
      applicable: value?.applicable !== false,
      notApplicableReason: value?.applicable === false ? value.reason || "not applicable" : null,
      changed: Boolean(value?.changed),
      editKind: options.editKind || null,
      action: value,
      before: summarizeMetrics(before),
      after: summarizeMetrics(after),
      longTasks: perf?.longTasks?.filter((task) => task.phase === label) || [],
      previewUpdateCount: perf?.previewUpdates || 0,
    };
    actionLog.push(step);
    return step;
  };

  try {
    await enablePage(client);
    await configureDownloads(client);
    await installObservers(client);
    await installClipboardCapture(client);
    await waitForDocumentReady(client);

    const initial = await collectMetrics(client);
    const scenarioFixture = scenario.fixtureKind === "jpg" ? fixture.jpg : fixture.png;
    await setFileInput(client, scenarioFixture.path);
    const afterUpload = await waitForUploadAccepted(client, scenarioFixture.info.basename, 30_000);
    await settleInitialAutoConversion(client, scenario.conversionTimeoutMs).catch(() => null);
    const beforePreset = await outputState(client).catch(() => null);
    const preset = await selectPreset(client, scenario.presetPatterns);
    const beforeConvert = await outputState(client).catch(() => null);
    let clickedConvert = null;
    let completedOutput = null;
    if (
      beforeConvert?.latestReady &&
      /Layered|Flat Color/i.test(beforeConvert.latestText || "")
    ) {
      clickedConvert = {
        clicked: false,
        reason:
          beforeConvert.latestStamp === beforePreset?.latestStamp
            ? "using already-completed equivalent layered output"
            : "preset selection produced completed layered output",
      };
      completedOutput = beforeConvert;
    } else {
      clickedConvert = await clickConvert(client).catch(async (error) => {
        const state = await outputState(client).catch(() => null);
        if (state?.activeJobs > 0 || state?.latestReady) return { clicked: false, reason: error.message, state };
        throw error;
      });
      completedOutput = await waitForCompletedOutput(
        client,
        beforeConvert?.latestStamp ?? null,
        scenario.conversionTimeoutMs,
      ).catch(async (error) => {
        const state = await outputState(client).catch(() => null);
        if (state?.latestReady && /Layered|Flat Color/i.test(state.latestText || "")) {
          return { ...state, reusedLatestReady: true, waitError: error.message };
        }
        throw error;
      });
    }
    const afterConversion = await collectMetrics(client);

    const settingsOpen = await timed(
      "settings open",
      () => openSettingsOnLatestOutput(client),
      { editKind: "settings-open" },
    );

    const steps = [settingsOpen];
    steps.push(await timed(
      "open layer colors",
      () => performDomEdit(client, "open-layer-section"),
      { editKind: "section-switch" },
    ));
    steps.push(await timed(
      "layer opacity",
      () => performDomEdit(client, "layer-opacity", { value: 67 }),
      { expectPreviewChange: true, editKind: "layer-opacity" },
    ));
    steps.push(await timed(
      "layer color",
      () => performDomEdit(client, "layer-color", { color: "#0ea5e9" }),
      { expectPreviewChange: true, editKind: "layer-color" },
    ));
    steps.push(await timed(
      "first fill color",
      () => performDomEdit(client, "fill-color", {
        color: "#ff0066",
        targetSpecific: false,
      }),
      { expectPreviewChange: true, editKind: "color" },
    ));
    steps.push(await timed(
      "first fill opacity",
      () => performDomEdit(client, "fill-opacity", { value: 0.62 }),
      { expectPreviewChange: true, editKind: "opacity" },
    ));
    steps.push(await timed(
      "open post-processing",
      () => performDomEdit(client, "open-post-processing"),
      { editKind: "section-switch" },
    ));
    steps.push(await timed(
      "post-processing effect",
      () => performDomEdit(client, "post-processing-effect"),
      { expectPreviewChange: true, editKind: "post-processing" },
    ));

    for (let round = 2; round <= rounds; round += 1) {
      steps.push(await timed(
        `round ${round} color`,
        () => performDomEdit(client, "second-color", {
          color: round % 2 === 0 ? "#22c55e" : "#f97316",
        }),
        { expectPreviewChange: true, editKind: "color" },
      ));
      steps.push(await timed(
        `round ${round} opacity or slider`,
        () => performDomEdit(client, "second-slider", { round }),
        { expectPreviewChange: true, editKind: "slider" },
      ));
      steps.push(await timed(
        `round ${round} panel revisit`,
        () => performDomEdit(client, round % 2 === 0 ? "open-layer-section" : "open-post-processing"),
        { editKind: "section-switch" },
      ));
    }

    const finalPreview = await focusedPreviewSnapshot(client);
    const copyDownload = await copyAndDownloadCurrentOutput(client, finalPreview);
    const resetOutputPolish = await timed(
      "reset output polish",
      () => performDomEdit(client, "reset-output-polish"),
      { expectPreviewChange: true, editKind: "reset" },
    );
    const afterReset = await collectMetrics(client);
    const final = await collectMetrics(client);

    const editSteps = steps.filter((step) =>
      step.applicable &&
      step.changed &&
      !["settings-open", "section-switch", "reset"].includes(step.editKind || ""),
    );
    const editTimes = editSteps.map((step) => step.elapsedMs).filter(Number.isFinite);
    const firstEditMs = editTimes[0] ?? null;
    const lastEditMs = editTimes[editTimes.length - 1] ?? null;
    const maxEditMs = editTimes.length ? Math.max(...editTimes) : null;
    const editGrowthFactor = firstEditMs && lastEditMs ? lastEditMs / Math.max(firstEditMs, 1) : null;
    const warnings = [];
    const failures = [];

    if (!settingsOpen.ok || !settingsOpen.action?.panelVisible) {
      failures.push("Settings/Edit did not open after conversion.");
    }
    if (!completedOutput?.latestReady) failures.push("Conversion did not produce a completed editable output.");
    if (completedOutput?.activeJobs > 0) failures.push("Completed output remained pending or active.");
    if (editSteps.length < thresholds.minRealEdits) {
      failures.push(`Only ${editSteps.length} real edit steps ran, expected at least ${thresholds.minRealEdits}.`);
    }
    for (const step of editSteps) {
      if (step.elapsedMs > thresholds.hardStepMs) {
        failures.push(`${step.label} took ${Math.round(step.elapsedMs)} ms, threshold ${thresholds.hardStepMs} ms.`);
      } else if (step.elapsedMs > thresholds.editTargetMs) {
        warnings.push(`${step.label} exceeded target at ${Math.round(step.elapsedMs)} ms.`);
      }
    }
    if (
      editGrowthFactor != null &&
      editGrowthFactor >= thresholds.growthFactor &&
      lastEditMs != null &&
      lastEditMs > thresholds.editTargetMs
    ) {
      failures.push(`Edit time grew ${formatNumber(editGrowthFactor)}x from first to final edit.`);
    }
    if (!copyDownload.copyMatchedPreviewHash) failures.push("Copy output did not match final edited preview.");
    if (!copyDownload.downloadMatchedPreviewHash) failures.push("Download output did not match final edited preview.");
    if (copyDownload.copyMs > thresholds.copyMs) {
      failures.push(`Copy took ${Math.round(copyDownload.copyMs)} ms, threshold ${thresholds.copyMs} ms.`);
    }
    if (copyDownload.downloadMs > thresholds.downloadMs) {
      failures.push(`Download took ${Math.round(copyDownload.downloadMs)} ms, threshold ${thresholds.downloadMs} ms.`);
    }
    if (!final.pageAlive || cdpTimeout) failures.push("Page became unresponsive or CDP timed out.");
    if (hasRunawayDuplicateEffects(finalPreview)) {
      failures.push(`Final preview accumulated duplicate post-processing defs/effects: ${JSON.stringify(finalPreview.duplicateEffectCounts)}.`);
    }
    if (resetOutputPolish.applicable && !resetOutputPolish.changed) {
      failures.push("Output polish reset did not change the edited preview.");
    }
    if (afterReset.duplicateEffectCounts?.postProcessingGroups > 0) {
      failures.push("Output polish reset left post-processing groups in the preview.");
    }

    return {
      id: scenario.id,
      route: scenario.route,
      fixture: scenarioFixture.info,
      preset: scenario.presetLabel,
      panelComponent: scenario.panelComponent,
      settingsComponent: scenario.settingsComponent,
      outputPathKind: scenario.outputPathKind,
      ok: failures.length === 0,
      failures,
      warnings,
      initial: summarizeMetrics(initial),
      afterUpload,
      beforePreset,
      presetSelection: preset,
      beforeConvert,
      clickedConvert,
      completedOutput,
      afterConversion: summarizeMetrics(afterConversion),
      steps,
      realEditCount: editSteps.length,
      firstEditMs,
      lastEditMs,
      maxEditMs,
      editGrowthFactor,
      finalPreview,
      copyDownload,
      resetOutputPolish,
      afterReset: summarizeMetrics(afterReset),
      final: summarizeMetrics(final),
      consoleErrors,
      pageErrors,
      downloads,
      cdpTimeout,
    };
  } finally {
    await client.close().catch(() => {});
  }
}

async function performDomEdit(client, action, options = {}) {
  if (action === "layer-color") {
    return performLayerColorEdit(client, options);
  }

  return evaluate(client, `(async () => {
    const action = ${JSON.stringify(action)};
    const options = ${JSON.stringify(options)};
    const panel = findSettingsPanel();
    if (!panel) throw new Error("settings panel missing");

    if (action === "open-layer-section") {
      await openSection(panel, /^Layer colors$/i);
      const palette = findLayerControls(panel);
      return visible(palette)
        ? { applicable: true, changed: false, opened: true, visibleLayerRows: palette.querySelectorAll('input[type="color"]').length }
        : { applicable: false, reason: "layer controls unavailable" };
    }

    if (action === "open-post-processing") {
      await openSection(panel, /Post-processing|Live Preview Edits/i);
      const controls = panel.querySelector('[data-post-processing-controls="true"]');
      return visible(controls)
        ? { applicable: true, changed: false, opened: true }
        : { applicable: false, reason: "post-processing controls unavailable" };
    }

    if (action === "fill-color") {
      await openSection(panel, /Post-processing|Live Preview Edits/i);
      const group = panel.querySelector('[data-output-polish-group="fill-effects"]');
      if (!visible(group)) return { applicable: false, reason: "fill effects unavailable" };
      const targetSelect = Array.from(group.querySelectorAll("select")).find(visible);
      if (options.targetSpecific && targetSelect && targetSelect.options.length > 1) {
        const options = Array.from(targetSelect.options);
        const nextOption =
          options.slice().reverse().find((option) =>
            !option.disabled &&
            option.value !== targetSelect.value &&
            !/Matching\b.*\bcolor\b/i.test(option.textContent || "") &&
            !/\\bLayer 1\\b/i.test(option.textContent || "")
          ) ||
          options.slice().reverse().find((option) => !option.disabled && option.value !== targetSelect.value);
        if (nextOption) setSelect(targetSelect, nextOption.value);
      }
      const fillColorToggle = await ensureToggle(group, /^Fill color$/i);
      await nextFrame();
      const input = Array.from(group.querySelectorAll('input[type="color"]')).find(visible);
      if (!input) {
        return fillColorToggle.changed
          ? {
              applicable: true,
              changed: true,
              before: false,
              after: true,
              inputKind: "checkbox",
              label: "Fill color",
            }
          : { applicable: false, reason: "fill color input unavailable" };
      }
      return setInput(input, options.color || "#ff0066", "color");
    }

    if (action === "fill-opacity") {
      await openSection(panel, /Post-processing|Live Preview Edits/i);
      const group = panel.querySelector('[data-output-polish-group="fill-effects"]');
      if (!visible(group)) return { applicable: false, reason: "fill opacity unavailable" };
      await ensureToggle(group, /^Fill color$/i);
      const input = findRangeByLabel(group, /^Opacity\\b/i);
      if (!input) return { applicable: false, reason: "fill opacity range unavailable" };
      return setInput(input, String(options.value ?? 0.62), "range");
    }

    if (action === "layer-opacity") {
      await openSection(panel, /^Layer colors$/i);
      const palette = findLayerControls(panel);
      const input = palette ? Array.from(palette.querySelectorAll('input[type="range"]')).find(visible) : null;
      if (!input) return { applicable: false, reason: "layer opacity range unavailable" };
      const max = Number(input.max || 100);
      const value = max <= 1 ? (Number(options.value ?? 67) / 100).toFixed(2) : String(options.value ?? 67);
      return setInput(input, value, "range");
    }

    if (action === "layer-color") {
      await openSection(panel, /^Layer colors$/i);
      const palette = findLayerControls(panel);
      const textInput = palette ? Array.from(palette.querySelectorAll('input[type="text"]')).find(visible) : null;
      if (textInput) return setTextInput(textInput, options.color || "#0ea5e9", "layer-color-text");
      const input = palette ? Array.from(palette.querySelectorAll('input[type="color"]')).find(visible) : null;
      if (input) return setInput(input, options.color || "#0ea5e9", "color");
      return { applicable: false, reason: "layer color input unavailable" };
    }

    if (action === "post-processing-effect") {
      await openSection(panel, /Post-processing|Live Preview Edits/i);
      const fillStyle = panel.querySelector('[data-output-polish-group="fill-style"]');
      if (visible(fillStyle)) {
        const gradient = await clickCheckboxLabel(fillStyle, /^Gradient fill$/i);
        if (gradient) {
          await nextFrame();
          return { applicable: true, changed: true, effect: "gradient-fill", before: gradient.before, after: gradient.after };
        }
        const pattern = await clickCheckboxLabel(fillStyle, /^Pattern fill$/i);
        if (pattern) {
          await nextFrame();
          return { applicable: true, changed: true, effect: "pattern-fill", before: pattern.before, after: pattern.after };
        }
      }
      const sticker = panel.querySelector('[data-output-polish-group="sticker-border"]');
      if (visible(sticker)) {
        const border = await clickCheckboxLabel(sticker, /^Enable border$/i);
        if (border) {
          await nextFrame();
          return { applicable: true, changed: true, effect: "sticker-border", before: border.before, after: border.after };
        }
      }
      const fill = panel.querySelector('[data-output-polish-group="fill-effects"]');
      if (visible(fill)) {
        const spread = findRangeByLabel(fill, /Fill spread/i);
        if (spread) return setInput(spread, "4.2", "range", "fill-spread");
      }
      return { applicable: false, reason: "no post-processing effect available" };
    }

    if (action === "second-color") {
      await openSection(panel, /Post-processing|Live Preview Edits/i);
      const scopes = [
        panel.querySelector('[data-output-polish-subcontrols="gradient-fill"]'),
        panel.querySelector('[data-output-polish-subcontrols="pattern-fill"]'),
        panel.querySelector('[data-output-polish-group="fill-effects"]'),
        findLayerControls(panel),
      ].filter(Boolean);
      for (const scope of scopes) {
        const input = Array.from(scope.querySelectorAll('input[type="color"]')).find(visible);
        if (input) return setInput(input, options.color || "#22c55e", "color");
      }
      return { applicable: false, reason: "second color input unavailable" };
    }

    if (action === "second-slider") {
      await openSection(panel, /Post-processing|Layer colors|Output colors|Live Preview Edits/i);
      const ranges = Array.from(panel.querySelectorAll('input[type="range"]'))
        .filter(visible)
        .filter((input) => !/Trace|Threshold|Turd|Tolerance|Region|Layer count|Max|Detail/i.test(labelFor(input)));
      const input =
        ranges.find((candidate) => /Angle|Spacing|Fill spread|Border thickness/i.test(labelFor(candidate))) ||
        ranges.find((candidate) => /Opacity/i.test(labelFor(candidate))) ||
        ranges[0];
      if (!input) return { applicable: false, reason: "second slider unavailable" };
      const min = Number(input.min || 0);
      const max = Number(input.max || 100);
      const current = Number(input.value || min);
      const delta = Math.max(Number(input.step || 1), (max - min) * 0.2);
      const next = current + delta <= max ? current + delta : Math.max(min, current - delta);
      return setInput(input, String(Number(next.toFixed(3))), "range", labelFor(input));
    }

    if (action === "reset-output-polish") {
      const controls = panel.querySelector('[data-post-processing-controls="true"]');
      if (!visible(controls)) return { applicable: false, reason: "output polish controls unavailable" };
      const button = Array.from(controls.querySelectorAll("button")).find((candidate) =>
        visible(candidate) && !candidate.disabled && /^Reset$/i.test(text(candidate))
      );
      if (!button) return { applicable: false, reason: "output polish reset unavailable or disabled" };
      button.scrollIntoView({ block: "center", inline: "nearest" });
      button.click();
      await nextFrame();
      return { applicable: true, changed: true, reset: "output-polish" };
    }

    return { applicable: false, reason: "unknown action" };

    function findSettingsPanel() {
      return document.querySelector('[data-editor-settings-panel="true"], [id^="output-settings-"]:not([id^="output-settings-panel-"])');
    }
    function findLayerControls(root) {
      const marked = root.querySelector('[data-layer-palette-editor="true"]');
      if (visible(marked)) return marked;
      return sectionFor(root, /^Layer colors$/i);
    }
    function sectionFor(root, pattern) {
      const controls = Array.from(root.querySelectorAll("button, summary"));
      const target = controls.find((candidate) => visible(candidate) && pattern.test(text(candidate)));
      return target?.closest("[data-settings-section]") || null;
    }
    async function openSection(root, pattern) {
      const controls = Array.from(root.querySelectorAll("button, summary"));
      const target =
        controls.find((candidate) =>
          visible(candidate) &&
          pattern.test(text(candidate)) &&
          candidate.closest("[data-settings-section]")
        ) ||
        controls.find((candidate) => visible(candidate) && pattern.test(text(candidate)));
      if (!target) return false;
      const section = target.closest("[data-settings-section]");
      if (
        section?.getAttribute("data-settings-section-open") === "true" ||
        target.getAttribute("aria-expanded") === "true"
      ) {
        return true;
      }
      target.scrollIntoView({ block: "center", inline: "nearest" });
      target.click();
      await nextFrame();
      return true;
    }
    async function ensureToggle(root, pattern) {
      const labels = Array.from(root.querySelectorAll("label"));
      const found = labels
        .map((label) => ({ label, input: label.querySelector('input[type="checkbox"]') }))
        .find(({ label, input }) => input && visible(input) && pattern.test(text(label)));
      let changed = false;
      if (found && !found.input.checked) {
        found.label.scrollIntoView({ block: "center", inline: "nearest" });
        found.input.click();
        await nextFrame();
        changed = true;
      }
      return { found: Boolean(found), changed };
    }
    async function clickCheckboxLabel(root, pattern) {
      const labels = Array.from(root.querySelectorAll("label"));
      const found = labels
        .map((label) => ({ label, input: label.querySelector('input[type="checkbox"]') }))
        .find(({ label, input }) => input && visible(input) && pattern.test(text(label)));
      if (!found) return null;
      const before = Boolean(found.input.checked);
      if (!before) {
        found.label.scrollIntoView({ block: "center", inline: "nearest" });
        found.input.click();
        await nextFrame();
      }
      return { before, after: Boolean(found.input.checked) };
    }
    function findRangeByLabel(root, pattern) {
      return Array.from(root.querySelectorAll('input[type="range"]')).find((input) =>
        visible(input) && pattern.test(labelFor(input))
      );
    }
    function setInput(input, value, kind, editLabel = "") {
      const before = input.value;
      input.scrollIntoView({ block: "center", inline: "nearest" });
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(input, String(value));
      else input.value = String(value);
      const event =
        typeof InputEvent === "function"
          ? new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: String(value) })
          : new Event("input", { bubbles: true });
      input.dispatchEvent(event);
      input.dispatchEvent(new Event("change", { bubbles: true }));
      if (typeof PointerEvent === "function") input.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      input.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      input.blur();
      return nextFrame().then(() => ({
        applicable: true,
        changed: before !== input.value,
        before,
        after: input.value,
        inputKind: kind,
        label: editLabel || labelFor(input),
      }));
    }
    function setSelect(select, value) {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      if (setter) setter.call(select, String(value));
      else select.value = String(value);
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    async function setTextInput(input, value, editLabel = "") {
      const before = input.value;
      input.scrollIntoView({ block: "center", inline: "nearest" });
      input.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(input, String(value));
      else input.value = String(value);
      const event =
        typeof InputEvent === "function"
          ? new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: String(value) })
          : new Event("input", { bubbles: true });
      input.dispatchEvent(event);
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await nextFrame();
      await new Promise((resolve) => setTimeout(resolve, 180));
      input.blur();
      await nextFrame();
      return {
        applicable: true,
        changed: before !== input.value,
        before,
        after: input.value,
        inputKind: "text",
        label: editLabel || labelFor(input),
      };
    }
    function labelFor(element) {
      return text(element.closest("label")) || element.getAttribute("aria-label") || element.getAttribute("title") || "";
    }
    function text(element) {
      return (element?.innerText || element?.textContent || element?.getAttribute?.("aria-label") || "")
        .replace(/\\s+/g, " ")
        .trim();
    }
    function visible(element) {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && !element.disabled;
    }
    function nextFrame() {
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
  })()`, 12_000);
}

async function performLayerColorEdit(client, options = {}) {
  const color = options.color || "#0ea5e9";
  const target = await evaluate(client, `(async () => {
    function findSettingsPanel() {
      return document.querySelector('[data-editor-settings-panel="true"], [id^="output-settings-"]:not([id^="output-settings-panel-"])');
    }
    function findLayerControls(root) {
      const marked = root.querySelector('[data-layer-palette-editor="true"]');
      if (visible(marked)) return marked;
      return sectionFor(root, /^Layer colors$/i);
    }
    function sectionFor(root, pattern) {
      const controls = Array.from(root.querySelectorAll("button, summary"));
      const target = controls.find((candidate) => visible(candidate) && pattern.test(text(candidate)));
      return target?.closest("[data-settings-section]") || null;
    }
    async function openSection(root, pattern) {
      const controls = Array.from(root.querySelectorAll("button, summary"));
      const target =
        controls.find((candidate) =>
          visible(candidate) &&
          pattern.test(text(candidate)) &&
          candidate.closest("[data-settings-section]")
        ) ||
        controls.find((candidate) => visible(candidate) && pattern.test(text(candidate)));
      if (!target) return false;
      const section = target.closest("[data-settings-section]");
      if (
        section?.getAttribute("data-settings-section-open") === "true" ||
        target.getAttribute("aria-expanded") === "true"
      ) {
        return true;
      }
      target.scrollIntoView({ block: "center", inline: "nearest" });
      target.click();
      await nextFrame();
      return true;
    }
    function labelFor(element) {
      return text(element.closest("label")) || element.getAttribute("aria-label") || element.getAttribute("title") || "";
    }
    function text(element) {
      return (element?.innerText || element?.textContent || element?.getAttribute?.("aria-label") || "")
        .replace(/\\s+/g, " ")
        .trim();
    }
    function visible(element) {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && !element.disabled;
    }
    function nextFrame() {
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    const panel = findSettingsPanel();
    if (!panel) throw new Error("settings panel missing");
    await openSection(panel, /^Layer colors$/i);
    const palette = findLayerControls(panel);
    if (!palette) return { applicable: false, reason: "layer color controls unavailable" };
    const colorInput = Array.from(palette.querySelectorAll('input[type="color"]')).find(visible);
    if (colorInput) {
      colorInput.scrollIntoView({ block: "center", inline: "nearest" });
      colorInput.focus();
      window.__cumulativeLayerColorInput = colorInput;
      window.__cumulativeLayerColorBefore = colorInput.value;
      return {
        applicable: true,
        before: colorInput.value,
        inputKind: "color",
        label: labelFor(colorInput),
      };
    }
    const textInput = Array.from(palette.querySelectorAll('input[type="text"]')).find(visible);
    if (textInput) {
      textInput.scrollIntoView({ block: "center", inline: "nearest" });
      textInput.focus();
      textInput.select();
      window.__cumulativeLayerColorInput = textInput;
      window.__cumulativeLayerColorBefore = textInput.value;
      return {
        applicable: true,
        before: textInput.value,
        inputKind: "text",
        label: labelFor(textInput) || "layer-color-text",
      };
    }
    return { applicable: false, reason: "layer color input unavailable" };
  })()`, 12_000);

  if (!target?.applicable) return target;

  if (target.inputKind === "text") {
    await client.send(
      "Input.dispatchKeyEvent",
      { type: "keyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 },
      8_000,
    );
    await client.send(
      "Input.dispatchKeyEvent",
      { type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 },
      8_000,
    );
    for (const char of color) {
      await client.send(
        "Input.dispatchKeyEvent",
        { type: "char", text: char, unmodifiedText: char },
        8_000,
      );
    }
    await evaluate(client, `(() => {
      const input = window.__cumulativeLayerColorInput;
      if (!input) return;
      const value = input.value;
      const event =
        typeof InputEvent === "function"
          ? new InputEvent("input", { bubbles: true, inputType: "insertText", data: value })
          : new Event("input", { bubbles: true });
      input.dispatchEvent(event);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    })()`, 12_000);
    await delay(240);
    await client.send(
      "Input.dispatchKeyEvent",
      { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 },
      8_000,
    );
    await client.send(
      "Input.dispatchKeyEvent",
      { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 },
      8_000,
    );
    await delay(120);
  } else {
    await evaluate(client, `(() => {
      const input = window.__cumulativeLayerColorInput;
      const value = ${JSON.stringify(color)};
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (setter) setter.call(input, value);
      else input.value = value;
      input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: value }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    })()`, 12_000);
    await delay(180);
  }

  return evaluate(client, `(async () => {
    const input = window.__cumulativeLayerColorInput;
    const before = window.__cumulativeLayerColorBefore;
    if (!input) return { applicable: false, reason: "layer color input lost focus" };
    input.blur();
    await new Promise((resolve) => setTimeout(resolve, 160));
    const after = input.value;
    delete window.__cumulativeLayerColorInput;
    delete window.__cumulativeLayerColorBefore;
    return {
      applicable: true,
      changed: before !== after,
      before,
      after,
      inputKind: ${JSON.stringify(target.inputKind)},
      label: ${JSON.stringify(target.label || "layer color")},
    };
  })()`, 12_000);
}

async function copyAndDownloadCurrentOutput(client, expectedPreview) {
  const beforeClipboard = await getClipboardWrites(client);
  const copyStart = performance.now();
  const copyClick = await clickButtonInFocusedEditor(client, [/Copy SVG/i, /^Copy$/i], [/Copied/i]);
  if (!copyClick) throw new Error("copy control not found");
  const copy = await waitForValue(
    client,
    () => `(() => {
      const writes = window.__CUMULATIVE_EDIT_PERF__?.clipboardWrites || [];
      const latest = writes[writes.length - 1] || "";
      return {
        count: writes.length,
        bytes: new Blob([latest]).size,
        hash: hashString(latest),
        matchesPreviewHash: latest && hashString(latest) === ${JSON.stringify(expectedPreview.hash)} && new Blob([latest]).size === ${JSON.stringify(expectedPreview.bytes)},
      };
      function hashString(value) {
        let hash = 2166136261;
        for (let index = 0; index < value.length; index += 1) {
          hash ^= value.charCodeAt(index);
          hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16);
      }
    })()`,
    8_000,
    (value) => value?.count > beforeClipboard.length,
  );
  const copyMs = performance.now() - copyStart;

  await fs.rm(downloadsDir, { recursive: true, force: true });
  await fs.mkdir(downloadsDir, { recursive: true });
  const downloadStart = performance.now();
  const downloadClick = await clickButtonInFocusedEditor(client, [/Download SVG/i, /^Download\b/i], [/ZIP/i]);
  if (!downloadClick) throw new Error("download control not found");
  const file = await waitForDownloadedSvg(10_000);
  const svg = await fs.readFile(file, "utf8");
  const downloadMs = performance.now() - downloadStart;
  const download = {
    file,
    bytes: Buffer.byteLength(svg),
    hash: hashString(svg),
    matchesPreviewHash:
      hashString(svg) === expectedPreview.hash &&
      Buffer.byteLength(svg) === expectedPreview.bytes,
  };

  return {
    copyClick,
    copyMs,
    copyBytes: copy.bytes,
    copyHash: copy.hash,
    copyMatchedPreviewHash: Boolean(copy.matchesPreviewHash),
    downloadClick,
    downloadMs,
    downloadBytes: download.bytes,
    downloadHash: download.hash,
    downloadMatchedPreviewHash: Boolean(download.matchesPreviewHash),
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
        visibleColorInputs: visibleElements(panel, 'input[type="color"]').length,
        visibleRangeInputs: visibleElements(panel, 'input[type="range"]').length,
      };
      function visibleElements(root, selector) {
        return Array.from((root || document).querySelectorAll(selector)).filter(isVisible);
      }
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
  return { applicable: true, changed: false, clicked, ...panel };
}

async function focusedPreviewSnapshot(client) {
  return evaluate(client, `(async () => {
    const workspace = document.querySelector('[data-focused-editor-workspace="true"]') || latestCard(Array.from(document.querySelectorAll("[data-output-stamp]"))) || document;
    const image = workspace.querySelector('[data-editor-output-preview="true"] img, img');
    const svg = await decodeSvgImage(image);
    const duplicateEffectCounts = svg ? countDuplicateEffectMarkers(svg) : {};
    return {
      exists: Boolean(svg),
      bytes: new Blob([svg]).size,
      chars: svg.length,
      hash: hashString(svg),
      pathCount: countMatches(svg, /<path\\b/gi),
      layerCount: countMatches(svg, /\\bdata-(?:layer-id|fill-layer-id|stroke-layer-id)=|<g\\b[^>]*\\bdata-layer-name=/gi),
      activeEditStateCount: svg ? (
        duplicateEffectCounts.postProcessingGroups +
        duplicateEffectCounts.editorOpacityAttrs +
        duplicateEffectCounts.layerColorAttrs +
        countMatches(svg, /\\bstyle=["'][^"']*(?:fill|stroke)\\s*:/gi)
      ) : 0,
      duplicateEffectCounts,
      previewUpdateCount: window.__CUMULATIVE_EDIT_PERF__?.previewUpdates || 0,
      sample: svg.slice(0, 1000),
    };
    async function decodeSvgImage(image) {
      const src = image?.getAttribute("src") || "";
      if (src.startsWith("blob:")) {
        try {
          const response = await fetch(src);
          return response.ok ? await response.text() : "";
        } catch {
          return "";
        }
      }
      if (!src.startsWith("data:image/svg+xml")) return "";
      const comma = src.indexOf(",");
      if (comma < 0) return "";
      try {
        return decodeURIComponent(src.slice(comma + 1));
      } catch {
        return "";
      }
    }
    function countDuplicateEffectMarkers(value) {
      return {
        postProcessingGroups: countMatches(value, /\\bdata-post-processing=/gi),
        stickerBorders: countMatches(value, /\\bdata-post-processing=["']sticker-border["']/gi),
        internalGapFills: countMatches(value, /\\bdata-post-processing=["']internal-gap-fill["']/gi),
        shadowEffects: countMatches(value, /\\bdata-post-processing=["']shadow-effect["']/gi),
        gradients: countMatches(value, /<(?:linearGradient|radialGradient)\\b/gi),
        patterns: countMatches(value, /<pattern\\b/gi),
        filters: countMatches(value, /<filter\\b/gi),
        editorOpacityAttrs: countMatches(value, /\\bdata-editor-opacity=/gi),
        layerColorAttrs: countMatches(value, /\\bdata-layer-color=/gi),
      };
    }
    function countMatches(value, pattern) {
      return (String(value || "").match(pattern) || []).length;
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
      const number = Number(String(value || "").replace(/[^0-9.]/g, ""));
      return Number.isFinite(number) ? number : 0;
    }
    function hashString(value) {
      let hash = 2166136261;
      for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16);
    }
  })()`, 12_000);
}

async function waitForPreviewChange(client, previous, timeoutMs) {
  if (!previous?.exists) {
    await delay(250);
    return focusedPreviewSnapshot(client);
  }
  const previousUpdates = Number(previous.previewUpdateCount || 0);
  return waitForValue(
    client,
    () => `(() => {
      const previewUpdates = window.__CUMULATIVE_EDIT_PERF__?.previewUpdates || 0;
      return {
        changed: previewUpdates > ${JSON.stringify(previousUpdates)},
        previewUpdates,
      };
    })()`,
    timeoutMs,
    (value) => value?.changed,
  );
}

function hasRunawayDuplicateEffects(snapshot) {
  const counts = snapshot?.duplicateEffectCounts || {};
  return (
    counts.stickerBorders > 1 ||
    counts.internalGapFills > 1 ||
    counts.shadowEffects > 1 ||
    counts.gradients > 1 ||
    counts.patterns > 1
  );
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
      state.latestChanged &&
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
  return { selected: null, reason: "No matching heavy layered preset button was visible." };
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
      latestJobStatus: latest ? latest.getAttribute("data-job-status") || null : null,
      latestSvgBytes: latest ? numberOrNull(latest.getAttribute("data-svg-bytes")) : null,
      latestPathCount: latest ? numberOrNull(latest.getAttribute("data-path-count")) : null,
    };
    function isActiveCard(card) {
      return /queued|running/i.test(card.getAttribute("data-job-status") || "") ||
        /\\b(Queued|Running|Converting|Creating)\\b/i.test(card.innerText || "");
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
    (value) => value?.bodyHasName && (value?.enabledConvert || value?.outputCards > 0),
  );
}

async function visibleButtonLabels(client) {
  return evaluate(client, `(() => Array.from(document.querySelectorAll("button, [role='button'], summary"))
    .filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    })
    .map((element) => ({
      text: (element.innerText || element.textContent || element.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim(),
      disabled: Boolean(element.disabled),
    }))
    .filter((item) => item.text))()`, 8_000);
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
    const focused = document.querySelector('[data-focused-editor-workspace="true"]');
    const preview = focused ? await previewSnapshot(focused) : await previewSnapshot(latest || document);
    const perf = window.__CUMULATIVE_EDIT_PERF__ || {};
    return {
      pageAlive: true,
      href: location.href,
      domNodes: document.querySelectorAll("*").length,
      outputCardCount: cards.length,
      settingsPanelCount: visibleElements('[data-editor-settings-panel="true"], [id^="output-settings-"]:not([id^="output-settings-panel-"])').length,
      focusedEditorVisible: Boolean(focused),
      outputSvgByteSize: latest ? numberOrNull(latest.getAttribute("data-svg-bytes")) : null,
      pathCount: latest ? numberOrNull(latest.getAttribute("data-path-count")) : null,
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
      preview,
      previewUpdates: perf.previewUpdates || 0,
      longTaskCount: (perf.longTasks || []).length,
      longTaskTotalMs: (perf.longTasks || []).reduce((sum, task) => sum + Number(task.duration || 0), 0),
      duplicateEffectCounts: preview.duplicateEffectCounts,
    };
    async function previewSnapshot(root) {
      const image = root?.querySelector?.('[data-editor-output-preview="true"] img, img');
      const svg = await decodeSvgImage(image);
      const duplicateEffectCounts = svg ? countDuplicateEffectMarkers(svg) : {};
      return {
        exists: Boolean(svg),
        bytes: new Blob([svg]).size,
        hash: hashString(svg),
        pathCount: countMatches(svg, /<path\\b/gi),
        layerCount: countMatches(svg, /\\bdata-(?:layer-id|fill-layer-id|stroke-layer-id)=|<g\\b[^>]*\\bdata-layer-name=/gi),
        activeEditStateCount: svg ? (
          duplicateEffectCounts.postProcessingGroups +
          duplicateEffectCounts.editorOpacityAttrs +
          duplicateEffectCounts.layerColorAttrs
        ) : 0,
        duplicateEffectCounts,
      };
    }
    async function decodeSvgImage(image) {
      const src = image?.getAttribute("src") || "";
      if (src.startsWith("blob:")) {
        try {
          const response = await fetch(src);
          return response.ok ? await response.text() : "";
        } catch {
          return "";
        }
      }
      if (!src.startsWith("data:image/svg+xml")) return "";
      const comma = src.indexOf(",");
      if (comma < 0) return "";
      try { return decodeURIComponent(src.slice(comma + 1)); } catch { return ""; }
    }
    function countDuplicateEffectMarkers(value) {
      return {
        postProcessingGroups: countMatches(value, /\\bdata-post-processing=/gi),
        stickerBorders: countMatches(value, /\\bdata-post-processing=["']sticker-border["']/gi),
        internalGapFills: countMatches(value, /\\bdata-post-processing=["']internal-gap-fill["']/gi),
        shadowEffects: countMatches(value, /\\bdata-post-processing=["']shadow-effect["']/gi),
        gradients: countMatches(value, /<(?:linearGradient|radialGradient)\\b/gi),
        patterns: countMatches(value, /<pattern\\b/gi),
        filters: countMatches(value, /<filter\\b/gi),
        editorOpacityAttrs: countMatches(value, /\\bdata-editor-opacity=/gi),
        layerColorAttrs: countMatches(value, /\\bdata-layer-color=/gi),
      };
    }
    function countMatches(value, pattern) {
      return (String(value || "").match(pattern) || []).length;
    }
    function visibleElements(selector) {
      return Array.from(document.querySelectorAll(selector)).filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
    }
    function isActiveCard(card) {
      return /queued|running/i.test(card.getAttribute("data-job-status") || "") ||
        /\\b(Queued|Running|Converting|Creating)\\b/i.test(card.innerText || "");
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
    function hashString(value) {
      let hash = 2166136261;
      for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
      return (hash >>> 0).toString(16);
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

function summarizeMetrics(metrics) {
  if (!metrics) return null;
  return {
    pageAlive: metrics.pageAlive,
    error: metrics.error,
    domNodes: metrics.domNodes,
    outputCardCount: metrics.outputCardCount,
    settingsPanelCount: metrics.settingsPanelCount,
    focusedEditorVisible: metrics.focusedEditorVisible,
    outputSvgByteSize: metrics.outputSvgByteSize,
    pathCount: metrics.pathCount,
    visibleColorInputs: metrics.visibleColorInputs,
    visibleRangeInputs: metrics.visibleRangeInputs,
    previewBytes: metrics.preview?.bytes,
    previewHash: metrics.preview?.hash,
    previewPathCount: metrics.preview?.pathCount,
    previewLayerCount: metrics.preview?.layerCount,
    activeEditStateCount: metrics.preview?.activeEditStateCount,
    duplicateEffectCounts: metrics.duplicateEffectCounts || metrics.preview?.duplicateEffectCounts,
    previewUpdates: metrics.previewUpdates,
    longTaskCount: metrics.longTaskCount,
    longTaskTotalMs: metrics.longTaskTotalMs,
    browserMetrics: metrics.browserMetrics,
  };
}

async function installObservers(client) {
  await evaluate(client, `(() => {
    window.__CUMULATIVE_EDIT_PERF__ = {
      longTasks: [],
      clipboardWrites: [],
      phase: "setup",
      previewUpdates: 0,
    };
    if ("PerformanceObserver" in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__CUMULATIVE_EDIT_PERF__.longTasks.push({
              phase: window.__CUMULATIVE_EDIT_PERF__.phase || "unknown",
              name: entry.name,
              startTime: Math.round(entry.startTime),
              duration: Math.round(entry.duration),
            });
          }
        });
        observer.observe({ type: "longtask", buffered: true });
        window.__CUMULATIVE_EDIT_PERF__.observer = observer;
      } catch {}
    }
    try {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "attributes" && mutation.attributeName === "src" && mutation.target?.tagName === "IMG") {
            window.__CUMULATIVE_EDIT_PERF__.previewUpdates += 1;
          }
        }
      });
      observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["src"] });
      window.__CUMULATIVE_EDIT_PERF__.previewObserver = observer;
    } catch {}
    return true;
  })()`);
}

async function setPerfPhase(client, phase) {
  await evaluate(client, `(() => {
    if (!window.__CUMULATIVE_EDIT_PERF__) {
      window.__CUMULATIVE_EDIT_PERF__ = { longTasks: [], clipboardWrites: [], previewUpdates: 0 };
    }
    window.__CUMULATIVE_EDIT_PERF__.phase = ${JSON.stringify(phase)};
    return true;
  })()`);
}

async function getPerfState(client) {
  return evaluate(client, `(() => window.__CUMULATIVE_EDIT_PERF__ || null)()`, 8_000);
}

async function installClipboardCapture(client) {
  await evaluate(client, `(() => {
    if (!window.__CUMULATIVE_EDIT_PERF__) {
      window.__CUMULATIVE_EDIT_PERF__ = { longTasks: [], clipboardWrites: [], phase: "setup", previewUpdates: 0 };
    }
    const capture = async (text) => {
      window.__CUMULATIVE_EDIT_PERF__.clipboardWrites.push(String(text || ""));
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

async function getClipboardWrites(client) {
  return evaluate(client, `(() => window.__CUMULATIVE_EDIT_PERF__?.clipboardWrites || [])()`, 8_000);
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
  const pngFixturePath = userFixtureAvailable
    ? userFixturePath
    : path.join(fixturesDir, "generated-heavy-layered-input.png");
  if (!userFixtureAvailable) {
    await sharp(Buffer.from(buildScreenshotLikeSvg())).png().toFile(pngFixturePath);
  }
  const [pngStat, pngMetadata] = await Promise.all([
    fs.stat(pngFixturePath),
    sharp(pngFixturePath, { limitInputPixels: false })
      .metadata()
      .catch(() => ({})),
  ]);
  const jpgFixturePath = path.join(fixturesDir, "heavy-layered-route-copy.jpg");
  await sharp(pngFixturePath, { limitInputPixels: false })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(jpgFixturePath);
  const [jpgStat, jpgMetadata] = await Promise.all([
    fs.stat(jpgFixturePath),
    sharp(jpgFixturePath, { limitInputPixels: false })
      .metadata()
      .catch(() => ({})),
  ]);
  return {
    png: {
      path: pngFixturePath,
      info: {
        requestedPath: userFixturePath,
        path: pngFixturePath,
        basename: path.basename(pngFixturePath),
        source: userFixtureAvailable ? "real-user-fixture" : "generated-fallback",
        usedUserFixture: userFixtureAvailable,
        bytes: pngStat.size,
        width: pngMetadata.width || null,
        height: pngMetadata.height || null,
        format: pngMetadata.format || path.extname(pngFixturePath).slice(1),
      },
    },
    jpg: {
      path: jpgFixturePath,
      info: {
        requestedPath: userFixturePath,
        path: jpgFixturePath,
        basename: path.basename(jpgFixturePath),
        source: userFixtureAvailable ? "real-user-fixture-jpg-derivative" : "generated-fallback-jpg-derivative",
        usedUserFixture: userFixtureAvailable,
        derivedFrom: pngFixturePath,
        bytes: jpgStat.size,
        width: jpgMetadata.width || null,
        height: jpgMetadata.height || null,
        format: jpgMetadata.format || path.extname(jpgFixturePath).slice(1),
      },
    },
  };
}

function buildScreenshotLikeSvg() {
  const chips = Array.from({ length: 72 }, (_, index) => {
    const x = 48 + (index % 9) * 152;
    const y = 120 + Math.floor(index / 9) * 108;
    const hue = (index * 37) % 360;
    return `<g><rect x="${x}" y="${y}" width="118" height="70" rx="10" fill="hsl(${hue} 82% 57%)"/><circle cx="${x + 24}" cy="${y + 22}" r="12" fill="#ffffff" opacity=".78"/><path d="M${x + 14} ${y + 54} C${x + 42} ${y + 32} ${x + 76} ${y + 72} ${x + 106} ${y + 36}" fill="none" stroke="#111827" stroke-width="5" stroke-linecap="round"/></g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1080" viewBox="0 0 1440 1080"><rect width="1440" height="1080" fill="#f8fafc"/><rect x="28" y="32" width="1384" height="996" rx="32" fill="#ffffff" stroke="#cbd5e1" stroke-width="8"/><text x="70" y="86" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#0f172a">Heavy layered SVG fixture</text>${chips}<g opacity=".7">${Array.from({ length: 28 }, (_, index) => `<path d="M${70 + index * 48} 960 l26 -34 l30 52 l20 -28" fill="none" stroke="#334155" stroke-width="${2 + (index % 5)}" stroke-linecap="round"/>`).join("")}</g></svg>`;
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

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function formatMs(value) {
  return Number.isFinite(value) ? `${Math.round(value)}ms` : "n/a";
}

function formatNumber(value) {
  return Number.isFinite(value) ? Number(value).toFixed(2) : "n/a";
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
    benchmarkKind: "cumulative-edit-performance",
    baseUrl,
    checkedAt: new Date().toISOString(),
    fatal: error instanceof Error ? error.message : String(error),
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true }).catch(() => {});
  await fs.writeFile(reportPath, JSON.stringify(fatal, null, 2)).catch(() => {});
  console.error(JSON.stringify(fatal, null, 2));
  process.exit(1);
});
