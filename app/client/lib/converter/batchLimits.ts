import {
  isPresetBackendIntensity,
  type PresetBackendIntensity,
} from "./presetIntensity";

export type BatchSpeedTier = "fastest" | "limited";

export type BatchPreviewLike<
  TSettings extends Record<string, unknown> = Record<string, unknown>,
> = {
  presetId?: string | null;
  backendIntensity?: PresetBackendIntensity | null;
  presetBackendIntensity?: PresetBackendIntensity | null;
  settings?: TSettings | null;
  settingsSnapshot?: TSettings | null;
};

export type BatchPresetIntensityLookup = (
  presetId: string,
) => PresetBackendIntensity | null | undefined;

export type BatchPreviewSpeedOptions = {
  getPresetIntensity?: BatchPresetIntensityLookup;
};

export const DEFAULT_BATCH_COUNT = 10;
export const FASTEST_BATCH_MAX = 100;
export const LIMITED_BATCH_MAX = 20;

const LIGHTWEIGHT_MAX_TRACE_SIDE = 1600;
const FASTEST_PRESET_INTENSITIES = new Set<PresetBackendIntensity>([
  "lightning-fast",
  "extreme-speed",
]);

export function getBatchSpeedTierForPresetIntensity(
  intensity: unknown,
): BatchSpeedTier | null {
  if (!isPresetBackendIntensity(intensity)) return null;
  return FASTEST_PRESET_INTENSITIES.has(intensity) ? "fastest" : "limited";
}

export function getBatchSpeedTierForSettings(
  settings: unknown,
): BatchSpeedTier {
  const values = recordValue(settings);
  if (!values) return "limited";

  const traceMode = stringValue(values.traceMode, "single");
  if (traceMode !== "single") return "limited";

  const preprocess = stringValue(values.preprocess, "none");
  if (preprocess !== "none") return "limited";

  if (numberValue(values.maxTraceSide, 0) > LIGHTWEIGHT_MAX_TRACE_SIDE) {
    return "limited";
  }

  if (hasSelectedColors(values.removeColors)) return "limited";
  if (numberValue(values.brightness, 0) !== 0) return "limited";
  if (numberValue(values.contrast, 0) !== 0) return "limited";
  if (numberValue(values.noiseReduction, 0) > 0) return "limited";
  if (numberValue(values.gapCloseStrength, 0) > 0) return "limited";
  if (numberValue(values.minIslandPx, 0) > 0) return "limited";
  if (numberValue(values.holeFillPx, 0) > 0) return "limited";
  if (numberValue(values.edgeThreshold, 18) !== 18) return "limited";
  if (numberValue(values.edgeThickness, 1) !== 1) return "limited";
  if (numberValue(values.blurSigma, 0.8) > 0.8) return "limited";
  if (numberValue(values.edgeBoost, 1) !== 1) return "limited";
  if (numberValue(values.turdSize, 2) <= 1) return "limited";
  if (numberValue(values.optTolerance, 0.28) < 0.25) return "limited";

  return "fastest";
}

export function getBatchSpeedTierForPreview(
  preview: BatchPreviewLike | null | undefined,
  options: BatchPreviewSpeedOptions = {},
): BatchSpeedTier {
  if (!preview) return "limited";

  const directPresetTier = getBatchSpeedTierForPresetIntensity(
    preview.presetBackendIntensity ?? preview.backendIntensity,
  );
  if (directPresetTier) return directPresetTier;

  if (preview.presetId && options.getPresetIntensity) {
    const presetTier = getBatchSpeedTierForPresetIntensity(
      options.getPresetIntensity(preview.presetId),
    );
    if (presetTier) return presetTier;
  }

  return getBatchSpeedTierForSettings(
    preview.settingsSnapshot ?? preview.settings ?? null,
  );
}

export function getBatchMaxForSpeedTier(tier: BatchSpeedTier): number {
  return tier === "fastest" ? FASTEST_BATCH_MAX : LIMITED_BATCH_MAX;
}

export function getBatchMaxForPreview(
  preview: BatchPreviewLike | null | undefined,
  options: BatchPreviewSpeedOptions = {},
): number {
  return getBatchMaxForSpeedTier(getBatchSpeedTierForPreview(preview, options));
}

export function clampBatchCount(
  value: unknown,
  max: number,
  fallback = DEFAULT_BATCH_COUNT,
): number {
  const safeMax = Math.max(1, Math.min(FASTEST_BATCH_MAX, Math.floor(max)));
  const parsed = parseCount(value);
  const fallbackCount = parseCount(fallback) ?? DEFAULT_BATCH_COUNT;
  const count = parsed ?? fallbackCount;
  return Math.max(1, Math.min(safeMax, count));
}

function parseCount(value: unknown): number | null {
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed);
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim()
    ? value.trim().toLowerCase()
    : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hasSelectedColors(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "[]") return false;
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return true;
  }
}
