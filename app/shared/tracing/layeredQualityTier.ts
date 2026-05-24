export type LayeredQualityTier = "default" | "medium" | "high" | "insane";

const MEDIUM_LAYERED_QUALITY_PRESET_IDS = new Set([
  "layered-flat-color-medium-quality",
  "photo-many-colors-medium-quality",
  "layered-detail-medium-quality",
  "filled-layers-separate-colors-medium-quality",
]);

const HIGH_LAYERED_QUALITY_PRESET_IDS = new Set([
  "layered-flat-color-high-quality",
  "photo-many-colors-high-quality",
  "layered-detail-high-quality",
  "filled-layers-separate-colors-high-quality",
]);

const INSANE_LAYERED_QUALITY_PRESET_IDS = new Set([
  "layered-insane-quality",
  "layered-flat-color-insane-quality",
  "photo-many-colors-insane-quality",
  "layered-detail-insane-quality",
  "filled-layers-separate-colors-insane-quality",
]);

const FLAT_COLOR_QUALITY_PRESET_IDS = new Set([
  "layered-flat-color",
  "layered-flat-color-medium-quality",
  "layered-flat-color-high-quality",
  "layered-flat-color-insane-quality",
  "layered-insane-quality",
]);

const PHOTO_MANY_COLORS_QUALITY_PRESET_IDS = new Set([
  "photo-many-colors",
  "photo-many-colors-medium-quality",
  "photo-many-colors-high-quality",
  "photo-many-colors-insane-quality",
]);

export function normalizeLayeredQualityTier(
  value: unknown,
  presetId?: unknown,
): LayeredQualityTier {
  if (value === "medium" || value === "high" || value === "insane") {
    return value;
  }
  const normalizedPresetId = normalizePresetId(presetId);
  if (INSANE_LAYERED_QUALITY_PRESET_IDS.has(normalizedPresetId)) {
    return "insane";
  }
  if (HIGH_LAYERED_QUALITY_PRESET_IDS.has(normalizedPresetId)) return "high";
  if (MEDIUM_LAYERED_QUALITY_PRESET_IDS.has(normalizedPresetId)) {
    return "medium";
  }
  return "default";
}

export function isLayeredQualityTierPresetId(presetId: unknown) {
  const normalizedPresetId = normalizePresetId(presetId);
  return (
    MEDIUM_LAYERED_QUALITY_PRESET_IDS.has(normalizedPresetId) ||
    HIGH_LAYERED_QUALITY_PRESET_IDS.has(normalizedPresetId) ||
    INSANE_LAYERED_QUALITY_PRESET_IDS.has(normalizedPresetId)
  );
}

export function isLayeredFlatColorQualityPresetId(presetId: unknown) {
  return FLAT_COLOR_QUALITY_PRESET_IDS.has(normalizePresetId(presetId));
}

export function isPhotoManyColorsQualityPresetId(presetId: unknown) {
  return PHOTO_MANY_COLORS_QUALITY_PRESET_IDS.has(normalizePresetId(presetId));
}

export function layeredQualityTierSizeRatioCeiling(
  tier: LayeredQualityTier,
) {
  if (tier === "high" || tier === "insane") return 10;
  if (tier === "medium") return 3;
  return 1.5;
}

function normalizePresetId(value: unknown) {
  return String(value || "").trim().toLowerCase();
}
