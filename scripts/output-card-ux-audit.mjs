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

const checks = [];
const outputPanel = await read("app/client/components/converter/TraceOutputPanel.tsx");
const home = await read("app/routes/home.tsx");
const pngToSvg = await read("app/routes/png-to-svg-converter.tsx");
const pngLayered = await read("app/routes/png-to-layered-svg-for-cricut.tsx");
const browserSmoke = await read("scripts/hybrid-browser-smoke.mjs");
const appCss = await read("app/app.css");
const packageJson = await read("package.json");

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
  assertIncludes(outputPanel, "data-output-minimize-control", "shared output cards place minimize as a header control"),
  assertIncludes(outputPanel, "sourceAvailableForOutput", "shared focused editor guards old-source update actions"),
  assertIncludes(outputPanel, "focusedEditorMode", "shared settings switch to focused-editor accordion mode"),
  assertIncludes(outputPanel, "data-collapse-state", "shared output panel exposes collapse state"),
  assertIncludes(outputPanel, "OutputAppearanceControls", "shared output panel renders line/fill controls"),
  assertIncludes(outputPanel, "Line weight", "line weight control is visible in output settings"),
  assertIncludes(outputPanel, "Fill spread", "fill spread control is visible where supported"),
  assertIncludes(outputPanel, "getTraceOutputSvg(item)", "shared finalized SVG helper remains the copy/download source"),
  assertIncludes(home, "focusedOutputStamp", "home bespoke card tracks focused editor target"),
  assertIncludes(home, "collapsedOutputStamps", "home bespoke card tracks collapsed cards"),
  assertIncludes(home, "data-focused-editor", "home bespoke card exposes focused editor state"),
  assertIncludes(home, "data-output-panel-focused", "home bespoke card exposes parent-level focused state"),
  assertIncludes(home, "FocusedEditorPreviewComparison", "home focused editor shows original comparison"),
  assertIncludes(home, "data-output-batch-shortcut", "home output cards expose a batch settings shortcut"),
  assertIncludes(home, "data-output-file-size", "home output cards expose displayed SVG file size"),
  assertIncludes(home, "data-output-source-file", "home output cards preserve source-file metadata"),
  assertIncludes(home, "outputMatchesActiveSource", "home keeps old-source output update actions guarded"),
  assertIncludes(home, "trimOutputHistory", "home trims output history instead of clearing it"),
  assertIncludes(home, "data-collapse-state", "home bespoke card exposes collapse state"),
  assertIncludes(pngToSvg, "trimOutputHistory", "PNG route trims output history instead of clearing it"),
  assertIncludes(pngToSvg, "outputMatchesActiveSource", "PNG route guards old-source output update actions"),
  assertIncludes(pngToSvg, "sourceFileName", "PNG route stamps outputs with source-file metadata"),
  assertIncludes(pngLayered, "focusedOutputStamp", "PNG layered bespoke card tracks focused editor target"),
  assertIncludes(pngLayered, "collapsedOutputStamps", "PNG layered bespoke card tracks collapsed cards"),
  assertIncludes(pngLayered, "data-focused-editor", "PNG layered bespoke card exposes focused editor state"),
  assertIncludes(pngLayered, "data-output-panel-focused", "PNG layered bespoke card exposes parent-level focused state"),
  assertIncludes(pngLayered, "FocusedEditorPreviewComparison", "PNG layered focused editor shows original comparison"),
  assertIncludes(pngLayered, "data-output-file-size", "PNG layered output cards expose displayed SVG file size"),
  assertIncludes(pngLayered, "data-output-source-file", "PNG layered output cards preserve source-file metadata"),
  assertIncludes(pngLayered, "outputMatchesActiveSource", "PNG layered keeps old-source output update actions guarded"),
  assertIncludes(pngLayered, "trimOutputHistory", "PNG layered trims output history instead of clearing it"),
  assertIncludes(browserSmoke, "OUTPUT_UX_SMOKE", "browser smoke has focused-editor/collapse/appearance mode"),
  assertIncludes(browserSmoke, "verifyOutputHistoryPersistsAcrossInputReplacement", "browser smoke verifies output history survives input replacement"),
  assertIncludes(browserSmoke, "verifyFocusedAccordionHasNoHorizontalShift", "browser smoke verifies accordion x-axis stability"),
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
);

if (appearance) {
  checks.push(
    assertIncludes(appearance, "detectOutputAppearanceSupport", "appearance helper detects stroke/fill support"),
    assertIncludes(appearance, "applyOutputAppearanceToSvg", "appearance helper finalizes SVG adjustments"),
    assertIncludes(appearance, "lineWeight", "appearance helper supports line weight"),
    assertIncludes(appearance, "fillSpread", "appearance helper supports fill spread"),
  );
}

const failures = checks.filter(Boolean);

if (failures.length) {
  console.error("[output-card-ux-audit] failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[output-card-ux-audit] ok");
