export type PresetBackendIntensity =
  | "lightning-fast"
  | "extreme-speed"
  | "high-speed"
  | "low-speed"
  | "slow-speed"
  | "very-slow"
  | "insanely-slow";

export type PresetIntensityBadge = {
  id: PresetBackendIntensity;
  label: string;
  rank: number;
  className: string;
  title: string;
};

export type PresetWithIntensity = {
  backendIntensity?: PresetBackendIntensity;
  settings?: unknown;
};

const INTENSITY_BADGES: Record<PresetBackendIntensity, PresetIntensityBadge> = {
  "lightning-fast": {
    id: "lightning-fast",
    label: "Lightning Fast",
    rank: 0,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    title:
      "Lightning Fast: very light backend work or local output styling.",
  },
  "extreme-speed": {
    id: "extreme-speed",
    label: "Extreme Speed",
    rank: 1,
    className: "border-cyan-200 bg-cyan-50 text-cyan-700",
    title: "Extreme Speed: simple tracing with low processing cost.",
  },
  "high-speed": {
    id: "high-speed",
    label: "High Speed",
    rank: 2,
    className: "border-blue-200 bg-blue-50 text-blue-700",
    title: "High Speed: normal tracing cost for balanced output.",
  },
  "low-speed": {
    id: "low-speed",
    label: "Low Speed",
    rank: 3,
    className: "border-amber-200 bg-amber-50 text-amber-800",
    title: "Low Speed: detailed tracing or heavier preprocessing.",
  },
  "slow-speed": {
    id: "slow-speed",
    label: "Slow Speed",
    rank: 4,
    className: "border-rose-200 bg-rose-50 text-rose-700",
    title: "Slow Speed: layered, high-detail, or complex tracing.",
  },
  "very-slow": {
    id: "very-slow",
    label: "Very Slow",
    rank: 5,
    className: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
    title: "Very Slow: heavy layered or color-preserving tracing.",
  },
  "insanely-slow": {
    id: "insanely-slow",
    label: "Insanely Slow",
    rank: 6,
    className: "border-red-300 bg-red-50 text-red-700",
    title: "Insanely Slow: very heavy per-color or high-palette tracing.",
  },
};

export function getPresetIntensityBadge(
  preset: PresetWithIntensity,
): PresetIntensityBadge {
  return INTENSITY_BADGES[
    preset.backendIntensity ?? inferPresetBackendIntensity(preset.settings)
  ];
}

export function getPresetIntensityLabel(
  intensity: PresetBackendIntensity,
): string {
  return INTENSITY_BADGES[intensity].label;
}

export function inferPresetBackendIntensity(
  settings: unknown,
): PresetBackendIntensity {
  const values =
    settings && typeof settings === "object"
      ? (settings as Record<string, unknown>)
      : {};

  const traceMode = String(values.traceMode || "");
  const preprocess = String(values.preprocess || "");
  const layerCount = numberValue(values.colorLayerCount ?? values.layerCount, 0);
  const layerMaxTraceSide = numberValue(
    values.layerMaxTraceSide ?? values.maxTraceSide,
    0,
  );
  const maxTraceSide = numberValue(values.maxTraceSide, layerMaxTraceSide);
  const turdSize = numberValue(values.turdSize, 0);
  const optTolerance = numberValue(values.optTolerance, 0);
  const edgeThreshold = numberValue(values.edgeThreshold, 0);
  const edgeThickness = numberValue(values.edgeThickness, 1);
  const minIslandPx = numberValue(values.minIslandPx, 0);
  const holeFillPx = numberValue(values.holeFillPx, 0);
  const colorMergeTolerance = numberValue(values.colorMergeTolerance, 0);
  const requestedPaletteCount = numberValue(values.requestedPaletteCount, 0);
  const layerBuildMode = String(values.layerBuildMode || "");

  const isLayered = traceMode === "layered" || layerCount > 0;
  if (isLayered) {
    const palettePressure = Math.max(layerCount, requestedPaletteCount);
    if (
      layerBuildMode === "per-color-cutout" &&
      (palettePressure >= 16 || layerMaxTraceSide >= 1800)
    ) {
      return "insanely-slow";
    }
    if (palettePressure >= 10 || layerMaxTraceSide >= 2200) return "very-slow";
    if (palettePressure >= 7 || layerMaxTraceSide >= 1800) return "slow-speed";
    if (palettePressure >= 4 || layerMaxTraceSide >= 1400) return "low-speed";
    return "high-speed";
  }

  if (
    preprocess === "edge" &&
    (maxTraceSide >= 2000 || edgeThreshold >= 120 || edgeThickness >= 3)
  ) {
    return "low-speed";
  }

  if (
    preprocess === "edge" ||
    maxTraceSide >= 2000 ||
    turdSize <= 1 ||
    optTolerance <= 0.24 ||
    minIslandPx > 0 ||
    holeFillPx > 0
  ) {
    return "high-speed";
  }

  if (colorMergeTolerance >= 30 || turdSize >= 6 || optTolerance >= 0.6) {
    return "lightning-fast";
  }

  if (maxTraceSide > 0 && maxTraceSide <= 1200) return "lightning-fast";

  return "extreme-speed";
}

export function isPresetBackendIntensity(value: unknown): value is PresetBackendIntensity {
  return (
    value === "lightning-fast" ||
    value === "extreme-speed" ||
    value === "high-speed" ||
    value === "low-speed" ||
    value === "slow-speed" ||
    value === "very-slow" ||
    value === "insanely-slow"
  );
}

function numberValue(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
