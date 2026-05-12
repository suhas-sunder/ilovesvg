const DRAWABLE_TAG_PATTERN =
  /<(path|polygon|polyline|rect|circle|ellipse|line|text|image)\b([^>]*)>/gi;

export function validateMeaningfulSvgOutput(text, options = {}) {
  const sourceText = String(text || "");
  const svg = extractPrimarySvg(sourceText);
  const minBytes = Math.max(1, Math.round(options.minBytes ?? 96));
  const reasons = [];
  const stats = {
    svgBytes: Buffer.byteLength(svg || "", "utf8"),
    pathCount: (svg.match(/<path\b/gi) || []).length,
    drawableCount: 0,
    nonWhiteDrawableCount: 0,
    pathTagsCount: countLayerPathTags(sourceText),
    layerPathTagsWithPaths: countLayerPathTagsWithPaths(sourceText),
    viewBox: parseViewBox(svg),
    width: parseSvgDimension(svg, "width"),
    height: parseSvgDimension(svg, "height"),
  };

  if (!svg.trim()) reasons.push("missing SVG output");
  if (svg && stats.svgBytes < minBytes) reasons.push(`SVG is suspiciously small (${stats.svgBytes} bytes)`);
  if (/<script\b|on\w+\s*=|javascript:/i.test(svg)) reasons.push("SVG contains unsafe markup");

  if (stats.viewBox) {
    if (stats.viewBox.width <= 0 || stats.viewBox.height <= 0) {
      reasons.push("SVG viewBox has zero area");
    }
  } else if (!stats.width || !stats.height || stats.width <= 0 || stats.height <= 0) {
    reasons.push("SVG has no usable dimensions or viewBox");
  }

  let drawableCount = 0;
  let nonWhiteDrawableCount = 0;
  for (const match of svg.matchAll(DRAWABLE_TAG_PATTERN)) {
    const tagName = match[1];
    const attrs = match[2] || "";
    if (!isVisibleDrawable(tagName, attrs)) continue;
    drawableCount += 1;
    if (hasNonWhiteVisiblePaint(tagName, attrs)) {
      nonWhiteDrawableCount += 1;
    }
  }
  stats.drawableCount = drawableCount;
  stats.nonWhiteDrawableCount = nonWhiteDrawableCount;
  if (drawableCount === 0) reasons.push("SVG has no visible drawable elements");
  else if (!options.allowWhiteOnly && nonWhiteDrawableCount === 0) {
    reasons.push("SVG only has white or transparent visible paint");
  }

  if (options.expectLayers) {
    if (!/"layers"/.test(sourceText)) reasons.push("missing layered metadata");
    if (stats.layerPathTagsWithPaths === 0) {
      reasons.push("layered metadata has no drawable pathTags for preview, copy, and download");
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    stats,
    svg,
  };
}

export function extractPrimarySvg(text) {
  const source = String(text || "");
  const svgs = source.match(/<svg\b[\s\S]*?<\/svg>/gi) || [];
  if (svgs.length === 0) return "";
  const svg = svgs.reduce((largest, current) =>
    Buffer.byteLength(current, "utf8") > Buffer.byteLength(largest, "utf8") ? current : largest,
  );
  return decodeSerializedSvg(svg);
}

function decodeSerializedSvg(svg) {
  return String(svg || "")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\//g, "/");
}

function countLayerPathTags(text) {
  return (String(text || "").match(/"pathTags"/g) || []).length;
}

function countLayerPathTagsWithPaths(text) {
  const source = String(text || "");
  let count = 0;
  for (const match of source.matchAll(/"pathTags"\s*(?::|,)\s*"((?:\\.|[^"])*)"/g)) {
    const value = match[1] || "";
    if (/<path\b/i.test(value.replace(/\\"/g, '"'))) count += 1;
  }
  return count;
}

function isVisibleDrawable(tagName, attrs) {
  const tag = String(tagName || "").toLowerCase();
  const source = String(attrs || "");
  if (/\sdisplay\s*=\s*["']none["']/i.test(source)) return false;
  if (/\svisibility\s*=\s*["']hidden["']/i.test(source)) return false;
  if (/\sopacity\s*=\s*["'](?:0|0\.0+)["']/i.test(source)) return false;
  if (/\sfill-opacity\s*=\s*["'](?:0|0\.0+)["']/i.test(source)) return false;
  if (/\sstroke-opacity\s*=\s*["'](?:0|0\.0+)["']/i.test(source)) return false;
  if (/style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0)(?:\D|$)/i.test(source)) {
    return false;
  }
  if (tag === "path" && !/\sd\s*=\s*(["'])(?!\s*\1)[\s\S]*?\1/i.test(source)) {
    return false;
  }
  if (tag === "image" && !/\shref\s*=|\sxlink:href\s*=/i.test(source)) {
    return false;
  }
  if (!hasVisiblePaint(tag, source)) return false;
  return true;
}

function hasVisiblePaint(tagName, attrs) {
  if (tagName === "image") return true;
  const fill = getPaintValue(attrs, "fill");
  const stroke = getPaintValue(attrs, "stroke");
  const visibleStroke = Boolean(stroke && !isInvisiblePaint(stroke));
  if (tagName === "line") return visibleStroke;
  const visibleFill = fill ? !isInvisiblePaint(fill) : true;
  return visibleFill || visibleStroke;
}

function hasNonWhiteVisiblePaint(tagName, attrs) {
  if (tagName === "image") return true;
  const fill = getPaintValue(attrs, "fill");
  const stroke = getPaintValue(attrs, "stroke");
  if (stroke && !isInvisiblePaint(stroke) && !isWhitePaint(stroke)) return true;
  if (tagName === "line") return false;
  if (!fill) return true;
  return !isInvisiblePaint(fill) && !isWhitePaint(fill);
}

function getPaintValue(attrs, name) {
  const attr = String(attrs || "").match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
  if (attr) return attr.trim();
  const style = String(attrs || "").match(/\sstyle\s*=\s*["']([^"']+)["']/i)?.[1] || "";
  return style.match(new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, "i"))?.[1]?.trim();
}

function isInvisiblePaint(value) {
  const normalized = normalizePaint(value);
  return normalized === "none" || normalized === "transparent" || normalized === "rgba(0,0,0,0)";
}

function isWhitePaint(value) {
  const normalized = normalizePaint(value);
  return (
    normalized === "white" ||
    normalized === "#fff" ||
    normalized === "#ffffff" ||
    normalized === "rgb(255,255,255)" ||
    normalized === "rgba(255,255,255,1)"
  );
}

function normalizePaint(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^#ffffffff$/, "#ffffff");
}

function parseViewBox(svg) {
  const raw = String(svg || "").match(/\sviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  if (!raw) return null;
  const parts = raw.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  return {
    x: parts[0],
    y: parts[1],
    width: parts[2],
    height: parts[3],
  };
}

function parseSvgDimension(svg, name) {
  const raw = String(svg || "").match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
  if (!raw || /%$/.test(raw.trim())) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
