import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(path, "utf8");
}

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) {
    return `${label}: missing ${JSON.stringify(needle)}`;
  }
  return null;
}

function assertNotIncludes(source, needle, label) {
  if (source.includes(needle)) {
    return `${label}: unexpected ${JSON.stringify(needle)}`;
  }
  return null;
}

const checks = [];
const outputPanel = await read("app/client/components/converter/TraceOutputPanel.tsx");
const home = await read("app/routes/home.tsx");
const pngToSvg = await read("app/routes/png-to-svg-converter.tsx");
const pngLayered = await read("app/routes/png-to-layered-svg-for-cricut.tsx");
const blackWhiteConverter = await read("app/routes/black-and-white-image-to-svg-converter.tsx");
const printThenCut = await read("app/routes/png-to-svg-for-cricut-print-then-cut.tsx");
const cricutStickers = await read("app/routes/png-to-svg-for-cricut-stickers.tsx");
const sketchCricut = await read("app/routes/sketch-to-svg-for-cricut.tsx");
const codeCricut = await read("app/routes/code-to-svg-for-cricut.tsx");
const imageLayered = await read("app/routes/image-to-layered-svg-for-cricut.tsx");
const jpgLayered = await read("app/routes/jpg-to-layered-svg-for-cricut.tsx");
const layeredCricut = await read("app/routes/layered-svg-for-cricut.tsx");
const logoLayered = await read("app/routes/logo-to-layered-svg-for-cricut.tsx");
const sketchToSvg = await read("app/routes/sketch-to-svg-converter.tsx");
const photoOutline = await read("app/routes/photo-to-svg-outline.tsx");
const pngCricut = await read("app/routes/png-to-svg-for-cricut.tsx");
const browserSmoke = await read("scripts/hybrid-browser-smoke.mjs");
const appCss = await read("app/app.css");
const packageJson = await read("package.json");
const sourceSnapshots = await read("app/client/lib/converter/sourceSnapshots.ts");
const presetIntensity = await read("app/client/lib/converter/presetIntensity.ts");
const presetSelector = await read("app/client/components/converter/PresetSelector.tsx");
const presetAdditions = await read("app/client/lib/converter/presetAdditions.ts");
const vtracerWorker = await read("app/client/workers/vtracer.worker.ts");
let bespokeOutputPanel = "";
try {
  bespokeOutputPanel = await read("app/client/components/converter/BespokeTraceOutputPanel.tsx");
} catch {
  checks.push("bespoke output panel exists: missing app/client/components/converter/BespokeTraceOutputPanel.tsx");
}

let appearance = "";
try {
  appearance = await read("app/client/lib/converter/outputAppearance.ts");
} catch {
  checks.push("output appearance helper exists: missing app/client/lib/converter/outputAppearance.ts");
}

checks.push(
  assertIncludes(outputPanel, "focusedOutputStamp", "shared output panel tracks focused editor target"),
  assertIncludes(outputPanel, "collapsedOutputStamps", "shared output panel tracks collapsed cards"),
  assertIncludes(outputPanel, "data-focused-editor", "shared output panel exposes focused editor state"),
  assertIncludes(outputPanel, "data-output-panel-focused", "shared output panel exposes parent-level focused state"),
  assertIncludes(outputPanel, "data-focused-editor-workspace", "shared focused editor renders a workspace"),
  assertIncludes(outputPanel, "data-editor-output-preview", "shared focused editor labels output comparison preview"),
  assertIncludes(outputPanel, "data-editor-original-preview", "shared focused editor labels original comparison preview"),
  assertIncludes(outputPanel, "data-editor-settings-panel", "shared focused editor labels settings panel"),
  assertIncludes(outputPanel, "data-output-file-size", "shared output cards expose displayed SVG file size"),
  assertIncludes(outputPanel, "data-output-source-file", "shared output cards preserve source-file metadata"),
  assertIncludes(outputPanel, "sourcePreviewUrl", "shared output cards can render per-output source snapshots"),
  assertIncludes(outputPanel, "data-output-minimize-control", "shared output cards place minimize as a header control"),
  assertIncludes(outputPanel, "sourceAvailableForOutput", "shared focused editor guards old-source update actions"),
  assertIncludes(outputPanel, "focusedEditorMode", "shared settings switch to focused-editor accordion mode"),
  assertIncludes(outputPanel, "data-collapse-state", "shared output panel exposes collapse state"),
  assertIncludes(outputPanel, "OutputAppearanceControls", "shared output panel renders line/fill controls"),
  assertIncludes(outputPanel, "Line weight", "line weight control is visible in output settings"),
  assertIncludes(outputPanel, "Fill spread", "fill spread control is visible where supported"),
  assertIncludes(outputPanel, "showStrokeOutputMode", "shared output panel hides non-actionable stroke output mode radios"),
  assertIncludes(outputPanel, "strokeOutputModeAvailable && !strokeModeDisabled", "stroke output mode radios render only when actionable"),
  assertIncludes(outputPanel, "getTraceOutputSvg(item)", "shared finalized SVG helper remains the copy/download source"),
  assertIncludes(home, "focusedOutputStamp", "home bespoke card tracks focused editor target"),
  assertIncludes(home, "collapsedOutputStamps", "home bespoke card tracks collapsed cards"),
  assertIncludes(home, "data-focused-editor", "home bespoke card exposes focused editor state"),
  assertIncludes(home, "data-output-panel-focused", "home bespoke card exposes parent-level focused state"),
  assertIncludes(home, "FocusedEditorPreviewComparison", "home focused editor shows original comparison"),
  assertIncludes(home, "data-output-batch-shortcut", "home output cards expose a batch settings shortcut"),
  assertIncludes(home, "data-output-file-size", "home output cards expose displayed SVG file size"),
  assertIncludes(home, "data-output-source-file", "home output cards preserve source-file metadata"),
  assertIncludes(home, "createOutputSourceSnapshot", "home captures per-output source preview snapshots"),
  assertIncludes(home, "cleanupUnusedSourceSnapshots", "home cleans source snapshots with history lifetime"),
  assertIncludes(home, "outputMatchesActiveSource", "home keeps old-source output update actions guarded"),
  assertIncludes(home, "trimOutputHistory", "home trims output history instead of clearing it"),
  assertIncludes(home, "data-collapse-state", "home bespoke card exposes collapse state"),
  assertIncludes(pngToSvg, "trimOutputHistory", "PNG route trims output history instead of clearing it"),
  assertIncludes(pngToSvg, "outputMatchesActiveSource", "PNG route guards old-source output update actions"),
  assertIncludes(pngToSvg, "sourceFileName", "PNG route stamps outputs with source-file metadata"),
  assertIncludes(pngToSvg, "createOutputSourceSnapshot", "PNG route captures per-output source preview snapshots"),
  assertIncludes(pngToSvg, "cleanupUnusedSourceSnapshots", "PNG route cleans source snapshots with history lifetime"),
  assertIncludes(sketchToSvg, "sourceFileName", "sketch route stamps outputs with source-file metadata"),
  assertNotIncludes(sketchToSvg, "setHistory([])", "sketch route preserves output history on file replacement/removal"),
  assertIncludes(photoOutline, "sourceFileName", "photo outline route stamps outputs with source-file metadata"),
  assertNotIncludes(photoOutline, "setHistory([])", "photo outline route preserves output history on file replacement/removal"),
  assertIncludes(pngCricut, "sourceFileName", "PNG Cricut route stamps outputs with source-file metadata"),
  assertNotIncludes(pngCricut, "setHistory([])", "PNG Cricut route preserves output history on file replacement/removal"),
  assertIncludes(pngLayered, "focusedOutputStamp", "PNG layered bespoke card tracks focused editor target"),
  assertIncludes(pngLayered, "collapsedOutputStamps", "PNG layered bespoke card tracks collapsed cards"),
  assertIncludes(pngLayered, "data-focused-editor", "PNG layered bespoke card exposes focused editor state"),
  assertIncludes(pngLayered, "data-output-panel-focused", "PNG layered bespoke card exposes parent-level focused state"),
  assertIncludes(pngLayered, "FocusedEditorPreviewComparison", "PNG layered focused editor shows original comparison"),
  assertIncludes(pngLayered, "data-output-file-size", "PNG layered output cards expose displayed SVG file size"),
  assertIncludes(pngLayered, "data-output-source-file", "PNG layered output cards preserve source-file metadata"),
  assertIncludes(pngLayered, "createOutputSourceSnapshot", "PNG layered captures per-output source preview snapshots"),
  assertIncludes(pngLayered, "cleanupUnusedSourceSnapshots", "PNG layered cleans source snapshots with history lifetime"),
  assertIncludes(pngLayered, "outputMatchesActiveSource", "PNG layered keeps old-source output update actions guarded"),
  assertIncludes(pngLayered, "trimOutputHistory", "PNG layered trims output history instead of clearing it"),
  ...[
    ["black-and-white-image-to-svg-converter", blackWhiteConverter],
    ["png-to-svg-for-cricut-print-then-cut", printThenCut],
    ["png-to-svg-for-cricut-stickers", cricutStickers],
    ["sketch-to-svg-for-cricut", sketchCricut],
    ["code-to-svg-for-cricut", codeCricut],
    ["image-to-layered-svg-for-cricut", imageLayered],
    ["jpg-to-layered-svg-for-cricut", jpgLayered],
    ["layered-svg-for-cricut", layeredCricut],
    ["logo-to-layered-svg-for-cricut", logoLayered],
  ].flatMap(([route, source]) => [
    assertIncludes(source, "BespokeTraceOutputPanel", `${route} uses the shared bespoke output-card shell`),
    assertIncludes(source, "createOutputSourceSnapshot", `${route} captures per-output source preview snapshots`),
    assertIncludes(source, "cleanupUnusedSourceSnapshots", `${route} cleans source snapshots with history lifetime`),
    assertIncludes(source, "trimOutputHistory", `${route} trims output history instead of clearing it`),
    assertNotIncludes(source, "setHistory([])", `${route} preserves output history on file replacement/removal`),
  ]),
  assertIncludes(browserSmoke, "OUTPUT_UX_SMOKE", "browser smoke has focused-editor/collapse/appearance mode"),
  assertIncludes(browserSmoke, "verifyOutputHistoryPersistsAcrossInputReplacement", "browser smoke verifies output history survives input replacement"),
  assertIncludes(browserSmoke, "verifyFocusedOriginalPreviewForSource", "browser smoke verifies old outputs keep original preview snapshots"),
  assertIncludes(browserSmoke, "verifyFocusedAccordionHasNoHorizontalShift", "browser smoke verifies accordion x-axis stability"),
  assertIncludes(browserSmoke, "previewPaneLeftDelta", "browser smoke measures preview pane x-axis stability"),
  assertIncludes(browserSmoke, "settingsRailLeftDelta", "browser smoke measures settings rail x-axis stability"),
  assertIncludes(browserSmoke, "/sketch-to-svg-converter", "browser smoke covers sketch route history replacement"),
  assertIncludes(browserSmoke, "/photo-to-svg-outline", "browser smoke covers photo outline route history replacement"),
  assertIncludes(browserSmoke, "/png-to-svg-for-cricut", "browser smoke covers PNG Cricut route history replacement"),
  assertIncludes(browserSmoke, "appearanceRanges", "browser smoke verifies useful stroke/fill ranges"),
  assertIncludes(browserSmoke, "lineWeightMax >= 30", "browser smoke requires wider line-weight control"),
  assertIncludes(browserSmoke, "fillSpreadMax >= 30", "browser smoke requires wider fill-spread control"),
  assertIncludes(browserSmoke, "sourceFileNames", "browser smoke reads output source-file metadata"),
  assertIncludes(browserSmoke, "leftPaneCollapsed", "browser smoke verifies focused editor hides the upload pane"),
  assertIncludes(browserSmoke, "hasOriginalComparison", "browser smoke verifies original comparison is visible"),
  assertIncludes(browserSmoke, "hasFocusedRedundantActions", "browser smoke rejects redundant focused editor actions"),
  assertIncludes(browserSmoke, "openSettingsSectionCount", "browser smoke verifies one settings section is open"),
  assertIncludes(browserSmoke, "batchShortcut", "browser smoke verifies batch settings shortcut behavior"),
  assertIncludes(appCss, "data-output-panel-focused", "CSS contains focused editor parent grid transition"),
  assertIncludes(appCss, "scrollbar-gutter", "CSS reserves scrollbar space for focused editor/settings stability"),
  assertIncludes(appCss, "data-settings-section", "CSS constrains settings sections against horizontal drift"),
  assertIncludes(appCss, "focused-editor-enter", "CSS contains smoother focused editor transition"),
  assertIncludes(appCss, "prefers-reduced-motion", "CSS respects reduced motion for editor transitions"),
  assertIncludes(packageJson, "test:output-ux", "package exposes output UX audit"),
  assertIncludes(sourceSnapshots, "createOutputSourceSnapshot", "source snapshot helper captures preview URL per job"),
  assertIncludes(sourceSnapshots, "cleanupUnusedSourceSnapshots", "source snapshot helper revokes URLs only after history removal"),
  assertIncludes(presetIntensity, '"very-slow"', "preset intensity model includes Very Slow"),
  assertIncludes(presetIntensity, '"insanely-slow"', "preset intensity model includes Insanely Slow"),
  assertIncludes(presetIntensity, "Very Slow", "preset intensity badges render Very Slow"),
  assertIncludes(presetIntensity, "Insanely Slow", "preset intensity badges render Insanely Slow"),
  assertIncludes(presetSelector, '"very-slow"', "preset speed filter includes Very Slow"),
  assertIncludes(presetSelector, '"insanely-slow"', "preset speed filter includes Insanely Slow"),
  assertIncludes(presetAdditions, 'id: "filled-layers-separate-colors"', "heavy filled-layers preset exists"),
  assertIncludes(presetAdditions, 'backendIntensity: "insanely-slow"', "heaviest layered presets are labeled Insanely Slow"),
  assertIncludes(presetAdditions, 'backendIntensity: "very-slow"', "heavy layered presets are labeled Very Slow"),
  assertIncludes(vtracerWorker, "buildTransparentPixelMask", "VTracer worker builds transparency mask before quantization"),
  assertIncludes(vtracerWorker, "applyTransparentPixelMask", "VTracer worker reapplies transparency mask after quantization"),
  assertIncludes(vtracerWorker, "transparentPixelMask", "layered quantization preserves transparent source pixels"),
);

if (appearance) {
  checks.push(
    assertIncludes(appearance, "detectOutputAppearanceSupport", "appearance helper detects stroke/fill support"),
    assertIncludes(appearance, "applyOutputAppearanceToSvg", "appearance helper finalizes SVG adjustments"),
    assertIncludes(appearance, "lineWeight", "appearance helper supports line weight"),
    assertIncludes(appearance, "fillSpread", "appearance helper supports fill spread"),
    assertIncludes(appearance, "LINE_WEIGHT_MAX = 30", "appearance helper allows practical manual line weight"),
    assertIncludes(appearance, "FILL_SPREAD_MAX = 30", "appearance helper allows wider guarded fill spread"),
  );
}

if (bespokeOutputPanel) {
  checks.push(
    assertIncludes(bespokeOutputPanel, "focusedOutputStamp", "bespoke output panel tracks focused editor target"),
    assertIncludes(bespokeOutputPanel, "collapsedOutputStamps", "bespoke output panel tracks collapsed cards"),
    assertIncludes(bespokeOutputPanel, "FocusedEditorPreviewComparison", "bespoke focused editor shows original comparison"),
    assertIncludes(bespokeOutputPanel, "data-output-file-size", "bespoke output cards expose displayed SVG file size"),
    assertIncludes(bespokeOutputPanel, "data-output-source-file", "bespoke output cards preserve source-file metadata"),
    assertIncludes(bespokeOutputPanel, "OutputAppearanceControls", "bespoke output panel renders line/fill controls"),
    assertIncludes(bespokeOutputPanel, "data-output-panel-focused", "bespoke output panel exposes focused state"),
    assertIncludes(bespokeOutputPanel, "data-collapse-state", "bespoke output panel exposes collapse state"),
  );
}

const failures = checks.filter(Boolean);

if (failures.length) {
  console.error("[output-card-ux-audit] failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[output-card-ux-audit] ok");
