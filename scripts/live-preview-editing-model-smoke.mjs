import {
  DEFAULT_OUTPUT_APPEARANCE,
  applyOutputAppearanceToSvg,
  detectOutputAppearanceSupport,
  normalizeOutputAppearance,
} from "../app/client/lib/converter/outputAppearance.ts";
import {
  analyzeSvgEditingModel,
  getSvgEditTargetById,
} from "../app/client/lib/converter/svgEditingModel.ts";
import { validateMeaningfulSvgOutput } from "../app/shared/tracing/meaningfulOutput.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(source, needle, message) {
  assert(String(source).includes(needle), `${message}: missing ${JSON.stringify(needle)}`);
}

function assertNotIncludes(source, needle, message) {
  assert(!String(source).includes(needle), `${message}: unexpected ${JSON.stringify(needle)}`);
}

function assertMeaningful(svg, message) {
  const validation = validateMeaningfulSvgOutput(svg);
  assert(validation.ok, `${message}: ${validation.reasons.join("; ")}`);
}

const filledCleanupSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect fill="#ffffff" width="120" height="90"/><path id="logo" fill="#f97316" d="M20 20H90V70H20Z"/></svg>';
const strokeOnlyCleanupSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><path fill="none" stroke="#111827" stroke-width="2" d="M20 20L90 70"/></svg>';
const classStyleCleanupSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><defs><style>.mark{fill:#0ea5e9}.ink{stroke:#111827}</style></defs><path class="mark" d="M20 20H90V70H20Z"/><path class="ink" fill="none" stroke-width="2" d="M15 15L100 75"/></svg>';
const layeredSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><g data-layer-id="layer-orange" data-layer-label="Orange layer" fill="#f97316"><path data-fill-layer-id="layer-orange" d="M20 20H90V70H20Z"/></g><g data-layer-id="layer-stroke" data-layer-label="Stroke layer" fill="none" stroke="#111827" stroke-width="2"><path data-stroke-layer-id="layer-stroke" d="M15 15L100 75"/></g></svg>';

{
  const model = analyzeSvgEditingModel(filledCleanupSvg, {
    sourceKind: "svg",
    supportsRetrace: true,
  });
  assert(model.capabilities.hasValidSvg, "filled cleanup SVG should be valid");
  assert(model.capabilities.hasEditableFillTargets, "filled cleanup SVG should expose fill targets");
  assert(!model.capabilities.hasEditableLayerTargets, "plain cleanup SVG should not invent layer targets");
  assert(
    model.layerUnavailableMessage?.includes("no generated layer metadata"),
    "cleanup SVG without layers should explain missing layer metadata",
  );
  assert(getSvgEditTargetById(model, "all-fills")?.count >= 1, "all-fills target should exist");

  const edited = applyOutputAppearanceToSvg(
    filledCleanupSvg,
    normalizeOutputAppearance({
      ...DEFAULT_OUTPUT_APPEARANCE,
      fillTargetId: "all-fills",
      gradientEnabled: true,
      gradientStartColor: "#ff0000",
      gradientEndColor: "#0000ff",
    }),
    detectOutputAppearanceSupport(filledCleanupSvg, {
      sourceKind: "svg",
      supportsRetrace: true,
    }),
    { idPrefix: "lp-filled" },
  );
  assertIncludes(edited, 'id="lp-filled-gradient-fill"', "gradient fill should create a def");
  assertIncludes(edited, 'fill="url(#lp-filled-gradient-fill)"', "gradient fill should apply to filled targets");
  assertMeaningful(edited, "filled cleanup gradient edit should stay renderable");
}

{
  const support = detectOutputAppearanceSupport(strokeOnlyCleanupSvg, {
    sourceKind: "svg",
    supportsRetrace: true,
  });
  assert(!support.supportsGradientFill, "stroke-only cleanup SVG should disable fill-only controls");
  assert(support.supportsLineWeight, "stroke-only cleanup SVG should support stroke width edits");
  assert(
    support.centerlineDisabledReason?.includes("raster retracing"),
    "SVG cleanup output should explain why centerline retrace is unavailable",
  );

  const edited = applyOutputAppearanceToSvg(
    strokeOnlyCleanupSvg,
    normalizeOutputAppearance({
      ...DEFAULT_OUTPUT_APPEARANCE,
      strokeTargetId: "all-strokes",
      lineWeight: 3,
      strokeColorEnabled: true,
      strokeColor: "#dc2626",
    }),
    support,
    { idPrefix: "lp-stroke" },
  );
  assertIncludes(edited, 'stroke="#dc2626"', "stroke color edit should apply to stroke targets");
  assertIncludes(edited, 'stroke-width="6"', "line weight should scale the existing stroke width");
  assertNotIncludes(edited, 'fill="url(', "stroke-only edit should not apply fill effects");
  assertMeaningful(edited, "stroke cleanup edit should stay renderable");
}

{
  const support = detectOutputAppearanceSupport(classStyleCleanupSvg, {
    sourceKind: "svg",
    supportsRetrace: true,
  });
  assert(support.supportsGradientFill, "simple class-style fills should be editable");
  assert(support.supportsStrokeColor, "simple class-style strokes should be editable");
  const colorTarget = getSvgEditTargetById(support.editingModel, "color:#0ea5e9");
  assert(colorTarget?.count === 1, "class-style fill color target should be detected");

  const edited = applyOutputAppearanceToSvg(
    classStyleCleanupSvg,
    normalizeOutputAppearance({
      ...DEFAULT_OUTPUT_APPEARANCE,
      fillTargetId: "color:#0ea5e9",
      patternEnabled: true,
      patternType: "checker",
    }),
    support,
    { idPrefix: "lp-class" },
  );
  assertIncludes(edited, 'id="lp-class-pattern-fill"', "pattern fill should create a def for class-style fills");
  assertIncludes(edited, 'fill="url(#lp-class-pattern-fill)"', "pattern fill should visibly override class-style fill targets");
  assertMeaningful(edited, "class-style pattern edit should stay renderable");
}

{
  const support = detectOutputAppearanceSupport(layeredSvg, {
    sourceKind: "raster",
    engineUsed: "vtracer",
    layers: [
      {
        id: "layer-orange",
        label: "Orange layer",
        color: "#f97316",
        originalColor: "#f97316",
        visible: true,
        kind: "fill",
        pathTags: '<path data-fill-layer-id="layer-orange" />',
      },
      {
        id: "layer-stroke",
        label: "Stroke layer",
        color: "#111827",
        originalColor: "#111827",
        visible: true,
        kind: "stroke",
        pathTags: '<path data-stroke-layer-id="layer-stroke" />',
      },
    ],
  });
  assert(support.editingModel.capabilities.hasEditableLayerTargets, "layered output should expose real layer targets");
  assert(getSvgEditTargetById(support.editingModel, "layer:layer-orange"), "fill layer target should exist");

  const edited = applyOutputAppearanceToSvg(
    layeredSvg,
    normalizeOutputAppearance({
      ...DEFAULT_OUTPUT_APPEARANCE,
      fillTargetId: "layer:layer-orange",
      fillColorEnabled: true,
      fillColor: "#22c55e",
      strokeTargetId: "layer:layer-stroke",
      strokeColorEnabled: true,
      strokeColor: "#7c3aed",
      lineWeight: 2,
    }),
    support,
    { idPrefix: "lp-layered" },
  );
  assertIncludes(edited, 'fill="#22c55e"', "layer fill color should update selected layer");
  assertIncludes(edited, 'stroke="#7c3aed"', "layer stroke color should update selected layer");
  assertIncludes(edited, 'stroke-width="4"', "layer stroke width should update selected stroke layer");
  assertMeaningful(edited, "layered target edits should stay renderable");
}

{
  const edited = applyOutputAppearanceToSvg(
    filledCleanupSvg,
    normalizeOutputAppearance({
      ...DEFAULT_OUTPUT_APPEARANCE,
      fillTargetId: "all-fills",
      fillColorEnabled: true,
      fillColor: "transparent",
    }),
    detectOutputAppearanceSupport(filledCleanupSvg, { sourceKind: "svg" }),
    { idPrefix: "lp-invalid" },
  );
  assert(
    edited === filledCleanupSvg,
    "invalid edits that remove visible output should be rejected back to the original SVG",
  );
}

console.log("live-preview-editing-model-smoke: ok");
