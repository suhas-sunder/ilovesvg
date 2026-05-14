import * as React from "react";
import Icons from "~/client/assets/icons/Icons";
import { ChevronDownIcon } from "~/client/components/converter/PresetSelector";
import type { ConverterRouteCapabilities } from "~/client/lib/converter/routeCapabilities";
import {
  DEFAULT_TRACE_ADVANCED_SETTINGS,
  normalizeColorList,
  normalizeColorInput,
  type RemoveColorApplyTo,
  type SortLayersBy,
  type TraceAdvancedSettings,
} from "~/client/lib/converter/settings";
import {
  useNativeColorFinalCommit,
  useThrottledCommit,
} from "~/client/hooks/useThrottledCommit";

type TurnPolicy = "black" | "white" | "left" | "right" | "minority" | "majority";
type TraceMode = "single" | "layered";
type StrokeOutputMode = "filled" | "centerline";

export type MixedTraceSettings = TraceAdvancedSettings & {
  traceMode: TraceMode;
  strokeOutputMode?: StrokeOutputMode;
  centerlineMaxTraceSide?: number;
  centerlineStrokeWidth?: number;
  centerlineSimplifyTolerance?: number;
  centerlineMinPathLength?: number;
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
  detectedColorItems?: DetectedColorItem[];
  sourceFile?: File | null;
  removeColorsEnabled?: boolean;
  outputLayerItems?: OutputLayerControlItem[];
  outputSize?: OutputSizeInfo | null;
  onOutputLayerChange?: (layerId: string, patch: OutputLayerPatch) => void;
  onResetOutputLayer?: (layerId: string) => void;
  onResetAllOutputLayers?: () => void;
  onOutputSizeChange?: (size: { width: number; height: number }) => void;
  helpHref?: string;
  buttonDisabled?: boolean;
  liveSectionTitle?: string;
  liveSectionDescription?: string;
  livePreviewLead?: React.ReactNode;
  livePreviewLeadTitle?: string;
  convertSectionTitle?: string;
  convertSectionDescription?: string;
  hideOutputLayerStyling?: boolean;
  focusedEditorMode?: boolean;
  defaultOpenSection?: string | null;
  openSection?: string | null;
  onOpenSectionChange?: (sectionId: string | null) => void;
  updatePreviewLabel?: string;
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
  detectedColorItems?: DetectedColorItem[];
  sourceFile?: File | null;
  removeColorsEnabled?: boolean;
  outputLayerItems?: OutputLayerControlItem[];
  outputSize?: OutputSizeInfo | null;
  onOutputLayerChange?: (layerId: string, patch: OutputLayerPatch) => void;
  onResetOutputLayer?: (layerId: string) => void;
  onResetAllOutputLayers?: () => void;
  onOutputSizeChange?: (size: { width: number; height: number }) => void;
  helpHref?: string;
  buttonDisabled?: boolean;
  liveSectionTitle?: string;
  liveSectionDescription?: string;
  livePreviewLead?: React.ReactNode;
  livePreviewLeadTitle?: string;
  convertSectionTitle?: string;
  convertSectionDescription?: string;
  hideOutputLayerStyling?: boolean;
  focusedEditorMode?: boolean;
  defaultOpenSection?: string | null;
  openSection?: string | null;
  onOpenSectionChange?: (sectionId: string | null) => void;
  updatePreviewLabel?: string;
  onUpdatePreview: () => void;
};

type DetectedColorItem = {
  layers?: ReadonlyArray<{
    id?: string;
    color?: string;
    originalColor?: string;
    label?: string;
    name?: string;
    visible?: boolean;
    opacity?: number;
    originalOpacity?: number;
    pixelPercent?: number;
  }>;
};

type DetectedLayerItem = NonNullable<DetectedColorItem["layers"]>[number];

type SvgRasterExportProps<TSettings extends SvgRasterExportSettings> = {
  id?: string;
  open: boolean;
  settings: TSettings;
  setSettings: React.Dispatch<React.SetStateAction<TSettings>>;
  aspect?: number | null;
};

export type OutputLayerControlItem = {
  id: string;
  label?: string;
  name?: string;
  color?: string;
  originalColor?: string;
  visible?: boolean;
  opacity?: number;
  originalOpacity?: number;
  pixelPercent?: number;
};

type OutputLayerPatch = {
  color?: string;
  visible?: boolean;
  opacity?: number;
};

type OutputSizeInfo = {
  width: number;
  height: number;
  originalWidth?: number;
  originalHeight?: number;
};

export function TraceAdvancedSettingsPanel<TSettings extends MixedTraceSettings>({
  id = "advanced-settings",
  open,
  settings,
  setSettings,
  capabilities,
  detectedColorItems,
  sourceFile,
  removeColorsEnabled = true,
  outputLayerItems,
  outputSize,
  onOutputLayerChange,
  onResetOutputLayer,
  onResetAllOutputLayers,
  onOutputSizeChange,
  helpHref,
  buttonDisabled = false,
  liveSectionTitle = "Live Preview Edits",
  liveSectionDescription = "These controls update the visible SVG right away. Copy, download, fullscreen, and batch use what you see here.",
  livePreviewLead,
  livePreviewLeadTitle = "Output appearance",
  convertSectionTitle = "Click To Convert",
  convertSectionDescription = "Use Update preview when you are ready. These controls rebuild the SVG from the original image, so the app does not restart conversion after every slider or color change.",
  hideOutputLayerStyling = false,
  focusedEditorMode = false,
  defaultOpenSection = null,
  openSection,
  onOpenSectionChange,
  updatePreviewLabel = "Update preview",
  onUpdatePreview,
}: Props<TSettings>) {
  const [draftColor, setDraftColor] = React.useState("#ffffff");
  const [customColor, setCustomColor] = React.useState("");
  const [openLiveSection, setOpenLiveSection] = React.useState<string | null>(
    null,
  );
  const [openConvertSection, setOpenConvertSection] = React.useState<
    string | null
  >(null);
  const [liveTopOpen, setLiveTopOpen] = React.useState(false);
  const [convertTopOpen, setConvertTopOpen] = React.useState(false);
  const [localFocusedSection, setLocalFocusedSection] = React.useState<
    string | null
  >(defaultOpenSection);
  const sourceColors = useSourcePaletteColors(sourceFile, removeColorsEnabled);
  const layerColorItems = React.useMemo<DetectedColorItem[]>(() => {
    const items = detectedColorItems ? [...detectedColorItems] : [];
    if (outputLayerItems?.length) {
      items.unshift({ layers: outputLayerItems });
    }
    return items;
  }, [detectedColorItems, outputLayerItems]);
  const layerColors = React.useMemo(
    () => collectDetectedRemoveColors(layerColorItems),
    [layerColorItems],
  );
  const detectedColors = React.useMemo(
    () => mergeDetectedColors(sourceColors, layerColors),
    [sourceColors, layerColors],
  );
  const outputLayers = React.useMemo(
    () =>
      onOutputLayerChange
        ? normalizeOutputLayers(outputLayerItems || detectedColorItems?.[0]?.layers)
        : [],
    [outputLayerItems, detectedColorItems, onOutputLayerChange],
  );
  const showOutputLayerControls =
    capabilities.supportsLayerEditing && outputLayers.length > 0;
  const focusedOpenSection =
    openSection !== undefined ? openSection : localFocusedSection;

  React.useEffect(() => {
    if (!focusedEditorMode || !open || openSection !== undefined) return;
    setLocalFocusedSection((current) => current ?? defaultOpenSection);
  }, [defaultOpenSection, focusedEditorMode, open, openSection]);

  if (!open) return null;

  const merged = { ...DEFAULT_TRACE_ADVANCED_SETTINGS, ...settings };
  const traceMode = settings.traceMode || "single";
  const showLayered = capabilities.supportsLayeredTrace && traceMode === "layered";
  const showSingleTrace = capabilities.supportsSingleTrace && traceMode !== "layered";
  const showAlpha = capabilities.supportsAlpha && !capabilities.supportsCutFriendlyOutput;
  const showSelectedColors = capabilities.supportsSelectedColorRemoval;
  const showCleanup = capabilities.supportsMaskCleanup && showSingleTrace;

  function patch(patchValue: Partial<TSettings>) {
    setSettings((current) => {
      if (!hasPatchChanges(current, patchValue)) return current;
      return { ...current, ...patchValue } as TSettings;
    });
  }

  function addRemoveColorValue(value: string) {
    const normalized = normalizeColorInput(value);
    if (!normalized) return;
    const next = normalizeColorList([...(merged.removeColors || []), normalized]);
    patch({ removeColors: next } as Partial<TSettings>);
  }

  function addRemoveColor() {
    addRemoveColorValue(draftColor);
  }

  function addCustomRemoveColor() {
    const normalized = normalizeColorInput(customColor);
    if (!normalized) return;
    addRemoveColorValue(normalized);
    setCustomColor("");
  }

  function toggleRemoveColor(color: string) {
    const normalized = normalizeColorInput(color);
    if (!normalized) return;
    if ((merged.removeColors || []).includes(normalized)) {
      removeRemoveColor(normalized);
      return;
    }
    addRemoveColorValue(normalized);
  }

  function removeRemoveColor(color: string) {
    patch({
      removeColors: (merged.removeColors || []).filter((item) => item !== color),
    } as Partial<TSettings>);
  }

  function toggleFocusedSection(sectionId: string) {
    const next = focusedOpenSection === sectionId ? null : sectionId;
    if (onOpenSectionChange) {
      onOpenSectionChange(next);
    } else {
      setLocalFocusedSection(next);
    }
  }

  function sectionOpen(
    groupOpenSection: string | null,
    sectionId: string,
  ): boolean {
    return focusedEditorMode
      ? focusedOpenSection === sectionId
      : groupOpenSection === sectionId;
  }

  function toggleSection(
    groupSetter: React.Dispatch<React.SetStateAction<string | null>>,
    sectionId: string,
  ) {
    if (focusedEditorMode) {
      toggleFocusedSection(sectionId);
      return;
    }
    toggleAccordionSection(groupSetter, sectionId);
  }

  function renderUpdatePreviewAction() {
    return (
      <UpdatePreviewAction
        label={updatePreviewLabel}
        disabled={buttonDisabled}
        onClick={onUpdatePreview}
      />
    );
  }

  return (
    <div id={id} className="flex flex-col gap-2 min-w-0">
      <AdvancedTopLevelSection
        title={liveSectionTitle}
        description={liveSectionDescription}
        tone="live"
        open={liveTopOpen}
        onToggle={() => setLiveTopOpen((current) => !current)}
      >
        {livePreviewLead ? (
          focusedEditorMode ? (
            <SettingSection
              title={livePreviewLeadTitle}
              tone="effects"
              sectionId={`${id}-live-output-appearance`}
              open={sectionOpen(openLiveSection, "output-appearance")}
              onToggle={() =>
                toggleSection(setOpenLiveSection, "output-appearance")
              }
            >
              {livePreviewLead}
            </SettingSection>
          ) : (
            livePreviewLead
          )
        ) : null}

        {showOutputLayerControls && (
          <>
            <OutputColorRemovalSection
              layers={outputLayers}
              onOutputLayerChange={onOutputLayerChange}
              onResetOutputLayer={onResetOutputLayer}
              sectionId={`${id}-live-output-colors`}
              open={sectionOpen(openLiveSection, "output-colors")}
              onToggle={() =>
                toggleSection(setOpenLiveSection, "output-colors")
              }
            />
            {!hideOutputLayerStyling && (
              <OutputLayerStylingSection
                layers={outputLayers}
                onOutputLayerChange={onOutputLayerChange}
                onResetOutputLayer={onResetOutputLayer}
                onResetAllOutputLayers={onResetAllOutputLayers}
                sectionId={`${id}-live-layer-styling`}
                open={sectionOpen(openLiveSection, "layer-styling")}
                onToggle={() =>
                  toggleSection(setOpenLiveSection, "layer-styling")
                }
              />
            )}
          </>
        )}

        {capabilities.supportsOutputGeometry &&
          !capabilities.supportsCutFriendlyOutput && (
            <SettingSection
              title="Size and export"
              tone="export"
              sectionId={`${id}-live-size-export`}
              open={sectionOpen(openLiveSection, "size-export")}
              onToggle={() =>
                toggleSection(setOpenLiveSection, "size-export")
              }
            >
              <OutputSizeControls
                settings={merged}
                outputSize={outputSize}
                onPatch={(patchValue) => patch(patchValue as Partial<TSettings>)}
                onOutputSizeChange={onOutputSizeChange}
              />
            </SettingSection>
          )}
      </AdvancedTopLevelSection>

      <AdvancedTopLevelSection
        title={convertSectionTitle}
        description={convertSectionDescription}
        tone="convert"
        open={convertTopOpen}
        onToggle={() => setConvertTopOpen((current) => !current)}
      >
        {helpHref ? (
          <a
            href={helpHref}
            className="inline-flex w-fit text-[12px] font-semibold text-[#0b2dff] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            Learn what each setting does
          </a>
        ) : null}

      <SettingSection
        title="Line tracing"
        tone="convert"
        sectionId={`${id}-convert-line-tracing`}
        open={sectionOpen(openConvertSection, "line-tracing")}
        onToggle={() =>
          toggleSection(setOpenConvertSection, "line-tracing")
        }
        footer={renderUpdatePreviewAction()}
      >
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
            <Field label="Remove tiny specks">
              <NumberInput
                value={settings.turdSize}
                min={0}
                max={20}
                step={1}
                onCommit={(value) => patch({ turdSize: Math.round(value) } as Partial<TSettings>)}
              />
            </Field>
            <Field label="Curve smoothing">
              <NumberInput
                value={settings.optTolerance}
                min={0.05}
                max={2}
                step={0.05}
                onCommit={(value) => patch({ optTolerance: value } as Partial<TSettings>)}
              />
            </Field>
            <Field label="Corner handling">
              <TurnPolicySelect
                value={settings.turnPolicy}
                onChange={(value) => patch({ turnPolicy: value } as Partial<TSettings>)}
              />
            </Field>
          </>
        )}

        {capabilities.supportsOutputGeometry && (
          <Field label="Trace detail limit">
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
        <SettingSection
          title="Color and layers"
          tone="convert"
          sectionId={`${id}-convert-color-layers`}
          open={sectionOpen(openConvertSection, "color-layers")}
          onToggle={() =>
            toggleSection(setOpenConvertSection, "color-layers")
          }
          footer={renderUpdatePreviewAction()}
        >
          <Field label={`Color layers (${settings.colorLayerCount ?? 5})`}>
            <Range
              value={settings.colorLayerCount ?? 5}
              min={2}
              max={12}
              step={1}
              onCommit={(value) => patch({ colorLayerCount: Math.round(value) } as Partial<TSettings>)}
            />
          </Field>
          <Field label="Trace detail limit">
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
          <Field label={`Remove small color regions (${settings.minRegionPercent ?? 0.35}%)`}>
            <NumberInput
              value={settings.minRegionPercent ?? 0.35}
              min={0}
              max={5}
              step={0.05}
              onCommit={(value) => patch({ minRegionPercent: value } as Partial<TSettings>)}
            />
          </Field>
          <Field label="Simplify colors">
            <Checkbox
              checked={Boolean(settings.posterize)}
              onChange={(checked) => patch({ posterize: checked } as Partial<TSettings>)}
            />
          </Field>
          <Field label={`Color simplification (${merged.posterizeStrength})`}>
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
          <Field label="Ignore white areas">
            <Checkbox
              checked={Boolean(settings.removeWhite)}
              onChange={(checked) => patch({ removeWhite: checked } as Partial<TSettings>)}
            />
          </Field>
          <Field label="Ignore transparent pixels">
            <Checkbox
              checked={settings.removeTransparent !== false}
              onChange={(checked) => patch({ removeTransparent: checked } as Partial<TSettings>)}
            />
          </Field>
          <Field label={`Merge similar colors (${merged.colorMergeTolerance})`}>
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

      <SettingSection
        title="Edges and cleanup"
        tone="cleanup"
        sectionId={`${id}-convert-edges-cleanup`}
        open={sectionOpen(openConvertSection, "edges-cleanup")}
        onToggle={() =>
          toggleSection(setOpenConvertSection, "edges-cleanup")
        }
        footer={renderUpdatePreviewAction()}
      >
        {capabilities.supportsEdgePreprocess && (
            <Field label="Image preprocessing">
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
            <Field label={`Edge blur (${settings.blurSigma})`}>
              <NumberInput
                value={settings.blurSigma}
                min={0}
                max={6}
                step={0.1}
                onCommit={(value) => patch({ blurSigma: value } as Partial<TSettings>)}
              />
            </Field>
            <Field label={`Edge contrast (${settings.edgeBoost})`}>
              <NumberInput
                value={settings.edgeBoost}
                min={0.25}
                max={3}
                step={0.1}
                onCommit={(value) => patch({ edgeBoost: value } as Partial<TSettings>)}
              />
            </Field>
            <Field label={`Edge sensitivity (${merged.edgeThreshold})`}>
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
            <Field label={`Remove tiny islands (${merged.minIslandPx}px)`}>
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
            <Field label={`Fill tiny holes (${merged.holeFillPx}px)`}>
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
            <Field label={`Close small gaps (${merged.gapCloseStrength})`}>
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
        <SettingSection
          title="Remove colors"
          tone="remove"
          sectionId={`${id}-convert-input-colors`}
          open={sectionOpen(openConvertSection, "input-colors")}
          onToggle={() =>
            toggleSection(setOpenConvertSection, "input-colors")
          }
          footer={renderUpdatePreviewAction()}
        >
          <p className="text-[12px] leading-5 text-slate-600">
            Choose colors from the image or current SVG output, or enter a
            custom color. Increase tolerance to remove nearby shades.
          </p>
          {!removeColorsEnabled ? (
            <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-600">
              Remove colors applies to raster image tracing. Uploaded SVG
              colors can be edited or hidden in the Live Preview layer controls.
            </div>
          ) : (
            <>
              <DetectedColorSwatches
                colors={detectedColors}
                selectedColors={merged.removeColors || []}
                onToggle={toggleRemoveColor}
                title="Detected colors"
                emptyText="Detected colors appear after upload analysis or after an SVG output is generated."
              />
              <Field label="Custom HEX or RGB">
                <input
                  type="color"
                  value={draftColor}
                  onChange={(event) => setDraftColor(event.target.value)}
                  className="h-7 w-14 cursor-pointer rounded-md border border-[#dbe3ef] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  aria-label="Pick color to remove"
                />
                <input
                  type="text"
                  value={customColor}
                  onChange={(event) => setCustomColor(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomRemoveColor();
                    }
                  }}
                  placeholder="#ff0000 or rgb(255,0,0)"
                  aria-invalid={customColor.length > 0 && !normalizeColorInput(customColor)}
                  className="min-w-0 flex-1 rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customColor.trim()) {
                      addCustomRemoveColor();
                    } else {
                      addRemoveColor();
                    }
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-800 transition-colors cursor-pointer hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  Add
                </button>
              </Field>
            </>
          )}
          {(merged.removeColors || []).length > 0 && (
            <RemoveColorChips
              colors={merged.removeColors || []}
              onRemove={removeRemoveColor}
            />
          )}
          <Field label={`Nearby shade tolerance (${merged.removeColorTolerance})`}>
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
          <p className="text-[12px] leading-5 text-slate-500">
            Low tolerance removes exact matches. Higher tolerance also catches
            anti-aliased edges and similar shades.
          </p>
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

      <SettingSection
        title="Appearance"
        tone="appearance"
        sectionId={`${id}-convert-appearance`}
        open={sectionOpen(openConvertSection, "appearance")}
        onToggle={() =>
          toggleSection(setOpenConvertSection, "appearance")
        }
        footer={renderUpdatePreviewAction()}
      >
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
          <Field label={`Global layer opacity (${Math.round(merged.layerAlpha * 100)}%)`}>
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
          <>
            <Field label="Transparent background">
              <Checkbox
                checked={settings.transparent}
                onChange={(checked) => patch({ transparent: checked } as Partial<TSettings>)}
              />
            </Field>
            <Field label="Background color">
              <ColorInput
                value={settings.bgColor}
                disabled={settings.transparent}
                title={
                  settings.transparent
                    ? "Disable transparent background to use this color"
                    : "Pick background color"
                }
                onCommit={(value) => patch({ bgColor: value } as Partial<TSettings>)}
              />
            </Field>
            {settings.transparent ? (
              <p className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-[12px] text-slate-500">
                Background color is ignored while transparent background is on.
              </p>
            ) : null}
          </>
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

      </AdvancedTopLevelSection>
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
  detectedColorItems,
  sourceFile,
  removeColorsEnabled = true,
  outputLayerItems,
  outputSize,
  onOutputLayerChange,
  onResetOutputLayer,
  onResetAllOutputLayers,
  onOutputSizeChange,
  helpHref,
  buttonDisabled = false,
  liveSectionTitle = "Live Preview Edits",
  liveSectionDescription = "These controls update the visible SVG right away. Copy, download, fullscreen, and batch use what you see here.",
  livePreviewLead,
  livePreviewLeadTitle = "Output appearance",
  convertSectionTitle = "Click To Convert",
  convertSectionDescription = "Use Update preview when you are ready. These controls rebuild the SVG from the original image, so the app does not restart conversion after every slider or color change.",
  hideOutputLayerStyling = false,
  focusedEditorMode = false,
  defaultOpenSection = null,
  openSection,
  onOpenSectionChange,
  updatePreviewLabel = "Update preview",
  onUpdatePreview,
}: LayeredProps<TSettings>) {
  const [draftColor, setDraftColor] = React.useState("#ffffff");
  const [customColor, setCustomColor] = React.useState("");
  const [openLiveSection, setOpenLiveSection] = React.useState<string | null>(
    null,
  );
  const [openConvertSection, setOpenConvertSection] = React.useState<
    string | null
  >(null);
  const [liveTopOpen, setLiveTopOpen] = React.useState(false);
  const [convertTopOpen, setConvertTopOpen] = React.useState(false);
  const [localFocusedSection, setLocalFocusedSection] = React.useState<
    string | null
  >(defaultOpenSection);
  const sourceColors = useSourcePaletteColors(sourceFile, removeColorsEnabled);
  const layerColorItems = React.useMemo<DetectedColorItem[]>(() => {
    const items = detectedColorItems ? [...detectedColorItems] : [];
    if (outputLayerItems?.length) {
      items.unshift({ layers: outputLayerItems });
    }
    return items;
  }, [detectedColorItems, outputLayerItems]);
  const layerColors = React.useMemo(
    () => collectDetectedRemoveColors(layerColorItems),
    [layerColorItems],
  );
  const detectedColors = React.useMemo(
    () => mergeDetectedColors(sourceColors, layerColors),
    [sourceColors, layerColors],
  );
  const outputLayers = React.useMemo(
    () =>
      onOutputLayerChange
        ? normalizeOutputLayers(outputLayerItems || detectedColorItems?.[0]?.layers)
        : [],
    [outputLayerItems, detectedColorItems, onOutputLayerChange],
  );
  const showOutputLayerControls =
    capabilities.supportsLayerEditing && outputLayers.length > 0;
  const focusedOpenSection =
    openSection !== undefined ? openSection : localFocusedSection;

  React.useEffect(() => {
    if (!focusedEditorMode || !open || openSection !== undefined) return;
    setLocalFocusedSection((current) => current ?? defaultOpenSection);
  }, [defaultOpenSection, focusedEditorMode, open, openSection]);

  if (!open) return null;

  const merged = { ...DEFAULT_TRACE_ADVANCED_SETTINGS, ...settings };
  const showAlpha =
    capabilities.supportsAlpha && !capabilities.supportsCutFriendlyOutput;

  function patch(patchValue: Partial<TSettings>) {
    setSettings((current) => {
      if (!hasPatchChanges(current, patchValue)) return current;
      return { ...current, ...patchValue } as TSettings;
    });
  }

  function addRemoveColorValue(value: string) {
    const normalized = normalizeColorInput(value);
    if (!normalized) return;
    const next = normalizeColorList([...(merged.removeColors || []), normalized]);
    patch({ removeColors: next } as Partial<TSettings>);
  }

  function addRemoveColor() {
    addRemoveColorValue(draftColor);
  }

  function addCustomRemoveColor() {
    const normalized = normalizeColorInput(customColor);
    if (!normalized) return;
    addRemoveColorValue(normalized);
    setCustomColor("");
  }

  function toggleRemoveColor(color: string) {
    const normalized = normalizeColorInput(color);
    if (!normalized) return;
    if ((merged.removeColors || []).includes(normalized)) {
      removeRemoveColor(normalized);
      return;
    }
    addRemoveColorValue(normalized);
  }

  function removeRemoveColor(color: string) {
    patch({
      removeColors: (merged.removeColors || []).filter((item) => item !== color),
    } as Partial<TSettings>);
  }

  function toggleFocusedSection(sectionId: string) {
    const next = focusedOpenSection === sectionId ? null : sectionId;
    if (onOpenSectionChange) {
      onOpenSectionChange(next);
    } else {
      setLocalFocusedSection(next);
    }
  }

  function sectionOpen(
    groupOpenSection: string | null,
    sectionId: string,
  ): boolean {
    return focusedEditorMode
      ? focusedOpenSection === sectionId
      : groupOpenSection === sectionId;
  }

  function toggleSection(
    groupSetter: React.Dispatch<React.SetStateAction<string | null>>,
    sectionId: string,
  ) {
    if (focusedEditorMode) {
      toggleFocusedSection(sectionId);
      return;
    }
    toggleAccordionSection(groupSetter, sectionId);
  }

  function renderUpdatePreviewAction() {
    return (
      <UpdatePreviewAction
        label={updatePreviewLabel}
        disabled={buttonDisabled}
        onClick={onUpdatePreview}
      />
    );
  }

  return (
    <div id={id} className="flex flex-col gap-2 min-w-0">
      <AdvancedTopLevelSection
        title={liveSectionTitle}
        description={liveSectionDescription}
        tone="live"
        open={liveTopOpen}
        onToggle={() => setLiveTopOpen((current) => !current)}
      >
        {livePreviewLead ? (
          focusedEditorMode ? (
            <SettingSection
              title={livePreviewLeadTitle}
              tone="effects"
              sectionId={`${id}-live-output-appearance`}
              open={sectionOpen(openLiveSection, "output-appearance")}
              onToggle={() =>
                toggleSection(setOpenLiveSection, "output-appearance")
              }
            >
              {livePreviewLead}
            </SettingSection>
          ) : (
            livePreviewLead
          )
        ) : null}

        {showOutputLayerControls && (
          <>
            <OutputColorRemovalSection
              layers={outputLayers}
              onOutputLayerChange={onOutputLayerChange}
              onResetOutputLayer={onResetOutputLayer}
              sectionId={`${id}-live-output-colors`}
              open={sectionOpen(openLiveSection, "output-colors")}
              onToggle={() =>
                toggleSection(setOpenLiveSection, "output-colors")
              }
            />
            {!hideOutputLayerStyling && (
              <OutputLayerStylingSection
                layers={outputLayers}
                onOutputLayerChange={onOutputLayerChange}
                onResetOutputLayer={onResetOutputLayer}
                onResetAllOutputLayers={onResetAllOutputLayers}
                sectionId={`${id}-live-layer-styling`}
                open={sectionOpen(openLiveSection, "layer-styling")}
                onToggle={() =>
                  toggleSection(setOpenLiveSection, "layer-styling")
                }
              />
            )}
          </>
        )}

        {capabilities.supportsOutputGeometry && (
          <SettingSection
            title="Size and export"
            tone="export"
            sectionId={`${id}-live-size-export`}
            open={sectionOpen(openLiveSection, "size-export")}
            onToggle={() =>
              toggleSection(setOpenLiveSection, "size-export")
            }
          >
            <OutputSizeControls
              settings={merged}
              outputSize={outputSize}
              onPatch={(patchValue) => patch(patchValue as Partial<TSettings>)}
              onOutputSizeChange={onOutputSizeChange}
            />
          </SettingSection>
        )}
      </AdvancedTopLevelSection>

      <AdvancedTopLevelSection
        title={convertSectionTitle}
        description={convertSectionDescription}
        tone="convert"
        open={convertTopOpen}
        onToggle={() => setConvertTopOpen((current) => !current)}
      >
        {helpHref ? (
          <a
            href={helpHref}
            className="inline-flex w-fit text-[12px] font-semibold text-[#0b2dff] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            Learn what each setting does
          </a>
        ) : null}

      <SettingSection
        title="Color and layers"
        tone="convert"
        sectionId={`${id}-convert-color-layers`}
        open={sectionOpen(openConvertSection, "color-layers")}
        onToggle={() =>
          toggleSection(setOpenConvertSection, "color-layers")
        }
        footer={renderUpdatePreviewAction()}
      >
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
        <Field label="Trace detail limit">
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
        <Field label={`Remove small color regions (${settings.minRegionPercent}%)`}>
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
        <Field label="Remove tiny specks">
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
        <Field label="Curve smoothing">
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
        <Field label="Corner handling">
          <TurnPolicySelect
            value={settings.turnPolicy}
            onChange={(value) =>
              patch({ turnPolicy: value } as Partial<TSettings>)
            }
          />
        </Field>
        <Field label="Simplify colors">
          <Checkbox
            checked={settings.posterize}
            onChange={(checked) =>
              patch({ posterize: checked } as Partial<TSettings>)
            }
          />
        </Field>
        {settings.posterize && (
          <Field label={`Color simplification (${merged.posterizeStrength})`}>
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
        <Field label={`Merge similar colors (${merged.colorMergeTolerance})`}>
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
        <SettingSection
          title="Remove colors"
          tone="remove"
          sectionId={`${id}-convert-input-colors`}
          open={sectionOpen(openConvertSection, "input-colors")}
          onToggle={() =>
            toggleSection(setOpenConvertSection, "input-colors")
          }
          footer={renderUpdatePreviewAction()}
        >
          <p className="text-[12px] leading-5 text-slate-600">
            Choose colors from the image or current SVG output, or enter a
            custom color. Increase tolerance to remove nearby shades.
          </p>
          {!removeColorsEnabled ? (
            <div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-600">
              Remove colors applies to raster image tracing. Uploaded SVG
              colors can be edited or hidden in the Live Preview layer controls.
            </div>
          ) : (
            <>
              <DetectedColorSwatches
                colors={detectedColors}
                selectedColors={merged.removeColors || []}
                onToggle={toggleRemoveColor}
                title="Detected colors"
                emptyText="Detected colors appear after upload analysis or after an SVG output is generated."
              />
              <Field label="Custom HEX or RGB">
                <input
                  type="color"
                  value={draftColor}
                  onChange={(event) => setDraftColor(event.target.value)}
                  className="h-7 w-14 cursor-pointer rounded-md border border-[#dbe3ef] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  aria-label="Pick color to remove"
                />
                <input
                  type="text"
                  value={customColor}
                  onChange={(event) => setCustomColor(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCustomRemoveColor();
                    }
                  }}
                  placeholder="#ff0000 or rgb(255,0,0)"
                  aria-invalid={customColor.length > 0 && !normalizeColorInput(customColor)}
                  className="min-w-0 flex-1 rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customColor.trim()) {
                      addCustomRemoveColor();
                    } else {
                      addRemoveColor();
                    }
                  }}
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-800 transition-colors cursor-pointer hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                >
                  Add
                </button>
              </Field>
            </>
          )}
          {(merged.removeColors || []).length > 0 && (
            <RemoveColorChips
              colors={merged.removeColors || []}
              onRemove={removeRemoveColor}
            />
          )}
          <Field label={`Nearby shade tolerance (${merged.removeColorTolerance})`}>
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
          <p className="text-[12px] leading-5 text-slate-500">
            Low tolerance removes exact matches. Higher tolerance also catches
            anti-aliased edges and similar shades.
          </p>
        </SettingSection>
      )}

      <SettingSection
        title="Edges and cleanup"
        tone="cleanup"
        sectionId={`${id}-convert-edges-cleanup`}
        open={sectionOpen(openConvertSection, "edges-cleanup")}
        onToggle={() =>
          toggleSection(setOpenConvertSection, "edges-cleanup")
        }
        footer={renderUpdatePreviewAction()}
      >
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
        <Field label="Ignore white areas">
          <Checkbox
            checked={settings.removeWhite}
            onChange={(checked) =>
              patch({ removeWhite: checked } as Partial<TSettings>)
            }
          />
        </Field>
        <Field label="Ignore transparent pixels">
          <Checkbox
            checked={settings.removeTransparent}
            onChange={(checked) =>
              patch({ removeTransparent: checked } as Partial<TSettings>)
            }
          />
        </Field>
      </SettingSection>

      {capabilities.supportsBackground && (
        <SettingSection
          title="Appearance"
          tone="appearance"
          sectionId={`${id}-convert-appearance`}
          open={sectionOpen(openConvertSection, "appearance")}
          onToggle={() =>
            toggleSection(setOpenConvertSection, "appearance")
          }
          footer={renderUpdatePreviewAction()}
        >
          <Field label="Transparent background">
            <Checkbox
              checked={settings.transparent}
              onChange={(checked) =>
                patch({ transparent: checked } as Partial<TSettings>)
              }
            />
          </Field>
          <Field label="Background color">
            <ColorInput
              value={settings.bgColor}
              disabled={settings.transparent}
              title={
                settings.transparent
                  ? "Disable transparent background to use this color"
                  : "Pick background color"
              }
              onCommit={(value) =>
                patch({ bgColor: value } as Partial<TSettings>)
              }
            />
          </Field>
          {settings.transparent ? (
            <p className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-[12px] text-slate-500">
              Background color is ignored while transparent background is on.
            </p>
          ) : null}
          {showAlpha && (
            <Field label={`Global layer opacity (${Math.round(merged.layerAlpha * 100)}%)`}>
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
      )}

      </AdvancedTopLevelSection>
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
  const [openLiveSection, setOpenLiveSection] = React.useState<string | null>(
    null,
  );
  const [liveTopOpen, setLiveTopOpen] = React.useState(false);
  const [convertTopOpen, setConvertTopOpen] = React.useState(false);
  if (!open) return null;

  function patch(patchValue: Partial<TSettings>) {
    setSettings((current) => {
      if (!hasPatchChanges(current, patchValue)) return current;
      return { ...current, ...patchValue } as TSettings;
    });
  }

  function setWidth(widthValue: number) {
    setSettings((current) => {
      const width = Math.round(clampNumber(widthValue, 16, 16384));
      if (!aspect || !current.lockAspect) {
        if (current.width === width) return current;
        return { ...current, width } as TSettings;
      }
      const height = Math.round(clampNumber(width / aspect, 16, 16384));
      if (current.width === width && current.height === height) return current;
      return { ...current, width, height } as TSettings;
    });
  }

  function setHeight(heightValue: number) {
    setSettings((current) => {
      const height = Math.round(clampNumber(heightValue, 16, 16384));
      if (!aspect || !current.lockAspect) {
        if (current.height === height) return current;
        return { ...current, height } as TSettings;
      }
      const width = Math.round(clampNumber(height * aspect, 16, 16384));
      if (current.width === width && current.height === height) return current;
      return { ...current, width, height } as TSettings;
    });
  }

  function setLockAspect(lockAspect: boolean) {
    setSettings((current) => {
      if (!aspect || !lockAspect) {
        if (current.lockAspect === lockAspect) return current;
        return { ...current, lockAspect } as TSettings;
      }
      const height = Math.round(clampNumber(current.width / aspect, 16, 16384));
      if (current.lockAspect === lockAspect && current.height === height) {
        return current;
      }
      return { ...current, lockAspect, height } as TSettings;
    });
  }

  return (
    <div id={id} className="flex flex-col gap-2 min-w-0">
      <AdvancedTopLevelSection
        title="Live Preview Edits"
        description="These controls update the browser preview right away. Copy and download use what you see here."
        tone="live"
        open={liveTopOpen}
        onToggle={() => setLiveTopOpen((current) => !current)}
      >
        <SettingSection
          title="SVG/raster export"
          sectionId={`${id}-live-raster-export`}
          open={openLiveSection === "raster-export"}
          onToggle={() =>
            toggleAccordionSection(setOpenLiveSection, "raster-export")
          }
        >
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

        <SettingSection
          title="Appearance"
          sectionId={`${id}-live-raster-appearance`}
          open={openLiveSection === "raster-appearance"}
          onToggle={() =>
            toggleAccordionSection(setOpenLiveSection, "raster-appearance")
          }
        >
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
      </AdvancedTopLevelSection>

      <AdvancedTopLevelSection
        title="Click To Convert"
        description="Use Convert when you are ready. Raster export waits so resize and appearance changes do not recreate the downloadable file after every edit."
        tone="convert"
        open={convertTopOpen}
        onToggle={() => setConvertTopOpen((current) => !current)}
      >
        <p className="m-0 rounded-md border border-indigo-100 bg-white/70 px-3 py-2 text-[12px] leading-5 text-slate-600">
          Convert uses the live preview settings above for the final raster
          export. Raster export pages intentionally do not show image-tracing
          controls.
        </p>
      </AdvancedTopLevelSection>
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
        Settings
      </span>
      <ChevronDownIcon open={open} />
    </button>
  );
}

function DetectedColorSwatches({
  colors,
  selectedColors,
  onToggle,
  title = "Detected colors",
  emptyText = "Detected colors will appear here after a conversion or SVG upload.",
}: {
  colors: Array<{ color: string; label: string }>;
  selectedColors: string[];
  onToggle: (color: string) => void;
  title?: string;
  emptyText?: string;
}) {
  if (colors.length === 0) {
    return (
      <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-[12px] text-slate-500">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-2">
      <div className="mb-1 text-[12px] font-semibold text-slate-700">
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {colors.map(({ color, label }) => {
          const selected = selectedColors.includes(color);
          return (
            <button
              type="button"
              key={color}
              onClick={() => onToggle(color)}
              title={`${selected ? "Keep" : "Remove"} ${label}`}
              aria-pressed={selected}
              className={[
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                selected
                  ? "border-[#0b2dff] bg-sky-50 text-slate-900 hover:bg-sky-100"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
              ].join(" ")}
            >
              <span
                className="h-3.5 w-3.5 rounded-sm border border-slate-300"
                style={{ background: color }}
                aria-hidden="true"
              />
              {color}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RemoveColorChips({
  colors,
  onRemove,
}: {
  colors: string[];
  onRemove: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <button
          type="button"
          key={color}
          onClick={() => onRemove(color)}
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
  );
}

function OutputColorRemovalSection({
  layers,
  onOutputLayerChange,
  onResetOutputLayer,
  sectionId,
  open,
  onToggle,
}: {
  layers: OutputLayerControlItem[];
  onOutputLayerChange?: (layerId: string, patch: OutputLayerPatch) => void;
  onResetOutputLayer?: (layerId: string) => void;
  sectionId?: string;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <SettingSection
      title="Remove detected output colors"
      tone="remove"
      sectionId={sectionId}
      open={open}
      onToggle={onToggle}
    >
      <p className="text-[12px] leading-5 text-slate-600">
        Hide colors from the current SVG output. The detected list refreshes
        after each new trace.
      </p>

      {layers.length === 0 ? (
        <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-[12px] text-slate-500">
          Generate an SVG to view removable output colors.
        </div>
      ) : (
        <div className="grid gap-1.5">
          {layers.map((layer) => {
            const visible = layer.visible !== false;
            const label = layer.label || layer.name || layer.id;
            const color = normalizeColorInput(layer.color || layer.originalColor || "") || "#000000";
            return (
              <div
                key={layer.id}
                className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5"
              >
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(event) =>
                    onOutputLayerChange?.(layer.id, {
                      visible: event.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-[#0b2dff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  aria-label={`${visible ? "Keep" : "Restore"} ${label}`}
                />
                <span
                  className="h-4 w-4 rounded-sm border border-slate-300"
                  style={{ background: color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-700">
                  {label}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-slate-500">
                  {color}
                </span>
                {onResetOutputLayer ? (
                  <button
                    type="button"
                    onClick={() => onResetOutputLayer(layer.id)}
                    className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-semibold text-slate-700 transition-colors cursor-pointer hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    Reset
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </SettingSection>
  );
}

function OutputLayerStylingSection({
  layers,
  onOutputLayerChange,
  onResetOutputLayer,
  onResetAllOutputLayers,
  sectionId,
  open,
  onToggle,
}: {
  layers: OutputLayerControlItem[];
  onOutputLayerChange?: (layerId: string, patch: OutputLayerPatch) => void;
  onResetOutputLayer?: (layerId: string) => void;
  onResetAllOutputLayers?: () => void;
  sectionId?: string;
  open?: boolean;
  onToggle?: () => void;
}) {
  return (
    <SettingSection
      title="Layer colors"
      tone="layers"
      sectionId={sectionId}
      open={open}
      onToggle={onToggle}
    >
      <p className="text-[12px] leading-5 text-slate-600">
        Edit visible SVG layers for this output only. Copy and download use the
        current layer state.
      </p>
      <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onResetAllOutputLayers}
              disabled={!onResetAllOutputLayers}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-700 transition-colors cursor-pointer hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Reset all
            </button>
          </div>
          <div className="grid max-h-[34rem] min-w-0 max-w-full gap-0 overflow-y-auto overflow-x-hidden">
            {layers.map((layer) => (
              <OutputLayerStyleRow
                key={layer.id}
                layer={layer}
                onOutputLayerChange={onOutputLayerChange}
                onResetOutputLayer={onResetOutputLayer}
              />
            ))}
          </div>
      </>
    </SettingSection>
  );
}

function OutputLayerStyleRow({
  layer,
  onOutputLayerChange,
  onResetOutputLayer,
}: {
  layer: OutputLayerControlItem;
  onOutputLayerChange?: (layerId: string, patch: OutputLayerPatch) => void;
  onResetOutputLayer?: (layerId: string) => void;
}) {
  const colorCommitThrottleMs = 90;
  const opacityCommitThrottleMs = 90;
  const normalizedColor =
    normalizeColorInput(layer.color || layer.originalColor || "") || "#000000";
  const [localColor, setLocalColor] = React.useState(normalizedColor);
  const [colorText, setColorText] = React.useState(normalizedColor);
  const [rgbValue, setRgbValue] = React.useState(() =>
    hexToRgbParts(normalizedColor),
  );
  const [localOpacity, setLocalOpacity] = React.useState(
    Math.round(normalizeOpacity(layer.opacity) * 100),
  );
  const latestColorRef = React.useRef(normalizedColor);
  const latestOpacityRef = React.useRef(normalizeOpacity(layer.opacity));
  const colorTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const opacityTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (colorTimerRef.current) {
      clearTimeout(colorTimerRef.current);
      colorTimerRef.current = null;
    }
    const next = normalizeColorInput(layer.color || layer.originalColor || "") || "#000000";
    setLocalColor((current) => (current === next ? current : next));
    setColorText((current) => (current === next ? current : next));
    const nextRgb = hexToRgbParts(next);
    setRgbValue((current) => (sameRgbParts(current, nextRgb) ? current : nextRgb));
    latestColorRef.current = next;
  }, [layer.color, layer.originalColor]);

  React.useEffect(() => {
    if (opacityTimerRef.current) {
      clearTimeout(opacityTimerRef.current);
      opacityTimerRef.current = null;
    }
    const nextOpacity = normalizeOpacity(layer.opacity);
    const nextPercent = Math.round(nextOpacity * 100);
    setLocalOpacity((current) => (current === nextPercent ? current : nextPercent));
    latestOpacityRef.current = nextOpacity;
  }, [layer.opacity]);

  React.useEffect(() => {
    return () => {
      if (colorTimerRef.current) clearTimeout(colorTimerRef.current);
      if (opacityTimerRef.current) clearTimeout(opacityTimerRef.current);
    };
  }, []);

  function commitColorNow(value = latestColorRef.current) {
    const normalized = normalizeColorInput(value);
    if (!normalized) {
      setColorText(latestColorRef.current);
      return;
    }
    if (colorTimerRef.current) {
      clearTimeout(colorTimerRef.current);
      colorTimerRef.current = null;
    }
    setLocalColor((current) => (current === normalized ? current : normalized));
    setColorText((current) => (current === normalized ? current : normalized));
    const nextRgb = hexToRgbParts(normalized);
    setRgbValue((current) => (sameRgbParts(current, nextRgb) ? current : nextRgb));
    latestColorRef.current = normalized;
    if (normalized !== normalizeColorInput(layer.color || "")) {
      onOutputLayerChange?.(layer.id, { color: normalized });
    }
  }

  function queueColorCommit(value: string) {
    const normalized = normalizeColorInput(value);
    setLocalColor(normalized || value);
    setColorText(value);
    if (!normalized) return;
    latestColorRef.current = normalized;
    if (colorTimerRef.current) return;
    colorTimerRef.current = setTimeout(() => {
      colorTimerRef.current = null;
      commitColorNow(latestColorRef.current);
    }, colorCommitThrottleMs);
  }

  function queueRgbCommit(channel: "r" | "g" | "b", value: string) {
    const draft = { ...rgbValue, [channel]: value };
    setRgbValue(draft);
    const hex = rgbPartsToHex(draft);
    if (!hex) return;
    queueColorCommit(hex);
  }

  function commitOpacityNow(value = latestOpacityRef.current) {
    if (opacityTimerRef.current) {
      clearTimeout(opacityTimerRef.current);
      opacityTimerRef.current = null;
    }
    const opacity = normalizeOpacity(value);
    latestOpacityRef.current = opacity;
    const nextPercent = Math.round(opacity * 100);
    setLocalOpacity((current) => (current === nextPercent ? current : nextPercent));
    if (opacity !== normalizeOpacity(layer.opacity)) {
      onOutputLayerChange?.(layer.id, { opacity });
    }
  }

  function queueOpacityCommit(percent: number) {
    const opacity = normalizeOpacity(percent / 100);
    latestOpacityRef.current = opacity;
    const nextPercent = Math.round(opacity * 100);
    setLocalOpacity((current) => (current === nextPercent ? current : nextPercent));
    if (opacityTimerRef.current) return;
    opacityTimerRef.current = setTimeout(() => {
      opacityTimerRef.current = null;
      commitOpacityNow(latestOpacityRef.current);
    }, opacityCommitThrottleMs);
  }

  const label = layer.label || layer.name || layer.id;
  const original = normalizeColorInput(layer.originalColor || layer.color || "") || normalizedColor;
  const colorInputRef = useNativeColorFinalCommit(commitColorNow);

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden border-t border-slate-100 py-2 first:border-t-0">
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={layer.visible !== false}
          onChange={(event) =>
            onOutputLayerChange?.(layer.id, { visible: event.target.checked })
          }
          className="h-4 w-4 accent-[#0b2dff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          aria-label={`Show ${label}`}
        />
        <input
          ref={colorInputRef}
          type="color"
          value={normalizeColorInput(localColor) || normalizedColor}
          onInput={(event) => queueColorCommit(event.currentTarget.value)}
          onChange={(event) => queueColorCommit(event.currentTarget.value)}
          onPointerUp={() => commitColorNow()}
          onMouseUp={() => commitColorNow()}
          onTouchEnd={() => commitColorNow()}
          onBlur={() => commitColorNow()}
          className="h-7 w-10 rounded-md border border-slate-200 bg-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          aria-label={`Change ${label} color`}
        />
        <input
          type="text"
          value={colorText}
          onChange={(event) => {
            setColorText(event.target.value);
            queueColorCommit(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitColorNow(colorText);
            }
          }}
          onBlur={() => commitColorNow(colorText)}
          aria-label={`${label} hex color`}
          aria-invalid={!normalizeColorInput(colorText)}
          className="min-w-[7rem] flex-1 rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 font-mono text-[12px] text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        />
        <details className="relative shrink-0 max-w-full">
          <summary className="list-none rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors cursor-pointer hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
            RGB
          </summary>
          <div className="absolute right-0 z-20 mt-1 flex max-w-[min(18rem,calc(100vw-3rem))] gap-1 rounded-md border border-slate-200 bg-white p-2 shadow-lg sm:left-0 sm:right-auto">
            {(["r", "g", "b"] as const).map((channel) => (
              <input
                key={channel}
                type="number"
                min={0}
                max={255}
                value={rgbValue[channel]}
                onChange={(event) =>
                  queueRgbCommit(channel, event.target.value)
                }
                onBlur={() => commitColorNow()}
                aria-label={`${label} ${channel.toUpperCase()} channel`}
                className="w-14 rounded-md border border-[#dbe3ef] bg-white px-1 py-1 text-[12px] text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              />
            ))}
          </div>
        </details>
        <div className="min-w-0 flex-[1_1_9rem]">
          <div className="truncate text-[12px] font-semibold text-slate-700">
            {label}
          </div>
          <div className="truncate text-[11px] text-slate-500">
            Original {original}
            {typeof layer.pixelPercent === "number"
              ? ` - ${layer.pixelPercent}%`
              : ""}
          </div>
        </div>
        {onResetOutputLayer ? (
          <button
            type="button"
            onClick={() => onResetOutputLayer(layer.id)}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-semibold text-slate-700 transition-colors cursor-pointer hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            Reset
          </button>
        ) : null}
      </div>
      <label className="mt-2 grid min-w-0 max-w-full gap-1 text-[12px] text-slate-600">
        <span className="shrink-0">Per-layer opacity {localOpacity}%</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={localOpacity}
          onInput={(event) => queueOpacityCommit(Number(event.currentTarget.value))}
          onChange={(event) => commitOpacityNow(Number(event.currentTarget.value) / 100)}
          onPointerUp={() => commitOpacityNow()}
          onMouseUp={() => commitOpacityNow()}
          onTouchEnd={() => commitOpacityNow()}
          onBlur={() => commitOpacityNow()}
          className="min-w-0 flex-1 accent-[#0b2dff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        />
      </label>
    </div>
  );
}

function OutputSizeControls({
  settings,
  outputSize,
  onPatch,
  onOutputSizeChange,
}: {
  settings: TraceAdvancedSettings;
  outputSize?: OutputSizeInfo | null;
  onPatch: (patch: Partial<TraceAdvancedSettings>) => void;
  onOutputSizeChange?: (size: { width: number; height: number }) => void;
}) {
  const originalWidth = positiveNumber(outputSize?.originalWidth) || positiveNumber(outputSize?.width);
  const originalHeight = positiveNumber(outputSize?.originalHeight) || positiveNumber(outputSize?.height);
  const currentWidth =
    positiveNumber(outputSize?.width) ||
    positiveNumber(settings.outputWidth) ||
    originalWidth;
  const currentHeight =
    positiveNumber(outputSize?.height) ||
    positiveNumber(settings.outputHeight) ||
    originalHeight;

  if (!currentWidth || !currentHeight) {
    return (
      <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-[12px] text-slate-500">
        Generate an SVG to edit its exported width and height.
      </div>
    );
  }

  const aspect = currentWidth / currentHeight;
  const baseWidth = originalWidth || currentWidth;
  const baseHeight = originalHeight || currentHeight;

  function commitSize(widthValue: number, heightValue: number) {
    const width = Math.round(clampNumber(widthValue, 1, 6000));
    const height = Math.round(clampNumber(heightValue, 1, 6000));
    onPatch({ outputWidth: width, outputHeight: height });
    onOutputSizeChange?.({ width, height });
  }

  function setWidth(widthValue: number) {
    const width = Math.round(clampNumber(widthValue, 1, 6000));
    const height = settings.preserveAspectRatio
      ? Math.round(clampNumber(width / aspect, 1, 6000))
      : currentHeight;
    commitSize(width, height);
  }

  function setHeight(heightValue: number) {
    const height = Math.round(clampNumber(heightValue, 1, 6000));
    const width = settings.preserveAspectRatio
      ? Math.round(clampNumber(height * aspect, 1, 6000))
      : currentWidth;
    commitSize(width, height);
  }

  function resizeBy(multiplier: number) {
    commitSize(baseWidth * multiplier, baseHeight * multiplier);
  }

  function resetSize() {
    onPatch({ outputWidth: 0, outputHeight: 0 });
    onOutputSizeChange?.({ width: baseWidth, height: baseHeight });
  }

  return (
    <>
      <Field label="SVG width">
        <NumberInput
          value={currentWidth}
          min={1}
          max={6000}
          step={1}
          onCommit={setWidth}
        />
      </Field>
      <Field label="SVG height">
        <NumberInput
          value={currentHeight}
          min={1}
          max={6000}
          step={1}
          onCommit={setHeight}
        />
      </Field>
      <Field label="Preserve aspect ratio">
        <Checkbox
          checked={settings.preserveAspectRatio !== false}
          onChange={(checked) => onPatch({ preserveAspectRatio: checked })}
        />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {[
          ["0.5x", 0.5],
          ["1x", 1],
          ["1.5x", 1.5],
          ["2x", 2],
        ].map(([label, value]) => (
          <button
            key={String(label)}
            type="button"
            onClick={() => resizeBy(Number(value))}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-700 transition-colors cursor-pointer hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={resetSize}
          className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[12px] font-semibold text-slate-700 transition-colors cursor-pointer hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          Reset to original
        </button>
      </div>
    </>
  );
}

function collectDetectedRemoveColors(items?: DetectedColorItem[]) {
  const out: Array<{ color: string; label: string }> = [];
  const seen = new Set<string>();

  for (const item of items || []) {
    for (const layer of item.layers || []) {
      for (const rawColor of [layer.color, layer.originalColor]) {
        const color = normalizeColorInput(String(rawColor || ""));
        if (!color || seen.has(color)) continue;
        seen.add(color);
        out.push({
          color,
          label: layer.label || layer.name || color,
        });
      }
    }
  }

  return out.slice(0, 24);
}

function mergeDetectedColors(
  sourceColors: Array<{ color: string; label: string }>,
  layerColors: Array<{ color: string; label: string }>,
) {
  const out: Array<{ color: string; label: string }> = [];
  const seen = new Set<string>();

  for (const item of [...sourceColors, ...layerColors]) {
    const color = normalizeColorInput(item.color);
    if (!color || seen.has(color)) continue;
    seen.add(color);
    out.push({ color, label: item.label || color });
  }

  return out.slice(0, 28);
}

function normalizeOutputLayers(
  layers?: ReadonlyArray<OutputLayerControlItem | DetectedLayerItem>,
): OutputLayerControlItem[] {
  if (!layers?.length) return [];
  const normalized: OutputLayerControlItem[] = [];

  layers.forEach((layer, index) => {
      const color = normalizeColorInput(layer.color || layer.originalColor || "");
      if (!color) return;
      const originalColor = normalizeColorInput(layer.originalColor || layer.color || "") || color;
      normalized.push({
        id: layer.id || `output-layer-${index + 1}-${color.replace("#", "")}`,
        label: layer.label || layer.name || `Layer ${index + 1}`,
        name: layer.name,
        color,
        originalColor,
        visible: layer.visible !== false,
        opacity: normalizeOpacity(layer.opacity),
        originalOpacity: normalizeOpacity(layer.originalOpacity),
        pixelPercent:
          typeof layer.pixelPercent === "number" ? layer.pixelPercent : undefined,
      });
    });

  return normalized;
}

function positiveNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

function normalizeOpacity(value?: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, Number(value)));
}

function hasPatchChanges<T extends object>(
  current: T,
  patchValue: Partial<T>,
): boolean {
  for (const key of Object.keys(patchValue) as Array<keyof T>) {
    if (!Object.is(current[key], patchValue[key])) return true;
  }
  return false;
}

function detectedColorListsEqual(
  a: Array<{ color: string; label: string }>,
  b: Array<{ color: string; label: string }>,
): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (item, index) =>
      item.color === b[index]?.color && item.label === b[index]?.label,
  );
}

function sameRgbParts(
  a: { r: string; g: string; b: string },
  b: { r: string; g: string; b: string },
): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

function useSourcePaletteColors(
  sourceFile: File | null | undefined,
  enabled: boolean,
) {
  const [colors, setColors] = React.useState<Array<{ color: string; label: string }>>([]);

  React.useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function detect() {
      if (!enabled || !sourceFile || isSvgFile(sourceFile)) {
        setColors((current) => (detectedColorListsEqual(current, []) ? current : []));
        return;
      }

      try {
        objectUrl = URL.createObjectURL(sourceFile);
        const image = new Image();
        image.decoding = "async";
        image.src = objectUrl;
        await image.decode();
        if (cancelled) return;

        const canvas = document.createElement("canvas");
        const maxSide = 72;
        const scale = Math.min(
          1,
          maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1),
        );
        canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
        canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          setColors((current) => (detectedColorListsEqual(current, []) ? current : []));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const buckets = new Map<string, { count: number; color: string }>();

        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 24) continue;
          const r = quantizePaletteChannel(data[i]);
          const g = quantizePaletteChannel(data[i + 1]);
          const b = quantizePaletteChannel(data[i + 2]);
          const color = rgbToHex(r, g, b);
          const bucket = buckets.get(color) || { count: 0, color };
          bucket.count += 1;
          buckets.set(color, bucket);
        }

        const nextColors = Array.from(buckets.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 18)
          .map((bucket) => ({
            color: bucket.color,
            label: `Source ${bucket.color}`,
          }));

        if (!cancelled) {
          setColors((current) =>
            detectedColorListsEqual(current, nextColors) ? current : nextColors,
          );
        }
      } catch {
        if (!cancelled) {
          setColors((current) => (detectedColorListsEqual(current, []) ? current : []));
        }
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }
    }

    void detect();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, sourceFile]);

  return colors;
}

function isSvgFile(file: File) {
  return file.type === "image/svg+xml" || /\.svg$/i.test(file.name || "");
}

function quantizePaletteChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value / 24) * 24));
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, "0"))
    .join("")}`;
}

type SettingsSectionTone =
  | "live"
  | "effects"
  | "layers"
  | "remove"
  | "export"
  | "convert"
  | "cleanup"
  | "appearance";

function getSettingsSectionToneClasses(tone: SettingsSectionTone = "live") {
  const tones: Record<
    SettingsSectionTone,
    {
      shell: string;
      header: string;
      dot: string;
    }
  > = {
    live: {
      shell: "border-sky-100 border-l-sky-300",
      header: "hover:bg-sky-50",
      dot: "bg-sky-400",
    },
    effects: {
      shell: "border-teal-100 border-l-teal-300",
      header: "hover:bg-teal-50",
      dot: "bg-teal-400",
    },
    layers: {
      shell: "border-indigo-100 border-l-indigo-300",
      header: "hover:bg-indigo-50",
      dot: "bg-indigo-400",
    },
    remove: {
      shell: "border-rose-100 border-l-rose-300",
      header: "hover:bg-rose-50",
      dot: "bg-rose-400",
    },
    export: {
      shell: "border-emerald-100 border-l-emerald-300",
      header: "hover:bg-emerald-50",
      dot: "bg-emerald-400",
    },
    convert: {
      shell: "border-amber-100 border-l-amber-300",
      header: "hover:bg-amber-50",
      dot: "bg-amber-400",
    },
    cleanup: {
      shell: "border-orange-100 border-l-orange-300",
      header: "hover:bg-orange-50",
      dot: "bg-orange-400",
    },
    appearance: {
      shell: "border-violet-100 border-l-violet-300",
      header: "hover:bg-violet-50",
      dot: "bg-violet-400",
    },
  };
  return tones[tone];
}

function SettingSection({
  title,
  children,
  sectionId,
  open,
  onToggle,
  tone = "live",
  footer,
}: {
  title: string;
  children: React.ReactNode;
  sectionId?: string;
  open?: boolean;
  onToggle?: () => void;
  tone?: SettingsSectionTone;
  footer?: React.ReactNode;
}) {
  const toneClasses = getSettingsSectionToneClasses(tone);

  if (sectionId && onToggle && typeof open === "boolean") {
    return (
      <section
        data-settings-section={sectionId}
        data-settings-section-open={open ? "true" : "false"}
        data-settings-section-tone={tone}
        className={[
          "min-w-0 max-w-full overflow-hidden rounded-lg border border-l-4 bg-white/95 shadow-sm shadow-slate-900/[0.03]",
          toneClasses.shell,
        ].join(" ")}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={sectionId}
          className={[
            "flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-[13px] font-bold text-sky-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-inset",
            toneClasses.header,
          ].join(" ")}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={["h-2 w-2 shrink-0 rounded-full", toneClasses.dot].join(" ")}
              aria-hidden="true"
            />
            <span className="min-w-0 truncate">{title}</span>
          </span>
          <ChevronDownIcon open={open} />
        </button>
        <div
          className={[
            "grid min-w-0 max-w-full transition-[grid-template-rows] duration-[210ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          ].join(" ")}
        >
          <div
            id={sectionId}
            aria-hidden={!open}
            className={[
              "min-w-0 max-w-full overflow-hidden transition-opacity duration-[210ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none",
              open ? "opacity-100" : "opacity-0",
            ].join(" ")}
          >
            <div className="flex min-w-0 max-w-full flex-col gap-2 overflow-x-hidden border-t border-slate-100 p-2 sm:p-3">
              {children}
              {footer ? (
                <div className="mt-1 border-t border-slate-100 pt-2">
                  {footer}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      data-settings-section-tone={tone}
      className={[
        "min-w-0 max-w-full rounded-lg border border-l-4 bg-white/95 p-2 shadow-sm shadow-slate-900/[0.03] sm:p-3",
        toneClasses.shell,
      ].join(" ")}
    >
      <h3 className="m-0 mb-2 flex min-w-0 items-center gap-2 text-[13px] font-bold text-sky-950">
        <span
          className={["h-2 w-2 shrink-0 rounded-full", toneClasses.dot].join(" ")}
          aria-hidden="true"
        />
        <span className="min-w-0 truncate">{title}</span>
      </h3>
      <div className="flex min-w-0 max-w-full flex-col gap-2 overflow-x-hidden">
        {children}
        {footer ? (
          <div className="mt-1 border-t border-slate-100 pt-2">{footer}</div>
        ) : null}
      </div>
    </section>
  );
}

function UpdatePreviewAction({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex min-w-0 justify-end">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={[
          "inline-flex min-h-9 w-full cursor-pointer items-center justify-center rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors sm:w-auto",
          "border-amber-200 bg-white text-slate-900 shadow-sm hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300",
          "disabled:cursor-not-allowed disabled:opacity-60",
        ].join(" ")}
      >
        {label}
      </button>
    </div>
  );
}

function AdvancedTopLevelSection({
  title,
  description,
  tone,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  description: string;
  tone: "live" | "convert";
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const contentId = React.useId();
  const toneClass =
    tone === "live"
      ? "border-sky-200 border-l-sky-400 bg-sky-50/70"
      : "border-amber-200 border-l-amber-400 bg-amber-50/70";
  const dotClass = tone === "live" ? "bg-sky-500" : "bg-amber-500";

  return (
    <section
      data-settings-top-section-tone={tone}
      data-settings-top-section-open={open ? "true" : "false"}
      className={["min-w-0 max-w-full overflow-hidden rounded-xl border border-l-4 p-2 sm:p-3", toneClass].join(" ")}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={contentId}
          className="group flex min-w-0 flex-1 cursor-pointer items-start justify-between gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
        >
          <div className="min-w-0">
            <h3 className="m-0 flex min-w-0 items-center gap-2 text-[13px] font-bold text-sky-950">
              <span
                className={["h-2 w-2 shrink-0 rounded-full", dotClass].join(" ")}
                aria-hidden="true"
              />
              <span className="min-w-0 truncate">{title}</span>
            </h3>
            <p className="m-0 mt-0.5 text-[12px] leading-5 text-slate-600">
              {description}
            </p>
          </div>
          <span className="mt-0.5 shrink-0 rounded-full p-0.5 text-slate-500 transition-colors group-hover:bg-white/70 group-hover:text-slate-700">
            <ChevronDownIcon open={open} />
          </span>
        </button>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div
        id={contentId}
        className={[
          "grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out",
          open ? "mt-2 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0",
        ].join(" ")}
      >
        <div
          className={[
            "min-h-0 overflow-hidden",
            open ? "pointer-events-auto" : "pointer-events-none",
          ].join(" ")}
        >
          <div className="flex min-w-0 max-w-full flex-col gap-2 overflow-x-hidden">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

function toggleAccordionSection(
  setOpenSection: React.Dispatch<React.SetStateAction<string | null>>,
  sectionId: string,
) {
  setOpenSection((current) => (current === sectionId ? null : sectionId));
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid min-w-0 max-w-full gap-2 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 text-[13px] text-slate-800 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)] sm:items-center sm:px-3">
      <span className="min-w-0 break-words font-medium">{label}</span>
      <span className="flex min-w-0 w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
        {children}
      </span>
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
      className="w-full min-w-0 max-w-full rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 cursor-pointer transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:max-w-[190px]"
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
  const normalizedInitial = normalizeColorInput(value) || "#ffffff";
  const normalize = React.useCallback(
    (nextValue: string) => normalizeColorInput(nextValue),
    [],
  );
  const controller = useThrottledCommit({
    value: normalizedInitial,
    onCommit,
    delayMs: 180,
    leading: false,
    normalize,
  });
  const [textValue, setTextValue] = React.useState(normalizedInitial);
  const [rgbValue, setRgbValue] = React.useState(() =>
    hexToRgbParts(normalizedInitial),
  );

  React.useEffect(() => {
    const normalized = normalizeColorInput(value) || "#ffffff";
    setTextValue((current) => (current === normalized ? current : normalized));
    const nextRgb = hexToRgbParts(normalized);
    setRgbValue((current) => (sameRgbParts(current, nextRgb) ? current : nextRgb));
  }, [value]);

  function schedule(nextValue: string) {
    const normalized = normalizeColorInput(nextValue);
    setTextValue((current) => (current === nextValue ? current : nextValue));
    if (!normalized) return;
    const nextRgb = hexToRgbParts(normalized);
    setRgbValue((current) => (sameRgbParts(current, nextRgb) ? current : nextRgb));
    controller.schedule(normalized);
  }

  function flush(nextValue = textValue) {
    const normalized =
      normalizeColorInput(nextValue) ||
      normalizeColorInput(controller.draft) ||
      normalizedInitial;
    setTextValue((current) => (current === normalized ? current : normalized));
    const nextRgb = hexToRgbParts(normalized);
    setRgbValue((current) => (sameRgbParts(current, nextRgb) ? current : nextRgb));
    controller.flush(normalized);
  }

  function updateRgb(channel: "r" | "g" | "b", next: string) {
    const draft = { ...rgbValue, [channel]: next };
    setRgbValue((current) => (sameRgbParts(current, draft) ? current : draft));
    const hex = rgbPartsToHex(draft);
    if (hex) schedule(hex);
  }
  const colorInputRef = useNativeColorFinalCommit(flush);

  return (
    <span className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
      <input
        ref={colorInputRef}
        type="color"
        value={normalizeColorInput(controller.draft) || normalizedInitial}
        disabled={disabled}
        title={title}
        onInput={(event) => schedule(event.currentTarget.value)}
        onChange={(event) => schedule(event.currentTarget.value)}
        onPointerUp={() => flush()}
        onMouseUp={() => flush()}
        onTouchEnd={() => flush()}
        onBlur={() => flush()}
        className={[
          "h-7 w-10 rounded-md border border-[#dbe3ef] bg-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
          disabled ? "opacity-50 pointer-events-none" : "",
        ].join(" ")}
        aria-label={title || "Pick color"}
      />
      <input
        type="text"
        value={textValue}
        disabled={disabled}
        onChange={(event) => schedule(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            flush();
          }
        }}
        onBlur={() => flush()}
        aria-invalid={!normalizeColorInput(textValue)}
        className={[
          "min-w-0 w-[96px] rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 font-mono text-[12px] text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:w-[104px]",
          disabled ? "opacity-50 pointer-events-none" : "",
        ].join(" ")}
        aria-label="Hex color"
      />
      <details className="relative">
        <summary
          className={[
            "list-none rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors cursor-pointer hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
            disabled ? "opacity-50 pointer-events-none" : "",
          ].join(" ")}
        >
          RGB
        </summary>
        <div className="absolute right-0 z-20 mt-1 flex gap-1 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          {(["r", "g", "b"] as const).map((channel) => (
            <input
              key={channel}
              type="number"
              min={0}
              max={255}
              value={rgbValue[channel]}
              disabled={disabled}
              onChange={(event) => updateRgb(channel, event.target.value)}
              onBlur={() => flush()}
              aria-label={`${channel.toUpperCase()} color channel`}
              className="w-14 rounded-md border border-[#dbe3ef] bg-white px-1 py-1 text-[12px] text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            />
          ))}
        </div>
      </details>
    </span>
  );
}

function hexToRgbParts(hex: string) {
  const normalized = normalizeColorInput(hex) || "#ffffff";
  return {
    r: String(parseInt(normalized.slice(1, 3), 16)),
    g: String(parseInt(normalized.slice(3, 5), 16)),
    b: String(parseInt(normalized.slice(5, 7), 16)),
  };
}

function rgbPartsToHex(rgb: { r: string; g: string; b: string }) {
  const channels = [rgb.r, rgb.g, rgb.b].map((value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.min(255, Math.round(parsed)));
  });
  if (channels.some((channel) => channel == null)) return null;
  return `#${channels
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("")}`;
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
  const normalize = React.useCallback(
    (nextValue: number) => {
      const numberValue = Number(nextValue);
      if (!Number.isFinite(numberValue)) return null;
      return clampNumber(numberValue, min, max);
    },
    [max, min],
  );
  const controller = useThrottledCommit({
    value: normalize(value) ?? min,
    onCommit,
    delayMs: 100,
    normalize,
    isEqual: areNumbersNearlyEqual,
  });

  function schedule(next: number) {
    controller.schedule(next);
  }

  function flush(next?: number) {
    controller.flush(next);
  }

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={controller.draft}
      onInput={(event) => schedule(Number(event.currentTarget.value))}
      onChange={(event) => schedule(Number(event.currentTarget.value))}
      onPointerUp={(event) => flush(Number(event.currentTarget.value))}
      onMouseUp={(event) => flush(Number(event.currentTarget.value))}
      onTouchEnd={(event) => flush(Number(event.currentTarget.value))}
      onKeyUp={(event) => flush(Number(event.currentTarget.value))}
      onBlur={(event) => flush(Number(event.currentTarget.value))}
      className="w-full min-w-[8rem] max-w-full accent-[#0b2dff] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:w-[140px]"
    />
  );
}

function areNumbersNearlyEqual(left: number, right: number) {
  return Math.abs(left - right) < 0.0001;
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
    const nextText = String(value);
    setText((current) => (current === nextText ? current : nextText));
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
      className="w-full min-w-0 max-w-[160px] rounded-md border border-[#dbe3ef] bg-white px-2 py-1.5 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:w-[110px]"
    />
  );
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
