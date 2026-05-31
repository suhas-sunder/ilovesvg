import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const runDir = path.join(rootDir, "tmp", "conversion-speed-smoke");
const reportPath = process.env.CONVERSION_SPEED_REPORT_PATH
  ? path.resolve(process.env.CONVERSION_SPEED_REPORT_PATH)
  : path.join(runDir, "report.json");
const highFidelityScript = path.join(rootDir, "scripts", "high-fidelity-browser-output-smoke.mjs");

const budgets = {
  defaultConversionMs: Number(process.env.CONVERSION_SPEED_DEFAULT_HARD_MS || 90_000),
  amazingConversionMs: Number(process.env.CONVERSION_SPEED_AMAZING_HARD_MS || 180_000),
  settingsOpenMs: Number(process.env.CONVERSION_SPEED_SETTINGS_HARD_MS || 2_000),
  layerColorsOpenMs: Number(process.env.CONVERSION_SPEED_LAYER_COLORS_HARD_MS || 2_000),
  repeatedExportMs: Number(process.env.CONVERSION_SPEED_REPEATED_EXPORT_HARD_MS || 3_000),
};

const presetRuns = [
  {
    id: "layered-flat-color",
    label: "Layered - Flat Color",
    tier: "default",
    budgetMs: budgets.defaultConversionMs,
    measureExportCompression: true,
  },
  {
    id: "layered-flat-color-insane-quality",
    label: "Layered - Flat Color (Amazing Quality)",
    tier: "amazing",
    budgetMs: budgets.amazingConversionMs,
    measureExportCompression: false,
  },
  {
    id: "layered-detail",
    label: "Layered - Detail",
    tier: "default",
    budgetMs: budgets.defaultConversionMs,
    measureExportCompression: false,
  },
  {
    id: "layered-insane-quality",
    label: "Layered - Amazing Quality",
    tier: "amazing",
    budgetMs: budgets.amazingConversionMs,
    measureExportCompression: false,
  },
];

const expectedOutputs = new Map([
  ["IMG_8846.JPEG|layered-flat-color", {
    width: 2048,
    height: 1536,
    visibleColorCount: 32,
    dataLayerColorCount: 32,
    layerTotalCount: 32,
    bytes: 1_445_871,
    hash: "3c73ca9e",
  }],
  ["IMG_9404.JPEG|layered-flat-color", {
    width: 2048,
    height: 1536,
    visibleColorCount: 32,
    dataLayerColorCount: 32,
    layerTotalCount: 32,
    bytes: 1_190_347,
    hash: "4935a8ae",
  }],
  ["IMG_8846.JPEG|layered-flat-color-insane-quality", {
    width: 2048,
    height: 1536,
    visibleColorCount: 31,
    dataLayerColorCount: 31,
    layerTotalCount: 31,
    bytes: 5_878_538,
    hash: "97fad6bd",
  }],
  ["IMG_9404.JPEG|layered-flat-color-insane-quality", {
    width: 2048,
    height: 1536,
    visibleColorCount: 32,
    dataLayerColorCount: 32,
    layerTotalCount: 32,
    bytes: 4_957_125,
    hash: "87708095",
  }],
  ["IMG_8846.JPEG|layered-detail", {
    width: 2048,
    height: 1536,
    visibleColorCount: 10,
    dataLayerColorCount: 10,
    layerTotalCount: 10,
    bytes: 2_399_582,
    hash: "9fa072ab",
  }],
  ["IMG_9404.JPEG|layered-detail", {
    width: 2048,
    height: 1536,
    visibleColorCount: 10,
    dataLayerColorCount: 10,
    layerTotalCount: 10,
    bytes: 2_226_697,
    hash: "d8e8edfa",
  }],
  ["IMG_8846.JPEG|layered-insane-quality", {
    width: 2048,
    height: 1536,
    visibleColorCount: 31,
    dataLayerColorCount: 31,
    layerTotalCount: 31,
    bytes: 5_878_221,
    hash: "67ed627f",
  }],
  ["IMG_9404.JPEG|layered-insane-quality", {
    width: 2048,
    height: 1536,
    visibleColorCount: 32,
    dataLayerColorCount: 32,
    layerTotalCount: 32,
    bytes: 4_956_920,
    hash: "ef56fb2",
  }],
]);

const expectedExportOutputs = new Map();

await main();

async function main() {
  await fs.rm(runDir, { recursive: true, force: true });
  await fs.mkdir(runDir, { recursive: true });

  const report = {
    checkedAt: new Date().toISOString(),
    baseUrl,
    gitHead: await gitHead(),
    budgets,
    expectedOutputCount: expectedOutputs.size,
    runs: [],
    results: [],
    failures: [],
  };

  for (const preset of presetRuns) {
    const highFidelityReportPath = path.join(runDir, `high-fidelity-${preset.id}.json`);
    const child = await runHighFidelityPreset(preset, highFidelityReportPath);
    const highFidelityReport = await readJson(highFidelityReportPath).catch((error) => ({
      failures: [{ scenarioId: preset.id, fixture: null, preset: preset.label, reason: `Could not read high-fidelity report: ${error.message}` }],
      flatColor: [],
    }));
    const runEntry = {
      presetId: preset.id,
      presetLabel: preset.label,
      tier: preset.tier,
      budgetMs: preset.budgetMs,
      highFidelityReportPath,
      exitCode: child.exitCode,
      signal: child.signal,
      stderrTail: tail(child.stderr),
      highFidelityFailures: highFidelityReport.failures || [],
      results: [],
    };

    if (child.exitCode !== 0) {
      runEntry.highFidelityFailures.push({
        scenarioId: preset.id,
        fixture: null,
        preset: preset.label,
        reason: `High-fidelity browser smoke exited with ${child.exitCode}`,
      });
    }

    for (const result of highFidelityReport.flatColor || []) {
      const normalized = normalizeResult(result, preset);
      runEntry.results.push(normalized);
      report.results.push(normalized);
      report.failures.push(...validateResult(normalized, preset));
    }

    for (const failure of runEntry.highFidelityFailures) {
      report.failures.push({
        presetId: preset.id,
        presetLabel: preset.label,
        fixture: failure.fixture || null,
        reason: `High-fidelity quality check failed: ${failure.reason}`,
      });
    }

    report.runs.push(runEntry);
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  for (const key of expectedOutputs.keys()) {
    if (!report.results.some((result) => result.key === key)) {
      const [fixture, presetId] = key.split("|");
      report.failures.push({
        presetId,
        fixture,
        reason: "Expected preset/fixture speed result was not produced",
      });
    }
  }

  const ok = report.failures.length === 0;
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    ok,
    reportPath,
    failureCount: report.failures.length,
    failures: report.failures,
    results: report.results.map((result) => ({
      fixture: result.fixture,
      presetId: result.presetId,
      elapsedMs: result.elapsedMs,
      conversionMs: result.conversionMs,
      settingsOpenMs: result.settingsOpenMs,
      layerColorsOpenMs: result.layerColorsOpenMs,
      copyMs: result.copyMs,
      downloadMs: result.downloadMs,
      exportCompression: summarizeExportCompression(result.exportCompression),
      bytes: result.bytes,
      hash: result.hash,
      width: result.width,
      height: result.height,
      layerTotalCount: result.layerTotalCount,
      engineUsed: result.engineUsed,
    })),
  }, null, 2));

  if (!ok) process.exit(1);
}

async function runHighFidelityPreset(preset, highFidelityReportPath) {
  const env = {
    ...process.env,
    BASE_URL: baseUrl,
    HF_BROWSER_OUTPUT_PRESET_IDS: preset.id,
    HF_BROWSER_OUTPUT_RUN_FLAT: "1",
    HF_BROWSER_OUTPUT_RUN_PRESETS: "0",
      HF_BROWSER_OUTPUT_RUN_TIER_COMPARISON: "0",
      HF_BROWSER_OUTPUT_RENDER: "1",
      HF_BROWSER_OUTPUT_EXPORT_COMPRESSION: preset.measureExportCompression ? "1" : "0",
      HF_BROWSER_OUTPUT_INITIAL_SETTLE_MS: "0",
      HF_BROWSER_OUTPUT_MIN_LAYERS: "1",
      HF_BROWSER_OUTPUT_ACCEPTABLE_BYTES: "7000000",
      HF_BROWSER_OUTPUT_MAX_BYTES: "7000000",
      HF_BROWSER_OUTPUT_MAX_PRESET_BYTES: "7000000",
      HF_BROWSER_OUTPUT_TIMEOUT_MS: String(preset.budgetMs + 15_000),
      HF_BROWSER_OUTPUT_REPORT_PATH: highFidelityReportPath,
  };
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [highFidelityScript], {
      cwd: rootDir,
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });
    child.on("error", reject);
    child.on("close", (exitCode, signal) => resolve({ exitCode, signal, stdout, stderr }));
  });
}

function normalizeResult(result, preset) {
  const fixture = result.fixture?.basename || null;
  const key = `${fixture || "unknown"}|${result.presetId || preset.id}`;
  const ui = result.ui || {};
  const parity = result.copyDownloadParity || {};
  const timings = ui.timings || {};
  return {
    key,
    fixture,
    presetId: result.presetId || preset.id,
    presetLabel: result.presetLabel || preset.label,
    selectedPresetId: result.selectedPreset?.presetId || result.selectedPreset?.id || null,
    selectedPresetLabel: result.selectedPreset?.label || null,
    completed: Boolean(result.completed),
    elapsedMs: numberOrNull(result.elapsedMs),
    conversionMs: numberOrNull(timings.total ?? result.elapsedMs),
    budgetMs: preset.budgetMs,
    settingsOpened: Boolean(ui.settingsOpened),
    settingsOpenMs: numberOrNull(ui.settingsOpenMs ?? result.interactionTimings?.settingsOpenMs),
    layerColorsOpened: Boolean(ui.layerColorsOpened),
    layerColorsOpenMs: numberOrNull(ui.layerColorsOpenMs ?? result.interactionTimings?.layerColorsOpenMs),
    copyMs: numberOrNull(parity.copyMs ?? result.interactionTimings?.copyMs),
    downloadMs: numberOrNull(parity.downloadMs ?? result.interactionTimings?.downloadMs),
    copyDownloadParityOk: Boolean(parity.ok),
    previewVisible: Boolean(ui.previewVisible),
    bytes: numberOrNull(result.download?.bytes ?? ui.svgBytesAttr),
    hash: result.download?.hash || null,
    width: numberOrNull(result.svg?.width),
    height: numberOrNull(result.svg?.height),
    visibleColorCount: numberOrNull(result.svg?.visibleColorCount),
    dataLayerColorCount: numberOrNull(result.svg?.dataLayerColorCount),
    layerTotalCount: numberOrNull(ui.layerTotalCount),
    pathCount: numberOrNull(result.svg?.pathCount ?? result.structure?.pathCount),
    segmentCount: numberOrNull(result.structure?.totalPathSegmentCount),
    engineUsed: ui.engineUsed || null,
    timings,
    render: result.render || null,
    exportCompression: result.exportCompression || null,
    exportCompressionRequired: Boolean(preset.measureExportCompression),
  };
}

function validateResult(result, preset) {
  const failures = [];
  const expected = expectedOutputs.get(result.key);
  const add = (reason) => failures.push({
    presetId: result.presetId,
    presetLabel: result.presetLabel,
    fixture: result.fixture,
    reason,
  });

  if (!expected) {
    add("No expected output identity entry exists for this preset/fixture pair");
    return failures;
  }
  if (result.presetId !== preset.id) add(`Preset ID changed from ${preset.id} to ${result.presetId}`);
  if (!result.completed) add("Conversion did not complete");
  if (result.elapsedMs == null) add("Browser elapsed time was not recorded");
  if (result.conversionMs == null) add("Conversion timing was not recorded");
  if (result.conversionMs != null && result.conversionMs > preset.budgetMs) {
    add(
      `Conversion exceeded hard budget ${preset.budgetMs} ms; saw ${Math.round(
        result.conversionMs,
      )} ms (browser elapsed ${result.elapsedMs ?? "unknown"} ms)`,
    );
  }
  if (!result.previewVisible) add("Preview did not render");
  if (!result.settingsOpened) add("Settings/Edit did not open");
  if (result.settingsOpenMs == null) add("Settings/Edit timing was not recorded");
  if (result.settingsOpenMs != null && result.settingsOpenMs > budgets.settingsOpenMs) {
    add(`Settings/Edit exceeded hard budget ${budgets.settingsOpenMs} ms; saw ${result.settingsOpenMs} ms`);
  }
  if (!result.layerColorsOpened) add("Layer colors did not open");
  if (result.layerColorsOpenMs == null) add("Layer colors timing was not recorded");
  if (result.layerColorsOpenMs != null && result.layerColorsOpenMs > budgets.layerColorsOpenMs) {
    add(`Layer colors exceeded hard budget ${budgets.layerColorsOpenMs} ms; saw ${result.layerColorsOpenMs} ms`);
  }
  if (!result.copyDownloadParityOk) add("Copy SVG and Download SVG did not match");
  validateExportCompressionResult(result, add);
  if (result.width !== expected.width || result.height !== expected.height) {
    add(`SVG dimensions changed from ${expected.width} x ${expected.height} to ${result.width} x ${result.height}`);
  }
  if (result.visibleColorCount !== expected.visibleColorCount) {
    add(`Visible color count changed from ${expected.visibleColorCount} to ${result.visibleColorCount}`);
  }
  if (result.dataLayerColorCount !== expected.dataLayerColorCount) {
    add(`Data layer color count changed from ${expected.dataLayerColorCount} to ${result.dataLayerColorCount}`);
  }
  if (result.layerTotalCount !== expected.layerTotalCount) {
    add(`Layer color total changed from ${expected.layerTotalCount} to ${result.layerTotalCount}`);
  }
  if (result.bytes !== expected.bytes) {
    add(`Downloaded SVG byte size changed from ${expected.bytes} to ${result.bytes}`);
  }
  if (result.hash !== expected.hash) {
    add(`Downloaded SVG hash changed from ${expected.hash} to ${result.hash}`);
  }
  if (result.render?.error) add(`Rendered quality comparison failed: ${result.render.error}`);

  return failures;
}

function validateExportCompressionResult(result, add) {
  const exportCompression = result.exportCompression;
  if (!result.exportCompressionRequired) return;
  if (!exportCompression?.measured) {
    add("Export compression timing was not measured");
    return;
  }
  if (exportCompression.error) {
    add(`Export compression timing failed: ${exportCompression.error}`);
    return;
  }
  if (!exportCompression.previewUnchanged) {
    add("Live preview changed after selecting an export compression level");
  }
  if (!exportCompression.previewResetUnchanged) {
    add("Live preview changed after resetting export compression to None");
  }

  for (const level of ["none", "tiny", "tiniest"]) {
    const levelResult = exportCompression.levels?.[level];
    if (!levelResult) {
      add(`Export compression ${level} was not measured`);
      continue;
    }
    if (!levelResult.previewUnchanged) {
      add(`Live preview changed after selecting export compression ${level}`);
    }
    if (!levelResult.copyClicked) add(`Copy SVG did not click for export compression ${level}`);
    if (!levelResult.downloadClicked) add(`Download SVG did not click for export compression ${level}`);
    if (!levelResult.parityOk) add(`Copy SVG and Download SVG did not match for export compression ${level}`);
    if (level === "none") {
      if (levelResult.downloadBytes !== result.bytes) {
        add(`Export compression None changed byte size from ${result.bytes} to ${levelResult.downloadBytes}`);
      }
      if (levelResult.downloadHash !== result.hash) {
        add(`Export compression None changed hash from ${result.hash} to ${levelResult.downloadHash}`);
      }
    }
    const expectedExport = expectedExportOutputs.get(`${result.key}|${level}`);
    if (expectedExport) {
      if (levelResult.downloadBytes !== expectedExport.bytes) {
        add(`Export compression ${level} byte size changed from ${expectedExport.bytes} to ${levelResult.downloadBytes}`);
      }
      if (levelResult.downloadHash !== expectedExport.hash) {
        add(`Export compression ${level} hash changed from ${expectedExport.hash} to ${levelResult.downloadHash}`);
      }
    }
    if (level !== "none") {
      const repeat = levelResult.repeat;
      if (!repeat) {
        add(`Repeated ${level} copy/download timing was not measured`);
      } else {
        if (!repeat.parityOk) add(`Repeated ${level} copy/download parity failed`);
        if (!repeat.matchesFirst) add(`Repeated ${level} copy/download changed output`);
        if (repeat.copyMs > budgets.repeatedExportMs) {
          add(`Repeated ${level} copy exceeded hard budget ${budgets.repeatedExportMs} ms; saw ${repeat.copyMs} ms`);
        }
        if (repeat.downloadMs > budgets.repeatedExportMs) {
          add(`Repeated ${level} download exceeded hard budget ${budgets.repeatedExportMs} ms; saw ${repeat.downloadMs} ms`);
        }
      }
    }
  }
}

function summarizeExportCompression(exportCompression) {
  if (!exportCompression) return null;
  return {
    measured: Boolean(exportCompression.measured),
    error: exportCompression.error || null,
    previewUnchanged: Boolean(exportCompression.previewUnchanged),
    previewResetUnchanged: Boolean(exportCompression.previewResetUnchanged),
    levels: Object.fromEntries(
      ["none", "tiny", "tiniest"].map((level) => {
        const entry = exportCompression.levels?.[level] || null;
        return [
          level,
          entry
            ? {
                copyMs: entry.copyMs,
                downloadMs: entry.downloadMs,
                bytes: entry.downloadBytes,
                hash: entry.downloadHash,
                parityOk: Boolean(entry.parityOk),
                previewUnchanged: Boolean(entry.previewUnchanged),
                repeat: entry.repeat
                  ? {
                      copyMs: entry.repeat.copyMs,
                      downloadMs: entry.repeat.downloadMs,
                      parityOk: Boolean(entry.repeat.parityOk),
                      matchesFirst: Boolean(entry.repeat.matchesFirst),
                    }
                  : null,
              }
            : null,
        ];
      }),
    ),
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function gitHead() {
  const child = spawn("git", ["rev-parse", "HEAD"], {
    cwd: rootDir,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  for await (const chunk of child.stdout) stdout += String(chunk);
  await new Promise((resolve) => child.on("close", resolve));
  return stdout.trim();
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function tail(value, maxLength = 4000) {
  const text = String(value || "");
  return text.length > maxLength ? text.slice(-maxLength) : text;
}
