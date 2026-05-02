export type RemoveColorApplyTo = "single" | "layered" | "both";
export type SortLayersBy = "luminance" | "area" | "original";

export type AdvancedTraceServerSettings = {
  removeColors: string[];
  removeColorTolerance: number;
  removeColorApplyTo: RemoveColorApplyTo;
  backgroundAlpha: number;
  fillAlpha: number;
  layerAlpha: number;
  maxTraceSide: number;
  outputWidth: number;
  outputHeight: number;
  preserveAspectRatio: boolean;
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
  sortLayersBy: SortLayersBy;
};

export const DEFAULT_ADVANCED_TRACE_SERVER_SETTINGS: AdvancedTraceServerSettings = {
  removeColors: [],
  removeColorTolerance: 18,
  removeColorApplyTo: "both",
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
  sortLayersBy: "luminance",
};

export function readAdvancedTraceFormSettings(
  form: FormData,
): AdvancedTraceServerSettings {
  return {
    removeColors: readColorList(form.get("removeColors")),
    removeColorTolerance: readNumber(form, "removeColorTolerance", 18, 0, 160),
    removeColorApplyTo: readRemoveColorApplyTo(form.get("removeColorApplyTo")),
    backgroundAlpha: readNumber(form, "backgroundAlpha", 1, 0, 1),
    fillAlpha: readNumber(form, "fillAlpha", 1, 0.05, 1),
    layerAlpha: readNumber(form, "layerAlpha", 1, 0.05, 1),
    maxTraceSide: Math.round(readNumber(form, "maxTraceSide", 3000, 64, 3000)),
    outputWidth: Math.round(readNumber(form, "outputWidth", 0, 0, 6000)),
    outputHeight: Math.round(readNumber(form, "outputHeight", 0, 0, 6000)),
    preserveAspectRatio: readBoolean(form.get("preserveAspectRatio"), true),
    brightness: readNumber(form, "brightness", 0, -50, 50),
    contrast: readNumber(form, "contrast", 0, -50, 75),
    edgeThreshold: Math.round(readNumber(form, "edgeThreshold", 18, 0, 160)),
    edgeThickness: Math.round(readNumber(form, "edgeThickness", 1, 1, 4)),
    noiseReduction: Math.round(readNumber(form, "noiseReduction", 0, 0, 5)),
    gapCloseStrength: Math.round(readNumber(form, "gapCloseStrength", 0, 0, 3)),
    minIslandPx: Math.round(readNumber(form, "minIslandPx", 0, 0, 120)),
    holeFillPx: Math.round(readNumber(form, "holeFillPx", 0, 0, 120)),
    colorMergeTolerance: Math.round(
      readNumber(form, "colorMergeTolerance", 0, 0, 100),
    ),
    posterizeStrength: Math.round(readNumber(form, "posterizeStrength", 8, 2, 8)),
    sortLayersBy: readSortLayersBy(form.get("sortLayersBy")),
  };
}

export function shouldRemoveSelectedColors(
  settings: AdvancedTraceServerSettings,
  mode: "single" | "layered",
) {
  return (
    settings.removeColors.length > 0 &&
    (settings.removeColorApplyTo === "both" ||
      settings.removeColorApplyTo === mode)
  );
}

export function applyTraceSvgOutputSettings(
  svg: string,
  settings: AdvancedTraceServerSettings,
  dimensions: { width: number; height: number },
): { svg: string; width: number; height: number } {
  let outputSvg = String(svg || "");
  const width = dimensions.width || 1024;
  const height = dimensions.height || 1024;
  const target = resolveOutputDimensions(settings, width, height);

  if (settings.fillAlpha < 0.999) {
    outputSvg = outputSvg.replace(
      /<path\b([^>]*?)(\s*\/?)>/gi,
      (_match, attrs = "", selfClose = "") => {
        const nextAttrs = stripSvgAttribute(String(attrs), "fill-opacity");
        return `<path${nextAttrs} fill-opacity="${formatAlpha(
          settings.fillAlpha,
        )}"${selfClose}>`;
      },
    );
  }

  if (settings.backgroundAlpha < 0.999) {
    outputSvg = outputSvg.replace(
      /(<svg\b[^>]*>)(\s*<rect\b)([^>]*?)(\s*\/?)>/i,
      (_match, openSvg, rectStart, attrs = "", selfClose = "") => {
        const nextAttrs = stripSvgAttribute(String(attrs), "fill-opacity");
        return `${openSvg}${rectStart}${nextAttrs} fill-opacity="${formatAlpha(
          settings.backgroundAlpha,
        )}"${selfClose}>`;
      },
    );
  }

  if (target.width !== width || target.height !== height) {
    outputSvg = setSvgSizeAttributes(outputSvg, target.width, target.height);
  }

  return {
    svg: outputSvg,
    width: target.width,
    height: target.height,
  };
}

export function resolveOutputDimensions(
  settings: Pick<
    AdvancedTraceServerSettings,
    "outputWidth" | "outputHeight" | "preserveAspectRatio"
  >,
  width: number,
  height: number,
) {
  const sourceWidth = Math.max(1, Math.round(width || 1));
  const sourceHeight = Math.max(1, Math.round(height || 1));
  let outputWidth = Math.round(settings.outputWidth || 0);
  let outputHeight = Math.round(settings.outputHeight || 0);

  if (!outputWidth && !outputHeight) {
    return { width: sourceWidth, height: sourceHeight };
  }

  if (settings.preserveAspectRatio !== false) {
    const ratio = sourceWidth / sourceHeight || 1;
    if (outputWidth && !outputHeight) {
      outputHeight = Math.max(1, Math.round(outputWidth / ratio));
    } else if (!outputWidth && outputHeight) {
      outputWidth = Math.max(1, Math.round(outputHeight * ratio));
    } else if (outputWidth && outputHeight) {
      outputHeight = Math.max(1, Math.round(outputWidth / ratio));
    }
  }

  return {
    width: clampInt(outputWidth || sourceWidth, 1, 6000),
    height: clampInt(outputHeight || sourceHeight, 1, 6000),
  };
}

function readNumber(
  form: FormData,
  key: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = Number(form.get(key) ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function readBoolean(value: FormDataEntryValue | null, fallback: boolean) {
  if (value == null) return fallback;
  const text = String(value).toLowerCase();
  if (text === "true") return true;
  if (text === "false") return false;
  return fallback;
}

function readRemoveColorApplyTo(value: FormDataEntryValue | null): RemoveColorApplyTo {
  if (value === "single" || value === "layered" || value === "both") {
    return value;
  }
  return "both";
}

function readSortLayersBy(value: FormDataEntryValue | null): SortLayersBy {
  if (value === "luminance" || value === "area" || value === "original") {
    return value;
  }
  return "luminance";
}

function readColorList(value: FormDataEntryValue | null): string[] {
  if (value == null) return [];
  let raw: unknown = value;
  try {
    raw = JSON.parse(String(value));
  } catch {
    raw = String(value)
      .split(",")
      .map((item) => item.trim());
  }

  if (!Array.isArray(raw)) return [];

  const colors: string[] = [];
  for (const item of raw) {
    const color = normalizeHexColor(String(item || ""));
    if (!color || colors.includes(color)) continue;
    colors.push(color);
    if (colors.length >= 12) break;
  }
  return colors;
}

function normalizeHexColor(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(value)) return value;
  if (/^#[0-9a-f]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return null;
}

function setSvgSizeAttributes(svg: string, width: number, height: number) {
  return String(svg).replace(/<svg\b([^>]*)>/i, (_match, attrs = "") => {
    let nextAttrs = stripSvgAttribute(String(attrs), "width");
    nextAttrs = stripSvgAttribute(nextAttrs, "height");
    return `<svg${nextAttrs} width="${width}" height="${height}">`;
  });
}

function stripSvgAttribute(attrs: string, name: string) {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*(["'])[^"']*\\1`, "gi");
  return attrs.replace(pattern, "");
}

function formatAlpha(value: number) {
  return String(Math.max(0, Math.min(1, value)).toFixed(3)).replace(/0+$/, "").replace(/\.$/, "");
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}
