import { validateMeaningfulSvgOutput } from "../../../shared/tracing/meaningfulOutput.ts";
import {
  analyzeSvgEditingModel,
  createSvgPaintTargetMatcher,
  resolveSvgPaintTargetId,
  rewriteSvgEditablePaintTargets,
  type SvgEditableTarget,
  type SvgEditingLayerInput,
  type SvgEditingModel,
  type SvgPaintKind,
} from "./svgEditingModel.ts";

export type StickerBorderJoin = "round" | "bevel" | "miter";
export type StickerBorderPlacement = "top" | "behind";
export type GradientFillType = "linear" | "radial";
export type PatternFillType =
  | "dots"
  | "diagonal-stripes"
  | "horizontal-stripes"
  | "checker";
export type ShadowEffectType = "shadow" | "glow";

export type OutputAppearanceSettings = {
  fillTargetId: string;
  strokeTargetId: string;
  fillColorEnabled: boolean;
  fillColor: string;
  fillOpacity: number;
  strokeColorEnabled: boolean;
  strokeColor: string;
  strokeOpacity: number;
  lineWeight: number;
  fillSpread: number;
  nonScalingStroke: boolean;
  stickerBorderEnabled: boolean;
  stickerBorderWidth: number;
  stickerBorderColor: string;
  stickerBorderOpacity: number;
  stickerBorderJoin: StickerBorderJoin;
  stickerBorderPlacement: StickerBorderPlacement;
  internalGapFillEnabled: boolean;
  internalGapFillColor: string;
  internalGapFillOpacity: number;
  gradientEnabled: boolean;
  gradientType: GradientFillType;
  gradientStartColor: string;
  gradientEndColor: string;
  gradientAngle: number;
  patternEnabled: boolean;
  patternType: PatternFillType;
  patternColor: string;
  patternBackgroundColor: string;
  patternBackgroundTransparent: boolean;
  patternScale: number;
  shadowEnabled: boolean;
  shadowType: ShadowEffectType;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowOpacity: number;
};

export type OutputAppearanceSupport = {
  editingModel: SvgEditingModel;
  fillTargets: SvgEditableTarget[];
  strokeTargets: SvgEditableTarget[];
  stickerTargetIds: string[];
  supportsLineWeight: boolean;
  supportsFillColor: boolean;
  supportsStrokeColor: boolean;
  supportsFillSpread: boolean;
  supportsStickerBorder: boolean;
  supportsInternalGapFill: boolean;
  supportsGradientFill: boolean;
  supportsPatternFill: boolean;
  supportsShadowEffect: boolean;
  hasStroke: boolean;
  hasFill: boolean;
  fillSpreadDisabledReason?: string;
  stickerBorderDisabledReason?: string;
  internalGapFillDisabledReason?: string;
  fillStyleDisabledReason?: string;
  shadowEffectDisabledReason?: string;
  centerlineDisabledReason?: string;
  capabilitySummary?: string;
  layerUnavailableMessage?: string;
};

export type OutputAppearanceApplyOptions = {
  idPrefix?: string;
};

export type OutputAppearanceSupportOptions = {
  precisionOutput?: boolean;
  sourceKind?: "svg" | "raster";
  engineUsed?: string;
  layers?: ReadonlyArray<SvgEditingLayerInput> | null;
  supportsRetrace?: boolean;
};

export const DEFAULT_OUTPUT_APPEARANCE: OutputAppearanceSettings = {
  fillTargetId: "all-fills",
  strokeTargetId: "all-strokes",
  fillColorEnabled: false,
  fillColor: "#0b2dff",
  fillOpacity: 1,
  strokeColorEnabled: false,
  strokeColor: "#0b2dff",
  strokeOpacity: 1,
  lineWeight: 1,
  fillSpread: 0,
  nonScalingStroke: false,
  stickerBorderEnabled: false,
  stickerBorderWidth: 0,
  stickerBorderColor: "#ffffff",
  stickerBorderOpacity: 1,
  stickerBorderJoin: "round",
  stickerBorderPlacement: "top",
  internalGapFillEnabled: false,
  internalGapFillColor: "#ffffff",
  internalGapFillOpacity: 0.96,
  gradientEnabled: false,
  gradientType: "linear",
  gradientStartColor: "#38bdf8",
  gradientEndColor: "#0b2dff",
  gradientAngle: 35,
  patternEnabled: false,
  patternType: "dots",
  patternColor: "#0f172a",
  patternBackgroundColor: "#ffffff",
  patternBackgroundTransparent: true,
  patternScale: 12,
  shadowEnabled: false,
  shadowType: "shadow",
  shadowColor: "#0f172a",
  shadowBlur: 4,
  shadowOffsetX: 2,
  shadowOffsetY: 3,
  shadowOpacity: 0.35,
};

const FILL_SHAPE_TAG_PATTERN =
  /<(path|polygon|rect|circle|ellipse)\b([^>]*?)(\/?)>/gi;
const PATH_TAG_PATTERN = /<path\b([^>]*?)(\/?)>/gi;
const LINE_WEIGHT_MIN = 0.25;
const LINE_WEIGHT_MAX = 30;
const FILL_SPREAD_MIN = 0;
const FILL_SPREAD_MAX = 30;
const STICKER_BORDER_MIN = 0;
const STICKER_BORDER_MAX = 200;
const OUTPUT_OPACITY_MIN = 0;
const OUTPUT_OPACITY_MAX = 1;
const GRADIENT_ANGLE_MIN = 0;
const GRADIENT_ANGLE_MAX = 360;
const PATTERN_SCALE_MIN = 4;
const PATTERN_SCALE_MAX = 48;
const SHADOW_BLUR_MIN = 0;
const SHADOW_BLUR_MAX = 24;
const SHADOW_OFFSET_MIN = -40;
const SHADOW_OFFSET_MAX = 40;
const SHADOW_OPACITY_MIN = 0;
const SHADOW_OPACITY_MAX = 1;

export function normalizeOutputAppearance(
  settings?: Partial<OutputAppearanceSettings> | null,
): OutputAppearanceSettings {
  const fillColor = normalizeOutputPaintColor(
    settings?.fillColor,
    DEFAULT_OUTPUT_APPEARANCE.fillColor,
  );
  const strokeColor = normalizeOutputPaintColor(
    settings?.strokeColor,
    DEFAULT_OUTPUT_APPEARANCE.strokeColor,
  );
  const stickerBorderColor = normalizeHexColor(
    settings?.stickerBorderColor,
    DEFAULT_OUTPUT_APPEARANCE.stickerBorderColor,
  );

  return {
    fillTargetId: normalizeTargetId(
      settings?.fillTargetId,
      DEFAULT_OUTPUT_APPEARANCE.fillTargetId,
    ),
    strokeTargetId: normalizeTargetId(
      settings?.strokeTargetId,
      DEFAULT_OUTPUT_APPEARANCE.strokeTargetId,
    ),
    fillColorEnabled: Boolean(settings?.fillColorEnabled),
    fillColor,
    fillOpacity: clampNumber(
      settings?.fillOpacity ?? DEFAULT_OUTPUT_APPEARANCE.fillOpacity,
      OUTPUT_OPACITY_MIN,
      OUTPUT_OPACITY_MAX,
    ),
    strokeColorEnabled: Boolean(settings?.strokeColorEnabled),
    strokeColor,
    strokeOpacity: clampNumber(
      settings?.strokeOpacity ?? DEFAULT_OUTPUT_APPEARANCE.strokeOpacity,
      OUTPUT_OPACITY_MIN,
      OUTPUT_OPACITY_MAX,
    ),
    lineWeight: clampNumber(
      settings?.lineWeight ?? DEFAULT_OUTPUT_APPEARANCE.lineWeight,
      LINE_WEIGHT_MIN,
      LINE_WEIGHT_MAX,
    ),
    fillSpread: clampNumber(
      settings?.fillSpread ?? DEFAULT_OUTPUT_APPEARANCE.fillSpread,
      FILL_SPREAD_MIN,
      FILL_SPREAD_MAX,
    ),
    nonScalingStroke: Boolean(settings?.nonScalingStroke),
    stickerBorderEnabled: Boolean(settings?.stickerBorderEnabled),
    stickerBorderWidth: clampNumber(
      settings?.stickerBorderWidth ?? DEFAULT_OUTPUT_APPEARANCE.stickerBorderWidth,
      STICKER_BORDER_MIN,
      STICKER_BORDER_MAX,
    ),
    stickerBorderColor,
    stickerBorderOpacity: clampNumber(
      settings?.stickerBorderOpacity ?? DEFAULT_OUTPUT_APPEARANCE.stickerBorderOpacity,
      OUTPUT_OPACITY_MIN,
      OUTPUT_OPACITY_MAX,
    ),
    stickerBorderJoin: normalizeEnum(
      settings?.stickerBorderJoin,
      ["round", "bevel", "miter"],
      DEFAULT_OUTPUT_APPEARANCE.stickerBorderJoin,
    ),
    stickerBorderPlacement: normalizeEnum(
      settings?.stickerBorderPlacement,
      ["top", "behind"],
      DEFAULT_OUTPUT_APPEARANCE.stickerBorderPlacement,
    ),
    internalGapFillEnabled: Boolean(settings?.internalGapFillEnabled),
    internalGapFillColor: normalizeHexColor(
      settings?.internalGapFillColor,
      stickerBorderColor,
    ),
    internalGapFillOpacity: clampNumber(
      settings?.internalGapFillOpacity ?? DEFAULT_OUTPUT_APPEARANCE.internalGapFillOpacity,
      OUTPUT_OPACITY_MIN,
      OUTPUT_OPACITY_MAX,
    ),
    gradientEnabled: Boolean(settings?.gradientEnabled),
    gradientType: normalizeEnum(
      settings?.gradientType,
      ["linear", "radial"],
      DEFAULT_OUTPUT_APPEARANCE.gradientType,
    ),
    gradientStartColor: normalizeHexColor(
      settings?.gradientStartColor,
      DEFAULT_OUTPUT_APPEARANCE.gradientStartColor,
    ),
    gradientEndColor: normalizeHexColor(
      settings?.gradientEndColor,
      DEFAULT_OUTPUT_APPEARANCE.gradientEndColor,
    ),
    gradientAngle: clampNumber(
      settings?.gradientAngle ?? DEFAULT_OUTPUT_APPEARANCE.gradientAngle,
      GRADIENT_ANGLE_MIN,
      GRADIENT_ANGLE_MAX,
    ),
    patternEnabled: Boolean(settings?.patternEnabled),
    patternType: normalizeEnum(
      settings?.patternType,
      ["dots", "diagonal-stripes", "horizontal-stripes", "checker"],
      DEFAULT_OUTPUT_APPEARANCE.patternType,
    ),
    patternColor: normalizeHexColor(
      settings?.patternColor,
      DEFAULT_OUTPUT_APPEARANCE.patternColor,
    ),
    patternBackgroundColor: normalizeHexColor(
      settings?.patternBackgroundColor,
      DEFAULT_OUTPUT_APPEARANCE.patternBackgroundColor,
    ),
    patternBackgroundTransparent:
      settings?.patternBackgroundTransparent ??
      DEFAULT_OUTPUT_APPEARANCE.patternBackgroundTransparent,
    patternScale: clampNumber(
      settings?.patternScale ?? DEFAULT_OUTPUT_APPEARANCE.patternScale,
      PATTERN_SCALE_MIN,
      PATTERN_SCALE_MAX,
    ),
    shadowEnabled: Boolean(settings?.shadowEnabled),
    shadowType: normalizeEnum(
      settings?.shadowType,
      ["shadow", "glow"],
      DEFAULT_OUTPUT_APPEARANCE.shadowType,
    ),
    shadowColor: normalizeHexColor(
      settings?.shadowColor,
      DEFAULT_OUTPUT_APPEARANCE.shadowColor,
    ),
    shadowBlur: clampNumber(
      settings?.shadowBlur ?? DEFAULT_OUTPUT_APPEARANCE.shadowBlur,
      SHADOW_BLUR_MIN,
      SHADOW_BLUR_MAX,
    ),
    shadowOffsetX: clampNumber(
      settings?.shadowOffsetX ?? DEFAULT_OUTPUT_APPEARANCE.shadowOffsetX,
      SHADOW_OFFSET_MIN,
      SHADOW_OFFSET_MAX,
    ),
    shadowOffsetY: clampNumber(
      settings?.shadowOffsetY ?? DEFAULT_OUTPUT_APPEARANCE.shadowOffsetY,
      SHADOW_OFFSET_MIN,
      SHADOW_OFFSET_MAX,
    ),
    shadowOpacity: clampNumber(
      settings?.shadowOpacity ?? DEFAULT_OUTPUT_APPEARANCE.shadowOpacity,
      SHADOW_OPACITY_MIN,
      SHADOW_OPACITY_MAX,
    ),
  };
}

export function hasOutputAppearanceChanges(
  settings?: Partial<OutputAppearanceSettings> | null,
): boolean {
  const normalized = normalizeOutputAppearance(settings);
  return (
    normalized.fillColorEnabled ||
    Math.abs(normalized.fillOpacity - 1) > 0.001 ||
    normalized.strokeColorEnabled ||
    Math.abs(normalized.strokeOpacity - 1) > 0.001 ||
    Math.abs(normalized.lineWeight - 1) > 0.001 ||
    normalized.fillSpread > 0.001 ||
    normalized.nonScalingStroke ||
    (normalized.stickerBorderEnabled && normalized.stickerBorderWidth > 0.001) ||
    normalized.internalGapFillEnabled ||
    normalized.gradientEnabled ||
    normalized.patternEnabled ||
    normalized.shadowEnabled
  );
}

export function detectOutputAppearanceSupport(
  svg: string,
  options?: OutputAppearanceSupportOptions,
): OutputAppearanceSupport {
  const source = String(svg || "");
  const editingModel = analyzeSvgEditingModel(source, options);
  const hasStroke = editingModel.capabilities.hasEditableStrokeTargets;
  const hasFill = editingModel.capabilities.hasEditableFillTargets;
  const precisionOutput = Boolean(options?.precisionOutput);
  const fillUnavailableReason = hasFill
    ? undefined
    : "This effect needs filled SVG regions.";
  const stickerTargetIds = editingModel.fillTargets
    .filter((target) => hasForegroundFilledShape(source, target.id))
    .map((target) => target.id);
  const supportsStickerBorder = stickerTargetIds.length > 0;
  const supportsInternalGapFill = hasForegroundFilledPath(source);

  return {
    editingModel,
    fillTargets: editingModel.fillTargets,
    strokeTargets: editingModel.strokeTargets,
    stickerTargetIds,
    supportsLineWeight: hasStroke,
    supportsFillColor: hasFill,
    supportsStrokeColor: hasStroke,
    supportsFillSpread: hasFill && !precisionOutput,
    supportsStickerBorder,
    supportsInternalGapFill,
    supportsGradientFill: hasFill,
    supportsPatternFill: hasFill,
    supportsShadowEffect: (hasFill || hasStroke) && !precisionOutput,
    hasStroke,
    hasFill,
    fillSpreadDisabledReason: precisionOutput
      ? "Fill spread is disabled for precision cut outputs."
      : hasFill
        ? undefined
        : "Fill spread needs filled SVG regions.",
    stickerBorderDisabledReason: supportsStickerBorder
      ? undefined
      : hasFill
        ? "Sticker border needs foreground filled SVG shapes."
        : fillUnavailableReason,
    internalGapFillDisabledReason: supportsInternalGapFill
      ? undefined
      : hasFill
        ? "Gap fill needs foreground filled path regions."
        : fillUnavailableReason,
    fillStyleDisabledReason: fillUnavailableReason,
    shadowEffectDisabledReason: precisionOutput
      ? "Shadow and glow are visual effects, so they are disabled for precision cut outputs."
      : hasFill || hasStroke
        ? undefined
        : "Shadow and glow need visible SVG artwork.",
    centerlineDisabledReason: editingModel.capabilities.isSvgCleanupOutput
      ? "Centerline mode is for raster retracing. SVG cleanup outputs keep the uploaded vector artwork."
      : editingModel.capabilities.supportsRetrace
        ? undefined
        : "Centerline mode needs a raster source that can be retraced.",
    capabilitySummary: editingModel.summary.length
      ? `Detected: ${editingModel.summary.join(", ")}`
      : undefined,
    layerUnavailableMessage: editingModel.layerUnavailableMessage,
  };
}

export function applyOutputAppearanceToSvg(
  svg: string,
  settings?: Partial<OutputAppearanceSettings> | null,
  support?: OutputAppearanceSupport,
  options?: OutputAppearanceApplyOptions,
): string {
  const normalized = normalizeOutputAppearance(settings);
  const detected = support ?? detectOutputAppearanceSupport(svg);
  const original = String(svg || "");
  let out = original;
  const fillTargetId = resolveSvgPaintTargetId(
    detected.editingModel,
    normalized.fillTargetId,
    "fill",
  );
  const strokeTargetId = resolveSvgPaintTargetId(
    detected.editingModel,
    normalized.strokeTargetId,
    "stroke",
  );

  if (detected.supportsFillColor && normalized.fillColorEnabled) {
    out = applyPaintColor(out, "fill", fillTargetId, normalized.fillColor);
  }

  if (detected.supportsStrokeColor && normalized.strokeColorEnabled) {
    out = applyPaintColor(out, "stroke", strokeTargetId, normalized.strokeColor);
  }

  if (detected.supportsFillColor && normalized.fillOpacity < 0.999) {
    out = applyPaintOpacity(out, "fill", fillTargetId, normalized.fillOpacity);
  }

  if (detected.supportsStrokeColor && normalized.strokeOpacity < 0.999) {
    out = applyPaintOpacity(out, "stroke", strokeTargetId, normalized.strokeOpacity);
  }

  if (
    detected.supportsLineWeight &&
    (Math.abs(normalized.lineWeight - 1) > 0.001 ||
      normalized.nonScalingStroke)
  ) {
    out = applyLineWeight(out, normalized, strokeTargetId);
  }

  if (detected.supportsFillSpread && normalized.fillSpread > 0.001) {
    out = applyFillSpread(out, normalized.fillSpread, fillTargetId);
  }

  const idPrefix = buildSvgIdPrefix(options?.idPrefix, out);
  const stickerSource = out;

  if (detected.supportsGradientFill && normalized.gradientEnabled) {
    out = applyGradientFill(out, normalized, idPrefix, fillTargetId);
  }

  if (detected.supportsPatternFill && normalized.patternEnabled) {
    out = applyPatternFill(out, normalized, idPrefix, fillTargetId);
  }

  if (
    detected.supportsStickerBorder &&
    detected.stickerTargetIds.includes(fillTargetId) &&
    normalized.stickerBorderEnabled &&
    normalized.stickerBorderWidth > 0.001
  ) {
    out = applyStickerBorder(out, stickerSource, normalized, idPrefix, fillTargetId);
  }

  if (
    detected.supportsInternalGapFill &&
    normalized.internalGapFillEnabled
  ) {
    out = applyInternalGapFill(out, stickerSource, normalized, idPrefix);
  }

  if (detected.supportsShadowEffect && normalized.shadowEnabled) {
    out = applyShadowEffect(out, normalized, idPrefix);
  }

  return rejectInvisibleSvgEdit(original, out);
}

function rejectInvisibleSvgEdit(original: string, edited: string): string {
  if (edited === original) return original;
  const validation = validateMeaningfulSvgOutput(edited);
  return validation.ok ? edited : original;
}

function applyLineWeight(
  svg: string,
  settings: OutputAppearanceSettings,
  targetId: string,
): string {
  return rewriteSvgEditablePaintTargets(svg, { targetId, paint: "stroke" }, (context) => {
    const baseWidth = readNumericPaintWidth(context.attrs) ?? 1;
    const width = Math.max(0.01, baseWidth * settings.lineWeight);
    let nextAttrs = removeAttribute(context.attrs, "stroke-width");
    nextAttrs = rewriteStyleProperty(nextAttrs, "stroke-width", null);
    nextAttrs = `${nextAttrs} stroke-width="${formatNumber(width)}"`;

    if (settings.nonScalingStroke) {
      nextAttrs = removeAttribute(nextAttrs, "vector-effect");
      nextAttrs = `${nextAttrs} vector-effect="non-scaling-stroke"`;
    }

    return nextAttrs;
  });
}

function applyPaintColor(
  svg: string,
  paint: SvgPaintKind,
  targetId: string,
  color: string,
): string {
  return rewriteSvgEditablePaintTargets(svg, { targetId, paint }, (context) =>
    writePaint(context.attrs, paint, color),
  );
}

function applyPaintOpacity(
  svg: string,
  paint: SvgPaintKind,
  targetId: string,
  opacity: number,
): string {
  const value = formatNumber(opacity);
  const property = paint === "fill" ? "fill-opacity" : "stroke-opacity";
  return rewriteSvgEditablePaintTargets(svg, { targetId, paint }, (context) => {
    let nextAttrs = removeAttribute(context.attrs, property);
    nextAttrs = rewriteStyleProperty(nextAttrs, property, null);
    return `${nextAttrs} ${property}="${value}"`;
  });
}

function applyFillSpread(svg: string, spreadPx: number, targetId: string): string {
  const spread = formatNumber(spreadPx);
  return rewriteSvgEditablePaintTargets(svg, { targetId, paint: "fill" }, (context) => {
    const fill = context.paintValue;
    const stroke =
      readPaint(context.attrs, "stroke") ?? readStyleProperty(context.attrs, "stroke");
    if (stroke && isPaintEnabled(stroke) && !samePaint(stroke, fill)) {
      return context.attrs;
    }

    let nextAttrs = removeAttribute(context.attrs, "stroke");
    nextAttrs = removeAttribute(nextAttrs, "stroke-width");
    nextAttrs = removeAttribute(nextAttrs, "stroke-linejoin");
    nextAttrs = removeAttribute(nextAttrs, "stroke-linecap");
    nextAttrs = removeAttribute(nextAttrs, "paint-order");
    nextAttrs = removeAttribute(nextAttrs, "data-fill-spread");
    nextAttrs = rewriteStyleProperty(nextAttrs, "stroke", null);
    nextAttrs = rewriteStyleProperty(nextAttrs, "stroke-width", null);
    nextAttrs = rewriteStyleProperty(nextAttrs, "stroke-linejoin", null);
    nextAttrs = rewriteStyleProperty(nextAttrs, "stroke-linecap", null);
    nextAttrs = rewriteStyleProperty(nextAttrs, "paint-order", null);

    nextAttrs = `${nextAttrs} stroke="${escapeSvgAttribute(fill)}" stroke-width="${spread}" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill markers" data-fill-spread="${spread}"`;
    return nextAttrs;
  });
}

function applyStickerBorder(
  targetSvg: string,
  sourceSvg: string,
  settings: OutputAppearanceSettings,
  idPrefix: string,
  targetId: string,
): string {
  const paths = buildForegroundShapeClones(sourceSvg, targetId);
  if (!paths.length) return targetSvg;
  const groupId = makeUniqueSvgId(targetSvg, `${idPrefix}-sticker-border`);
  const opacity =
    settings.stickerBorderOpacity < 0.999
      ? ` stroke-opacity="${formatNumber(settings.stickerBorderOpacity)}"`
      : "";
  const group = `<g id="${groupId}" data-post-processing="sticker-border" fill="none" stroke="${escapeSvgAttribute(settings.stickerBorderColor)}" stroke-width="${formatNumber(settings.stickerBorderWidth)}"${opacity} stroke-linejoin="${settings.stickerBorderJoin}" stroke-linecap="round" paint-order="stroke fill markers">${paths.join("")}</g>`;
  return settings.stickerBorderPlacement === "behind"
    ? insertAfterOpeningSvgAndDefs(targetSvg, group)
    : insertBeforeClosingSvg(targetSvg, group);
}

function applyInternalGapFill(
  targetSvg: string,
  sourceSvg: string,
  settings: OutputAppearanceSettings,
  idPrefix: string,
): string {
  const width = Math.max(1, Math.min(30, settings.stickerBorderWidth || 2));
  const paths = buildInternalGapFillClones(sourceSvg, settings, width);
  if (!paths.length) return targetSvg;
  const color = settings.internalGapFillColor || settings.stickerBorderColor;
  const groupId = makeUniqueSvgId(targetSvg, `${idPrefix}-internal-gap-fill`);
  const group = `<g id="${groupId}" data-post-processing="internal-gap-fill" fill="${escapeSvgAttribute(color)}" stroke="${escapeSvgAttribute(color)}" stroke-width="${formatNumber(Math.max(0.5, width * 0.08))}" stroke-linejoin="round" stroke-linecap="round" opacity="${formatNumber(settings.internalGapFillOpacity)}" paint-order="stroke fill markers">${paths.join("")}</g>`;
  return insertAfterOpeningSvgAndDefs(targetSvg, group);
}

function buildInternalGapFillClones(
  svg: string,
  settings: OutputAppearanceSettings,
  strokeWidth: number,
): string[] {
  const viewport = readSvgViewport(svg);
  const color = settings.internalGapFillColor || settings.stickerBorderColor;
  const clones: string[] = [];

  for (const match of String(svg).matchAll(PATH_TAG_PATTERN)) {
    const attrs = match[1] || "";
    if (attrs.includes("data-post-processing=")) continue;
    const d = readAttribute(attrs, "d");
    if (!d || isCanvasBackgroundPath(d, viewport)) continue;
    if (isTinyForegroundArtifact({ d }, viewport)) continue;
    const fill = readPaint(attrs, "fill") ?? readStyleProperty(attrs, "fill");
    if (!fill || !isPaintEnabled(fill)) continue;

    const sharedAttrs = [
      ["transform", readAttribute(attrs, "transform")],
      ["clip-path", readAttribute(attrs, "clip-path")],
    ]
      .filter(([, value]) => value)
      .map(([attribute, value]) => ` ${attribute}="${escapeSvgAttribute(value || "")}"`)
      .join("");

    clones.push(
      `<path${sharedAttrs} d="${escapeSvgAttribute(d)}" fill="${escapeSvgAttribute(color)}" stroke="none" fill-rule="nonzero" clip-rule="nonzero" data-gap-fill-shape="solid-backfill"/>`,
    );

    const pathClones: string[] = [];
    for (const subpath of splitClosedPathSubpaths(d)) {
      if (isCanvasBackgroundPath(subpath, viewport)) continue;
      pathClones.push(
        `<path${sharedAttrs} d="${escapeSvgAttribute(subpath)}" fill="${escapeSvgAttribute(color)}" stroke="${escapeSvgAttribute(color)}" stroke-width="${formatNumber(Math.max(0.5, strokeWidth * 0.08))}" fill-rule="nonzero" data-gap-fill-shape="true"/>`,
      );
    }

    if (!pathClones.length) {
      pathClones.push(
        `<path${sharedAttrs} d="${escapeSvgAttribute(d)}" fill="${escapeSvgAttribute(color)}" stroke="${escapeSvgAttribute(color)}" stroke-width="${formatNumber(Math.max(1, strokeWidth))}" fill-rule="nonzero" data-gap-fill-shape="fallback"/>`,
      );
    }
    clones.push(...pathClones);
  }

  return clones;
}

function splitClosedPathSubpaths(pathData: string): string[] {
  const chunks = String(pathData || "").match(/[Mm][^Mm]*/g) || [];
  return chunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => /[zZ]\s*$/.test(chunk));
}

function buildForegroundShapeClones(svg: string, targetId = "all-fills"): string[] {
  const viewport = readSvgViewport(svg);
  const clones: string[] = [];
  const matchesTarget = createSvgPaintTargetMatcher(svg, {
    targetId,
    paint: "fill",
  });
  for (const match of String(svg).matchAll(FILL_SHAPE_TAG_PATTERN)) {
    const tagName = String(match[1] || "").toLowerCase();
    const rawAttrs = String(match[2] || "");
    if (rawAttrs.includes("data-post-processing=")) continue;
    if (!matchesTarget(tagName, rawAttrs)) continue;
    if (isCanvasBackgroundElement(tagName, rawAttrs, viewport)) continue;
    if (isTinyForegroundArtifact(readElementGeometry(tagName, rawAttrs), viewport)) continue;
    const preserved = buildShapeCloneAttributes(tagName, rawAttrs);
    if (!preserved) continue;
    clones.push(`<${tagName}${preserved}/>`);
  }
  return clones;
}

function hasForegroundFilledShape(svg: string, targetId = "all-fills"): boolean {
  return buildForegroundShapeClones(svg, targetId).length > 0;
}

function hasForegroundFilledPath(svg: string): boolean {
  const viewport = readSvgViewport(svg);
  for (const match of String(svg).matchAll(PATH_TAG_PATTERN)) {
    const attrs = match[1] || "";
    if (attrs.includes("data-post-processing=")) continue;
    const d = readAttribute(attrs, "d");
    if (!d || isCanvasBackgroundPath(d, viewport)) continue;
    if (isTinyForegroundArtifact({ d }, viewport)) continue;
    const fill = readPaint(attrs, "fill") ?? readStyleProperty(attrs, "fill");
    if (!fill || !isPaintEnabled(fill)) continue;
    return true;
  }
  return false;
}

function buildShapeCloneAttributes(tagName: string, attrs: string): string {
  const geometryByTag: Record<string, string[]> = {
    path: ["d"],
    rect: ["x", "y", "width", "height", "rx", "ry"],
    circle: ["cx", "cy", "r"],
    ellipse: ["cx", "cy", "rx", "ry"],
    polygon: ["points"],
  };
  const attributes = [
    ...(geometryByTag[tagName] || []),
    "transform",
    "clip-path",
    "fill-rule",
    "clip-rule",
    "opacity",
  ];
  const preserved = attributes
    .map((attribute) => [attribute, readAttribute(attrs, attribute)] as const)
    .filter(([, value]) => value)
    .map(([attribute, value]) => ` ${attribute}="${escapeSvgAttribute(value || "")}"`)
    .join("");
  const requiredByTag: Record<string, string[]> = {
    path: ["d"],
    rect: ["width", "height"],
    circle: ["r"],
    ellipse: ["rx", "ry"],
    polygon: ["points"],
  };
  const missingRequired = (requiredByTag[tagName] || []).some(
    (attribute) => !readAttribute(attrs, attribute),
  );
  if (missingRequired) return "";
  return preserved;
}

function isCanvasBackgroundElement(
  tagName: string,
  attrs: string,
  viewport: { x: number; y: number; width: number; height: number } | null,
): boolean {
  if (!viewport) return false;
  if (tagName === "path") {
    const d = readAttribute(attrs, "d");
    return Boolean(d && isCanvasBackgroundPath(d, viewport));
  }
  if (tagName === "rect") {
    const x = parseSvgNumber(readAttribute(attrs, "x") || "") ?? 0;
    const y = parseSvgNumber(readAttribute(attrs, "y") || "") ?? 0;
    const width = parseSvgNumber(readAttribute(attrs, "width") || "");
    const height = parseSvgNumber(readAttribute(attrs, "height") || "");
    if (!width || !height) return false;
    return rectangleMatchesViewport(x, y, x + width, y + height, viewport);
  }
  if (tagName === "polygon") {
    const points = readAttribute(attrs, "points") || "";
    const numbers = [...points.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map(
      (match) => Number(match[0]),
    );
    if (numbers.length < 8 || numbers.length % 2 !== 0) return false;
    const bounds = measureNumberPairBounds(numbers);
    return Boolean(
      bounds &&
        rectangleMatchesViewport(
          bounds.minX,
          bounds.minY,
          bounds.maxX,
          bounds.maxY,
          viewport,
        ),
    );
  }
  return false;
}

type SvgBounds = { minX: number; minY: number; maxX: number; maxY: number };
type ForegroundGeometry = { d?: string; bounds?: SvgBounds | null };

function readElementGeometry(tagName: string, attrs: string): ForegroundGeometry {
  if (tagName === "path") {
    return { d: readAttribute(attrs, "d") || "" };
  }

  if (tagName === "rect") {
    const x = parseSvgNumber(readAttribute(attrs, "x") || "") ?? 0;
    const y = parseSvgNumber(readAttribute(attrs, "y") || "") ?? 0;
    const width = parseSvgNumber(readAttribute(attrs, "width") || "") ?? 0;
    const height = parseSvgNumber(readAttribute(attrs, "height") || "") ?? 0;
    return width > 0 && height > 0
      ? { bounds: { minX: x, minY: y, maxX: x + width, maxY: y + height } }
      : {};
  }

  if (tagName === "circle") {
    const cx = parseSvgNumber(readAttribute(attrs, "cx") || "") ?? 0;
    const cy = parseSvgNumber(readAttribute(attrs, "cy") || "") ?? 0;
    const r = parseSvgNumber(readAttribute(attrs, "r") || "") ?? 0;
    return r > 0
      ? { bounds: { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r } }
      : {};
  }

  if (tagName === "ellipse") {
    const cx = parseSvgNumber(readAttribute(attrs, "cx") || "") ?? 0;
    const cy = parseSvgNumber(readAttribute(attrs, "cy") || "") ?? 0;
    const rx = parseSvgNumber(readAttribute(attrs, "rx") || "") ?? 0;
    const ry = parseSvgNumber(readAttribute(attrs, "ry") || "") ?? 0;
    return rx > 0 && ry > 0
      ? { bounds: { minX: cx - rx, minY: cy - ry, maxX: cx + rx, maxY: cy + ry } }
      : {};
  }

  if (tagName === "polygon") {
    return { bounds: measurePointListBounds(readAttribute(attrs, "points") || "") };
  }

  return {};
}

function isTinyForegroundArtifact(
  geometry: ForegroundGeometry,
  viewport: { x: number; y: number; width: number; height: number } | null,
): boolean {
  if (!viewport) return false;
  const bounds = geometry.bounds ?? (geometry.d ? measurePathBounds(geometry.d) : null);
  if (!bounds) return false;

  const width = Math.max(0, bounds.maxX - bounds.minX);
  const height = Math.max(0, bounds.maxY - bounds.minY);
  const maxDimension = Math.max(width, height);
  const area = width * height;
  const canvasMax = Math.max(viewport.width, viewport.height);
  const canvasArea = Math.max(1, viewport.width * viewport.height);
  const minimumMeaningfulDimension = Math.max(2.5, canvasMax * 0.0035);
  const minimumMeaningfulArea = Math.max(4, canvasArea * 0.000006);

  return maxDimension < minimumMeaningfulDimension && area < minimumMeaningfulArea;
}

function applyGradientFill(
  svg: string,
  settings: OutputAppearanceSettings,
  idPrefix: string,
  targetId: string,
): string {
  const gradientId = makeUniqueSvgId(svg, `${idPrefix}-gradient-fill`);
  const defs =
    settings.gradientType === "radial"
      ? `<radialGradient id="${gradientId}" cx="50%" cy="50%" r="65%"><stop offset="0%" stop-color="${escapeSvgAttribute(settings.gradientStartColor)}"/><stop offset="100%" stop-color="${escapeSvgAttribute(settings.gradientEndColor)}"/></radialGradient>`
      : buildLinearGradientDef(gradientId, settings);
  return applyFillDefinition(svg, defs, `url(#${gradientId})`, targetId);
}

function buildLinearGradientDef(
  gradientId: string,
  settings: OutputAppearanceSettings,
): string {
  const radians = (settings.gradientAngle * Math.PI) / 180;
  const dx = Math.cos(radians) / 2;
  const dy = Math.sin(radians) / 2;
  const x1 = formatPercent(0.5 - dx);
  const y1 = formatPercent(0.5 - dy);
  const x2 = formatPercent(0.5 + dx);
  const y2 = formatPercent(0.5 + dy);
  return `<linearGradient id="${gradientId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0%" stop-color="${escapeSvgAttribute(settings.gradientStartColor)}"/><stop offset="100%" stop-color="${escapeSvgAttribute(settings.gradientEndColor)}"/></linearGradient>`;
}

function applyPatternFill(
  svg: string,
  settings: OutputAppearanceSettings,
  idPrefix: string,
  targetId: string,
): string {
  const patternId = makeUniqueSvgId(svg, `${idPrefix}-pattern-fill`);
  const scale = formatNumber(settings.patternScale);
  const background = settings.patternBackgroundTransparent
    ? ""
    : `<rect width="100%" height="100%" fill="${escapeSvgAttribute(settings.patternBackgroundColor)}"/>`;
  const patternContent = buildPatternContent(settings);
  const defs = `<pattern id="${patternId}" patternUnits="userSpaceOnUse" width="${scale}" height="${scale}">${background}${patternContent}</pattern>`;
  return applyFillDefinition(svg, defs, `url(#${patternId})`, targetId);
}

function buildPatternContent(settings: OutputAppearanceSettings): string {
  const scale = settings.patternScale;
  const color = escapeSvgAttribute(settings.patternColor);
  if (settings.patternType === "diagonal-stripes") {
    return `<path d="M0 ${formatNumber(scale)}L${formatNumber(scale)} 0" stroke="${color}" stroke-width="${formatNumber(Math.max(1, scale * 0.16))}" stroke-linecap="square"/>`;
  }
  if (settings.patternType === "horizontal-stripes") {
    return `<path d="M0 ${formatNumber(scale / 2)}H${formatNumber(scale)}" stroke="${color}" stroke-width="${formatNumber(Math.max(1, scale * 0.16))}" stroke-linecap="square"/>`;
  }
  if (settings.patternType === "checker") {
    const half = formatNumber(scale / 2);
    return `<rect width="${half}" height="${half}" fill="${color}"/><rect x="${half}" y="${half}" width="${half}" height="${half}" fill="${color}"/>`;
  }
  return `<circle cx="${formatNumber(scale / 2)}" cy="${formatNumber(scale / 2)}" r="${formatNumber(Math.max(0.8, scale * 0.16))}" fill="${color}"/>`;
}

function applyFillDefinition(
  svg: string,
  definition: string,
  paint: string,
  targetId: string,
): string {
  const withDefs = injectDefs(svg, definition);
  const { source, defs } = protectDefs(withDefs);
  const rewritten = rewriteSvgEditablePaintTargets(
    source,
    { targetId, paint: "fill" },
    (context) => {
      if (context.attrs.includes("data-post-processing=")) return context.attrs;
      if (/^url\(/i.test(context.paintValue.trim())) return context.attrs;
      return writePaint(context.attrs, "fill", paint);
    },
  );
  return restoreDefs(rewritten, defs);
}

function applyShadowEffect(
  svg: string,
  settings: OutputAppearanceSettings,
  idPrefix: string,
): string {
  const filterId = makeUniqueSvgId(svg, `${idPrefix}-shadow-effect`);
  const blur = formatNumber(settings.shadowBlur);
  const offsetX = formatNumber(settings.shadowType === "glow" ? 0 : settings.shadowOffsetX);
  const offsetY = formatNumber(settings.shadowType === "glow" ? 0 : settings.shadowOffsetY);
  const definition = `<filter id="${filterId}" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB"><feDropShadow dx="${offsetX}" dy="${offsetY}" stdDeviation="${blur}" flood-color="${escapeSvgAttribute(settings.shadowColor)}" flood-opacity="${formatNumber(settings.shadowOpacity)}"/></filter>`;
  return wrapSvgContentWithFilter(injectDefs(svg, definition), filterId);
}

function wrapSvgContentWithFilter(svg: string, filterId: string): string {
  const source = String(svg || "");
  const svgOpenEnd = source.indexOf(">");
  const svgCloseStart = source.lastIndexOf("</svg>");
  if (svgOpenEnd < 0 || svgCloseStart < 0 || svgCloseStart <= svgOpenEnd) {
    return svg;
  }
  const insertAfter = findInsertPositionAfterSvgDefs(source, svgOpenEnd + 1);
  return `${source.slice(0, insertAfter)}<g data-post-processing="shadow-effect" filter="url(#${filterId})">${source.slice(insertAfter, svgCloseStart)}</g>${source.slice(svgCloseStart)}`;
}

function injectDefs(svg: string, definition: string): string {
  const source = String(svg || "");
  const defsMatch = source.match(/<defs\b[^>]*>/i);
  if (defsMatch?.index != null) {
    const insertAt = defsMatch.index + defsMatch[0].length;
    return `${source.slice(0, insertAt)}${definition}${source.slice(insertAt)}`;
  }
  return insertAfterOpeningSvgAndDefs(source, `<defs>${definition}</defs>`);
}

function makeUniqueSvgId(svg: string, desiredId: string): string {
  const safeDesired = sanitizeSvgId(desiredId);
  const existing = new Set(
    [...String(svg || "").matchAll(/\sid\s*=\s*(["'])([^"']+)\1/gi)].map(
      (match) => match[2],
    ),
  );
  if (!existing.has(safeDesired)) return safeDesired;

  let suffix = 2;
  let candidate = `${safeDesired}-${suffix}`;
  while (existing.has(candidate)) {
    suffix += 1;
    candidate = `${safeDesired}-${suffix}`;
  }
  return candidate;
}

function sanitizeSvgId(value: string): string {
  const sanitized = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+/, "");
  return /^[a-zA-Z_]/.test(sanitized) ? sanitized : `pp-${sanitized || "output"}`;
}

function insertAfterOpeningSvgAndDefs(svg: string, content: string): string {
  const source = String(svg || "");
  const svgOpenEnd = source.indexOf(">");
  if (svgOpenEnd < 0) return svg;
  const insertAt = findInsertPositionAfterSvgDefs(source, svgOpenEnd + 1);
  return `${source.slice(0, insertAt)}${content}${source.slice(insertAt)}`;
}

function insertBeforeClosingSvg(svg: string, content: string): string {
  const source = String(svg || "");
  const svgCloseStart = source.lastIndexOf("</svg>");
  if (svgCloseStart < 0) return svg;
  return `${source.slice(0, svgCloseStart)}${content}${source.slice(svgCloseStart)}`;
}

function findInsertPositionAfterSvgDefs(source: string, afterSvgOpen: number): number {
  const rest = source.slice(afterSvgOpen);
  const defsMatch = rest.match(/^\s*<defs\b[\s\S]*?<\/defs>/i);
  return defsMatch ? afterSvgOpen + defsMatch[0].length : afterSvgOpen;
}

function protectDefs(svg: string): { source: string; defs: string[] } {
  const defs: string[] = [];
  const source = String(svg || "").replace(/<defs\b[\s\S]*?<\/defs>/gi, (match) => {
    const index = defs.push(match) - 1;
    return `__SVG_DEFS_PLACEHOLDER_${index}__`;
  });
  return { source, defs };
}

function restoreDefs(svg: string, defs: string[]): string {
  return defs.reduce(
    (source, block, index) =>
      source.replace(`__SVG_DEFS_PLACEHOLDER_${index}__`, block),
    svg,
  );
}

function writePaint(attrs: string, property: SvgPaintKind, paint: string): string {
  const directPaint = readPaint(attrs, property);
  if (directPaint && isPaintEnabled(directPaint)) {
    return writeAttribute(attrs, property, paint);
  }
  const styledPaint = readStyleProperty(attrs, property);
  if (styledPaint && isPaintEnabled(styledPaint)) {
    return rewriteStyleProperty(attrs, property, paint);
  }
  return writeAttribute(attrs, property, paint);
}

function readPaint(attrs: string, property: "fill" | "stroke"): string | null {
  const match = attrs.match(
    new RegExp(`\\s${property}\\s*=\\s*["']([^"']+)["']`, "i"),
  );
  return match?.[1]?.trim() || null;
}

function readAttribute(attrs: string, attribute: string): string | null {
  const match = attrs.match(
    new RegExp(`\\s${escapeRegExp(attribute)}\\s*=\\s*["']([^"']+)["']`, "i"),
  );
  return match?.[1]?.trim() || null;
}

function readNumericPaintWidth(attrs: string): number | null {
  const direct = attrs.match(/\sstroke-width\s*=\s*["']([^"']+)["']/i)?.[1];
  const styled = readStyleProperty(attrs, "stroke-width");
  const parsed = parseSvgNumber(direct ?? styled ?? "");
  return parsed == null || parsed <= 0 ? null : parsed;
}

function readStyleProperty(attrs: string, property: string): string | null {
  const style = attrs.match(/\bstyle\s*=\s*(["'])([^"']*)\1/i)?.[2];
  if (!style) return null;
  const propertyPattern = new RegExp(
    `(?:^|;)\\s*${escapeRegExp(property)}\\s*:\\s*([^;]+)`,
    "i",
  );
  return style.match(propertyPattern)?.[1]?.trim() || null;
}

function rewriteStyleProperty(
  attrs: string,
  property: string,
  value: string | null,
): string {
  const styleMatch = attrs.match(/\bstyle\s*=\s*(["'])([^"']*)\1/i);
  if (!styleMatch) {
    if (value == null) return attrs;
    return `${attrs} style="${property}:${escapeSvgAttribute(value)}"`;
  }

  const quote = styleMatch[1];
  const styleBody = styleMatch[2];
  const parts = styleBody
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !new RegExp(`^${escapeRegExp(property)}\\s*:`, "i").test(part));

  if (value != null) parts.push(`${property}:${value}`);

  if (parts.length === 0) {
    return attrs.replace(/\sstyle\s*=\s*(["'])[^"']*\1/i, "");
  }

  return attrs.replace(
    /\bstyle\s*=\s*(["'])[^"']*\1/i,
    `style=${quote}${parts.join("; ")}${quote}`,
  );
}

function writeAttribute(attrs: string, attribute: string, value: string): string {
  return `${removeAttribute(attrs, attribute)} ${attribute}="${escapeSvgAttribute(value)}"`;
}

function removeAttribute(attrs: string, attribute: string): string {
  return attrs.replace(
    new RegExp(`\\s${escapeRegExp(attribute)}\\s*=\\s*["'][^"']*["']`, "gi"),
    "",
  );
}

function isPaintEnabled(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return Boolean(
    normalized &&
      normalized !== "none" &&
      normalized !== "transparent" &&
      normalized !== "currentcolor" &&
      normalized !== "rgba(0,0,0,0)" &&
      normalized !== "rgba(0, 0, 0, 0)",
  );
}

function samePaint(a: string, b: string): boolean {
  return normalizePaint(a) === normalizePaint(b);
}

function normalizePaint(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [, r, g, b] = trimmed.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i) || [];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return trimmed.replace(/\s+/g, "");
}

function normalizeHexColor(value: string | undefined, fallback: string): string {
  const input = String(value || "").trim();
  if (/^#[0-9a-f]{3}$/i.test(input)) {
    const [, r, g, b] = input.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i) || [];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(input)) return input.toLowerCase();
  return fallback;
}

function normalizeOutputPaintColor(
  value: string | undefined,
  fallback: string,
): string {
  const input = String(value || "").trim();
  if (input.toLowerCase() === "transparent") return "transparent";
  return normalizeHexColor(input, fallback);
}

function normalizeTargetId(value: string | undefined, fallback: string): string {
  const input = String(value || "").trim();
  if (/^(?:all-fills|all-strokes)$/.test(input)) return input;
  if (/^color:#[0-9a-f]{6}$/i.test(input)) return input.toLowerCase();
  if (/^layer:[A-Za-z0-9_.:-]+$/.test(input)) return input;
  return fallback;
}

function normalizeEnum<T extends string>(
  value: T | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return value && allowed.includes(value) ? value : fallback;
}

function readSvgViewport(svg: string): { x: number; y: number; width: number; height: number } | null {
  const viewBox = String(svg || "").match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  if (viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((value) => Number.isFinite(value));
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
  }
  const width = parseSvgNumber(
    String(svg || "").match(/\bwidth\s*=\s*["']([^"']+)["']/i)?.[1] || "",
  );
  const height = parseSvgNumber(
    String(svg || "").match(/\bheight\s*=\s*["']([^"']+)["']/i)?.[1] || "",
  );
  return width && height ? { x: 0, y: 0, width, height } : null;
}

function isCanvasBackgroundPath(
  pathData: string,
  viewport: { x: number; y: number; width: number; height: number } | null,
): boolean {
  if (!viewport) return false;
  const normalized = pathData.trim().replace(/,/g, " ").replace(/\s+/g, " ");
  const hv = normalized.match(
    /^M\s*(-?\d*\.?\d+)\s+(-?\d*\.?\d+)\s*H\s*(-?\d*\.?\d+)\s*V\s*(-?\d*\.?\d+)\s*H\s*(-?\d*\.?\d+)\s*Z?$/i,
  );
  if (hv) {
    const x1 = Number(hv[1]);
    const y1 = Number(hv[2]);
    const x2 = Number(hv[3]);
    const y2 = Number(hv[4]);
    const x3 = Number(hv[5]);
    return rectangleMatchesViewport(
      Math.min(x1, x2, x3),
      Math.min(y1, y2),
      Math.max(x1, x2, x3),
      Math.max(y1, y2),
      viewport,
    );
  }
  const numbers = [...normalized.matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)].map(
    (match) => Number(match[0]),
  );
  if (numbers.length < 8 || numbers.length % 2 !== 0) return false;
  const bounds = measureNumberPairBounds(numbers);
  return Boolean(
    bounds &&
      rectangleMatchesViewport(
        bounds.minX,
        bounds.minY,
        bounds.maxX,
        bounds.maxY,
        viewport,
      ),
  );
}

function measurePathBounds(pathData: string): SvgBounds | null {
  const values = [...String(pathData || "").matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)]
    .map((match) => Number(match[0]))
    .filter(Number.isFinite);
  if (values.length < 4) return null;
  return measureNumberPairBounds(values);
}

function measurePointListBounds(points: string): SvgBounds | null {
  const values = [...String(points || "").matchAll(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)]
    .map((match) => Number(match[0]))
    .filter(Number.isFinite);
  if (values.length < 4 || values.length % 2 !== 0) return null;
  return measureNumberPairBounds(values);
}

function measureNumberPairBounds(values: number[]): SvgBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < values.length - 1; index += 2) {
    const x = values[index];
    const y = values[index + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY)
    ? { minX, minY, maxX, maxY }
    : null;
}

function rectangleMatchesViewport(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  viewport: { x: number; y: number; width: number; height: number },
): boolean {
  const tolerance = Math.max(viewport.width, viewport.height) * 0.01 + 0.5;
  return (
    Math.abs(minX - viewport.x) <= tolerance &&
    Math.abs(minY - viewport.y) <= tolerance &&
    Math.abs(maxX - (viewport.x + viewport.width)) <= tolerance &&
    Math.abs(maxY - (viewport.y + viewport.height)) <= tolerance
  );
}

function parseSvgNumber(value: string): number | null {
  const match = String(value || "").trim().match(/^(-?\d*\.?\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampNumber(value: number, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function formatNumber(value: number): string {
  return Number(value)
    .toFixed(3)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function formatPercent(value: number): string {
  return `${formatNumber(Math.min(1, Math.max(0, value)) * 100)}%`;
}

function buildSvgIdPrefix(value: string | undefined, svg: string): string {
  const raw = value?.trim() || `output-polish-${hashString(svg)}`;
  return sanitizeSvgId(raw);
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeSvgAttribute(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
