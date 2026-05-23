import type { NormalizedTraceSettings } from "~/shared/tracing/types";
import {
  normalizeLayeredQualityTier,
  type LayeredQualityTier,
} from "~/shared/tracing/layeredQualityTier";

import {
  DEFAULT_TRACE_ADVANCED_SETTINGS,
  normalizeColorInput,
} from "./settings";

export type NormalizedConversionCacheSettings = {
  presetId: string | null;
  engine: "auto" | "vtracer" | "potrace" | "centerline";
  traceMode: "single" | "layered";
  strokeOutputMode: "filled" | "centerline";
  lineColor: string;
  transparent: boolean;
  bgColor: string;
  invert: boolean;
  threshold: number | null;
  turdSize: number | null;
  optTolerance: number | null;
  turnPolicy: string | null;
  preprocess: string | null;
  blurSigma: number | null;
  edgeBoost: number | null;
  maxTraceSide: number;
  centerlineMaxTraceSide: number;
  centerlineStrokeWidth: number;
  centerlineSimplifyTolerance: number;
  centerlineMinPathLength: number;
  colorLayerCount: number | null;
  layerMaxTraceSide: number | null;
  minRegionPercent: number | null;
  layerOptTolerance: number | null;
  layerTurdSize: number | null;
  layerTurnPolicy: string | null;
  posterize: boolean;
  removeWhite: boolean;
  removeTransparent: boolean;
  removeColors: string[];
  removeColorTolerance: number;
  brightness: number;
  contrast: number;
  edgeThreshold: number;
  edgeThickness: number;
  noiseReduction: number;
  gapCloseStrength: number;
  minIslandPx: number;
  holeFillPx: number;
  colorMergeTolerance: number;
  posterizeStrength: number;
  sortLayersBy: string;
  layerAlpha: number;
  backgroundAlpha: number;
  fillStrokeWidth: number;
  fillStrokeColor: string;
  layerBuildMode: string;
  layerOverlapPx: number;
  groupBy: string;
  gapFill: string;
  paletteAlgorithm: string;
  paletteDistance: string;
  requestedPaletteCount: number;
  layeredQualityTier: LayeredQualityTier;
  traceDiagnosticsMode: "off" | "summary";
  outputWidth: number;
  outputHeight: number;
  preserveAspectRatio: boolean;
};

export function normalizeConversionRequestForCache(
  settings: NormalizedTraceSettings & Record<string, unknown>,
): NormalizedConversionCacheSettings {
  const merged = {
    ...DEFAULT_TRACE_ADVANCED_SETTINGS,
    ...settings,
  };

  return {
    presetId:
      typeof merged.presetId === "string" && merged.presetId.trim()
        ? merged.presetId.trim()
        : null,
    engine: normalizeEngine(merged.engine),
    traceMode: merged.traceMode === "layered" ? "layered" : "single",
    strokeOutputMode:
      merged.strokeOutputMode === "centerline" ? "centerline" : "filled",
    lineColor: normalizeColorInput(String(merged.lineColor || "")) || "#000000",
    transparent: Boolean(merged.transparent),
    bgColor: normalizeColorInput(String(merged.bgColor || "")) || "#ffffff",
    invert: Boolean(merged.invert),
    threshold: finiteNumberOrNull(merged.threshold),
    turdSize: finiteNumberOrNull(merged.turdSize),
    optTolerance: finiteNumberOrNull(merged.optTolerance),
    turnPolicy: normalizeOptionalString(merged.turnPolicy),
    preprocess: normalizeOptionalString(merged.preprocess),
    blurSigma: finiteNumberOrNull(merged.blurSigma),
    edgeBoost: finiteNumberOrNull(merged.edgeBoost),
    maxTraceSide: finiteNumber(merged.maxTraceSide, DEFAULT_TRACE_ADVANCED_SETTINGS.maxTraceSide),
    centerlineMaxTraceSide: finiteNumber(
      merged.centerlineMaxTraceSide,
      DEFAULT_TRACE_ADVANCED_SETTINGS.centerlineMaxTraceSide,
    ),
    centerlineStrokeWidth: finiteNumber(
      merged.centerlineStrokeWidth,
      DEFAULT_TRACE_ADVANCED_SETTINGS.centerlineStrokeWidth,
    ),
    centerlineSimplifyTolerance: finiteNumber(
      merged.centerlineSimplifyTolerance,
      DEFAULT_TRACE_ADVANCED_SETTINGS.centerlineSimplifyTolerance,
    ),
    centerlineMinPathLength: finiteNumber(
      merged.centerlineMinPathLength,
      DEFAULT_TRACE_ADVANCED_SETTINGS.centerlineMinPathLength,
    ),
    colorLayerCount: finiteNumberOrNull(merged.colorLayerCount),
    layerMaxTraceSide: finiteNumberOrNull(merged.layerMaxTraceSide),
    minRegionPercent: finiteNumberOrNull(merged.minRegionPercent),
    layerOptTolerance: finiteNumberOrNull(merged.layerOptTolerance),
    layerTurdSize: finiteNumberOrNull(merged.layerTurdSize),
    layerTurnPolicy: normalizeOptionalString(merged.layerTurnPolicy),
    posterize: Boolean(merged.posterize),
    removeWhite: Boolean(merged.removeWhite),
    removeTransparent: Boolean(merged.removeTransparent),
    removeColors: normalizeRemoveColors(merged.removeColors),
    removeColorTolerance: finiteNumber(
      merged.removeColorTolerance,
      DEFAULT_TRACE_ADVANCED_SETTINGS.removeColorTolerance,
    ),
    brightness: finiteNumber(merged.brightness, DEFAULT_TRACE_ADVANCED_SETTINGS.brightness),
    contrast: finiteNumber(merged.contrast, DEFAULT_TRACE_ADVANCED_SETTINGS.contrast),
    edgeThreshold: finiteNumber(
      merged.edgeThreshold,
      DEFAULT_TRACE_ADVANCED_SETTINGS.edgeThreshold,
    ),
    edgeThickness: finiteNumber(
      merged.edgeThickness,
      DEFAULT_TRACE_ADVANCED_SETTINGS.edgeThickness,
    ),
    noiseReduction: finiteNumber(
      merged.noiseReduction,
      DEFAULT_TRACE_ADVANCED_SETTINGS.noiseReduction,
    ),
    gapCloseStrength: finiteNumber(
      merged.gapCloseStrength,
      DEFAULT_TRACE_ADVANCED_SETTINGS.gapCloseStrength,
    ),
    minIslandPx: finiteNumber(merged.minIslandPx, DEFAULT_TRACE_ADVANCED_SETTINGS.minIslandPx),
    holeFillPx: finiteNumber(merged.holeFillPx, DEFAULT_TRACE_ADVANCED_SETTINGS.holeFillPx),
    colorMergeTolerance: finiteNumber(
      merged.colorMergeTolerance,
      DEFAULT_TRACE_ADVANCED_SETTINGS.colorMergeTolerance,
    ),
    posterizeStrength: finiteNumber(
      merged.posterizeStrength,
      DEFAULT_TRACE_ADVANCED_SETTINGS.posterizeStrength,
    ),
    sortLayersBy: normalizeEnumString(merged.sortLayersBy, ["luminance", "area", "original"], "luminance"),
    layerAlpha: finiteNumber(merged.layerAlpha, DEFAULT_TRACE_ADVANCED_SETTINGS.layerAlpha),
    backgroundAlpha: finiteNumber(
      merged.backgroundAlpha,
      DEFAULT_TRACE_ADVANCED_SETTINGS.backgroundAlpha,
    ),
    fillStrokeWidth: finiteNumber(
      merged.fillStrokeWidth,
      DEFAULT_TRACE_ADVANCED_SETTINGS.fillStrokeWidth,
    ),
    fillStrokeColor:
      normalizeColorInput(String(merged.fillStrokeColor || "")) ||
      DEFAULT_TRACE_ADVANCED_SETTINGS.fillStrokeColor,
    layerBuildMode: normalizeEnumString(
      merged.layerBuildMode,
      ["raw-vtracer", "per-color-cutout", "stacked-overlap"],
      DEFAULT_TRACE_ADVANCED_SETTINGS.layerBuildMode,
    ),
    layerOverlapPx: finiteNumber(
      merged.layerOverlapPx,
      DEFAULT_TRACE_ADVANCED_SETTINGS.layerOverlapPx,
    ),
    groupBy: normalizeEnumString(
      merged.groupBy,
      ["none", "color", "layer"],
      DEFAULT_TRACE_ADVANCED_SETTINGS.groupBy,
    ),
    gapFill: normalizeEnumString(
      merged.gapFill,
      ["none", "close-small-gaps", "overlap"],
      DEFAULT_TRACE_ADVANCED_SETTINGS.gapFill,
    ),
    paletteAlgorithm: normalizeEnumString(
      merged.paletteAlgorithm,
      ["image-q-wuquant", "image-q-rgbquant", "simple-posterize"],
      DEFAULT_TRACE_ADVANCED_SETTINGS.paletteAlgorithm,
    ),
    paletteDistance: normalizeEnumString(
      merged.paletteDistance,
      ["ciede2000", "bt709", "rgb"],
      DEFAULT_TRACE_ADVANCED_SETTINGS.paletteDistance,
    ),
    requestedPaletteCount: finiteNumber(
      merged.requestedPaletteCount,
      DEFAULT_TRACE_ADVANCED_SETTINGS.requestedPaletteCount,
    ),
    layeredQualityTier: normalizeLayeredQualityTier(
      merged.layeredQualityTier,
      merged.presetId,
    ),
    traceDiagnosticsMode:
      merged.traceDiagnosticsMode === "summary" ? "summary" : "off",
    outputWidth: finiteNumber(merged.outputWidth, DEFAULT_TRACE_ADVANCED_SETTINGS.outputWidth),
    outputHeight: finiteNumber(merged.outputHeight, DEFAULT_TRACE_ADVANCED_SETTINGS.outputHeight),
    preserveAspectRatio:
      merged.preserveAspectRatio ?? DEFAULT_TRACE_ADVANCED_SETTINGS.preserveAspectRatio,
  };
}

function normalizeEngine(value: unknown) {
  return value === "vtracer" || value === "potrace" || value === "centerline"
    ? value
    : "auto";
}

function normalizeOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Number(parsed.toFixed(4));
}

function finiteNumberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(4));
}

function normalizeRemoveColors(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((color) => normalizeColorInput(String(color || "")))
        .filter((color): color is string => Boolean(color)),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function normalizeEnumString<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}
