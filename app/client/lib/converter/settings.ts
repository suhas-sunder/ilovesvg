export type RemoveColorApplyTo = "single" | "layered" | "both";
export type SortLayersBy = "luminance" | "area" | "original";
export type LayerBuildMode = "raw-vtracer" | "per-color-cutout" | "stacked-overlap";
export type LayerGroupBy = "none" | "color" | "layer";
export type LayerGapFill = "none" | "close-small-gaps" | "overlap";
export type PaletteAlgorithm = "image-q-wuquant" | "image-q-rgbquant" | "simple-posterize";
export type PaletteDistance = "ciede2000" | "bt709" | "rgb";
export type StrokeOutputMode = "filled" | "centerline";

export type TraceAdvancedSettings = {
  removeColors?: string[];
  removeColorTolerance?: number;
  removeColorApplyTo?: RemoveColorApplyTo;
  backgroundAlpha?: number;
  fillAlpha?: number;
  layerAlpha?: number;
  maxTraceSide?: number;
  outputWidth?: number;
  outputHeight?: number;
  preserveAspectRatio?: boolean;
  brightness?: number;
  contrast?: number;
  edgeThreshold?: number;
  edgeThickness?: number;
  noiseReduction?: number;
  gapCloseStrength?: number;
  minIslandPx?: number;
  holeFillPx?: number;
  colorMergeTolerance?: number;
  posterizeStrength?: number;
  sortLayersBy?: SortLayersBy;
  layerBuildMode?: LayerBuildMode;
  layerOverlapPx?: number;
  fillStrokeWidth?: number;
  fillStrokeColor?: string;
  groupBy?: LayerGroupBy;
  gapFill?: LayerGapFill;
  paletteAlgorithm?: PaletteAlgorithm;
  paletteDistance?: PaletteDistance;
  requestedPaletteCount?: number;
  traceDiagnosticsMode?: "off" | "summary";
  strokeOutputMode?: StrokeOutputMode;
  centerlineMaxTraceSide?: number;
  centerlineStrokeWidth?: number;
  centerlineSimplifyTolerance?: number;
  centerlineMinPathLength?: number;
};

export const DEFAULT_TRACE_ADVANCED_SETTINGS = {
  removeColors: [] as string[],
  removeColorTolerance: 18,
  removeColorApplyTo: "both" as RemoveColorApplyTo,
  backgroundAlpha: 1,
  fillAlpha: 1,
  layerAlpha: 1,
  maxTraceSide: 3000,
  outputWidth: 0,
  outputHeight: 0,
  preserveAspectRatio: true,
  brightness: 0,
  contrast: 0,
  edgeThreshold: 18,
  edgeThickness: 1,
  noiseReduction: 0,
  gapCloseStrength: 0,
  minIslandPx: 0,
  holeFillPx: 0,
  colorMergeTolerance: 0,
  posterizeStrength: 8,
  sortLayersBy: "luminance" as SortLayersBy,
  layerBuildMode: "raw-vtracer" as LayerBuildMode,
  layerOverlapPx: 0,
  fillStrokeWidth: 0,
  fillStrokeColor: "#020617",
  groupBy: "color" as LayerGroupBy,
  gapFill: "none" as LayerGapFill,
  paletteAlgorithm: "simple-posterize" as PaletteAlgorithm,
  paletteDistance: "bt709" as PaletteDistance,
  requestedPaletteCount: 0,
  traceDiagnosticsMode: "off" as const,
  strokeOutputMode: "filled" as StrokeOutputMode,
  centerlineMaxTraceSide: 1100,
  centerlineStrokeWidth: 2,
  centerlineSimplifyTolerance: 1.1,
  centerlineMinPathLength: 5,
};

export function appendAdvancedTraceSettings(
  formData: FormData,
  settings: TraceAdvancedSettings,
) {
  const merged = { ...DEFAULT_TRACE_ADVANCED_SETTINGS, ...settings };
  formData.append("removeColors", JSON.stringify(normalizeColorList(merged.removeColors)));
  formData.append("removeColorTolerance", String(merged.removeColorTolerance));
  formData.append("removeColorApplyTo", String(merged.removeColorApplyTo));
  formData.append("backgroundAlpha", String(merged.backgroundAlpha));
  formData.append("fillAlpha", String(merged.fillAlpha));
  formData.append("layerAlpha", String(merged.layerAlpha));
  formData.append("maxTraceSide", String(merged.maxTraceSide));
  formData.append("outputWidth", String(merged.outputWidth));
  formData.append("outputHeight", String(merged.outputHeight));
  formData.append("preserveAspectRatio", String(merged.preserveAspectRatio));
  formData.append("brightness", String(merged.brightness));
  formData.append("contrast", String(merged.contrast));
  formData.append("edgeThreshold", String(merged.edgeThreshold));
  formData.append("edgeThickness", String(merged.edgeThickness));
  formData.append("noiseReduction", String(merged.noiseReduction));
  formData.append("gapCloseStrength", String(merged.gapCloseStrength));
  formData.append("minIslandPx", String(merged.minIslandPx));
  formData.append("holeFillPx", String(merged.holeFillPx));
  formData.append("colorMergeTolerance", String(merged.colorMergeTolerance));
  formData.append("posterizeStrength", String(merged.posterizeStrength));
  formData.append("sortLayersBy", String(merged.sortLayersBy));
  formData.append("layerBuildMode", String(merged.layerBuildMode));
  formData.append("layerOverlapPx", String(merged.layerOverlapPx));
  formData.append("fillStrokeWidth", String(merged.fillStrokeWidth));
  formData.append("fillStrokeColor", String(merged.fillStrokeColor));
  formData.append("groupBy", String(merged.groupBy));
  formData.append("gapFill", String(merged.gapFill));
  formData.append("paletteAlgorithm", String(merged.paletteAlgorithm));
  formData.append("paletteDistance", String(merged.paletteDistance));
  formData.append("requestedPaletteCount", String(merged.requestedPaletteCount));
  formData.append("traceDiagnosticsMode", String(merged.traceDiagnosticsMode));
  formData.append("strokeOutputMode", String(merged.strokeOutputMode));
  formData.append("centerlineMaxTraceSide", String(merged.centerlineMaxTraceSide));
  formData.append("centerlineStrokeWidth", String(merged.centerlineStrokeWidth));
  formData.append(
    "centerlineSimplifyTolerance",
    String(merged.centerlineSimplifyTolerance),
  );
  formData.append("centerlineMinPathLength", String(merged.centerlineMinPathLength));
}

export function normalizeColorList(colors: unknown): string[] {
  if (!Array.isArray(colors)) return [];

  const out: string[] = [];
  for (const color of colors) {
    const normalized = normalizeColorInput(String(color || ""));
    if (!normalized || out.includes(normalized)) continue;
    out.push(normalized);
    if (out.length >= 12) break;
  }
  return out;
}

export function normalizeHexColor(value: string): string | null {
  const raw = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return null;
}

const NAMED_COLOR_HEX: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  cyan: "#00ffff",
  aqua: "#00ffff",
  magenta: "#ff00ff",
  fuchsia: "#ff00ff",
  yellow: "#ffff00",
  gray: "#808080",
  grey: "#808080",
  orange: "#ffa500",
  purple: "#800080",
  pink: "#ffc0cb",
  brown: "#a52a2a",
};

export function normalizeColorInput(value: string): string | null {
  const hex = normalizeHexColor(value);
  if (hex) return hex;

  const named = NAMED_COLOR_HEX[value.trim().toLowerCase()];
  if (named) return named;

  const match = value
    .trim()
    .match(/^rgba?\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)(?:\s*,\s*(?:0|1|0?\.\d+|[+-]?\d+(?:\.\d+)?%))?\s*\)$/i);
  if (!match) return null;

  const channels = match.slice(1, 4).map((part) => {
    const value = Number(part);
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.min(255, Math.round(value)));
  });
  if (channels.some((channel) => channel == null)) return null;

  return `#${channels
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}
