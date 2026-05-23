export type SvgPathStructureOptimizationStats = {
  pathCount: number;
  subpathCountBefore: number;
  subpathCountAfter: number;
  removedSubpathCount: number;
  removedSegmentCount: number;
  removedPathDataBytes: number;
};

export type SvgPathStructureOptimizationResult = {
  svg: string;
  stats: SvgPathStructureOptimizationStats;
};

export type SvgPathBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type SvgPathStructureOptimizationOptions = {
  enabled?: boolean;
  removeTinyIslands?: boolean;
  microIslandMaxArea?: number;
  microIslandMaxDimension?: number;
  preserveDarkLumaBelow?: number;
  preserveDetailBounds?: SvgPathBounds | null;
};

type PaintContext = {
  fill: string;
};

type PathAnalysis = {
  area: number;
  centerX: number;
  centerY: number;
  maxDimension: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  segmentCount: number;
};

const PATH_D_ATTRIBUTE_PATTERN =
  /(<path\b(?=[^>]*\bd\s*=)[^>]*?\bd\s*=\s*)(["'])([\s\S]*?)(\2)([^>]*>)/gi;
const GROUP_PATTERN = /(<g\b([^>]*)>)([\s\S]*?)(<\/g>)/gi;
const SVG_PATH_TOKEN_PATTERN =
  /[AaCcHhLlMmQqSsTtVvZz]|-?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi;

const DEFAULT_OPTIONS = {
  microIslandMaxArea: 16,
  microIslandMaxDimension: 6,
  preserveDarkLumaBelow: 0.35,
};

export function resolveLayeredSvgStructureOptimizationOptions(
  width: number,
  height: number,
): SvgPathStructureOptimizationOptions {
  const maxSide = Math.max(0, Number(width) || 0, Number(height) || 0);
  if (maxSide >= 1400) {
    // Card-size traces need stronger cleanup for foil/paper texture noise, while
    // dark text and linework stay protected by the luma guard.
    return {
      removeTinyIslands: true,
      microIslandMaxArea: 64,
      microIslandMaxDimension: 10,
      preserveDarkLumaBelow: 0.22,
    };
  }
  if (maxSide >= 1000) {
    return {
      removeTinyIslands: true,
      microIslandMaxArea: 36,
      microIslandMaxDimension: 8,
      preserveDarkLumaBelow: 0.24,
    };
  }
  return {
    removeTinyIslands: true,
    microIslandMaxArea: 16,
    microIslandMaxDimension: 6,
    preserveDarkLumaBelow: 0.28,
  };
}

export function optimizeLayeredSvgPathStructure(
  svg: string,
  options: SvgPathStructureOptimizationOptions = {},
): SvgPathStructureOptimizationResult {
  const source = String(svg || "");
  const stats: SvgPathStructureOptimizationStats = {
    pathCount: 0,
    subpathCountBefore: 0,
    subpathCountAfter: 0,
    removedSubpathCount: 0,
    removedSegmentCount: 0,
    removedPathDataBytes: 0,
  };

  if (options.enabled === false || !source) {
    return { svg: source, stats };
  }

  let output = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const candidateImportantBounds =
    options.preserveDetailBounds ?? detectLayeredSvgImportantColorBounds(source);
  const importantBounds = filterFocusedDetailBounds(source, candidateImportantBounds);

  GROUP_PATTERN.lastIndex = 0;
  while ((match = GROUP_PATTERN.exec(source))) {
    output += optimizePathTags(
      source.slice(lastIndex, match.index),
      { fill: "" },
      options,
      stats,
      importantBounds,
    );
    const inherited = readPaintContext(match[2] || "");
    output += `${match[1]}${optimizePathTags(
      match[3] || "",
      inherited,
      options,
      stats,
      importantBounds,
    )}${match[4]}`;
    lastIndex = GROUP_PATTERN.lastIndex;
  }

  output += optimizePathTags(
    source.slice(lastIndex),
    { fill: "" },
    options,
    stats,
    importantBounds,
  );
  return { svg: output, stats };
}

function optimizePathTags(
  source: string,
  inherited: PaintContext,
  options: SvgPathStructureOptimizationOptions,
  stats: SvgPathStructureOptimizationStats,
  importantBounds: SvgPathBounds | null,
): string {
  PATH_D_ATTRIBUTE_PATTERN.lastIndex = 0;
  return String(source || "").replace(
    PATH_D_ATTRIBUTE_PATTERN,
    (
      _match,
      prefix: string,
      quote: string,
      pathData: string,
      _closingQuote: string,
      suffix: string,
    ) => {
      stats.pathCount += 1;
      const pathContext = readPaintContext(`${prefix}${suffix}`);
      const context = { fill: pathContext.fill || inherited.fill || "" };
      const filteredPathData = filterTinySubpaths(
        pathData,
        context,
        options,
        stats,
        importantBounds,
      );
      return `${prefix}${quote}${compactPathDataToRelative(filteredPathData)}${quote}${suffix}`;
    },
  );
}

function filterTinySubpaths(
  pathData: string,
  context: PaintContext,
  options: SvgPathStructureOptimizationOptions,
  stats: SvgPathStructureOptimizationStats,
  importantBounds: SvgPathBounds | null,
): string {
  const subpaths = splitSubpaths(pathData);
  stats.subpathCountBefore += subpaths.length;

  if (options.removeTinyIslands === false || subpaths.length <= 1) {
    stats.subpathCountAfter += subpaths.length;
    return pathData;
  }

  const kept: string[] = [];
  for (const subpath of subpaths) {
    const analysis = analyzePathData(subpath);
    if (shouldRemoveMicroIsland(analysis, context, options, importantBounds)) {
      stats.removedSubpathCount += 1;
      stats.removedSegmentCount += analysis.segmentCount;
      stats.removedPathDataBytes += subpath.length;
    } else {
      kept.push(subpath);
    }
  }

  stats.subpathCountAfter += kept.length;
  return kept.join("");
}

function shouldRemoveMicroIsland(
  analysis: PathAnalysis,
  context: PaintContext,
  options: SvgPathStructureOptimizationOptions,
  importantBounds: SvgPathBounds | null,
): boolean {
  const fill = normalizeHexColor(context.fill);
  if (!fill) return false;

  const luma = relativeLuma(fill);
  if (relativeSaturation(fill) > 0.3) return false;
  const preserveDarkLumaBelow =
    options.preserveDarkLumaBelow ?? DEFAULT_OPTIONS.preserveDarkLumaBelow;
  if (luma < preserveDarkLumaBelow) return false;

  const maxArea = options.microIslandMaxArea ?? DEFAULT_OPTIONS.microIslandMaxArea;
  const maxDimension =
    options.microIslandMaxDimension ?? DEFAULT_OPTIONS.microIslandMaxDimension;
  if (importantBounds && isWithinBounds(analysis, importantBounds)) {
    return (
      analysis.area <= Math.min(maxArea, 30) &&
      analysis.maxDimension <= Math.min(maxDimension, 6)
    );
  }
  return analysis.area <= maxArea && analysis.maxDimension <= maxDimension;
}

function filterFocusedDetailBounds(
  svg: string,
  bounds: SvgPathBounds | null,
): SvgPathBounds | null {
  if (!bounds) return null;
  const dimensions = readSvgViewBoxDimensions(svg);
  if (!dimensions) return bounds;
  const boundsArea = Math.max(0, bounds.maxX - bounds.minX) * Math.max(0, bounds.maxY - bounds.minY);
  const canvasArea = Math.max(1, dimensions.width * dimensions.height);
  return boundsArea / canvasArea <= 0.72 ? bounds : null;
}

function readSvgViewBoxDimensions(svg: string): { width: number; height: number } | null {
  const viewBox = String(svg || "").match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  if (viewBox) {
    const values = viewBox
      .trim()
      .split(/[\s,]+/)
      .map((value) => Number(value));
    if (values.length >= 4 && Number.isFinite(values[2]) && Number.isFinite(values[3])) {
      return { width: Math.max(0, values[2]), height: Math.max(0, values[3]) };
    }
  }

  const width = Number(String(svg || "").match(/\bwidth\s*=\s*["']([0-9.]+)/i)?.[1]);
  const height = Number(String(svg || "").match(/\bheight\s*=\s*["']([0-9.]+)/i)?.[1]);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height };
  }
  return null;
}

export function detectLayeredSvgImportantColorBounds(
  svg: string,
): SvgPathBounds | null {
  let detected: SvgPathBounds | null = null;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  GROUP_PATTERN.lastIndex = 0;
  while ((match = GROUP_PATTERN.exec(svg))) {
    scanImportantPathTags(svg.slice(lastIndex, match.index), { fill: "" }, (bounds) => {
      detected = mergeBounds(detected, bounds);
    });
    const inherited = readPaintContext(match[2] || "");
    scanImportantPathTags(match[3] || "", inherited, (bounds) => {
      detected = mergeBounds(detected, bounds);
    });
    lastIndex = GROUP_PATTERN.lastIndex;
  }

  scanImportantPathTags(svg.slice(lastIndex), { fill: "" }, (bounds) => {
    detected = mergeBounds(detected, bounds);
  });

  return detected ? expandBounds(detected, 24) : null;
}

function scanImportantPathTags(
  source: string,
  inherited: PaintContext,
  onBounds: (bounds: SvgPathBounds) => void,
) {
  PATH_D_ATTRIBUTE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PATH_D_ATTRIBUTE_PATTERN.exec(String(source || "")))) {
    const prefix = match[1] || "";
    const pathData = match[3] || "";
    const suffix = match[5] || "";
    const pathContext = readPaintContext(`${prefix}${suffix}`);
    const fill = normalizeHexColor(pathContext.fill || inherited.fill || "");
    if (!fill || relativeSaturation(fill) <= 0.3) continue;
    const analysis = analyzePathData(pathData);
    if (analysis.area <= 120 || analysis.maxDimension <= 14) continue;
    onBounds(analysis);
  }
}

function isWithinBounds(analysis: PathAnalysis, bounds: SvgPathBounds) {
  return (
    analysis.centerX >= bounds.minX &&
    analysis.centerX <= bounds.maxX &&
    analysis.centerY >= bounds.minY &&
    analysis.centerY <= bounds.maxY
  );
}

function mergeBounds(a: SvgPathBounds | null, b: SvgPathBounds): SvgPathBounds {
  if (!a) return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function expandBounds(bounds: SvgPathBounds, amount: number): SvgPathBounds {
  return {
    minX: bounds.minX - amount,
    minY: bounds.minY - amount,
    maxX: bounds.maxX + amount,
    maxY: bounds.maxY + amount,
  };
}

function splitSubpaths(pathData: string): string[] {
  return (
    String(pathData || "")
      .match(/[Mm](?:(?![Mm]).)*/g)
      ?.filter(Boolean) || []
  );
}

function compactPathDataToRelative(pathData: string): string {
  const tokens = tokenizePathData(pathData);
  if (!tokens.length) return "";

  let index = 0;
  let command = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let previousOutputCommand = "";
  const output: string[] = [];

  const readNumber = () => Number(tokens[index++]);
  const writeCommand = (nextCommand: string, values: number[], force = false) => {
    if (force || nextCommand !== previousOutputCommand) {
      output.push(nextCommand);
      previousOutputCommand = nextCommand;
    }
    for (const value of values) {
      output.push(formatPathNumber(value));
    }
  };

  while (index < tokens.length) {
    if (isPathCommand(tokens[index])) {
      command = tokens[index++];
    }
    if (!command) break;

    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();

    if (upper === "Z") {
      output.push("Z");
      previousOutputCommand = "";
      x = startX;
      y = startY;
      command = "";
      continue;
    }

    if (upper === "M") {
      if (index + 1 > tokens.length) break;
      let nextX = readNumber();
      let nextY = readNumber();
      if (relative) {
        nextX += x;
        nextY += y;
      }
      writeCommand("M", [nextX, nextY], true);
      x = nextX;
      y = nextY;
      startX = x;
      startY = y;
      command = relative ? "l" : "L";
      previousOutputCommand = "m";
      continue;
    }

    if (upper === "L") {
      if (index + 1 > tokens.length) break;
      let nextX = readNumber();
      let nextY = readNumber();
      if (relative) {
        nextX += x;
        nextY += y;
      }
      writeCommand("l", [nextX - x, nextY - y]);
      x = nextX;
      y = nextY;
      continue;
    }

    if (upper === "H") {
      if (index >= tokens.length) break;
      let nextX = readNumber();
      if (relative) nextX += x;
      writeCommand("h", [nextX - x]);
      x = nextX;
      continue;
    }

    if (upper === "V") {
      if (index >= tokens.length) break;
      let nextY = readNumber();
      if (relative) nextY += y;
      writeCommand("v", [nextY - y]);
      y = nextY;
      continue;
    }

    if (upper === "C") {
      if (index + 5 >= tokens.length) break;
      const x1 = readNumber();
      const y1 = readNumber();
      const x2 = readNumber();
      const y2 = readNumber();
      const x3 = readNumber();
      const y3 = readNumber();
      const absoluteX1 = relative ? x + x1 : x1;
      const absoluteY1 = relative ? y + y1 : y1;
      const absoluteX2 = relative ? x + x2 : x2;
      const absoluteY2 = relative ? y + y2 : y2;
      const absoluteX3 = relative ? x + x3 : x3;
      const absoluteY3 = relative ? y + y3 : y3;
      writeCommand("c", [
        absoluteX1 - x,
        absoluteY1 - y,
        absoluteX2 - x,
        absoluteY2 - y,
        absoluteX3 - x,
        absoluteY3 - y,
      ]);
      x = absoluteX3;
      y = absoluteY3;
      continue;
    }

    if (upper === "Q" || upper === "S") {
      if (index + 3 >= tokens.length) break;
      const x1 = readNumber();
      const y1 = readNumber();
      const x2 = readNumber();
      const y2 = readNumber();
      const absoluteX1 = relative ? x + x1 : x1;
      const absoluteY1 = relative ? y + y1 : y1;
      const absoluteX2 = relative ? x + x2 : x2;
      const absoluteY2 = relative ? y + y2 : y2;
      writeCommand(upper === "Q" ? "q" : "s", [
        absoluteX1 - x,
        absoluteY1 - y,
        absoluteX2 - x,
        absoluteY2 - y,
      ]);
      x = absoluteX2;
      y = absoluteY2;
      continue;
    }

    if (upper === "T") {
      if (index + 1 >= tokens.length) break;
      let nextX = readNumber();
      let nextY = readNumber();
      if (relative) {
        nextX += x;
        nextY += y;
      }
      writeCommand("t", [nextX - x, nextY - y]);
      x = nextX;
      y = nextY;
      continue;
    }

    if (upper === "A") {
      if (index + 6 >= tokens.length) break;
      const radiusX = readNumber();
      const radiusY = readNumber();
      const rotation = readNumber();
      const largeArcFlag = readNumber();
      const sweepFlag = readNumber();
      let nextX = readNumber();
      let nextY = readNumber();
      if (relative) {
        nextX += x;
        nextY += y;
      }
      writeCommand("a", [
        radiusX,
        radiusY,
        rotation,
        largeArcFlag,
        sweepFlag,
        nextX - x,
        nextY - y,
      ]);
      x = nextX;
      y = nextY;
      continue;
    }

    break;
  }

  return compactPathSyntax(output.join(" "));
}

function analyzePathData(pathData: string): PathAnalysis {
  const tokens = tokenizePathData(pathData);
  let index = 0;
  let command = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let segmentCount = 0;

  const readNumber = () => Number(tokens[index++]);
  const mark = (pointX: number, pointY: number) => {
    if (!Number.isFinite(pointX) || !Number.isFinite(pointY)) return;
    minX = Math.min(minX, pointX);
    minY = Math.min(minY, pointY);
    maxX = Math.max(maxX, pointX);
    maxY = Math.max(maxY, pointY);
  };
  const segmentTo = (nextX: number, nextY: number) => {
    segmentCount += 1;
    x = nextX;
    y = nextY;
    mark(x, y);
  };

  while (index < tokens.length) {
    if (isPathCommand(tokens[index])) {
      command = tokens[index++];
    }
    if (!command) break;

    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();

    if (upper === "Z") {
      segmentTo(startX, startY);
      command = "";
      continue;
    }

    if (upper === "M") {
      if (index + 1 > tokens.length) break;
      let nextX = readNumber();
      let nextY = readNumber();
      if (relative) {
        nextX += x;
        nextY += y;
      }
      x = nextX;
      y = nextY;
      startX = x;
      startY = y;
      mark(x, y);
      command = relative ? "l" : "L";
      continue;
    }

    if (upper === "L") {
      if (index + 1 > tokens.length) break;
      let nextX = readNumber();
      let nextY = readNumber();
      if (relative) {
        nextX += x;
        nextY += y;
      }
      segmentTo(nextX, nextY);
      continue;
    }

    if (upper === "H") {
      if (index >= tokens.length) break;
      let nextX = readNumber();
      if (relative) nextX += x;
      segmentTo(nextX, y);
      continue;
    }

    if (upper === "V") {
      if (index >= tokens.length) break;
      let nextY = readNumber();
      if (relative) nextY += y;
      segmentTo(x, nextY);
      continue;
    }

    if (upper === "C") {
      if (index + 5 >= tokens.length) break;
      const values = [
        readNumber(),
        readNumber(),
        readNumber(),
        readNumber(),
        readNumber(),
        readNumber(),
      ];
      const points: Array<[number, number]> = [];
      for (let i = 0; i < values.length; i += 2) {
        const pointX = relative ? x + values[i] : values[i];
        const pointY = relative ? y + values[i + 1] : values[i + 1];
        mark(pointX, pointY);
        points.push([pointX, pointY]);
      }
      const last = points[2];
      segmentTo(last[0], last[1]);
      continue;
    }

    if (upper === "Q" || upper === "S") {
      if (index + 3 >= tokens.length) break;
      const values = [readNumber(), readNumber(), readNumber(), readNumber()];
      const points: Array<[number, number]> = [];
      for (let i = 0; i < values.length; i += 2) {
        const pointX = relative ? x + values[i] : values[i];
        const pointY = relative ? y + values[i + 1] : values[i + 1];
        mark(pointX, pointY);
        points.push([pointX, pointY]);
      }
      const last = points[1];
      segmentTo(last[0], last[1]);
      continue;
    }

    if (upper === "T") {
      if (index + 1 >= tokens.length) break;
      let nextX = readNumber();
      let nextY = readNumber();
      if (relative) {
        nextX += x;
        nextY += y;
      }
      segmentTo(nextX, nextY);
      continue;
    }

    if (upper === "A") {
      if (index + 6 >= tokens.length) break;
      index += 5;
      let nextX = readNumber();
      let nextY = readNumber();
      if (relative) {
        nextX += x;
        nextY += y;
      }
      segmentTo(nextX, nextY);
      continue;
    }

    break;
  }

  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  const safeMinX = Number.isFinite(minX) ? minX : 0;
  const safeMinY = Number.isFinite(minY) ? minY : 0;
  const safeMaxX = Number.isFinite(maxX) ? maxX : safeMinX;
  const safeMaxY = Number.isFinite(maxY) ? maxY : safeMinY;
  return {
    area: width * height,
    centerX: (safeMinX + safeMaxX) / 2,
    centerY: (safeMinY + safeMaxY) / 2,
    maxDimension: Math.max(width, height),
    minX: safeMinX,
    minY: safeMinY,
    maxX: safeMaxX,
    maxY: safeMaxY,
    segmentCount,
  };
}

function readPaintContext(attrs: string): PaintContext {
  return {
    fill: readHexPaint(attrs, "fill") || readHexPaint(attrs, "data-layer-color") || "",
  };
}

function readHexPaint(attrs: string, name: string): string {
  const pattern = new RegExp(
    `\\b${escapeRegExp(name)}\\s*=\\s*["'](#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})["']`,
    "i",
  );
  return normalizeHexColor(String(attrs || "").match(pattern)?.[1] || "");
}

function normalizeHexColor(value: string): string {
  const text = String(value || "").trim().toLowerCase();
  const match = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (!match) return "";
  const hex = match[1];
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  return `#${hex}`;
}

function relativeLuma(hex: string): number {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return 0;
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return (red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255;
}

function relativeSaturation(hex: string): number {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return 0;
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return (Math.max(red, green, blue) - Math.min(red, green, blue)) / 255;
}

function tokenizePathData(pathData: string): string[] {
  return [...String(pathData || "").matchAll(SVG_PATH_TOKEN_PATTERN)].map(
    (match) => match[0],
  );
}

function isPathCommand(token: string): boolean {
  return /^[AaCcHhLlMmQqSsTtVvZz]$/.test(token);
}

function formatPathNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value);
  if (Object.is(rounded, -0)) return "0";
  return String(rounded);
}

function compactPathSyntax(pathData: string): string {
  return String(pathData || "")
    .replace(/\s+/g, " ")
    .replace(/\s*([AaCcHhLlMmQqSsTtVvZz])\s*/g, "$1")
    .replace(/\s+(-)/g, "$1")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
