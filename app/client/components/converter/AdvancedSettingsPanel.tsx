import * as React from "react";
import Icons from "~/client/assets/icons/Icons";
import { ChevronDownIcon } from "~/client/components/converter/PresetSelector";
import type { ConverterRouteCapabilities } from "~/client/lib/converter/routeCapabilities";
import {
  DEFAULT_TRACE_ADVANCED_SETTINGS,
  normalizeColorList,
  normalizeHexColor,
  type RemoveColorApplyTo,
  type SortLayersBy,
  type TraceAdvancedSettings,
} from "~/client/lib/converter/settings";

type TurnPolicy = "black" | "white" | "left" | "right" | "minority" | "majority";
type TraceMode = "single" | "layered";

export type MixedTraceSettings = TraceAdvancedSettings & {
  traceMode: TraceMode;
  threshold: number;
  turdSize: number;
  optTolerance: number;
  turnPolicy: TurnPolicy;
  lineColor: string;
  invert: boolean;
  transparent: boolean;
  bgColor: string;
  preprocess: "none" | "edge";
  blurSigma: number;
  edgeBoost: number;
  colorLayerCount?: number;
  layerMaxTraceSide?: number;
  minRegionPercent?: number;
  layerOptTolerance?: number;
  layerTurdSize?: number;
  layerTurnPolicy?: TurnPolicy;
  posterize?: boolean;
  removeWhite?: boolean;
  removeTransparent?: boolean;
};

type Props<TSettings extends MixedTraceSettings> = {
  id?: string;
  open: boolean;
  settings: TSettings;
  setSettings: React.Dispatch<React.SetStateAction<TSettings>>;
  capabilities: ConverterRouteCapabilities;
  buttonDisabled?: boolean;
  onUpdatePreview: () => void;
};

export type LayeredTraceSettings = TraceAdvancedSettings & {
  layerCount: number;
  maxTraceSide: number;
  minRegionPercent: number;
  optTolerance: number;
  turdSize: number;
  turnPolicy: TurnPolicy;
  posterize: boolean;
  removeWhite: boolean;
  removeTransparent: boolean;
  transparent: boolean;
  bgColor: string;
};

export type SvgRasterExportSettings = {
  width: number;
  height: number;
  lockAspect: boolean;
  dpiScale: number;
  background: "transparent" | "solid";
  bgColor: string;
  antiAlias: boolean;
  fileName: string;
};

type LayeredProps<TSettings extends LayeredTraceSettings> = {
  id?: string;
  open: boolean;
  settings: TSettings;
  setSettings: React.Dispatch<React.SetStateAction<TSettings>>;
  capabilities: ConverterRouteCapabilities;
  buttonDisabled?: boolean;
  onUpdatePreview: () => void;
};

type SvgRasterExportProps<TSettings extends SvgRasterExportSettings> = {
  id?: string;
  open: boolean;
  settings: TSettings;
  setSettings: React.Dispatch<React.SetStateAction<TSettings>>;
  aspect?: number | null;
};

export function TraceAdvancedSettingsPanel<TSettings extends MixedTraceSettings>({
  id = "advanced-settings",
  open,
  settings,
  setSettings,
  capabilities,
  buttonDisabled = false,
  onUpdatePreview,
}: Props<TSettings>) {
  const [draftColor, setDraftColor] = React.useState("#ffffff");

  if (!open) return null;

  const merged = { ...DEFAULT_TRACE_ADVANCED_SETTINGS, ...settings };
  const traceMode = settings.traceMode || "single";
  const showLayered = capabilities.supportsLayeredTrace && traceMode === "layered";
  const showSingleTrace = capabilities.supportsSingleTrace && traceMode !== "layered";
  const showAlpha = capabilities.supportsAlpha && !capabilities.supportsCutFriendlyOutput;
  const showSelectedColors = capabilities.supportsSelectedColorRemoval;
  const showCleanup = capabilities.supportsMaskCleanup && showSingleTrace;

  function patch(patchValue: Partial<TSettings>) {
    setSettings((current) => ({ ...current, ...patchValue }) as TSettings);
  }

  function addRemoveColor() {
    const normalized = normalizeHexColor(draftColor);
    if (!normalized) return;
    const next = normalizeColorList([...(merged.removeColors || []), normalized]);
    patch({ removeColors: next } as Partial<TSettings>);
  }

  function removeRemoveColor(color: string) {
    patch({
      removeColors: (merged.removeColors || []).filter((item) => item !== color),
    } as Partial<TSettings>);
  }

  return (
    <div id={id} className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
        <span>
          Advanced changes do not live preview automatically. Click Update
          preview to apply these settings.
        </span>
        <button
          type="button"
          onClick={onUpdatePreview}
          disabled={buttonDisabled}
          className={[
            "shrink-0 rounded-md border px-2.5 py-1 font-semibold transition-colors cursor-pointer",
            "border-slate-300 bg-white text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          Update preview
        </button>
      </div>

      <SettingSection title="Trace detail">
        {capabilities.supportsLayeredTrace && capabilities.supportsSingleTrace && (
          <Field label="SVG mode">
            <Select
              value={traceMode}
              onChange={(value) => patch({ traceMode: value as TraceMode } as Partial<TSettings>)}
              options={[
                ["layered", "Layered color"],
                ["single", "Single-color trace"],
              ]}
            />
          </Field>
        )}

        {showSingleTrace && (
          <>
            <Field label={`Threshold (${settings.threshold})`}>
              <Range
                value={settings.threshold}
                min={0}
                max={255}
                step={1}
                onCommit={(value) => patch({ threshold: value } as Partial<TSettings>)}
              />
            </Field>
            <Field label="Turd size">
              <NumberInput
                value={settings.turdSize}
                min={0}
                max={20}
                step={1}
                onCommit={(value) => patch({ turdSize: Math.round(value) } as Partial<TSettings>)}
              />
            </Field>
            <Field label="Curve tolerance">
              <NumberInput
                value={settings.optTolerance}
                min={0.05}
                max={2}
                step={0.05}
                onCommit={(value) => patch({ optTolerance: value } as Partial<TSettings>)}
              />
            </Field>
            <Field label="Turn policy">
              <TurnPolicySelect
                value={settings.turnPolicy}
                onChange={(value) => patch({ turnPolicy: value } as Partial<TSettings>)}
              />
            </Field>
          </>
        )}

        {capabilities.supportsOutputGeometry && (
          <Field label="Internal trace size">
            <Select
              value={String(merged.maxTraceSide)}
              onChange={(value) => patch({ maxTraceSide: Number(value) } as Partial<TSettings>)}
              options={[
                ["900", "Fast preview"],
                ["1200", "Balanced"],
                ["1600", "Detailed"],
                ["2000", "High detail"],
                ["2400", "Maximum detail"],
                ["3000", "Original-detail cap"],
              ]}
            />
          </Field>
        )}
      </SettingSection>

      {showLayered && (
        <SettingSection title="Color and layers">
          <Field label={`Color layers (${settings.colorLayerCount ?? 5})`}>
            <Range
              value={settings.colorLayerCount ?? 5}
              min={2}
              max={12}
              step={1}
              onCommit={(value) => patch({ colorLayerCount: Math.round(value) } as Partial<TSettings>)}
            />
          </Field>
          <Field label="Layer trace size">
            <Select
              value={String(settings.layerMaxTraceSide ?? merged.maxTraceSide)}
              onChange={(value) =>
                patch({
                  layerMaxTraceSide: Number(value),
                  maxTraceSide: Number(value),
                } as Partial<TSettings>)
              }
              options={[
                ["900", "Fast preview"],
                ["1200", "Balanced"],
                ["1600", "Detailed"],
                ["2000", "High detail"],
                ["2400", "Maximum detail"],
                ["3000", "Original-detail cap"],
              ]}
            />
          </Field>
          <Field label={`Minimum layer size (${settings.minRegionPercent ?? 0.35}%)`}>
            <NumberInput
              value={settings.minRegionPercent ?? 0.35}
              min={0}
              max={5}
              step={0.05}
              onCommit={(value) => patch({ minRegionPercent: value } as Partial<TSettings>)}
            />
          </Field>
          <Field label="Posterize colors">
            <Checkbox
              checked={Boolean(settings.posterize)}
              onChange={(checked) => patch({ posterize: checked } as Partial<TSettings>)}
            />
          </Field>
          <Field label={`Posterize strength (${merged.posterizeStrength})`}>
            <Range
              value={merged.posterizeStrength}
              min={2}
              max={8}
              step={1}
              onCommit={(value) =>
                patch({ posterizeStrength: Math.round(value) } as Partial<TSettings>)
              }
            />
          </Field>
          <Field label="Remove white background">
            <Checkbox
              checked={Boolean(settings.removeWhite)}
              onChange={(checked) => patch({ removeWhite: checked } as Partial<TSettings>)}
            />
          </Field>
          <Field label="Remove transparent pixels">
            <Checkbox
              checked={settings.removeTransparent !== false}
              onChange={(checked) => patch({ removeTransparent: checked } as Partial<TSettings>)}
            />
          </Field>
          <Field label={`Color merge tolerance (${merged.colorMergeTolerance})`}>
            <Range
              value={merged.colorMergeTolerance}
              min={0}
              max={80}
              step={1}
              onCommit={(value) =>
                patch({ colorMergeTolerance: Math.round(value) } as Partial<TSettings>)
              }
            />
          </Field>
          <Field label="Layer order">
            <Select
              value={merged.sortLayersBy}
              onChange={(value) =>
                patch({ sortLayersBy: value as SortLayersBy } as Partial<TSettings>)
              }
              options={[
                ["luminance", "Light to dark"],
                ["area", "Largest first"],
                ["original", "Palette order"],
              ]}
            />
          </Field>
        </SettingSection>
      )}

      <SettingSection title="Edges and cleanup">
        {capabilities.supportsEdgePreprocess && (
          <Field label="Preprocess">
            <Select
              value={settings.preprocess}
              onChange={(value) =>
                patch({ preprocess: value as "none" | "edge" } as Partial<TSettings>)
              }
              options={[
                ["none", "None (line art)"],
                ["edge", "Edge (photo/painting)"],
              ]}
            />
          </Field>
        )}

        {settings.preprocess === "edge" && (
          <>
            <Field label={`Blur sigma (${settings.blurSigma})`}>
              <NumberInput
                value={settings.blurSigma}
                min={0}
                max={6}
                step={0.1}
                onCommit={(value) => patch({ blurSigma: value } as Partial<TSettings>)}
              />
            </Field>
            <Field label={`Edge boost (${settings.edgeBoost})`}>
              <NumberInput
                value={settings.edgeBoost}
                min={0.25}
                max={3}
                step={0.1}
                onCommit={(value) => patch({ edgeBoost: value } as Partial<TSettings>)}
              />
            </Field>
            <Field label={`Edge threshold (${merged.edgeThreshold})`}>
              <Range
                value={merged.edgeThreshold}
                min={0}
                max={160}
                step={1}
                onCommit={(value) =>
                  patch({ edgeThreshold: Math.round(value) } as Partial<TSettings>)
                }
              />
            </Field>
            <Field label={`Edge thickness (${merged.edgeThickness})`}>
              <Range
                value={merged.edgeThickness}
                min={1}
                max={4}
                step={1}
                onCommit={(value) =>
                  patch({ edgeThickness: Math.round(value) } as Partial<TSettings>)
                }
              />
            </Field>
          </>
        )}

        {capabilities.supportsVisualEffects && (
          <>
            <Field label={`Brightness (${merged.brightness})`}>
              <Range
                value={merged.brightness}
                min={-50}
                max={50}
                step={1}
                onCommit={(value) =>
                  patch({ brightness: Math.round(value) } as Partial<TSettings>)
                }
              />
            </Field>
            <Field label={`Contrast (${merged.contrast})`}>
              <Range
                value={merged.contrast}
                min={-50}
                max={75}
                step={1}
                onCommit={(value) =>
                  patch({ contrast: Math.round(value) } as Partial<TSettings>)
                }
              />
            </Field>
          </>
        )}

        {showCleanup && (
          <>
            <Field label={`Remove islands under ${merged.minIslandPx}px`}>
              <Range
                value={merged.minIslandPx}
                min={0}
                max={80}
                step={1}
                onCommit={(value) =>
                  patch({ minIslandPx: Math.round(value) } as Partial<TSettings>)
                }
              />
            </Field>
            <Field label={`Fill holes under ${merged.holeFillPx}px`}>
              <Range
                value={merged.holeFillPx}
                min={0}
                max={80}
                step={1}
                onCommit={(value) =>
                  patch({ holeFillPx: Math.round(value) } as Partial<TSettings>)
                }
              />
            </Field>
            <Field label={`Close gaps (${merged.gapCloseStrength})`}>
              <Range
                value={merged.gapCloseStrength}
                min={0}
                max={3}
                step={1}
                onCommit={(value) =>
                  patch({ gapCloseStrength: Math.round(value) } as Partial<TSettings>)
                }
              />
            </Field>
          </>
        )}
      </SettingSection>

      {showSelectedColors && (
        <SettingSection title="Remove selected colors">
          <Field label="Color to remove">
            <input
              type="color"
              value={draftColor}
              onChange={(event) => setDraftColor(event.target.value)}
              className="h-7 w-14 cursor-pointer rounded-md border border-[#dbe3ef] bg-white"
              aria-label="Pick color to remove"
            />
            <button
              type="button"
              onClick={addRemoveColor}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-800 transition-colors cursor-pointer hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Add
            </button>
          </Field>
          {(merged.removeColors || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(merged.removeColors || []).map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => removeRemoveColor(color)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  title={`Remove ${color} from list`}
                >
                  <span
                    className="h-3 w-3 rounded-sm border border-slate-300"
                    style={{ background: color }}
                    aria-hidden="true"
                  />
                  {color}
                  <span aria-hidden="true">x</span>
                </button>
              ))}
            </div>
          )}
          <Field label={`Color tolerance (${merged.removeColorTolerance})`}>
            <Range
              value={merged.removeColorTolerance}
              min={0}
              max={160}
              step={1}
              onCommit={(value) =>
                patch({ removeColorTolerance: Math.round(value) } as Partial<TSettings>)
              }
            />
          </Field>
          {capabilities.supportsSingleTrace && capabilities.supportsLayeredTrace && (
            <Field label="Apply color removal to">
              <Select
                value={merged.removeColorApplyTo}
                onChange={(value) =>
                  patch({
                    removeColorApplyTo: value as RemoveColorApplyTo,
                  } as Partial<TSettings>)
                }
                options={[
                  ["both", "Both modes"],
                  ["single", "Single trace"],
                  ["layered", "Layered trace"],
                ]}
              />
            </Field>
          )}
        </SettingSection>
      )}

      <SettingSection title="Appearance">
        {showSingleTrace && (
          <>
            <Field label="Line color">
              <ColorInput
                value={settings.lineColor}
                onCommit={(value) => patch({ lineColor: value } as Partial<TSettings>)}
              />
            </Field>
            {showAlpha && (
              <Field label={`Fill opacity (${Math.round(merged.fillAlpha * 100)}%)`}>
                <Range
                  value={Math.round(merged.fillAlpha * 100)}
                  min={10}
                  max={100}
                  step={1}
                  onCommit={(value) =>
                    patch({ fillAlpha: value / 100 } as Partial<TSettings>)
                  }
                />
              </Field>
            )}
            <Field label="Invert line art">
              <Checkbox
                checked={settings.invert}
                onChange={(checked) => {
                  if (!checked) {
                    patch({ invert: false } as Partial<TSettings>);
                    return;
                  }
                  patch({
                    invert: true,
                    transparent: false,
                    bgColor:
                      settings.bgColor?.toLowerCase() === "#ffffff"
                        ? "#0b1020"
                        : settings.bgColor,
                    lineColor:
                      settings.lineColor?.toLowerCase() === "#000000"
                        ? "#ffffff"
                        : settings.lineColor,
                  } as Partial<TSettings>);
                }}
              />
            </Field>
          </>
        )}

        {showLayered && showAlpha && (
          <Field label={`Layer opacity (${Math.round(merged.layerAlpha * 100)}%)`}>
            <Range
              value={Math.round(merged.layerAlpha * 100)}
              min={10}
              max={100}
              step={1}
              onCommit={(value) =>
                patch({ layerAlpha: value / 100 } as Partial<TSettings>)
              }
            />
          </Field>
        )}

        {capabilities.supportsBackground && (
          <Field label="Background">
            <Checkbox
              checked={settings.transparent}
              onChange={(checked) => patch({ transparent: checked } as Partial<TSettings>)}
            />
            <span className="text-[13px] text-slate-700">Transparent</span>
            <ColorInput
              value={settings.bgColor}
              disabled={settings.transparent}
              title={
                settings.transparent
                  ? "Uncheck to pick a background color"
                  : "Pick background color"
              }
              onCommit={(value) => patch({ bgColor: value } as Partial<TSettings>)}
            />
          </Field>
        )}

        {showAlpha && !settings.transparent && (
          <Field label={`Background opacity (${Math.round(merged.backgroundAlpha * 100)}%)`}>
            <Range
              value={Math.round(merged.backgroundAlpha * 100)}
              min={10}
              max={100}
              step={1}
              onCommit={(value) =>
                patch({ backgroundAlpha: value / 100 } as Partial<TSettings>)
              }
            />
          </Field>
        )}
      </SettingSection>

      {capabilities.supportsOutputGeometry && !capabilities.supportsCutFriendlyOutput && (
        <SettingSection title="Output geometry">
          <Field label="SVG width">
            <NumberInput
              value={merged.outputWidth}
              min={0}
              max={6000}
              step={1}
              onCommit={(value) =>
                patch({ outputWidth: Math.round(value) } as Partial<TSettings>)
              }
            />
          </Field>
          <Field label="SVG height">
            <NumberInput
              value={merged.outputHeight}
              min={0}
              max={6000}
              step={1}
              onCommit={(value) =>
                patch({ outputHeight: Math.round(value) } as Partial<TSettings>)
              }
            />
          </Field>
          <Field label="Preserve aspect ratio">
            <Checkbox
              checked={merged.preserveAspectRatio}
              onChange={(checked) =>
                patch({ preserveAspectRatio: checked } as Partial<TSettings>)
              }
            />
          </Field>
        </SettingSection>
      )}
    </div>
  );
}

export function LayeredAdvancedSettingsPanel<
  TSettings extends LayeredTraceSettings,
>({
  id = "advanced-settings",
  open,
  settings,
  setSettings,
  capabilities,
  buttonDisabled = false,
  onUpdatePreview,
}: LayeredProps<TSettings>) {
  const [draftColor, setDraftColor] = React.useState("#ffffff");

  if (!open) return null;

  const merged = { ...DEFAULT_TRACE_ADVANCED_SETTINGS, ...settings };

  function patch(patchValue: Partial<TSettings>) {
    setSettings((current) => ({ ...current, ...patchValue }) as TSettings);
  }

  function addRemoveColor() {
    const normalized = normalizeHexColor(draftColor);
    if (!normalized) return;
    const next = normalizeColorList([...(merged.removeColors || []), normalized]);
    patch({ removeColors: next } as Partial<TSettings>);
  }

  function removeRemoveColor(color: string) {
    patch({
      removeColors: (merged.removeColors || []).filter((item) => item !== color),
    } as Partial<TSettings>);
  }

  return (
    <div id={id} className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
        <span>
          Advanced changes do not live preview automatically. Click Update
          preview to apply these settings.
        </span>
        <button
          type="button"
          onClick={onUpdatePreview}
          disabled={buttonDisabled}
          className={[
            "shrink-0 rounded-md border px-2.5 py-1 font-semibold transition-colors cursor-pointer",
            "border-slate-300 bg-white text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
            "disabled:opacity-60 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          Update preview
        </button>
      </div>

      <SettingSection title="Color and layers">
        <Field label={`Layer count (${settings.layerCount})`}>
          <Range
            value={settings.layerCount}
            min={2}
            max={12}
            step={1}
            onCommit={(value) =>
              patch({ layerCount: Math.round(value) } as Partial<TSettings>)
            }
          />
        </Field>
        <Field label="Trace detail size">
          <Select
            value={String(settings.maxTraceSide)}
            onChange={(value) =>
              patch({ maxTraceSide: Number(value) } as Partial<TSettings>)
            }
            options={[
              ["900", "Fast preview"],
              ["1200", "Balanced"],
            ["1600", "Detailed"],
            ["2000", "High detail"],
            ["2400", "Maximum detail"],
            ["3000", "Original-detail cap"],
          ]}
        />
      </Field>
        <Field label={`Minimum layer size (${settings.minRegionPercent}%)`}>
          <NumberInput
            value={settings.minRegionPercent}
            min={0}
            max={5}
            step={0.05}
            onCommit={(value) =>
              patch({ minRegionPercent: value } as Partial<TSettings>)
            }
          />
        </Field>
        <Field label="Layer cleanup">
          <NumberInput
            value={settings.turdSize}
            min={0}
            max={20}
            step={1}
            onCommit={(value) =>
              patch({ turdSize: Math.round(value) } as Partial<TSettings>)
            }
          />
        </Field>
        <Field label="Curve tolerance">
          <NumberInput
            value={settings.optTolerance}
            min={0.05}
            max={1.2}
            step={0.05}
            onCommit={(value) =>
              patch({ optTolerance: value } as Partial<TSettings>)
            }
          />
        </Field>
        <Field label="Turn policy">
          <TurnPolicySelect
            value={settings.turnPolicy}
            onChange={(value) =>
              patch({ turnPolicy: value } as Partial<TSettings>)
            }
          />
        </Field>
        <Field label="Posterize colors">
          <Checkbox
            checked={settings.posterize}
            onChange={(checked) =>
              patch({ posterize: checked } as Partial<TSettings>)
            }
          />
        </Field>
        {settings.posterize && (
          <Field label={`Posterize strength (${merged.posterizeStrength})`}>
            <Range
              value={merged.posterizeStrength}
              min={2}
              max={8}
              step={1}
              onCommit={(value) =>
                patch({ posterizeStrength: Math.round(value) } as Partial<TSettings>)
              }
            />
          </Field>
        )}
        <Field label={`Color merge tolerance (${merged.colorMergeTolerance})`}>
          <Range
            value={merged.colorMergeTolerance}
            min={0}
            max={80}
            step={1}
            onCommit={(value) =>
              patch({ colorMergeTolerance: Math.round(value) } as Partial<TSettings>)
            }
          />
        </Field>
        <Field label="Layer order">
          <Select
            value={merged.sortLayersBy}
            onChange={(value) =>
              patch({ sortLayersBy: value as SortLayersBy } as Partial<TSettings>)
            }
            options={[
              ["luminance", "Light to dark"],
              ["area", "Largest first"],
              ["original", "Palette order"],
            ]}
          />
        </Field>
      </SettingSection>

      {capabilities.supportsSelectedColorRemoval && (
        <SettingSection title="Remove selected colors">
          <Field label="Color to remove">
            <input
              type="color"
              value={draftColor}
              onChange={(event) => setDraftColor(event.target.value)}
              className="h-7 w-14 cursor-pointer rounded-md border border-[#dbe3ef] bg-white"
              aria-label="Pick color to remove"
            />
            <button
              type="button"
              onClick={addRemoveColor}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-800 transition-colors cursor-pointer hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Add
            </button>
          </Field>
          {(merged.removeColors || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(merged.removeColors || []).map((color) => (
                <button
                  type="button"
                  key={color}
                  onClick={() => removeRemoveColor(color)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  title={`Remove ${color} from list`}
                >
                  <span
                    className="h-3 w-3 rounded-sm border border-slate-300"
                    style={{ background: color }}
                    aria-hidden="true"
                  />
                  {color}
                  <span aria-hidden="true">x</span>
                </button>
              ))}
            </div>
          )}
          <Field label={`Color tolerance (${merged.removeColorTolerance})`}>
            <Range
              value={merged.removeColorTolerance}
              min={0}
              max={160}
              step={1}
              onCommit={(value) =>
                patch({ removeColorTolerance: Math.round(value) } as Partial<TSettings>)
              }
            />
          </Field>
        </SettingSection>
      )}

      <SettingSection title="Edges and cleanup">
        <Field label={`Brightness (${merged.brightness})`}>
          <Range
            value={merged.brightness}
            min={-50}
            max={50}
            step={1}
            onCommit={(value) =>
              patch({ brightness: Math.round(value) } as Partial<TSettings>)
            }
          />
        </Field>
        <Field label={`Contrast (${merged.contrast})`}>
          <Range
            value={merged.contrast}
            min={-50}
            max={75}
            step={1}
            onCommit={(value) =>
              patch({ contrast: Math.round(value) } as Partial<TSettings>)
            }
          />
        </Field>
        <Field label="Remove white background">
          <Checkbox
            checked={settings.removeWhite}
            onChange={(checked) =>
              patch({ removeWhite: checked } as Partial<TSettings>)
            }
          />
        </Field>
        <Field label="Remove transparent pixels">
          <Checkbox
            checked={settings.removeTransparent}
            onChange={(checked) =>
              patch({ removeTransparent: checked } as Partial<TSettings>)
            }
          />
        </Field>
      </SettingSection>

      {capabilities.supportsBackground && (
        <SettingSection title="Appearance">
          <Field label="Transparent background">
            <Checkbox
              checked={settings.transparent}
              onChange={(checked) =>
                patch({ transparent: checked } as Partial<TSettings>)
              }
            />
          </Field>
          {!settings.transparent && (
            <Field label="Background color">
              <ColorInput
                value={settings.bgColor}
                onCommit={(value) =>
                  patch({ bgColor: value } as Partial<TSettings>)
                }
              />
            </Field>
          )}
        </SettingSection>
      )}
    </div>
  );
}

export function SvgRasterExportSettingsPanel<
  TSettings extends SvgRasterExportSettings,
>({
  id = "advanced-settings",
  open,
  settings,
  setSettings,
  aspect,
}: SvgRasterExportProps<TSettings>) {
  if (!open) return null;

  function patch(patchValue: Partial<TSettings>) {
    setSettings((current) => ({ ...current, ...patchValue }) as TSettings);
  }

  function setWidth(widthValue: number) {
    setSettings((current) => {
      const width = Math.round(clampNumber(widthValue, 16, 16384));
      if (!aspect || !current.lockAspect) {
        return { ...current, width } as TSettings;
      }
      const height = Math.round(clampNumber(width / aspect, 16, 16384));
      return { ...current, width, height } as TSettings;
    });
  }

  function setHeight(heightValue: number) {
    setSettings((current) => {
      const height = Math.round(clampNumber(heightValue, 16, 16384));
      if (!aspect || !current.lockAspect) {
        return { ...current, height } as TSettings;
      }
      const width = Math.round(clampNumber(height * aspect, 16, 16384));
      return { ...current, width, height } as TSettings;
    });
  }

  function setLockAspect(lockAspect: boolean) {
    setSettings((current) => {
      if (!aspect || !lockAspect) return { ...current, lockAspect } as TSettings;
      const height = Math.round(clampNumber(current.width / aspect, 16, 16384));
      return { ...current, lockAspect, height } as TSettings;
    });
  }

  return (
    <div id={id} className="flex flex-col gap-2 min-w-0">
      <SettingSection title="SVG/raster export">
        <Field label="Output width (px)">
          <NumberInput
            value={settings.width}
            min={16}
            max={16384}
            step={1}
            onCommit={setWidth}
          />
        </Field>
        <Field label="Output height (px)">
          <NumberInput
            value={settings.height}
            min={16}
            max={16384}
            step={1}
            onCommit={setHeight}
          />
        </Field>
        <Field label="Lock aspect ratio">
          <Checkbox checked={settings.lockAspect} onChange={setLockAspect} />
        </Field>
        <Field label="Quality (pixel ratio)">
          <Select
            value={String(settings.dpiScale)}
            onChange={(value) =>
              patch({ dpiScale: Number(value) } as Partial<TSettings>)
            }
            options={[
              ["1", "1x"],
              ["2", "2x"],
              ["3", "3x"],
              ["4", "4x"],
            ]}
          />
        </Field>
        <Field label="Anti-aliasing">
          <Checkbox
            checked={settings.antiAlias}
            onChange={(checked) =>
              patch({ antiAlias: checked } as Partial<TSettings>)
            }
          />
        </Field>
      </SettingSection>

      <SettingSection title="Appearance">
        <Field label="Background">
          <Select
            value={settings.background}
            onChange={(value) =>
              patch({
                background: value as SvgRasterExportSettings["background"],
              } as Partial<TSettings>)
            }
            options={[
              ["transparent", "Transparent"],
              ["solid", "Solid color"],
            ]}
          />
        </Field>
        {settings.background === "solid" && (
          <Field label="Background color">
            <ColorInput
              value={settings.bgColor}
              onCommit={(value) =>
                patch({ bgColor: value } as Partial<TSettings>)
              }
            />
          </Field>
        )}
      </SettingSection>
    </div>
  );
}

export function AdvancedSettingsToggle({
  open,
  onToggle,
  controls = "advanced-settings",
}: {
  open: boolean;
  onToggle: () => void;
  controls?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mb-2 w-full inline-flex items-center justify-between px-3 py-1.5 rounded-md border border-slate-200 bg-sky-50 text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      aria-expanded={open}
      aria-controls={controls}
    >
      <span className="inline-flex items-center gap-2">
        <Icons name="settings" size={16} />
        Advanced settings
      </span>
      <ChevronDownIcon open={open} />
    </button>
  );
}

function SettingSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <h3 className="m-0 mb-2 text-[13px] font-bold text-sky-950">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-[13px] text-slate-800">
      <span className="min-w-0 font-medium">{label}</span>
      <span className="flex shrink-0 items-center gap-2">{children}</span>
    </label>
  );
}

function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="max-w-[190px] rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

function TurnPolicySelect({
  value,
  onChange,
}: {
  value: TurnPolicy;
  onChange: (value: TurnPolicy) => void;
}) {
  return (
    <Select
      value={value}
      onChange={(next) => onChange(next as TurnPolicy)}
      options={[
        ["black", "black"],
        ["white", "white"],
        ["left", "left"],
        ["right", "right"],
        ["minority", "minority"],
        ["majority", "majority"],
      ]}
    />
  );
}

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 accent-[#0b2dff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
    />
  );
}

function ColorInput({
  value,
  disabled,
  title,
  onCommit,
}: {
  value: string;
  disabled?: boolean;
  title?: string;
  onCommit: (value: string) => void;
}) {
  const [localValue, setLocalValue] = React.useState(value);
  const latestRef = React.useRef(value);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setLocalValue(value);
    latestRef.current = value;
  }, [value]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function schedule(next: string) {
    setLocalValue(next);
    latestRef.current = next;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      onCommit(latestRef.current);
    }, 100);
  }

  function flush() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onCommit(latestRef.current);
  }

  return (
    <input
      type="color"
      value={localValue}
      disabled={disabled}
      title={title}
      onChange={(event) => schedule(event.target.value)}
      onPointerUp={flush}
      onMouseUp={flush}
      onTouchEnd={flush}
      onBlur={flush}
      className={[
        "h-7 w-14 rounded-md border border-[#dbe3ef] bg-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
        disabled ? "opacity-50 pointer-events-none" : "",
      ].join(" ")}
    />
  );
}

function Range({
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
  const [localValue, setLocalValue] = React.useState(value);
  const latestRef = React.useRef(value);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    setLocalValue(value);
    latestRef.current = value;
  }, [value]);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function schedule(next: number) {
    const clamped = clampNumber(next, min, max);
    setLocalValue(clamped);
    latestRef.current = clamped;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      onCommit(latestRef.current);
    }, 100);
  }

  function flush() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onCommit(latestRef.current);
  }

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={localValue}
      onChange={(event) => schedule(Number(event.target.value))}
      onPointerUp={flush}
      onMouseUp={flush}
      onTouchEnd={flush}
      onBlur={flush}
      className="w-[140px] accent-[#0b2dff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
    />
  );
}

function NumberInput({
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
  const [text, setText] = React.useState(String(value));

  React.useEffect(() => {
    setText(String(value));
  }, [value]);

  function commit() {
    const next = Number(text);
    if (!Number.isFinite(next)) {
      setText(String(value));
      return;
    }
    const clamped = clampNumber(next, min, max);
    setText(String(clamped));
    onCommit(clamped);
  }

  return (
    <input
      type="number"
      value={text}
      min={min}
      max={max}
      step={step}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      className="w-[110px] rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
    />
  );
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
