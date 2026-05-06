export type OutputAppearanceSettings = {
  lineWeight: number;
  fillSpread: number;
  nonScalingStroke: boolean;
};

export type OutputAppearanceSupport = {
  supportsLineWeight: boolean;
  supportsFillSpread: boolean;
  hasStroke: boolean;
  hasFill: boolean;
  fillSpreadDisabledReason?: string;
};

export const DEFAULT_OUTPUT_APPEARANCE: OutputAppearanceSettings = {
  lineWeight: 1,
  fillSpread: 0,
  nonScalingStroke: false,
};

const PAINTABLE_TAG_PATTERN =
  /<(path|line|polyline|polygon|rect|circle|ellipse|g)\b([^>]*?)(\/?)>/gi;
const LINE_WEIGHT_MIN = 0.25;
const LINE_WEIGHT_MAX = 30;
const FILL_SPREAD_MIN = 0;
const FILL_SPREAD_MAX = 30;

export function normalizeOutputAppearance(
  settings?: Partial<OutputAppearanceSettings> | null,
): OutputAppearanceSettings {
  return {
    lineWeight: clampNumber(
      settings?.lineWeight ?? DEFAULT_OUTPUT_APPEARANCE.lineWeight,
      LINE_WEIGHT_MIN,
      LINE_WEIGHT_MAX,
    ),
    fillSpread: clampNumber(
      settings?.fillSpread ?? DEFAULT_OUTPUT_APPEARANCE.fillSpread,
      FILL_SPREAD_MIN,
      FILL_SPREAD_MAX,
    ),
    nonScalingStroke: Boolean(settings?.nonScalingStroke),
  };
}

export function hasOutputAppearanceChanges(
  settings?: Partial<OutputAppearanceSettings> | null,
): boolean {
  const normalized = normalizeOutputAppearance(settings);
  return (
    Math.abs(normalized.lineWeight - 1) > 0.001 ||
    normalized.fillSpread > 0.001 ||
    normalized.nonScalingStroke
  );
}

export function detectOutputAppearanceSupport(
  svg: string,
  options?: { precisionOutput?: boolean },
): OutputAppearanceSupport {
  const source = String(svg || "");
  const hasStroke =
    /\bstroke\s*=\s*["'](?!none\b|transparent\b)[^"']+["']/i.test(source) ||
    /\bstroke-width\s*=\s*["'][^"']+["']/i.test(source) ||
    /\bstroke\s*:\s*(?!none\b|transparent\b)[^;"']+/i.test(source);
  const hasFill =
    /\bfill\s*=\s*["'](?!none\b|transparent\b)[^"']+["']/i.test(source) ||
    /\bfill\s*:\s*(?!none\b|transparent\b)[^;"']+/i.test(source);
  const precisionOutput = Boolean(options?.precisionOutput);

  return {
    supportsLineWeight: hasStroke,
    supportsFillSpread: hasFill && !precisionOutput,
    hasStroke,
    hasFill,
    fillSpreadDisabledReason: precisionOutput
      ? "Fill spread is disabled for precision cut outputs."
      : hasFill
        ? undefined
        : "Fill spread needs filled SVG regions.",
  };
}

export function applyOutputAppearanceToSvg(
  svg: string,
  settings?: Partial<OutputAppearanceSettings> | null,
  support?: OutputAppearanceSupport,
): string {
  const normalized = normalizeOutputAppearance(settings);
  const detected = support ?? detectOutputAppearanceSupport(svg);
  let out = String(svg || "");

  if (
    detected.supportsLineWeight &&
    (Math.abs(normalized.lineWeight - 1) > 0.001 ||
      normalized.nonScalingStroke)
  ) {
    out = applyLineWeight(out, normalized);
  }

  if (detected.supportsFillSpread && normalized.fillSpread > 0.001) {
    out = applyFillSpread(out, normalized.fillSpread);
  }

  return out;
}

function applyLineWeight(
  svg: string,
  settings: OutputAppearanceSettings,
): string {
  return svg.replace(PAINTABLE_TAG_PATTERN, (match, tagName, attrs, slash) => {
    const rawAttrs = String(attrs || "");
    const stroke = readPaint(rawAttrs, "stroke");
    const hasStroke =
      (stroke != null && isPaintEnabled(stroke)) ||
      readStyleProperty(rawAttrs, "stroke") != null ||
      readNumericPaintWidth(rawAttrs) != null;
    if (!hasStroke) return match;

    const baseWidth = readNumericPaintWidth(rawAttrs) ?? 1;
    const width = Math.max(0.01, baseWidth * settings.lineWeight);
    let nextAttrs = removeAttribute(rawAttrs, "stroke-width");
    nextAttrs = rewriteStyleProperty(nextAttrs, "stroke-width", null);
    nextAttrs = `${nextAttrs} stroke-width="${formatNumber(width)}"`;

    if (settings.nonScalingStroke) {
      nextAttrs = removeAttribute(nextAttrs, "vector-effect");
      nextAttrs = `${nextAttrs} vector-effect="non-scaling-stroke"`;
    }

    return `<${tagName}${nextAttrs}${slash || ""}>`;
  });
}

function applyFillSpread(svg: string, spreadPx: number): string {
  const spread = formatNumber(spreadPx);
  return svg.replace(PAINTABLE_TAG_PATTERN, (match, tagName, attrs, slash) => {
    const rawAttrs = String(attrs || "");
    const fill = readPaint(rawAttrs, "fill") ?? readStyleProperty(rawAttrs, "fill");
    if (!fill || !isPaintEnabled(fill)) return match;

    const stroke =
      readPaint(rawAttrs, "stroke") ?? readStyleProperty(rawAttrs, "stroke");
    if (stroke && isPaintEnabled(stroke) && !samePaint(stroke, fill)) {
      return match;
    }

    let nextAttrs = removeAttribute(rawAttrs, "stroke");
    nextAttrs = removeAttribute(nextAttrs, "stroke-width");
    nextAttrs = removeAttribute(nextAttrs, "stroke-linejoin");
    nextAttrs = removeAttribute(nextAttrs, "stroke-linecap");
    nextAttrs = removeAttribute(nextAttrs, "paint-order");
    nextAttrs = removeAttribute(nextAttrs, "data-fill-spread");
    nextAttrs = rewriteStyleProperty(nextAttrs, "stroke", null);
    nextAttrs = rewriteStyleProperty(nextAttrs, "stroke-width", null);
    nextAttrs = rewriteStyleProperty(nextAttrs, "stroke-linejoin", null);
    nextAttrs = rewriteStyleProperty(nextAttrs, "stroke-linecap", null);
    nextAttrs = rewriteStyleProperty(nextAttrs, "paint-order", null);

    nextAttrs = `${nextAttrs} stroke="${escapeSvgAttribute(fill)}" stroke-width="${spread}" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke fill markers" data-fill-spread="${spread}"`;
    return `<${tagName}${nextAttrs}${slash || ""}>`;
  });
}

function readPaint(attrs: string, property: "fill" | "stroke"): string | null {
  const match = attrs.match(
    new RegExp(`\\s${property}\\s*=\\s*["']([^"']+)["']`, "i"),
  );
  return match?.[1]?.trim() || null;
}

function readNumericPaintWidth(attrs: string): number | null {
  const direct = attrs.match(/\sstroke-width\s*=\s*["']([^"']+)["']/i)?.[1];
  const styled = readStyleProperty(attrs, "stroke-width");
  const parsed = parseSvgNumber(direct ?? styled ?? "");
  return parsed == null || parsed <= 0 ? null : parsed;
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
  if (!styleMatch) {
    if (value == null) return attrs;
    return `${attrs} style="${property}:${escapeSvgAttribute(value)}"`;
  }

  const quote = styleMatch[1];
  const styleBody = styleMatch[2];
  const parts = styleBody
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !new RegExp(`^${escapeRegExp(property)}\\s*:`, "i").test(part));

  if (value != null) parts.push(`${property}:${value}`);

  if (parts.length === 0) {
    return attrs.replace(/\sstyle\s*=\s*(["'])[^"']*\1/i, "");
  }

  return attrs.replace(
    /\bstyle\s*=\s*(["'])[^"']*\1/i,
    `style=${quote}${parts.join("; ")}${quote}`,
  );
}

function removeAttribute(attrs: string, attribute: string): string {
  return attrs.replace(
    new RegExp(`\\s${escapeRegExp(attribute)}\\s*=\\s*["'][^"']*["']`, "gi"),
    "",
  );
}

function isPaintEnabled(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return Boolean(
    normalized &&
      normalized !== "none" &&
      normalized !== "transparent" &&
      normalized !== "rgba(0,0,0,0)" &&
      normalized !== "rgba(0, 0, 0, 0)",
  );
}

function samePaint(a: string, b: string): boolean {
  return normalizePaint(a) === normalizePaint(b);
}

function normalizePaint(value: string): string {
  const trimmed = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [, r, g, b] = trimmed.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i) || [];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return trimmed.replace(/\s+/g, "");
}

function parseSvgNumber(value: string): number | null {
  const match = String(value || "").trim().match(/^(-?\d*\.?\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampNumber(value: number, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function formatNumber(value: number): string {
  return Number(value)
    .toFixed(3)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeSvgAttribute(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
