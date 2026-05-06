export type FillStrokeSvgOptions = {
  fillStrokeWidth?: number | null;
  fillStrokeColor?: string | null;
  layerId?: string;
  layerLabel?: string;
};

const DEFAULT_STROKE_COLOR = "#020617";
const DEFAULT_LAYER_ID = "fill-stroke-outline";
const DEFAULT_LAYER_LABEL = "Stroke outline";

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
  const strokePaths: string[] = [];

  source.replace(/<path\b([^>]*?)(\s*\/?)>/gi, (match, attrs = "", close = "") => {
    const rawAttrs = String(attrs || "");
    const fill = readPaint(rawAttrs, "fill") ?? readStyleProperty(rawAttrs, "fill");
    if (!fill || !isEnabledFill(fill)) return match;
    if (!/\sd\s*=\s*(["'])(?!\s*\1)[\s\S]*?\1/i.test(rawAttrs)) return match;

    const nextAttrs = buildStrokePathAttrs(rawAttrs);
    const closeToken = String(close || "").includes("/") ? " />" : ">";
    strokePaths.push(`<path${nextAttrs}${closeToken}`);
    return match;
  });

  if (!strokePaths.length) return source;

  const strokeGroup = `<g id="${layerId}" data-layer-id="${layerId}" data-layer-label="${layerLabel}" data-layer-color="${strokeColor}" fill="none" stroke="${strokeColor}" stroke-width="${formatNumber(
    width,
  )}" stroke-linecap="round" stroke-linejoin="round">${strokePaths.join("")}</g>`;

  return source.replace(/<svg\b[^>]*>/i, (open) => `${open}${strokeGroup}`);
}

function buildStrokePathAttrs(attrs: string): string {
  let nextAttrs = String(attrs || "");
  for (const name of [
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
