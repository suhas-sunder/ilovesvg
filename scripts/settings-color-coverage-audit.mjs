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
const tmpRunDir = path.join(os.tmpdir(), "ilovesvg-settings-color-coverage", String(debugPort));
const profileDir = path.join(tmpRunDir, "profile");
const fixturesDir = path.join(rootDir, "tmp", "settings-color-coverage-fixtures");
const reportPath = process.env.SETTINGS_COLOR_COVERAGE_REPORT_PATH
  ? path.resolve(process.env.SETTINGS_COLOR_COVERAGE_REPORT_PATH)
  : path.join(rootDir, "tmp", "settings-color-coverage-audit.json");
const FLAT_COLOR_MAX_EDITABLE_GROUPS = 32;
const FLAT_COLOR_RAW_EXPOSURE_REGRESSION_THRESHOLD = 160;
const userFixturePath =
  process.env.SETTINGS_COLOR_COVERAGE_FIXTURE ||
  "C:\\Users\\Suhas\\Downloads\\Screenshot 2026-05-06 194041.png";

const scenarios = [
  {
    id: "home-layered-flat-color",
    route: "/",
    fixtureKind: "png",
    presetPatterns: [/^Layered - Flat Color\b/i],
    presetLabel: "Layered - Flat Color",
    conversionTimeoutMs: 240_000,
  },
  {
    id: "png-layered-flat-color",
    route: "/png-to-layered-svg-for-cricut",
    fixtureKind: "png",
    presetPatterns: [/^Layered - Flat Color\b/i],
    presetLabel: "Layered - Flat Color",
    conversionTimeoutMs: 240_000,
  },
  {
    id: "jpg-layered-flat-color",
    route: "/jpg-to-layered-svg-for-cricut",
    fixtureKind: "jpg",
    presetPatterns: [/^Layered - Flat Color\b/i, /^Layered color SVG\b/i],
    presetLabel: "Layered - Flat Color or equivalent layered color preset",
    conversionTimeoutMs: 240_000,
  },
].filter((scenario) => {
  const filter = process.env.SETTINGS_COLOR_COVERAGE_ROUTE_FILTER || "";
  return !filter || filter === scenario.id || filter === scenario.route;
});

async function main() {
  if (!scenarios.length) {
    throw new Error("No settings color coverage scenarios selected.");
  }

  await fs.rm(tmpRunDir, { recursive: true, force: true });
  await fs.mkdir(profileDir, { recursive: true });
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  const [server, git, fixture, staticFindings] = await Promise.all([
    serverState(),
    gitState(),
    prepareFixture(),
    collectStaticFindings(),
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
      console.error(`[settings-color-coverage] ${scenario.id}`);
      const result = await runScenario(scenario, fixture).catch((error) => ({
        id: scenario.id,
        route: scenario.route,
        preset: scenario.presetLabel,
        fixture: scenario.fixtureKind === "jpg" ? fixture.jpg.info : fixture.png.info,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
        steps: error?.steps || [],
      }));
      results.push(result);
    }
  } finally {
    browser.kill();
    await fs.rm(tmpRunDir, { recursive: true, force: true }).catch(() => {});
  }

  const summary = summarizeResults(results, staticFindings);
  const ok = results.every((result) => result.ok) && summary.ok;
  const report = {
    schemaVersion: 1,
    auditKind: "settings-color-layer-coverage",
    checkedAt: new Date().toISOString(),
    baseUrl,
    server,
    git,
    fixture,
    staticFindings,
    scenarios: results,
    summary,
  };

  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ok,
    reportPath,
    scenarioCount: results.length,
    summary,
  }, null, 2));

  if (!ok) {
    process.exitCode = 1;
  }
}

async function runScenario(scenario, fixture) {
  const file = scenario.fixtureKind === "jpg" ? fixture.jpg : fixture.png;
  const steps = [];
  async function step(name, fn) {
    const started = performance.now();
    try {
      const value = await fn();
      steps.push({ name, ok: true, ms: Math.round(performance.now() - started) });
      return value;
    } catch (error) {
      steps.push({
        name,
        ok: false,
        ms: Math.round(performance.now() - started),
        error: error instanceof Error ? error.message : String(error),
      });
      if (error && typeof error === "object") error.steps = steps;
      throw error;
    }
  }

  const client = await step("open tab", () => openTab(`${baseUrl}${scenario.route}`));
  try {
    await step("enable page", () => enablePage(client));
    await step("reset browser state", () => resetScenarioBrowserState(client));
    await step("wait for document ready", () => waitForDocumentReady(client));
    await step("install copy/download capture", () => installCopyDownloadCapture(client));
    const selectedPreset = await step("select preset", () => selectPreset(client, scenario.presetPatterns));
    if (!selectedPreset.selected) {
      return {
        id: scenario.id,
        route: scenario.route,
        preset: scenario.presetLabel,
        selectedPreset,
        fixture: file.info,
        ok: true,
        skipped: true,
        skipReason: selectedPreset.reason || "Preset was not visible on this route.",
        steps,
      };
    }
    await step("set file input", () => setFileInput(client, file.path));
    await step("settle initial auto conversion", () => settleInitialAutoConversion(client, scenario.conversionTimeoutMs).catch(() => null));

    const beforeConvertState = await step("read state before convert", () => outputState(client).catch(() => ({ latestStamp: null })));
    let completed = beforeConvertState;
    if (!beforeConvertState?.latestReady || beforeConvertState.activeJobs > 0 || beforeConvertState.latestStamp == null) {
      await step("click convert", () => clickConvert(client));
      completed = await step("wait for completed output", () => waitForCompletedOutput(
        client,
        beforeConvertState.latestStamp,
        scenario.conversionTimeoutMs,
        { requireLatestChanged: true },
      ));
    }

    await step("open latest settings panel", () => openLatestSettingsPanel(client));
    await step("open layer colors", () => ensureSettingsSectionOpen(client, /Layer colors/i, "layer-colors"));
    const beforeHideSnapshot = await step("collect layer section snapshot", () =>
      collectCoverageSnapshot(client, "layer-colors-before-hide"),
    );
    const parityEdit = await step("edit first layer for copy/download parity", () =>
      editFirstLayerForCopyDownloadParity(client),
    );
    await step("wait after parity edit", () =>
      waitForLayerEditPreview(client, parityEdit, beforeHideSnapshot.latestOutput?.svgBytesAttr),
    );
    const editedSnapshot = await step("collect edited layer snapshot", () =>
      collectCoverageSnapshot(client, "layer-colors-edited"),
    );
    const copyDownloadParity = await step("verify edited copy/download parity", () =>
      verifyCopyDownloadParity(client, editedSnapshot.svg || ""),
    );
    const hideAction = await step("hide all exposed layer colors", () => hideAllExposedLayerColors(client));
    await step("wait after hide", () => delay(800));
    const afterHideSnapshot = await step("collect after-hide snapshot", () =>
      collectCoverageSnapshot(client, "layer-colors-after-hide"),
    );

    const beforeSvgColors = analyzeSvgColors(beforeHideSnapshot.svg || "");
    const afterSvgColors = analyzeSvgColors(afterHideSnapshot.svg || "");
    const exposedLayerColors = new Set(beforeHideSnapshot.ui.layerColors.uniqueColors);
    const uncontrolledBefore = beforeSvgColors.colors
      .filter((entry) => !exposedLayerColors.has(entry.color))
      .map((entry) => ({
        color: entry.color,
        uses: entry.uses,
        channels: entry.channels,
        sources: entry.sources,
        tags: entry.tags,
      }));
    const remainingAfterHide = afterSvgColors.colors.map((entry) => ({
      color: entry.color,
      uses: entry.uses,
      channels: entry.channels,
      sources: entry.sources,
      tags: entry.tags,
    }));

    return {
      id: scenario.id,
      route: scenario.route,
      preset: scenario.presetLabel,
      selectedPreset,
      fixture: file.info,
      ok: true,
      steps,
      conversion: completed,
      latestOutput: beforeHideSnapshot.latestOutput,
      counts: {
        actualVisibleSvgColorsBeforeHide: beforeSvgColors.uniqueVisibleColorCount,
        actualVisibleSvgFillColorsBeforeHide: beforeSvgColors.uniqueFillColorCount,
        actualVisibleSvgStrokeColorsBeforeHide: beforeSvgColors.uniqueStrokeColorCount,
        visibleColorsAfterHidingAllExposedLayerColors: afterSvgColors.uniqueVisibleColorCount,
        layerMetadataColorsExposed: beforeHideSnapshot.ui.layerColors.uniqueColors.length,
        layerRowsExposed: beforeHideSnapshot.ui.layerColors.rowCount,
        liveRemoveDetectedOutputColorsPresent: beforeHideSnapshot.ui.sectionText.hasRemoveDetectedOutputColors ? 1 : 0,
        clickToConvertDetectedColorSwatches: beforeHideSnapshot.ui.detectedColorSwatches.count,
        fillTargetSelectorOptions: beforeHideSnapshot.ui.targetSelectors.fill?.optionCount ?? 0,
        fillTargetSelectorLayerOptions: beforeHideSnapshot.ui.targetSelectors.fill?.layerOptionCount ?? 0,
        fillTargetSelectorColorOptions: beforeHideSnapshot.ui.targetSelectors.fill?.colorOptionCount ?? 0,
        strokeTargetSelectorOptions: beforeHideSnapshot.ui.targetSelectors.stroke?.optionCount ?? 0,
        strokeTargetSelectorLayerOptions: beforeHideSnapshot.ui.targetSelectors.stroke?.layerOptionCount ?? 0,
        strokeTargetSelectorColorOptions: beforeHideSnapshot.ui.targetSelectors.stroke?.colorOptionCount ?? 0,
        pathTagsPaintColors: beforeSvgColors.pathTagsPaintColors.length,
        embeddedImageElements: beforeSvgColors.structural.imageCount,
        gradientElements: beforeSvgColors.structural.gradientCount,
        patternElements: beforeSvgColors.structural.patternCount,
      },
      missingOrUncontrolled: {
        baselineColorsNotRepresentedByLayerRows: uncontrolledBefore,
        visibleColorsRemainingAfterHidingExposedLayerRows: remainingAfterHide,
        missingColorCountBeforeHide: uncontrolledBefore.length,
        remainingColorCountAfterHide: remainingAfterHide.length,
      },
      svgAnalysisBeforeHide: beforeSvgColors,
      svgAnalysisAfterHide: afterSvgColors,
      copyDownloadParity,
      parityEdit,
      uiSnapshots: {
        layerColorsBeforeHide: withoutSvg(beforeHideSnapshot),
        layerColorsEdited: withoutSvg(editedSnapshot),
        layerColorsAfterHide: withoutSvg(afterHideSnapshot),
      },
      hideAction,
      diagnosis: diagnoseScenario(beforeSvgColors, afterSvgColors, beforeHideSnapshot),
    };
  } finally {
    await client.close().catch(() => {});
  }
}

function diagnoseScenario(beforeSvgColors, afterSvgColors, layerSnapshot) {
  const exposed = layerSnapshot.ui.layerColors.uniqueColors.length;
  const actual = beforeSvgColors.uniqueVisibleColorCount;
  const remaining = afterSvgColors.uniqueVisibleColorCount;

  const reasons = [];
  if (actual > exposed) {
    reasons.push("Actual SVG visible color count exceeds exposed layer metadata color count.");
  }
  if (remaining > 0) {
    reasons.push("Visible SVG colors remain after every exposed layer-color checkbox is turned off.");
  }
  if (beforeSvgColors.skipped.urlPaints > 0) {
    reasons.push("SVG contains url(...) paints such as gradients or patterns that are not layer-color targets.");
  }
  if (beforeSvgColors.structural.imageCount > 0) {
    reasons.push("SVG contains embedded image elements that layer color controls do not edit.");
  }
  if (beforeSvgColors.colors.some((entry) => entry.channels.includes("stroke"))) {
    reasons.push("SVG contains visible stroke paints. Stroke-only paints require stroke targets or stroke layer metadata.");
  }
  if (layerSnapshot.ui.sectionText.hasRemoveDetectedOutputColors) {
    reasons.push("Live Preview Edits still contains redundant Remove detected output colors.");
  }

  return {
    exposedLayerRowsRepresentAllVisibleColors: actual <= exposed,
    visibleColorsRemainAfterHide: remaining > 0,
    liveRemoveDetectedOutputColorsPresent: Boolean(layerSnapshot.ui.sectionText.hasRemoveDetectedOutputColors),
    reasons,
  };
}

function withoutSvg(snapshot) {
  const { svg, ...rest } = snapshot;
  return {
    ...rest,
    svgHash: svg ? hashString(svg) : null,
    svgBytes: svg ? Buffer.byteLength(svg) : 0,
  };
}

async function openLatestSettingsPanel(client) {
  const clicked = await clickButtonInLatestOutput(client, [/Settings\s*\/\s*Edit/i, /\bSettings\b/i], [/Download/i, /Copy/i]);
  if (!clicked) {
    throw new Error("Could not find Settings / Edit on the latest output card.");
  }
  return waitForValue(
    client,
    () => `(() => {
      const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
      if (!latest) return { open: false, reason: "no latest output" };
      const text = latest.innerText || "";
      const controls = latest.querySelectorAll('input[aria-label$=" hex color"], [data-post-processing-controls="true"], [data-settings-section]');
      return {
        open: controls.length > 0 || /Advanced settings|Layer colors|Output polish/i.test(text),
        controls: controls.length,
        text: text.replace(/\\s+/g, " ").slice(0, 300),
      };
      function latestCard(items) {
        return items.reduce((best, card) => {
          if (!best) return card;
          return numberOrNull(card.getAttribute("data-output-stamp")) >= numberOrNull(best.getAttribute("data-output-stamp")) ? card : best;
        }, null);
      }
      function numberOrNull(value) {
        const number = Number(String(value || "").replace(/[^0-9.]/g, ""));
        return Number.isFinite(number) ? number : 0;
      }
    })()`,
    10_000,
    (value) => value?.open,
  );
}

async function ensureSettingsSectionOpen(client, titlePattern, expectedKind) {
  const source = titlePattern.source;
  const sectionOpenTimeoutMs = 20_000;
  const result = await evaluate(client, `(() => {
    const pattern = new RegExp(${JSON.stringify(source)}, "i");
    const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
    if (!latest) return { ok: false, reason: "missing latest output card" };
    const buttons = Array.from(latest.querySelectorAll("button, summary"));
    const button = buttons.find((candidate) => {
      const text = (candidate.innerText || candidate.textContent || candidate.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
      return pattern.test(text) && isVisible(candidate);
    });
    if (!button) {
      return { ok: false, reason: "section button not found", expected: ${JSON.stringify(expectedKind)} };
    }
    const expanded = button.getAttribute("aria-expanded");
    if (expanded !== "true") {
      button.scrollIntoView({ block: "center", inline: "nearest" });
      button.click();
    }
    return { ok: true, expandedBefore: expanded, label: (button.innerText || button.textContent || "").replace(/\\s+/g, " ").trim() };

    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }
    function latestCard(items) {
      return items.reduce((best, card) => {
        if (!best) return card;
        return numberOrNull(card.getAttribute("data-output-stamp")) >= numberOrNull(best.getAttribute("data-output-stamp")) ? card : best;
      }, null);
    }
    function numberOrNull(value) {
      const number = Number(String(value || "").replace(/[^0-9.]/g, ""));
      return Number.isFinite(number) ? number : 0;
    }
  })()`, sectionOpenTimeoutMs);
  if (!result?.ok) {
    throw new Error(`Could not open settings section ${expectedKind}: ${result?.reason || "unknown"}`);
  }

  await delay(300);
  return waitForValue(
    client,
    () => `(() => {
      const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
      if (!latest) return { ready: false };
      const sectionOpen = Array.from(latest.querySelectorAll("[data-settings-section]")).some((section) =>
        section.getAttribute("data-settings-section-open") === "true" &&
        new RegExp(${JSON.stringify(source)}, "i").test(section.innerText || "")
      );
      const hasLayerRows = latest.querySelectorAll('input[type="text"][aria-label$=" hex color"]').length > 0;
      const hasRemoveRows = latest.querySelectorAll('input[type="checkbox"][aria-label^="Keep "], input[type="checkbox"][aria-label^="Restore "]').length > 0;
      return {
        ready: sectionOpen || (${JSON.stringify(expectedKind)} === "layer-colors" ? hasLayerRows : hasRemoveRows),
        sectionOpen,
        hasLayerRows,
        hasRemoveRows,
      };
      function latestCard(items) {
        return items.reduce((best, card) => {
          if (!best) return card;
          return numberOrNull(card.getAttribute("data-output-stamp")) >= numberOrNull(best.getAttribute("data-output-stamp")) ? card : best;
        }, null);
      }
      function numberOrNull(value) {
        const number = Number(String(value || "").replace(/[^0-9.]/g, ""));
        return Number.isFinite(number) ? number : 0;
      }
    })()`,
    sectionOpenTimeoutMs,
    (value) => value?.ready,
  );
}

async function collectCoverageSnapshot(client, phase) {
  return evaluate(client, `(() => {
    const cards = Array.from(document.querySelectorAll("[data-output-stamp]"));
    const latest = latestCard(cards);
    const svg = latest ? decodeLatestSvg(latest) : "";
    const ui = latest ? collectUi(latest) : emptyUi();
    return {
      phase: ${JSON.stringify(phase)},
      href: location.href,
      latestOutput: latest ? {
        stamp: numberOrNull(latest.getAttribute("data-output-stamp")),
        jobStatus: latest.getAttribute("data-job-status") || null,
        engineUsed: latest.getAttribute("data-engine-used") || null,
        layerBuildMode: latest.getAttribute("data-layer-build-mode") || null,
        requestedPaletteCount: numberOrNull(latest.getAttribute("data-requested-palette-count")),
        actualPaletteCount: numberOrNull(latest.getAttribute("data-actual-palette-count")),
        svgBytesAttr: numberOrNull(latest.getAttribute("data-svg-bytes")),
        pathCountAttr: numberOrNull(latest.getAttribute("data-path-count")),
        outputDetectedColorsAttr: latest.getAttribute("data-output-detected-colors") || null,
        text: (latest.innerText || "").replace(/\\s+/g, " ").slice(0, 900),
      } : null,
      ui,
      svg,
    };

    function collectUi(root) {
      const layerSection = root.querySelector('[data-layer-color-total-count]');
      const layerTotalCount = numberOrNull(layerSection?.getAttribute("data-layer-color-total-count")) || null;
      const layerMountedCount = numberOrNull(layerSection?.getAttribute("data-layer-color-mounted-count")) || null;
      const layerHeavyCount = numberOrNull(layerSection?.getAttribute("data-layer-color-heavy-count")) || null;
      const layerAllColors = String(layerSection?.getAttribute("data-layer-color-all-colors") || "")
        .split(/[\\s,]+/)
        .map(normalizeHex)
        .filter(Boolean);
      const layerSearch = root.querySelector('[data-layer-color-search="true"]');
      const layerBulkHide = root.querySelector('button[aria-label="Hide all layer colors"]');
      const layerBulkShow = root.querySelector('button[aria-label="Show all layer colors"]');
      const layerShowMore = root.querySelector('[data-layer-color-show-more="true"]');
      const explicitRows = visibleElements(root, '[data-layer-color-row="true"]');
      const layerInputs = visibleElements(root, 'input[type="text"][aria-label$=" hex color"]');
      const layerRowElements = explicitRows.length ? explicitRows : uniqueElements(layerInputs.map(findLayerRow).filter(Boolean));
      const layerRows = layerRowElements.map((row) => {
        const input = row.querySelector('input[type="text"][aria-label$=" hex color"]');
        const label =
          row.getAttribute("data-layer-color-label") ||
          String(input?.getAttribute("aria-label") || "").replace(/\\s+hex color$/i, "") ||
          (row.innerText || "").replace(/\\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");
        const checkbox = row?.querySelector('input[type="checkbox"][aria-label^="Show "]') || null;
        const picker = row?.querySelector('input[type="color"][aria-label^="Change "]') || null;
        const range = row?.querySelector('input[type="range"]') || null;
        const rect = input?.getBoundingClientRect?.() || row.getBoundingClientRect();
        const rowRect = row?.getBoundingClientRect?.() || null;
        const manualRow = row?.querySelector('[data-layer-color-manual-row="true"]') || null;
        const resetInManualRow = manualRow?.querySelector('[data-layer-color-reset="true"], button') || null;
        const editButton = Array.from(row?.querySelectorAll("button") || []).find((button) =>
          /^\\s*Edit\\s*$/i.test(button.innerText || button.textContent || "")
        );
        return {
          label,
          hexValue:
            row.getAttribute("data-layer-color-hex") ||
            input?.value ||
            input?.getAttribute("value") ||
            "",
          visible: checkbox ? checkbox.checked : null,
          hasColorPicker: Boolean(picker),
          hasOpacityRange: Boolean(range),
          hasManualRow: Boolean(manualRow),
          hasResetInManualRow: Boolean(resetInManualRow),
          hasEditButton: Boolean(editButton),
          inputType: input?.getAttribute("type") || null,
          widthPx: Math.round(rect.width),
          rowWidthPx: rowRect ? Math.round(rowRect.width) : null,
          rightGapPx: rowRect ? Math.round(rowRect.right - rect.right) : null,
          rowText: (row?.innerText || "").replace(/\\s+/g, " ").slice(0, 220),
        };
      });

      const removeChecks = visibleElements(root, 'input[type="checkbox"][aria-label^="Keep "], input[type="checkbox"][aria-label^="Restore "]');
      const removeRows = removeChecks.map((checkbox) => {
        const row = checkbox.closest("div");
        const text = (row?.innerText || "").replace(/\\s+/g, " ").trim();
        const colors = extractHexColors(text);
        return {
          label: checkbox.getAttribute("aria-label") || "",
          checked: checkbox.checked,
          colors,
          text: text.slice(0, 220),
        };
      });

      const targetSelects = visibleElements(root, 'select[aria-label^="Apply to:"]').map((select) => {
        const group = select.closest("[data-output-polish-group]");
        const options = Array.from(select.options).map((option) => ({
          value: option.value,
          label: option.textContent?.replace(/\\s+/g, " ").trim() || "",
        }));
        return {
          group: group?.getAttribute("data-output-polish-group") || "unknown",
          ariaLabel: select.getAttribute("aria-label") || "",
          value: select.value,
          optionCount: options.length,
          layerOptionCount: options.filter((option) => /^layer:/.test(option.value)).length,
          colorOptionCount: options.filter((option) => /^color:/.test(option.value)).length,
          allOptionCount: options.filter((option) => /^all-/.test(option.value)).length,
          options,
        };
      });

      const detectedSwatchButtons = visibleElements(root, 'button[aria-label^="Keep "], button[aria-label^="Remove "]')
        .map((button) => ({
          label: button.getAttribute("aria-label") || "",
          colors: extractHexColors(button.getAttribute("aria-label") || button.innerText || ""),
          pressed: button.getAttribute("aria-pressed"),
        }));

      return {
        sectionText: {
          hasRemoveDetectedOutputColors: /Remove detected output colors/i.test(root.innerText || ""),
          hasLayerColors: /Layer colors/i.test(root.innerText || ""),
          hasOutputPolish: /Output polish/i.test(root.innerText || ""),
        },
        layerColors: {
          rowCount: layerTotalCount || layerRows.length,
          mountedRowCount: layerRows.length,
          heavyControlRowCount: layerHeavyCount || layerRows.filter((row) => row.hasColorPicker || row.hasOpacityRange || row.inputType === "text").length,
          mountedWindowCount: layerMountedCount || layerRows.length,
          hasSearch: Boolean(layerSearch),
          hasBulkHide: Boolean(layerBulkHide),
          hasBulkShow: Boolean(layerBulkShow),
          hasRowEditButton: layerRows.some((row) => row.hasEditButton),
          hasShowMore: Boolean(layerShowMore),
          uniqueColors: unique([
            ...layerAllColors,
            ...layerRows.map((row) => normalizeHex(row.hexValue)).filter(Boolean),
          ]),
          rows: layerRows,
          manualHexInputAudit: auditManualHexInputs(layerRows),
        },
        removeDetectedOutputColors: {
          rowCount: removeRows.length,
          uniqueColors: unique(removeRows.flatMap((row) => row.colors.map(normalizeHex).filter(Boolean))),
          rows: removeRows,
        },
        targetSelectors: {
          fill: targetSelects.find((select) => select.group === "fill-effects") || null,
          stroke: targetSelects.find((select) => select.group === "stroke-effects") || null,
          all: targetSelects,
        },
        detectedColorSwatches: {
          count: detectedSwatchButtons.length,
          uniqueColors: unique(detectedSwatchButtons.flatMap((button) => button.colors.map(normalizeHex).filter(Boolean))),
          buttons: detectedSwatchButtons,
        },
      };
    }

    function emptyUi() {
      return {
        sectionText: {},
        layerColors: { rowCount: 0, uniqueColors: [], rows: [], manualHexInputAudit: null },
        removeDetectedOutputColors: { rowCount: 0, uniqueColors: [], rows: [] },
        targetSelectors: { fill: null, stroke: null, all: [] },
        detectedColorSwatches: { count: 0, uniqueColors: [], buttons: [] },
      };
    }

    function auditManualHexInputs(rows) {
      if (!rows.length) return {
        exists: false,
        minWidthPx: null,
        medianWidthPx: null,
        compressedRows: 0,
        note: "No layer hex inputs were mounted.",
      };
      const widths = rows.map((row) => row.widthPx).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
      const compressedRows = rows.filter((row) => Number(row.widthPx) < 160 || !row.hasManualRow || !row.hasResetInManualRow).length;
      return {
        exists: true,
        inputKind: "native color swatch plus full-width manual hex/RGB input",
        minWidthPx: widths[0] || null,
        medianWidthPx: widths[Math.floor(widths.length / 2)] || null,
        compressedRows,
        compressedPercent: rows.length ? Math.round((compressedRows / rows.length) * 100) : 0,
        note: compressedRows > 0
          ? "At least one mounted manual color input is too narrow or not paired with reset in its own row."
          : "Mounted manual color inputs have their own row and enough typing width at this viewport.",
      };
    }

    function findLayerRow(input) {
      let node = input.parentElement;
      while (node && node !== document.body) {
        if (
          node.querySelector?.('input[type="checkbox"][aria-label^="Show "]') &&
          node.querySelector?.('input[type="color"][aria-label^="Change "]') &&
          node.querySelector?.('input[type="range"]')
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return input.parentElement;
    }

    function decodeLatestSvg(root) {
      const focused = root.querySelector('[data-focused-editor-workspace="true"]');
      const searchRoot = focused || root;
      const images = Array.from(searchRoot.querySelectorAll('[data-editor-output-preview="true"] img, img'));
      const expectedBytes = numberOrNull(root.getAttribute("data-svg-bytes"));
      const candidates = [];
      for (const image of images) {
        const svg = decodeSvgImage(image);
        if (svg) {
          candidates.push({
            svg,
            bytes: new Blob([svg]).size,
            outputPreview: Boolean(image.closest('[data-editor-output-preview="true"]')),
          });
        }
      }
      if (expectedBytes) {
        const byteMatch = candidates.find((candidate) => candidate.bytes === expectedBytes);
        if (byteMatch) return byteMatch.svg;
      }
      const outputPreview = candidates.find((candidate) => candidate.outputPreview);
      if (outputPreview) return outputPreview.svg;
      if (candidates[0]) return candidates[0].svg;
      return "";
    }

    function decodeSvgImage(image) {
      const src = image?.getAttribute("src") || "";
      if (!src.startsWith("data:image/svg+xml")) return "";
      const comma = src.indexOf(",");
      if (comma < 0) return "";
      try { return decodeURIComponent(src.slice(comma + 1)); } catch { return ""; }
    }

    function visibleElements(root, selector) {
      return Array.from(root.querySelectorAll(selector)).filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
    }

    function uniqueElements(items) {
      const seen = new Set();
      return items.filter((item) => {
        if (!item || seen.has(item)) return false;
        seen.add(item);
        return true;
      });
    }

    function extractHexColors(value) {
      return Array.from(String(value || "").matchAll(/#[0-9a-f]{3,8}\\b/gi)).map((match) => match[0]);
    }

    function normalizeHex(value) {
      const text = String(value || "").trim().toLowerCase();
      const match = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
      if (!match) return "";
      const hex = match[1].toLowerCase();
      if (hex.length === 3) return "#" + hex.split("").map((char) => char + char).join("");
      return "#" + hex.slice(0, 6);
    }

    function unique(items) {
      return Array.from(new Set(items));
    }

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
  })()`, 30_000);
}

async function installCopyDownloadCapture(client) {
  return evaluate(client, `(() => {
    const state = window.__SETTINGS_COLOR_COVERAGE__ || {};
    state.clipboardWrites = Array.isArray(state.clipboardWrites) ? state.clipboardWrites : [];
    state.downloadedSvgBlobs = Array.isArray(state.downloadedSvgBlobs) ? state.downloadedSvgBlobs : [];
    window.__SETTINGS_COLOR_COVERAGE__ = state;

    const capture = async (text) => {
      window.__SETTINGS_COLOR_COVERAGE__.clipboardWrites.push(String(text || ""));
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

    if (!URL.__settingsColorCoverageCreateObjectUrl) {
      URL.__settingsColorCoverageCreateObjectUrl = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        try {
          if (blob && /image\\/svg\\+xml/i.test(String(blob.type || "")) && typeof blob.text === "function") {
            blob.text().then((text) => {
              window.__SETTINGS_COLOR_COVERAGE__.downloadedSvgBlobs.push(String(text || ""));
            }).catch(() => {});
          }
        } catch {}
        return URL.__settingsColorCoverageCreateObjectUrl(blob);
      };
    }
    return true;
  })()`, 8_000);
}

async function resetScenarioBrowserState(client) {
  await evaluate(client, `(() => {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    return true;
  })()`, 8_000);
  await client.send("Page.reload", { ignoreCache: true }).catch(async () => {
    await evaluate(client, `(() => { location.reload(); return true; })()`, 8_000);
  });
}

async function editFirstLayerForCopyDownloadParity(client) {
  return evaluate(client, `(() => {
    const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
    if (!latest) return { applicable: false, reason: "missing latest output" };
    const row = Array.from(latest.querySelectorAll('[data-layer-color-row="true"]'))
      .find((candidate) => {
        const hex = candidate.querySelector('input[type="text"][aria-label$=" hex color"]');
        const range = candidate.querySelector('input[type="range"]');
        return isVisible(candidate) && hex && range;
      });
    if (!row) return { applicable: false, reason: "missing editable heavy layer row" };

    const hexInput = row.querySelector('input[type="text"][aria-label$=" hex color"]');
    const rangeInput = row.querySelector('input[type="range"]');
    const label = row.getAttribute("data-layer-color-label") || "";
    const beforeColor = hexInput.value || hexInput.getAttribute("value") || "";
    const nextColor = "#ff00aa";
    const nextOpacityPercent = "41";

    window.setTimeout(() => {
      setNativeValue(hexInput, nextColor);
      hexInput.dispatchEvent(new Event("input", { bubbles: true }));
      hexInput.dispatchEvent(new Event("change", { bubbles: true }));
      hexInput.blur();

      setNativeValue(rangeInput, nextOpacityPercent);
      rangeInput.dispatchEvent(new Event("input", { bubbles: true }));
      rangeInput.dispatchEvent(new Event("change", { bubbles: true }));
      rangeInput.blur();
    }, 0);
    return {
      applicable: true,
      scheduled: true,
      label,
      beforeColor,
      nextColor,
      nextOpacity: 0.41,
    };

    function setNativeValue(element, value) {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
      if (descriptor?.set) descriptor.set.call(element, value);
      else element.value = value;
    }
    function latestCard(items) {
      return items.reduce((best, card) => {
        if (!best) return card;
        return numberOrNull(card.getAttribute("data-output-stamp")) >= numberOrNull(best.getAttribute("data-output-stamp")) ? card : best;
      }, null);
    }
    function numberOrNull(value) {
      const number = Number(String(value || "").replace(/[^0-9.]/g, ""));
      return Number.isFinite(number) ? number : 0;
    }
    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }
  })()`, 30_000);
}

async function waitForLayerEditPreview(client, parityEdit, baselineSvgBytes = null) {
  if (!parityEdit?.applicable || !parityEdit.nextColor || !Number.isFinite(parityEdit.nextOpacity)) {
    await delay(1800);
    return { applicable: false };
  }
  const expectedColor = String(parityEdit.nextColor).toLowerCase();
  const expectedOpacityPercent = String(Math.round(parityEdit.nextOpacity * 100));
  const deadline = Date.now() + 120_000;
  let last = null;
  let lastReadyBytes = null;
  let stableSince = 0;
  while (Date.now() < deadline) {
    let state;
    try {
      state = await evaluate(client, `(() => {
      const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
      const firstRow = latest ? Array.from(latest.querySelectorAll('[data-layer-color-row="true"]')).find((row) =>
        row.querySelector('input[type="text"][aria-label$=" hex color"]') &&
        row.querySelector('input[type="range"]')
      ) : null;
      const hexInput = firstRow?.querySelector('input[type="text"][aria-label$=" hex color"]') || null;
      const rangeInput = firstRow?.querySelector('input[type="range"]') || null;
      const currentBytes = numberOrNull(latest?.getAttribute("data-svg-bytes"));
      const baselineBytes = ${JSON.stringify(baselineSvgBytes)};
      const hasExpectedColor = String(hexInput?.value || hexInput?.getAttribute("value") || "").toLowerCase() === ${JSON.stringify(expectedColor)};
      const hasExpectedOpacity = String(rangeInput?.value || rangeInput?.getAttribute("value") || "") === ${JSON.stringify(expectedOpacityPercent)};
      const bytesChanged = !baselineBytes || (currentBytes > 0 && currentBytes !== baselineBytes);
      return {
        bytes: currentBytes,
        baselineBytes,
        hasExpectedColor,
        hasExpectedOpacity,
        bytesChanged,
        ready: Boolean(hasExpectedColor && hasExpectedOpacity && bytesChanged),
      };
      function latestCard(items) {
        return items.reduce((best, card) => {
          if (!best) return card;
          return numberOrNull(card.getAttribute("data-output-stamp")) >= numberOrNull(best.getAttribute("data-output-stamp")) ? card : best;
        }, null);
      }
      function numberOrNull(value) {
        const number = Number(String(value || "").replace(/[^0-9.]/g, ""));
        return Number.isFinite(number) ? number : 0;
      }
    })()`, 20_000);
    } catch (error) {
      last = { error: error instanceof Error ? error.message : String(error) };
      if (!/timed out/i.test(last.error || "")) throw error;
      await delay(500);
      continue;
    }
    last = state;
    if (state?.ready) {
      if (state.bytes !== lastReadyBytes) {
        lastReadyBytes = state.bytes;
        stableSince = Date.now();
      } else if (!stableSince) {
        stableSince = Date.now();
      }
      if (stableSince && Date.now() - stableSince >= 2000) return state;
    } else {
      lastReadyBytes = null;
      stableSince = 0;
    }
    await delay(300);
  }
  throw new Error(`Timed out waiting for edited preview to settle. Last value: ${JSON.stringify(last)}`);
}

async function verifyCopyDownloadParity(client, expectedSvg) {
  if (!expectedSvg) {
    throw new Error("Missing edited preview SVG for copy/download parity check.");
  }
  const expectedHash = hashString(expectedSvg);
  const expectedBytes = Buffer.byteLength(expectedSvg);
  const before = await getCopyDownloadCapture(client);

  const copyClick = await clickButtonInLatestOutput(client, [/Copy SVG/i, /^Copy$/i], [/Copied/i]);
  if (!copyClick) throw new Error("Copy SVG control not found for parity check.");
  const copied = await waitForValue(
    client,
    () => copyDownloadCaptureExpression(expectedHash, expectedBytes),
    30_000,
    (value) => value?.clipboardCount > before.clipboardCount,
  );

  const downloadClick = await clickButtonInLatestOutput(client, [/Download SVG/i, /^Download\b/i], [/ZIP/i]);
  if (!downloadClick) throw new Error("Download SVG control not found for parity check.");
  const downloaded = await waitForValue(
    client,
    () => copyDownloadCaptureExpression(expectedHash, expectedBytes),
    30_000,
    (value) => value?.downloadCount > before.downloadCount,
  );

  const result = {
    expectedHash,
    expectedBytes,
    copyClick,
    downloadClick,
    copyHash: copied.latestClipboardHash,
    copyBytes: copied.latestClipboardBytes,
    downloadHash: downloaded.latestDownloadHash,
    downloadBytes: downloaded.latestDownloadBytes,
    copyMatchedPreview: copied.latestClipboardHash === expectedHash && copied.latestClipboardBytes === expectedBytes,
    downloadMatchedPreview: downloaded.latestDownloadHash === expectedHash && downloaded.latestDownloadBytes === expectedBytes,
  };
  if (!result.copyMatchedPreview) {
    throw new Error(`Copy SVG did not match the edited preview SVG: ${JSON.stringify(result)}`);
  }
  if (!result.downloadMatchedPreview) {
    throw new Error(`Download SVG did not match the edited preview SVG: ${JSON.stringify(result)}`);
  }
  return result;
}

async function getCopyDownloadCapture(client) {
  return evaluate(client, copyDownloadCaptureExpression("", 0), 30_000);
}

function copyDownloadCaptureExpression(expectedHash, expectedBytes) {
  return `(() => {
    const state = window.__SETTINGS_COLOR_COVERAGE__ || {};
    const clipboardWrites = state.clipboardWrites || [];
    const downloadedSvgBlobs = state.downloadedSvgBlobs || [];
    const latestClipboard = clipboardWrites[clipboardWrites.length - 1] || "";
    const latestDownload = downloadedSvgBlobs[downloadedSvgBlobs.length - 1] || "";
    const latestClipboardHash = latestClipboard ? hashString(latestClipboard) : null;
    const latestDownloadHash = latestDownload ? hashString(latestDownload) : null;
    const latestClipboardBytes = latestClipboard ? new Blob([latestClipboard]).size : 0;
    const latestDownloadBytes = latestDownload ? new Blob([latestDownload]).size : 0;
    return {
      clipboardCount: clipboardWrites.length,
      downloadCount: downloadedSvgBlobs.length,
      latestClipboardHash,
      latestDownloadHash,
      latestClipboardBytes,
      latestDownloadBytes,
      expectedHash: ${JSON.stringify(expectedHash)},
      expectedBytes: ${JSON.stringify(expectedBytes)},
      copyMatchedPreview: latestClipboardHash === ${JSON.stringify(expectedHash)} && latestClipboardBytes === ${JSON.stringify(expectedBytes)},
      downloadMatchedPreview: latestDownloadHash === ${JSON.stringify(expectedHash)} && latestDownloadBytes === ${JSON.stringify(expectedBytes)},
    };
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

async function hideAllExposedLayerColors(client) {
  return evaluate(client, `(async () => {
    const latest = latestCard(Array.from(document.querySelectorAll("[data-output-stamp]")));
    if (!latest) return { clicked: 0, reason: "missing latest output" };
    let clicked = 0;
    let showMoreClicks = 0;
    let mountedShowCheckboxes = 0;
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const boxes = Array.from(latest.querySelectorAll('input[type="checkbox"][aria-label^="Show "]'))
        .filter((box) => {
          const rect = box.getBoundingClientRect();
          const style = getComputedStyle(box);
          return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
        });
      mountedShowCheckboxes = Math.max(mountedShowCheckboxes, boxes.length);
      for (const box of boxes) {
        if (!box.checked) continue;
        box.scrollIntoView({ block: "center", inline: "nearest" });
        box.click();
        clicked += 1;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      const showMore = Array.from(latest.querySelectorAll('[data-layer-color-show-more="true"], button'))
        .find((button) => {
          const label = (button.getAttribute("aria-label") || button.innerText || button.textContent || "").replace(/\\s+/g, " ").trim();
          const rect = button.getBoundingClientRect();
          const style = getComputedStyle(button);
          return /show more layer colors/i.test(label) &&
            !button.disabled &&
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden";
        });
      if (!showMore) break;
      showMore.scrollIntoView({ block: "center", inline: "nearest" });
      showMore.click();
      showMoreClicks += 1;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const remainingBoxes = Array.from(latest.querySelectorAll('input[type="checkbox"][aria-label^="Show "]'))
      .filter((box) => {
        const rect = box.getBoundingClientRect();
        const style = getComputedStyle(box);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      });
    return {
      clicked,
      showMoreClicks,
      mountedShowCheckboxes,
      remainingChecked: remainingBoxes.filter((box) => box.checked).length,
    };

    function latestCard(items) {
      return items.reduce((best, card) => {
        if (!best) return card;
        return numberOrNull(card.getAttribute("data-output-stamp")) >= numberOrNull(best.getAttribute("data-output-stamp")) ? card : best;
      }, null);
    }
    function numberOrNull(value) {
      const number = Number(String(value || "").replace(/[^0-9.]/g, ""));
      return Number.isFinite(number) ? number : 0;
    }
  })()`, 60_000);
}

function analyzeSvgColors(svg) {
  const source = String(svg || "");
  const protectedRanges = collectProtectedRanges(source);
  const cssPaints = collectCssPaints(source);
  const colors = new Map();
  const skipped = {
    none: 0,
    transparent: 0,
    currentColor: 0,
    urlPaints: 0,
    alphaZero: 0,
    hiddenElementPaints: 0,
    defsPaints: 0,
    unsupportedPaints: 0,
  };
  const structural = {
    pathCount: countMatches(source, /<path\b/gi),
    groupCount: countMatches(source, /<g\b/gi),
    styleBlockCount: countMatches(source, /<style\b/gi),
    gradientCount: countMatches(source, /<(?:linearGradient|radialGradient)\b/gi),
    patternCount: countMatches(source, /<pattern\b/gi),
    imageCount: countMatches(source, /<image\b/gi),
    defsCount: countMatches(source, /<defs\b/gi),
    hiddenElementCount: 0,
  };
  const pathTagsPaintColors = new Set();

  const elementPattern = /<([a-zA-Z][\w:-]*)([^<>]*?)>/g;
  let match;
  while ((match = elementPattern.exec(source))) {
    const tag = match[1].toLowerCase();
    if (tag.startsWith("/") || tag === "style") continue;
    const attrs = parseAttributes(match[2] || "");
    const style = parseStyle(attrs.style || "");
    const inProtected = isInRanges(match.index, protectedRanges);
    const hidden = isElementHidden(attrs, style);
    if (hidden) structural.hiddenElementCount += 1;
    const baseOpacity = parseOpacity(style.opacity ?? attrs.opacity, 1);

    const classNames = String(attrs.class || "").split(/\s+/).filter(Boolean);
    const id = attrs.id ? `#${attrs.id}` : null;
    const cssSources = [];
    if (id && cssPaints.has(id)) cssSources.push({ selector: id, paints: cssPaints.get(id) });
    for (const className of classNames) {
      const selector = `.${className}`;
      if (cssPaints.has(selector)) cssSources.push({ selector, paints: cssPaints.get(selector) });
    }

    const paintEntries = [];
    for (const channel of ["fill", "stroke"]) {
      if (attrs[channel] != null) {
        paintEntries.push({
          channel,
          raw: attrs[channel],
          source: "attribute",
          alpha: parseOpacity(attrs[`${channel}-opacity`], 1) * baseOpacity,
        });
      }
      if (style[channel] != null) {
        paintEntries.push({
          channel,
          raw: style[channel],
          source: "inline-style",
          alpha: parseOpacity(style[`${channel}-opacity`], 1) * baseOpacity,
        });
      }
      for (const cssSource of cssSources) {
        if (cssSource.paints[channel] != null) {
          paintEntries.push({
            channel,
            raw: cssSource.paints[channel],
            source: "class-or-id-style",
            alpha: parseOpacity(cssSource.paints[`${channel}-opacity`], 1) * baseOpacity,
            selector: cssSource.selector,
          });
        }
      }
    }

    for (const paint of paintEntries) {
      const normalized = normalizePaintColor(paint.raw);
      if (!normalized.enabled) {
        skipped[normalized.reason] = (skipped[normalized.reason] || 0) + 1;
        continue;
      }
      if (paint.alpha <= 0.001 || normalized.alpha <= 0.001) {
        skipped.alphaZero += 1;
        continue;
      }
      if (inProtected) {
        skipped.defsPaints += 1;
        continue;
      }
      if (hidden) {
        skipped.hiddenElementPaints += 1;
        continue;
      }
      if (tag === "path" && /data-(?:fill-layer-id|stroke-layer-id|layer-id)\s*=/i.test(match[0])) {
        pathTagsPaintColors.add(normalized.color);
      }
      recordColor(colors, normalized.color, {
        channel: paint.channel,
        source: paint.source,
        tag,
        selector: paint.selector || null,
      });
    }
  }

  const entries = Array.from(colors.entries())
    .map(([color, value]) => ({
      color,
      uses: value.uses,
      channels: Array.from(value.channels).sort(),
      sources: Array.from(value.sources).sort(),
      tags: Array.from(value.tags).sort(),
      selectors: Array.from(value.selectors).sort(),
    }))
    .sort((a, b) => b.uses - a.uses || a.color.localeCompare(b.color));
  const fillColors = entries.filter((entry) => entry.channels.includes("fill")).map((entry) => entry.color);
  const strokeColors = entries.filter((entry) => entry.channels.includes("stroke")).map((entry) => entry.color);
  const inlineStyleColors = entries.filter((entry) => entry.sources.includes("inline-style")).map((entry) => entry.color);
  const classStyleColors = entries.filter((entry) => entry.sources.includes("class-or-id-style")).map((entry) => entry.color);

  return {
    uniqueVisibleColorCount: entries.length,
    uniqueFillColorCount: unique(fillColors).length,
    uniqueStrokeColorCount: unique(strokeColors).length,
    uniqueInlineStyleColorCount: unique(inlineStyleColors).length,
    uniqueClassStyleColorCount: unique(classStyleColors).length,
    pathTagsPaintColors: Array.from(pathTagsPaintColors).sort(),
    colors: entries,
    skipped,
    structural,
  };
}

function recordColor(colors, color, details) {
  const entry = colors.get(color) || {
    uses: 0,
    channels: new Set(),
    sources: new Set(),
    tags: new Set(),
    selectors: new Set(),
  };
  entry.uses += 1;
  entry.channels.add(details.channel);
  entry.sources.add(details.source);
  entry.tags.add(details.tag);
  if (details.selector) entry.selectors.add(details.selector);
  colors.set(color, entry);
}

function collectCssPaints(svg) {
  const paints = new Map();
  const stylePattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = stylePattern.exec(svg))) {
    const css = styleMatch[1] || "";
    const rulePattern = /([.#][A-Za-z0-9_-]+)\s*\{([^{}]*)\}/g;
    let ruleMatch;
    while ((ruleMatch = rulePattern.exec(css))) {
      const declarations = parseStyle(ruleMatch[2] || "");
      const paint = {};
      for (const key of ["fill", "stroke", "fill-opacity", "stroke-opacity", "opacity"]) {
        if (declarations[key] != null) paint[key] = declarations[key];
      }
      if (Object.keys(paint).length) paints.set(ruleMatch[1], paint);
    }
  }
  return paints;
}

function collectProtectedRanges(svg) {
  const ranges = [];
  const protectedPattern = /<(defs|style|script|clipPath|mask|marker|symbol|linearGradient|radialGradient|pattern|filter)\b[\s\S]*?<\/\1>/gi;
  let match;
  while ((match = protectedPattern.exec(svg))) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return ranges;
}

function isInRanges(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index < end);
}

function parseAttributes(attrs) {
  const out = {};
  const attrPattern = /([:@\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = attrPattern.exec(attrs))) {
    out[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  }
  return out;
}

function parseStyle(style) {
  const out = {};
  for (const declaration of String(style || "").split(";")) {
    const index = declaration.indexOf(":");
    if (index < 0) continue;
    const key = declaration.slice(0, index).trim().toLowerCase();
    const value = declaration.slice(index + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function isElementHidden(attrs, style) {
  const display = String(style.display ?? attrs.display ?? "").trim().toLowerCase();
  const visibility = String(style.visibility ?? attrs.visibility ?? "").trim().toLowerCase();
  const opacity = parseOpacity(style.opacity ?? attrs.opacity, 1);
  return display === "none" || visibility === "hidden" || opacity <= 0.001;
}

function parseOpacity(value, fallback) {
  if (value == null || value === "") return fallback;
  const number = Number(String(value).trim());
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function normalizePaintColor(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw || raw === "none") return { enabled: false, reason: "none" };
  if (raw === "transparent") return { enabled: false, reason: "transparent" };
  if (raw === "currentcolor") return { enabled: false, reason: "currentColor" };
  if (/^url\(/i.test(raw)) return { enabled: false, reason: "urlPaints" };

  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let body = hex[1].toLowerCase();
    if (body.length === 3 || body.length === 4) {
      body = body.split("").map((char) => char + char).join("");
    }
    const alpha = body.length === 8 ? Number.parseInt(body.slice(6, 8), 16) / 255 : 1;
    if (alpha <= 0.001) return { enabled: false, reason: "alphaZero" };
    return { enabled: true, color: `#${body.slice(0, 6)}`, alpha };
  }

  const rgb = raw.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1]
      .split(/[,\s/]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length >= 3) {
      const channels = parts.slice(0, 3).map((part) => clampChannel(part));
      const alpha = parts[3] == null ? 1 : Number(parts[3]);
      if (channels.every((channel) => Number.isFinite(channel))) {
        if (Number.isFinite(alpha) && alpha <= 0.001) return { enabled: false, reason: "alphaZero" };
        return {
          enabled: true,
          color: `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`,
          alpha: Number.isFinite(alpha) ? alpha : 1,
        };
      }
    }
  }

  const named = {
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
    gray: "#808080",
    grey: "#808080",
  };
  if (named[raw]) return { enabled: true, color: named[raw], alpha: 1 };
  return { enabled: false, reason: "unsupportedPaints" };
}

function clampChannel(value) {
  const text = String(value || "").trim();
  if (text.endsWith("%")) {
    const percent = Number(text.slice(0, -1));
    return Math.max(0, Math.min(255, Math.round((percent / 100) * 255)));
  }
  const number = Number(text);
  return Math.max(0, Math.min(255, Math.round(number)));
}

function countMatches(value, pattern) {
  return (String(value || "").match(pattern) || []).length;
}

function summarizeResults(results, staticFindings) {
  const okResults = results.filter((result) => result.ok && !result.skipped);
  const totals = okResults.map((result) => result.counts);
  const max = (field) => Math.max(0, ...totals.map((counts) => Number(counts[field] || 0)));
  const home = okResults.find((result) => result.id === "home-layered-flat-color");
  const layeredRoutes = okResults.filter((result) =>
    ["home-layered-flat-color", "png-layered-flat-color", "jpg-layered-flat-color"].includes(result.id),
  );
  const failures = [];
  if (!home) {
    failures.push("Home layered coverage scenario did not complete.");
  } else {
    if (home.counts.actualVisibleSvgColorsBeforeHide > home.counts.layerRowsExposed) {
      failures.push("Home layered output exposes fewer layer rows than visible SVG colors.");
    }
    if (home.counts.actualVisibleSvgColorsBeforeHide > FLAT_COLOR_MAX_EDITABLE_GROUPS) {
      failures.push(
        `Home layered flat color still exposes ${home.counts.actualVisibleSvgColorsBeforeHide} visible SVG colors; expected grouped output at or below ${FLAT_COLOR_MAX_EDITABLE_GROUPS}.`,
      );
    }
    if (home.counts.layerRowsExposed > FLAT_COLOR_MAX_EDITABLE_GROUPS) {
      failures.push(
        `Home layered flat color still exposes ${home.counts.layerRowsExposed} layer rows; expected grouped editable rows at or below ${FLAT_COLOR_MAX_EDITABLE_GROUPS}.`,
      );
    }
    if (home.counts.layerRowsExposed !== home.counts.actualVisibleSvgColorsBeforeHide) {
      failures.push(
        `Home layered flat color exposes ${home.counts.layerRowsExposed} layer rows for ${home.counts.actualVisibleSvgColorsBeforeHide} grouped SVG colors.`,
      );
    }
    if (home.counts.layerRowsExposed >= FLAT_COLOR_RAW_EXPOSURE_REGRESSION_THRESHOLD) {
      failures.push(`Home layered flat color still has raw row exposure: ${home.counts.layerRowsExposed} rows.`);
    }
    if (home.counts.actualVisibleSvgColorsBeforeHide > 16 && home.counts.layerRowsExposed <= 16) {
      failures.push("Home layered output is still silently capped at 16 exposed layer rows.");
    }
    if (home.counts.visibleColorsAfterHidingAllExposedLayerColors > 0) {
      failures.push("Home layered output leaves visible controllable colors after hiding every exposed layer row.");
    }
    if (
      home.counts.layerRowsExposed > 48 &&
      home.uiSnapshots?.layerColorsBeforeHide?.ui?.layerColors?.heavyControlRowCount >= home.counts.layerRowsExposed
    ) {
      failures.push("Home layered output mounts heavy controls for every exposed layer row.");
    }
    if (!home.copyDownloadParity?.copyMatchedPreview) {
      failures.push("Home layered Copy SVG output does not match the edited preview.");
    }
    if (!home.copyDownloadParity?.downloadMatchedPreview) {
      failures.push("Home layered Download SVG output does not match the edited preview.");
    }
    const homeEngineUsed = String(home.latestOutput?.engineUsed || "").toLowerCase();
    if (!["vtracer", "potrace"].includes(homeEngineUsed)) {
      failures.push(
        `Home layered coverage scenario used unsupported engine "${home.latestOutput?.engineUsed || "unknown"}"; expected VTracer or server Potrace layered output.`,
      );
    }
    if (!hasGroupedEditableLayerCoverage(home)) {
      failures.push(
        "Home layered coverage scenario did not produce grouped editable Layered - Flat Color output.",
      );
    }
    if (home.counts.actualVisibleSvgColorsBeforeHide > 16 && home.counts.pathTagsPaintColors === 0) {
      failures.push("Home layered output has many visible colors but no tagged path colors to edit.");
    }
  }
  for (const result of layeredRoutes) {
    const layerUi = result.uiSnapshots?.layerColorsBeforeHide?.ui?.layerColors;
    if (result.uiSnapshots?.layerColorsBeforeHide?.ui?.sectionText?.hasRemoveDetectedOutputColors) {
      failures.push(`${result.id} still exposes Live Preview Edits Remove detected output colors.`);
    }
    if (layerUi?.hasBulkHide) {
      failures.push(`${result.id} still exposes Hide all in Layer colors.`);
    }
    if (layerUi?.hasBulkShow) {
      failures.push(`${result.id} still exposes Show all in Layer colors.`);
    }
    if (layerUi?.hasSearch) {
      failures.push(`${result.id} still exposes Layer colors search.`);
    }
    if (layerUi?.hasRowEditButton) {
      failures.push(`${result.id} still exposes per-row Edit in Layer colors.`);
    }
    if (layerUi?.manualHexInputAudit?.compressedRows > 0) {
      failures.push(`${result.id} has cramped or misplaced manual Layer colors inputs.`);
    }
    if (result.counts.visibleColorsAfterHidingAllExposedLayerColors > 0) {
      failures.push(`${result.id} leaves visible colors after hiding all exposed layer rows.`);
    }
    if (result.counts.actualVisibleSvgColorsBeforeHide > result.counts.layerRowsExposed) {
      failures.push(`${result.id} exposes fewer layer rows than visible SVG colors.`);
    }
    if (!result.copyDownloadParity?.copyMatchedPreview) {
      failures.push(`${result.id} Copy SVG output does not match the edited preview.`);
    }
    if (!result.copyDownloadParity?.downloadMatchedPreview) {
      failures.push(`${result.id} Download SVG output does not match the edited preview.`);
    }
  }
  return {
    ok: results.every((result) => result.ok) && failures.length === 0,
    scenarioCount: results.length,
    maxActualVisibleSvgColors: max("actualVisibleSvgColorsBeforeHide"),
    maxLayerRowsExposed: max("layerRowsExposed"),
    maxVisibleColorsRemainingAfterHide: max("visibleColorsAfterHidingAllExposedLayerColors"),
    anyMissingOrUncontrolledColors: okResults.some((result) => result.missingOrUncontrolled.remainingColorCountAfterHide > 0),
    failures,
    hardCapsFound: staticFindings.hardCaps,
  };
}

function hasGroupedEditableLayerCoverage(result) {
  const counts = result.counts || {};
  const layerUi = result.uiSnapshots?.layerColorsBeforeHide?.ui?.layerColors;
  return (
    counts.actualVisibleSvgColorsBeforeHide >= 2 &&
    counts.actualVisibleSvgColorsBeforeHide <= FLAT_COLOR_MAX_EDITABLE_GROUPS &&
    counts.layerRowsExposed === counts.actualVisibleSvgColorsBeforeHide &&
    counts.layerMetadataColorsExposed === counts.layerRowsExposed &&
    counts.visibleColorsAfterHidingAllExposedLayerColors === 0 &&
    counts.layerRowsExposed <= FLAT_COLOR_MAX_EDITABLE_GROUPS &&
    counts.layerRowsExposed < FLAT_COLOR_RAW_EXPOSURE_REGRESSION_THRESHOLD &&
    counts.fillTargetSelectorLayerOptions >= counts.layerRowsExposed &&
    layerUi?.rowCount === counts.layerRowsExposed &&
    layerUi?.uniqueColors?.length === counts.layerRowsExposed &&
    Boolean(result.copyDownloadParity?.copyMatchedPreview) &&
    Boolean(result.copyDownloadParity?.downloadMatchedPreview)
  );
}

async function collectStaticFindings() {
  const files = {
    svgEditingModel: "app/client/lib/converter/svgEditingModel.ts",
    outputAppearance: "app/client/lib/converter/outputAppearance.ts",
    advancedSettingsPanel: "app/client/components/converter/AdvancedSettingsPanel.tsx",
    layerPaletteEditor: "app/client/components/svg/LayerPaletteEditor.tsx",
    sharedTracingTypes: "app/shared/tracing/types.ts",
    svgLayerTraceServer: "app/utils/svgLayerTrace.server.ts",
    vtracerWorker: "app/client/workers/vtracer.worker.ts",
    homeRoute: "app/routes/home.tsx",
    pngLayeredRoute: "app/routes/png-to-layered-svg-for-cricut.tsx",
    jpgLayeredRoute: "app/routes/jpg-to-layered-svg-for-cricut.tsx",
    traceOutputPanel: "app/client/components/converter/TraceOutputPanel.tsx",
    bespokeTraceOutputPanel: "app/client/components/converter/BespokeTraceOutputPanel.tsx",
  };
  const contents = {};
  for (const [key, relativePath] of Object.entries(files)) {
    contents[key] = await fs.readFile(path.join(rootDir, relativePath), "utf8");
  }

  return {
    hardCaps: [
      findEvidence(contents.advancedSettingsPanel, "collectDetectedRemoveColors", "return out.slice(0, 24)"),
      findEvidence(contents.advancedSettingsPanel, "mergeDetectedColors", "return out.slice(0, 28)"),
      findEvidence(contents.advancedSettingsPanel, "useSourcePaletteColors", ".slice(0, 18)"),
      findEvidence(contents.vtracerWorker, "extractEditableLayers", "settings.requestedPaletteCount || settings.colorLayerCount || 24"),
      findEvidence(contents.vtracerWorker, "extractEditableLayers", "return Array.from(seen.values()).slice(0, cap)"),
      findEvidence(contents.vtracerWorker, "getSafeLayeredPaletteCount max", "let max = layerBuildMode === \"per-color-cutout\" ? 18 : 28"),
      findEvidence(contents.vtracerWorker, "getSafeLayeredPaletteCount pixel cap", "if (pixels > 1_200_000) max = Math.min(max, layerBuildMode === \"per-color-cutout\" ? 16 : 24)"),
      findEvidence(contents.vtracerWorker, "getSafeLayeredPaletteCount return", "return clampInt(Math.min(requested, max), 2, requested)"),
      findEvidence(contents.svgLayerTraceServer, "MAX_LAYER_COUNT", "const MAX_LAYER_COUNT = 40"),
      findEvidence(contents.pngLayeredRoute, "route max layer count", "const MAX_LAYER_COUNT = 10"),
      findEvidence(contents.jpgLayeredRoute, "route max layer count", "const MAX_LAYER_COUNT = 10"),
      findEvidence(contents.homeRoute, "home route legacy max layer count", "const MAX_LAYER_COUNT = 10"),
    ].filter(Boolean),
    sourceData: {
      layerMetadataCreated: [
        findEvidence(contents.vtracerWorker, "client worker extractEditableLayers creates TraceLayerMeta", "function extractEditableLayers"),
        findEvidence(contents.svgLayerTraceServer, "shared server createLayeredColorSvg returns layers", "return {"),
        findEvidence(contents.svgLayerTraceServer, "uploaded SVG editable layer metadata", "function buildEditableSvgFromUploadedSvg"),
      ].filter(Boolean),
      pathTagsCreated: [
        findEvidence(contents.vtracerWorker, "client pathTags", "pathTags: extractLayerPathTags"),
        findEvidence(contents.vtracerWorker, "client pathTags", "pathTags: normalizeLayerPathTag"),
        findEvidence(contents.svgLayerTraceServer, "server pathTags", "pathTags: result.pathTags"),
      ].filter(Boolean),
      detectedColorsCreated: [
        findEvidence(contents.advancedSettingsPanel, "source palette colors", "function useSourcePaletteColors"),
        findEvidence(contents.advancedSettingsPanel, "layer-derived detected colors", "function collectDetectedRemoveColors"),
        findEvidence(contents.advancedSettingsPanel, "merged detected colors", "function mergeDetectedColors"),
      ].filter(Boolean),
      targetListsCreated: [
        findEvidence(contents.svgEditingModel, "SVG editing model color targets", "function buildColorTargets"),
        findEvidence(contents.svgEditingModel, "SVG editing model layer targets", "function buildLayerTargets"),
        findEvidence(contents.outputAppearance, "large layered metadata model", "function createLayerMetadataEditingModel"),
        findEvidence(contents.outputAppearance, "metadata paint targets", "function buildLayerMetadataPaintTargets"),
        findEvidence(contents.outputAppearance, "metadata color targets", "function buildLayerMetadataColorTargets"),
      ].filter(Boolean),
      sharedOutputLayerSource: [
        findEvidence(contents.advancedSettingsPanel, "live output layer source", "const outputLayers = onOutputLayerChange"),
        findEvidence(contents.advancedSettingsPanel, "Layer colors receives outputLayers", "layers={outputLayers}"),
      ].filter(Boolean),
      removedLiveOutputColorPanel: !/Remove detected output colors/i.test(contents.advancedSettingsPanel),
    },
  };
}

function findEvidence(content, label, needle) {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(needle));
  if (index < 0) return null;
  return {
    label,
    needle,
    line: index + 1,
    text: lines[index].trim(),
  };
}

async function clickConvert(client) {
  const clicked = await clickButtonIfPresent(
    client,
    [/^Convert\b/i, /^Create\b/i, /^Build\b/i, /^Generate\b/i, /^Trace\b/i, /Layered SVG/i],
    [/Download/i, /Copy/i, /Settings/i, /ZIP/i],
  );
  if (clicked) return clicked;
  const routeBusy = await routeConversionBusy(client);
  if (routeBusy) return { clicked: false, reason: "conversion already running", routeBusy };
  const state = await outputState(client);
  if (state.activeJobs > 0) return { clicked: false, reason: "conversion already running", state };
  const buttons = await visibleButtonLabels(client).catch(() => []);
  throw new Error(`No enabled Convert/Create button found. Visible buttons: ${JSON.stringify(buttons.slice(0, 24))}`);
}

async function routeConversionBusy(client) {
  return evaluate(client, `(() => {
    return Array.from(document.querySelectorAll("button")).some((button) => {
      const text = button.innerText || button.textContent || "";
      return button.disabled && /\\b(Building|Converting|Running|Creating)\\b/i.test(text);
    });
  })()`);
}

async function waitForCompletedOutput(client, previousLatestStamp, timeoutMs, options = {}) {
  return waitForValue(
    client,
    () => outputStateExpression(previousLatestStamp),
    timeoutMs,
    (state) =>
      state?.pageAlive &&
      state.latestReady &&
      state.activeJobs === 0 &&
      state.latestStamp !== null &&
      (!options.requireLatestChanged || state.latestChanged),
  );
}

async function settleInitialAutoConversion(client, timeoutMs) {
  const deadline = Date.now() + 4_000;
  let state = await outputState(client).catch(() => null);
  while (
    state &&
    !state.activeJobs &&
    !state.latestReady &&
    state.outputCards === 0 &&
    Date.now() < deadline
  ) {
    await delay(250);
    state = await outputState(client).catch(() => null);
  }
  if (!state?.activeJobs) return { settled: true, reason: "idle" };
  const completed = await waitForCompletedOutput(client, state.latestStamp, timeoutMs);
  return { settled: true, reason: "waited for initial auto conversion", completed };
}

async function selectPreset(client, patterns) {
  await expandPresetList(client).catch(() => null);
  for (const pattern of patterns) {
    const deadline = Date.now() + 8_000;
    do {
      const clicked = await clickButtonByPattern(client, [pattern], [/Show fewer/i, /Filter presets/i]).catch(() => null);
      if (clicked) {
        await delay(300);
        return { selected: clicked.label, pattern: String(pattern) };
      }
      await delay(250);
    } while (Date.now() < deadline);
  }
  const visibleButtons = await visibleButtonLabels(client).catch(() => []);
  return {
    selected: null,
    reason: "No matching layered preset button was visible.",
    visibleButtons: visibleButtons.slice(0, 40),
  };
}

async function expandPresetList(client) {
  return waitForValue(
    client,
    () => `(() => {
      const hasExpandedControls = Boolean(document.querySelector('input[type="search"]')) ||
        Array.from(document.querySelectorAll("button, [role='button'], summary")).some((candidate) => {
          const text = (candidate.innerText || candidate.textContent || candidate.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
          return /^All presets$/i.test(text) || /^Pinned presets$/i.test(text);
        });
      if (hasExpandedControls) return { expanded: true, clicked: false };

      const buttons = Array.from(document.querySelectorAll("button, [role='button'], summary"));
      const button = buttons.find((candidate) => {
        const text = (candidate.innerText || candidate.textContent || candidate.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
        return isVisible(candidate) && !candidate.disabled && /^Show\\s+\\d+\\s+more presets$/i.test(text);
      });
      if (!button) return { expanded: false, clicked: false };
      button.scrollIntoView({ block: "center", inline: "nearest" });
      button.click();
      return {
        expanded: false,
        clicked: true,
        label: (button.innerText || button.textContent || button.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim(),
      };

      function isVisible(element) {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }
    })()`,
    8_000,
    (value) => value?.expanded,
  );
}

async function clickButtonByPattern(client, patterns, rejectPatterns = []) {
  return evaluate(client, `(() => {
    const patterns = ${JSON.stringify(patterns.map((pattern) => pattern.source))}.map((source) => new RegExp(source, "i"));
    const rejects = ${JSON.stringify(rejectPatterns.map((pattern) => pattern.source))}.map((source) => new RegExp(source, "i"));
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], summary"));
    const button = buttons.find((candidate) => {
      const text = (candidate.innerText || candidate.textContent || candidate.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim();
      return isVisible(candidate) &&
        !candidate.disabled &&
        patterns.some((pattern) => pattern.test(text)) &&
        !rejects.some((pattern) => pattern.test(text));
    });
    if (!button) return null;
    button.scrollIntoView({ block: "center", inline: "nearest" });
    button.click();
    return {
      label: (button.innerText || button.textContent || button.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim(),
    };

    function isVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    }
  })()`, 30_000);
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
        /\\b(Queued|Running|Converting|Creating|Building)\\b/i.test(card.innerText || "");
    }
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
    (value) => value?.bodyHasName && (value?.enabledConvert || value?.routeBusy || value?.outputCards > 0),
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
    const buttons = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        const tagName = String(node.tagName || "").toLowerCase();
        if (tagName === "svg") return NodeFilter.FILTER_REJECT;
        if (node.matches?.("button, [role='button'], summary")) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      buttons.push(node);
    }
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
        return numberOrNull(card.getAttribute("data-output-stamp")) >= numberOrNull(best.getAttribute("data-output-stamp")) ? card : best;
      }, null);
    }
    function numberOrNull(value) {
      const text = String(value || "").trim();
      if (!text) return 0;
      const number = Number(text.replace(/[^0-9.]/g, ""));
      return Number.isFinite(number) ? number : 0;
    }
  })()`, 30_000);
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
      Math.min(30_000, Math.max(3_000, deadline - Date.now())),
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
      // Fall through to the legacy endpoint.
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
      const { stdout } = await execFile("git", ["-c", `safe.directory=${rootDir}`, ...args], {
        cwd: rootDir,
        windowsHide: true,
      });
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
    sharp(pngFixturePath, { limitInputPixels: false }).metadata().catch(() => ({})),
  ]);
  const jpgFixturePath = path.join(fixturesDir, "settings-color-coverage-fixture.jpg");
  await sharp(pngFixturePath, { limitInputPixels: false })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(jpgFixturePath);
  const [jpgStat, jpgMetadata] = await Promise.all([
    fs.stat(jpgFixturePath),
    sharp(jpgFixturePath, { limitInputPixels: false }).metadata().catch(() => ({})),
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

function unique(items) {
  return Array.from(new Set(items));
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
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
    auditKind: "settings-color-layer-coverage",
    baseUrl,
    checkedAt: new Date().toISOString(),
    fatal: error instanceof Error ? error.message : String(error),
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true }).catch(() => {});
  await fs.writeFile(reportPath, JSON.stringify(fatal, null, 2)).catch(() => {});
  console.error(JSON.stringify(fatal, null, 2));
  process.exit(1);
});
