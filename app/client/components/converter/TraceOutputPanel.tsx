import * as React from "react";
import Icons from "~/client/assets/icons/Icons";
import {
  FullscreenPreviewButton,
  PreviewHistoryArrowButton,
} from "~/client/components/converter/FullscreenOutputPreview";
import {
  TraceAdvancedSettingsPanel,
  type MixedTraceSettings,
} from "~/client/components/converter/AdvancedSettingsPanel";
import type { ConverterRouteCapabilities } from "~/client/lib/converter/routeCapabilities";
import type { TraceResult } from "~/shared/tracing/types";
import {
  EditedSvgPreviewImage,
  ensureSvgRootNamespace,
  getEditedSvg,
} from "~/client/components/svg/EditedSvgPreviewImage";
import {
  type EditableSvgLayer,
} from "~/client/components/svg/LayerPaletteEditor";
import {
  DEFAULT_OUTPUT_APPEARANCE,
  applyOutputAppearanceToSvg,
  detectOutputAppearanceSupport,
  hasOutputAppearanceChanges,
  normalizeOutputAppearance,
  type OutputAppearanceSettings,
} from "~/client/lib/converter/outputAppearance";
import {
  useNativeColorFinalCommit,
  useThrottledCommit,
} from "~/client/hooks/useThrottledCommit";

type OutputVersion<TSettings extends MixedTraceSettings> = {
  svg: string;
  layers?: EditableSvgLayer[];
  width: number;
  height: number;
  originalWidth?: number;
  originalHeight?: number;
  settingsSnapshot?: TSettings;
  engineUsed?: TraceResult["engineUsed"];
  sourceKind?: "svg" | "raster";
  warnings?: string[];
  timings?: Record<string, number>;
  layerBuildMode?: string;
  requestedPaletteCount?: number;
  actualPaletteCount?: number;
  outputDetectedColors?: number;
  pathCount?: number;
  svgBytes?: number;
};

export type TraceOutputItem<TSettings extends MixedTraceSettings> = {
  svg: string;
  layers?: EditableSvgLayer[];
  width: number;
  height: number;
  originalWidth?: number;
  originalHeight?: number;
  stamp: number;
  name?: string;
  presetLabel?: string;
  settingsSnapshot?: TSettings;
  draftSettings?: TSettings;
  engineUsed?: TraceResult["engineUsed"];
  sourceKind?: "svg" | "raster";
  warnings?: string[];
  timings?: Record<string, number>;
  layerBuildMode?: string;
  requestedPaletteCount?: number;
  actualPaletteCount?: number;
  outputDetectedColors?: number;
  pathCount?: number;
  svgBytes?: number;
  settingsOpen?: boolean;
  updateError?: string | null;
  previousVersion?: OutputVersion<TSettings> | null;
  nextVersion?: OutputVersion<TSettings> | null;
  jobId?: string;
  jobStatus?: "queued" | "running" | "succeeded" | "failed" | "canceled";
  jobStartedAt?: number;
  jobCompletedAt?: number;
  jobError?: string | null;
  sourceFileName?: string;
  sourceMimeType?: string;
  sourceFileSize?: number;
  sourcePreviewUrl?: string;
  enginePathLabel?: string;
  canCancel?: boolean;
  appearance?: OutputAppearanceSettings;
};

export type TraceOutputLayerPatch = {
  color?: string;
  visible?: boolean;
  opacity?: number;
};

const outputAppearanceStore = new Map<string, OutputAppearanceSettings>();
type OutputAppearanceSvgCacheEntry = {
  baseSvg: string;
  settingsKey: string;
  precisionOutput: boolean;
  svg: string;
};
const outputAppearanceSvgCache = new Map<string, OutputAppearanceSvgCacheEntry>();

export function getTraceOutputSvg<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
): string {
  const baseSvg = getTraceOutputBaseSvg(item);
  const appearance = getStoredOutputAppearance(item);
  if (!hasOutputAppearanceChanges(appearance)) return baseSvg;
  const cacheKey = getOutputAppearanceKey(item);
  const settingsKey = serializeOutputAppearance(appearance);
  const precisionOutput = isPrecisionOutputItem(item);
  const cached = outputAppearanceSvgCache.get(cacheKey);
  if (
    cached &&
    cached.baseSvg === baseSvg &&
    cached.settingsKey === settingsKey &&
    cached.precisionOutput === precisionOutput
  ) {
    return cached.svg;
  }
  const support = detectOutputAppearanceSupport(baseSvg, {
    precisionOutput,
  });
  const svg = applyOutputAppearanceToSvg(baseSvg, appearance, support, {
    idPrefix: `output-${getOutputAppearanceKey(item)}`,
  });
  outputAppearanceSvgCache.set(cacheKey, {
    baseSvg,
    settingsKey,
    precisionOutput,
    svg,
  });
  return svg;
}

export function getTraceOutputBaseSvg<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
): string {
  const edited = getEditedSvg(item.svg, item.layers);
  return applySvgSizeAttributes(edited, item.width, item.height);
}

export function snapshotTraceOutputVersion<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
): OutputVersion<TSettings> {
  return {
    svg: item.svg,
    layers: cloneEditableLayers(item.layers),
    width: item.width,
    height: item.height,
    originalWidth: item.originalWidth,
    originalHeight: item.originalHeight,
    settingsSnapshot: item.settingsSnapshot,
    engineUsed: item.engineUsed,
    sourceKind: item.sourceKind,
    warnings: item.warnings,
    timings: item.timings,
    layerBuildMode: item.layerBuildMode,
    requestedPaletteCount: item.requestedPaletteCount,
    actualPaletteCount: item.actualPaletteCount,
    outputDetectedColors: item.outputDetectedColors,
    pathCount: item.pathCount,
    svgBytes: item.svgBytes,
  };
}

export function applyTraceOutputVersion<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
  version: OutputVersion<TSettings>,
): TraceOutputItem<TSettings> {
  return {
    ...item,
    svg: version.svg,
    layers: cloneEditableLayers(version.layers),
    width: version.width,
    height: version.height,
    originalWidth: version.originalWidth,
    originalHeight: version.originalHeight,
    settingsSnapshot: version.settingsSnapshot,
    engineUsed: version.engineUsed,
    sourceKind: version.sourceKind,
    warnings: version.warnings,
    timings: version.timings,
    layerBuildMode: version.layerBuildMode,
    requestedPaletteCount: version.requestedPaletteCount,
    actualPaletteCount: version.actualPaletteCount,
    outputDetectedColors: version.outputDetectedColors,
    pathCount: version.pathCount,
    svgBytes: version.svgBytes,
    draftSettings: version.settingsSnapshot ?? item.draftSettings,
  };
}

export function cloneEditableLayers(
  layers?: ReadonlyArray<EditableSvgLayer> | null,
): EditableSvgLayer[] | undefined {
  return layers?.map((layer) => ({ ...layer }));
}

export function stepTraceOutputVersion<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
  direction: "previous" | "next",
): TraceOutputItem<TSettings> {
  if (direction === "previous" && item.previousVersion) {
    return {
      ...applyTraceOutputVersion(item, item.previousVersion),
      previousVersion: null,
      nextVersion: snapshotTraceOutputVersion(item),
      updateError: null,
    };
  }

  if (direction === "next" && item.nextVersion) {
    return {
      ...applyTraceOutputVersion(item, item.nextVersion),
      previousVersion: snapshotTraceOutputVersion(item),
      nextVersion: null,
      updateError: null,
    };
  }

  return item;
}

export function replaceTraceOutputCurrent<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
  version: OutputVersion<TSettings>,
): TraceOutputItem<TSettings> {
  return {
    ...applyTraceOutputVersion(item, version),
    previousVersion: snapshotTraceOutputVersion(item),
    nextVersion: null,
    updateError: null,
  };
}

type TraceOutputPanelProps<TSettings extends MixedTraceSettings> = {
  history: TraceOutputItem<TSettings>[];
  busy?: boolean;
  buttonDisabled?: boolean;
  updatingStamp?: number | null;
  file?: File | null;
  fallbackSettings: TSettings;
  routeCapabilities: ConverterRouteCapabilities;
  downloadLabel?: string;
  downloadFileName?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  helpHref?: string;
  fullscreenPreviewIndex: number | null;
  setFullscreenPreviewIndex: (index: number | null) => void;
  onCopySvg: (svg: string) => void | Promise<void>;
  onToggleSettings: (stamp: number) => void;
  onDraftSettingsChange: (
    stamp: number,
    updater: React.SetStateAction<TSettings>,
  ) => void;
  onUpdatePreview: (stamp: number) => void;
  onStepVersion: (stamp: number, direction: "previous" | "next") => void;
  onOutputLayerChange: (
    stamp: number,
    layerId: string,
    patch: TraceOutputLayerPatch,
  ) => void;
  onResetOutputLayer: (stamp: number, layerId: string) => void;
  onResetAllOutputLayers: (stamp: number) => void;
  onOutputSizeChange?: (
    stamp: number,
    size: { width: number; height: number },
  ) => void;
  onCancelOutputJob?: (jobId: string, stamp: number) => void;
  onRetryOutputJob?: (stamp: number) => void;
};

export function FocusedEditorPreviewComparison({
  outputSvg,
  outputAlt,
  originalPreviewUrl,
  originalAlt = "Original image",
  toolbar,
}: {
  outputSvg: string;
  outputAlt: string;
  originalPreviewUrl?: string | null;
  originalAlt?: string;
  toolbar?: React.ReactNode;
}) {
  const [originalCollapsed, setOriginalCollapsed] = React.useState(false);

  return (
    <div
      data-editor-comparison-panel="true"
      className="grid min-w-0 gap-3 lg:sticky lg:top-4 lg:self-start"
    >
      <div
        data-editor-output-preview="true"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
          <p className="m-0 text-[13px] font-bold text-slate-800">Output</p>
          {toolbar ? <div className="flex shrink-0 gap-1.5">{toolbar}</div> : null}
        </div>
        <div className="flex min-h-[360px] items-center justify-center p-3 transparent-checkerboard md:min-h-[460px] xl:min-h-[520px]">
          {outputSvg ? (
            <EditedSvgPreviewImage
              svg={outputSvg}
              layers={null}
              alt={outputAlt}
              className="h-auto max-h-[68vh] max-w-full"
            />
          ) : (
            <p className="m-0 text-sm font-semibold text-slate-500">
              Output preview unavailable.
            </p>
          )}
        </div>
      </div>

      <div
        data-editor-original-preview="true"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
          <p className="m-0 min-w-0 truncate text-[13px] font-bold text-slate-800">
            Original
          </p>
          <button
            type="button"
            aria-expanded={!originalCollapsed}
            aria-label={
              originalCollapsed
                ? "Restore original image"
                : "Minimize original image"
            }
            onClick={() => setOriginalCollapsed((value) => !value)}
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:hidden"
          >
            {originalCollapsed ? "Restore" : "Minimize"}
          </button>
        </div>
        {originalCollapsed ? (
          <div className="px-3 py-2 text-[12px] font-medium text-slate-500 sm:hidden">
            Source preview hidden.
          </div>
        ) : (
          <div className="flex max-h-[260px] min-h-[150px] items-center justify-center overflow-hidden p-3 transparent-checkerboard">
            {originalPreviewUrl ? (
              <img
                src={originalPreviewUrl}
                alt={originalAlt}
                className="h-auto max-h-[240px] max-w-full object-contain"
              />
            ) : (
              <p className="m-0 text-center text-[13px] font-medium text-slate-500">
                Original image preview unavailable for this route.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TraceOutputPanel<TSettings extends MixedTraceSettings>({
  history,
  busy,
  buttonDisabled,
  updatingStamp,
  file,
  fallbackSettings,
  routeCapabilities,
  downloadLabel = "Download SVG",
  downloadFileName = "converted.svg",
  emptyTitle = "Converted files appear here...",
  emptyDescription = "Convert your input to preview, copy, or download the result.",
  helpHref = "#advanced-settings-help",
  fullscreenPreviewIndex,
  setFullscreenPreviewIndex,
  onCopySvg,
  onToggleSettings,
  onDraftSettingsChange,
  onUpdatePreview,
  onStepVersion,
  onOutputLayerChange,
  onResetOutputLayer,
  onResetAllOutputLayers,
  onOutputSizeChange,
  onCancelOutputJob,
  onRetryOutputJob,
}: TraceOutputPanelProps<TSettings>) {
  const hasActiveJob = history.some((item) => isTraceJobActive(item.jobStatus));
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const [focusedOutputStamp, setFocusedOutputStamp] = React.useState<
    number | null
  >(null);
  const [collapsedOutputStamps, setCollapsedOutputStamps] = React.useState<
    ReadonlySet<number>
  >(() => new Set());
  const [highlightedOutputStamp, setHighlightedOutputStamp] = React.useState<
    number | null
  >(null);
  const [focusedSettingsSections, setFocusedSettingsSections] = React.useState<
    Map<number, string | null>
  >(() => new Map());
  const [appearanceVersion, setAppearanceVersion] = React.useState(0);
  const focusedOutputHasSourcePreview = React.useMemo(
    () =>
      focusedOutputStamp != null &&
      history.some(
        (item) => item.stamp === focusedOutputStamp && item.sourcePreviewUrl,
      ),
    [focusedOutputStamp, history],
  );
  const [activeSourcePreviewUrl, setActiveSourcePreviewUrl] = React.useState<
    string | null
  >(null);
  React.useEffect(() => {
    if (!hasActiveJob) return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [hasActiveJob]);

  React.useEffect(() => {
    if (focusedOutputStamp == null) return;
    if (history.some((item) => item.stamp === focusedOutputStamp)) return;
    setFocusedOutputStamp(null);
  }, [focusedOutputStamp, history]);

  React.useEffect(() => {
    if (focusedOutputStamp == null) return;
    const stamp = focusedOutputStamp;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeFocusedEditor(stamp);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusedOutputStamp]);

  React.useEffect(() => {
    if (focusedOutputStamp == null || !file || focusedOutputHasSourcePreview) {
      setActiveSourcePreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setActiveSourcePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, focusedOutputHasSourcePreview, focusedOutputStamp]);

  React.useEffect(() => {
    pruneOutputAppearanceState(history.map((item) => getOutputAppearanceKey(item)));
  }, [history]);

  function closeFocusedEditor(stamp: number) {
    setFocusedOutputStamp(null);
    setHighlightedOutputStamp(stamp);
    window.setTimeout(() => {
      const card = document.querySelector<HTMLElement>(
        `[data-output-stamp="${stamp}"]`,
      );
      card?.scrollIntoView({ block: "center", behavior: "smooth" });
      const focusTarget = card?.querySelector<HTMLElement>(
        "[data-output-primary-action]",
      );
      (focusTarget || card)?.focus?.({ preventScroll: true });
    }, 80);
    window.setTimeout(() => {
      setHighlightedOutputStamp((current) => (current === stamp ? null : current));
    }, 1_500);
  }

  function setFocusedSettingsSection(stamp: number, sectionId: string | null) {
    setFocusedSettingsSections((current) => {
      const next = new Map(current);
      if (sectionId) {
        next.set(stamp, sectionId);
      } else {
        next.delete(stamp);
      }
      return next;
    });
  }

  function openFocusedEditor(stamp: number, sectionId: string | null = null) {
    setFocusedSettingsSection(stamp, sectionId);
    setFocusedOutputStamp(stamp);
    setCollapsedOutputStamps((current) => {
      if (!current.has(stamp)) return current;
      const next = new Set(current);
      next.delete(stamp);
      return next;
    });
  }

  function toggleCollapsedOutput(stamp: number) {
    setCollapsedOutputStamps((current) => {
      const next = new Set(current);
      if (next.has(stamp)) next.delete(stamp);
      else next.add(stamp);
      return next;
    });
  }

  function setOutputAppearance(
    item: TraceOutputItem<TSettings>,
    patch: Partial<OutputAppearanceSettings>,
  ) {
    const key = getOutputAppearanceKey(item);
    const current = getStoredOutputAppearance(item);
    const next = normalizeOutputAppearance({ ...current, ...patch });
    if (serializeOutputAppearance(current) === serializeOutputAppearance(next)) return;
    outputAppearanceStore.set(key, next);
    outputAppearanceSvgCache.delete(key);
    React.startTransition(() => {
      setAppearanceVersion((value) => value + 1);
    });
  }

  function resetOutputAppearance(item: TraceOutputItem<TSettings>) {
    const key = getOutputAppearanceKey(item);
    const current = getStoredOutputAppearance(item);
    if (
      serializeOutputAppearance(current) ===
        serializeOutputAppearance(DEFAULT_OUTPUT_APPEARANCE) &&
      !outputAppearanceSvgCache.has(key)
    ) {
      return;
    }
    outputAppearanceStore.set(key, DEFAULT_OUTPUT_APPEARANCE);
    outputAppearanceSvgCache.delete(key);
    React.startTransition(() => {
      setAppearanceVersion((value) => value + 1);
    });
  }

  const focusedMode = focusedOutputStamp != null;
  void appearanceVersion;

  return (
    <div
      data-focused-editor={focusedMode ? "true" : "false"}
      data-output-panel-focused={focusedMode ? "true" : "false"}
      className={[
        "converter-output-panel order-3 min-w-0 overflow-visible rounded-xl border border-slate-300/40 bg-[#43546b] p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)] transition-[opacity,transform,box-shadow] duration-[300ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:rounded-2xl sm:p-4 md:order-2 md:overflow-auto",
        history.length === 0 && !busy ? "hidden md:block" : "",
        focusedMode
          ? "md:col-span-2 md:row-start-1 md:max-h-none md:self-start"
          : "md:sticky md:top-4 md:row-span-3 md:max-h-[calc(100vh-2rem)] md:self-start",
      ].join(" ")}
    >
      {busy && (
        <span className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-900 animate-spin" />
      )}
      {history.length > 0 ? (
        <div className="grid gap-3">
          {history.map((item, index) => {
            const outputSettings =
              item.draftSettings ?? item.settingsSnapshot ?? fallbackSettings;
            const isUpdating = updatingStamp === item.stamp;
            const jobStatus = item.jobStatus ?? "succeeded";
            const isActiveJob = isTraceJobActive(jobStatus);
            const isFailedJob = jobStatus === "failed" || jobStatus === "canceled";
            const previewSvg =
              isActiveJob || isFailedJob || !item.svg ? "" : getTraceOutputSvg(item);
            const displaySvgBytes = previewSvg
              ? getSvgByteSize(previewSvg)
              : item.svgBytes;
            const label = getOutputLabel(item, index);
            const elapsedMs = getTraceJobElapsedMs(item, nowMs);
            const focused = focusedOutputStamp === item.stamp;
            const sourceAvailableForOutput =
              !item.sourceFileName || file?.name === item.sourceFileName;
            const focusedSettingsSection =
              focusedSettingsSections.get(item.stamp) ?? null;
            if (focusedOutputStamp != null && !focused) return null;
            const collapsed =
              !focused && collapsedOutputStamps.has(item.stamp);
            const appearance = getStoredOutputAppearance(item);
            const appearanceSupport =
              (focused || item.settingsOpen) && item.svg
                ? detectOutputAppearanceSupport(getTraceOutputBaseSvg(item), {
                    precisionOutput:
                      routeCapabilities.group === "cricut" ||
                      isPrecisionOutputItem(item),
                  })
                : null;
            const appearanceControls =
              appearanceSupport && !isActiveJob && !isFailedJob ? (
                <OutputAppearanceControls
                  settings={appearance}
                  support={appearanceSupport}
                  controlId={`output-${item.stamp}`}
                  strokeOutputMode={outputSettings.strokeOutputMode || "filled"}
                  strokeOutputModeAvailable={routeCapabilities.supportsStrokeTrace}
                  strokeOutputModeDisabledReason={
                    !routeCapabilities.supportsStrokeTrace
                      ? "Centerline stroke retracing is not available on this route."
                      : outputSettings.traceMode === "layered" || item.layers?.length
                        ? "Centerline strokes are for single line-art outputs, not layered color results."
                        : routeCapabilities.group === "cricut" || isPrecisionOutputItem(item)
                          ? "Centerline mode is hidden for precision cut-file outputs."
                          : !sourceAvailableForOutput
                            ? item.sourceFileName
                              ? `Choose the original source image (${item.sourceFileName}) to retrace this output.`
                              : "Choose the original source image to retrace this output."
                            : null
                  }
                  onStrokeOutputModeChange={
                    routeCapabilities.supportsStrokeTrace
                      ? (mode) => {
                          const nextSettings = {
                            ...outputSettings,
                            traceMode: "single" as const,
                            strokeOutputMode: mode,
                          };
                          onDraftSettingsChange(item.stamp, nextSettings);
                          window.setTimeout(() => onUpdatePreview(item.stamp), 0);
                        }
                      : undefined
                  }
                  onChange={(patch) => setOutputAppearance(item, patch)}
                  onReset={() => resetOutputAppearance(item)}
                />
              ) : null;
            const settingsPanel =
              focused || item.settingsOpen ? (
                <div
                  id={`output-settings-${item.stamp}`}
                  data-editor-settings-panel={focused ? "true" : undefined}
                  className={[
                    "rounded-xl border border-sky-200 bg-sky-50/70 p-2",
                    focused
                      ? "max-h-none min-w-0 max-w-full overflow-x-hidden p-3"
                      : "mb-2",
                  ].join(" ")}
                >
                  <TraceAdvancedSettingsPanel
                    id={`output-settings-panel-${item.stamp}`}
                    open={true}
                    settings={outputSettings}
                    setSettings={(updater) =>
                      onDraftSettingsChange(item.stamp, updater)
                    }
                    capabilities={routeCapabilities}
                    detectedColorItems={[item]}
                    sourceFile={sourceAvailableForOutput ? file : null}
                    removeColorsEnabled={
                      !(
                        sourceAvailableForOutput &&
                        file &&
                        (file.type === "image/svg+xml" ||
                          /\.svg$/i.test(file.name || ""))
                      )
                    }
                    outputLayerItems={item.layers}
                    outputSize={{
                      width: item.width,
                      height: item.height,
                      originalWidth: item.originalWidth || item.width,
                      originalHeight: item.originalHeight || item.height,
                    }}
                    onOutputLayerChange={(layerId, patch) =>
                      onOutputLayerChange(item.stamp, layerId, patch)
                    }
                    onResetOutputLayer={(layerId) =>
                      onResetOutputLayer(item.stamp, layerId)
                    }
                    onResetAllOutputLayers={() =>
                      onResetAllOutputLayers(item.stamp)
                    }
                    onOutputSizeChange={
                      onOutputSizeChange
                        ? (size) => onOutputSizeChange(item.stamp, size)
                        : undefined
                    }
                    helpHref={helpHref}
                    buttonDisabled={
                      buttonDisabled || isUpdating || !sourceAvailableForOutput
                    }
                    liveSectionTitle="Live Preview Edits"
                    liveSectionDescription="These controls update the visible SVG right away. Copy, download, fullscreen, and batch use what you see here."
                    livePreviewLeadTitle="Post-processing"
                    livePreviewLead={appearanceControls}
                    convertSectionTitle="Click To Convert"
                    convertSectionDescription={
                      sourceAvailableForOutput
                        ? "Use Update preview when you are ready. These controls rebuild this output from the original image, so the app does not restart conversion after every slider or color change."
                        : item.sourceFileName
                          ? `Update preview needs the original source file (${item.sourceFileName}). Copy and download still use the saved SVG.`
                          : "Choose the original source image to retrace this output. Copy and download still use the saved SVG."
                    }
                    hideOutputLayerStyling={false}
                    focusedEditorMode={focused}
                    defaultOpenSection={null}
                    openSection={focused ? focusedSettingsSection : undefined}
                    onOpenSectionChange={
                      focused
                        ? (sectionId) =>
                            setFocusedSettingsSection(item.stamp, sectionId)
                        : undefined
                    }
                    updatePreviewLabel={
                      isUpdating ? "Updating..." : "Update preview"
                    }
                    onUpdatePreview={() => onUpdatePreview(item.stamp)}
                  />
                </div>
              ) : null;

            if (collapsed) {
              return (
                <CollapsedTraceOutputCard
                  key={item.stamp}
                  item={item}
                  label={label}
                  jobStatus={jobStatus}
                  elapsedMs={elapsedMs}
                  previewSvg={previewSvg}
                  displaySvgBytes={displaySvgBytes}
                  hasAppearanceChanges={hasOutputAppearanceChanges(appearance)}
                  onToggleCollapsed={() => toggleCollapsedOutput(item.stamp)}
                  onCopySvg={onCopySvg}
                  onDownloadSvg={() => downloadSvg(previewSvg, downloadFileName)}
                  onCancelOutputJob={onCancelOutputJob}
                  onRetryOutputJob={onRetryOutputJob}
                />
              );
            }

            return (
              <div
                key={item.stamp}
                tabIndex={-1}
                data-output-stamp={item.stamp}
                data-focused-editor={focused ? "true" : "false"}
                data-collapse-state="expanded"
                data-job-id={item.jobId || ""}
                data-job-status={jobStatus}
                data-engine-used={item.engineUsed || "unknown"}
                data-source-kind={item.sourceKind || "unknown"}
                data-engine-warnings={(item.warnings || []).join(" | ")}
                data-layer-build-mode={item.layerBuildMode || ""}
                data-requested-palette-count={item.requestedPaletteCount ?? ""}
                data-actual-palette-count={item.actualPaletteCount ?? ""}
                data-output-detected-colors={item.outputDetectedColors ?? ""}
                data-path-count={item.pathCount ?? ""}
                data-svg-bytes={displaySvgBytes ?? ""}
                className={[
                  "rounded-xl border border-slate-200 bg-white p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                  focused ? "shadow-xl" : "",
                  highlightedOutputStamp === item.stamp
                    ? "ring-2 ring-sky-300"
                    : "",
                ].join(" ")}
              >
                {focused && (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="m-0 text-sm font-bold text-sky-950">
                        Editing {label}
                      </p>
                      <p className="m-0 mt-0.5 text-[12px] text-slate-600">
                        {item.engineUsed ? `Engine: ${item.engineUsed}` : "Engine pending"}
                        {item.width > 0 && item.height > 0
                          ? ` - ${item.width} x ${item.height} px`
                          : ""}
                        {displaySvgBytes ? (
                          <>
                            {" - "}
                            <span data-output-file-size="true">
                              {prettyBytes(displaySvgBytes)}
                            </span>
                          </>
                        ) : null}
                        {item.sourceFileName ? (
                          <>
                            {" - "}
                            <span
                              data-output-source-file={item.sourceFileName}
                              title={`Source: ${item.sourceFileName}`}
                            >
                              Source: {item.sourceFileName}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadSvg(previewSvg, downloadFileName)}
                        className="cursor-pointer rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                      >
                        Download SVG
                      </button>
                      <button
                        type="button"
                        onClick={() => void onCopySvg(previewSvg)}
                        className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                      >
                        Copy SVG
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (item.settingsOpen) onToggleSettings(item.stamp);
                          closeFocusedEditor(item.stamp);
                        }}
                        className="cursor-pointer rounded-lg border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-sky-950 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                      >
                        Done editing
                      </button>
                    </div>
                  </div>
                )}
                {!focused ? (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[13px] font-semibold text-slate-700">
                        {label}
                      </span>
                      <p className="m-0 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-600">
                        <span>
                          {isActiveJob
                            ? formatTraceJobElapsed(elapsedMs)
                            : item.width > 0 && item.height > 0
                            ? `${item.width} x ${item.height} px`
                            : "size unknown"}
                        </span>
                        {!isActiveJob && !isFailedJob && displaySvgBytes ? (
                          <span data-output-file-size="true">
                            {prettyBytes(displaySvgBytes)}
                          </span>
                        ) : null}
                        {item.sourceFileName ? (
                          <span
                            data-output-source-file={item.sourceFileName}
                            title={`Source: ${item.sourceFileName}`}
                            className="min-w-0 truncate"
                          >
                            Source: {item.sourceFileName}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCollapsedOutput(item.stamp)}
                      data-output-minimize-control="true"
                      className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                    >
                      Minimize
                    </button>
                  </div>
                ) : null}

                {isActiveJob || isFailedJob ? (
                  <TraceJobStateCard
                    item={item}
                    label={label}
                    elapsedMs={elapsedMs}
                    onCancelOutputJob={onCancelOutputJob}
                    onRetryOutputJob={onRetryOutputJob}
                  />
                ) : (
                  <>
                {!focused && (
                <div data-output-action-row="true" className="my-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => downloadSvg(previewSvg, downloadFileName)}
                    className="flex cursor-pointer items-center justify-center rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 font-semibold text-white transition-colors hover:bg-sky-600"
                  >
                    <Icons
                      name="download"
                      size={16}
                      className="mr-1 inline-block"
                    />
                    {downloadLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onCopySvg(previewSvg)}
                    className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 transition-colors hover:bg-slate-100"
                  >
                    <Icons name="copy" size={16} className="mr-1 inline-block" />
                    Copy SVG
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!item.settingsOpen) onToggleSettings(item.stamp);
                      openFocusedEditor(item.stamp);
                    }}
                    data-output-primary-action="true"
                    aria-expanded={focused || !!item.settingsOpen}
                    aria-controls={`output-settings-${item.stamp}`}
                    className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-950 transition-colors hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    <SettingsGearIcon />
                    <span className="ml-1">Settings / Edit</span>
                  </button>
                </div>
                )}

                {item.updateError && (
                  <p className="m-0 mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] leading-5 text-red-700">
                    {item.updateError}
                  </p>
                )}

                {focused ? (
                  <div
                    data-focused-editor-workspace="true"
                    className="mt-3 grid min-w-0 max-w-full gap-4 overflow-x-hidden lg:grid-cols-[minmax(0,1fr)_minmax(300px,390px)] lg:items-start xl:grid-cols-[minmax(0,1fr)_minmax(340px,430px)]"
                  >
                    <FocusedEditorPreviewComparison
                      outputSvg={previewSvg}
                      outputAlt={`${label} SVG result`}
                      originalPreviewUrl={
                        item.sourcePreviewUrl ||
                        (sourceAvailableForOutput ? activeSourcePreviewUrl : null)
                      }
                      toolbar={
                        <>
                          <PreviewHistoryArrowButton
                            direction="left"
                            disabled={!item.previousVersion}
                            onClick={() => onStepVersion(item.stamp, "previous")}
                          />
                          <PreviewHistoryArrowButton
                            direction="right"
                            disabled={!item.nextVersion}
                            onClick={() => onStepVersion(item.stamp, "next")}
                          />
                          <FullscreenPreviewButton
                            onOpen={() => setFullscreenPreviewIndex(index)}
                            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                          />
                        </>
                      }
                    />
                    {settingsPanel}
                  </div>
                ) : (
                  <>
                    {settingsPanel}
                    <div className="relative flex min-h-[240px] items-center justify-center rounded-xl border border-slate-200 bg-white p-2 transparent-checkerboard">
                      <div className="absolute right-2 top-2 z-10 flex gap-2">
                        <PreviewHistoryArrowButton
                          direction="left"
                          disabled={!item.previousVersion}
                          onClick={() => onStepVersion(item.stamp, "previous")}
                        />
                        <PreviewHistoryArrowButton
                          direction="right"
                          disabled={!item.nextVersion}
                          onClick={() => onStepVersion(item.stamp, "next")}
                        />
                        <FullscreenPreviewButton
                          onOpen={() => setFullscreenPreviewIndex(index)}
                          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                        />
                      </div>
                      <EditedSvgPreviewImage
                        svg={previewSvg}
                        layers={null}
                        alt={`${label} SVG result`}
                        className="h-auto max-w-full"
                      />
                    </div>
                  </>
                )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className={[
            "converter-empty-output-state",
            busy ? "" : "hidden md:flex",
          ].join(" ")}
        >
          {!busy && (
            <Icons name="success" size={20} className="mb-2 inline-block" />
          )}
          <p className="m-0 font-bold">
            {busy ? "Converting..." : emptyTitle}
          </p>
          {!busy && (
            <p className="m-0 mt-2 text-sm font-medium text-slate-200">
              {emptyDescription}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TraceJobStateCard<TSettings extends MixedTraceSettings>({
  item,
  label,
  elapsedMs,
  onCancelOutputJob,
  onRetryOutputJob,
}: {
  item: TraceOutputItem<TSettings>;
  label: string;
  elapsedMs: number;
  onCancelOutputJob?: (jobId: string, stamp: number) => void;
  onRetryOutputJob?: (stamp: number) => void;
}) {
  const status = item.jobStatus ?? "running";
  const failed = status === "failed" || status === "canceled";
  const title = failed ? "Conversion did not finish" : "Converting...";
  const statusText = getTraceJobStatusText(status);
  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-sm font-bold text-slate-900">{title}</p>
          <p className="m-0 mt-1 text-[13px] leading-5 text-slate-600">
            {label}
            {item.sourceFileName ? ` from ${item.sourceFileName}` : ""}
          </p>
        </div>
        {!failed && (
          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[12px] font-bold text-sky-800">
            <span className="mr-1.5 inline-block h-3 w-3 rounded-full border-2 border-sky-300 border-t-sky-700 animate-spin" />
            {statusText}
          </span>
        )}
        {failed && (
          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[12px] font-bold text-red-700">
            {statusText}
          </span>
        )}
      </div>

      <dl className="mt-3 grid gap-2 text-[13px] text-slate-700 sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-900">Elapsed</dt>
          <dd className="m-0">{formatTraceJobElapsed(elapsedMs)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900">Engine path</dt>
          <dd className="m-0">{item.enginePathLabel || "Hybrid trace"}</dd>
        </div>
      </dl>

      {item.jobError && (
        <p className="m-0 mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-[13px] leading-5 text-red-700">
          {item.jobError}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!failed && item.canCancel && item.jobId && onCancelOutputJob && (
          <button
            type="button"
            onClick={() => onCancelOutputJob(item.jobId!, item.stamp)}
            className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
          >
            Cancel
          </button>
        )}
        {failed && onRetryOutputJob && (
          <button
            type="button"
            onClick={() => onRetryOutputJob(item.stamp)}
            className="cursor-pointer rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function CollapsedTraceOutputCard<TSettings extends MixedTraceSettings>({
  item,
  label,
  jobStatus,
  elapsedMs,
  previewSvg,
  displaySvgBytes,
  hasAppearanceChanges,
  onToggleCollapsed,
  onCopySvg,
  onDownloadSvg,
  onCancelOutputJob,
  onRetryOutputJob,
}: {
  item: TraceOutputItem<TSettings>;
  label: string;
  jobStatus: TraceOutputItem<TSettings>["jobStatus"];
  elapsedMs: number;
  previewSvg: string;
  displaySvgBytes?: number;
  hasAppearanceChanges: boolean;
  onToggleCollapsed: () => void;
  onCopySvg: (svg: string) => void | Promise<void>;
  onDownloadSvg: () => void;
  onCancelOutputJob?: (jobId: string, stamp: number) => void;
  onRetryOutputJob?: (stamp: number) => void;
}) {
  const status = jobStatus ?? "succeeded";
  const active = isTraceJobActive(status);
  const failed = status === "failed" || status === "canceled";
  return (
    <div
      key={item.stamp}
      tabIndex={-1}
      data-output-stamp={item.stamp}
      data-focused-editor="false"
      data-collapse-state="collapsed"
      data-job-id={item.jobId || ""}
      data-job-status={status}
      data-engine-used={item.engineUsed || "unknown"}
      className="rounded-xl border border-slate-200 bg-white p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 truncate text-[13px] font-bold text-slate-800">
            {label}
          </p>
          <p className="m-0 mt-0.5 text-[12px] text-slate-600">
            {active
              ? `${getTraceJobStatusText(status)} - ${formatTraceJobElapsed(elapsedMs)}`
              : failed
                ? getTraceJobStatusText(status)
                : item.width > 0 && item.height > 0
                  ? `${item.width} x ${item.height} px`
                  : "size unknown"}
            {item.engineUsed ? ` - ${item.engineUsed}` : ""}
            {displaySvgBytes ? (
              <>
                {" - "}
                <span data-output-file-size="true">
                  {prettyBytes(displaySvgBytes)}
                </span>
              </>
            ) : null}
            {item.sourceFileName ? (
              <>
                {" - "}
                <span
                  data-output-source-file={item.sourceFileName}
                  title={`Source: ${item.sourceFileName}`}
                >
                  Source: {item.sourceFileName}
                </span>
              </>
            ) : null}
            {hasAppearanceChanges ? " - appearance adjusted" : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!active && !failed && previewSvg && (
            <>
              <button
                type="button"
                onClick={onDownloadSvg}
                className="cursor-pointer rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => void onCopySvg(previewSvg)}
                className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                Copy
              </button>
            </>
          )}
          {active && item.canCancel && item.jobId && onCancelOutputJob && (
            <button
              type="button"
              onClick={() => onCancelOutputJob(item.jobId!, item.stamp)}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Cancel
            </button>
          )}
          {failed && onRetryOutputJob && (
            <button
              type="button"
              onClick={() => onRetryOutputJob(item.stamp)}
              className="cursor-pointer rounded-lg border border-sky-600 bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={onToggleCollapsed}
            data-output-restore-control="true"
            className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          >
            Restore
          </button>
        </div>
      </div>
    </div>
  );
}

export function OutputAppearanceControls({
  settings,
  support,
  controlId = "output-appearance",
  strokeOutputMode = "filled",
  strokeOutputModeAvailable = false,
  strokeOutputModeDisabledReason = null,
  onStrokeOutputModeChange,
  onChange,
  onReset,
}: {
  settings: OutputAppearanceSettings;
  support: ReturnType<typeof detectOutputAppearanceSupport>;
  controlId?: string;
  strokeOutputMode?: "filled" | "centerline";
  strokeOutputModeAvailable?: boolean;
  strokeOutputModeDisabledReason?: string | null;
  onStrokeOutputModeChange?: (mode: "filled" | "centerline") => void;
  onChange: (patch: Partial<OutputAppearanceSettings>) => void;
  onReset: () => void;
}) {
  const lineSupported = support.supportsLineWeight;
  const fillSupported = support.supportsFillSpread;
  const stickerSupported = support.supportsStickerBorder;
  const fillStyleSupported = support.supportsGradientFill || support.supportsPatternFill;
  const shadowSupported = support.supportsShadowEffect;
  const hasChanges = hasOutputAppearanceChanges(settings);
  const strokeModeDisabled = Boolean(strokeOutputModeDisabledReason);
  const showStrokeOutputMode =
    strokeOutputModeAvailable && !strokeModeDisabled && Boolean(onStrokeOutputModeChange);
  const resetSticker = () =>
    onChange({
      stickerBorderEnabled: false,
      stickerBorderWidth: DEFAULT_OUTPUT_APPEARANCE.stickerBorderWidth,
      stickerBorderColor: DEFAULT_OUTPUT_APPEARANCE.stickerBorderColor,
      stickerBorderOpacity: DEFAULT_OUTPUT_APPEARANCE.stickerBorderOpacity,
      stickerBorderJoin: DEFAULT_OUTPUT_APPEARANCE.stickerBorderJoin,
    });
  const resetInternalGap = () =>
    onChange({
      internalGapFillEnabled: false,
      internalGapFillColor: DEFAULT_OUTPUT_APPEARANCE.internalGapFillColor,
      internalGapFillOpacity: DEFAULT_OUTPUT_APPEARANCE.internalGapFillOpacity,
    });
  const resetGradient = () =>
    onChange({
      gradientEnabled: false,
      gradientType: DEFAULT_OUTPUT_APPEARANCE.gradientType,
      gradientStartColor: DEFAULT_OUTPUT_APPEARANCE.gradientStartColor,
      gradientEndColor: DEFAULT_OUTPUT_APPEARANCE.gradientEndColor,
      gradientAngle: DEFAULT_OUTPUT_APPEARANCE.gradientAngle,
    });
  const resetPattern = () =>
    onChange({
      patternEnabled: false,
      patternType: DEFAULT_OUTPUT_APPEARANCE.patternType,
      patternColor: DEFAULT_OUTPUT_APPEARANCE.patternColor,
      patternBackgroundColor: DEFAULT_OUTPUT_APPEARANCE.patternBackgroundColor,
      patternBackgroundTransparent:
        DEFAULT_OUTPUT_APPEARANCE.patternBackgroundTransparent,
      patternScale: DEFAULT_OUTPUT_APPEARANCE.patternScale,
    });
  const resetShadow = () =>
    onChange({
      shadowEnabled: false,
      shadowType: DEFAULT_OUTPUT_APPEARANCE.shadowType,
      shadowColor: DEFAULT_OUTPUT_APPEARANCE.shadowColor,
      shadowBlur: DEFAULT_OUTPUT_APPEARANCE.shadowBlur,
      shadowOffsetX: DEFAULT_OUTPUT_APPEARANCE.shadowOffsetX,
      shadowOffsetY: DEFAULT_OUTPUT_APPEARANCE.shadowOffsetY,
      shadowOpacity: DEFAULT_OUTPUT_APPEARANCE.shadowOpacity,
    });

  return (
    <div className="min-w-0" data-post-processing-controls="true">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <p className="m-0 text-[13px] font-bold text-slate-900">
          Output polish
        </p>
        <button
          type="button"
          onClick={onReset}
          disabled={!hasChanges}
          className="cursor-pointer rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      {showStrokeOutputMode ? (
        <div
          className="mt-3 border-t border-slate-100 pt-3"
          data-output-polish-group="stroke-output-mode"
        >
          <span className="block text-[12px] font-semibold text-slate-700">
            Stroke output mode
          </span>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(["filled", "centerline"] as const).map((mode) => (
              <label
                key={mode}
                className={[
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-[12px] font-semibold transition-colors",
                  strokeOutputMode === mode
                    ? "border-sky-300 bg-sky-100 text-sky-950"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
                  strokeModeDisabled ? "cursor-not-allowed opacity-60" : "",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name={`${controlId}-stroke-output-mode`}
                  value={mode}
                  checked={strokeOutputMode === mode}
                  disabled={strokeModeDisabled}
                  onChange={() => onStrokeOutputModeChange?.(mode)}
                  className="h-4 w-4 cursor-pointer accent-[#0b2dff] disabled:cursor-not-allowed"
                />
                {mode === "filled" ? "Filled shapes" : "Centerline strokes"}
              </label>
            ))}
          </div>
          <p className="m-0 mt-2 text-[12px] leading-5 text-slate-500">
            {strokeOutputModeDisabledReason ||
              "Filled shapes are best for logos, cut files, and most SVG conversions. Centerline strokes are best for simple line drawings, sketches, handwriting, and diagrams. Changing this retraces the original image."}
          </p>
        </div>
      ) : null}

      <div
        className="mt-3 border-t border-slate-100 pt-3"
        data-output-polish-group="sticker-border"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="m-0 text-[12px] font-bold text-slate-800">
              Sticker border
            </p>
            <p className="m-0 mt-1 text-[12px] leading-5 text-slate-500">
              Adds a visual outline behind the converted SVG. It is not a true cutline offset.
            </p>
          </div>
          <EffectResetButton
            disabled={
              !settings.stickerBorderEnabled &&
              settings.stickerBorderWidth <= 0.001 &&
              Math.abs(settings.stickerBorderOpacity - DEFAULT_OUTPUT_APPEARANCE.stickerBorderOpacity) <= 0.001
            }
            onClick={resetSticker}
          />
        </div>
        <ToggleRow
          label="Enable border"
          checked={settings.stickerBorderEnabled}
          disabled={!stickerSupported}
          onChange={(checked) =>
            onChange({
              stickerBorderEnabled: checked,
              stickerBorderWidth:
                checked && settings.stickerBorderWidth <= 0.001
                  ? 8
                  : settings.stickerBorderWidth,
            })
          }
        />
        {!stickerSupported ? (
          <p className="m-0 mt-2 text-[12px] leading-5 text-slate-500">
            {support.stickerBorderDisabledReason ||
              "Sticker border needs filled SVG artwork."}
          </p>
        ) : settings.stickerBorderEnabled ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ColorInput
              label="Border color"
              value={settings.stickerBorderColor}
              onChange={(value) => onChange({ stickerBorderColor: value })}
            />
            <SelectInput
              label="Join style"
              value={settings.stickerBorderJoin}
              options={[
                ["round", "Round"],
                ["bevel", "Bevel"],
                ["miter", "Miter"],
              ]}
              onChange={(value) =>
                onChange({ stickerBorderJoin: value as typeof settings.stickerBorderJoin })
              }
            />
            <RangeInput
              className="sm:col-span-2"
              label="Border thickness"
              value={settings.stickerBorderWidth}
              min={0}
              max={200}
              step={1}
              suffix="px"
              onChange={(value) => onChange({ stickerBorderWidth: value })}
            />
            <RangeInput
              className="sm:col-span-2"
              label="Border opacity"
              value={settings.stickerBorderOpacity}
              min={0}
              max={1}
              step={0.05}
              suffix=""
              onChange={(value) => onChange({ stickerBorderOpacity: value })}
            />
            <div
              className="sm:col-span-2 border-t border-slate-100 pt-3"
              data-output-polish-subcontrols="internal-gap-fill"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <ToggleRow
                    label="Fill internal gaps"
                    checked={settings.internalGapFillEnabled}
                    disabled={!support.supportsInternalGapFill}
                    onChange={(checked) => onChange({ internalGapFillEnabled: checked })}
                  />
                </div>
                <EffectResetButton
                  disabled={
                    !settings.internalGapFillEnabled &&
                    Math.abs(settings.internalGapFillOpacity - DEFAULT_OUTPUT_APPEARANCE.internalGapFillOpacity) <= 0.001
                  }
                  onClick={resetInternalGap}
                  label="Reset gap"
                />
              </div>
              <p className="m-0 mt-1 text-[12px] leading-5 text-slate-500">
                Adds the chosen color behind compound line-art interiors. Keep off for designs where transparent holes matter.
              </p>
              {!support.supportsInternalGapFill ? (
                <p className="m-0 mt-1 text-[12px] leading-5 text-slate-500">
                  {support.internalGapFillDisabledReason ||
                    "Gap fill needs foreground filled path regions."}
                </p>
              ) : null}
              {settings.internalGapFillEnabled ? (
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <ColorInput
                    label="Gap fill color"
                    value={settings.internalGapFillColor}
                    onChange={(value) => onChange({ internalGapFillColor: value })}
                  />
                  <RangeInput
                    label="Gap fill opacity"
                    value={settings.internalGapFillOpacity}
                    min={0}
                    max={1}
                    step={0.05}
                    suffix=""
                    onChange={(value) => onChange({ internalGapFillOpacity: value })}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <label className="mt-3 block">
        <span className="flex items-center justify-between gap-2 text-[12px] font-semibold text-slate-700">
          <span>Line weight</span>
          <span>{settings.lineWeight.toFixed(2)}x</span>
        </span>
        <ThrottledRangeInput
          min={0.25}
          max={30}
          step={0.05}
          value={settings.lineWeight}
          disabled={!lineSupported}
          onChange={(value) => onChange({ lineWeight: value })}
        />
        <span className="text-[12px] text-slate-500">
          {lineSupported
            ? settings.lineWeight > 12
              ? "Very high line weights are manual visual boosts and can overpower delicate paths or increase file size."
              : "Make stroked lines thinner or thicker."
            : "No stroked lines were detected in this SVG."}
        </span>
      </label>

      <label className="mt-3 flex items-center gap-2 text-[12px] text-slate-700">
        <input
          type="checkbox"
          checked={settings.nonScalingStroke}
          disabled={!lineSupported}
          onChange={(event) =>
            onChange({ nonScalingStroke: event.currentTarget.checked })
          }
          className="h-4 w-4 cursor-pointer accent-[#0b2dff] disabled:cursor-not-allowed"
        />
        Keep stroke width consistent when resized
      </label>

      <label className="mt-3 block">
        <span className="flex items-center justify-between gap-2 text-[12px] font-semibold text-slate-700">
          <span>Fill spread</span>
          <span>{settings.fillSpread.toFixed(1)}px</span>
        </span>
        <ThrottledRangeInput
          min={0}
          max={30}
          step={0.1}
          value={settings.fillSpread}
          disabled={!fillSupported}
          onChange={(value) => onChange({ fillSpread: value })}
        />
        <span className="text-[12px] text-slate-500">
          {fillSupported
            ? settings.fillSpread > 12
              ? "High fill spread values are manual visual boosts and may make tight details heavier or increase file size."
              : "Expand filled regions with a same-color under-stroke."
            : support.fillSpreadDisabledReason || "Fill spread is not safe for this output."}
        </span>
      </label>

      <div
        className="mt-4 border-t border-slate-100 pt-3"
        data-output-polish-group="fill-style"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="m-0 text-[12px] font-bold text-slate-800">
              Fill style
            </p>
            <p className="m-0 mt-1 text-[12px] leading-5 text-slate-500">
              Applies simple SVG defs to filled shapes. Pattern replaces gradient when both are enabled.
            </p>
          </div>
          <div className="flex gap-2">
            <EffectResetButton disabled={!settings.gradientEnabled} onClick={resetGradient} label="Reset gradient" />
            <EffectResetButton disabled={!settings.patternEnabled} onClick={resetPattern} label="Reset pattern" />
          </div>
        </div>
        {!fillStyleSupported ? (
          <p className="m-0 mt-2 text-[12px] leading-5 text-slate-500">
            {support.fillStyleDisabledReason ||
              "Gradient and pattern fills need filled SVG regions."}
          </p>
        ) : (
          <div className="mt-2 grid gap-3">
            <ToggleRow
              label="Gradient fill"
              checked={settings.gradientEnabled}
              disabled={!support.supportsGradientFill}
              onChange={(checked) =>
                onChange({ gradientEnabled: checked, patternEnabled: checked ? false : settings.patternEnabled })
              }
            />
            {settings.gradientEnabled ? (
              <div
                className="grid gap-3 border-l-2 border-teal-100 pl-3 sm:grid-cols-2"
                data-output-polish-subcontrols="gradient-fill"
              >
                <SelectInput
                  label="Gradient type"
                  value={settings.gradientType}
                  options={[
                    ["linear", "Linear"],
                    ["radial", "Radial"],
                  ]}
                  onChange={(value) =>
                    onChange({ gradientType: value as typeof settings.gradientType })
                  }
                />
                <RangeInput
                  label="Angle"
                  value={settings.gradientAngle}
                  min={0}
                  max={360}
                  step={1}
                  suffix="deg"
                  disabled={settings.gradientType === "radial"}
                  onChange={(value) => onChange({ gradientAngle: value })}
                />
                <ColorInput
                  label="Start"
                  value={settings.gradientStartColor}
                  onChange={(value) => onChange({ gradientStartColor: value })}
                />
                <ColorInput
                  label="End"
                  value={settings.gradientEndColor}
                  onChange={(value) => onChange({ gradientEndColor: value })}
                />
              </div>
            ) : null}

            <ToggleRow
              label="Pattern fill"
              checked={settings.patternEnabled}
              disabled={!support.supportsPatternFill}
              onChange={(checked) =>
                onChange({ patternEnabled: checked, gradientEnabled: checked ? false : settings.gradientEnabled })
              }
            />
            {settings.patternEnabled ? (
              <div
                className="grid gap-3 border-l-2 border-teal-100 pl-3 sm:grid-cols-2"
                data-output-polish-subcontrols="pattern-fill"
              >
                <SelectInput
                  label="Pattern"
                  value={settings.patternType}
                  options={[
                    ["dots", "Dots"],
                    ["diagonal-stripes", "Diagonal stripes"],
                    ["horizontal-stripes", "Horizontal stripes"],
                    ["checker", "Checker"],
                  ]}
                  onChange={(value) =>
                    onChange({ patternType: value as typeof settings.patternType })
                  }
                />
                <RangeInput
                  label="Spacing"
                  value={settings.patternScale}
                  min={4}
                  max={48}
                  step={1}
                  suffix="px"
                  onChange={(value) => onChange({ patternScale: value })}
                />
                <ColorInput
                  label="Pattern color"
                  value={settings.patternColor}
                  onChange={(value) => onChange({ patternColor: value })}
                />
                <div className="min-w-0">
                  <ToggleRow
                    label="Transparent background"
                    checked={settings.patternBackgroundTransparent}
                    onChange={(checked) =>
                      onChange({ patternBackgroundTransparent: checked })
                    }
                  />
                  {!settings.patternBackgroundTransparent ? (
                    <div className="mt-2">
                      <ColorInput
                        label="Background"
                        value={settings.patternBackgroundColor}
                        onChange={(value) =>
                          onChange({ patternBackgroundColor: value })
                        }
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div
        className="mt-4 border-t border-slate-100 pt-3"
        data-output-polish-group="shadow-glow"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="m-0 text-[12px] font-bold text-slate-800">
              Shadow and glow
            </p>
            <p className="m-0 mt-1 text-[12px] leading-5 text-slate-500">
              Visual SVG filter for previews and graphic exports. Disabled for precision cut outputs.
            </p>
          </div>
          <EffectResetButton disabled={!settings.shadowEnabled} onClick={resetShadow} />
        </div>
        <ToggleRow
          label="Enable effect"
          checked={settings.shadowEnabled}
          disabled={!shadowSupported}
          onChange={(checked) => onChange({ shadowEnabled: checked })}
        />
        {!shadowSupported ? (
          <p className="m-0 mt-2 text-[12px] leading-5 text-slate-500">
            {support.shadowEffectDisabledReason ||
              "Shadow and glow need visible SVG artwork."}
          </p>
        ) : settings.shadowEnabled ? (
          <div
            className="mt-3 grid gap-3 border-l-2 border-violet-100 pl-3 sm:grid-cols-2"
            data-output-polish-subcontrols="shadow-glow"
          >
            <SelectInput
              label="Effect"
              value={settings.shadowType}
              options={[
                ["shadow", "Soft shadow"],
                ["glow", "Glow"],
              ]}
              onChange={(value) =>
                onChange({ shadowType: value as typeof settings.shadowType })
              }
            />
            <ColorInput
              label="Color"
              value={settings.shadowColor}
              onChange={(value) => onChange({ shadowColor: value })}
            />
            <RangeInput
              label="Blur"
              value={settings.shadowBlur}
              min={0}
              max={24}
              step={0.5}
              suffix="px"
              onChange={(value) => onChange({ shadowBlur: value })}
            />
            <RangeInput
              label="Opacity"
              value={settings.shadowOpacity}
              min={0}
              max={1}
              step={0.05}
              suffix=""
              onChange={(value) => onChange({ shadowOpacity: value })}
            />
            {settings.shadowType === "shadow" ? (
              <>
                <RangeInput
                  label="Offset X"
                  value={settings.shadowOffsetX}
                  min={-40}
                  max={40}
                  step={1}
                  suffix="px"
                  onChange={(value) => onChange({ shadowOffsetX: value })}
                />
                <RangeInput
                  label="Offset Y"
                  value={settings.shadowOffsetY}
                  min={-40}
                  max={40}
                  step={1}
                  suffix="px"
                  onChange={(value) => onChange({ shadowOffsetY: value })}
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="mt-2 flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
      <span className="min-w-0">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="h-4 w-4 shrink-0 cursor-pointer accent-[#0b2dff] disabled:cursor-not-allowed"
      />
    </label>
  );
}

function RangeInput({
  label,
  value,
  min,
  max,
  step,
  suffix,
  disabled = false,
  className = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  disabled?: boolean;
  className?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="flex items-center justify-between gap-2 text-[12px] font-semibold text-slate-700">
        <span>{label}</span>
        <span>
          {Number(value).toFixed(suffix === "" ? 2 : suffix === "deg" ? 0 : 1)}
          {suffix}
        </span>
      </span>
      <ThrottledRangeInput
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </label>
  );
}

function ThrottledRangeInput({
  value,
  min,
  max,
  step,
  disabled = false,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const normalize = React.useCallback(
    (nextValue: number) => {
      const numberValue = Number(nextValue);
      if (!Number.isFinite(numberValue)) return null;
      return clampNumberToStep(numberValue, min, max, step);
    },
    [max, min, step],
  );
  const controller = useThrottledCommit({
    value: normalize(value) ?? min,
    onCommit: onChange,
    delayMs: 180,
    normalize,
    isEqual: areNumbersEqual,
  });

  const scheduleEventValue = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement> | React.FormEvent<HTMLInputElement>) => {
      controller.schedule(Number(event.currentTarget.value));
    },
    [controller],
  );
  const flushEventValue = React.useCallback(
    (event?: React.SyntheticEvent<HTMLInputElement>) => {
      controller.flush(
        event?.currentTarget
          ? Number(event.currentTarget.value)
          : undefined,
      );
    },
    [controller],
  );

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={controller.draft}
      disabled={disabled}
      onInput={scheduleEventValue}
      onChange={scheduleEventValue}
      onPointerUp={flushEventValue}
      onMouseUp={flushEventValue}
      onTouchEnd={flushEventValue}
      onKeyUp={flushEventValue}
      onBlur={flushEventValue}
      className="mt-1 w-full cursor-pointer accent-[#0b2dff] disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const normalizedValue = normalizeHexColor(value) || "#000000";
  const normalize = React.useCallback(
    (nextValue: string) => normalizeHexColor(nextValue),
    [],
  );
  const controller = useThrottledCommit({
    value: normalizedValue,
    onCommit: onChange,
    delayMs: 120,
    leading: false,
    normalize,
  });
  const [textValue, setTextValue] = React.useState(normalizedValue);

  React.useEffect(() => {
    setTextValue((current) =>
      normalizeHexColor(current) === normalizedValue ? current : normalizedValue,
    );
  }, [normalizedValue]);

  const scheduleColor = React.useCallback(
    (nextValue: string) => {
      const normalized = normalizeHexColor(nextValue);
      setTextValue(nextValue);
      if (normalized) {
        controller.schedule(normalized);
      }
    },
    [controller],
  );
  const flushColor = React.useCallback(
    (nextValue?: string) => {
      const normalized =
        normalizeHexColor(nextValue || textValue) ||
        normalizeHexColor(controller.draft) ||
        normalizedValue;
      setTextValue(normalized);
      controller.flush(normalized);
    },
    [controller, normalizedValue, textValue],
  );
  const colorInputRef = useNativeColorFinalCommit(flushColor);
  const colorValue =
    normalizeHexColor(controller.draft) || normalizedValue;

  return (
    <label className="block min-w-0">
      <span className="block text-[12px] font-semibold text-slate-700">
        {label}
      </span>
      <span className="mt-1 flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
        <input
          ref={colorInputRef}
          type="color"
          value={colorValue}
          onInput={(event) => scheduleColor(event.currentTarget.value)}
          onChange={(event) => scheduleColor(event.currentTarget.value)}
          onPointerUp={() => flushColor()}
          onMouseUp={() => flushColor()}
          onTouchEnd={() => flushColor()}
          onBlur={() => flushColor()}
          className="h-7 w-8 shrink-0 cursor-pointer rounded border border-slate-200 bg-transparent p-0"
        />
        <input
          type="text"
          value={textValue}
          onChange={(event) => scheduleColor(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              flushColor(event.currentTarget.value);
            }
          }}
          onBlur={(event) => flushColor(event.currentTarget.value)}
          aria-invalid={!normalizeHexColor(textValue)}
          className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-slate-700 outline-none"
        />
      </span>
    </label>
  );
}

function clampNumberToStep(value: number, min: number, max: number, step: number) {
  const clamped = Math.max(min, Math.min(max, value));
  if (!Number.isFinite(step) || step <= 0) return clamped;
  const decimals = getStepDecimals(step);
  return Number((Math.round((clamped - min) / step) * step + min).toFixed(decimals));
}

function getStepDecimals(step: number) {
  const [, decimals = ""] = String(step).split(".");
  return Math.min(6, decimals.length);
}

function areNumbersEqual(left: number, right: number) {
  return Math.abs(left - right) < 0.0001;
}

function normalizeHexColor(value: string) {
  const raw = String(value || "").trim();
  const short = raw.match(/^#?([0-9a-f]{3})$/i);
  if (short) {
    return `#${short[1]
      .split("")
      .map((part) => `${part}${part}`)
      .join("")
      .toLowerCase()}`;
  }
  const full = raw.match(/^#?([0-9a-f]{6})$/i);
  return full ? `#${full[1].toLowerCase()}` : null;
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-[12px] font-semibold text-slate-700">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="mt-1 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 py-2 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function EffectResetButton({
  disabled,
  onClick,
  label = "Reset",
}: {
  disabled: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function buildOutputLabel<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
  index: number,
): string {
  const preset = item.presetLabel ? ` - ${item.presetLabel}` : "";
  return `Output ${index + 1}${preset}`;
}

function getOutputLabel<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
  index: number,
): string {
  const fallback = buildOutputLabel(item, index);
  const explicitName = item.name?.trim();
  if (!explicitName) return fallback;
  if (!item.presetLabel) return explicitName;
  if (explicitName.includes(item.presetLabel)) return explicitName;
  if (/^Output\s+\d+$/i.test(explicitName)) {
    return `${explicitName} - ${item.presetLabel}`;
  }
  return explicitName;
}

function isTraceJobActive(status?: TraceOutputItem<MixedTraceSettings>["jobStatus"]) {
  return status === "queued" || status === "running";
}

function getTraceJobElapsedMs<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
  nowMs: number,
): number {
  const started = Number(item.jobStartedAt || 0);
  if (!Number.isFinite(started) || started <= 0) return 0;
  const ended = Number(item.jobCompletedAt || 0);
  const end = Number.isFinite(ended) && ended > 0 ? ended : nowMs;
  return Math.max(0, end - started);
}

function formatTraceJobElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function getTraceJobStatusText(
  status: TraceOutputItem<MixedTraceSettings>["jobStatus"],
): string {
  if (status === "queued") return "Queued";
  if (status === "failed") return "Failed";
  if (status === "canceled") return "Canceled";
  return "Running";
}

function getStoredOutputAppearance<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
): OutputAppearanceSettings {
  return normalizeOutputAppearance(
    item.appearance ?? outputAppearanceStore.get(getOutputAppearanceKey(item)),
  );
}

function serializeOutputAppearance(
  appearance: Partial<OutputAppearanceSettings> | null | undefined,
): string {
  return JSON.stringify(normalizeOutputAppearance(appearance));
}

function pruneOutputAppearanceState(keys: Iterable<string>) {
  const activeKeys = new Set(keys);
  for (const key of outputAppearanceStore.keys()) {
    if (!activeKeys.has(key)) outputAppearanceStore.delete(key);
  }
  for (const key of outputAppearanceSvgCache.keys()) {
    if (!activeKeys.has(key)) outputAppearanceSvgCache.delete(key);
  }
}

function getOutputAppearanceKey<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
): string {
  return item.jobId || String(item.stamp);
}

function isPrecisionOutputItem<TSettings extends MixedTraceSettings>(
  item: TraceOutputItem<TSettings>,
): boolean {
  const text = `${item.name || ""} ${item.presetLabel || ""}`.toLowerCase();
  return /\b(cut|cricut|vinyl|silhouette|laser)\b/.test(text);
}

const svgByteSizeCache = new Map<string, number>();

export function getSvgByteSize(svg: string): number {
  const cached = svgByteSizeCache.get(svg);
  if (cached != null) return cached;
  const size =
    typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(svg).length
      : new Blob([svg], { type: "image/svg+xml;charset=utf-8" }).size;
  svgByteSizeCache.set(svg, size);
  if (svgByteSizeCache.size > 80) {
    const firstKey = svgByteSizeCache.keys().next().value;
    if (firstKey) svgByteSizeCache.delete(firstKey);
  }
  return size;
}

export function prettyBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(bytes) || 0;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(1)} ${units[index]}`;
}

function downloadSvg(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function applySvgSizeAttributes(svg: string, width: number, height: number): string {
  const safeWidth = Math.round(Number(width));
  const safeHeight = Math.round(Number(height));
  if (
    !Number.isFinite(safeWidth) ||
    !Number.isFinite(safeHeight) ||
    safeWidth <= 0 ||
    safeHeight <= 0
  ) {
    return svg;
  }

  return String(svg).replace(/<svg\b([^>]*)>/i, (_match, attrs) => {
    const nextAttrs = String(attrs)
      .replace(/\swidth\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\sheight\s*=\s*["'][^"']*["']/gi, "");
    return ensureSvgRootNamespace(
      `<svg${nextAttrs} width="${safeWidth}" height="${safeHeight}">`,
    );
  });
}

function SettingsGearIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.1.35.33.66.66.85.26.15.55.23.85.24H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}
