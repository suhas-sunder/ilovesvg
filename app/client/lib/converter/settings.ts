export type RemoveColorApplyTo = "single" | "layered" | "both";
export type SortLayersBy = "luminance" | "area" | "original";

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
