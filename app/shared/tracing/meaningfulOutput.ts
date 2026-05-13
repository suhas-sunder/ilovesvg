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
  const classPaints = collectClassPaints(source);

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
    if (!isVisibleDrawable(tagName, attrs, classPaints)) continue;
    visibleDrawableCount += 1;
    if (hasNonWhiteVisiblePaint(tagName, attrs, classPaints)) {
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

type CssPaint = Partial<Record<"display" | "visibility" | "opacity" | "fill" | "stroke" | "fill-opacity" | "stroke-opacity", string>>;

function isVisibleDrawable(tagName: string, attrs: string, classPaints: Map<string, CssPaint>) {
  const source = String(attrs || "");
  const cssPaint = getClassPaint(source, classPaints);
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
  if (isCssPaintHidden(cssPaint)) return false;
  if (!hasVisiblePaint(tagName, source, cssPaint)) return false;
  return true;
}

function hasVisiblePaint(tagName: string, attrs: string, cssPaint?: CssPaint) {
  if (tagName === "image") return true;
  const fill = getPaintValue(attrs, "fill", cssPaint);
  const stroke = getPaintValue(attrs, "stroke", cssPaint);
  const visibleStroke = Boolean(stroke && !isInvisiblePaint(stroke));
  if (tagName === "line") return visibleStroke;
  const visibleFill = fill ? !isInvisiblePaint(fill) : true;
  return visibleFill || visibleStroke;
}

function hasNonWhiteVisiblePaint(tagName: string, attrs: string, classPaints: Map<string, CssPaint>) {
  if (tagName === "image") return true;
  const cssPaint = getClassPaint(attrs, classPaints);
  const fill = getPaintValue(attrs, "fill", cssPaint);
  const stroke = getPaintValue(attrs, "stroke", cssPaint);
  if (stroke && !isInvisiblePaint(stroke) && !isWhitePaint(stroke)) return true;
  if (tagName === "line") return false;
  if (!fill) return true;
  return !isInvisiblePaint(fill) && !isWhitePaint(fill);
}

function getPaintValue(attrs: string, name: "fill" | "stroke", cssPaint?: CssPaint) {
  const style = attrs.match(/\sstyle\s*=\s*["']([^"']+)["']/i)?.[1] || "";
  const inline = style.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "i"))?.[1]?.trim();
  if (inline) return inline;
  const css = cssPaint?.[name]?.trim();
  if (css) return css;
  return attrs.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1]?.trim();
}

function collectClassPaints(svg: string) {
  const classPaints = new Map<string, CssPaint>();
  for (const styleMatch of String(svg || "").matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = String(styleMatch[1] || "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of css.matchAll(/\.([A-Za-z_][\w:-]*)\s*\{([^}]*)\}/g)) {
      const className = rule[1];
      const declarations = parseCssPaintDeclarations(rule[2] || "");
      if (Object.keys(declarations).length === 0) continue;
      classPaints.set(className, { ...(classPaints.get(className) || {}), ...declarations });
    }
  }
  return classPaints;
}

function parseCssPaintDeclarations(block: string): CssPaint {
  const declarations: CssPaint = {};
  for (const declaration of String(block || "").split(";")) {
    const [rawName, ...rawValueParts] = declaration.split(":");
    const name = rawName?.trim().toLowerCase() as keyof CssPaint;
    const value = rawValueParts.join(":").trim();
    if (!value) continue;
    if (
      name === "display" ||
      name === "visibility" ||
      name === "opacity" ||
      name === "fill" ||
      name === "stroke" ||
      name === "fill-opacity" ||
      name === "stroke-opacity"
    ) {
      declarations[name] = value;
    }
  }
  return declarations;
}

function getClassPaint(attrs: string, classPaints: Map<string, CssPaint>): CssPaint | undefined {
  const classValue = String(attrs || "").match(/\sclass\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!classValue) return undefined;
  const merged: CssPaint = {};
  for (const className of classValue.split(/\s+/)) {
    Object.assign(merged, classPaints.get(className));
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function isCssPaintHidden(cssPaint?: CssPaint) {
  if (!cssPaint) return false;
  if (cssPaint.display?.trim().toLowerCase() === "none") return true;
  if (cssPaint.visibility?.trim().toLowerCase() === "hidden") return true;
  if (isZeroOpacity(cssPaint.opacity)) return true;
  if (isZeroOpacity(cssPaint["fill-opacity"]) && !cssPaint.stroke) return true;
  if (isZeroOpacity(cssPaint["stroke-opacity"]) && !cssPaint.fill) return true;
  return false;
}

function isZeroOpacity(value?: string) {
  return /^(?:0|0\.0+)$/.test(String(value || "").trim());
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
