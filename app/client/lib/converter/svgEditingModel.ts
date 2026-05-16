export type SvgEditOperation =
  | "recolor-fill"
  | "recolor-stroke"
  | "gradient-fill"
  | "pattern-fill"
  | "opacity"
  | "stroke-width"
  | "fill-spread"
  | "sticker-border";

export type SvgEditableTargetType =
  | "allFills"
  | "allStrokes"
  | "color"
  | "layer"
  | "text"
  | "none";

export type SvgPaintKind = "fill" | "stroke";

export type SvgEditingLayerInput = {
  id: string;
  label?: string;
  name?: string;
  color?: string;
  originalColor?: string;
  visible?: boolean;
  opacity?: number;
  originalOpacity?: number;
  kind?: SvgPaintKind | string;
  pathTags?: string;
};

export type SvgEditingModelOptions = {
  sourceKind?: "svg" | "raster";
  engineUsed?: string;
  layers?: ReadonlyArray<SvgEditingLayerInput> | null;
  precisionOutput?: boolean;
  supportsRetrace?: boolean;
};

export type SvgOutputCapabilities = {
  hasValidSvg: boolean;
  hasVisibleContent: boolean;
  hasFills: boolean;
  hasStrokes: boolean;
  hasText: boolean;
  hasImageElements: boolean;
  hasInlineStyles: boolean;
  hasClassStyles: boolean;
  hasGradients: boolean;
  hasPatterns: boolean;
  hasDefs: boolean;
  hasEditableFillTargets: boolean;
  hasEditableStrokeTargets: boolean;
  hasEditableLayerTargets: boolean;
  hasEditableColorTargets: boolean;
  hasLayerPathTags: boolean;
  hasDetectedColors: boolean;
  isSvgCleanupOutput: boolean;
  isRasterTraceOutput: boolean;
  isLayeredOutput: boolean;
  supportsRetrace: boolean;
  supportsLiveSvgMutation: boolean;
};

export type SvgEditableTarget = {
  id: string;
  label: string;
  type: SvgEditableTargetType;
  count: number;
  paint?: SvgPaintKind | "mixed";
  color?: string;
  layerId?: string;
  supportedOperations: SvgEditOperation[];
};

export type SvgEditingModel = {
  capabilities: SvgOutputCapabilities;
  targets: SvgEditableTarget[];
  fillTargets: SvgEditableTarget[];
  strokeTargets: SvgEditableTarget[];
  layerTargets: SvgEditableTarget[];
  colorTargets: SvgEditableTarget[];
  summary: string[];
  layerUnavailableMessage?: string;
};

export type SvgPaintTargetContext = {
  tagName: string;
  attrs: string;
  paint: SvgPaintKind;
  paintValue: string;
  normalizedColor?: string;
  layerIds: string[];
  isText: boolean;
};

type CssPaint = Partial<
  Record<
    | "display"
    | "visibility"
    | "opacity"
    | "fill"
    | "stroke"
    | "fill-opacity"
    | "stroke-opacity",
    string
  >
>;

type SvgElementRecord = {
  tagName: string;
  attrs: string;
  fill?: SvgElementPaint;
  stroke?: SvgElementPaint;
  visible: boolean;
  layerIds: string[];
  isText: boolean;
};

type SvgElementPaint = {
  value: string;
  normalizedColor?: string;
};

type SvgElementContext = {
  inheritedFillNone?: boolean;
};

type SvgProtectedRange = {
  start: number;
  end: number;
};

const TARGETABLE_TAGS = new Set([
  "path",
  "line",
  "polyline",
  "polygon",
  "rect",
  "circle",
  "ellipse",
  "text",
  "g",
]);
const FILLABLE_TAGS = new Set([
  "path",
  "polygon",
  "rect",
  "circle",
  "ellipse",
  "text",
  "g",
]);
const ELEMENT_TAG_PATTERN =
  /<([a-zA-Z][\w:.-]*)(\s[^<>]*?)?(\/?)>/g;
const DEFAULT_FILL_TARGET_ID = "all-fills";
const DEFAULT_STROKE_TARGET_ID = "all-strokes";

export function analyzeSvgEditingModel(
  svg: string,
  options: SvgEditingModelOptions = {},
): SvgEditingModel {
  const source = String(svg || "");
  const cssPaints = collectCssPaints(source);
  const elements = collectSvgElementRecords(source, cssPaints);
  const fillElements = elements.filter((element) => Boolean(element.fill));
  const strokeElements = elements.filter((element) => Boolean(element.stroke));
  const colorTargets = buildColorTargets(fillElements, strokeElements);
  const layerTargets = buildLayerTargets(elements, options.layers || []);
  const fillTargets = buildFillTargets(fillElements, colorTargets, layerTargets);
  const strokeTargets = buildStrokeTargets(strokeElements, colorTargets, layerTargets);
  const hasLayerPathTags =
    /\bdata-(?:fill-layer-id|stroke-layer-id|layer-id)\s*=/i.test(source) ||
    Boolean(options.layers?.some((layer) => layer.pathTags));
  const isSvgCleanupOutput = options.sourceKind === "svg";
  const isRasterTraceOutput =
    options.sourceKind === "raster" ||
    /^(?:vtracer|potrace|centerline)$/i.test(String(options.engineUsed || ""));
  const hasEditableFillTargets = fillElements.length > 0;
  const hasEditableStrokeTargets = strokeElements.length > 0;
  const hasEditableLayerTargets = layerTargets.length > 0;
  const hasEditableColorTargets = colorTargets.length > 0;
  const hasVisibleContent = elements.some(
    (element) => element.visible && (element.fill || element.stroke),
  );
  const summary = [
    hasEditableFillTargets ? "filled shapes" : "",
    hasEditableStrokeTargets ? "strokes" : "",
    hasEditableLayerTargets ? "layers" : "",
    hasEditableColorTargets ? "detected colors" : "",
  ].filter(Boolean);
  const layerUnavailableMessage =
    !hasEditableLayerTargets &&
    (hasEditableFillTargets || hasEditableStrokeTargets) &&
    isSvgCleanupOutput
      ? "This SVG has editable fills/strokes, but no generated layer metadata. Use target-based fill/stroke controls or run a layered raster conversion to edit layers."
      : undefined;

  const capabilities: SvgOutputCapabilities = {
    hasValidSvg: /<svg\b/i.test(source),
    hasVisibleContent,
    hasFills: fillElements.length > 0,
    hasStrokes: strokeElements.length > 0,
    hasText: /<text\b/i.test(source),
    hasImageElements: /<image\b/i.test(source),
    hasInlineStyles: /\bstyle\s*=/i.test(source),
    hasClassStyles: cssPaints.size > 0,
    hasGradients: /<(?:linearGradient|radialGradient)\b/i.test(source),
    hasPatterns: /<pattern\b/i.test(source),
    hasDefs: /<defs\b/i.test(source),
    hasEditableFillTargets,
    hasEditableStrokeTargets,
    hasEditableLayerTargets,
    hasEditableColorTargets,
    hasLayerPathTags,
    hasDetectedColors: hasEditableColorTargets,
    isSvgCleanupOutput,
    isRasterTraceOutput,
    isLayeredOutput: hasEditableLayerTargets || Boolean(options.layers?.length),
    supportsRetrace: Boolean(options.supportsRetrace && !isSvgCleanupOutput),
    supportsLiveSvgMutation:
      /<svg\b/i.test(source) &&
      hasVisibleContent &&
      (hasEditableFillTargets ||
        hasEditableStrokeTargets ||
        hasEditableLayerTargets ||
        hasEditableColorTargets),
  };

  const targets = [
    ...fillTargets.filter((target) => target.id === DEFAULT_FILL_TARGET_ID),
    ...strokeTargets.filter((target) => target.id === DEFAULT_STROKE_TARGET_ID),
    ...colorTargets,
    ...layerTargets,
  ];

  return {
    capabilities,
    targets,
    fillTargets,
    strokeTargets,
    layerTargets,
    colorTargets,
    summary,
    layerUnavailableMessage,
  };
}

export function getSvgEditTargetById(
  model: SvgEditingModel,
  targetId: string | null | undefined,
): SvgEditableTarget | null {
  const id = String(targetId || "").trim();
  if (!id) return null;
  return model.targets.find((target) => target.id === id) || null;
}

export function resolveSvgPaintTargetId(
  model: SvgEditingModel,
  targetId: string | null | undefined,
  paint: SvgPaintKind,
): string {
  const fallback = paint === "fill" ? DEFAULT_FILL_TARGET_ID : DEFAULT_STROKE_TARGET_ID;
  const candidates = paint === "fill" ? model.fillTargets : model.strokeTargets;
  const id = String(targetId || "").trim();
  return candidates.some((target) => target.id === id) ? id : fallback;
}

export function rewriteSvgEditablePaintTargets(
  svg: string,
  options: {
    targetId: string | null | undefined;
    paint: SvgPaintKind;
    model?: SvgEditingModel;
  },
  rewriteAttrs: (context: SvgPaintTargetContext) => string,
): string {
  const source = String(svg || "");
  const cssPaints = collectCssPaints(source);
  const ranges = collectProtectedRanges(source);
  const model = options.model ?? analyzeSvgEditingModel(source);
  const resolvedTargetId = resolveSvgPaintTargetId(
    model,
    options.targetId,
    options.paint,
  );
  return source.replace(
    ELEMENT_TAG_PATTERN,
    (match: string, tagName: string, attrs = "", slash = "", offset: number) => {
      const normalizedTag = String(tagName || "").toLowerCase();
      if (!TARGETABLE_TAGS.has(normalizedTag)) return match;
      if (isInsideProtectedRange(offset, ranges)) return match;

      const record = buildSvgElementRecord(normalizedTag, String(attrs || ""), cssPaints, {
        inheritedFillNone: isInsideCutOutlineGroup(source, offset),
      });
      if (!record?.visible) return match;
      const paint = options.paint === "fill" ? record.fill : record.stroke;
      if (!paint) return match;
      const context: SvgPaintTargetContext = {
        tagName: normalizedTag,
        attrs: String(attrs || ""),
        paint: options.paint,
        paintValue: paint.value,
        normalizedColor: paint.normalizedColor,
        layerIds: record.layerIds,
        isText: record.isText,
      };
      if (!matchesSvgEditTarget(context, resolvedTargetId)) return match;
      const nextAttrs = rewriteAttrs(context);
      return `<${tagName}${nextAttrs}${slash || ""}>`;
    },
  );
}

export function createSvgPaintTargetMatcher(
  svg: string,
  options: {
    targetId: string | null | undefined;
    paint: SvgPaintKind;
  },
): (tagName: string, attrs: string) => boolean {
  const source = String(svg || "");
  const cssPaints = collectCssPaints(source);
  const model = analyzeSvgEditingModel(source);
  const resolvedTargetId = resolveSvgPaintTargetId(
    model,
    options.targetId,
    options.paint,
  );
  return (tagName: string, attrs: string) => {
    const normalizedTag = String(tagName || "").toLowerCase();
    if (!TARGETABLE_TAGS.has(normalizedTag)) return false;
    const record = buildSvgElementRecord(normalizedTag, String(attrs || ""), cssPaints);
    if (!record?.visible) return false;
    const paint = options.paint === "fill" ? record.fill : record.stroke;
    if (!paint) return false;
    return matchesSvgEditTarget(
      {
        tagName: normalizedTag,
        attrs: String(attrs || ""),
        paint: options.paint,
        paintValue: paint.value,
        normalizedColor: paint.normalizedColor,
        layerIds: record.layerIds,
        isText: record.isText,
      },
      resolvedTargetId,
    );
  };
}

export function matchesSvgEditTarget(
  context: SvgPaintTargetContext,
  targetId: string | null | undefined,
): boolean {
  const id = String(targetId || "").trim();
  if (!id) return false;
  if (context.paint === "fill" && id === DEFAULT_FILL_TARGET_ID) return true;
  if (context.paint === "stroke" && id === DEFAULT_STROKE_TARGET_ID) return true;
  if (id.startsWith("color:")) {
    return context.normalizedColor === normalizePaintColor(id.slice("color:".length));
  }
  if (id.startsWith("layer:")) {
    return context.layerIds.includes(id.slice("layer:".length));
  }
  return false;
}

function buildFillTargets(
  fillElements: SvgElementRecord[],
  colorTargets: SvgEditableTarget[],
  layerTargets: SvgEditableTarget[],
): SvgEditableTarget[] {
  const targets: SvgEditableTarget[] = [];
  if (fillElements.length) {
    targets.push({
      id: DEFAULT_FILL_TARGET_ID,
      label: "All filled areas",
      type: "allFills",
      count: fillElements.length,
      paint: "fill",
      supportedOperations: [
        "recolor-fill",
        "gradient-fill",
        "pattern-fill",
        "opacity",
        "fill-spread",
        "sticker-border",
      ],
    });
  }
  targets.push(
    ...colorTargets
      .filter((target) => target.supportedOperations.includes("recolor-fill"))
      .map((target) => ({
        ...target,
        label: "Matching fill color",
        paint: "fill" as const,
        supportedOperations: target.supportedOperations.filter((operation) =>
          [
            "recolor-fill",
            "gradient-fill",
            "pattern-fill",
            "opacity",
            "fill-spread",
            "sticker-border",
          ].includes(operation),
        ),
      })),
  );
  targets.push(
    ...layerTargets
      .filter((target) => target.supportedOperations.includes("recolor-fill"))
      .map((target) => ({ ...target, paint: "fill" as const })),
  );
  return targets;
}

function buildStrokeTargets(
  strokeElements: SvgElementRecord[],
  colorTargets: SvgEditableTarget[],
  layerTargets: SvgEditableTarget[],
): SvgEditableTarget[] {
  const targets: SvgEditableTarget[] = [];
  if (strokeElements.length) {
    targets.push({
      id: DEFAULT_STROKE_TARGET_ID,
      label: "All strokes",
      type: "allStrokes",
      count: strokeElements.length,
      paint: "stroke",
      supportedOperations: [
        "recolor-stroke",
        "opacity",
        "stroke-width",
      ],
    });
  }
  targets.push(
    ...colorTargets
      .filter((target) => target.supportedOperations.includes("recolor-stroke"))
      .map((target) => ({
        ...target,
        label: "Matching stroke color",
        paint: "stroke" as const,
        supportedOperations: target.supportedOperations.filter((operation) =>
          ["recolor-stroke", "opacity", "stroke-width"].includes(operation),
        ),
      })),
  );
  targets.push(
    ...layerTargets
      .filter((target) => target.supportedOperations.includes("recolor-stroke"))
      .map((target) => ({ ...target, paint: "stroke" as const })),
  );
  return targets;
}

function buildColorTargets(
  fillElements: SvgElementRecord[],
  strokeElements: SvgElementRecord[],
): SvgEditableTarget[] {
  const colors = new Map<
    string,
    {
      fillCount: number;
      strokeCount: number;
    }
  >();
  for (const element of fillElements) {
    if (!element.fill?.normalizedColor) continue;
    const current = colors.get(element.fill.normalizedColor) || {
      fillCount: 0,
      strokeCount: 0,
    };
    current.fillCount += 1;
    colors.set(element.fill.normalizedColor, current);
  }
  for (const element of strokeElements) {
    if (!element.stroke?.normalizedColor) continue;
    const current = colors.get(element.stroke.normalizedColor) || {
      fillCount: 0,
      strokeCount: 0,
    };
    current.strokeCount += 1;
    colors.set(element.stroke.normalizedColor, current);
  }

  return [...colors.entries()]
    .sort((left, right) => right[1].fillCount + right[1].strokeCount - (left[1].fillCount + left[1].strokeCount))
    .map(([color, counts]) => {
      const supportedOperations: SvgEditOperation[] = [];
      if (counts.fillCount) {
        supportedOperations.push(
          "recolor-fill",
          "gradient-fill",
          "pattern-fill",
          "opacity",
          "fill-spread",
          "sticker-border",
        );
      }
      if (counts.strokeCount) {
        supportedOperations.push("recolor-stroke", "opacity", "stroke-width");
      }
      return {
        id: `color:${color}`,
        label:
          counts.fillCount && counts.strokeCount
            ? "Matching color"
            : counts.fillCount
              ? "Matching fill color"
              : "Matching stroke color",
        type: "color" as const,
        count: counts.fillCount + counts.strokeCount,
        paint:
          counts.fillCount && counts.strokeCount
            ? ("mixed" as const)
            : counts.fillCount
              ? ("fill" as const)
              : ("stroke" as const),
        color,
        supportedOperations: Array.from(new Set(supportedOperations)),
      };
    });
}

function buildLayerTargets(
  elements: SvgElementRecord[],
  layers: ReadonlyArray<SvgEditingLayerInput>,
): SvgEditableTarget[] {
  const layerLabels = new Map<string, string>();
  for (const layer of layers) {
    const id = String(layer.id || "").trim();
    if (id) layerLabels.set(id, layer.label || layer.name || id);
  }
  for (const element of elements) {
    for (const id of element.layerIds) {
      if (!layerLabels.has(id)) layerLabels.set(id, id);
    }
  }

  const targets: SvgEditableTarget[] = [];
  for (const [id, label] of layerLabels) {
    const matched = elements.filter((element) => element.layerIds.includes(id));
    if (!matched.length) continue;
    const fillCount = matched.filter((element) => element.fill).length;
    const strokeCount = matched.filter((element) => element.stroke).length;
    const representativeColor =
      matched.find((element) => element.fill?.normalizedColor)?.fill
        ?.normalizedColor ||
      matched.find((element) => element.stroke?.normalizedColor)?.stroke
        ?.normalizedColor;
    const supportedOperations: SvgEditOperation[] = [];
    if (fillCount) {
      supportedOperations.push(
        "recolor-fill",
        "gradient-fill",
        "pattern-fill",
        "opacity",
        "fill-spread",
        "sticker-border",
      );
    }
    if (strokeCount) {
      supportedOperations.push("recolor-stroke", "opacity", "stroke-width");
    }
    if (!supportedOperations.length) continue;
    targets.push({
      id: `layer:${id}`,
      label,
      type: "layer",
      count: fillCount + strokeCount,
      paint:
        fillCount && strokeCount
          ? "mixed"
          : fillCount
            ? "fill"
            : "stroke",
      layerId: id,
      color: representativeColor,
      supportedOperations: Array.from(new Set(supportedOperations)),
    });
  }
  return targets;
}

function collectSvgElementRecords(
  svg: string,
  cssPaints: Map<string, CssPaint>,
): SvgElementRecord[] {
  const source = String(svg || "");
  const ranges = collectProtectedRanges(source);
  const records: SvgElementRecord[] = [];
  for (const match of source.matchAll(ELEMENT_TAG_PATTERN)) {
    const offset = match.index ?? 0;
    if (isInsideProtectedRange(offset, ranges)) continue;
    const tagName = String(match[1] || "").toLowerCase();
    if (!TARGETABLE_TAGS.has(tagName)) continue;
    const record = buildSvgElementRecord(tagName, String(match[2] || ""), cssPaints, {
      inheritedFillNone: isInsideCutOutlineGroup(source, offset),
    });
    if (record) records.push(record);
  }
  return records;
}

function buildSvgElementRecord(
  tagName: string,
  attrs: string,
  cssPaints: Map<string, CssPaint>,
  context: SvgElementContext = {},
): SvgElementRecord | null {
  const visible = isVisibleElement(tagName, attrs, cssPaints);
  if (!visible) {
    return {
      tagName,
      attrs,
      visible: false,
      layerIds: [],
      isText: tagName === "text",
    };
  }
  const fill = readElementPaint(tagName, attrs, "fill", cssPaints, context);
  const stroke = readElementPaint(tagName, attrs, "stroke", cssPaints, context);
  return {
    tagName,
    attrs,
    fill,
    stroke,
    visible,
    layerIds: getElementLayerIds(attrs),
    isText: tagName === "text",
  };
}

function readElementPaint(
  tagName: string,
  attrs: string,
  paint: SvgPaintKind,
  cssPaints: Map<string, CssPaint>,
  context: SvgElementContext = {},
): SvgElementPaint | undefined {
  if (paint === "fill" && !FILLABLE_TAGS.has(tagName)) return undefined;
  const explicitValue =
    readStyleProperty(attrs, paint) ||
    readAttribute(attrs, paint) ||
    readCssPaint(attrs, paint, cssPaints);
  const value =
    explicitValue ||
    (paint === "fill" && FILLABLE_TAGS.has(tagName) && tagName !== "g"
      && !context.inheritedFillNone
      ? "#000000"
      : "");
  if (!value || !isPaintEnabled(value)) return undefined;
  return {
    value,
    normalizedColor: normalizePaintColor(value),
  };
}

function isInsideCutOutlineGroup(source: string, offset: number): boolean {
  const before = source.slice(0, Math.max(0, offset));
  const openIndex = before.lastIndexOf("<g");
  if (openIndex < 0) return false;
  const closeIndex = before.lastIndexOf("</g>");
  if (closeIndex > openIndex) return false;
  const openEnd = source.indexOf(">", openIndex);
  if (openEnd < 0 || openEnd > offset) return false;
  const attrs = source.slice(openIndex + 2, openEnd);
  return (
    /\bdata-role\s*=\s*(["'])cut-outline\1/i.test(attrs) ||
    /\bid\s*=\s*(["'])sticker-cut-outline\1/i.test(attrs)
  );
}

function isVisibleElement(
  tagName: string,
  attrs: string,
  cssPaints: Map<string, CssPaint>,
): boolean {
  if (readAttribute(attrs, "display")?.toLowerCase() === "none") return false;
  if (readAttribute(attrs, "visibility")?.toLowerCase() === "hidden") return false;
  if (isZeroOpacity(readAttribute(attrs, "opacity"))) return false;
  if (/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\D|$)/i.test(readAttribute(attrs, "style") || "")) {
    return false;
  }
  const css = readCssPaintDeclarations(attrs, cssPaints);
  if (css.display?.trim().toLowerCase() === "none") return false;
  if (css.visibility?.trim().toLowerCase() === "hidden") return false;
  if (isZeroOpacity(css.opacity)) return false;
  if (tagName === "path" && !readAttribute(attrs, "d")) return false;
  return true;
}

function collectCssPaints(svg: string): Map<string, CssPaint> {
  const paints = new Map<string, CssPaint>();
  for (const styleMatch of String(svg || "").matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    const css = String(styleMatch[1] || "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const rule of css.matchAll(/([.#][A-Za-z_][\w:-]*)\s*\{([^}]*)\}/g)) {
      const selector = rule[1];
      const declarations = parseCssPaintDeclarations(rule[2] || "");
      if (Object.keys(declarations).length === 0) continue;
      paints.set(selector, { ...(paints.get(selector) || {}), ...declarations });
    }
  }
  return paints;
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

function readCssPaint(
  attrs: string,
  paint: SvgPaintKind,
  cssPaints: Map<string, CssPaint>,
): string | null {
  return readCssPaintDeclarations(attrs, cssPaints)[paint] || null;
}

function readCssPaintDeclarations(
  attrs: string,
  cssPaints: Map<string, CssPaint>,
): CssPaint {
  const merged: CssPaint = {};
  const id = readAttribute(attrs, "id");
  if (id) Object.assign(merged, cssPaints.get(`#${id}`));
  const classValue = readAttribute(attrs, "class");
  if (classValue) {
    for (const className of classValue.split(/\s+/)) {
      Object.assign(merged, cssPaints.get(`.${className}`));
    }
  }
  return merged;
}

function collectProtectedRanges(source: string): SvgProtectedRange[] {
  const ranges: SvgProtectedRange[] = [];
  const pattern =
    /<(defs|style|script|clipPath|mask|marker|symbol)\b[\s\S]*?<\/\1>/gi;
  for (const match of String(source || "").matchAll(pattern)) {
    if (match.index == null) continue;
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges;
}

function isInsideProtectedRange(index: number, ranges: SvgProtectedRange[]): boolean {
  return ranges.some((range) => index >= range.start && index < range.end);
}

function getElementLayerIds(attrs: string): string[] {
  return [
    readAttribute(attrs, "data-layer-id"),
    readAttribute(attrs, "data-fill-layer-id"),
    readAttribute(attrs, "data-stroke-layer-id"),
  ].filter((value): value is string => Boolean(value));
}

function readStyleProperty(attrs: string, property: string): string | null {
  const style = readAttribute(attrs, "style");
  if (!style) return null;
  const propertyPattern = new RegExp(
    `(?:^|;)\\s*${escapeRegExp(property)}\\s*:\\s*([^;]+)`,
    "i",
  );
  return style.match(propertyPattern)?.[1]?.trim() || null;
}

function readAttribute(attrs: string, attribute: string): string | null {
  const match = String(attrs || "").match(
    new RegExp(`\\s${escapeRegExp(attribute)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"),
  );
  return match?.[2]?.trim() || null;
}

function isPaintEnabled(value: string): boolean {
  const normalized = normalizePaint(value);
  return Boolean(
    normalized &&
      normalized !== "none" &&
      normalized !== "transparent" &&
      normalized !== "currentcolor" &&
      normalized !== "rgba(0,0,0,0)" &&
      !/^url\(/i.test(normalized),
  );
}

function normalizePaintColor(value: string): string | undefined {
  const normalized = normalizePaint(value);
  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    const [, r, g, b] = normalized.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i) || [];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized.toLowerCase();
  const rgb = normalized.match(/^rgb\((\d{1,3}),(\d{1,3}),(\d{1,3})\)$/i);
  if (rgb) {
    return `#${toHexByte(rgb[1])}${toHexByte(rgb[2])}${toHexByte(rgb[3])}`;
  }
  const named: Record<string, string> = {
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
  };
  return named[normalized];
}

function normalizePaint(value: string): string {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, "");
}

function toHexByte(value: string): string {
  const number = Math.max(0, Math.min(255, Number(value) || 0));
  return number.toString(16).padStart(2, "0");
}

function isZeroOpacity(value?: string | null): boolean {
  return /^(?:0|0\.0+)$/.test(String(value || "").trim());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
