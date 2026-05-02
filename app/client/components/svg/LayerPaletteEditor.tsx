import * as React from "react";
import { useThrottledCommit } from "~/client/hooks/useThrottledCommit";

export type SvgLayerKind = "fill" | "stroke";

export type SvgLayerMeta = {
  id: string;
  label: string;
  color: string;
  originalColor: string;
  visible: boolean;
  opacity?: number;
  originalOpacity?: number;
  kind?: SvgLayerKind;
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

  let out = svg;

  for (const layer of layers) {
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
        .replace(/\sdisplay\s*=\s*["'][^"']*["']/gi, "");

      nextAttrs = rewriteStyleProperty(nextAttrs, groupPaintProp, layer.color);
      nextAttrs = rewriteStyleProperty(
        nextAttrs,
        "display",
        layer.visible ? null : "none",
      );
      nextAttrs = applyOpacityAttribute(nextAttrs, layer.opacity);
      nextAttrs += ` ${groupPaintProp}="${layer.color}"`;
      if (!layer.visible) nextAttrs += ` display="none"`;

      const childPaintPattern = new RegExp(
        `\\s${groupPaintProp}\\s*=\\s*["'][^"']*["']`,
        "gi",
      );
      const normalizedInner = inner.replace(
        /<path\b([^>]*?)(\/?)>/gi,
        (pathMatch: string, pathAttrs: string, closeMark: string) => {
          const nextPathAttrs = String(pathAttrs).replace(childPaintPattern, "");
          return `<path${nextPathAttrs}${closeMark}>`;
        },
      );

      return `<g${nextAttrs}>${normalizedInner}${close}`;
    });

    const attrName =
      (layer.kind || "fill") === "stroke"
        ? "data-stroke-layer-id"
        : "data-fill-layer-id";
    const paintProp = (layer.kind || "fill") === "stroke" ? "stroke" : "fill";
    const elementPattern = new RegExp(
      `(<([a-zA-Z][\\w:.-]*)(?=[^>]*${attrName}=["']${id}["'])([^>]*?))(\\/?>)`,
      "gi",
    );

    out = out.replace(
      elementPattern,
      (_match, _start, tagName, attrs, endTag) => {
        let nextAttrs = String(attrs)
          .replace(
            new RegExp(`\\s${paintProp}\\s*=\\s*["'][^"']*["']`, "gi"),
            "",
          )
          .replace(/\sdisplay\s*=\s*["'][^"']*["']/gi, "");
        nextAttrs = rewriteStyleProperty(nextAttrs, paintProp, layer.color);
        nextAttrs = rewriteStyleProperty(
          nextAttrs,
          "display",
          layer.visible ? null : "none",
        );
        nextAttrs = applyOpacityAttribute(nextAttrs, layer.opacity);
        nextAttrs += ` ${paintProp}="${layer.color}"`;
        if (!layer.visible) nextAttrs += ` display="none"`;
        return `<${tagName}${nextAttrs}${endTag}`;
      },
    );
  }

  layerEditSvgCache.set(layers, { sourceSvg: svg, editedSvg: out });
  return out;
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
    <div className="my-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="flex items-center justify-between gap-2 mb-2">
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

      <div className="grid gap-2">
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
    delayMs: 120,
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
    delayMs: 120,
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
      colorCommit.flush(event.currentTarget.value);
    },
    [colorCommit],
  );

  const flushColor = React.useCallback(() => colorCommit.flush(), [colorCommit]);

  const handleOpacityInput = React.useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      opacityCommit.schedule(Number(event.currentTarget.value));
    },
    [opacityCommit],
  );

  const handleOpacityChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      opacityCommit.flush(Number(event.currentTarget.value));
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
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          type="checkbox"
          checked={layer.visible}
          onChange={(event) => onVisibilityChange(layer.id, event.target.checked)}
          title={`Show ${layer.label}`}
          className="h-4 w-4 accent-[#0b2dff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        />

        <input
          type="color"
          value={colorCommit.draft}
          onInput={handleColorInput}
          onChange={handleColorChange}
          onPointerUp={flushColor}
          onMouseUp={flushColor}
          onTouchEnd={flushColor}
          onBlur={flushColor}
          title={`Change ${layer.label} color`}
          className="h-7 w-10 rounded-md border border-slate-200 bg-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        />

        <span className="min-w-0 flex-1 truncate text-[12px] text-slate-700">
          {layer.label} {layer.originalColor}
        </span>
      </div>

      {onOpacityChange && (
        <label className="flex min-w-[140px] items-center gap-1.5 text-[11px] text-slate-600">
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
            onBlur={flushOpacity}
            className="min-w-0 flex-1 cursor-pointer accent-[#0b2dff]"
          />
        </label>
      )}

      <button
        type="button"
        onClick={resetLayer}
        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] font-medium text-slate-700 cursor-pointer transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      >
        Reset
      </button>
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
    <label className="flex items-center gap-2 bg-[#fafcff] border border-[#edf2fb] rounded-lg px-3 py-2 min-w-0">
      <span className="min-w-[180px] text-[13px] text-slate-700 shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-2 flex-1 min-w-0">{children}</div>
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
      className="w-[110px] px-2 py-1.5 rounded-md border border-[#dbe3ef] bg-white text-slate-900"
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
