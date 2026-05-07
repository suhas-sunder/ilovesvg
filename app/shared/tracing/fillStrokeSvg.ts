export type FillStrokeSvgOptions = {
  fillStrokeWidth?: number | null;
  fillStrokeColor?: string | null;
  layerId?: string;
  layerLabel?: string;
  includeCanvasStroke?: boolean | null;
};

export type LayeredTraceArtifactFilterOptions = {
  fillStrokeColor?: string | null;
};

const DEFAULT_STROKE_COLOR = "#020617";
const DEFAULT_LAYER_ID = "fill-stroke-outline";
const DEFAULT_LAYER_LABEL = "Stroke outline";

export type FillStrokeViewport = {
  width: number;
  height: number;
};

export function normalizeFillStrokeWidth(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(30, parsed));
}

export function normalizeFillStrokeColor(value: unknown): string {
  const text = String(value || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) return text;
  if (/^#[0-9a-f]{3}$/.test(text)) {
    return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`;
  }
  return DEFAULT_STROKE_COLOR;
}

export function injectFillStrokeOutlineGroup(
  svg: string,
  options: FillStrokeSvgOptions,
): string {
  const width = normalizeFillStrokeWidth(options.fillStrokeWidth);
  if (width <= 0) return String(svg || "");

  const source = String(svg || "");
  const strokeColor = normalizeFillStrokeColor(options.fillStrokeColor);
  const layerId = sanitizeLayerId(options.layerId || DEFAULT_LAYER_ID);
  const layerLabel = escapeXmlAttr(options.layerLabel || DEFAULT_LAYER_LABEL);
  const viewport = parseSvgViewport(source);
  const strokePaths: string[] = [];

  source.replace(/<path\b([^>]*?)(\s*\/?)>/gi, (match, attrs = "", close = "") => {
    const rawAttrs = String(attrs || "");
    const fill = readPaint(rawAttrs, "fill") ?? readStyleProperty(rawAttrs, "fill");
    if (!fill || !isEnabledFill(fill)) return match;
    if (!/\sd\s*=\s*(["'])(?!\s*\1)[\s\S]*?\1/i.test(rawAttrs)) return match;
    if (!options.includeCanvasStroke && isCanvasBackgroundPath(rawAttrs, viewport)) return match;
    if (isTraceArtifactPath(rawAttrs, viewport, strokeColor)) return match;

    const nextAttrs = buildStrokePathAttrs(rawAttrs);
    const closeToken = String(close || "").includes("/") ? " />" : ">";
    strokePaths.push(`<path${nextAttrs}${closeToken}`);
    return match;
  });

  if (!strokePaths.length) return source;

  const strokeGroup = `<g id="${layerId}" data-layer-id="${layerId}" data-layer-label="${layerLabel}" data-layer-color="${strokeColor}" fill="none" stroke="${strokeColor}" stroke-width="${formatNumber(
    width,
  )}" stroke-linecap="round" stroke-linejoin="round">${strokePaths.join("")}</g>`;

  if (/<\/svg>\s*$/i.test(source)) {
    return source.replace(/<\/svg>\s*$/i, `${strokeGroup}</svg>`);
  }

  return source.replace(/<svg\b[^>]*>/i, (open) => `${open}${strokeGroup}`);
}

export function filterFillStrokePathTags(
  pathTags: string,
  viewport: FillStrokeViewport | null | undefined,
  options: { includeCanvasStroke?: boolean | null } = {},
): string {
  const safeViewport = normalizeViewport(viewport);
  return String(pathTags || "").replace(
    /<path\b([^>]*?)(\s*\/?)>/gi,
    (match, attrs = "") => {
      const rawAttrs = String(attrs || "");
      if (!options.includeCanvasStroke && isCanvasBackgroundPath(rawAttrs, safeViewport)) {
        return "";
      }
      if (isTraceArtifactPath(rawAttrs, safeViewport)) {
        return "";
      }
      return match;
    },
  );
}

export function filterLayeredTraceArtifactPaths(
  svg: string,
  options: LayeredTraceArtifactFilterOptions = {},
): string {
  const source = String(svg || "");
  const viewport = parseSvgViewport(source);
  if (!viewport) return source;
  const strokeColor = options.fillStrokeColor
    ? normalizeFillStrokeColor(options.fillStrokeColor)
    : undefined;

  return source.replace(/<path\b([^>]*?)(\s*\/?)>/gi, (match, attrs = "") => {
    const rawAttrs = String(attrs || "");
    if (rawAttrs.includes("data-post-processing=")) return match;
    if (isCanvasBackgroundPath(rawAttrs, viewport)) return match;
    return isTraceArtifactPath(rawAttrs, viewport, strokeColor) ? "" : match;
  });
}

function buildStrokePathAttrs(attrs: string): string {
  let nextAttrs = String(attrs || "");
  for (const name of [
    "id",
    "fill",
    "fill-opacity",
    "stroke",
    "stroke-width",
    "stroke-linejoin",
    "stroke-linecap",
    "stroke-opacity",
    "paint-order",
    "data-fill-spread",
    "data-fill-layer-id",
    "data-stroke-layer-id",
    "data-layer-id",
    "data-layer-label",
    "data-layer-color",
    "data-editor-opacity",
    "class",
  ]) {
    nextAttrs = removeAttribute(nextAttrs, name);
  }

  for (const property of [
    "fill",
    "fill-opacity",
    "stroke",
    "stroke-width",
    "stroke-linejoin",
    "stroke-linecap",
    "stroke-opacity",
    "paint-order",
  ]) {
    nextAttrs = rewriteStyleProperty(nextAttrs, property, null);
  }

  return nextAttrs.replace(/\s*\/\s*$/, "");
}

function readPaint(attrs: string, property: "fill" | "stroke"): string | null {
  return attrs.match(new RegExp(`\\s${property}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1]?.trim() || null;
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
  if (!styleMatch) return attrs;
  const quote = styleMatch[1];
  const declarations = styleMatch[2]
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !part.toLowerCase().startsWith(`${property.toLowerCase()}:`));
  if (value != null) declarations.push(`${property}: ${value}`);
  const replacement = declarations.length
    ? ` style=${quote}${declarations.join("; ")}${quote}`
    : "";
  return attrs.replace(styleMatch[0], replacement);
}

function removeAttribute(attrs: string, name: string): string {
  const pattern = new RegExp(`\\s${escapeRegExp(name)}\\s*=\\s*(["'])[^"']*\\1`, "gi");
  return attrs.replace(pattern, "");
}

function isEnabledFill(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized !== "none" &&
    normalized !== "transparent" &&
    normalized !== "currentcolor" &&
    normalized !== "inherit" &&
    !normalized.startsWith("url(")
  );
}

function parseSvgViewport(svg: string): FillStrokeViewport | null {
  const open = String(svg || "").match(/<svg\b([^>]*)>/i)?.[1] || "";
  const viewBox = open.match(/\bviewBox\s*=\s*(["'])([^"']+)\1/i)?.[2];
  if (viewBox) {
    const values = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter(Number.isFinite);
    if (values.length >= 4 && values[2] > 0 && values[3] > 0) {
      return { width: values[2], height: values[3] };
    }
  }

  const width = parseSvgLength(open.match(/\bwidth\s*=\s*(["'])([^"']+)\1/i)?.[2]);
  const height = parseSvgLength(open.match(/\bheight\s*=\s*(["'])([^"']+)\1/i)?.[2]);
  return normalizeViewport({ width, height });
}

function parseSvgLength(value: string | undefined): number {
  const match = String(value || "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function normalizeViewport(
  viewport: FillStrokeViewport | null | undefined,
): FillStrokeViewport | null {
  const width = Number(viewport?.width);
  const height = Number(viewport?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

function isCanvasBackgroundPath(
  attrs: string,
  viewport: FillStrokeViewport | null,
): boolean {
  if (!viewport) return false;
  const d = String(attrs || "").match(/\sd\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "";
  if (!d) return false;
  const bounds = measurePathBounds(d);
  if (!bounds) return false;

  const tolerance = Math.max(1, Math.max(viewport.width, viewport.height) * 0.01);
  const touchesCanvas =
    bounds.minX <= tolerance &&
    bounds.minY <= tolerance &&
    bounds.maxX >= viewport.width - tolerance &&
    bounds.maxY >= viewport.height - tolerance;
  if (!touchesCanvas) return false;

  const area = Math.max(0, bounds.maxX - bounds.minX) * Math.max(0, bounds.maxY - bounds.minY);
  const canvasArea = viewport.width * viewport.height || 1;
  return area / canvasArea >= 0.88;
}

function isTinyForegroundArtifactPath(
  attrs: string,
  viewport: FillStrokeViewport | null,
): boolean {
  if (!viewport) return false;
  const d = String(attrs || "").match(/\sd\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "";
  if (!d) return false;
  const bounds = measurePathBounds(d);
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

function isTraceArtifactPath(
  attrs: string,
  viewport: FillStrokeViewport | null,
  fillStrokeColor?: string,
): boolean {
  if (!viewport) return false;
  if (isTinyForegroundArtifactPath(attrs, viewport)) return true;
  return isSkinnyLayeredEdgeArtifactPath(attrs, viewport, fillStrokeColor);
}

function isSkinnyLayeredEdgeArtifactPath(
  attrs: string,
  viewport: FillStrokeViewport | null,
  fillStrokeColor?: string,
): boolean {
  if (!viewport) return false;
  const d = String(attrs || "").match(/\sd\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "";
  if (!d) return false;
  const bounds = measurePathBounds(d);
  if (!bounds) return false;

  const width = Math.max(0, bounds.maxX - bounds.minX);
  const height = Math.max(0, bounds.maxY - bounds.minY);
  const major = Math.max(width, height);
  const minor = Math.min(width, height);
  const boxArea = width * height;
  const canvasMax = Math.max(viewport.width, viewport.height);
  const canvasArea = Math.max(1, viewport.width * viewport.height);

  const minSliverLength = 6;
  const maxSliverLength = Math.max(72, canvasMax * 0.18);
  const maxSliverThickness = Math.max(3.5, canvasMax * 0.008);
  const maxSliverArea = Math.max(32, canvasArea * 0.00085);
  if (
    major < minSliverLength ||
    major > maxSliverLength ||
    minor > maxSliverThickness ||
    boxArea > maxSliverArea
  ) {
    return false;
  }

  const fill = readPaint(attrs, "fill") ?? readStyleProperty(attrs, "fill");
  if (!fill || !isEnabledFill(fill)) return false;
  const color = parseHexColor(fill);
  if (!color) return false;

  const saturation = colorSaturation(color);
  const lightness = colorLightness(color);
  const isBrightSaturatedAccent = saturation >= 42 && lightness >= 72;
  if (isBrightSaturatedAccent) return false;

  const aspectRatio = minor > 0 ? major / minor : Number.POSITIVE_INFINITY;
  const resemblesPaleHalo = lightness >= 220 && saturation <= 34;
  const minArtifactAspectRatio = resemblesPaleHalo ? 2.1 : 2.6;
  if (aspectRatio < minArtifactAspectRatio) {
    return false;
  }

  const resemblesStroke =
    lightness <= 90 ||
    (fillStrokeColor ? hexColorDistance(color, parseHexColor(fillStrokeColor)) <= 48 : false);
  const resemblesNeutralEdge = saturation <= 34;

  return resemblesStroke || resemblesPaleHalo || resemblesNeutralEdge;
}

type RgbColor = { r: number; g: number; b: number };

function parseHexColor(value: string | null | undefined): RgbColor | null {
  const text = String(value || "").trim().toLowerCase();
  const hex = /^#([0-9a-f]{6})$/.exec(text)?.[1];
  if (!hex) return null;
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function colorSaturation(color: RgbColor): number {
  return Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
}

function colorLightness(color: RgbColor): number {
  return (Math.max(color.r, color.g, color.b) + Math.min(color.r, color.g, color.b)) / 2;
}

function hexColorDistance(a: RgbColor, b: RgbColor | null): number {
  if (!b) return Number.POSITIVE_INFINITY;
  return Math.sqrt(
    (a.r - b.r) * (a.r - b.r) +
      (a.g - b.g) * (a.g - b.g) +
      (a.b - b.b) * (a.b - b.b),
  );
}

function measurePathBounds(pathData: string):
  | { minX: number; minY: number; maxX: number; maxY: number }
  | null {
  const values = (String(pathData || "").match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [])
    .map(Number)
    .filter(Number.isFinite);
  if (values.length < 4) return null;

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

function formatNumber(value: number): string {
  return String(Number(value.toFixed(3))).replace(/\.0+$/, "");
}

function sanitizeLayerId(value: string): string {
  const sanitized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || DEFAULT_LAYER_ID;
}

function escapeXmlAttr(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
