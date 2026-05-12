export type MeaningfulSvgStats = {
  bytes: number;
  pathCount: number;
  drawableCount: number;
  nonWhiteDrawableCount: number;
  viewBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  width?: number;
  height?: number;
};

export type MeaningfulSvgValidation = {
  ok: boolean;
  reasons: string[];
  stats: MeaningfulSvgStats;
};

export type MeaningfulSvgValidationOptions = {
  minBytes?: number;
  allowWhiteOnly?: boolean;
};

const DRAWABLE_TAG_PATTERN =
  /<(path|polygon|polyline|rect|circle|ellipse|line|text|image)\b([^>]*)>/gi;

export function validateMeaningfulSvgOutput(
  svg: string,
  options: MeaningfulSvgValidationOptions = {},
): MeaningfulSvgValidation {
  const source = String(svg || "");
  const minBytes = Math.max(1, Math.round(options.minBytes ?? 96));
  const allowWhiteOnly = options.allowWhiteOnly ?? true;
  const bytes = byteLength(source);
  const reasons: string[] = [];
  const viewBox = parseViewBox(source);
  const width = parseSvgDimension(source, "width");
  const height = parseSvgDimension(source, "height");
  const stats: MeaningfulSvgStats = {
    bytes,
    pathCount: (source.match(/<path\b/gi) || []).length,
    drawableCount: 0,
    nonWhiteDrawableCount: 0,
    viewBox,
    width,
    height,
  };

  if (!source.trim()) reasons.push("missing SVG output");
  if (!/<svg\b/i.test(source)) reasons.push("missing <svg> root");
  if (bytes < minBytes) reasons.push(`SVG is suspiciously small (${bytes} bytes)`);
  if (/<script\b|on\w+\s*=|javascript:/i.test(source)) {
    reasons.push("SVG contains unsafe markup");
  }

  if (viewBox) {
    if (viewBox.width <= 0 || viewBox.height <= 0) {
      reasons.push("SVG viewBox has zero area");
    }
  } else if (!width || !height || width <= 0 || height <= 0) {
    reasons.push("SVG has no usable dimensions or viewBox");
  }

  let visibleDrawableCount = 0;
  let nonWhiteDrawableCount = 0;
  for (const match of source.matchAll(DRAWABLE_TAG_PATTERN)) {
    const tagName = String(match[1] || "").toLowerCase();
    const attrs = String(match[2] || "");
    if (!isVisibleDrawable(tagName, attrs)) continue;
    visibleDrawableCount += 1;
    if (hasNonWhiteVisiblePaint(tagName, attrs)) {
      nonWhiteDrawableCount += 1;
    }
  }
  stats.drawableCount = visibleDrawableCount;
  stats.nonWhiteDrawableCount = nonWhiteDrawableCount;
  if (visibleDrawableCount === 0) {
    reasons.push("SVG has no visible drawable elements");
  } else if (!allowWhiteOnly && nonWhiteDrawableCount === 0) {
    reasons.push("SVG only has white or transparent visible paint");
  }

  return {
    ok: reasons.length === 0,
    reasons,
    stats,
  };
}

function isVisibleDrawable(tagName: string, attrs: string) {
  const source = String(attrs || "");
  if (/\sdisplay\s*=\s*["']none["']/i.test(source)) return false;
  if (/\svisibility\s*=\s*["']hidden["']/i.test(source)) return false;
  if (/\sopacity\s*=\s*["'](?:0|0\.0+)["']/i.test(source)) return false;
  if (/\sfill-opacity\s*=\s*["'](?:0|0\.0+)["']/i.test(source)) return false;
  if (/\sstroke-opacity\s*=\s*["'](?:0|0\.0+)["']/i.test(source)) return false;
  if (/style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0)(?:\D|$)/i.test(source)) {
    return false;
  }
  if (tagName === "path" && !/\sd\s*=\s*(["'])(?!\s*\1)[\s\S]*?\1/i.test(source)) {
    return false;
  }
  if (tagName === "image" && !/\shref\s*=|\sxlink:href\s*=/i.test(source)) {
    return false;
  }
  if (!hasVisiblePaint(tagName, source)) return false;
  return true;
}

function hasVisiblePaint(tagName: string, attrs: string) {
  if (tagName === "image") return true;
  const fill = getPaintValue(attrs, "fill");
  const stroke = getPaintValue(attrs, "stroke");
  const visibleStroke = Boolean(stroke && !isInvisiblePaint(stroke));
  if (tagName === "line") return visibleStroke;
  const visibleFill = fill ? !isInvisiblePaint(fill) : true;
  return visibleFill || visibleStroke;
}

function hasNonWhiteVisiblePaint(tagName: string, attrs: string) {
  if (tagName === "image") return true;
  const fill = getPaintValue(attrs, "fill");
  const stroke = getPaintValue(attrs, "stroke");
  if (stroke && !isInvisiblePaint(stroke) && !isWhitePaint(stroke)) return true;
  if (tagName === "line") return false;
  if (!fill) return true;
  return !isInvisiblePaint(fill) && !isWhitePaint(fill);
}

function getPaintValue(attrs: string, name: "fill" | "stroke") {
  const attr = attrs.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
  if (attr) return attr.trim();
  const style = attrs.match(/\sstyle\s*=\s*["']([^"']+)["']/i)?.[1] || "";
  return style.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "i"))?.[1]?.trim();
}

function isInvisiblePaint(value: string) {
  const normalized = normalizePaint(value);
  return normalized === "none" || normalized === "transparent" || normalized === "rgba(0,0,0,0)";
}

function isWhitePaint(value: string) {
  const normalized = normalizePaint(value);
  return (
    normalized === "white" ||
    normalized === "#fff" ||
    normalized === "#ffffff" ||
    normalized === "rgb(255,255,255)" ||
    normalized === "rgba(255,255,255,1)"
  );
}

function normalizePaint(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^#ffffffff$/, "#ffffff");
}

function parseViewBox(svg: string): MeaningfulSvgStats["viewBox"] {
  const raw = svg.match(/\sviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!raw) return undefined;
  const parts = raw.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return undefined;
  }
  return {
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3],
  };
}

function parseSvgDimension(svg: string, name: "width" | "height") {
  const raw = svg.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
  if (!raw || /%$/.test(raw.trim())) return undefined;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function byteLength(value: string) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).byteLength;
  }
  return unescape(encodeURIComponent(value)).length;
}
