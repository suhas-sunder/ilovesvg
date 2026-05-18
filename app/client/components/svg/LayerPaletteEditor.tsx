import * as React from "react";
import {
  useNativeColorFinalCommit,
  useThrottledCommit,
} from "~/client/hooks/useThrottledCommit";

export type SvgLayerKind = "fill" | "stroke";

export type SvgLayerMeta = {
  id: string;
  label: string;
  color: string;
  originalColor: string;
  visible: boolean;
  pathTags?: string;
  opacity?: number;
  originalOpacity?: number;
  kind?: SvgLayerKind;
  pathCount?: number;
};

export type EditableSvgLayer = SvgLayerMeta;

export type TraceMode = "single" | "layered";

export type LayerTurnPolicy =
  | "black"
  | "white"
  | "left"
  | "right"
  | "minority"
  | "majority";

export type LayeredTraceSettings = {
  traceMode: TraceMode;
  colorLayerCount: number;
  layerMaxTraceSide: number;
  minRegionPercent: number;
  layerOptTolerance: number;
  layerTurdSize: number;
  layerTurnPolicy: LayerTurnPolicy;
  posterize: boolean;
  removeWhite: boolean;
  removeTransparent: boolean;
};

type LayeredHistoryItem = {
  layers?: EditableSvgLayer[];
};

const layerEditSvgCache = new WeakMap<
  EditableSvgLayer[],
  { sourceSvg: string; editedSvg: string }
>();

export function applyLayerEditsToSvg(
  svg: string,
  layers: EditableSvgLayer[],
): string {
  const cached = layerEditSvgCache.get(layers);
  if (cached?.sourceSvg === svg) return cached.editedSvg;

  const editedLayers = layers.filter(hasLayerEdit);
  if (editedLayers.length === 0) {
    layerEditSvgCache.set(layers, { sourceSvg: svg, editedSvg: svg });
    return svg;
  }

  let out = svg;
  const groupIds = collectSvgGroupLayerIds(out);
  const groupEditedLayers = editedLayers.filter((layer) => groupIds.has(layer.id));
  const fillElementLayers = new Map<string, EditableSvgLayer>();
  const strokeElementLayers = new Map<string, EditableSvgLayer>();

  for (const layer of editedLayers) {
    if ((layer.kind || "fill") === "stroke") {
      strokeElementLayers.set(layer.id, layer);
    } else {
      fillElementLayers.set(layer.id, layer);
    }
  }

  for (const layer of groupEditedLayers) {
    const id = escapeLayerRegExp(layer.id);

    const groupPattern = new RegExp(
      `(<g\\b(?=[^>]*data-layer-id=["']${id}["'])([^>]*)>)([\\s\\S]*?)(<\\/g>)`,
      "gi",
    );

    out = out.replace(groupPattern, (_match, _open, attrs, inner, close) => {
      const groupPaintProp =
        (layer.kind || "fill") === "stroke" ? "stroke" : "fill";
      let nextAttrs = String(attrs)
        .replace(
          new RegExp(`\\s${groupPaintProp}\\s*=\\s*["'][^"']*["']`, "gi"),
          "",
        )
        .replace(/\sdisplay\s*=\s*["'][^"']*["']/gi, "")
        .replace(/\sdata-layer-color\s*=\s*["'][^"']*["']/gi, "")
        .replace(/\sdata-layer-editor-hidden\s*=\s*["'][^"']*["']/gi, "");

      nextAttrs = rewriteStyleProperty(nextAttrs, groupPaintProp, layer.color);
      nextAttrs = rewriteStyleProperty(
        nextAttrs,
        "display",
        layer.visible ? null : "none",
      );
      nextAttrs = applyOpacityAttribute(nextAttrs, layer.opacity);
      nextAttrs += ` data-layer-color="${escapeSvgAttribute(layer.color)}"`;
      nextAttrs += ` ${groupPaintProp}="${layer.color}"`;
      if (!layer.visible)
        nextAttrs += ` display="none" data-layer-editor-hidden="true"`;

      const childPaintPattern = new RegExp(
        `\\s${groupPaintProp}\\s*=\\s*["'][^"']*["']`,
        "gi",
      );
      const normalizedInner = new RegExp(
        `\\s${groupPaintProp}\\s*=\\s*["'][^"']*["']`,
        "i",
      ).test(String(inner))
        ? inner.replace(
            /<path\b([^>]*)>/gi,
            (_pathMatch: string, pathAttrs: string) => {
              const parsedPath = parseSvgElementAttrs(String(pathAttrs || ""));
              const nextPathAttrs = parsedPath.attrs.replace(childPaintPattern, "");
              return `<path${nextPathAttrs}${parsedPath.close}`;
            },
          )
        : inner;

      return `<g${nextAttrs}>${normalizedInner}${close}`;
    });

  }

  const elementLayerCount = fillElementLayers.size + strokeElementLayers.size;
  if (elementLayerCount > 0 && elementLayerCount <= 4) {
    for (const layer of fillElementLayers.values()) {
      out = replaceTaggedElementLayer(out, layer, "fill");
    }
    for (const layer of strokeElementLayers.values()) {
      out = replaceTaggedElementLayer(out, layer, "stroke");
    }
  } else if (elementLayerCount > 0) {
    out = out.replace(
      /<([a-zA-Z][\w:.-]*)\b([^<>]*?)(\/?)>/gi,
      (match, tagName: string) => {
        const parsedStartTag = parseSvgStartTagMatch(match, tagName);
        let nextAttrs = parsedStartTag.attrs;
        const fillLayerId = readSvgAttribute(nextAttrs, "data-fill-layer-id");
        const strokeLayerId = readSvgAttribute(nextAttrs, "data-stroke-layer-id");
        const fillLayer = fillLayerId ? fillElementLayers.get(fillLayerId) : undefined;
        const strokeLayer = strokeLayerId ? strokeElementLayers.get(strokeLayerId) : undefined;
        if (!fillLayer && !strokeLayer) return match;

        let close = parsedStartTag.close;
        if (fillLayer) {
          const edited = rewriteElementLayerAttrs(nextAttrs, close, fillLayer, "fill");
          nextAttrs = edited.attrs;
          close = edited.close;
        }
        if (strokeLayer) {
          const edited = rewriteElementLayerAttrs(nextAttrs, close, strokeLayer, "stroke");
          nextAttrs = edited.attrs;
          close = edited.close;
        }
        return `<${tagName}${nextAttrs}${close}`;
      },
    );
  }

  layerEditSvgCache.set(layers, { sourceSvg: svg, editedSvg: out });
  return out;
}

function replaceTaggedElementLayer(
  svg: string,
  layer: EditableSvgLayer,
  paintProp: "fill" | "stroke",
): string {
  const attrName =
    paintProp === "stroke" ? "data-stroke-layer-id" : "data-fill-layer-id";
  const id = escapeLayerRegExp(layer.id);
  const elementPattern = new RegExp(
    `<([a-zA-Z][\\w:.-]*)\\b(?=[^<>]*${attrName}=["']${id}["'])([^<>]*?)(?:\\/\\s*>|>\\s*<\\/\\1\\s*>|>)`,
    "gi",
  );

  return svg.replace(
    elementPattern,
    (match, tagName) => {
      const parsedStartTag = parseSvgStartTagMatch(match, String(tagName || "path"));
      const close = shouldForceEmptySvgElementClose(match, String(tagName || ""))
        ? " />"
        : parsedStartTag.close;
      const edited = rewriteElementLayerAttrs(
        parsedStartTag.attrs,
        close,
        layer,
        paintProp,
      );
      return `<${tagName}${edited.attrs}${edited.close}`;
    },
  );
}

export function completeEditableLayersFromTaggedSvg(
  svg: string,
  layers?: ReadonlyArray<EditableSvgLayer>,
): EditableSvgLayer[] | undefined {
  const taggedTargets = collectTaggedPaintTargets(svg);
  if (!layers?.length && taggedTargets.length === 0) return layers ? [...layers] : undefined;

  const targetsById = new Map(taggedTargets.map((target) => [target.id, target]));
  const completed: EditableSvgLayer[] = [];
  const seen = new Set<string>();

  for (const layer of layers || []) {
    const target = targetsById.get(layer.id);
    const color =
      normalizeHexColor(layer.color) ||
      target?.color ||
      normalizeHexColor(layer.originalColor) ||
      "#000000";
    const originalColor =
      normalizeHexColor(layer.originalColor) || target?.color || color;
    completed.push({
      ...layer,
      color,
      originalColor,
      visible: layer.visible !== false,
      kind: layer.kind || target?.kind || "fill",
      opacity: normalizeOpacity(layer.opacity),
      originalOpacity: normalizeOpacity(layer.originalOpacity),
      pathCount: layer.pathCount ?? target?.pathCount,
    });
    seen.add(layer.id);
  }

  for (const target of taggedTargets) {
    if (seen.has(target.id)) continue;
    completed.push({
      id: target.id,
      label: `Layer ${completed.length + 1}`,
      color: target.color,
      originalColor: target.color,
      visible: true,
      opacity: 1,
      originalOpacity: 1,
      kind: target.kind,
      pathCount: target.pathCount,
    });
    seen.add(target.id);
  }

  return completed.length ? completed : layers ? [...layers] : undefined;
}

function hasLayerEdit(layer: EditableSvgLayer): boolean {
  const color = normalizeHexColor(layer.color) || String(layer.color || "");
  const originalColor =
    normalizeHexColor(layer.originalColor) || String(layer.originalColor || "");
  if (color !== originalColor) return true;
  if (layer.visible === false) return true;
  const opacity = normalizeOpacity(layer.opacity);
  const originalOpacity = normalizeOpacity(layer.originalOpacity);
  return Math.abs(opacity - originalOpacity) > 0.0005;
}

function parseSvgElementAttrs(
  attrs: string,
  endTag = ">",
): { attrs: string; close: string } {
  const rawAttrs = String(attrs || "");
  const closeToken = String(endTag || ">");
  const selfClosing = closeToken.trimStart().startsWith("/") || /\/\s*$/.test(rawAttrs);
  return {
    attrs: selfClosing ? rawAttrs.replace(/\s*\/\s*$/, "") : rawAttrs,
    close: selfClosing ? " />" : ">",
  };
}

function parseSvgStartTagMatch(
  match: string,
  tagName: string,
): { attrs: string; close: string } {
  const source = String(match || "");
  const endIndex = source.indexOf(">");
  const startSource = endIndex >= 0 ? source.slice(0, endIndex + 1) : source;
  const openLength = 1 + String(tagName || "").length;
  let rawAttrs = startSource.endsWith(">")
    ? startSource.slice(openLength, -1)
    : startSource.slice(openLength);
  const selfClosing = /\/\s*$/.test(rawAttrs);
  if (selfClosing) rawAttrs = rawAttrs.replace(/\s*\/\s*$/, "");
  return {
    attrs: rawAttrs,
    close: selfClosing ? " />" : ">",
  };
}

function shouldForceEmptySvgElementClose(_match: string, tagName: string): boolean {
  const name = String(tagName || "").toLowerCase();
  return (
    name === "path" ||
    name === "rect" ||
    name === "circle" ||
    name === "ellipse" ||
    name === "line" ||
    name === "polyline" ||
    name === "polygon"
  );
}

function rewriteElementLayerAttrs(
  attrs: string,
  endTag: string,
  layer: EditableSvgLayer,
  paintProp: "fill" | "stroke",
): { attrs: string; close: string } {
  const parsedElement = parseSvgElementAttrs(String(attrs || ""), String(endTag || ">"));
  let nextAttrs = parsedElement.attrs
    .replace(new RegExp(`\\s${paintProp}\\s*=\\s*["'][^"']*["']`, "gi"), "")
    .replace(/\sdisplay\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\sdata-layer-color\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\sdata-layer-editor-hidden\s*=\s*["'][^"']*["']/gi, "");
  nextAttrs = rewriteStyleProperty(nextAttrs, paintProp, layer.color);
  nextAttrs = rewriteStyleProperty(nextAttrs, "display", layer.visible ? null : "none");
  nextAttrs = applyOpacityAttribute(nextAttrs, layer.opacity);
  nextAttrs += ` data-layer-color="${escapeSvgAttribute(layer.color)}"`;
  nextAttrs += ` ${paintProp}="${layer.color}"`;
  if (!layer.visible) {
    nextAttrs += ` display="none" data-layer-editor-hidden="true"`;
  }
  return { attrs: nextAttrs, close: parsedElement.close };
}

function collectSvgGroupLayerIds(svg: string): Set<string> {
  const ids = new Set<string>();
  for (const match of String(svg || "").matchAll(/<g\b([^>]*)>/gi)) {
    const id = readSvgAttribute(match[1] || "", "data-layer-id");
    if (id) ids.add(id);
  }
  return ids;
}

function collectTaggedPaintTargets(svg: string): Array<{
  id: string;
  color: string;
  kind: SvgLayerKind;
  pathCount: number;
}> {
  const targets = new Map<
    string,
    { id: string; color: string; kind: SvgLayerKind; pathCount: number }
  >();
  for (const match of String(svg || "").matchAll(/<([a-zA-Z][\w:.-]*)\b([^<>]*?)(\/?)>/gi)) {
    const tagName = String(match[1] || "").toLowerCase();
    const attrs = String(match[2] || "");
    if (!isTaggedPaintElementVisible(tagName, attrs)) continue;

    const fillLayerId = readSvgAttribute(attrs, "data-fill-layer-id");
    if (fillLayerId) {
      const fill = readElementPaintColor(attrs, "fill");
      if (fill) recordTaggedPaintTarget(targets, fillLayerId, fill, "fill");
    }

    const strokeLayerId = readSvgAttribute(attrs, "data-stroke-layer-id");
    if (strokeLayerId) {
      const stroke = readElementPaintColor(attrs, "stroke");
      if (stroke) recordTaggedPaintTarget(targets, strokeLayerId, stroke, "stroke");
    }
  }
  return Array.from(targets.values());
}

function recordTaggedPaintTarget(
  targets: Map<string, { id: string; color: string; kind: SvgLayerKind; pathCount: number }>,
  id: string,
  color: string,
  kind: SvgLayerKind,
) {
  const key = `${kind}:${id}`;
  const current = targets.get(key);
  if (current) {
    current.pathCount += 1;
    return;
  }
  targets.set(key, { id, color, kind, pathCount: 1 });
}

function isTaggedPaintElementVisible(tagName: string, attrs: string): boolean {
  if (tagName === "path" && !readSvgAttribute(attrs, "d")) return false;
  if (readSvgAttribute(attrs, "display")?.toLowerCase() === "none") return false;
  if (readSvgAttribute(attrs, "visibility")?.toLowerCase() === "hidden") return false;
  if (isZeroOpacity(readSvgAttribute(attrs, "opacity"))) return false;
  const style = readSvgAttribute(attrs, "style") || "";
  return !/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\D|$)/i.test(style);
}

function readElementPaintColor(attrs: string, paint: "fill" | "stroke"): string | null {
  const value =
    readStylePropertyValue(attrs, paint) ||
    readSvgAttribute(attrs, paint) ||
    readSvgAttribute(attrs, "data-layer-color") ||
    "";
  if (!value || value === "none" || /^url\(/i.test(value) || /^currentColor$/i.test(value)) {
    return null;
  }
  return normalizeHexColor(value);
}

export function LayerPaletteEditor({
  item,
  onColorChange,
  onOpacityChange,
  onVisibilityChange,
  onResetLayer,
  onResetAll,
}: {
  item: LayeredHistoryItem;
  onColorChange: (layerId: string, color: string) => void;
  onOpacityChange?: (layerId: string, opacity: number) => void;
  onVisibilityChange: (layerId: string, visible: boolean) => void;
  onResetLayer: (layerId: string) => void;
  onResetAll: () => void;
}) {
  const [resetSignal, setResetSignal] = React.useState(0);
  const handleResetAll = React.useCallback(() => {
    setResetSignal((value) => value + 1);
    onResetAll();
  }, [onResetAll]);

  if (!item.layers?.length) return null;

  return (
    <div
      data-layer-palette-editor="true"
      className="my-2 min-w-0 max-w-full overflow-x-hidden rounded-lg border border-slate-200 bg-slate-50 p-2"
    >
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-slate-700">
          Layer colors
        </span>
        <button
          type="button"
          onClick={handleResetAll}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-semibold text-slate-700 cursor-pointer transition-colors hover:bg-slate-100"
        >
          Reset all
        </button>
      </div>

      <div className="grid max-h-[24rem] min-w-0 max-w-full gap-2 overflow-y-auto overflow-x-hidden pr-1">
        {item.layers.map((layer) => (
          <LayerPaletteRow
            key={layer.id}
            layer={layer}
            onColorChange={onColorChange}
            onOpacityChange={onOpacityChange}
            onVisibilityChange={onVisibilityChange}
            onResetLayer={onResetLayer}
            resetSignal={resetSignal}
          />
        ))}
      </div>
    </div>
  );
}

export function LayeredTraceControls({
  settings,
  onChange,
}: {
  settings: LayeredTraceSettings;
  onChange: (patch: Partial<LayeredTraceSettings>) => void;
}) {
  return (
    <>
      <LayerControlField label="SVG mode">
        <select
          value={settings.traceMode}
          onChange={(event) =>
            onChange({ traceMode: event.target.value as TraceMode })
          }
          className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
        >
          <option value="layered">Layered color</option>
          <option value="single">Single-color trace</option>
        </select>
      </LayerControlField>

      {settings.traceMode === "layered" && (
        <>
          <LayerControlField label={`Color layers (${settings.colorLayerCount})`}>
            <CommittedNumberInput
              value={settings.colorLayerCount}
              min={2}
              max={10}
              step={1}
              onCommit={(value) =>
                onChange({ colorLayerCount: Math.round(value) })
              }
            />
          </LayerControlField>

          <LayerControlField label="Trace detail size">
            <select
              value={settings.layerMaxTraceSide}
              onChange={(event) =>
                onChange({ layerMaxTraceSide: Number(event.target.value) })
              }
              className="w-full px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900 cursor-pointer transition-colors hover:bg-slate-50"
            >
              <option value={900}>Fast preview</option>
              <option value={1200}>Balanced</option>
              <option value={1600}>Detailed</option>
              <option value={2000}>High detail</option>
              <option value={2400}>Maximum detail</option>
            </select>
          </LayerControlField>

          <LayerControlField
            label={`Minimum layer size (${settings.minRegionPercent}%)`}
          >
            <CommittedNumberInput
              value={settings.minRegionPercent}
              min={0}
              max={5}
              step={0.05}
              onCommit={(value) => onChange({ minRegionPercent: value })}
            />
          </LayerControlField>

          <LayerControlField label="Posterize colors">
            <input
              type="checkbox"
              checked={settings.posterize}
              onChange={(event) => onChange({ posterize: event.target.checked })}
              className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
            />
          </LayerControlField>

          <LayerControlField label="Remove white background">
            <input
              type="checkbox"
              checked={settings.removeWhite}
              onChange={(event) =>
                onChange({ removeWhite: event.target.checked })
              }
              className="h-4 w-4 accent-[#0b2dff] cursor-pointer"
            />
          </LayerControlField>

          <LayerControlField label="Layer speckle removal">
            <CommittedNumberInput
              value={settings.layerTurdSize}
              min={0}
              max={20}
              step={1}
              onCommit={(value) => onChange({ layerTurdSize: value })}
            />
          </LayerControlField>

          <LayerControlField label="Layer curve tolerance">
            <CommittedNumberInput
              value={settings.layerOptTolerance}
              min={0.05}
              max={1.2}
              step={0.05}
              onCommit={(value) => onChange({ layerOptTolerance: value })}
            />
          </LayerControlField>
        </>
      )}
    </>
  );
}

function LayerPaletteRow({
  layer,
  onColorChange,
  onOpacityChange,
  onVisibilityChange,
  onResetLayer,
  resetSignal,
}: {
  layer: EditableSvgLayer;
  onColorChange: (layerId: string, color: string) => void;
  onOpacityChange?: (layerId: string, opacity: number) => void;
  onVisibilityChange: (layerId: string, visible: boolean) => void;
  onResetLayer: (layerId: string) => void;
  resetSignal: number;
}) {
  const safeLayerColor =
    normalizeHexColor(layer.color) ||
    normalizeHexColor(layer.originalColor) ||
    "#000000";
  const colorCommit = useThrottledCommit({
    value: safeLayerColor,
    delayMs: 180,
    leading: false,
    normalize: normalizeHexColor,
    onCommit: React.useCallback(
      (color: string) => {
        if (color !== normalizeHexColor(layer.color)) {
          onColorChange(layer.id, color);
        }
      },
      [layer.color, layer.id, onColorChange],
    ),
  });
  const opacityCommit = useThrottledCommit({
    value: Math.round(normalizeOpacity(layer.opacity) * 100),
    delayMs: 300,
    leading: false,
    normalize: normalizeOpacityPercent,
    onCommit: React.useCallback(
      (opacityPercent: number) => {
        if (!onOpacityChange) return;
        const opacity = normalizeOpacity(opacityPercent / 100);
        if (opacity !== normalizeOpacity(layer.opacity)) {
          onOpacityChange(layer.id, opacity);
        }
      },
      [layer.id, layer.opacity, onOpacityChange],
    ),
  });

  const resetLayer = React.useCallback(() => {
    colorCommit.cancel();
    opacityCommit.cancel();
    onResetLayer(layer.id);
  }, [colorCommit, layer.id, onResetLayer, opacityCommit]);

  const handleColorInput = React.useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      colorCommit.schedule(event.currentTarget.value);
    },
    [colorCommit],
  );

  const handleColorChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      colorCommit.schedule(event.currentTarget.value);
    },
    [colorCommit],
  );

  const flushColor = React.useCallback(() => colorCommit.flush(), [colorCommit]);
  const colorInputRef = useNativeColorFinalCommit((value) =>
    colorCommit.flush(value),
  );

  const handleOpacityInput = React.useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      opacityCommit.schedule(Number(event.currentTarget.value));
    },
    [opacityCommit],
  );

  const handleOpacityChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      opacityCommit.schedule(Number(event.currentTarget.value));
    },
    [opacityCommit],
  );

  const flushOpacity = React.useCallback(
    () => opacityCommit.flush(),
    [opacityCommit],
  );

  React.useEffect(() => {
    colorCommit.cancel();
    opacityCommit.cancel();
  }, [colorCommit.cancel, opacityCommit.cancel, resetSignal]);

  return (
    <div className="grid min-w-0 max-w-full gap-2 overflow-x-hidden rounded-md border border-slate-200 bg-white px-2 py-1.5">
      <div className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto]">
        <input
          type="checkbox"
          checked={layer.visible}
          onChange={(event) => onVisibilityChange(layer.id, event.target.checked)}
          title={`Show ${layer.label}`}
          className="h-4 w-4 accent-[#0b2dff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        />

        <input
          ref={colorInputRef}
          type="color"
          value={colorCommit.draft}
          onInput={handleColorInput}
          onChange={handleColorChange}
          onPointerUp={flushColor}
          onMouseUp={flushColor}
          onTouchEnd={flushColor}
          onBlur={flushColor}
          title={`Change ${layer.label} color`}
          aria-label={`${layer.label} color ${colorCommit.draft}`}
          className="h-7 w-10 rounded-md border border-slate-200 bg-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        />

        <span className="grid min-w-0 gap-0.5 text-[12px] text-slate-700">
          <span className="min-w-0 truncate font-semibold">{layer.label}</span>
          <span className="min-w-0 truncate text-[11px] text-slate-400">
            Original color {layer.originalColor}
          </span>
        </span>
        <button
          type="button"
          onClick={resetLayer}
          className="col-span-3 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] font-medium text-slate-700 cursor-pointer transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:col-span-1"
        >
          Reset
        </button>
      </div>

      {onOpacityChange && (
        <label className="grid min-w-0 max-w-full gap-1 text-[11px] text-slate-600">
          <span className="shrink-0">Opacity {opacityCommit.draft}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={opacityCommit.draft}
            onInput={handleOpacityInput}
            onChange={handleOpacityChange}
            onPointerUp={flushOpacity}
            onMouseUp={flushOpacity}
            onTouchEnd={flushOpacity}
            onKeyUp={flushOpacity}
            onBlur={flushOpacity}
            className="min-w-0 flex-1 cursor-pointer accent-[#0b2dff]"
          />
        </label>
      )}

    </div>
  );
}

function LayerControlField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 max-w-full gap-2 rounded-lg border border-[#edf2fb] bg-[#fafcff] px-3 py-2 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] sm:items-center">
      <span className="min-w-0 break-words text-[13px] text-slate-700">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
    </label>
  );
}

function CommittedNumberInput({
  value,
  min,
  max,
  step,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = React.useState(String(value));

  React.useEffect(() => {
    setDraft((current) => (current === String(value) ? current : String(value)));
  }, [value]);

  function commit() {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft((current) => (current === String(value) ? current : String(value)));
      return;
    }

    const clamped = Math.max(min, Math.min(max, parsed));
    setDraft((current) => (current === String(clamped) ? current : String(clamped)));
    if (clamped !== value) onCommit(clamped);
  }

  return (
    <input
      type="number"
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      className="w-full min-w-0 max-w-[160px] rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 sm:w-[110px]"
    />
  );
}

function rewriteStyleProperty(
  attrs: string,
  property: string,
  value: string | null,
): string {
  const styleMatch = String(attrs).match(/\bstyle\s*=\s*(["'])([^"']*)\1/i);
  if (!styleMatch) {
    if (value == null) return attrs;
    return `${attrs} style="${property}:${value}"`;
  }

  const quote = styleMatch[1];
  const styleBody = styleMatch[2];
  const parts = styleBody
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !new RegExp(`^${property}\\s*:`, "i").test(part));

  if (value != null) parts.push(`${property}:${value}`);

  if (parts.length === 0) {
    return attrs.replace(/\sstyle\s*=\s*(["'])[^"']*\1/i, "");
  }

  const nextStyle = parts.join("; ");
  return attrs.replace(
    /\bstyle\s*=\s*(["'])[^"']*\1/i,
    `style=${quote}${nextStyle}${quote}`,
  );
}

function readStylePropertyValue(attrs: string, property: string): string | null {
  const style = readSvgAttribute(attrs, "style");
  if (!style) return null;
  const pattern = new RegExp(`(?:^|;)\\s*${escapeLayerRegExp(property)}\\s*:\\s*([^;]+)`, "i");
  return style.match(pattern)?.[1]?.trim() || null;
}

function readSvgAttribute(attrs: string, attribute: string): string | null {
  const match = String(attrs || "").match(
    new RegExp(`\\s${escapeLayerRegExp(attribute)}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"),
  );
  return match?.[2]?.trim() || null;
}

function isZeroOpacity(value: string | null): boolean {
  if (value == null || value === "") return false;
  const number = Number(value);
  return Number.isFinite(number) && number <= 0.001;
}

function applyOpacityAttribute(attrs: string, opacity?: number): string {
  if (opacity == null) return attrs;
  const value = normalizeOpacity(opacity);
  let nextAttrs = String(attrs)
    .replace(/\sopacity\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\sdata-editor-opacity\s*=\s*["'][^"']*["']/gi, "");
  nextAttrs = rewriteStyleProperty(nextAttrs, "opacity", null);

  if (value >= 0.999) return nextAttrs;
  return `${nextAttrs} opacity="${formatOpacity(value)}" data-editor-opacity="true"`;
}

function normalizeOpacity(value?: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, Number(value)));
}

function normalizeOpacityPercent(value: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 100;
  return Math.round(Math.max(0, Math.min(100, number)));
}

function normalizeHexColor(value: string): string | null {
  const raw = String(value || "").trim().toLowerCase();
  const short = raw.match(/^#?([0-9a-f]{3})$/i);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  const full = raw.match(/^#?([0-9a-f]{6})$/i);
  if (!full) return null;
  return `#${full[1]}`;
}

function formatOpacity(value: number): string {
  return normalizeOpacity(value)
    .toFixed(3)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function escapeLayerRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeSvgAttribute(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
