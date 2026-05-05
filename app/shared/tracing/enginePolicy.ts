import type {
  NormalizedTraceSettings,
  TraceEngine,
  TraceEngineDecision,
} from "./types";

export type TraceInputProfile = {
  mimeType?: string;
  fileSizeBytes?: number;
  width?: number | null;
  height?: number | null;
  browserCanRunWorker?: boolean;
};

const CLIENT_MAX_BYTES = 8 * 1024 * 1024;
const CLIENT_MAX_PIXELS = 8_000_000;
const CLIENT_MAX_SIDE = 2600;

const LEGACY_POTRACE_PRESET_TERMS = [
  "line-",
  "line_",
  "lineart",
  "line-art",
  "line_art",
  "sketch",
  "drawing",
  "pencil",
  "photo",
  "edge",
  "comic",
  "comics",
  "ink",
  "inks",
  "diagram",
  "technical",
  "blueprint",
  "whiteboard",
  "stencil",
  "stamp",
  "invert",
  "chalkboard",
  "map-lines",
  "thin-strokes",
  "bold-strokes",
  "transparent-clean",
  "white-remove",
  "sticker-clean",
  "sticker-thick",
  "sticker-smooth",
  "color-blue-line",
  "color-red-line",
  "color-gray-line",
  "black",
  "white",
  "silhouette",
  "scan",
  "scanned",
  "logo",
  "vinyl",
  "cut",
  "cricut",
  "laser",
];

const VTRACER_PRESET_TERMS = [
  "layer",
  "layered",
  "color",
  "poster",
];

export function getTraceEngineDecision(
  settings: NormalizedTraceSettings,
  input: TraceInputProfile = {},
): TraceEngineDecision {
  const requested = normalizeRequestedEngine(settings.engine);
  const clientEligible = canRunVTracerClient(settings, input);

  if (requested === "potrace") {
    return {
      engine: "potrace",
      clientEligible: false,
      reason: "Potrace was explicitly requested for this conversion.",
    };
  }

  if (requested === "vtracer") {
    return clientEligible
      ? {
          engine: "vtracer",
          clientEligible: true,
          reason: "VTracer was explicitly requested and the input is browser-safe.",
        }
      : {
          engine: "potrace",
          clientEligible: false,
          reason:
            "VTracer was requested but this input is not safe for the browser worker, so Potrace remains the fallback.",
        };
  }

  if (!clientEligible) {
    return {
      engine: "potrace",
      clientEligible: false,
      reason: "The input or browser capability is outside the safe VTracer worker limits.",
    };
  }

  if (settings.traceMode === "layered") {
    return {
      engine: "vtracer",
      clientEligible: true,
      reason: "Layered color tracing is routed to VTracer by default.",
    };
  }

  const routeId = String(settings.routeId || "").toLowerCase();
  if (LEGACY_POTRACE_PRESET_TERMS.some((term) => routeId.includes(term))) {
    return {
      engine: "potrace",
      clientEligible: false,
      reason: "This route keeps Potrace for current line-art/cut-file parity.",
    };
  }

  const presetId = String(settings.presetId || "").toLowerCase();
  if (LEGACY_POTRACE_PRESET_TERMS.some((term) => presetId.includes(term))) {
    return {
      engine: "potrace",
      clientEligible: false,
      reason: "This preset keeps Potrace for current line-art/cut-file parity.",
    };
  }

  if (VTRACER_PRESET_TERMS.some((term) => presetId.includes(term))) {
    return {
      engine: "vtracer",
      clientEligible: true,
      reason: "This preset family benefits from VTracer color/path tracing.",
    };
  }

  return {
    engine: "potrace",
    clientEligible: false,
    reason:
      "Auto mode keeps Potrace for ambiguous or custom single-trace settings to preserve output parity.",
  };
}

export function canRunVTracerClient(
  settings: NormalizedTraceSettings,
  input: TraceInputProfile = {},
): boolean {
  if (input.browserCanRunWorker === false) return false;

  const mimeType = String(input.mimeType || "").toLowerCase();
  if (!isRasterMimeType(mimeType)) return false;

  if ((input.fileSizeBytes || 0) > CLIENT_MAX_BYTES) return false;

  const width = Number(input.width || 0);
  const height = Number(input.height || 0);
  if (width > 0 && height > 0) {
    if (width > CLIENT_MAX_SIDE || height > CLIENT_MAX_SIDE) return false;
    if (width * height > CLIENT_MAX_PIXELS) return false;
  }

  const maxTraceSide = Number(
    settings.traceMode === "layered"
      ? settings.layerMaxTraceSide || settings.maxTraceSide || 0
      : settings.maxTraceSide || 0,
  );
  if (Number.isFinite(maxTraceSide) && maxTraceSide > CLIENT_MAX_SIDE) {
    const sourceMaxSide = Math.max(width, height);
    if (!sourceMaxSide || sourceMaxSide > CLIENT_MAX_SIDE) return false;
  }

  return true;
}

export function isRasterMimeType(mimeType: string): boolean {
  return (
    mimeType === "image/png" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/jpg" ||
    mimeType === "image/webp" ||
    mimeType === "image/gif" ||
    mimeType === "image/avif" ||
    mimeType === "image/bmp" ||
    mimeType === "image/tiff"
  );
}

function normalizeRequestedEngine(value: unknown): TraceEngine {
  return value === "vtracer" || value === "potrace" ? value : "auto";
}
