import { readdir, readFile } from "node:fs/promises";

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
const routeFiles = (await readdir("app/routes"))
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => `app/routes/${file}`);
const routeSources = await Promise.all(
  routeFiles.map(async (file) => [file, await read(file)]),
);
const outputPanel = await read("app/client/components/converter/TraceOutputPanel.tsx");
const advancedSettingsPanel = await read("app/client/components/converter/AdvancedSettingsPanel.tsx");
const svgRecolor = await read("app/routes/svg-recolor.tsx");
const svgBackgroundEditor = await read("app/routes/svg-background-editor.tsx");
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
const layerPaletteEditor = await read("app/client/components/svg/LayerPaletteEditor.tsx");
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

let fillStrokeSvg = "";
try {
  fillStrokeSvg = await read("app/shared/tracing/fillStrokeSvg.ts");
} catch {
  checks.push("fill+stroke SVG helper exists: missing app/shared/tracing/fillStrokeSvg.ts");
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
    assertIncludes(outputPanel, "data-post-processing-controls", "shared output panel renders post-processing controls"),
    assertIncludes(outputPanel, "Sticker border", "shared output panel exposes sticker border controls"),
    assertIncludes(outputPanel, "Border layer", "sticker border controls expose border layer placement"),
    assertIncludes(outputPanel, "On top of artwork", "sticker border controls default to an on-top layer option"),
    assertIncludes(outputPanel, "Gradient fill", "shared output panel exposes gradient fill controls"),
    assertIncludes(outputPanel, "Pattern fill", "shared output panel exposes pattern fill controls"),
    assertIncludes(outputPanel, "Shadow and glow", "shared output panel exposes shadow/glow controls"),
    assertIncludes(outputPanel, "Reset gap", "shared output panel exposes an internal-gap-only reset"),
    assertIncludes(outputPanel, "outputAppearanceSvgCache", "shared output panel caches finalized post-processed SVGs"),
    assertIncludes(outputPanel, "pruneOutputAppearanceState", "shared output panel prunes removed output appearance state"),
    assertIncludes(outputPanel, "livePreviewLeadTitle=\"Post-processing\"", "shared focused editor labels post-processing inside live preview edits"),
    assertIncludes(outputPanel, "Live Preview Edits", "shared focused editor labels immediate output controls clearly"),
    assertIncludes(outputPanel, "Click To Convert", "shared focused editor labels source-retrace controls clearly"),
    assertIncludes(outputPanel, "does not restart conversion after every slider or color change", "shared focused editor explains why update preview is manual"),
    assertIncludes(outputPanel, 'data-output-polish-group="sticker-border"', "sticker border controls have a named output-polish group"),
    assertIncludes(outputPanel, "showStickerBorderControls", "sticker border controls render only when supported by the output"),
    assertIncludes(outputPanel, "showStrokeControls", "stroke controls render only when editable stroke targets exist"),
    assertIncludes(outputPanel, "showFillControls", "fill controls render only when editable fill targets exist"),
    assertIncludes(outputPanel, "showFillStyleControls", "gradient and pattern controls render only when fill targets exist"),
    assertIncludes(outputPanel, "showShadowControls", "shadow controls render only when supported by the output"),
    assertIncludes(outputPanel, "buildTargetDisplay", "target selectors build user-friendly display labels from structured target data"),
    assertIncludes(outputPanel, "data-target-selector-preview", "target selectors show a selected target preview row"),
    assertIncludes(outputPanel, "data-target-swatch", "target selectors show swatches for color and layer targets"),
    assertNotIncludes(outputPanel, "{target.label}", "target selectors do not render raw model labels as the primary option text"),
    assertIncludes(outputPanel, "data-output-polish-subcontrols", "expanded output-polish controls use lightweight subcontrol group markers"),
    assertNotIncludes(outputPanel, 'defaultOpenSection="output-appearance"', "focused editor does not force the post-processing menu open"),
    assertNotIncludes(outputPanel, "mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2", "output polish groups use dividers instead of nested cards"),
    assertNotIncludes(outputPanel, "sm:col-span-2 rounded-lg border border-slate-200 bg-white p-2", "internal gap controls do not add another nested card"),
    assertNotIncludes(outputPanel, "support.capabilitySummary", "output polish does not show diagnostic capability summaries by default"),
    assertNotIncludes(outputPanel, "showStrokeOutputModeReason", "unsupported stroke output mode is hidden instead of shown as a disabled explanation"),
    assertNotIncludes(outputPanel, "Centerline strokes are for single line-art outputs, not layered color results.", "centerline layered-output diagnostic copy is not visible UI copy"),
    assertNotIncludes(outputPanel, "Sticker border needs foreground filled shapes", "sticker border unsupported reason is not visible UI copy"),
    assertNotIncludes(outputPanel, "Applies only to SVG elements with real editable strokes.", "stroke internal target explanation is not visible UI copy"),
    assertNotIncludes(outputPanel, "No editable strokes were detected in this SVG.", "stroke unavailable paragraph is hidden by default"),
    assertNotIncludes(outputPanel, "No stroked lines were detected in this SVG.", "stroke line unavailable paragraph is hidden by default"),
    assertNotIncludes(outputPanel, "No editable filled shapes were detected in this SVG.", "fill unavailable paragraph is hidden by default"),
    assertNotIncludes(outputPanel, "Applies only to editable filled shapes.", "fill internal target explanation is not visible UI copy"),
    assertIncludes(outputPanel, "useThrottledCommit", "shared output appearance controls throttle high-frequency SVG edits"),
    assertIncludes(outputPanel, "ThrottledRangeInput", "shared output appearance range controls keep draft values before committing"),
    assertNotIncludes(outputPanel, "onChange={(event) => onChange({ lineWeight", "line weight avoids direct per-event SVG rewrites"),
    assertNotIncludes(outputPanel, "onChange={(event) => onChange({ fillSpread", "fill spread avoids direct per-event SVG rewrites"),
    assertIncludes(advancedSettingsPanel, "useThrottledCommit", "shared advanced settings color/range controls use the draft/commit helper"),
    assertIncludes(advancedSettingsPanel, "data-settings-section-tone", "settings sections expose category tone markers for visual hierarchy"),
    assertIncludes(advancedSettingsPanel, "data-settings-top-section-open", "top-level settings groups expose collapsed/open state"),
    assertIncludes(advancedSettingsPanel, "aria-expanded={open}", "top-level settings groups are accessible accordions"),
    assertIncludes(advancedSettingsPanel, "React.useState(false)", "top-level settings groups start collapsed"),
    assertIncludes(advancedSettingsPanel, "Live Preview Edits", "advanced settings labels live preview edits plainly"),
    assertIncludes(advancedSettingsPanel, "Click To Convert", "advanced settings labels manual retrace controls plainly"),
    assertIncludes(advancedSettingsPanel, "does not restart conversion after every slider or color change", "advanced settings explain manual Update preview behavior"),
    assertIncludes(advancedSettingsPanel, "getSettingsSectionToneClasses", "settings category tone classes are centralized"),
    assertIncludes(advancedSettingsPanel, "showOutputLayerControls", "layer controls render only when real output layer controls exist"),
    assertNotIncludes(advancedSettingsPanel, "outputLayerUnavailableMessage", "layer-unavailable implementation detail is not rendered in the default settings UI"),
    assertNotIncludes(advancedSettingsPanel, "Generate an SVG to edit output layer colors and opacity.", "empty layer editor is hidden instead of shown as an unavailable section"),
    assertNotIncludes(advancedSettingsPanel, 'aria-label="Hide all layer colors"', "layer colors no longer exposes an unnecessary Hide all bulk action"),
    assertNotIncludes(advancedSettingsPanel, 'aria-label="Show all layer colors"', "layer colors no longer exposes an unnecessary Show all bulk action"),
    assertNotIncludes(advancedSettingsPanel, 'data-layer-color-search="true"', "layer colors no longer exposes a random-color search field"),
    assertNotIncludes(advancedSettingsPanel, "OutputLayerLightRow", "layer colors does not use a light row that requires a nested Edit action"),
    assertIncludes(advancedSettingsPanel, 'data-layer-color-opacity-row="true"', "layer row opacity controls are directly visible"),
    assertIncludes(advancedSettingsPanel, 'data-layer-color-manual-row="true"', "layer row manual color input has its own row"),
    assertIncludes(advancedSettingsPanel, 'data-layer-color-manual-input="true"', "layer row manual color input is directly addressable"),
    assertIncludes(advancedSettingsPanel, 'tone="effects"', "output polish section uses an effects category tone"),
    assertIncludes(advancedSettingsPanel, 'tone="layers"', "layer color section uses a layer category tone"),
    assertIncludes(advancedSettingsPanel, 'tone="remove"', "color removal sections use a cleanup/removal category tone"),
    assertIncludes(advancedSettingsPanel, 'tone="export"', "size and export section uses an export category tone"),
    assertIncludes(advancedSettingsPanel, 'tone="convert"', "retrace settings use a click-to-convert category tone"),
    assertIncludes(svgRecolor, "deferredSettings", "SVG recolor defers expensive preview recoloring while color controls update"),
    assertIncludes(svgRecolor, "deferredPairs", "SVG recolor defers expensive replacement-rule preview updates"),
    assertIncludes(svgRecolor, "recolorSvg(inSvg, settings, pairs)", "SVG recolor copy/download regenerate from committed current state"),
    assertIncludes(svgBackgroundEditor, "deferredSettings", "SVG background editor defers expensive preview rebuilds while sliders update"),
    assertIncludes(svgBackgroundEditor, "applyBackgroundEdits(inputSvgValid, settings)", "SVG background editor copy/download regenerate from committed current state"),
  assertIncludes(outputPanel, "Line weight", "line weight control is visible in output settings"),
  assertIncludes(outputPanel, "Fill spread", "fill spread control is visible where supported"),
  assertIncludes(outputPanel, "showStrokeOutputMode", "shared output panel hides non-actionable stroke output mode radios"),
  assertIncludes(outputPanel, "strokeOutputModeAvailable && !strokeModeDisabled", "stroke output mode radios render only when actionable"),
  assertIncludes(outputPanel, "getTraceOutputSvg(item)", "shared finalized SVG helper remains the copy/download source"),
  assertIncludes(outputPanel, "hasUsableOutput", "shared output panel hides output actions until a valid output exists"),
  assertIncludes(outputPanel, "isActiveJob || isFailedJob || !item.svg ? \"\" : getTraceOutputSvg(item)", "shared output panel prevents failed jobs from reusing preview SVG actions"),
  assertIncludes(bespokeOutputPanel, "hasUsableOutput", "bespoke output panel hides output actions until a valid output exists"),
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
  assertIncludes(home, "hasUsableOutput", "home bespoke card hides output actions on failed conversions"),
  assertIncludes(home, "SVG cleanup", "home reports SVG uploads as cleanup instead of Hybrid trace"),
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
  assertIncludes(pngLayered, "canUseOutput &&", "PNG layered route-local card hides output actions on failed conversions"),
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
  assertIncludes(browserSmoke, "SVG_INPUT_SMOKE", "browser smoke has a homepage SVG-input cleanup scenario"),
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
  assertIncludes(browserSmoke, "openSettingsSectionCount === 0", "browser smoke verifies focused settings submenus start collapsed"),
  assertIncludes(browserSmoke, "batchShortcut", "browser smoke verifies batch settings shortcut behavior"),
  assertIncludes(appCss, "data-output-panel-focused", "CSS contains focused editor parent grid transition"),
  assertNotIncludes(appCss, "scrollbar-gutter: stable", "CSS avoids reserved scrollbar gutters that create focused-editor right-side gaps"),
  assertNotIncludes(appCss, "inline-size: clamp", "focused editor settings rail does not force a clamp wider than its column"),
  assertIncludes(appCss, "data-settings-section", "CSS constrains settings sections against horizontal drift"),
  assertIncludes(appCss, "focused-editor-enter", "CSS contains smoother focused editor transition"),
  assertIncludes(appCss, "prefers-reduced-motion", "CSS respects reduced motion for editor transitions"),
  assertIncludes(packageJson, "test:output-ux", "package exposes output UX audit"),
  assertIncludes(packageJson, "test:post-processing", "package exposes post-processing smoke audit"),
  assertIncludes(sourceSnapshots, "createOutputSourceSnapshot", "source snapshot helper captures preview URL per job"),
  assertIncludes(sourceSnapshots, "cleanupUnusedSourceSnapshots", "source snapshot helper revokes URLs only after history removal"),
  assertIncludes(presetIntensity, '"very-slow"', "preset intensity model includes Very Slow"),
  assertIncludes(presetIntensity, '"insanely-slow"', "preset intensity model includes Insanely Slow"),
  assertIncludes(presetIntensity, "Very Slow", "preset intensity badges render Very Slow"),
  assertIncludes(presetIntensity, "Insanely Slow", "preset intensity badges render Insanely Slow"),
  assertIncludes(presetSelector, '"very-slow"', "preset speed filter includes Very Slow"),
  assertIncludes(presetSelector, '"insanely-slow"', "preset speed filter includes Insanely Slow"),
  assertIncludes(presetSelector, 'PINNED_PRESETS_STORAGE_KEY = "ilovesvg:pinned-presets:v1"', "preset picker uses the stable pinned preset storage key"),
  assertIncludes(presetSelector, "getPinnedPresetIds", "preset picker exposes a guarded pinned preset loader"),
  assertIncludes(presetSelector, "setPinnedPresetIds", "preset picker exposes a guarded pinned preset writer"),
  assertIncludes(presetSelector, "togglePinnedPresetId", "preset picker toggles pinned IDs without storing full presets"),
  assertIncludes(presetSelector, 'role="tablist"', "preset picker renders All/Pinned tabs in the expanded menu"),
  assertIncludes(presetSelector, 'role="tab"', "preset picker tabs are keyboard/screen-reader addressable"),
  assertIncludes(presetSelector, "routePinnedPresets", "preset picker filters pinned presets through route-visible preset availability"),
  assertIncludes(presetSelector, "Search pinned presets", "preset picker search is scoped and labeled for the active tab"),
  assertIncludes(presetSelector, "Pin presets you use often to keep them here.", "preset picker shows a compact pinned empty state"),
  assertIncludes(presetSelector, 'aria-label={pinned ? "Unpin preset" : "Pin preset"}', "preset pin button has accessible pin/unpin labels"),
  assertIncludes(presetSelector, "BookmarkAddIcon", "preset picker contains the unpinned bookmark icon"),
  assertIncludes(presetSelector, "BookmarkPinnedIcon", "preset picker contains the pinned bookmark icon"),
  assertIncludes(presetSelector, 'fill="currentColor"', "preset pin icons inherit the current text color"),
  assertIncludes(presetSelector, "min(62vh, 42rem)", "expanded preset menu can use more vertical space when previews are hidden"),
  assertIncludes(presetSelector, "onExpandedChange?.(expanded)", "preset picker reports expanded/collapsed state to route layouts"),
  assertIncludes(presetSelector, "pr-10", "preset card reserves space for the pin control without crushing labels"),
  assertIncludes(presetSelector, "min-w-0 break-words", "preset card titles wrap cleanly in narrow cards"),
  assertIncludes(presetSelector, "w-fit max-w-full truncate", "preset speed badges do not force awkward preset title wrapping"),
  assertNotIncludes(presetSelector, "<button\n      className", "preset card avoids wrapping the whole card and pin control in one nested button"),
  assertIncludes(home, "onExpandedChange={setPresetMenuExpanded}", "home hides the input preview while expanded presets are open"),
  assertIncludes(home, "previewUrl && !presetMenuExpanded", "home restores source preview only after presets collapse"),
  assertIncludes(pngToSvg, "onExpandedChange={setPresetMenuExpanded}", "PNG converter hides the input preview while expanded presets are open"),
  assertIncludes(pngToSvg, "previewUrl && !presetMenuExpanded", "PNG converter restores source preview only after presets collapse"),
  assertIncludes(pngLayered, "onExpandedChange={setPresetMenuExpanded}", "PNG layered route hides the input preview while expanded presets are open"),
  assertIncludes(pngLayered, "previewUrl && !presetMenuExpanded", "PNG layered route restores source preview only after presets collapse"),
  assertIncludes(presetAdditions, 'id: "filled-layers-separate-colors"', "heavy filled-layers preset exists"),
  assertIncludes(presetAdditions, 'backendIntensity: "insanely-slow"', "heaviest layered presets are labeled Insanely Slow"),
  assertIncludes(presetAdditions, 'backendIntensity: "very-slow"', "heavy layered presets are labeled Very Slow"),
  assertIncludes(vtracerWorker, "buildTransparentPixelMask", "VTracer worker builds transparency mask before quantization"),
  assertIncludes(vtracerWorker, "applyTransparentPixelMask", "VTracer worker reapplies transparency mask after quantization"),
  assertIncludes(vtracerWorker, "transparentPixelMask", "layered quantization preserves transparent source pixels"),
  assertNotIncludes(layerPaletteEditor, "sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.7fr)_auto]", "layer palette rows avoid viewport-based grids inside narrow settings rails"),
);

if (appearance) {
  checks.push(
    assertIncludes(appearance, "detectOutputAppearanceSupport", "appearance helper detects stroke/fill support"),
    assertIncludes(appearance, "applyOutputAppearanceToSvg", "appearance helper finalizes SVG adjustments"),
    assertIncludes(appearance, "lineWeight", "appearance helper supports line weight"),
    assertIncludes(appearance, "fillSpread", "appearance helper supports fill spread"),
    assertIncludes(appearance, "stickerBorderEnabled", "appearance helper supports sticker border"),
    assertIncludes(appearance, "internalGapFillEnabled", "appearance helper supports internal gap fill"),
    assertIncludes(appearance, "gradientEnabled", "appearance helper supports gradient fill"),
    assertIncludes(appearance, "patternEnabled", "appearance helper supports pattern fill"),
    assertIncludes(appearance, "shadowEnabled", "appearance helper supports shadow/glow"),
    assertIncludes(appearance, "data-post-processing=\"sticker-border\"", "appearance helper emits sticker border metadata"),
    assertIncludes(appearance, "data-post-processing=\"internal-gap-fill\"", "appearance helper emits internal gap fill metadata"),
    assertIncludes(appearance, "makeUniqueSvgId", "appearance helper avoids duplicate generated SVG IDs"),
    assertIncludes(appearance, "LINE_WEIGHT_MAX = 30", "appearance helper allows practical manual line weight"),
    assertIncludes(appearance, "FILL_SPREAD_MAX = 30", "appearance helper allows wider guarded fill spread"),
  );
}

if (fillStrokeSvg) {
  checks.push(
    assertIncludes(fillStrokeSvg, "isCanvasBackgroundPath", "fill+stroke helper excludes canvas/background strokes"),
    assertIncludes(fillStrokeSvg, '"id",', "fill+stroke cloned outline paths remove original IDs"),
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
    assertIncludes(bespokeOutputPanel, "appearanceSvgCache", "bespoke output panel caches finalized post-processed SVGs"),
    assertIncludes(bespokeOutputPanel, "pruneAppearanceState", "bespoke output panel prunes removed output appearance state"),
    assertIncludes(bespokeOutputPanel, "data-output-panel-focused", "bespoke output panel exposes focused state"),
    assertIncludes(bespokeOutputPanel, "data-collapse-state", "bespoke output panel exposes collapse state"),
  );
}

for (const [routeFile, source] of routeSources) {
  for (const pattern of [
    "submitConvert(chosen, DEFAULTS",
    "submitConvertWith(chosen, DEFAULTS",
    "submitConvertForFile(chosen, DEFAULTS",
    "void submitConvert(chosen, DEFAULTS",
  ]) {
    checks.push(
      assertNotIncludes(
        source,
        pattern,
        `${routeFile} does not ignore a user-selected preset on first upload conversion`,
      ),
    );
  }
}

const failures = checks.filter(Boolean);

if (failures.length) {
  console.error("[output-card-ux-audit] failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[output-card-ux-audit] ok");
