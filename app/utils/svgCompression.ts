export type SvgCompressionLevel = "none" | "tiny" | "tiniest";

export type SvgCompressionOptions = {
  level: SvgCompressionLevel;
};

export type SvgCompressionResult = {
  svg: string;
  level: SvgCompressionLevel;
  originalBytes: number;
  outputBytes: number;
  savedBytes: number;
  savedPercent: number;
  appliedTransforms: string[];
  warnings: string[];
};

type RootDimensions = {
  width: string;
  height: string;
  viewBox: string;
};

const EDITOR_DATA_ATTRS = [
  "data-editor-opacity",
  "data-layer-label",
  "data-layer-color",
  "data-layer-id",
  "data-fill-layer-id",
  "data-stroke-layer-id",
];

const GEOMETRY_ATTRS = [
  "d",
  "points",
  "transform",
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "stroke-width",
];

export function compressSvg(
  svgText: string,
  options: SvgCompressionOptions,
): SvgCompressionResult {
  const originalSvg = String(svgText ?? "");
  validateSvg(originalSvg);

  const level = options.level;
  const originalBytes = getSvgByteSize(originalSvg);
  const originalDimensions = readRootDimensions(originalSvg);
  const appliedTransforms: string[] = [];
  const warnings: string[] = [];

  let svg = originalSvg;

  if (level === "none") {
    return buildResult({
      originalSvg,
      svg,
      level,
      originalBytes,
      appliedTransforms,
      warnings,
    });
  }

  svg = applyTransform(svg, "strip XML declaration", appliedTransforms, (input) =>
    input.replace(/^\uFEFF?\s*<\?xml[\s\S]*?\?>\s*/i, ""),
  );
  svg = applyTransform(svg, "strip DOCTYPE", appliedTransforms, (input) =>
    input
      .replace(/^\s*<!DOCTYPE[\s\S]*?>\s*/i, "")
      .replace(/<!DOCTYPE[\s\S]*?>/gi, ""),
  );
  svg = applyTransform(svg, "remove comments", appliedTransforms, (input) =>
    input.replace(/<!--[\s\S]*?-->/g, ""),
  );
  svg = applyTransform(svg, "remove metadata", appliedTransforms, (input) =>
    input.replace(/<metadata\b[\s\S]*?<\/metadata>/gi, ""),
  );
  svg = applyTransform(
    svg,
    "remove editor namespaces and attributes",
    appliedTransforms,
    removeEditorNamespacesAndAttrs,
  );
  svg = applyTransform(svg, "minify style attributes", appliedTransforms, minifyStyleAttributes);
  svg = applyTransform(svg, "minify transform spacing", appliedTransforms, (input) =>
    minifyAttributeValue(input, "transform", minifyTransformValue),
  );
  svg = applyTransform(svg, "minify points spacing", appliedTransforms, (input) =>
    minifyAttributeValue(input, "points", minifyPointsValue),
  );
  svg = applyTransform(svg, "minify path spacing", appliedTransforms, (input) =>
    minifyAttributeValue(input, "d", minifyPathDataValue),
  );
  svg = applyTransform(svg, "remove empty attributes", appliedTransforms, removeEmptyAttrs);
  svg = applyTransform(svg, "collapse tag whitespace", appliedTransforms, collapseTagWhitespace);
  svg = applyTransform(svg, "remove empty containers", appliedTransforms, removeEmptyContainers);
  svg = applyTransform(
    svg,
    "remove unused defs conservatively",
    appliedTransforms,
    (input) => removeUnusedDefsBestEffort(input, warnings),
  );
  svg = applyTransform(svg, "trim output", appliedTransforms, (input) => input.trim());

  if (level === "tiniest") {
    svg = applyTransform(svg, "round geometry to 2 decimals", appliedTransforms, (input) =>
      roundGeometryValues(input, 2),
    );
    svg = applyTransform(svg, "cleanup IDs with references", appliedTransforms, (input) =>
      cleanupIdsBestEffort(input, warnings),
    );
    const beforeEditorStrip = svg;
    svg = stripExportOnlyEditorData(svg);
    if (svg !== beforeEditorStrip) {
      appliedTransforms.push("strip export-only editor metadata");
      warnings.push(
        "Tiniest removed converter editor metadata; use Tiny if this SVG needs future layer editing.",
      );
    }
    svg = applyTransform(svg, "final whitespace cleanup", appliedTransforms, collapseTagWhitespace);
  }

  warnIfRootDimensionsChanged(originalDimensions, readRootDimensions(svg), warnings);
  validateSvg(svg);

  return buildResult({
    originalSvg,
    svg,
    level,
    originalBytes,
    appliedTransforms,
    warnings,
  });
}

export function getSvgByteSize(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(String(value)).length;
  }
  return unescape(encodeURIComponent(String(value))).length;
}

function buildResult({
  originalSvg,
  svg,
  level,
  originalBytes,
  appliedTransforms,
  warnings,
}: {
  originalSvg: string;
  svg: string;
  level: SvgCompressionLevel;
  originalBytes: number;
  appliedTransforms: string[];
  warnings: string[];
}): SvgCompressionResult {
  const outputBytes = getSvgByteSize(svg);
  const savedBytes = originalBytes - outputBytes;
  return {
    svg,
    level,
    originalBytes,
    outputBytes,
    savedBytes,
    savedPercent:
      originalBytes > 0
        ? Number(((savedBytes / originalBytes) * 100).toFixed(2))
        : 0,
    appliedTransforms: [...new Set(appliedTransforms)],
    warnings: [...new Set(warnings)],
  };
}

function validateSvg(svg: string) {
  if (!/<svg\b[^>]*>/i.test(svg) || !/<\/svg\s*>/i.test(svg)) {
    throw new Error("Could not find a complete <svg>...</svg> document.");
  }
}

function applyTransform(
  svg: string,
  label: string,
  appliedTransforms: string[],
  transform: (input: string) => string,
) {
  const next = transform(svg);
  if (next !== svg) {
    appliedTransforms.push(label);
  }
  return next;
}

function readRootDimensions(svg: string): RootDimensions {
  const open = String(svg).match(/<svg\b[^>]*>/i)?.[0] ?? "";
  return {
    width: readAttr(open, "width"),
    height: readAttr(open, "height"),
    viewBox: readAttr(open, "viewBox"),
  };
}

function readAttr(tag: string, name: string): string {
  return (
    tag.match(new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ??
    ""
  );
}

function warnIfRootDimensionsChanged(
  before: RootDimensions,
  after: RootDimensions,
  warnings: string[],
) {
  if (before.width !== after.width || before.height !== after.height) {
    warnings.push("Root width/height changed unexpectedly.");
  }
  if (before.viewBox !== after.viewBox) {
    warnings.push("Root viewBox changed unexpectedly.");
  }
}

function removeEditorNamespacesAndAttrs(svg: string) {
  return svg
    .replace(/\sxmlns:(?:inkscape|sodipodi|cc|dc|rdf)\s*=\s*["'][^"']*["']/gi, "")
    .replace(
      /\s(?:inkscape|sodipodi):[A-Za-z0-9_.:-]+\s*=\s*["'][^"']*["']/gi,
      "",
    )
    .replace(/\senable-background\s*=\s*["'][^"']*["']/gi, "");
}

function minifyStyleAttributes(svg: string) {
  return svg.replace(
    /\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi,
    (_match, full, doubleValue, singleValue) => {
      const quote = String(full).startsWith("'") ? "'" : '"';
      const value = String(doubleValue ?? singleValue ?? "");
      const cleaned = value
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) =>
          part
            .replace(/\s*:\s*/g, ":")
            .replace(/\s*,\s*/g, ",")
            .replace(/\s+/g, " "),
        )
        .join(";");
      return cleaned ? ` style=${quote}${escapeAttr(cleaned, quote)}${quote}` : "";
    },
  );
}

function minifyAttributeValue(
  svg: string,
  attrName: string,
  mapper: (value: string) => string,
) {
  return svg.replace(
    new RegExp(`\\s${escapeRegExp(attrName)}\\s*=\\s*("([^"]*)"|'([^']*)')`, "gi"),
    (match, full, doubleValue, singleValue) => {
      const quote = String(full).startsWith("'") ? "'" : '"';
      const value = String(doubleValue ?? singleValue ?? "");
      const cleaned = mapper(value);
      return cleaned ? ` ${attrName}=${quote}${escapeAttr(cleaned, quote)}${quote}` : match;
    },
  );
}

function minifyTransformValue(input: string) {
  return String(input)
    .trim()
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")")
    .replace(/,/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\)\s+(?=[a-zA-Z])/g, ") ")
    .trim();
}

function minifyPointsValue(input: string) {
  return String(input)
    .trim()
    .replace(/[\n\r\t]+/g, " ")
    .replace(/,/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function minifyPathDataValue(input: string) {
  return String(input)
    .trim()
    .replace(/[\n\r\t]+/g, " ")
    .replace(/,/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\s+([a-zA-Z])/g, "$1")
    .replace(/(\d)\s+(-)/g, "$1$2")
    .replace(/(\d)\s+(\.)/g, "$1$2")
    .trim();
}

function removeEmptyAttrs(svg: string) {
  return svg.replace(/\s[A-Za-z_:][A-Za-z0-9_.:-]*\s*=\s*["']\s*["']/g, "");
}

function collapseTagWhitespace(svg: string) {
  return svg
    .replace(/>\s+</g, "><")
    .replace(/<[^>]+>/g, (tag) =>
      tag
        .replace(/[ \t\r\n]{2,}/g, " ")
        .replace(/\s*=\s*/g, "=")
        .replace(/\s+\/>/g, "/>")
        .replace(/\s+>/g, ">")
        .trim(),
    )
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function removeEmptyContainers(svg: string) {
  let next = svg;
  for (let pass = 0; pass < 5; pass += 1) {
    const previous = next;
    next = next.replace(/<(g|defs|symbol|clipPath|mask)\b[^>]*>\s*<\/\1>/gi, "");
    if (next === previous) {
      break;
    }
  }
  return next;
}

function removeUnusedDefsBestEffort(svg: string, warnings: string[]) {
  if (/<style\b/i.test(svg)) {
    warnings.push("Skipped unused defs cleanup because the SVG contains <style>.");
    return svg;
  }

  return svg.replace(/<defs\b[^>]*>([\s\S]*?)<\/defs>/gi, (defsMatch, defsBody) => {
    const elements = collectSafeDefElements(defsBody);
    if (!elements) {
      warnings.push("Skipped unused defs cleanup because the SVG contains complex <defs> content.");
      return defsMatch;
    }

    const kept: string[] = [];

    for (const element of elements) {
      const id = element.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!id) {
        kept.push(element);
        continue;
      }
      if (isIdReferenced(svg.replace(defsMatch, ""), id)) {
        kept.push(element);
      }
    }

    const retained = kept.join("");
    return retained ? `<defs>${retained}</defs>` : "";
  });
}

function collectSafeDefElements(defsBody: string) {
  const pattern =
    /<([A-Za-z][\w:-]*)\b[^>]*\bid\s*=\s*["'][^"']+["'][^>]*(?:\/>|>[\s\S]*?<\/\1>)/gi;
  const elements: string[] = [];
  const ranges: Array<[number, number]> = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(defsBody))) {
    elements.push(match[0]);
    ranges.push([match.index, match.index + match[0].length]);
  }

  let leftover = "";
  let cursor = 0;
  for (const [start, end] of ranges) {
    leftover += defsBody.slice(cursor, start);
    cursor = end;
  }
  leftover += defsBody.slice(cursor);

  if (leftover.replace(/\s+/g, "") !== "") {
    return null;
  }

  return elements;
}

function isIdReferenced(svg: string, id: string) {
  const escaped = escapeRegExp(id);
  return (
    new RegExp(`url\\(\\s*#${escaped}\\s*\\)`, "i").test(svg) ||
    new RegExp(`(?:href|xlink:href)\\s*=\\s*["']#${escaped}["']`, "i").test(svg)
  );
}

function roundGeometryValues(svg: string, precision: number) {
  return svg.replace(/<[^>]+>/g, (tag) => {
    const isRootSvg = /^<svg\b/i.test(tag);
    let next = tag;
    for (const attrName of GEOMETRY_ATTRS) {
      if (isRootSvg && (attrName === "width" || attrName === "height")) {
        continue;
      }
      next = minifyAttributeValue(next, attrName, (value) =>
        roundNumericTokens(value, precision),
      );
    }
    return next;
  });
}

function roundNumericTokens(value: string, precision: number) {
  return String(value).replace(
    /-?(?:\d*\.\d+|\d+\.)(?:e[-+]?\d+)?/gi,
    (number) => formatCompactNumber(Number(number), precision),
  );
}

function formatCompactNumber(value: number, precision: number) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const rounded = Number(value.toFixed(precision));
  if (Object.is(rounded, -0)) {
    return "0";
  }
  let text = String(rounded);
  if (text.startsWith("0.")) {
    text = text.slice(1);
  } else if (text.startsWith("-0.")) {
    text = `-${text.slice(2)}`;
  }
  return text;
}

function cleanupIdsBestEffort(svg: string, warnings: string[]) {
  if (/<(?:script|style)\b/i.test(svg)) {
    warnings.push("Skipped ID cleanup because the SVG contains script or style content.");
    return svg;
  }
  if (/\baria-(?:labelledby|describedby)\s*=/i.test(svg)) {
    warnings.push("Skipped ID cleanup because the SVG contains aria ID references.");
    return svg;
  }

  const ids = [...svg.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(
    (match) => match[1],
  );
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    return svg;
  }

  let next = svg;
  uniqueIds.forEach((id, index) => {
    const replacement = shortId(index);
    if (id === replacement) {
      return;
    }
    const escaped = escapeRegExp(id);
    next = next
      .replace(new RegExp(`\\bid\\s*=\\s*(["'])${escaped}\\1`, "g"), `id="${replacement}"`)
      .replace(new RegExp(`url\\(\\s*#${escaped}\\s*\\)`, "g"), `url(#${replacement})`)
      .replace(
        new RegExp(`((?:href|xlink:href)\\s*=\\s*["'])#${escaped}(["'])`, "gi"),
        `$1#${replacement}$2`,
      );
  });

  if (getSvgByteSize(next) > getSvgByteSize(svg)) {
    warnings.push("Skipped ID cleanup because it did not reduce output size.");
    return svg;
  }
  return next;
}

function shortId(index: number) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  return index < alphabet.length ? alphabet[index] : `i${index - alphabet.length}`;
}

function stripExportOnlyEditorData(svg: string) {
  let next = svg;
  for (const attrName of EDITOR_DATA_ATTRS) {
    next = next.replace(
      new RegExp(`\\s${escapeRegExp(attrName)}\\s*=\\s*"[^"]*"`, "gi"),
      "",
    );
    next = next.replace(
      new RegExp(`\\s${escapeRegExp(attrName)}\\s*=\\s*'[^']*'`, "gi"),
      "",
    );
  }
  return next;
}

function escapeAttr(value: string, quote: string) {
  const escaped = String(value).replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/gi, "&amp;");
  return quote === "'" ? escaped.replace(/'/g, "&apos;") : escaped.replace(/"/g, "&quot;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
